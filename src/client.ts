import type { BetterAuthClientPlugin, BetterFetch, BetterFetchOption, BetterFetchResponse } from "better-auth/client";
import { NearConnector } from "@hot-labs/near-connect";
import { Near, fromHotConnect, generateNonce } from "near-kit";
import { atom } from "nanostores";
import type { siwn } from ".";
import { base64ToBytes } from "./utils";
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
		getNearClient: () => Near | null;
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

	// Initialize Hot Connect connector
	const network = config.networkId || "mainnet";
	const connector = new NearConnector({ network });

	// Near instance will be created after wallet connection
	let nearInstance: Near | null = null;
	let connectionPromise: Promise<void> | null = null;
	let connectionResolve: (() => void) | null = null;
	let connectionReject: ((error: Error) => void) | null = null;

	const clearNonce = () => {
		cachedNonce.set(null);
	};

	const isNonceValid = (nonceData: CachedNonceData | null): boolean => {
		if (!nonceData) return false;
		const now = Date.now();
		const fiveMinutes = 5 * 60 * 1000;
		return (now - nonceData.timestamp) < fiveMinutes;
	};

	// Set up event listeners for Hot Connect
	// Per documentation: connector.on("wallet:signIn", async (t) => { const address = t.accounts[0].accountId; })
	connector.on("wallet:signIn", async (data: any) => {
		try {
			// Per Hot Connect docs: t.accounts[0].accountId
			const accountId = data?.accounts?.[0]?.accountId;
			
			if (!accountId) {
				throw new Error(`Failed to get account ID from wallet connection. Event data.accounts: ${data?.accounts ? 'exists' : 'missing'}`);
			}

			// Create Near instance with Hot Connect wallet adapter
			nearInstance = new Near({
				network,
				wallet: fromHotConnect(connector),
			});

			// Update state with account info
			// publicKey will be set from first signed message if not in event data
			nearState.set({
				accountId,
				publicKey: data?.accounts?.[0]?.publicKey || null,
				networkId: network
			});

			// Resolve connection promise
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
	});

	connector.on("wallet:signOut", () => {
		nearInstance = null;
		nearState.set(null);
		clearNonce();
	});

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: ($fetch) => ({
			nearState,
			cachedNonce,
		}),

		getActions: ($fetch): SIWNClientActions => {
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
					getNearClient: () => nearInstance,
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
						params: { recipient: string },
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { recipient } = params;

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

							// Get nonce first
							const nonceRequest: NonceRequestT = {
								accountId,
								publicKey: state.publicKey || "",
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

							// Create the sign-in message
							const message = `Sign in to ${recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							// Use near-kit's signMessage for NEP-413 signing
							const signedMessage = await nearInstance.signMessage({
								message,
								recipient,
								nonce: nonceBytes,
							});

							// Update state with publicKey from signed message if not already set
							if (!state.publicKey && signedMessage.publicKey) {
								nearState.set({
									...state,
									publicKey: signedMessage.publicKey,
								});
							}

							// Convert SignedMessage to authToken format expected by server
							// The server uses near-sign-verify which expects a serialized format
							const authToken = JSON.stringify({
								accountId: signedMessage.accountId,
								publicKey: signedMessage.publicKey,
								signature: signedMessage.signature,
								message,
								recipient,
								nonce: Array.from(nonceBytes),
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

							clearNonce();

							// Create a promise to wait for wallet connection
							connectionPromise = new Promise<void>((resolve, reject) => {
								connectionResolve = resolve;
								connectionReject = reject;
							});

							// Trigger Hot Connect modal
							await connector.connect();

							// Wait for wallet:signIn event
							await connectionPromise;

							// After connection, get account info and request nonce
							const state = nearState.get();
							if (!state || !state.accountId) {
								throw new Error("Failed to get account information after wallet connection");
							}

							const { accountId, networkId, publicKey } = state;
							
							//I am not sure if we really need this but I will leave it for now
							// If we don't have publicKey yet, we need to get it by signing a test message
							// or it should be available from the connector event data
							let finalPublicKey = publicKey;
							
							if (!finalPublicKey && nearInstance) {
								// Get publicKey by doing a test sign with a dummy nonce
								// This will trigger the wallet and give us the publicKey
								const testNonce = generateNonce();
								const testSignedMessage = await nearInstance.signMessage({
									message: "test",
									recipient: recipient,
									nonce: testNonce,
								});
								finalPublicKey = testSignedMessage.publicKey;
								
								// Update state with the publicKey
								nearState.set({
									...state,
									publicKey: finalPublicKey,
								});
							}
							
							if (!finalPublicKey) {
								throw new Error("Failed to get public key from wallet");
							}
							
							const nonceRequest: NonceRequestT = {
								accountId,
								publicKey: finalPublicKey,
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
								publicKey: finalPublicKey, // Use finalPublicKey which is guaranteed to be a string
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
						params: { recipient: string },
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { recipient } = params;

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

							// Use near-kit's signMessage for NEP-413 signing
							const signedMessage = await nearInstance.signMessage({
								message,
								recipient,
								nonce: nonceBytes,
							});

							// Update state with publicKey from signed message if not already set
							if (!state.publicKey && signedMessage.publicKey) {
								nearState.set({
									...state,
									publicKey: signedMessage.publicKey,
								});
							}

							// Convert SignedMessage to authToken format expected by server
							// The server uses near-sign-verify which expects a serialized format
							const authToken = JSON.stringify({
								accountId: signedMessage.accountId,
								publicKey: signedMessage.publicKey,
								signature: signedMessage.signature,
								message,
								recipient,
								nonce: Array.from(nonceBytes),
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
