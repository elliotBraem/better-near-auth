import { NearConnector } from "@hot-labs/near-connect";
import type { NearWalletBase, WalletManifest } from "@hot-labs/near-connect";
import { generateNonce } from "near-kit";

type Account = Awaited<ReturnType<NearWalletBase["getAccounts"]>>[number];
import type { BetterAuthClientPlugin, BetterFetch, BetterFetchOption, BetterFetchResponse } from "better-auth/client";
import { atom } from "nanostores";
import { Near, fromHotConnect } from "near-kit";
import { sign } from "near-sign-verify";
import type { siwn } from ".";
import { type AccountId, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type SignedMessage, type VerifyRequestT, type VerifyResponseT } from "./types";
import { base64ToBytes, bytesToBase64 } from "./utils";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	recipient: string;
	networkId?: "mainnet" | "testnet";
}

export interface CachedNonceData {
	nonce: string;
	accountId: string;
	publicKey?: string | null;
	networkId: string;
	timestamp: number;
}

export interface SIWNClientActions {
	near: {
		nonce: (params: NonceRequestT) => Promise<BetterFetchResponse<NonceResponseT>>;
		verify: (params: VerifyRequestT) => Promise<BetterFetchResponse<VerifyResponseT>>;
		getProfile: (accountId?: AccountId) => Promise<BetterFetchResponse<ProfileResponseT>>;
		getNearClient: () => Near;
		getAccountId: () => string | null;
		getState: () => { accountId: string | null; publicKey: string | null; networkId: string } | null;
		disconnect: () => Promise<void>;
		link: (callbacks?: AuthCallbacks) => Promise<void>;
		unlink: (params: { accountId: string; network?: "mainnet" | "testnet" }) => Promise<BetterFetchResponse<{ success: boolean; message: string }>>;
		listAccounts: () => Promise<BetterFetchResponse<{ accounts: any[] }>>;
	};
	requestSignIn: {
		near: (callbacks?: AuthCallbacks) => Promise<void>;
	};
	signIn: {
		near: (callbacks?: AuthCallbacks) => Promise<void>;
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

	const network = config.networkId || "mainnet";
	const connector = new NearConnector({ network });

	const publicNear = new Near({ network });

	let nearInstance: Near | null = null;
	let connectionPromise: Promise<void> | null = null;
	let connectionResolve: (() => void) | null = null;
	let connectionReject: ((error: Error) => void) | null = null;
	let pendingSignInCallbacks: AuthCallbacks | null = null;
	let pendingSignInNonce: Uint8Array | null = null;
	let fetcher: BetterFetch | null = null;

	const clearNonce = () => {
		cachedNonce.set(null);
	};

	const isNonceValid = (nonceData: CachedNonceData | null): boolean => {
		if (!nonceData) return false;
		const now = Date.now();
		const fiveMinutes = 5 * 60 * 1000;
		return (now - nonceData.timestamp) < fiveMinutes;
	};

	const handleAccountConnection = async (accounts: Account[]) => {
		try {
			const accountId = accounts?.[0]?.accountId;
			if (!accountId) return;

			nearInstance = new Near({
				network,
				wallet: fromHotConnect(connector as unknown as Parameters<typeof fromHotConnect>[0]),
			});

			nearState.set({
				accountId,
				publicKey: accounts?.[0]?.publicKey || null,
				networkId: network
			});

			if (connectionResolve) {
				connectionResolve();
				connectionResolve = null;
				connectionReject = null;
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			if (connectionReject) {
				connectionReject(err);
				connectionResolve = null;
				connectionReject = null;
			}
		}
	};

	const handleSignInAndSignMessage = async (data: { accounts: Account[] }) => {
		if (data?.accounts && data.accounts[0] && fetcher && pendingSignInNonce) {
			const account = data.accounts[0] as Account & { signedMessage?: SignedMessage };
			const signedMessage = account.signedMessage;
			
			if (signedMessage && pendingSignInCallbacks) {
				const callbacks = pendingSignInCallbacks;
				pendingSignInCallbacks = null;
				const nonce = pendingSignInNonce;
				pendingSignInNonce = null;
				
				await handleAccountConnection(data.accounts);
				
				const message = `Sign in to ${config.recipient}`;

				const verifyResponse = await fetcher("/near/verify", {
					method: "POST",
					body: {
						signedMessage,
						message,
						recipient: config.recipient,
						nonce: bytesToBase64(nonce),
						accountId: signedMessage.accountId,
					}
				}) as BetterFetchResponse<VerifyResponseT>;

				if (verifyResponse.error) {
					callbacks.onError?.(new Error(verifyResponse.error.message || "Failed to verify signature"));
				} else if (!verifyResponse?.data?.success) {
					callbacks.onError?.(new Error("Authentication verification failed"));
				} else {
					callbacks.onSuccess?.();
				}
			}
		}
	};

	connector.getConnectedWallet().then((result: {
		wallet: NearWalletBase;
		accounts: Account[];
	}) => {
		if (result && result.accounts && result.accounts.length > 0) {
			handleAccountConnection(result.accounts);
		}
	}).catch(() => {});

	connector.on("wallet:signIn", async (data) => {
		if (data?.accounts) {
			await handleAccountConnection(data.accounts);
		}
	});

	connector.on("wallet:signInAndSignMessage", async (data) => {
		await handleSignInAndSignMessage(data);
	});

	connector.on("wallet:signOut", () => {
		nearInstance = null;
		nearState.set(null);
		clearNonce();
	});

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: (_$fetch) => ({
			nearState,
			cachedNonce,
		}),

		getActions: ($fetch): SIWNClientActions => {
			fetcher = $fetch;
			
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
					getNearClient: () => {
						return nearInstance || publicNear;
					},
					getAccountId: () => {
						const state = nearState.get();
						return state?.accountId || null;
					},
					getState: () => nearState.get(),
					disconnect: async () => {
						if (connector) {
							await connector.disconnect();
						}
						nearInstance = null;
						clearNonce();
						nearState.set(null);
					},
					link: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							if (!nearInstance) {
								const error = new Error("NEAR client not available") as Error & { code?: string };
								error.code = "SIGNER_NOT_AVAILABLE";
								throw error;
							}

							const state = nearState.get();
							const accountId = state?.accountId;
							if (!accountId) {
								const error = new Error("Wallet not connected. Please connect your wallet first.") as Error & { code?: string };
								error.code = "WALLET_NOT_CONNECTED";
								throw error;
							}

							const nonceRequest: NonceRequestT = {
								accountId,
								networkId: (state.networkId || network) as "mainnet" | "testnet"
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

							const message = `Sign in to ${config.recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							const authToken = await sign(message, {
								signer: nearInstance,
								recipient: config.recipient,
								nonce: nonceBytes,
							});

							if (!state.publicKey) {
								try {
									const parsedToken = JSON.parse(authToken);
									if (parsedToken.publicKey) {
										nearState.set({
											...state,
											publicKey: parsedToken.publicKey,
										});
									}
								} catch (e) {}
							}

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
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							clearNonce();

							connectionPromise = new Promise<void>((resolve, reject) => {
								connectionResolve = resolve;
								connectionReject = reject;
							});

							await connector.connect();

							await connectionPromise;

							const state = nearState.get();
							if (!state || !state.accountId) {
								throw new Error("Failed to get account information after wallet connection");
							}

							const { accountId, networkId, publicKey } = state;

							const nonceRequest: NonceRequestT = {
								accountId,
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
					}
				},
				signIn: {
					near: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const wallet = await connector.wallet();
							const manifest: WalletManifest = wallet.manifest;
							const supportsSignMessage = manifest.features?.signMessage === true;

							if (supportsSignMessage) {
								pendingSignInCallbacks = callbacks || null;
								
								const nonce = generateNonce();
								pendingSignInNonce = nonce;
								
								await connector.connect({
									signMessageParams: {
										message: `Sign in to ${config.recipient}`,
										recipient: config.recipient,
										nonce
									}
								});
								
								return;
							}

							if (!nearInstance) {
								const error = new Error("NEAR client not available") as Error & { code?: string };
								error.code = "SIGNER_NOT_AVAILABLE";
								throw error;
							}

							const state = nearState.get();
							const accountId = state?.accountId;
							if (!accountId) {
								const error = new Error("Wallet not connected. Please connect your wallet first.") as Error & { code?: string };
								error.code = "WALLET_NOT_CONNECTED";
								throw error;
							}

							const nonceData = cachedNonce.get();

							if (!isNonceValid(nonceData)) {
								const error = new Error("No valid nonce found. Please call requestSignIn first.") as Error & { code?: string };
								error.code = "NONCE_NOT_FOUND";
								throw error;
							}

							if (nonceData!.accountId !== accountId) {
								const error = new Error("Account ID mismatch. Please call requestSignIn again.") as Error & { code?: string };
								error.code = "ACCOUNT_MISMATCH";
								throw error;
							}

							const { nonce } = nonceData!;

							const message = `Sign in to ${config.recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							const authToken = await sign(message, {
								signer: nearInstance,
								recipient: config.recipient,
								nonce: nonceBytes,
							});

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

							clearNonce();
							callbacks?.onSuccess?.();
						} catch (error) {
							const err = error instanceof Error ? error : new Error(String(error));
							clearNonce();
							callbacks?.onError?.(err);
						}
					}
				}
			};
		}
	} satisfies BetterAuthClientPlugin;
};
