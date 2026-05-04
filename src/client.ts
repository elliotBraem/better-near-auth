import { Near, fromNearConnect, generateNonce } from "near-kit";
import type { Near as NearType, SignedMessage } from "near-kit";
import { NearConnector } from "@hot-labs/near-connect";
import type { EventMap } from "@hot-labs/near-connect";
import { hex } from "@scure/base";
import type { BetterAuthClientPlugin, BetterAuthClientOptions, BetterFetch, BetterFetchOption, BetterFetchResponse, ClientStore } from "better-auth/client";
import { atom } from "nanostores";
import type { siwn } from "./index.js";
import { type AccountId, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type VerifyRequestT, type VerifyResponseT, type NearActionInput, type RelayResponseT, type RelayStatusResponseT, type NearAccount, type ViewContractRequestT, type ViewContractResponseT } from "./types.js";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	recipient: string;
	networkId?: "mainnet" | "testnet";
}

interface SignWithWalletResult {
	signedMessage: SignedMessage;
	accountId: string;
	publicKey: string;
	nonceHex: string;
}

export interface SIWNClientActions {
	near: {
		nonce: (params: NonceRequestT) => Promise<BetterFetchResponse<NonceResponseT>>;
		verify: (params: VerifyRequestT) => Promise<BetterFetchResponse<VerifyResponseT>>;
		getProfile: (accountId?: AccountId) => Promise<BetterFetchResponse<ProfileResponseT>>;
		view: (params: ViewContractRequestT) => Promise<BetterFetchResponse<ViewContractResponseT>>;
		getAccountId: () => string | null;
		getState: () => { accountId: string | null; publicKey: string | null; networkId: string } | null;
		disconnect: () => Promise<void>;
		link: (callbacks?: AuthCallbacks) => Promise<void>;
		unlink: (params: { accountId: string; network?: "mainnet" | "testnet" }) => Promise<BetterFetchResponse<{ success: boolean; message: string }>>;
		listAccounts: () => Promise<BetterFetchResponse<{ accounts: NearAccount[] }>>;
		buildSignedDelegateAction: (params: { receiverId: string; actions: NearActionInput[] }) => Promise<string>;
		relayTransaction: (params: { payload: string }) => Promise<BetterFetchResponse<RelayResponseT>>;
		getRelayStatus: (txHash: string) => Promise<BetterFetchResponse<RelayStatusResponseT>>;
		client: NearType;
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
	};
	getActions: ($fetch: BetterFetch, $store: ClientStore, options: BetterAuthClientOptions | undefined) => SIWNClientActions;
}

export const siwnClient = (config: SIWNClientConfig): SIWNClientPlugin => {
	const nearState = atom<{ accountId: string | null; publicKey: string | null; networkId: string } | null>(null);

	const network = config.networkId || "mainnet";

	const connector = new NearConnector({ network });

	const near = new Near({
		network,
		wallet: fromNearConnect(connector),
	});

	const handleAccountConnection = async (accountId: string, publicKey?: string | null) => {
		if (!accountId) return;
		nearState.set({
			accountId,
			publicKey: publicKey || null,
			networkId: network,
		});
	};

	connector.on("wallet:signIn", async (data: EventMap["wallet:signIn"]) => {
		const accountId = data.accounts?.[0]?.accountId;
		const publicKey = data.accounts?.[0]?.publicKey;
		if (accountId) {
			await handleAccountConnection(accountId, publicKey);
		}
	});

	connector.on("wallet:signOut", () => {
		nearState.set(null);
	});

	const signWithWallet = async (): Promise<SignWithWalletResult> => {
		const nonceBytes = generateNonce();
		const nonceHex = hex.encode(nonceBytes);
		const message = `Sign in to ${config.recipient}`;

		const connectedWallet = await connector.getConnectedWallet();
		if (connectedWallet?.accounts?.length) {
			const signedMessage = await near.signMessage({
				message,
				recipient: config.recipient,
				nonce: nonceBytes,
			});

			if (!signedMessage?.accountId) {
				throw new Error("Wallet not connected");
			}

			return {
				signedMessage,
				accountId: signedMessage.accountId,
				publicKey: signedMessage.publicKey,
				nonceHex,
			};
		}

		const result: { value: { signedMessage: SignedMessage; accountId: string; publicKey: string } | null } = { value: null };
		const handler = (data: EventMap["wallet:signInAndSignMessage"]) => {
			const account = data.accounts?.[0];
			if (account?.signedMessage) {
				result.value = {
					signedMessage: account.signedMessage,
					accountId: account.accountId,
					publicKey: account.signedMessage.publicKey,
				};
			}
		};

		connector.on("wallet:signInAndSignMessage", handler);

		try {
			await connector.connect({
				signMessageParams: {
					message,
					recipient: config.recipient,
					nonce: nonceBytes,
				},
			});
		} finally {
			connector.off("wallet:signInAndSignMessage", handler);
		}

		if (!result.value) {
			throw new Error("Wallet not connected");
		}

		return {
			signedMessage: result.value.signedMessage,
			accountId: result.value.accountId,
			publicKey: result.value.publicKey,
			nonceHex,
		};
	};

	const buildSignedDelegateActionInternal = async (
		receiverId: string,
		actions: NearActionInput[],
	): Promise<string> => {
		const state = nearState.get();
		if (!state?.accountId) {
			throw new Error("No wallet connected — cannot sign delegate action");
		}

		let builder = near.transaction(state.accountId);

		for (const a of actions) {
			if (a.type === "FunctionCall") {
				builder = builder.functionCall(receiverId, a.methodName, a.args, {
					gas: a.gas,
					attachedDeposit: a.deposit,
				});
			} else {
				builder = builder.transfer(receiverId, a.deposit);
			}
		}

		const { payload } = await builder.delegate();
		return payload;
	};

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: (_$fetch) => ({
			nearState,
		}),

		getActions: ($fetch: BetterFetch, _$store: ClientStore, _options: BetterAuthClientOptions | undefined): SIWNClientActions => {
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
					view: async (params: ViewContractRequestT, fetchOptions?: BetterFetchOption): Promise<BetterFetchResponse<ViewContractResponseT>> => {
						return await $fetch("/near/view", {
							method: "POST",
							body: params,
							...fetchOptions
						});
					},
					getAccountId: () => {
						const state = nearState.get();
						return state?.accountId || null;
					},
					getState: () => nearState.get(),
					disconnect: async () => {
						await connector.disconnect();
						nearState.set(null);
					},
					link: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { signedMessage, accountId, nonceHex } = await signWithWallet();
							const message = `Sign in to ${config.recipient}`;

							await handleAccountConnection(accountId, signedMessage.publicKey);

							const linkResponse = await $fetch<{ success: boolean; accountId: string; network: string; message: string }>("/near/link-account", {
								method: "POST",
								body: {
									signedMessage,
									message,
									recipient: config.recipient,
									nonce: nonceHex,
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
						payload: string;
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
					client: near,
				},
				signIn: {
					near: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { signedMessage, accountId, nonceHex } = await signWithWallet();
							const message = `Sign in to ${config.recipient}`;

							await handleAccountConnection(accountId, signedMessage.publicKey);

							const verifyResponse: BetterFetchResponse<VerifyResponseT> = await $fetch("/near/verify", {
								method: "POST",
								body: {
									signedMessage,
									message,
									recipient: config.recipient,
									nonce: nonceHex,
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
							callbacks?.onError?.(err);
						}
					}
				}
			};
		}
	} satisfies BetterAuthClientPlugin;
};
