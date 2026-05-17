import { Near, fromNearConnect, generateNonce, TransactionBuilder } from "near-kit";
import type { Near as NearType, SignedMessage } from "near-kit";
import type { EventMap } from "@hot-labs/near-connect";
import { hex } from "@scure/base";
import type { BetterAuthClientPlugin, BetterAuthClientOptions, BetterFetch, BetterFetchOption, BetterFetchResponse, ClientStore } from "better-auth/client";
import { atom } from "nanostores";
import type { siwn } from "./index.js";
import { type AccountId, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type VerifyRequestT, type VerifyResponseT, type RelayResponseT, type RelayStatusResponseT, type NearAccount, type ListAccountsResponseT, type SetPrimaryAccountRequestT, type SetPrimaryAccountResponseT, type ViewContractRequestT, type ViewContractResponseT, type RelayerInfo, type RelayHistoryResponseT } from "./types.js";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	recipient: string;
	networkId?: "mainnet" | "testnet";
	cspNonce?: string;
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
		isWalletConnected: () => boolean;
		ensureConnected: () => Promise<boolean>;
		disconnect: () => Promise<void>;
		link: (callbacks?: AuthCallbacks) => Promise<void>;
		unlink: (params: { accountId: string; network?: "mainnet" | "testnet" }) => Promise<BetterFetchResponse<{ success: boolean; message: string }>>;
		listAccounts: () => Promise<BetterFetchResponse<ListAccountsResponseT>>;
		setPrimaryAccount: (params: SetPrimaryAccountRequestT) => Promise<BetterFetchResponse<SetPrimaryAccountResponseT>>;
		buildSignedDelegateAction: (receiverId: string, buildActions: (builder: TransactionBuilder, receiverId: string) => TransactionBuilder) => Promise<string>;
		relayTransaction: (params: { payload: string }) => Promise<BetterFetchResponse<RelayResponseT>>;
		getRelayStatus: (txHash: string) => Promise<BetterFetchResponse<RelayStatusResponseT>>;
		getRelayerInfo: () => Promise<BetterFetchResponse<RelayerInfo & { enabled: boolean }>>;
		relayHistory: () => Promise<BetterFetchResponse<RelayHistoryResponseT>>;
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
		walletConnected: ReturnType<typeof atom<boolean>>;
	};
	getActions: ($fetch: BetterFetch, $store: ClientStore, options: BetterAuthClientOptions | undefined) => SIWNClientActions;
}

export const siwnClient = (config: SIWNClientConfig): SIWNClientPlugin => {
	const nearState = atom<{ accountId: string | null; publicKey: string | null; networkId: string } | null>(null);
	const walletConnected = atom<boolean>(false);

	const network = config.networkId || "mainnet";

	let connector: InstanceType<typeof import("@hot-labs/near-connect").NearConnector> | null = null;
	let near: Near | null = null;
	let clientInitialized = false;
	let connectorModulePromise: Promise<typeof import("@hot-labs/near-connect")> | null = null;
	let initClientPromise: Promise<boolean> | null = null;

	const loadConnector = async () => {
		connectorModulePromise ??= import("@hot-labs/near-connect");
		const { NearConnector } = await connectorModulePromise;
		return NearConnector;
	};

	const handleAccountConnection = async (accountId: string, publicKey?: string | null) => {
		if (!accountId) return;
		nearState.set({
			accountId,
			publicKey: publicKey || null,
			networkId: network,
		});
		walletConnected.set(true);
	};

	const initClient = async ($fetch?: BetterFetch): Promise<boolean> => {
		if (clientInitialized) return true;
		if (initClientPromise) return initClientPromise;
		if (typeof (globalThis as any).window === "undefined") return false;

		initClientPromise = (async () => {
			const NearConnector = await loadConnector();
			connector = new NearConnector({ network, cspNonce: config.cspNonce });
			near = new Near({
				network,
				wallet: fromNearConnect(connector),
			});

			connector.on("wallet:signIn", async (data: EventMap["wallet:signIn"]) => {
				const accountId = data.accounts?.[0]?.accountId;
				const publicKey = data.accounts?.[0]?.publicKey;
				if (accountId) {
					await handleAccountConnection(accountId, publicKey);
				}
			});

			connector.on("wallet:signOut", () => {
				walletConnected.set(false);
				const state = nearState.get();
				if (state) {
					nearState.set({ accountId: state.accountId, publicKey: null, networkId: state.networkId });
				}
			});

			void connector.getConnectedWallet().then(({ accounts }) => {
				const account = accounts?.[0];
				if (account?.accountId && !nearState.get()) {
					nearState.set({
						accountId: account.accountId,
						publicKey: account.publicKey ?? null,
						networkId: network,
					});
				}
				if (account?.accountId) {
					walletConnected.set(true);
				}
			}).catch(() => {});

			if ($fetch) {
				void restoreFromSession($fetch);
			}

			clientInitialized = true;
			return true;
		})();

		try {
			return await initClientPromise;
		} finally {
			if (!clientInitialized) {
				initClientPromise = null;
			}
		}
	};

	let sessionRestored = false;

	const restoreFromSession = async ($fetch: BetterFetch) => {
		if (sessionRestored) return;
		const state = nearState.get();
		if (state?.accountId) {
			sessionRestored = true;
			return;
		}

		try {
			const res = await $fetch<ListAccountsResponseT>("/near/list-accounts", { method: "GET" });
			const accounts = res.data?.accounts;
			if (accounts?.length) {
				const primary = res.data?.activeAccount || accounts.find((a: NearAccount) => a.isPrimary) || accounts[0];
				if (primary) {
					nearState.set({
						accountId: primary.accountId,
						publicKey: primary.publicKey ?? null,
						networkId: primary.network as "mainnet" | "testnet",
					});
				}
			}
		} catch {}
		sessionRestored = true;
	};

	const requireConnector = async () => {
		if (!connector) throw new Error("Wallet not initialized — this operation requires a browser environment");
		return connector;
	};

	const requireNear = (): Near => {
		if (!near) throw new Error("Wallet not initialized — this operation requires a browser environment");
		return near;
	};

	const ensureWalletConnected = async (): Promise<boolean> => {
		const conn = await requireConnector();
		if (walletConnected.get()) {
			try {
				const { accounts } = await conn.getConnectedWallet();
				if (accounts?.length) return true;
			} catch {}
		}

		return new Promise<boolean>((resolve) => {
			const signInHandler = (data: EventMap["wallet:signIn"]) => {
				const accountId = data.accounts?.[0]?.accountId;
				const publicKey = data.accounts?.[0]?.publicKey;
				if (accountId) {
					handleAccountConnection(accountId, publicKey);
					resolve(true);
				}
			};

			conn.on("wallet:signIn", signInHandler);

			conn.connect().catch(() => {}).finally(() => {
				conn.off("wallet:signIn", signInHandler);
				if (!walletConnected.get()) {
					resolve(false);
				}
			});
		});
	};

	const signWithWallet = async (): Promise<SignWithWalletResult> => {
		const conn = await requireConnector();
		const nearClient = requireNear();

		const nonceBytes = generateNonce();
		const nonceHex = hex.encode(nonceBytes);
		const message = `Sign in to ${config.recipient}`;

		let connectedWallet: Awaited<ReturnType<typeof conn.getConnectedWallet>> | null = null;
		try {
			connectedWallet = await conn.getConnectedWallet();
		} catch {}

		if (connectedWallet?.accounts?.length) {
			const signedMessage = await nearClient.signMessage({
				message,
				recipient: config.recipient,
				nonce: nonceBytes,
			});

			if (!signedMessage?.accountId) {
				throw new Error("Wallet sign-in was cancelled or failed");
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

		conn.on("wallet:signInAndSignMessage", handler);

		try {
			await conn.connect({
				signMessageParams: {
					message,
					recipient: config.recipient,
					nonce: nonceBytes,
				},
			});
		} finally {
			conn.off("wallet:signInAndSignMessage", handler);
		}

		if (!result.value) {
			throw new Error("Wallet sign-in was cancelled or failed");
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
		buildActions: (builder: TransactionBuilder, receiverId: string) => TransactionBuilder,
	): Promise<string> => {
		const state = nearState.get();
		if (!state?.accountId) {
			throw new Error("No NEAR account found — please sign in with your NEAR wallet");
		}

		if (!walletConnected.get()) {
			const reconnected = await ensureWalletConnected();
			if (!reconnected) {
				throw new Error("Wallet connection required — please approve the connection to sign");
			}
		}

		const nearClient = requireNear();
		const builder = buildActions(nearClient.transaction(state.accountId), receiverId);

		const { payload } = await builder.delegate();
		return payload;
	};

	return {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: (_$fetch) => ({
			nearState,
			walletConnected,
		}),

		getActions: ($fetch: BetterFetch, _$store: ClientStore, _options: BetterAuthClientOptions | undefined): SIWNClientActions => {
			void initClient($fetch);

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
					isWalletConnected: () => walletConnected.get(),
					ensureConnected: async () => {
						if (!clientInitialized) {
							if (!(await initClient())) return false;
						}
						if (walletConnected.get()) {
							try {
								const { accounts } = await (await requireConnector()).getConnectedWallet();
								if (accounts?.length) return true;
		} catch (err) {
			console.error("[siwn] restoreFromSession failed:", err instanceof Error ? err.message : err);
		}
						}
						return ensureWalletConnected();
					},
					disconnect: async () => {
						if (connector) await connector.disconnect();
						walletConnected.set(false);
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
					listAccounts: async (): Promise<BetterFetchResponse<ListAccountsResponseT>> => {
						return await $fetch("/near/list-accounts", { method: "GET" });
					},
					setPrimaryAccount: async (
						params: SetPrimaryAccountRequestT
					): Promise<BetterFetchResponse<SetPrimaryAccountResponseT>> => {
						const response = await $fetch<SetPrimaryAccountResponseT>("/near/set-primary-account", {
							method: "POST",
							body: params,
						});
						const activeAccount = response.data?.activeAccount;
						if (activeAccount) {
							nearState.set({
								accountId: activeAccount.accountId,
								publicKey: activeAccount.publicKey ?? null,
								networkId: activeAccount.network,
							});
						}
						return response;
					},
					buildSignedDelegateAction: async (
						receiverId: string,
						buildActions: (builder: TransactionBuilder, receiverId: string) => TransactionBuilder,
					): Promise<string> => {
						return buildSignedDelegateActionInternal(receiverId, buildActions);
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
					getRelayerInfo: async (): Promise<BetterFetchResponse<RelayerInfo & { enabled: boolean }>> => {
						return await $fetch("/near/relayer-info", {
							method: "GET",
						});
					},
					relayHistory: async (): Promise<BetterFetchResponse<RelayHistoryResponseT>> => {
						return await $fetch("/near/relay-history", {
							method: "GET",
						});
					},
					get client(): NearType {
						if (!near) throw new Error("Wallet not initialized — this operation requires a browser environment");
						return near;
					},
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
