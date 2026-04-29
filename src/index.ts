import { APIError, createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { Account, BetterAuthPlugin, User } from "better-auth/types";
import { generateNonce, parseAuthToken, verify, type VerificationResult, type VerifyOptions } from "near-sign-verify";
import { ed25519 } from "@noble/curves/ed25519.js";
import z from "zod";
import { defaultGetProfile, getImageUrl, getNetworkFromAccountId } from "./profile.js";
import { queryAccessKey, queryBlock, queryTx, sendTxBroadcast, queryAccount } from "./rpc.js";
import { schema } from "./schema.js";
import type {
	AccountId,
	NearAccount,
	Profile,
	RelayerInfo,
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
} from "./types.js";
export * from "./types.js";
import {
	base64ToBytes,
	bytesToBase64,
	bytesToHex,
	deserializeSignedDelegateAction,
	encryptPrivateKey,
	decryptPrivateKey,
	generateEphemeralKeypair,
	serializeTransaction,
	serializeSignedTransaction,
	signTransaction,
	type TransactionStruct,
	type SignedTransactionStruct,
} from "./utils.js";

function getOrigin(baseURL: string): string {
	try {
		return new URL(baseURL).origin;
	} catch {
		return baseURL;
	}
}

async function hashNonce(nonce: Uint8Array): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join(''));
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface RelayerConfig {
	accountId?: string;
	privateKey?: string;
	whitelistedContracts?: string[];
	maxGasPerTransaction?: string;
	maxDepositPerTransaction?: string;
}

interface RelayerState {
	accountId: string;
	privateKey: Uint8Array;
	publicKey: Uint8Array;
	publicKeyBase64: string;
	network: "mainnet" | "testnet";
	mode: "ephemeral" | "explicit";
	createdAt?: Date;
	lastUsedAt?: Date;
}

async function initRelayer(
	relayerConfig: RelayerConfig | undefined,
	network: "mainnet" | "testnet",
	adapter: any,
	secret: string | undefined,
): Promise<RelayerState | null> {
	if (!relayerConfig) return null;

	if (relayerConfig.accountId && relayerConfig.privateKey) {
		const privateKey = base64ToBytes(relayerConfig.privateKey);
		const publicKey = ed25519.getPublicKey(privateKey);
		return {
			accountId: relayerConfig.accountId,
			privateKey,
			publicKey,
			publicKeyBase64: bytesToBase64(publicKey),
			network,
			mode: "explicit",
		};
	}

	const existing = await adapter.findOne({
		model: "relayerKey",
		where: [{ field: "network", operator: "eq", value: network }],
	});

	if (existing) {
		const kek = secret || process.env.BETTER_AUTH_SECRET || "";
		const privateKey = await decryptPrivateKey(existing.encryptedPrivateKey, existing.iv, kek);
		const publicKey = ed25519.getPublicKey(privateKey);
		const accountId = bytesToHex(publicKey);

		console.log(`[siwn] Relayer recovered: ${accountId} (${network})`);

		return {
			accountId,
			privateKey,
			publicKey,
			publicKeyBase64: bytesToBase64(publicKey),
			network,
			mode: "ephemeral",
			createdAt: existing.createdAt,
			lastUsedAt: existing.lastUsedAt,
		};
	}

	const keypair = await generateEphemeralKeypair();
	const kek = secret || process.env.BETTER_AUTH_SECRET || "";
	const { encrypted, iv } = await encryptPrivateKey(keypair.privateKey, kek);

	await adapter.create({
		model: "relayerKey",
		data: {
			id: `relayer:${network}`,
			accountId: keypair.accountId,
			encryptedPrivateKey: encrypted,
			iv,
			publicKey: `ed25519:${keypair.publicKeyBase64}`,
			network,
			createdAt: new Date(),
		},
	});

	console.log(`[siwn] Relayer created in EPHEMERAL mode: ${keypair.accountId} (${network})`);
	console.log(`[siwn] Fund this account with NEAR to enable gasless relay`);
	console.log(`[siwn] Private key is encrypted in DB — persists across restarts`);

	return {
		accountId: keypair.accountId,
		privateKey: keypair.privateKey,
		publicKey: keypair.publicKey,
		publicKeyBase64: keypair.publicKeyBase64,
		network,
		mode: "ephemeral",
		createdAt: new Date(),
	};
}

async function relayOnChain(
	signedDelegateActionBase64: string,
	relayerState: RelayerState,
	network: "mainnet" | "testnet",
	apiKey?: string,
): Promise<{ txHash: string }> {
	const signedDelegate = deserializeSignedDelegateAction(signedDelegateActionBase64);

	const relayerAccessKey = await queryAccessKey(
		relayerState.accountId,
		`ed25519:${relayerState.publicKeyBase64}`,
		network,
		apiKey,
	);

	const block = await queryBlock(network, apiKey);

	const blockHashBytes = base64ToBytes(block.header.hash);

	const tx: TransactionStruct = {
		signerId: relayerState.accountId,
		publicKey: { keyType: 0, data: relayerState.publicKey },
		nonce: BigInt(relayerAccessKey.nonce) + 1n,
		receiverId: signedDelegate.delegateAction.senderId,
		blockHash: blockHashBytes,
		actions: [{
			signedDelegate: {
				delegateAction: signedDelegate.delegateAction,
				signature: signedDelegate.signature,
				publicKey: signedDelegate.delegateAction.publicKey,
			},
		}],
	};

	const txBytes = serializeTransaction(tx);
	const signature = await signTransaction(txBytes, relayerState.privateKey);

	const signedTx: SignedTransactionStruct = {
		transaction: tx,
		signature,
	};

	const signedTxBytes = serializeSignedTransaction(signedTx);
	const signedTxBase64 = bytesToBase64(signedTxBytes);

	const txHash = await sendTxBroadcast(signedTxBase64, network, apiKey);

	return { txHash };
}

interface SIWNPluginBaseOptions {
	recipient: string;
	emailDomainName?: string;
	requireFullAccessKey?: boolean;
	getNonce?: () => Promise<Uint8Array>;
	validateNonce?: (nonce: Uint8Array) => boolean;
	validateRecipient?: (recipient: string) => boolean;
	validateMessage?: (message: string) => boolean;
	getProfile?: (accountId: AccountId) => Promise<Profile | null>;
	validateLimitedAccessKey?: (args: {
		accountId: AccountId;
		publicKey: string;
		recipient?: string;
	}) => Promise<boolean>;
	fastnearApiKey?: string;
	relayer?: RelayerConfig;
}

export type SIWNPluginOptions =
	| SIWNPluginBaseOptions & { anonymous?: true }
	| SIWNPluginBaseOptions & {
			anonymous: false;
			validateLimitedAccessKey?: (args: {
				accountId: AccountId;
				publicKey: string;
				recipient: string;
			}) => Promise<boolean>;
		};

export const siwn = (options: SIWNPluginOptions): BetterAuthPlugin => {
	const apiKey = options.fastnearApiKey || process.env.FASTNEAR_API_KEY;
	let relayerState: RelayerState | null = null;
	let relayerInitialized = false;

	const ensureRelayer = async (adapter: any, secret: string | undefined, network: "mainnet" | "testnet") => {
		if (relayerInitialized) return relayerState;
		relayerInitialized = true;
		relayerState = await initRelayer(options.relayer, network, adapter, secret);
		return relayerState;
	};

	return ({
		id: "siwn",
		schema,
		hooks: {
			after: [
				{
					matcher: (context: any) => context.path === "/auth/session" && context.method === "GET",
					handler: createAuthMiddleware(async (ctx: any) => {
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
					const { authToken, accountId } = ctx.body;
					const network = getNetworkFromAccountId(accountId);
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be logged in to link NEAR account",
							status: 401,
						});
					}

			try {
					const requireFullAccessKey = options.requireFullAccessKey ?? false;
					const verifyOptions: VerifyOptions = {
						requireFullAccessKey: requireFullAccessKey,
						...(options.validateNonce
							? { validateNonce: options.validateNonce }
							: { nonceMaxAge: 15 * 60 * 1000 }),
						...(options.validateRecipient
							? { validateRecipient: options.validateRecipient }
							: { expectedRecipient: options.recipient }),
						...(options.validateMessage ? { validateMessage: options.validateMessage } : {}),
					} as VerifyOptions;

					const result: VerificationResult = await verify(authToken, verifyOptions);

					if (result.accountId !== accountId) {
						throw new APIError("UNAUTHORIZED", {
							message: "Unauthorized: Account ID mismatch",
							status: 401,
						});
					}

					if (!options.requireFullAccessKey && options.validateLimitedAccessKey) {
						const isValidKey = await options.validateLimitedAccessKey({
							accountId: result.accountId,
							publicKey: result.publicKey,
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
								publicKey: result.publicKey,
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

				const nonce = options.getNonce ? await options.getNonce() : generateNonce();

				const nonceString = bytesToBase64(nonce);

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
					body: VerifyRequest.refine((data) => options.anonymous !== false || !!data.email, {
						message: "Email is required when the anonymous plugin option is disabled.",
						path: ["email"],
					}),
					requireRequest: true,
				},
				async (ctx) => {
					const {
						authToken,
						accountId,
						email,
					} = ctx.body;
					const network = getNetworkFromAccountId(accountId);
					const isAnon = options.anonymous ?? true;

					if (!isAnon && !email) {
						throw new APIError("BAD_REQUEST", {
							message: "Email is required when anonymous is disabled.",
							status: 400,
						});
					}

				try {
					const requireFullAccessKey = options.requireFullAccessKey ?? false;
					const verifyOptions: VerifyOptions = {
						requireFullAccessKey: requireFullAccessKey,
						...(options.validateNonce
							? { validateNonce: options.validateNonce }
							: { nonceMaxAge: 15 * 60 * 1000 }),
						...(options.validateRecipient
							? { validateRecipient: options.validateRecipient }
							: { expectedRecipient: options.recipient }),
						...(options.validateMessage ? { validateMessage: options.validateMessage } : {}),
					} as VerifyOptions;

					const result: VerificationResult = await verify(authToken, verifyOptions);

					if (result.accountId !== accountId) {
						throw new APIError("UNAUTHORIZED", {
							message: "Unauthorized: Account ID mismatch",
							status: 401,
						});
					}

					const publicKey = result.publicKey;
					const parsedToken = parseAuthToken(authToken);
					const nonceBytes = new Uint8Array(parsedToken.nonce);

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
						const domain =
							options.emailDomainName ?? getOrigin(ctx.context.baseURL);
						const userEmail =
							!isAnon && email ? email : `${accountId}@${domain}`;

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
					const { signedDelegateAction } = ctx.body;
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
						const decoded = deserializeSignedDelegateAction(signedDelegateAction);

						if (decoded.delegateAction.senderId !== nearAccount.accountId) {
							throw new APIError("UNAUTHORIZED", {
								message: "Delegate action sender does not match session account",
								status: 401,
							});
						}

						const relayerConfig = options.relayer;
						if (relayerConfig?.whitelistedContracts?.length) {
							if (!relayerConfig.whitelistedContracts.includes(decoded.delegateAction.receiverId)) {
								throw new APIError("FORBIDDEN", {
									message: `Contract ${decoded.delegateAction.receiverId} is not whitelisted for relay`,
									status: 403,
								});
							}
						}

						if (relayerConfig?.maxGasPerTransaction) {
							const totalGas = decoded.delegateAction.actions.reduce((sum: bigint, a: any) => {
								return sum + (a.functionCall?.gas ? BigInt(a.functionCall.gas) : 0n);
							}, 0n);
							if (totalGas > BigInt(relayerConfig.maxGasPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction gas (${totalGas}) exceeds relayer limit (${relayerConfig.maxGasPerTransaction})`,
									status: 400,
								});
							}
						}

						if (relayerConfig?.maxDepositPerTransaction) {
							const totalDeposit = decoded.delegateAction.actions.reduce((sum: bigint, a: any) => {
								const deposit = a.functionCall?.deposit ?? a.transfer?.deposit ?? 0n;
								return sum + (typeof deposit === "bigint" ? deposit : BigInt(deposit));
							}, 0n);
							if (totalDeposit > BigInt(relayerConfig.maxDepositPerTransaction)) {
								throw new APIError("BAD_REQUEST", {
									message: `Transaction deposit (${totalDeposit}) exceeds relayer limit (${relayerConfig.maxDepositPerTransaction})`,
									status: 400,
								});
							}
						}

						const result = await relayOnChain(
							signedDelegateAction,
							rState,
							network,
							apiKey,
						);

						await ctx.context.adapter.create({
							model: "relayedTransaction",
							data: {
								userId: session.user.id,
								txHash: result.txHash,
								senderId: decoded.delegateAction.senderId,
								receiverId: decoded.delegateAction.receiverId,
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

					const relayedTx = await ctx.context.adapter.findOne({
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

					const network = (relayedTx as any).network as "mainnet" | "testnet";

					try {
						const txResult = await queryTx(txHash, (relayedTx as any).senderId as string, network, apiKey);

						if (txResult?.status) {
							const status = txResult.status.HasSuccessReceiptId || txResult.status.SuccessValue
								? "completed"
								: txResult.status.Failure
									? "failed"
									: "pending";

							if (status !== "pending") {
								await ctx.context.adapter.update({
									model: "relayedTransaction",
									where: [{ field: "txHash", operator: "eq", value: txHash }],
									update: { status, gasUsed: txResult.transaction?.outcome?.gas_burnt?.toString() },
								});
							}

							return ctx.json(RelayStatusResponse.parse({
								status,
								gasUsed: txResult.transaction?.outcome?.gas_burnt?.toString(),
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

					const account = await queryAccount(rState.accountId, network, apiKey);
					const balance = account.amount;

					return ctx.json({
						enabled: true,
						accountId: rState.accountId,
						mode: rState.mode,
						network: rState.network,
						balance,
						hasKey: true,
						createdAt: rState.createdAt,
						lastUsedAt: rState.lastUsedAt,
					} as RelayerInfo & { enabled: boolean });
				},
			),
		},
	} satisfies BetterAuthPlugin);
};
