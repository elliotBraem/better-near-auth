import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { Account, User, DBAdapter } from "better-auth/types";
// Explicit type imports for declaration emit
import type {} from "@better-auth/core/env";
import type {} from "@better-auth/core/oauth2";
import type {} from "better-call";

import { Near, generateNonce, generateKey, parseKey, verifyNep413Signature, decodeSignedDelegateAction, InMemoryKeyStore, RotatingKeyStore } from "near-kit";
import type { SignedDelegateAction, PrivateKey } from "near-kit";
import { hex, base58 } from "@scure/base";
import z from "zod";
import { defaultGetProfile, getImageUrl, getNetworkFromAccountId } from "./profile.js";
import { schema } from "./schema.js";
import {
	type AccountId,
	type DualNetworkConfig,
	type ListAccountsResponseT,
	type ListedNearAccount,
	type NearAccount,
	type Profile,
	type RelayerInfo,
	type RelayedTransactionRecord,
	type SubAccountConfig,
	LinkAccountRequest,
	NonceRequest,
	NonceResponse,
	ProfileRequest,
	ProfileResponse,
	VerifyRequest,
	VerifyResponse,
	RelayRequest,
	RelayResponse,
	RelayStatusResponse,
	SetPrimaryAccountRequest,
	ViewContractRequest,
	ViewContractResponse,
	GetRelayerInfoRequest,
	CreateSubAccountRequest,
	CreateSubAccountResponse,
	CheckSubAccountAvailabilityRequest,
	CheckSubAccountAvailabilityResponse,
	type SubAccountTxCtx,
	type SubAccountLifecycleCtx,
} from "./types.js";
export * from "./types.js";
import {
	bytesToHex,
	encryptPrivateKey,
	decryptPrivateKey,
} from "./utils.js";

async function hashNonce(nonce: Uint8Array): Promise<string> {
	const data = new TextEncoder().encode(hex.encode(nonce));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return hex.encode(new Uint8Array(hashBuffer));
}

function deriveEmail(accountId: string, recipient: string): string {
	if (accountId.endsWith(".near")) {
		const localPart = accountId.slice(0, -5);
		if (!localPart.includes(".")) {
			return `${localPart}@near.email`;
		}
	}
	const randomId = crypto.randomUUID().slice(0, 8);
	return `temp-${randomId}@${recipient}`;
}

function nearAccountKey(account: Pick<NearAccount, "accountId" | "network">): string {
	return `${account.accountId}:${account.network}`;
}

function getCreatedAtTime(account: NearAccount): number {
	return account.createdAt instanceof Date
		? account.createdAt.getTime()
		: new Date(account.createdAt).getTime();
}

function buildListAccountsResponse(nearAccounts: NearAccount[]): ListAccountsResponseT {
	const activeAccount = nearAccounts.find((account) => account.isPrimary) ?? nearAccounts[0] ?? null;
	const activeKey = activeAccount ? nearAccountKey(activeAccount) : null;
	const accounts: ListedNearAccount[] = nearAccounts
		.map((account) => {
			const isActive = activeKey === nearAccountKey(account);
			return {
				...account,
				providerId: "siwn" as const,
				isActive,
				isAvailable: !isActive,
			};
		})
		.sort((a, b) => {
			if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
			return getCreatedAtTime(a) - getCreatedAtTime(b);
		});
	const listedActiveAccount = accounts.find((account) => account.isActive) ?? null;

	return {
		accounts,
		activeAccount: listedActiveAccount ? { ...listedActiveAccount } : null,
		availableAccounts: accounts
			.filter((account) => account.isAvailable)
			.map((account) => ({ ...account })),
	};
}

export interface RelayerConfig {
	accountId?: string;
	privateKey?: string;
	privateKeys?: string[];
	whitelistedContracts?: string[];
	maxGasPerTransaction?: string;
	maxDepositPerTransaction?: string;
}

interface RelayerState {
	near: Near;
	accountId: string;
	network: "mainnet" | "testnet";
	mode: "ephemeral" | "explicit";
	publicKey: string;
	createdAt?: Date;
	lastUsedAt?: Date;
}

function createNear(
	network: "mainnet" | "testnet",
	headers: Record<string, string>,
	rpcUrl?: string,
	keyStore?: InMemoryKeyStore | RotatingKeyStore,
): Near {
	const config: ConstructorParameters<typeof Near>[0] = { headers };
	if (rpcUrl) {
		config.network = { rpcUrl, networkId: network };
	} else {
		config.network = network;
	}
	if (keyStore) {
		config.keyStore = keyStore;
	}
	return new Near(config);
}

async function initRelayer(
	relayerConfig: RelayerConfig | undefined,
	network: "mainnet" | "testnet",
	adapter: DBAdapter,
	secret: string | undefined,
	apiKey?: string,
	rpcUrl?: string,
): Promise<RelayerState | null> {
	if (!relayerConfig) return null;

	const headers: Record<string, string> = {};
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`;
	}

	if (relayerConfig.accountId && (relayerConfig.privateKey || relayerConfig.privateKeys)) {
		const keys = relayerConfig.privateKeys ?? (relayerConfig.privateKey ? [relayerConfig.privateKey] : []);
		let keyStore: InMemoryKeyStore | RotatingKeyStore;

		if (keys.length === 1) {
			keyStore = new InMemoryKeyStore({
				[relayerConfig.accountId]: keys[0]!,
			});
		} else {
			keyStore = new RotatingKeyStore({
				[relayerConfig.accountId]: keys as string[],
			});
		}

		const near = createNear(network, headers, rpcUrl, keyStore);
		const explicitPublicKey = parseKey(keys[0]!);
		return {
			near,
			accountId: relayerConfig.accountId,
			network,
			mode: "explicit",
			publicKey: explicitPublicKey.publicKey.toString(),
		};
	}

	const existing = await adapter.findOne<{ encryptedPrivateKey: string; iv: string; createdAt: Date; lastUsedAt: Date }>({
		model: "relayerKey",
		where: [{ field: "network", operator: "eq", value: network }],
	});

	if (existing) {
		if (!secret) throw new Error("BETTER_AUTH_SECRET required for relayer key decryption");
		const privateKeyBytes = await decryptPrivateKey(existing.encryptedPrivateKey, existing.iv, secret);
		const keyPair = parseKey(`ed25519:${base58.encode(privateKeyBytes)}`);
		const accountId = bytesToHex(keyPair.publicKey.data);

		console.log(`[siwn] Relayer recovered: ${accountId} (${network})`);

		const keyStore = new InMemoryKeyStore();
		await keyStore.add(accountId, keyPair);

		const near = createNear(network, headers, rpcUrl, keyStore);
		return {
			near,
			accountId,
			network,
			mode: "ephemeral",
			publicKey: keyPair.publicKey.toString(),
			createdAt: existing.createdAt,
			lastUsedAt: existing.lastUsedAt,
		};
	}

	const keyPair = generateKey();
	if (!secret) throw new Error("BETTER_AUTH_SECRET required for relayer key encryption");
	const privateKeyBytes = keyPair.secretKey.startsWith("ed25519:")
		? base58.decode(keyPair.secretKey.slice(8))
		: new Uint8Array(0);

	const publicKeyBase58 = keyPair.publicKey.toString().replace("ed25519:", "");
	const accountId = bytesToHex(keyPair.publicKey.data);
	const createdAt = new Date();

	const { encrypted, iv } = await encryptPrivateKey(privateKeyBytes, secret);

	await adapter.create({
			model: "relayerKey",
			data: {
				accountId,
				encryptedPrivateKey: encrypted,
				iv,
				publicKey: `ed25519:${publicKeyBase58}`,
				network,
				createdAt,
				lastUsedAt: createdAt,
			},
		});

	console.log(`[siwn] Relayer created in EPHEMERAL mode: ${accountId} (${network})`);
	console.log(`[siwn] Fund this account with NEAR to enable gasless relay`);
	console.log(`[siwn] Private key is encrypted in DB — persists across restarts`);

	const keyStore = new InMemoryKeyStore();
	await keyStore.add(accountId, keyPair);

	const near = createNear(network, headers, rpcUrl, keyStore);
	return {
		near,
		accountId,
		network,
		mode: "ephemeral",
		publicKey: keyPair.publicKey.toString(),
		createdAt,
		lastUsedAt: createdAt,
	};
}

async function relayOnChain(
	payload: string,
	relayerState: RelayerState,
): Promise<{ txHash: string }> {
	const userAction = decodeSignedDelegateAction(payload);

	const result = await relayerState.near
		.transaction(relayerState.accountId)
		.signedDelegateAction(userAction)
		.send({ waitUntil: "EXECUTED" });

	return { txHash: result.transaction.hash };
}

async function defaultValidateLimitedAccessKey(
	accountId: string,
	publicKey: string,
	recipient: string,
	near: Near,
): Promise<boolean> {
	const key = await near.getAccessKey(accountId, publicKey);
	if (!key) return false;
	if (key.permission === "FullAccess") return true;
	if ("FunctionCall" in key.permission) {
		return key.permission.FunctionCall.receiver_id === recipient;
	}
	return false;
}

function isImplicitAccount(accountId: string): boolean {
	return /^[0-9a-f]{64}$/.test(accountId);
}

function resolveParentAccount(
	subAccountCfg: SubAccountConfig | undefined,
	parentKey: string | undefined,
	rState: RelayerState | null,
): { parentAccount: string | null; subAccountAvailable: boolean } {
	const parent = subAccountCfg?.parentAccount ?? rState?.accountId;
	if (!parent || isImplicitAccount(parent)) {
		return { parentAccount: null, subAccountAvailable: false };
	}
	if (!rState && !parentKey) {
		return { parentAccount: null, subAccountAvailable: false };
	}
	return { parentAccount: parent, subAccountAvailable: true };
}

export interface SIWNPluginOptions {
	recipient?: string;
	recipients?: DualNetworkConfig<string>;
	requireFullAccessKey?: boolean;
	getNonce?: () => Promise<Uint8Array>;
	getProfile?: (accountId: AccountId) => Promise<Profile | null>;
	validateLimitedAccessKey?: (args: {
		accountId: AccountId;
		publicKey: string;
		recipient?: string;
	}) => Promise<boolean>;
	apiKey?: string;
	rpcUrl?: string | DualNetworkConfig<string>;
	relayer?: RelayerConfig | DualNetworkConfig<RelayerConfig>;
	secrets?: {
		parentKey?: string | DualNetworkConfig<string>;
	};
	subAccount?: SubAccountConfig | DualNetworkConfig<SubAccountConfig>;
}

export const siwn = (options: SIWNPluginOptions) => {
	if (!options.recipient && !options.recipients) {
		throw new Error("Either 'recipient' or 'recipients' must be provided to siwn plugin");
	}

	const apiKey = options.apiKey;

	const getRecipient = (network: "mainnet" | "testnet"): string => {
		if (options.recipients) return options.recipients[network];
		return options.recipient!;
	};

	const getSupportedNetworks = (): ("mainnet" | "testnet")[] => {
		if (options.recipients) return ["mainnet", "testnet"];
		if (options.recipient) return [getNetworkFromAccountId(options.recipient)];
		return ["mainnet"];
	};

	const getRelayerConfig = (network: "mainnet" | "testnet"): RelayerConfig | undefined => {
		if (!options.relayer) return undefined;
		if ("mainnet" in options.relayer && typeof options.relayer.mainnet === "object") {
			return (options.relayer as DualNetworkConfig<RelayerConfig>)[network];
		}
		return options.relayer as RelayerConfig;
	};

	const getRpcUrl = (network: "mainnet" | "testnet"): string | undefined => {
		if (!options.rpcUrl) return undefined;
		if (typeof options.rpcUrl === "object") return (options.rpcUrl as DualNetworkConfig<string>)[network];
		return options.rpcUrl as string;
	};

	const getSubAccountConfig = (network: "mainnet" | "testnet"): SubAccountConfig | undefined => {
		if (!options.subAccount) return undefined;
		if ("mainnet" in options.subAccount && typeof options.subAccount.mainnet === "object") {
			return (options.subAccount as DualNetworkConfig<SubAccountConfig>)[network];
		}
		return options.subAccount as SubAccountConfig;
	};

	const getParentKey = (network: "mainnet" | "testnet"): string | undefined => {
		if (!options.secrets?.parentKey) return undefined;
		if (typeof options.secrets.parentKey === "object") {
			return (options.secrets.parentKey as DualNetworkConfig<string>)[network];
		}
		return options.secrets.parentKey as string;
	};

	const getRawParentKey = (network: "mainnet" | "testnet"): string | undefined => {
		const fromSecrets = getParentKey(network);
		if (fromSecrets) return fromSecrets;
		const relayerCfg = getRelayerConfig(network);
		const subAccountCfg = getSubAccountConfig(network);
		const parent = subAccountCfg?.parentAccount ?? relayerCfg?.accountId;
		if (parent && parent === relayerCfg?.accountId) {
			return relayerCfg.privateKey ?? relayerCfg.privateKeys?.[0];
		}
		return undefined;
	};

	const primaryNetwork = getSupportedNetworks()[0];
	const relayerStates = new Map<"mainnet" | "testnet", RelayerState | null>();
	const relayerInitPromises = new Map<"mainnet" | "testnet", Promise<RelayerState | null>>();

	const headers: Record<string, string> = {};
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`;
	}

	const ensureRelayer = async (adapter: DBAdapter, secret: string | undefined, network: "mainnet" | "testnet") => {
		if (relayerStates.has(network)) return relayerStates.get(network) ?? null;

		const existingInit = relayerInitPromises.get(network);
		if (existingInit) return existingInit;

		const relayerCfg = getRelayerConfig(network);
		const networkRpcUrl = getRpcUrl(network);

		const initPromise = initRelayer(relayerCfg, network, adapter, secret, apiKey, networkRpcUrl)
			.then((state) => {
				relayerStates.set(network, state);
				relayerInitPromises.delete(network);
				return state;
			})
			.catch((error) => {
				relayerInitPromises.delete(network);
				throw error;
			});

		relayerInitPromises.set(network, initPromise);
		return initPromise;
	};

	const getNear = (network: "mainnet" | "testnet") => {
		const networkRpcUrl = getRpcUrl(network);
		if (networkRpcUrl) {
			return new Near({ network: { rpcUrl: networkRpcUrl, networkId: network }, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined });
		}
		return new Near({ network, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined });
	};

	return ({
		id: "siwn",
		schema,
		hooks: {
			after: [
				{
					matcher: (context: { path?: string; method?: string }) => context.path === "/auth/session" && context.method === "GET",
					handler: createAuthMiddleware(async (ctx) => {
						const session = ctx.context.session;
						if (session) {
							const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
								model: "nearAccount",
								where: [
									{ field: "userId", operator: "eq", value: session.user.id },
									{ field: "isPrimary", operator: "eq", value: true },
								],
							});

							if (nearAccount) {
								ctx.context.session = {
									...session,
									user: {
										...session.user,
										nearAccount: nearAccount
									}
								};
							}
						}

						return { context: ctx };
					}),
				},
			],
		},
		endpoints: {
			linkNearAccount: createAuthEndpoint(
				"/near/link-account",
				{
					method: "POST",
					body: LinkAccountRequest,
					use: [sessionMiddleware],
					requireRequest: true,
				},
				async (ctx) => {
					const { signedMessage, message, recipient, nonce, accountId, callbackUrl } = ctx.body;
					const network = getNetworkFromAccountId(accountId);
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be logged in to link NEAR account",
							status: 401,
						});
					}

					try {
						const near = getNear(network);
						const nonceBytes = hex.decode(nonce);

						const isValid = await verifyNep413Signature(
						signedMessage,
						{ message, recipient, nonce: nonceBytes, callbackUrl },
							{ near, maxAge: 15 * 60 * 1000 },
						);

						if (!isValid) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Invalid signature",
								status: 401,
							});
						}

						if (signedMessage.accountId !== accountId) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Account ID mismatch",
								status: 401,
							});
						}

						const publicKey = signedMessage.publicKey;

						if (!options.requireFullAccessKey && options.validateLimitedAccessKey) {
							const isValidKey = await options.validateLimitedAccessKey({
								accountId: accountId,
								publicKey: publicKey,
								recipient: options.recipient
							});

							if (!isValidKey) {
								throw new APIError("UNAUTHORIZED", {
									message: "Unauthorized: Invalid function call access key",
									status: 401,
								});
							}
						}

						const existingNearAccount: NearAccount | null = await ctx.context.adapter.findOne({
							model: "nearAccount",
							where: [
								{ field: "accountId", operator: "eq", value: accountId },
								{ field: "network", operator: "eq", value: network },
							],
						});

						if (existingNearAccount) {
							throw new APIError("BAD_REQUEST", {
								message: "This NEAR account is already linked to another user",
								status: 400,
							});
						}

						const existingPrimaryAccount: NearAccount | null = await ctx.context.adapter.findOne({
							model: "nearAccount",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
								{ field: "isPrimary", operator: "eq", value: true },
							],
						});

						await ctx.context.adapter.create({
							model: "nearAccount",
							data: {
								userId: session.user.id,
								accountId,
								network,
								publicKey: publicKey,
								isPrimary: !existingPrimaryAccount,
								createdAt: new Date(),
							},
						});

						await ctx.context.internalAdapter.createAccount({
							userId: session.user.id,
							providerId: "siwn",
							accountId: `${accountId}:${network}`,
							createdAt: new Date(),
							updatedAt: new Date(),
						});

						return ctx.json({
							success: true,
							accountId,
							network,
							message: "NEAR account successfully linked"
						});
					} catch (error: unknown) {
						if (error instanceof APIError) throw error;
						throw new APIError("UNAUTHORIZED", {
							message: "Something went wrong. Please try again later.",
							error: error instanceof Error ? error.message : "Unknown error",
							status: 401,
						});
					}
				},
			),
			unlinkNearAccount: createAuthEndpoint(
				"/near/unlink-account",
				{
					method: "POST",
					body: z.object({
						accountId: z.string(),
						network: z.enum(["mainnet", "testnet"]).optional(),
					}),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { accountId, network: providedNetwork } = ctx.body;
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be logged in to unlink NEAR account",
							status: 401,
						});
					}

					const network = providedNetwork || getNetworkFromAccountId(accountId);

					const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "accountId", operator: "eq", value: accountId },
							{ field: "network", operator: "eq", value: network },
						],
					});

					if (!nearAccount) {
						throw new APIError("NOT_FOUND", {
							message: "NEAR account not found or not linked to your user",
							status: 404,
						});
					}

					const accounts = await ctx.context.adapter.findMany({
						model: "account",
						where: [{ field: "userId", operator: "eq", value: session.user.id }],
					});

					if (accounts.length <= 1) {
						throw new APIError("BAD_REQUEST", {
							message: "Cannot unlink last authentication method. Link another account first.",
							status: 400,
						});
					}

					if (nearAccount.isPrimary) {
						const otherNearAccounts: NearAccount[] = await ctx.context.adapter.findMany({
							model: "nearAccount",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
								{ field: "accountId", operator: "ne", value: accountId },
							],
						});

						if (otherNearAccounts.length > 0) {
							await ctx.context.adapter.update({
								model: "nearAccount",
								where: [
									{ field: "id", operator: "eq", value: otherNearAccounts[0]!.id },
								],
								update: { isPrimary: true },
							});
						}
					}

					await ctx.context.adapter.delete({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "accountId", operator: "eq", value: accountId },
							{ field: "network", operator: "eq", value: network },
						],
					});

					const accountToDelete: Account | null = await ctx.context.adapter.findOne({
						model: "account",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "providerId", operator: "eq", value: "siwn" },
							{ field: "accountId", operator: "eq", value: `${accountId}:${network}` },
						],
					});

					if (accountToDelete) {
						await ctx.context.internalAdapter.deleteAccount(accountToDelete.id);
					}

					return ctx.json({
						success: true,
						accountId,
						network,
						message: "NEAR account successfully unlinked"
					});
				},
			),
			listNearAccounts: createAuthEndpoint(
				"/near/list-accounts",
				{
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const session = ctx.context.session;

					const nearAccounts: NearAccount[] = await ctx.context.adapter.findMany({
						model: "nearAccount",
						where: [{ field: "userId", operator: "eq", value: session.user.id }],
					});

					return ctx.json(buildListAccountsResponse(nearAccounts));
				},
			),
			setPrimaryNearAccount: createAuthEndpoint(
				"/near/set-primary-account",
				{
					method: "POST",
					body: SetPrimaryAccountRequest,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { accountId, network: providedNetwork } = ctx.body;
					const session = ctx.context.session;
					const network = providedNetwork || getNetworkFromAccountId(accountId);

					const targetAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "accountId", operator: "eq", value: accountId },
							{ field: "network", operator: "eq", value: network },
						],
					});

					if (!targetAccount) {
						throw new APIError("NOT_FOUND", {
							message: "NEAR account not found or not linked to your user",
							status: 404,
						});
					}

					const nearAccounts: NearAccount[] = await ctx.context.adapter.findMany({
						model: "nearAccount",
						where: [{ field: "userId", operator: "eq", value: session.user.id }],
					});

					await Promise.all(nearAccounts.map((account) => ctx.context.adapter.update({
						model: "nearAccount",
						where: [{ field: "id", operator: "eq", value: account.id }],
						update: { isPrimary: nearAccountKey(account) === nearAccountKey(targetAccount) },
					})));

					const updatedNearAccounts: NearAccount[] = await ctx.context.adapter.findMany({
						model: "nearAccount",
						where: [{ field: "userId", operator: "eq", value: session.user.id }],
					});

					return ctx.json({
						success: true,
						accountId,
						network,
						message: "Primary NEAR account updated",
						...buildListAccountsResponse(updatedNearAccounts),
					});
				},
			),
			getSiwnNonce: createAuthEndpoint(
				"/near/nonce",
				{
					method: "POST",
					body: NonceRequest,
				},
				async (ctx) => {
					const { accountId, networkId } = ctx.body;
					const network = getNetworkFromAccountId(accountId);

					if (networkId !== network) {
						throw new APIError("BAD_REQUEST", {
							message: "Network ID mismatch with account ID",
							status: 400,
						});
					}

					const near = getNear(network);
					const exists = await near.accountExists(accountId);
					if (!exists) {
						throw new APIError("BAD_REQUEST", {
							message: "Account does not exist on-chain",
							status: 400,
						});
					}

					const nonce = options.getNonce ? await options.getNonce() : generateNonce();

					const nonceString = hex.encode(nonce);

					await ctx.context.internalAdapter.createVerificationValue({
						identifier: `siwn:${accountId}:${network}`,
						value: nonceString,
						expiresAt: new Date(Date.now() + 15 * 60 * 1000),
					});

					return ctx.json(NonceResponse.parse({ nonce: nonceString }));
				},
			),
			getSiwnProfile: createAuthEndpoint(
				"/near/profile",
				{
					method: "POST",
					body: ProfileRequest,
				},
				async (ctx) => {
					const { accountId } = ctx.body;
					let targetAccountId = accountId;

					if (!targetAccountId) {
						const result = await getSessionFromCtx(ctx);
						const session = result?.session;
						if (!session) {
							throw new APIError("UNAUTHORIZED", {
								message: "Session required when no accountId provided",
								status: 401,
							});
						}

						const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
							model: "nearAccount",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
								{ field: "isPrimary", operator: "eq", value: true },
							],
						});

						if (!nearAccount) {
							throw new APIError("NOT_FOUND", {
								message: "No NEAR account found for user",
								status: 404,
							});
						}

						targetAccountId = nearAccount.accountId;
					}

					const profile = await (options.getProfile || ((id: AccountId) => defaultGetProfile(id, apiKey)))(targetAccountId);
					return ctx.json(ProfileResponse.parse(profile));
				},
			),
			verifySiwnMessage: createAuthEndpoint(
				"/near/verify",
				{
					method: "POST",
					body: VerifyRequest,
					requireRequest: true,
				},
				async (ctx) => {
					const {
						signedMessage,
						message,
						recipient,
						nonce,
						accountId,
						callbackUrl,
					} = ctx.body;
					const network = getNetworkFromAccountId(accountId);

					try {
						const near = getNear(network);
						const nonceBytes = hex.decode(nonce);

						const isValid = await verifyNep413Signature(
						signedMessage,
						{ message, recipient, nonce: nonceBytes, callbackUrl },
							{ near, maxAge: 15 * 60 * 1000 },
						);

						if (!isValid) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Invalid signature",
								status: 401,
							});
						}

						if (signedMessage.accountId !== accountId) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Account ID mismatch",
								status: 401,
							});
						}

						const publicKey = signedMessage.publicKey;

						const nonceHash = await hashNonce(nonceBytes);

						const existingNonce = await ctx.context.internalAdapter.findVerificationValue(
							`siwn-nonce:${nonceHash}`
						);

						if (existingNonce) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Nonce already used (replay attack detected)",
								status: 401,
								code: "UNAUTHORIZED_NONCE_REPLAY",
							});
						}

						await ctx.context.internalAdapter.createVerificationValue({
							identifier: `siwn-nonce:${nonceHash}`,
							value: "used",
							expiresAt: new Date(Date.now() + 15 * 60 * 1000),
						});

						if (!options.requireFullAccessKey) {
							const validateKey = options.validateLimitedAccessKey
								|| ((args: { accountId: string; publicKey: string; recipient?: string }) =>
									defaultValidateLimitedAccessKey(args.accountId, args.publicKey, args.recipient || getRecipient(network), near));

							const isValidKey = await validateKey({
								accountId: accountId,
								publicKey: publicKey,
								recipient: options.recipient
							});

							if (!isValidKey) {
								throw new APIError("UNAUTHORIZED", {
									message: "Unauthorized: Invalid function call access key",
									status: 401,
								});
							}
						}

						let user: User | null = null;

						const existingNearAccount: NearAccount | null =
							await ctx.context.adapter.findOne({
								model: "nearAccount",
								where: [
									{ field: "accountId", operator: "eq", value: accountId },
									{ field: "network", operator: "eq", value: network },
								],
							});

						if (existingNearAccount) {
							user = await ctx.context.adapter.findOne({
								model: "user",
								where: [
									{
										field: "id",
										operator: "eq",
										value: existingNearAccount.userId,
									},
								],
							});
						} else {
							const anyNearAccount: NearAccount | null =
								await ctx.context.adapter.findOne({
									model: "nearAccount",
									where: [
										{ field: "accountId", operator: "eq", value: accountId },
									],
								});

							if (anyNearAccount) {
								user = await ctx.context.adapter.findOne({
									model: "user",
									where: [
										{
											field: "id",
											operator: "eq",
											value: anyNearAccount.userId,
										},
									],
								});
							}
						}

						if (!user) {
							const userEmail = deriveEmail(accountId, getRecipient(network));

							const profile = await (options.getProfile || ((id: AccountId) => defaultGetProfile(id, apiKey)))(accountId);

							user = await ctx.context.internalAdapter.createUser({
								name: profile?.name ?? accountId,
								email: userEmail,
								image: profile?.image ? getImageUrl(profile.image) : "",
							});

							await ctx.context.adapter.create({
								model: "nearAccount",
								data: {
									userId: user.id,
									accountId,
									network,
									publicKey: publicKey,
									isPrimary: true,
									createdAt: new Date(),
								},
							});

							await ctx.context.internalAdapter.createAccount({
								userId: user.id,
								providerId: "siwn",
								accountId: `${accountId}:${network}`,
								createdAt: new Date(),
								updatedAt: new Date(),
							});
						} else {
							if (!existingNearAccount) {
								await ctx.context.adapter.create({
									model: "nearAccount",
									data: {
										userId: user.id,
										accountId,
										network,
										publicKey: publicKey,
										isPrimary: false,
										createdAt: new Date(),
									},
								});

								await ctx.context.internalAdapter.createAccount({
									userId: user.id,
									providerId: "siwn",
									accountId: `${accountId}:${network}`,
									createdAt: new Date(),
									updatedAt: new Date(),
								});
							}
						}

						await ensureRelayer(ctx.context.adapter, ctx.context.secret, network);

						const session = await ctx.context.internalAdapter.createSession(
							user.id
						);

						if (!session) {
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message: "Internal Server Error",
								status: 500,
							});
						}

						await setSessionCookie(ctx, { session, user });

						return ctx.json(VerifyResponse.parse({
							token: session.token,
							success: true,
							user: {
								id: user.id,
								accountId,
								network,
							},
						}));
					} catch (error: unknown) {
						if (error instanceof APIError) throw error;
						const msg = error instanceof Error ? error.message : "Unknown error";
						const at = error instanceof Error && error.stack ? error.stack.split("\n").slice(1, 3).map(s => s.trim()).join(" <- ") : "";
						console.error(`[siwn] Verify error: ${msg}${at ? ` (${at})` : ""}`);
						throw new APIError("UNAUTHORIZED", {
							message: "Something went wrong. Please try again later.",
							error: msg,
							status: 401,
						});
					}
				},
			),
			relayNearTransaction: createAuthEndpoint(
				"/near/relay",
				{
					method: "POST",
					body: RelayRequest,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { payload } = ctx.body;
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be authenticated to relay transactions",
							status: 401,
						});
					}

					const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "isPrimary", operator: "eq", value: true },
						],
					});

					if (!nearAccount) {
						throw new APIError("UNAUTHORIZED", {
							message: "No NEAR account linked to session",
							status: 401,
						});
					}

					const network = nearAccount.network as "mainnet" | "testnet";
					const rState = await ensureRelayer(ctx.context.adapter, ctx.context.secret, network);

					if (!rState) {
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: "Relayer not configured",
							status: 503,
						});
					}

					try {
						const decoded: SignedDelegateAction = decodeSignedDelegateAction(payload);
						const delegateAction = decoded.signedDelegate.delegateAction;

						if (delegateAction.senderId !== nearAccount.accountId) {
							throw new APIError("UNAUTHORIZED", {
								message: "Delegate action sender does not match session account",
								status: 401,
							});
						}

						const relayerConfigForNetwork = getRelayerConfig(network);
						if (relayerConfigForNetwork?.whitelistedContracts?.length) {
							if (!relayerConfigForNetwork.whitelistedContracts.includes(delegateAction.receiverId)) {
								throw new APIError("FORBIDDEN", {
									message: `Contract ${delegateAction.receiverId} is not whitelisted for relay`,
									status: 403,
								});
							}
						}

						if (relayerConfigForNetwork?.maxGasPerTransaction) {
							const totalGas = delegateAction.actions.reduce((sum: bigint, a) => {
								return sum + ("functionCall" in a ? a.functionCall.gas : 0n);
							}, 0n);
							if (totalGas > BigInt(relayerConfigForNetwork.maxGasPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction gas (${totalGas}) exceeds relayer limit (${relayerConfigForNetwork.maxGasPerTransaction})`,
									status: 400,
								});
							}
						}

						if (relayerConfigForNetwork?.maxDepositPerTransaction) {
							const totalDeposit = delegateAction.actions.reduce((sum: bigint, a) => {
								if ("functionCall" in a) return sum + a.functionCall.deposit;
								if ("transfer" in a) return sum + a.transfer.deposit;
								return sum;
							}, 0n);
							if (totalDeposit > BigInt(relayerConfigForNetwork.maxDepositPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction deposit (${totalDeposit}) exceeds relayer limit (${relayerConfigForNetwork.maxDepositPerTransaction})`,
									status: 400,
								});
							}
						}

						const result = await relayOnChain(payload, rState);

						await ctx.context.adapter.create({
							model: "relayedTransaction",
							data: {
								userId: session.user.id,
								txHash: result.txHash,
								senderId: delegateAction.senderId,
								receiverId: delegateAction.receiverId,
								network,
								status: "pending",
								createdAt: new Date(),
							},
						});

					if (rState.mode === "ephemeral") {
						await ctx.context.adapter.update({
							model: "relayerKey",
							where: [{ field: "network", operator: "eq", value: network }],
							update: { lastUsedAt: new Date() },
						});
					}

						return ctx.json(RelayResponse.parse({
							txHash: result.txHash,
							status: "pending",
						}));
					} catch (error: unknown) {
						if (error instanceof APIError) throw error;
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: error instanceof Error ? error.message : "Relay failed",
							status: 500,
						});
					}
				},
			),
			getRelayStatus: createAuthEndpoint(
				"/near/relay-status/:txHash",
				{
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const txHash = (ctx.params as Record<string, string>)?.txHash;
					if (!txHash) {
						throw new APIError("BAD_REQUEST", {
							message: "Transaction hash required",
							status: 400,
						});
					}

					const session = ctx.context.session;

					const relayedTx = await ctx.context.adapter.findOne<RelayedTransactionRecord>({
						model: "relayedTransaction",
						where: [
							{ field: "txHash", operator: "eq", value: txHash },
							{ field: "userId", operator: "eq", value: session.user.id },
						],
					});

					if (!relayedTx) {
						throw new APIError("NOT_FOUND", {
							message: "Transaction not found or not owned by this user",
							status: 404,
						});
					}

					const network = relayedTx.network;
					const senderId = relayedTx.senderId;

					try {
						const near = getNear(network);
						const txResult = await near.getTransactionStatus(txHash, senderId);

						const txStatus = txResult.status;
						if (txStatus && typeof txStatus === "object") {
							const hasSuccess = "SuccessValue" in txStatus || "SuccessReceiptId" in txStatus;
							const hasFailure = "Failure" in txStatus;
							const status = hasSuccess ? "completed" : hasFailure ? "failed" : "pending";

							if (status !== "pending") {
								await ctx.context.adapter.update({
									model: "relayedTransaction",
									where: [{ field: "txHash", operator: "eq", value: txHash }],
									update: { status },
								});
							}

							const gasUsed = txResult.transaction_outcome?.outcome?.gas_burnt?.toString();

							return ctx.json(RelayStatusResponse.parse({
								status,
								gasUsed,
								outcome: txResult,
							}));
						}

						return ctx.json(RelayStatusResponse.parse({ status: "pending" }));
					} catch (error: unknown) {
						return ctx.json(RelayStatusResponse.parse({ status: "pending" }));
					}
				},
			),
			getRelayerInfo: createAuthEndpoint(
				"/near/relayer-info",
				{
					method: "POST",
					body: GetRelayerInfoRequest,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { network: requestedNetwork } = ctx.body;
					const targetNetwork = (requestedNetwork ?? primaryNetwork) as "mainnet" | "testnet";
					const rState = await ensureRelayer(ctx.context.adapter, ctx.context.secret, targetNetwork);

					if (!rState) {
						return ctx.json({ enabled: false, subAccountAvailable: false } satisfies Partial<RelayerInfo> & { enabled: boolean });
					}

					const subAccountCfg = getSubAccountConfig(targetNetwork);
					const parentKey = getParentKey(targetNetwork);
const { parentAccount, subAccountAvailable } = resolveParentAccount(subAccountCfg, parentKey, rState);

					const near = getNear(rState.network);
					let account;
					try {
						account = await near.getAccount(rState.accountId);
					} catch {
						account = {
							balance: "0",
							available: "0",
							staked: "0",
							storageUsage: "0",
							storageBytes: 0,
							hasContract: false,
							codeHash: "",
						};
					}

					return ctx.json({
						enabled: true,
						accountId: rState.accountId,
						mode: rState.mode,
						network: rState.network,
						publicKey: rState.publicKey,
						balance: account.balance,
						available: account.available,
						staked: account.staked,
						storageUsage: account.storageUsage,
						storageBytes: account.storageBytes,
						hasContract: account.hasContract,
						hasKey: true,
						createdAt: rState.createdAt,
						lastUsedAt: rState.lastUsedAt,
						parentAccount: parentAccount ?? undefined,
						subAccountAvailable,
					});
				},
			),
			getRelayHistory: createAuthEndpoint(
				"/near/relay-history",
				{
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const session = ctx.context.session;

					let transactions: RelayedTransactionRecord[] = [];
					try {
						const result = await ctx.context.adapter.findMany<RelayedTransactionRecord>({
							model: "relayedTransaction",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
							],
						});
						transactions = result || [];
					} catch (err) {
						console.error("relay-history findMany error:", err);
					}

					const sorted = transactions.sort((a, b) => {
						const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime();
						const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime();
						return bTime - aTime;
					});

					return ctx.json({
						transactions: sorted.map((tx) => ({
							id: String(tx.id ?? ""),
							userId: String(tx.userId ?? ""),
							txHash: String(tx.txHash ?? ""),
							senderId: String(tx.senderId ?? ""),
							receiverId: String(tx.receiverId ?? ""),
							network: String(tx.network ?? "mainnet"),
							status: String(tx.status ?? "pending"),
							gasUsed: tx.gasUsed ? String(tx.gasUsed) : undefined,
							createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt ? String(tx.createdAt) : new Date().toISOString(),
							updatedAt: tx.updatedAt instanceof Date ? tx.updatedAt.toISOString() : tx.updatedAt ? String(tx.updatedAt) : undefined,
						})),
					});
				},
			),
			viewContract: createAuthEndpoint(
				"/near/view",
				{
					method: "POST",
					body: ViewContractRequest,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { contractId, methodName, args } = ctx.body;
					const session = ctx.context.session;
					const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "isPrimary", operator: "eq", value: true },
						],
					});

					const network = (nearAccount?.network || primaryNetwork) as "mainnet" | "testnet";
					const near = getNear(network);
					let result: unknown;
					try {
						result = await near.view(contractId, methodName, args ?? {});
					} catch (error: unknown) {
						if (error instanceof APIError) throw error;
						throw new APIError("BAD_REQUEST", {
							message: error instanceof Error ? error.message : "Unknown error",
						});
					}
					return ctx.json(ViewContractResponse.parse({ result }));
				},
			),
			createSubAccount: createAuthEndpoint(
				"/near/create-sub-account",
				{
					method: "POST",
					body: CreateSubAccountRequest,
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { subAccountName, network: providedNetwork, publicKey } = ctx.body;
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be authenticated to create a sub-account",
							status: 401,
						});
					}

					const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "isPrimary", operator: "eq", value: true },
						],
					});

					const network = (providedNetwork || nearAccount?.network || primaryNetwork) as "mainnet" | "testnet";
					const subAccountCfg = getSubAccountConfig(network);
					const userAccountId = nearAccount?.accountId ?? "";
					const parentKey = getParentKey(network);
					const rState = await ensureRelayer(ctx.context.adapter, ctx.context.secret, network);
					const { parentAccount, subAccountAvailable } = resolveParentAccount(subAccountCfg, parentKey, rState);

					if (!subAccountAvailable || !parentAccount) {
						const configuredParent = subAccountCfg?.parentAccount;
						let msg: string;
						if (configuredParent && !parentKey) {
							msg = `Sub-account creation unavailable on ${network}: parent key not configured for ${configuredParent}. Set NEAR_SUB_ACCOUNT_PARENT_KEY_${network.toUpperCase()} in your environment, or use an explicit relayer with a named account.`;
						} else if (!configuredParent) {
							msg = `Sub-account creation unavailable on ${network}: no parent account configured. Set subAccount.${network}.parentAccount in your SIWN plugin options, or use an explicit relayer with a named account.`;
						} else {
							msg = `Sub-account creation unavailable on ${network}: requires a named parent account with a parent key, or an explicit relayer with a named account.`;
						}
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: msg,
							status: 503,
						});
					}

					const effectiveParentKey = getRawParentKey(network);
					if (parentAccount !== rState?.accountId && !effectiveParentKey) {
						throw new APIError("SERVICE_UNAVAILABLE", {
							message: "Sub-account parent differs from relayer account. Provide secrets.parentKey to sign as the parent account.",
							status: 503,
						});
					}

					const newAccountId = `${subAccountName}.${parentAccount}`;
					const minDeposit = subAccountCfg?.minDeposit || "0.1 NEAR";

					const near = getNear(network);
					const exists = await near.accountExists(newAccountId);
					if (exists) {
						throw new APIError("CONFLICT", {
							message: `Account ${newAccountId} already exists on ${network}`,
							status: 409,
						});
					}

					const txCtx: SubAccountTxCtx = {
						newAccountId,
						parentAccount,
						userPublicKey: publicKey,
						userAccountId,
						userId: session.user.id,
						network,
					};

					const signingNear = rState?.near ?? near;
					let txBuilder = signingNear
						.transaction(parentAccount)
						.createAccount(newAccountId)
						.addKey(publicKey, { type: "fullAccess" });

					if (subAccountCfg?.parentHasFullAccess) {
						const parentPublicKey = parentAccount === rState?.accountId
							? rState.publicKey
							: parseKey(effectiveParentKey!).publicKey.toString();
						txBuilder = txBuilder.addKey(parentPublicKey, { type: "fullAccess" });
					}

					if (subAccountCfg?.addRelayerFCAK !== false && subAccountCfg?.relayerFCAK && rState) {
						const fcakPermission: { type: "functionCall"; receiverId: string; methodNames?: string[]; allowance?: string } = {
							type: "functionCall",
							receiverId: subAccountCfg.relayerFCAK.receiverId,
						};
						if (subAccountCfg.relayerFCAK.methodNames) {
							fcakPermission.methodNames = subAccountCfg.relayerFCAK.methodNames;
						}
						if (subAccountCfg.relayerFCAK.allowance) {
							fcakPermission.allowance = subAccountCfg.relayerFCAK.allowance as `${number} NEAR` | `${bigint} yocto`;
						}
						txBuilder.addKey(rState.publicKey, fcakPermission as any);
					}

					txBuilder.transfer(newAccountId, minDeposit as `${number} NEAR`);

					if (subAccountCfg?.deploy) {
						if ("wasm" in subAccountCfg.deploy) {
							txBuilder = txBuilder.deployContract(newAccountId, subAccountCfg.deploy.wasm);
						} else if ("fromPublished" in subAccountCfg.deploy) {
							txBuilder = txBuilder.deployFromPublished(subAccountCfg.deploy.fromPublished as any);
						}
					}

					if (subAccountCfg?.init) {
						const initArgs = typeof subAccountCfg.init.args === "function"
							? subAccountCfg.init.args(txCtx)
							: subAccountCfg.init.args;
						txBuilder = txBuilder.functionCall(newAccountId, subAccountCfg.init.methodName, initArgs);
					}

					if (subAccountCfg?.extendTx) {
						txBuilder = subAccountCfg.extendTx(txBuilder, txCtx) as typeof txBuilder;
					}

					if (effectiveParentKey) {
						txBuilder = txBuilder.signWith(effectiveParentKey as PrivateKey);
					}

					const cleanupDb = async () => {
						try {
							const existing = await ctx.context.adapter.findOne<{ id: string }>({
								model: "nearAccount",
								where: [{ field: "accountId", operator: "eq", value: newAccountId }],
							});
							if (existing) {
								await ctx.context.adapter.delete({ model: "nearAccount", where: [{ field: "id", operator: "eq", value: existing.id }] });
							}
						} catch { }
						try {
							await ctx.context.internalAdapter.deleteAccount(`${newAccountId}:${network}`);
						} catch { }
					};

					const lifecycleCtx: SubAccountLifecycleCtx = { ...txCtx, near: signingNear };

					try {
						await txBuilder.send({ waitUntil: "EXECUTED" });
					} catch (error: unknown) {
						const msg = error instanceof Error ? error.message : "Unknown error";
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: `Failed to create sub-account: ${msg}`,
							status: 500,
						});
					}

					try {
						await ctx.context.adapter.create({
							model: "nearAccount",
							data: {
								userId: session.user.id,
								accountId: newAccountId,
								network,
								publicKey,
								isPrimary: false,
								createdAt: new Date(),
							},
						});

						await ctx.context.internalAdapter.createAccount({
							userId: session.user.id,
							providerId: "siwn",
							accountId: `${newAccountId}:${network}`,
							createdAt: new Date(),
							updatedAt: new Date(),
						});

						if (subAccountCfg?.onCreated) {
							await subAccountCfg.onCreated(lifecycleCtx);
						}
					} catch (error: unknown) {
						await cleanupDb();
						if (subAccountCfg?.onRollback) {
							try { await subAccountCfg.onRollback(lifecycleCtx); } catch { }
						} else {
							try {
								const key = getRawParentKey(network);
								if (key) {
									const rollbackNear = getNear(network);
									await rollbackNear
										.transaction(newAccountId)
										.deleteAccount({ beneficiary: parentAccount })
										.signWith(key as PrivateKey)
										.send({ waitUntil: "EXECUTED" });
								}
							} catch { }
						}
						const msg = error instanceof Error ? error.message : "Unknown error";
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: `Sub-account created but post-creation failed: ${msg}`,
							status: 500,
						});
					}

					return ctx.json(CreateSubAccountResponse.parse({
						success: true,
						accountId: newAccountId,
						network,
						publicKey,
						message: `Sub-account ${newAccountId} created on ${network}`,
					}));
				},
			),
		checkSubAccountAvailability: createAuthEndpoint(
			"/near/check-sub-account-availability",
			{
				method: "POST",
				body: CheckSubAccountAvailabilityRequest,
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const { subAccountName, network: providedNetwork } = ctx.body;
				const session = ctx.context.session;

				if (!session) {
					throw new APIError("UNAUTHORIZED", {
						message: "Must be authenticated to check sub-account availability",
						status: 401,
					});
				}

				const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
					model: "nearAccount",
					where: [
						{ field: "userId", operator: "eq", value: session.user.id },
						{ field: "isPrimary", operator: "eq", value: true },
					],
				});

				if (!nearAccount) {
					throw new APIError("UNAUTHORIZED", {
						message: "Must have a linked NEAR wallet to check sub-account availability",
						status: 401,
					});
				}

				const network = (providedNetwork || nearAccount.network || primaryNetwork) as "mainnet" | "testnet";
				const subAccountCfg = getSubAccountConfig(network);
				const parentAccount = subAccountCfg?.parentAccount ?? null;

				if (!parentAccount || isImplicitAccount(parentAccount)) {
					return ctx.json(CheckSubAccountAvailabilityResponse.parse({
						available: false,
						accountId: "",
						reason: "not-configured",
					}));
				}

				const accountId = `${subAccountName}.${parentAccount}`;

				if (accountId.length > 64) {
					return ctx.json(CheckSubAccountAvailabilityResponse.parse({
						available: false,
						accountId,
						parentAccount,
						reason: "too-long",
					}));
				}

				const near = getNear(network);
				const exists = await near.accountExists(accountId);

				return ctx.json(CheckSubAccountAvailabilityResponse.parse({
					available: !exists,
					accountId,
					parentAccount,
					reason: exists ? "taken" : undefined,
				}));
			},
		),
		},
	});
};
