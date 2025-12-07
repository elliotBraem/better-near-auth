import { APIError, createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { Account, BetterAuthPlugin, User } from "better-auth/types";
import { generateNonce, parseAuthToken, verify, type VerificationResult, type VerifyOptions } from "near-sign-verify";
import { bytesToBase64 } from "./utils";
import z from "zod";
import { defaultGetProfile, getImageUrl, getNetworkFromAccountId } from "./profile";
import { schema } from "./schema";
import type {
	AccountId,
	NearAccount,
	Profile
} from "./types";
import {
	NonceRequest,
	NonceResponse,
	ProfileRequest,
	ProfileResponse,
	VerifyRequest,
	VerifyResponse
} from "./types";
export * from "./types";

function getOrigin(baseURL: string): string {
	try {
		return new URL(baseURL).origin;
	} catch {
		return baseURL;
	}
}

export type SIWNPluginOptions =
	| {
		recipient: string;
		anonymous?: true;
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
	}
	| {
		recipient: string;
		anonymous: false;
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
			recipient: string;
		}) => Promise<boolean>;
	};

export const siwn = (options: SIWNPluginOptions) =>
	({
		id: "siwn",
		schema,
		hooks: {
			after: [
				{
					// Hook into session to include NEAR account data
					matcher: (context) => context.path === "/auth/session" && context.method === "GET",
					handler: createAuthMiddleware(async (ctx) => {
						// This will help the client get NEAR account data with session
						const session = ctx.context.session;
						if (session) {
							// Find primary NEAR account for this user
							const nearAccount: NearAccount | null = await ctx.context.adapter.findOne({
								model: "nearAccount",
								where: [
									{ field: "userId", operator: "eq", value: session.user.id },
									{ field: "isPrimary", operator: "eq", value: true },
								],
							});

							if (nearAccount) {
								// Add NEAR account to session response
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
					body: VerifyRequest.refine((data) => options.anonymous !== false || !!data.email, {
						message: "Email is required when the anonymous plugin option is disabled.",
						path: ["email"],
					}),
					use: [sessionMiddleware], // Requires active session
					requireRequest: true,
				},
				async (ctx) => {
					const { authToken, accountId, email } = ctx.body;
					const network = getNetworkFromAccountId(accountId);
					const session = ctx.context.session;

					if (!session) {
						throw new APIError("UNAUTHORIZED", {
							message: "Must be logged in to link NEAR account",
							status: 401,
						});
					}

					try {
						const verification = await ctx.context.internalAdapter.findVerificationValue(
							`siwn:${accountId}:${network}`,
						);

						if (!verification || new Date() > verification.expiresAt) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Invalid or expired nonce",
								status: 401,
							});
						}

						// Build verify options using plugin configuration
						const requireFullAccessKey = options.requireFullAccessKey ?? true;
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

						// Verify the signature using near-sign-verify
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

						await ctx.context.internalAdapter.deleteVerificationValue(verification.id);

						// Check if this NEAR account is already linked
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

						// Check if user already has a primary NEAR account
						const existingPrimaryAccount: NearAccount | null = await ctx.context.adapter.findOne({
							model: "nearAccount",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
								{ field: "isPrimary", operator: "eq", value: true },
							],
						});

						// Link the NEAR account to the current user
						await ctx.context.adapter.create({
							model: "nearAccount",
							data: {
								userId: session.user.id,
								accountId,
								network,
								publicKey: result.publicKey,
								isPrimary: !existingPrimaryAccount, // First NEAR account becomes primary
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

					// Find the NEAR account to unlink
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

					// Safety check: Don't allow unlinking if it's the only auth method
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

					// If unlinking primary account, promote another one
					if (nearAccount.isPrimary) {
						const otherNearAccounts: NearAccount[] = await ctx.context.adapter.findMany({
							model: "nearAccount",
							where: [
								{ field: "userId", operator: "eq", value: session.user.id },
								{ field: "accountId", operator: "ne", value: accountId },
							],
						});

						if (otherNearAccounts.length > 0) {
							// Promote the first other NEAR account to primary
							await ctx.context.adapter.update({
								model: "nearAccount",
								where: [
									{ field: "id", operator: "eq", value: otherNearAccounts[0]!.id },
								],
								update: { isPrimary: true },
							});
						}
					}

					// Delete the NEAR account record
					await ctx.context.adapter.delete({
						model: "nearAccount",
						where: [
							{ field: "userId", operator: "eq", value: session.user.id },
							{ field: "accountId", operator: "eq", value: accountId },
							{ field: "network", operator: "eq", value: network },
						],
					});

					// Delete the associated account record
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
					const { accountId, publicKey, networkId } = ctx.body;
					const network = getNetworkFromAccountId(accountId);

					if (networkId !== network) {
						throw new APIError("BAD_REQUEST", {
							message: "Network ID mismatch with account ID",
							status: 400,
						});
					}

					const nonce = options.getNonce ? await options.getNonce() : generateNonce();

					// Store nonce as base64 string for database compatibility
					const nonceString = bytesToBase64(nonce);

					await ctx.context.internalAdapter.createVerificationValue({
						identifier: `siwn:${accountId}:${network}`,
						value: nonceString!,
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

					const profile = await (options.getProfile || defaultGetProfile)(targetAccountId);
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
						const verification =
							await ctx.context.internalAdapter.findVerificationValue(
								`siwn:${accountId}:${network}`,
							);

						if (!verification || new Date() > verification.expiresAt) {
							throw new APIError("UNAUTHORIZED", {
								message: "Unauthorized: Invalid or expired nonce",
								status: 401,
								code: "UNAUTHORIZED_INVALID_OR_EXPIRED_NONCE",
							});
						}

						// Build verify options using plugin configuration
						const requireFullAccessKey = options.requireFullAccessKey ?? true;
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

						// Verify the signature using near-sign-verify
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
							}); // we could validate against some access control contract

							if (!isValidKey) {
								throw new APIError("UNAUTHORIZED", {
									message: "Unauthorized: Invalid function call access key",
									status: 401,
								});
							}
						}

						await ctx.context.internalAdapter.deleteVerificationValue(
							verification.id,
						);

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

							const profile = await (options.getProfile || defaultGetProfile)(accountId);

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
									publicKey: result.publicKey,
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
										publicKey: result.publicKey,
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

						const session = await ctx.context.internalAdapter.createSession(
							user.id
							// ctx,
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
						throw new APIError("UNAUTHORIZED", {
							message: "Something went wrong. Please try again later.",
							error: error instanceof Error ? error.message : "Unknown error",
							status: 401,
						});
					}
				},
			),
		},
	}) satisfies BetterAuthPlugin;
