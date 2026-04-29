import * as nearWallet from "@fastnear/wallet";
import type { SignDelegateActionsResponse, SignedMessage } from "@fastnear/wallet";
type NearWallet = typeof nearWallet;
import type { BetterAuthClientPlugin, BetterFetch, BetterFetchOption, BetterFetchResponse } from "better-auth/client";
import { atom } from "nanostores";
import { sign, generateNonce } from "near-sign-verify";
import type { siwn } from "./index.js";
import { type AccountId, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type VerifyRequestT, type VerifyResponseT, type NearActionInput, type RelayResponseT, type RelayStatusResponseT, type NearAccount } from "./types.js";
import { base64ToBytes, bytesToBase64, type SignedDelegateStruct, serializeSignedDelegateAction } from "./utils.js";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	recipient: string;
	networkId?: "mainnet" | "testnet";
	fastnearApiKey?: string;
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
		getAccountId: () => string | null;
		getState: () => { accountId: string | null; publicKey: string | null; networkId: string } | null;
		disconnect: () => Promise<void>;
		link: (callbacks?: AuthCallbacks) => Promise<void>;
		unlink: (params: { accountId: string; network?: "mainnet" | "testnet" }) => Promise<BetterFetchResponse<{ success: boolean; message: string }>>;
		listAccounts: () => Promise<BetterFetchResponse<{ accounts: NearAccount[] }>>;
		buildSignedDelegateAction: (params: { receiverId: string; actions: NearActionInput[] }) => Promise<string>;
		relayTransaction: (params: { signedDelegateAction: string }) => Promise<BetterFetchResponse<RelayResponseT>>;
		getRelayStatus: (txHash: string) => Promise<BetterFetchResponse<RelayStatusResponseT>>;
		wallet: NearWallet;
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

	const clearNonce = () => {
		cachedNonce.set(null);
	};

	const handleAccountConnection = async (accountId: string, publicKey?: string | null) => {
		if (!accountId) return;
		nearState.set({
			accountId,
			publicKey: publicKey || null,
			networkId: network,
		});
	};

	nearWallet.onConnect(async (result) => {
		if (result?.accountId) {
			await handleAccountConnection(result.accountId, result.publicKey);
		}
	});

	nearWallet.onDisconnect(() => {
		nearState.set(null);
		clearNonce();
	});

	nearWallet.restore({ network, contractId: config.recipient }).then((result) => {
		if (result?.accountId) {
			handleAccountConnection(result.accountId, result.publicKey);
		}
	}).catch(() => {});

	const buildSignedDelegateActionInternal = async (
		receiverId: string,
		actions: NearActionInput[],
	): Promise<string> => {
		if (!nearWallet.isConnected()) {
			throw new Error("No wallet connected — cannot sign delegate action");
		}

		const walletActions = actions.map(a => {
			if (a.type === "FunctionCall") {
				return {
					type: "FunctionCall" as const,
					methodName: a.methodName,
					args: a.args,
					gas: a.gas,
					deposit: a.deposit,
				};
			}
			return {
				type: "Transfer" as const,
				deposit: a.deposit,
			};
		});

		const result: SignDelegateActionsResponse = await nearWallet.signDelegateActions({
			delegateActions: [{
				receiverId,
				actions: walletActions,
			}],
			network,
		});

		const signedResult = result.signedDelegateActions?.[0];
		if (!signedResult?.signedDelegate) {
			throw new Error("Wallet did not return a signed delegate action");
		}

		const signedDelegate = signedResult.signedDelegate;

		if (typeof signedDelegate.serialize === "function") {
			return bytesToBase64(signedDelegate.serialize());
		}

		if (signedDelegate.delegateAction && signedDelegate.signature) {
			const adapted: SignedDelegateStruct = {
				delegateAction: signedDelegate.delegateAction,
				signature: signedDelegate.signature,
			};
			return bytesToBase64(serializeSignedDelegateAction(adapted));
		}

		throw new Error("Unexpected signed delegate format from wallet");
	};

	const buildAuthToken = async (
		signedMessage: SignedMessage,
		message: string,
		nonceBytes: Uint8Array,
	): Promise<string> => {
		return await sign(message, {
			signer: {
				signMessage: async () => signedMessage,
			} as any,
			recipient: config.recipient,
			nonce: nonceBytes,
		});
	};

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: (_$fetch) => ({
			nearState,
			cachedNonce,
		}),

		getActions: ($fetch): SIWNClientActions => {
			const fetchNonce = async (accountId: string): Promise<string> => {
				const state = nearState.get();
				const nonceRequest: NonceRequestT = {
					accountId,
					networkId: (state?.networkId || network) as "mainnet" | "testnet",
				};
				const nonceResponse: BetterFetchResponse<NonceResponseT> = await $fetch("/near/nonce", {
					method: "POST",
					body: nonceRequest,
				});
				if (nonceResponse.error) {
					throw new Error(nonceResponse.error.message || "Failed to get nonce");
				}
				const nonce = nonceResponse?.data?.nonce;
				if (!nonce) {
					throw new Error("No nonce received from server");
				}
				return nonce;
			};

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
					getAccountId: () => {
						const state = nearState.get();
						return state?.accountId || null;
					},
					getState: () => nearState.get(),
					disconnect: async () => {
						await nearWallet.disconnect();
						nearState.set(null);
						clearNonce();
					},
					link: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const state = nearState.get();
							const accountId = state?.accountId;
							if (!accountId) {
								const error = new Error("Wallet not connected. Please connect your wallet first.") as Error & { code?: string };
								error.code = "WALLET_NOT_CONNECTED";
								throw error;
							}

							const nonce = await fetchNonce(accountId);
							const message = `Sign in to ${config.recipient}\n\nAccount ID: ${accountId}\nNonce: ${nonce}`;
							const nonceBytes = base64ToBytes(nonce);

							const signedMessage = await nearWallet.signMessage({
								message,
								recipient: config.recipient,
								nonce: nonceBytes,
							});

							const authToken = await buildAuthToken(signedMessage as SignedMessage, message, nonceBytes);

							const linkResponse = await $fetch<{ success: boolean; accountId: string; network: string; message: string }>("/near/link-account", {
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
					listAccounts: async (): Promise<BetterFetchResponse<{ accounts: NearAccount[] }>> => {
						return await $fetch("/near/list-accounts", { method: "GET" });
					},
					buildSignedDelegateAction: async (params: {
						receiverId: string;
						actions: NearActionInput[];
					}): Promise<string> => {
						return buildSignedDelegateActionInternal(params.receiverId, params.actions);
					},
					relayTransaction: async (params: {
						signedDelegateAction: string;
					}): Promise<BetterFetchResponse<RelayResponseT>> => {
						return await $fetch("/near/relay", {
							method: "POST",
							body: params,
						});
					},
					getRelayStatus: async (txHash: string): Promise<BetterFetchResponse<RelayStatusResponseT>> => {
						return await $fetch(`/near/relay-status/${txHash}`, {
							method: "GET",
						});
					},
					wallet: nearWallet,
				},
				requestSignIn: {
					near: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							clearNonce();

							const connectResult = await nearWallet.connect({ network, contractId: config.recipient });

							const accountId = connectResult?.accountId || nearWallet.accountId();
							if (!accountId) {
								throw new Error("Failed to get account information after wallet connection");
							}

							await handleAccountConnection(accountId, connectResult?.publicKey);

							const nonce = await fetchNonce(accountId);

							const state = nearState.get();
							const cachedData: CachedNonceData = {
								nonce,
								accountId,
								publicKey: state?.publicKey,
								networkId: network,
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
							const nonceBytes = generateNonce();
							const nonceBase64 = bytesToBase64(nonceBytes);
							const message = `Sign in to ${config.recipient}\n\nNonce: ${nonceBase64}`;

							const connectResult = await nearWallet.connect({
								network,
								contractId: config.recipient,
								signMessageParams: {
									message,
									recipient: config.recipient,
									nonce: nonceBytes,
								},
							});

							if (!connectResult?.accountId) {
								throw new Error("Wallet not connected");
							}

							if (!connectResult.signedMessage) {
								throw new Error("Wallet did not sign message during sign-in");
							}

							const accountId = connectResult.accountId;
							const publicKey = connectResult.signedMessage.publicKey || connectResult.publicKey;
							await handleAccountConnection(accountId, publicKey);

							const authToken = await buildAuthToken(
								connectResult.signedMessage,
								message,
								nonceBytes,
							);

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
