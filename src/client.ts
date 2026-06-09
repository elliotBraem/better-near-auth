import { Near, fromNearConnect, generateNonce, TransactionBuilder } from "near-kit";
import type { Near as NearType, SignedMessage } from "near-kit";
import type { EventMap } from "@hot-labs/near-connect";
import { hex } from "@scure/base";
import type { BetterAuthClientPlugin, BetterAuthClientOptions, BetterFetch, BetterFetchOption, BetterFetchResponse, ClientStore } from "better-auth/client";
import { atom } from "nanostores";
import type { siwn } from "./index.js";
import { type AccountId, type DualNetworkConfig, type NonceRequestT, type NonceResponseT, type ProfileResponseT, type VerifyRequestT, type VerifyResponseT, type RelayResponseT, type RelayStatusResponseT, type NearAccount, type ListAccountsResponseT, type SetPrimaryAccountRequestT, type SetPrimaryAccountResponseT, type ViewContractRequestT, type ViewContractResponseT, type RelayerInfo, type RelayHistoryResponseT, type GetRelayerInfoRequestT, type CreateSubAccountRequestT, type CreateSubAccountResponseT, type CheckSubAccountAvailabilityRequestT, type CheckSubAccountAvailabilityResponseT } from "./types.js";

export interface AuthCallbacks {
	onSuccess?: () => void;
	onError?: (error: Error & { status?: number; code?: string }) => void;
}

export interface SIWNClientConfig {
	recipient?: string;
	recipients?: DualNetworkConfig<string>;
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
		getRelayerInfo: (params?: GetRelayerInfoRequestT) => Promise<BetterFetchResponse<RelayerInfo & { enabled: boolean }>>;
		relayHistory: () => Promise<BetterFetchResponse<RelayHistoryResponseT>>;
		createSubAccount: (params: CreateSubAccountRequestT) => Promise<BetterFetchResponse<CreateSubAccountResponseT>>;
		checkSubAccountAvailability: (params: CheckSubAccountAvailabilityRequestT) => Promise<BetterFetchResponse<CheckSubAccountAvailabilityResponseT>>;
		setNetwork: (network: "mainnet" | "testnet") => void;
		getNetwork: () => "mainnet" | "testnet";
		getSupportedNetworks: () => ("mainnet" | "testnet")[];
		getRecipient: (network?: "mainnet" | "testnet") => string;
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
		activeNetwork: ReturnType<typeof atom<"mainnet" | "testnet">>;
	};
	getActions: ($fetch: BetterFetch, $store: ClientStore, options: BetterAuthClientOptions | undefined) => SIWNClientActions;
}

export const siwnClient = (config: SIWNClientConfig): SIWNClientPlugin => {
	const nearState = atom<{ accountId: string | null; publicKey: string | null; networkId: string } | null>(null);
	const walletConnected = atom<boolean>(false);
	const activeNetwork = atom<"mainnet" | "testnet">(config.networkId || "mainnet");

	const getRecipient = (network?: "mainnet" | "testnet"): string => {
		const net = network || activeNetwork.get();
		if (config.recipients) return config.recipients[net];
		return config.recipient ?? "";
	};

	const getSupportedNetworks = (): ("mainnet" | "testnet")[] => {
		if (config.recipients) return ["mainnet", "testnet"];
		if (config.recipient) return [config.recipient.endsWith(".testnet") ? "testnet" : "mainnet"];
		return ["mainnet"];
	};

	let connectors = new Map<"mainnet" | "testnet", InstanceType<typeof import("@hot-labs/near-connect").NearConnector>>();
	let nearClients = new Map<"mainnet" | "testnet", Near>();
	let initializedNetworks = new Set<"mainnet" | "testnet">();
	let connectorModulePromise: Promise<typeof import("@hot-labs/near-connect")> | null = null;
	let initPromises = new Map<"mainnet" | "testnet", Promise<boolean>>();

	const loadConnector = async () => {
		connectorModulePromise ??= import("@hot-labs/near-connect");
		const { NearConnector } = await connectorModulePromise;
		return NearConnector;
	};

	const handleAccountConnection = async (accountId: string, publicKey?: string | null, network?: "mainnet" | "testnet") => {
		if (!accountId) return;
		const net = network || activeNetwork.get();
		nearState.set({
			accountId,
			publicKey: publicKey || null,
			networkId: net,
		});
		walletConnected.set(true);
	};

	const initClientForNetwork = async (network: "mainnet" | "testnet", $fetch?: BetterFetch): Promise<boolean> => {
		if (initializedNetworks.has(network)) return true;
		if (initPromises.has(network)) return initPromises.get(network)!;
		if (typeof (globalThis as any).window === "undefined") return false;

		const initPromise = (async () => {
			const NearConnector = await loadConnector();
			const connector = new NearConnector({ network, cspNonce: config.cspNonce });
			connectors.set(network, connector);

			const near = new Near({
				network,
				wallet: fromNearConnect(connector),
			});
			nearClients.set(network, near);

			connector.on("wallet:signIn", async (data: EventMap["wallet:signIn"]) => {
				const accountId = data.accounts?.[0]?.accountId;
				const publicKey = data.accounts?.[0]?.publicKey;
				if (accountId) {
					await handleAccountConnection(accountId, publicKey, network);
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
				const net = activeNetwork.get();
				if (account?.accountId && !nearState.get()) {
					nearState.set({
						accountId: account.accountId,
						publicKey: account.publicKey ?? null,
						networkId: net,
					});
				}
				if (account?.accountId) {
					walletConnected.set(true);
				}
			}).catch(() => {});

			initializedNetworks.add(network);

			if ($fetch) {
				void restoreFromSession($fetch);
			}

			return true;
		})();

		initPromises.set(network, initPromise);

		try {
			return await initPromise;
		} finally {
			initPromises.delete(network);
		}
	};

	const initClient = async ($fetch?: BetterFetch): Promise<boolean> => {
		const network = activeNetwork.get();
		return initClientForNetwork(network, $fetch);
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
					activeNetwork.set(primary.network as "mainnet" | "testnet");
				}
			}
		} catch {}
		sessionRestored = true;
	};

	const requireConnector = async (network?: "mainnet" | "testnet") => {
		const net = network || activeNetwork.get();
		await initClientForNetwork(net);
		const connector = connectors.get(net);
		if (!connector) throw new Error(`Wallet not initialized for ${net} — this operation requires a browser environment`);
		return connector;
	};

	const requireNear = (network?: "mainnet" | "testnet"): Near => {
		const net = network || activeNetwork.get();
		const client = nearClients.get(net);
		if (!client) throw new Error(`Wallet not initialized for ${net} — this operation requires a browser environment`);
		return client;
	};

	const ensureWalletConnected = async (network?: "mainnet" | "testnet"): Promise<boolean> => {
		const net = network || activeNetwork.get();
		const conn = await requireConnector(net);
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
					handleAccountConnection(accountId, publicKey, net);
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
		const net = activeNetwork.get();
		const conn = await requireConnector(net);
		const nearClient = requireNear(net);
		const recipient = getRecipient(net);

		const nonceBytes = generateNonce();
		const nonceHex = hex.encode(nonceBytes);
		const message = `Sign in to ${recipient}`;

		let connectedWallet: Awaited<ReturnType<typeof conn.getConnectedWallet>> | null = null;
		try {
			connectedWallet = await conn.getConnectedWallet();
		} catch {}

		if (connectedWallet?.accounts?.length) {
			const accountId: string = connectedWallet.accounts[0]!.accountId;
			const isTestnetAccount = accountId.endsWith(".testnet");
			const isExpectedNetwork = (net === "testnet") === isTestnetAccount;
			if (!isExpectedNetwork) {
				connectedWallet = null;
			}
		}

		if (connectedWallet?.accounts?.length) {
			const signedMessage = await nearClient.signMessage({
				message,
				recipient,
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
					recipient,
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
		const net = activeNetwork.get();
		const state = nearState.get();
		if (!state?.accountId) {
			throw new Error("No NEAR account found — please sign in with your NEAR wallet");
		}

		if (!walletConnected.get()) {
			const reconnected = await ensureWalletConnected(net);
			if (!reconnected) {
				throw new Error("Wallet connection required — please approve the connection to sign");
			}
		}

		const nearClient = requireNear(net);
		const builder = buildActions(nearClient.transaction(state.accountId), receiverId);

		const { payload } = await builder.delegate();
		return payload;
	};

	const plugin: SIWNClientPlugin = {
		id: "siwn",
		$InferServerPlugin: {} as ReturnType<typeof siwn>,

		getAtoms: (_$fetch) => ({
			nearState,
			walletConnected,
			activeNetwork,
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
						const net = activeNetwork.get();
						if (!initializedNetworks.has(net)) {
							if (!(await initClientForNetwork(net))) return false;
						}
						if (walletConnected.get()) {
							try {
								const conn = connectors.get(net);
								if (conn) {
									const { accounts } = await conn.getConnectedWallet();
									if (accounts?.length) return true;
								}
							} catch (err) {
								console.error("[siwn] restoreFromSession failed:", err instanceof Error ? err.message : err);
							}
						}
						return ensureWalletConnected(net);
					},
					disconnect: async () => {
						for (const [_net, conn] of connectors) {
							if (conn) {
								try { await conn.disconnect(); } catch {}
							}
						}
						walletConnected.set(false);
						nearState.set(null);
					},
					link: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						const net = activeNetwork.get();
						const recipient = getRecipient(net);
						try {
							const { signedMessage, accountId, nonceHex } = await signWithWallet();
							const message = `Sign in to ${recipient}`;

							await handleAccountConnection(accountId, signedMessage.publicKey, net);

							const linkResponse = await $fetch<{ success: boolean; accountId: string; network: string; message: string }>("/near/link-account", {
								method: "POST",
								body: {
									signedMessage,
									message,
									recipient,
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
							activeNetwork.set(activeAccount.network as "mainnet" | "testnet");
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
					getRelayerInfo: async (params?: GetRelayerInfoRequestT): Promise<BetterFetchResponse<RelayerInfo & { enabled: boolean }>> => {
						return await $fetch("/near/relayer-info", {
							method: "POST",
							body: params ?? {},
						});
					},
					relayHistory: async (): Promise<BetterFetchResponse<RelayHistoryResponseT>> => {
						return await $fetch("/near/relay-history", {
							method: "GET",
						});
					},
					createSubAccount: async (params: CreateSubAccountRequestT): Promise<BetterFetchResponse<CreateSubAccountResponseT>> => {
						return await $fetch("/near/create-sub-account", {
							method: "POST",
							body: params,
						});
					},
					checkSubAccountAvailability: async (params: CheckSubAccountAvailabilityRequestT): Promise<BetterFetchResponse<CheckSubAccountAvailabilityResponseT>> => {
						return await $fetch("/near/check-sub-account-availability", {
							method: "POST",
							body: params,
						});
					},
					setNetwork: (network: "mainnet" | "testnet") => {
						const prev = activeNetwork.get();
						if (prev !== network) {
							const oldConn = connectors.get(prev);
							if (oldConn) {
								void oldConn.disconnect().catch(() => {});
							}
							walletConnected.set(false);
							nearState.set(null);
						}
						activeNetwork.set(network);
						void initClientForNetwork(network);
					},
					getNetwork: () => activeNetwork.get(),
					getSupportedNetworks: () => getSupportedNetworks(),
					getRecipient: (network?: "mainnet" | "testnet") => getRecipient(network),
					get client(): NearType {
						const net = activeNetwork.get();
						const client = nearClients.get(net);
						if (!client) throw new Error(`Wallet not initialized for ${net} — this operation requires a browser environment`);
						return client;
					},
				},
				signIn: {
					near: async (
						callbacks?: AuthCallbacks
					): Promise<void> => {
						try {
							const { signedMessage, accountId, nonceHex } = await signWithWallet();
							const net = activeNetwork.get();
							const recipient = getRecipient(net);
							const message = `Sign in to ${recipient}`;

							await handleAccountConnection(accountId, signedMessage.publicKey, net);

							const verifyResponse: BetterFetchResponse<VerifyResponseT> = await $fetch("/near/verify", {
								method: "POST",
								body: {
									signedMessage,
									message,
									recipient,
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
	};

	return plugin;
};
