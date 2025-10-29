import type { BetterAuthClientPlugin, BetterFetch, BetterFetchOption, BetterFetchResponse } from "better-auth/client";
import { createNearClient } from "fastintear";
import { base64ToBytes } from "fastintear/utils";
import { atom } from "nanostores";
import { parseAuthToken, sign } from "near-sign-verify";
import type { siwn } from ".";
import { type AccountId, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type VerifyRequestT, type VerifyResponseT } from "./types";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	domain: string; // TODO: this could potentially be shade agent proxy or something, doesn't really have any purpose rn
	networkId?: "mainnet" | "testnet";
	// TODO: should include browser vs keypair
}

export interface CachedNonceData {
	nonce: string;
	accountId: string;
	publicKey: string;
	networkId: string;
	timestamp: number;
}

export interface SIWNClientActions {
	near: {
		nonce: (params: NonceRequestT) => Promise<BetterFetchResponse<NonceResponseT>>;
		verify: (params: VerifyRequestT) => Promise<BetterFetchResponse<VerifyResponseT>>;
		getProfile: (accountId?: AccountId) => Promise<BetterFetchResponse<ProfileResponseT>>;
		getNearClient: () => ReturnType<typeof createNearClient>;
		getAccountId: () => string | null;
		getState: () => { accountId: string | null; publicKey: string | null; networkId: string } | null;
		disconnect: () => Promise<void>;
		link: (params: { recipient: string }, callbacks?: AuthCallbacks) => Promise<void>;
		unlink: (params: { accountId: string; network?: "mainnet" | "testnet" }) => Promise<BetterFetchResponse<{ success: boolean; message: string }>>;
		listAccounts: () => Promise<BetterFetchResponse<{ accounts: any[] }>>;
	};
	requestSignIn: {
		near: (params: { recipient: string }, callbacks?: AuthCallbacks) => Promise<void>;
	};
	signIn: {
		near: (params: { recipient: string }, callbacks?: AuthCallbacks) => Promise<void>;
	};
}

export interface SIWNClientPlugin extends BetterAuthClientPlugin {
	id: "siwn";
	$InferServerPlugin: ReturnType<typeof siwn>;
	getAtoms: ($fetch: BetterFetch) => {
		nearState: ReturnType<typeof atom<{ accountId: string | null; publicKey: string | null; networkId: string } | null>>;
		cachedNonce: ReturnType<typeof atom<CachedNonceData | null>>;
	};
	getActions: ($fetch: BetterFetch) => SIWNClientActions;
}

export const siwnClient = (config: SIWNClientConfig): SIWNClientPlugin => {
	const cachedNonce = atom<CachedNonceData | null>(null);
	const nearState = atom<{ accountId: string | null; publicKey: string | null; networkId: string } | null>(null);

	const clearNonce = () => {
		cachedNonce.set(null);
	};

	const isNonceValid = (nonceData: CachedNonceData | null): boolean => {
		if (!nonceData) return false;
		const now = Date.now();
		const fiveMinutes = 5 * 60 * 1000;
		return (now - nonceData.timestamp) < fiveMinutes;
	};

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: ($fetch) => ({
			nearState,
			cachedNonce,
		}),

		getActions: ($fetch): SIWNClientActions => {
			const nearClient = createNearClient({
				networkId: config.networkId || "mainnet",
				callbacks: {
					onConnect: (accountData) => {
						// Update nearState atom when wallet connects
						nearState.set({
							accountId: accountData.accountId,
							publicKey: accountData.publicKey,
							networkId: config.networkId || "mainnet"
						});
					},
					onDisconnect: () => {
						// Clear nearState atom when wallet disconnects
						nearState.set(null);
						clearNonce();
					}
				}
			});

			return {
				near: {
					nonce: async (params: NonceRequestT, fetchOptions?: BetterFetchOption): Promise<BetterFetchResponse<NonceResponseT>> => {
						return await $fetch("/near/nonce", {
							method: "POST",
							body: params,
							...fetchOptions
						});
					},
					verify: async (params: VerifyRequestT, fetchOptions?: BetterFetchOption): Promise<BetterFetchResponse<VerifyResponseT>> => {
						return await $fetch("/near/verify", {
							method: "POST",
							body: params,
							...fetchOptions
						});
					},
					getProfile: async (accountId?: AccountId, fetchOptions?: BetterFetchOption): Promise<BetterFetchResponse<ProfileResponseT>> => {
						return await $fetch("/near/profile", {
							method: "POST",
							body: { accountId },
							...fetchOptions
						});
					},
					getNearClient: () => nearClient,
					getAccountId: () => nearClient.accountId(),
					getState: () => nearState.get(),
					disconnect: async () => {
						await nearClient.signOut();
						clearNonce();
						nearState.set(null);
					},
					link: async (
						params: { recipient: string },
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { recipient } = params;

							if (!nearClient) {
								const error = new Error("NEAR client not available") as Error & { code?: string };
								error.code = "SIGNER_NOT_AVAILABLE";
								throw error;
							}

							const accountId = nearClient.accountId();
							if (!accountId) {
								const error = new Error("Wallet not connected. Please connect your wallet first.") as Error & { code?: string };
								error.code = "WALLET_NOT_CONNECTED";
								throw error;
							}

							// Get nonce first
							const state = nearState.get();
							const nonceRequest: NonceRequestT = {
								accountId,
								publicKey: state?.publicKey || "",
								networkId: (state?.networkId || "mainnet") as "mainnet" | "testnet"
							};

							const nonceResponse: BetterFetchResponse<NonceResponseT> = await $fetch("/near/nonce", {
								method: "POST",
								body: nonceRequest
							});

							if (nonceResponse.error) {
								throw new Error(nonceResponse.error.message || "Failed to get nonce");
							}

							const nonce = nonceResponse?.data?.nonce;
							if (!nonce) {
								throw new Error("No nonce received from server");
							}

							// Create the sign-in message
							const message = `Sign in to ${recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							// Sign the message
							const authToken = await sign(message, {
								signer: nearClient,
								recipient,
								nonce: nonceBytes,
							});

							// Link the account (instead of verify)
							const linkResponse: BetterFetchResponse<any> = await $fetch("/near/link-account", {
								method: "POST",
								body: {
									authToken,
									accountId,
								}
							});

							if (linkResponse.error) {
								throw new Error(linkResponse.error.message || "Failed to link NEAR account");
							}

							if (!linkResponse?.data?.success) {
								throw new Error("Account linking failed");
							}

							callbacks?.onSuccess?.();
						} catch (error) {
							const err = error instanceof Error ? error : new Error(String(error));
							callbacks?.onError?.(err);
						}
					},
					unlink: async (
						params: { accountId: string; network?: "mainnet" | "testnet" },
						fetchOptions?: BetterFetchOption
					): Promise<BetterFetchResponse<{ success: boolean; message: string }>> => {
						return await $fetch("/near/unlink-account", {
							method: "POST",
							body: params,
							...fetchOptions
						});
					},
					listAccounts: async (): Promise<BetterFetchResponse<{ accounts: any[] }>> => {
						return await $fetch("/near/list-accounts", { method: "GET" });
					},
				},
				requestSignIn: {
					near: async (
						params: { recipient: string },
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { recipient } = params;

							if (!nearClient) {
								const error = new Error("NEAR client not available") as Error & { code?: string };
								error.code = "SIGNER_NOT_AVAILABLE";
								throw error;
							}

							clearNonce();

							await nearClient.requestSignIn({ contractId: recipient }, {
								onSuccess: async ({ accountId, publicKey, networkId }: { accountId: string, publicKey: string, networkId: string }) => {
									try {
										const nonceRequest: NonceRequestT = {
											accountId,
											publicKey,
											networkId: networkId as "mainnet" | "testnet"
										};

										const nonceResponse: BetterFetchResponse<NonceResponseT> = await $fetch("/near/nonce", {
											method: "POST",
											body: nonceRequest
										});

										if (nonceResponse.error) {
											throw new Error(nonceResponse.error.message || "Failed to get nonce");
										}

										const nonce = nonceResponse?.data?.nonce;
										if (!nonce) {
											throw new Error("No nonce received from server");
										}

										// Cache nonce with all wallet data
										const cachedData: CachedNonceData = {
											nonce,
											accountId,
											publicKey,
											networkId,
											timestamp: Date.now()
										};
										cachedNonce.set(cachedData);

										callbacks?.onSuccess?.();
									} catch (error) {
										const err = error instanceof Error ? error : new Error(String(error));
										clearNonce();
										callbacks?.onError?.(err);
									}
								},
								onError: (error: any) => {
									const err = error instanceof Error ? error : new Error(String(error));
									clearNonce();
									callbacks?.onError?.(err);
								}
							});
						} catch (error) {
							const err = error instanceof Error ? error : new Error(String(error));
							clearNonce();
							callbacks?.onError?.(err);
						}
					}
				},
				signIn: {
					near: async (
						params: { recipient: string },
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { recipient } = params;

							if (!nearClient) {
								const error = new Error("NEAR client not available") as Error & { code?: string };
								error.code = "SIGNER_NOT_AVAILABLE";
								throw error;
							}

							const accountId = nearClient.accountId();
							if (!accountId) {
								const error = new Error("Wallet not connected. Please connect your wallet first.") as Error & { code?: string };
								error.code = "WALLET_NOT_CONNECTED";
								throw error;
							}

							// Retrieve nonce from cache
							const nonceData = cachedNonce.get();

							if (!isNonceValid(nonceData)) {
								const error = new Error("No valid nonce found. Please call requestSignIn first.") as Error & { code?: string };
								error.code = "NONCE_NOT_FOUND";
								throw error;
							}

							// Validate that the cached nonce matches the current account
							if (nonceData!.accountId !== accountId) {
								const error = new Error("Account ID mismatch. Please call requestSignIn again.") as Error & { code?: string };
								error.code = "ACCOUNT_MISMATCH";
								throw error;
							}

							const { nonce } = nonceData!;

							// Create the sign-in message
							const message = `Sign in to ${recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							// Sign the message
							const authToken = await sign(message, {
								signer: nearClient,
								recipient,
								nonce: nonceBytes,
							});

							// Verify the signature with the server
							const verifyResponse: BetterFetchResponse<VerifyResponseT> = await $fetch("/near/verify", {
								method: "POST",
								body: {
									authToken,
									accountId,
								}
							});

							if (verifyResponse.error) {
								throw new Error(verifyResponse.error.message || "Failed to verify signature");
							}

							if (!verifyResponse?.data?.success) {
								throw new Error("Authentication verification failed");
							}

							// Clear the nonce after successful authentication
							clearNonce();
							callbacks?.onSuccess?.();
						} catch (error) {
							const err = error instanceof Error ? error : new Error(String(error));
							// Clear nonce on error to prevent reuse
							clearNonce();
							callbacks?.onError?.(err);
						}
					}
				}
			};
		}
	} satisfies BetterAuthClientPlugin;
};
