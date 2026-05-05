import { APIError, createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { Account, BetterAuthPlugin, User, DBAdapter } from "better-auth/types";
import { Near, generateNonce, generateKey, parseKey, verifyNep413Signature, decodeSignedDelegateAction, InMemoryKeyStore, RotatingKeyStore } from "near-kit";
import type { SignedMessage, SignMessageParams, SignedDelegateAction } from "near-kit";
import { hex, base58 } from "@scure/base";
import z from "zod";
import { defaultGetProfile, getImageUrl, getNetworkFromAccountId } from "./profile.js";
import { schema } from "./schema.js";
import type {
	AccountId,
	NearAccount,
	Profile,
	RelayerInfo,
	RelayedTransactionRecord,
} from "./types.js";
import {
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
	ViewContractRequest,
	ViewContractResponse,
} from "./types.js";
export * from "./types.js";
import {
	bytesToHex,
	encryptPrivateKey,
	decryptPrivateKey,
} from "./utils.js";

async function hashNonce(nonce: Uint8Array): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function deriveEmail(accountId: string): string | null {
	if (accountId.endsWith(".near")) {
		const localPart = accountId.slice(0, -5);
		return `${localPart}@near.email`;
	}
	return null;
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
		return {
			near,
			accountId: relayerConfig.accountId,
			network,
			mode: "explicit",
		};
	}

	const existing = await adapter.findOne<{ encryptedPrivateKey: string; iv: string; createdAt: Date; lastUsedAt: Date }>({
		model: "relayerKey",
		where: [{ field: "network", operator: "eq", value: network }],
	});

	if (existing) {
		const kek = secret || process.env.BETTER_AUTH_SECRET || "";
		const privateKeyBytes = await decryptPrivateKey(existing.encryptedPrivateKey, existing.iv, kek);
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
			createdAt: existing.createdAt,
			lastUsedAt: existing.lastUsedAt,
		};
	}

	const keyPair = generateKey();
	const kek = secret || process.env.BETTER_AUTH_SECRET || "";
	const privateKeyBytes = keyPair.secretKey.startsWith("ed25519:")
		? base58.decode(keyPair.secretKey.slice(8))
		: new Uint8Array(0);

	const publicKeyBase58 = keyPair.publicKey.toString().replace("ed25519:", "");
	const accountId = bytesToHex(keyPair.publicKey.data);

	const { encrypted, iv } = await encryptPrivateKey(privateKeyBytes, kek);

	await adapter.create({
		model: "relayerKey",
		data: {
			id: `relayer:${network}`,
			accountId,
			encryptedPrivateKey: encrypted,
			iv,
			publicKey: `ed25519:${publicKeyBase58}`,
			network,
			createdAt: new Date(),
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
		createdAt: new Date(),
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

export interface SIWNPluginOptions {
	recipient: string;
	requireFullAccessKey?: boolean;
	getNonce?: () => Promise<Uint8Array>;
	getProfile?: (accountId: AccountId) => Promise<Profile | null>;
	validateLimitedAccessKey?: (args: {
		accountId: AccountId;
		publicKey: string;
		recipient?: string;
	}) => Promise<boolean>;
	apiKey?: string;
	rpcUrl?: string;
	relayer?: RelayerConfig;
}

export const siwn = (options: SIWNPluginOptions): BetterAuthPlugin => {
	const apiKey = options.apiKey;
	let relayerState: RelayerState | null = null;
	let relayerInitialized = false;

	const headers: Record<string, string> = {};
	if (apiKey) {
		headers["Authorization"] = `Bearer ${apiKey}`;
	}

	const ensureRelayer = async (adapter: DBAdapter, secret: string | undefined, network: "mainnet" | "testnet") => {
		if (relayerInitialized) return relayerState;
		relayerInitialized = true;
		relayerState = await initRelayer(options.relayer, network, adapter, secret, apiKey, options.rpcUrl);
		return relayerState;
	};

	const getNear = (network: "mainnet" | "testnet") => {
		if (options.rpcUrl) {
			return new Near({ network: { rpcUrl: options.rpcUrl, networkId: network }, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined });
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
					const { signedMessage, message, recipient, nonce, accountId } = ctx.body;
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
							signedMessage as SignedMessage,
							{ message, recipient, nonce: nonceBytes } as SignMessageParams,
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

					return ctx.json({ accounts: nearAccounts });
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
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const { accountId } = ctx.body;
					let targetAccountId = accountId;

					if (!targetAccountId) {
						const session = ctx.context.session;
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
					} = ctx.body;
					const network = getNetworkFromAccountId(accountId);

					try {
						const near = getNear(network);
						const nonceBytes = hex.decode(nonce);

						const isValid = await verifyNep413Signature(
							signedMessage as SignedMessage,
							{ message, recipient, nonce: nonceBytes } as SignMessageParams,
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
									defaultValidateLimitedAccessKey(args.accountId, args.publicKey, args.recipient || options.recipient, near));

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
							const userEmail = deriveEmail(accountId) ?? "";

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

						const relayerConfig = options.relayer;
						if (relayerConfig?.whitelistedContracts?.length) {
							if (!relayerConfig.whitelistedContracts.includes(delegateAction.receiverId)) {
								throw new APIError("FORBIDDEN", {
									message: `Contract ${delegateAction.receiverId} is not whitelisted for relay`,
									status: 403,
								});
							}
						}

						if (relayerConfig?.maxGasPerTransaction) {
							const totalGas = delegateAction.actions.reduce((sum: bigint, a) => {
								return sum + ("functionCall" in a ? a.functionCall.gas : 0n);
							}, 0n);
							if (totalGas > BigInt(relayerConfig.maxGasPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction gas (${totalGas}) exceeds relayer limit (${relayerConfig.maxGasPerTransaction})`,
									status: 400,
								});
							}
						}

						if (relayerConfig?.maxDepositPerTransaction) {
							const totalDeposit = delegateAction.actions.reduce((sum: bigint, a) => {
								if ("functionCall" in a) return sum + a.functionCall.deposit;
								if ("transfer" in a) return sum + a.transfer.deposit;
								return sum;
							}, 0n);
							if (totalDeposit > BigInt(relayerConfig.maxDepositPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction deposit (${totalDeposit}) exceeds relayer limit (${relayerConfig.maxDepositPerTransaction})`,
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
								where: [{ field: "id", operator: "eq", value: `relayer:${network}` }],
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
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const session = ctx.context.session;
					const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "isPrimary", operator: "eq", value: true },
						],
					});

					const network = (nearAccount?.network || "mainnet") as "mainnet" | "testnet";
					const rState = await ensureRelayer(ctx.context.adapter, ctx.context.secret, network);

					if (!rState) {
						return ctx.json({ enabled: false } satisfies Partial<RelayerInfo> & { enabled: boolean });
					}

					const near = getNear(network);
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
						balance: account.balance,
						available: account.available,
						staked: account.staked,
						storageUsage: account.storageUsage,
						storageBytes: account.storageBytes,
						hasContract: account.hasContract,
						hasKey: true,
						createdAt: rState.createdAt,
						lastUsedAt: rState.lastUsedAt,
					} as RelayerInfo & { enabled: boolean });
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
						transactions = (result || []) as RelayedTransactionRecord[];
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

					const network = (nearAccount?.network || "mainnet") as "mainnet" | "testnet";
					const near = getNear(network);
					const result = await near.view(contractId, methodName, args ?? {});
					return ctx.json(ViewContractResponse.parse({ result }));
				},
			),
		},
	} satisfies BetterAuthPlugin);
};
