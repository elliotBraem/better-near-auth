import { and, eq } from "drizzle-orm";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { AuthConfig } from "./auth-export";
import { createAuthInstance } from "./auth-instance";
import { contract, type InferOutput } from "./contract";
import { createDatabaseDriver } from "./db/driver";
import { migrate } from "./db/migrator";
import * as schema from "./db/schema";

const API_KEY_CONFIG_IDS = ["user-keys", "org-keys"] as const;

const authSiwnBaseSchema = z.object({
  apiKey: z.string().optional(),
  rpcUrl: z.string().optional(),
  relayer: z
    .object({
      accountId: z.string().optional(),
    })
    .optional(),
  subAccount: z
    .object({
      mainnet: z
        .object({
          parentAccount: z.string().optional(),
        })
        .optional(),
      testnet: z
        .object({
          parentAccount: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const authSiwnRecipientSchema = authSiwnBaseSchema.extend({
  recipient: z.string(),
  recipients: z.never().optional(),
});

const authSiwnRecipientsSchema = authSiwnBaseSchema.extend({
  recipient: z.never().optional(),
  recipients: z.object({
    mainnet: z.string(),
    testnet: z.string(),
  }),
});

const authVariablesSchema = z.object({
  baseUrl: z.string().optional(),
  trustedOrigins: z.array(z.string()).optional(),
  apiKeyHeaders: z.array(z.string()).default(["x-api-key"]),
  socialProviders: z
    .object({
      github: z
        .object({
          clientId: z.string().optional(),
        })
        .optional(),
      google: z
        .object({
          clientId: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  passkey: z
    .object({
      rpID: z.string().optional(),
      rpName: z.string().optional(),
      origin: z.string().optional(),
    })
    .optional(),
  siwn: z.union([authSiwnRecipientSchema, authSiwnRecipientsSchema]),
});

const authSecretsSchema = z.object({
  AUTH_DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FASTNEAR_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  NEAR_RELAYER_PRIVATE_KEY: z.string().optional(),
  NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET: z.string().optional(),
  NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET: z.string().optional(),
});

type AuthPluginVariables = z.infer<typeof authVariablesSchema>;
type AuthPluginSecrets = z.infer<typeof authSecretsSchema>;

function toError(e: unknown): Error {
  if (typeof e === "object" && e !== null && "message" in e) {
    return new Error(String(e.message));
  }
  return new Error(String(e));
}

function tryJsonParse<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function createHeaders(reqHeaders?: Record<string, string>): Headers {
  return new Headers(Object.entries(reqHeaders ?? {}) as [string, string][]);
}

const localDevTrustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
];

function getActiveOrganizationId(session: unknown): string | null {
  if (session && typeof session === "object" && "activeOrganizationId" in session) {
    return (session as { activeOrganizationId: string | null }).activeOrganizationId;
  }
  return null;
}

function toORPCError(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const apiError = error as { status: number; message?: string; code?: string };
    const statusMap: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      500: "INTERNAL_SERVER_ERROR",
      503: "SERVICE_UNAVAILABLE",
    };
    return new ORPCError(statusMap[apiError.status] || "INTERNAL_SERVER_ERROR", {
      message: apiError.message || "Auth API error",
    });
  }
  if (error instanceof ORPCError) return error;
  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: error instanceof Error ? error.message : "Auth API error",
  });
}

async function safeAuthApi<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toORPCError(error);
  }
}

async function safeCall<T>(fn: () => Promise<any>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toORPCError(error);
  }
}

function ensureOrigin(value: string): string | null {
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).origin;
    } catch {
      console.warn(`[Auth] Invalid origin URL: ${value}`);
      return null;
    }
  }
  const isLoopback =
    value === "localhost" ||
    value.startsWith("localhost:") ||
    value === "127.0.0.1" ||
    value.startsWith("127.0.0.1:") ||
    value === "::1" ||
    value.startsWith("[::1]");
  const withProtocol = isLoopback ? `http://${value}` : `https://${value}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    console.warn(`[Auth] Invalid origin: ${value} (resolved to ${withProtocol})`);
    return null;
  }
}

function parseTrustedOrigins(
  baseUrlInput?: string,
  trustedOriginsInput?: string[],
): { baseUrl: string; trustedOrigins: string[] } {
  const baseUrl = baseUrlInput ? ensureOrigin(baseUrlInput) : "http://localhost:3000";
  const origins: string[] = [];
  if (baseUrl) origins.push(baseUrl);
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    origins.push(...localDevTrustedOrigins);
  }

  for (const entry of trustedOriginsInput ?? []) {
    const trimmed = entry.trim();
    if (trimmed) {
      const origin = ensureOrigin(trimmed);
      if (origin) origins.push(origin);
    }
  }

  return { baseUrl: baseUrl ?? "http://localhost:3000", trustedOrigins: [...new Set(origins)] };
}

function buildRelayerConfig(
  siwn: AuthPluginVariables["siwn"],
  secrets: AuthPluginSecrets,
): AuthConfig["siwn"]["relayer"] {
  if (!siwn.relayer?.accountId) return undefined;
  return {
    accountId: siwn.relayer.accountId,
    privateKey: secrets.NEAR_RELAYER_PRIVATE_KEY,
  };
}

function buildSubAccountConfig(
  siwn: AuthPluginVariables["siwn"],
  secrets: AuthPluginSecrets,
): AuthConfig["siwn"]["subAccount"] {
  if (!siwn.subAccount) return undefined;
  return {
    mainnet: {
      parentAccount: siwn.subAccount.mainnet?.parentAccount,
      parentKey: secrets.NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET,
    },
    testnet: {
      parentAccount: siwn.subAccount.testnet?.parentAccount,
      parentKey: secrets.NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET,
    },
  };
}

function normalizeAuthConfig(
  variables: AuthPluginVariables,
  secrets: AuthPluginSecrets,
): { authConfig: AuthConfig; apiKeyHeaders: string[] } {
  const { baseUrl, trustedOrigins } = parseTrustedOrigins(
    variables.baseUrl,
    variables.trustedOrigins,
  );

  const relayer = buildRelayerConfig(variables.siwn, secrets);
  const subAccount = buildSubAccountConfig(variables.siwn, secrets);
  const commonSiwn = {
    apiKey: variables.siwn.apiKey,
    rpcUrl: variables.siwn.rpcUrl,
    relayer,
    subAccount,
  };

  const siwn =
    variables.siwn.recipients !== undefined
      ? {
          recipients: {
            mainnet: variables.siwn.recipients.mainnet,
            testnet: variables.siwn.recipients.testnet,
          },
          ...commonSiwn,
        }
      : {
          recipient: variables.siwn.recipient,
          ...commonSiwn,
        };

  const authConfig: AuthConfig = {
    secret: secrets.BETTER_AUTH_SECRET,
    baseUrl,
    trustedOrigins,
    isProduction: process.env.NODE_ENV === "production",
    socialProviders: {
      github: {
        clientId: variables.socialProviders?.github?.clientId,
        clientSecret: secrets.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: variables.socialProviders?.google?.clientId,
        clientSecret: secrets.GOOGLE_CLIENT_SECRET,
      },
    },
    passkey: variables.passkey,
    phoneNumber:
      secrets.TWILIO_ACCOUNT_SID && secrets.TWILIO_AUTH_TOKEN && secrets.TWILIO_PHONE_NUMBER
        ? {
            twilio: {
              accountSid: secrets.TWILIO_ACCOUNT_SID,
              authToken: secrets.TWILIO_AUTH_TOKEN,
              phoneNumber: secrets.TWILIO_PHONE_NUMBER,
            },
          }
        : undefined,
    siwn: {
      ...siwn,
      apiKey: secrets.FASTNEAR_API_KEY,
    },
  };

  return { authConfig, apiKeyHeaders: variables.apiKeyHeaders ?? ["x-api-key"] };
}

export type { AuthServices } from "./auth-export";

export default createPlugin({
  variables: authVariablesSchema,

  secrets: authSecretsSchema,

  context: z.object({
    reqHeaders: z.record(z.string(), z.string()).optional(),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const driver = yield* Effect.acquireRelease(
        Effect.promise(() => createDatabaseDriver(config.secrets.AUTH_DATABASE_URL)),
        (driver) => Effect.promise(() => driver.close()),
      );

      const migrations = yield* Effect.promise(() => import("virtual:drizzle-migrations.sql"));
      yield* Effect.promise(() => migrate(driver.db, migrations.default));
      console.log("[Auth] Migrations applied");

      const { authConfig, apiKeyHeaders } = normalizeAuthConfig(config.variables, config.secrets);

      const auth = createAuthInstance(authConfig, driver.db);

      console.log("[Auth] Better Auth instance created");

      return {
        auth,
        db: driver.db,
        driver,
        handler: (req: Request) => auth.handler(req),
        apiKeyHeaders,
      };
    }).pipe(Effect.mapError((e) => toError(e))),

  shutdown: () =>
    Effect.sync(() => {
      console.log("[Auth] Shutdown");
    }),

  createRouter: (services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      const headers = createHeaders(context.reqHeaders);
      const session = await services.auth.api.getSession({ headers });

      if (!session?.user) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
        });
      }

      return next({
        context: {
          userId: session.user.id,
          user: session.user,
          reqHeaders: context.reqHeaders,
        },
      });
    });

    return {
      health: builder.health.handler(async () => ({
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      })),

      getSession: builder.getSession.handler(async ({ context }) => {
        const headers = createHeaders(context.reqHeaders);
        const session = await services.auth.api.getSession({ headers });
        const s = session?.session ?? null;
        const u = session?.user ?? null;
        return {
          session: s
            ? {
                id: s.id,
                token: s.token,
                userId: s.userId,
                expiresAt: s.expiresAt,
                activeOrganizationId: getActiveOrganizationId(s),
              }
            : null,
          user: u
            ? {
                id: u.id,
                name: u.name,
                email: u.email,
                emailVerified: u.emailVerified,
                image: u.image ?? null,
                role: u.role ?? null,
                isAnonymous: (u as any).isAnonymous ?? null,
              }
            : null,
        };
      }),

      getContext: builder.getContext.handler(async ({ context }) => {
        const headers = createHeaders(context.reqHeaders);
        const apiKeyHeaderNames = services.apiKeyHeaders;

        let apiKeyValue: string | null = null;
        for (const headerName of apiKeyHeaderNames) {
          const value = headers.get(headerName.toLowerCase())?.trim();
          if (value) {
            apiKeyValue = value;
            break;
          }
        }

        if (!apiKeyValue) {
          const authHeader = headers.get("authorization");
          const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
          if (bearerToken && (bearerToken.startsWith("api_") || bearerToken.startsWith("org_"))) {
            apiKeyValue = bearerToken;
          }
        }

        let user: typeof schema.user.$inferSelect | null = null;
        let authMethod: "session" | "apiKey" | "anonymous" | "none" = "none";
        let principal:
          | { type: "user"; userId: string; user: NonNullable<typeof schema.user.$inferSelect> }
          | { type: "organization"; organizationId: string }
          | null = null;
        let apiKeyInfo: {
          id: string;
          name: string | null;
          permissions: Record<string, string[]> | null;
        } | null = null;
        let resolvedOrganizationId: string | null = null;
        let session: {
          session: {
            id: string;
            token: string;
            userId: string;
            expiresAt: Date;
            activeOrganizationId: string | null;
          } | null;
          user: unknown;
        } | null = null;

        if (apiKeyValue) {
          let apiKeyResolved = false;

          for (const configId of API_KEY_CONFIG_IDS) {
            if (apiKeyResolved) break;

            const keyResult = await safeAuthApi(() =>
              services.auth.api.verifyApiKey({
                headers,
                body: { key: apiKeyValue, configId },
              }),
            );

            if (!keyResult.valid || !keyResult.key) continue;

            apiKeyResolved = true;
            authMethod = "apiKey";

            const key = keyResult.key;
            const parsedPermissions =
              typeof key.permissions === "string"
                ? (tryJsonParse<Record<string, string[]>>(key.permissions) ?? null)
                : (key.permissions ?? null);

            apiKeyInfo = {
              id: key.id,
              name: key.name ?? null,
              permissions: parsedPermissions,
            };

            if (key.configId === "user-keys") {
              const dbUser = await services.db.query.user.findFirst({
                where: eq(schema.user.id, key.referenceId),
              });

              if (dbUser) {
                user = dbUser;
                principal = {
                  type: "user",
                  userId: key.referenceId,
                  user: dbUser,
                };
              }
            } else if (key.configId === "org-keys") {
              principal = { type: "organization", organizationId: key.referenceId };
              resolvedOrganizationId = key.referenceId;
            }

            break;
          }

          if (!apiKeyResolved) {
            authMethod = "none";
          }
        }

        // Only fall back to session auth if no API key was attempted
        if (!apiKeyValue && !principal) {
          const rawSession = await services.auth.api.getSession({ headers });
          const rawUser = rawSession?.user ?? null;
          session = rawSession
            ? {
                session: rawSession.session
                  ? {
                      ...rawSession.session,
                      activeOrganizationId: getActiveOrganizationId(rawSession.session),
                    }
                  : null,
                user: rawSession.user,
              }
            : null;

          if (rawUser) {
            const dbUser = await services.db.query.user.findFirst({
              where: eq(schema.user.id, rawUser.id),
            });

            user = dbUser ?? null;
            authMethod = "session";

            if (user) {
              principal = {
                type: "user",
                userId: user.id,
                user: user,
              };
            }
          }
        }

        const isAuthenticated = !!principal;

        let nearCapabilities = {
          primaryAccountId: null as string | null,
          linkedAccounts: [] as Array<{
            accountId: string;
            network: string;
            publicKey: string;
            isPrimary: boolean;
          }>,
          hasNearAccount: false,
        };

        if (user?.id) {
          const nearAccounts = await services.db.query.nearAccount.findMany({
            where: eq(schema.nearAccount.userId, user.id),
          });

          if (nearAccounts.length > 0) {
            const linkedAccounts = nearAccounts.map((acc) => ({
              accountId: acc.accountId,
              network: acc.network,
              publicKey: acc.publicKey,
              isPrimary: acc.isPrimary ?? false,
            }));

            const primary = nearAccounts.find((acc) => acc.isPrimary) ?? nearAccounts[0];

            nearCapabilities = {
              primaryAccountId: primary?.accountId ?? null,
              linkedAccounts,
              hasNearAccount: true,
            };
          }
        }

        let organizationContext = {
          activeOrganizationId: null as string | null,
          organization: null as {
            id: string;
            name: string;
            slug: string;
            logo: string | null | undefined;
            metadata?: Record<string, unknown>;
          } | null,
          member: null as { id: string; role: string } | null,
          isPersonal: false,
          hasOrganization: false,
        };

        const organizations: Array<{ id: string; role: string; name?: string; slug?: string }> = [];

        if (principal?.type === "organization" && resolvedOrganizationId) {
          const org = await services.db.query.organization.findFirst({
            where: eq(schema.organization.id, resolvedOrganizationId),
          });

          if (org) {
            organizationContext = {
              activeOrganizationId: resolvedOrganizationId,
              organization: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                logo: org.logo,
                metadata: tryJsonParse<Record<string, unknown>>(org.metadata),
              },
              member: null,
              isPersonal: false,
              hasOrganization: true,
            };
          }
        } else if (user?.id) {
          const memberships = await services.db.query.member.findMany({
            where: eq(schema.member.userId, user.id),
            with: { organization: true },
          });

          for (const m of memberships) {
            if (m.organization) {
              organizations.push({
                id: m.organization.id,
                role: m.role,
                name: m.organization.name,
                slug: m.organization.slug,
              });
            }
          }

          const activeOrgId = session?.session?.activeOrganizationId;

          if (activeOrgId) {
            const activeMembership = memberships.find((m) => m.organization?.id === activeOrgId);

            if (activeMembership?.organization) {
              const org = activeMembership.organization;
              organizationContext = {
                activeOrganizationId: activeOrgId,
                organization: {
                  id: org.id,
                  name: org.name,
                  slug: org.slug,
                  logo: org.logo,
                  metadata: tryJsonParse<Record<string, unknown>>(org.metadata),
                },
                member: {
                  id: activeMembership.id,
                  role: activeMembership.role,
                },
                isPersonal: org.slug === user.id,
                hasOrganization: true,
              };
            }
          }
        }

        const serializedPrincipal = principal
          ? principal.type === "user"
            ? {
                type: "user" as const,
                userId: principal.userId,
                user: {
                  id: principal.user.id,
                  name: principal.user.name,
                  email: principal.user.email,
                  emailVerified: principal.user.emailVerified ?? false,
                  image: principal.user.image ?? null,
                  role: principal.user.role ?? null,
                  isAnonymous: (principal.user as any).isAnonymous ?? null,
                },
              }
            : principal.type === "organization"
              ? {
                  type: "organization" as const,
                  organizationId: principal.organizationId,
                }
              : null
          : null;

        return {
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image ?? null,
                role: user.role ?? null,
                isAnonymous: (user as any).isAnonymous ?? null,
              }
            : null,
          userId: user?.id ?? null,
          isAuthenticated,
          authMethod,
          principal: serializedPrincipal,
          apiKey: apiKeyInfo,
          near: nearCapabilities,
          organization: organizationContext,
          organizations: organizations.length > 0 ? organizations : undefined,
        };
      }),

      listOrganizations: builder.listOrganizations.use(requireAuth).handler(async ({ context }) => {
        const memberships = await services.db.query.member.findMany({
          where: eq(schema.member.userId, context.userId),
          with: { organization: true },
        });
        return memberships
          .filter((m) => m.organization != null)
          .map((m) => ({
            id: m.organization!.id,
            name: m.organization!.name,
            slug: m.organization!.slug,
            logo: m.organization!.logo,
            metadata: tryJsonParse<Record<string, unknown>>(m.organization!.metadata),
            createdAt: m.organization!.createdAt,
            role: m.role,
          }));
      }),

      createOrganization: builder.createOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeAuthApi(() =>
            services.auth.api.createOrganization({
              headers: createHeaders(context.reqHeaders),
              body: {
                name: input.name,
                slug: input.slug,
                logo: input.logo,
                metadata: input.metadata,
              },
            }),
          );
          return {
            id: result.id,
            name: result.name,
            slug: result.slug,
            logo: result.logo ?? null,
            metadata:
              typeof result.metadata === "string"
                ? tryJsonParse<Record<string, unknown>>(result.metadata)
                : result.metadata,
            createdAt:
              result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt),
          };
        }),

      setActiveOrganization: builder.setActiveOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          await safeAuthApi(() =>
            services.auth.api.setActiveOrganization({
              headers: createHeaders(context.reqHeaders),
              body: { organizationId: input.organizationId },
            }),
          );
          return { success: true };
        }),

      leaveOrganization: builder.leaveOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const org = await services.db.query.organization.findFirst({
            where: eq(schema.organization.id, input.id),
          });
          if (!org) throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
          if (org.slug === context.userId) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Cannot leave your personal organization",
            });
          }

          const membership = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.userId, context.userId),
              eq(schema.member.organizationId, input.id),
            ),
          });
          if (!membership) {
            throw new ORPCError("NOT_FOUND", {
              message: "You are not a member of this organization",
            });
          }

          if (membership.role === "owner") {
            const owners = await services.db.query.member.findMany({
              where: and(
                eq(schema.member.organizationId, input.id),
                eq(schema.member.role, "owner"),
              ),
            });
            if (owners.length <= 1) {
              throw new ORPCError("BAD_REQUEST", {
                message: "Transfer ownership before leaving — you are the last owner",
              });
            }
          }

          await services.db.delete(schema.member).where(eq(schema.member.id, membership.id));
          return { success: true };
        }),

      inviteMember: builder.inviteMember.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.createInvitation({
            headers: createHeaders(context.reqHeaders),
            body: {
              email: input.email,
              role: input.role,
              organizationId: input.organizationId,
              resend: input.resend,
            },
          }),
        );
        return {
          id: result.id,
          organizationId: result.organizationId,
          email: result.email,
          role: result.role,
          status: result.status,
          expiresAt: result.expiresAt,
          inviterId: result.inviterId,
        };
      }),

      getInvitation: builder.getInvitation.handler(async ({ input }) => {
        const invitation = await services.db.query.invitation.findFirst({
          where: eq(schema.invitation.id, input.id),
          with: { organization: true },
        });
        if (!invitation) return null;
        return {
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          inviterId: invitation.inviterId,
          organization: invitation.organization
            ? {
                id: invitation.organization.id,
                name: invitation.organization.name,
                slug: invitation.organization.slug,
                logo: invitation.organization.logo,
                metadata: tryJsonParse<Record<string, unknown>>(invitation.organization.metadata),
              }
            : null,
        };
      }),

      getOrganization: builder.getOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const org = await services.db.query.organization.findFirst({
            where: eq(schema.organization.id, input.id),
          });
          if (!org) {
            throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
          }
          const membership = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.userId, context.userId),
              eq(schema.member.organizationId, input.id),
            ),
          });
          if (!membership) {
            throw new ORPCError("FORBIDDEN", { message: "Not a member of this organization" });
          }
          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            metadata: tryJsonParse(org.metadata),
            createdAt: org.createdAt,
          };
        }),

      updateOrganization: builder.updateOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const membership = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.userId, context.userId),
              eq(schema.member.organizationId, input.id),
            ),
          });
          if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
            throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
          }

          const [updated] = await services.db
            .update(schema.organization)
            .set({
              name: input.name,
              slug: input.slug,
              logo: input.logo,
              metadata:
                input.metadata !== undefined
                  ? typeof input.metadata === "string"
                    ? input.metadata
                    : JSON.stringify(input.metadata)
                  : undefined,
            })
            .where(eq(schema.organization.id, input.id))
            .returning();

          if (!updated) {
            throw new ORPCError("NOT_FOUND", { message: "Organization not found" });
          }

          return {
            id: updated.id,
            name: updated.name,
            slug: updated.slug,
            logo: updated.logo,
            metadata: tryJsonParse<Record<string, unknown>>(updated.metadata),
          };
        }),

      deleteOrganization: builder.deleteOrganization
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const membership = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.userId, context.userId),
              eq(schema.member.organizationId, input.id),
            ),
          });
          if (!membership || membership.role !== "owner") {
            throw new ORPCError("FORBIDDEN", {
              message: "Only the owner can delete the organization",
            });
          }

          const org = await services.db.query.organization.findFirst({
            where: eq(schema.organization.id, input.id),
          });
          if (org?.slug === context.userId) {
            throw new ORPCError("BAD_REQUEST", { message: "Cannot delete personal organization" });
          }

          await services.db.delete(schema.organization).where(eq(schema.organization.id, input.id));
          return { success: true };
        }),

      getActiveMember: builder.getActiveMember
        .use(requireAuth)
        .handler(async ({ context, input }) => {
          const headers = createHeaders(context.reqHeaders);
          const member = await safeAuthApi(() =>
            services.auth.api.getActiveMember({
              headers,
              query: input?.organizationId ? { organizationId: input.organizationId } : undefined,
            }),
          );

          if (!member) {
            return { id: null, role: null, organizationId: null };
          }

          return {
            id: member.id,
            role: member.role,
            organizationId: member.organizationId ?? null,
          };
        }),

      listApiKeys: builder.listApiKeys.use(requireAuth).handler(async ({ context, input }) => {
        const query: Record<string, string | number> = {};
        if (input?.organizationId) query.organizationId = input.organizationId;
        if (input?.limit !== undefined) query.limit = input.limit;
        if (input?.offset !== undefined) query.offset = input.offset;
        if (input?.sortBy) query.sortBy = input.sortBy;
        if (input?.sortDirection) query.sortDirection = input.sortDirection;

        const result = await safeAuthApi(() =>
          services.auth.api.listApiKeys({
            headers: createHeaders(context.reqHeaders),
            query: Object.keys(query).length > 0 ? query : undefined,
          }),
        );
        return result.apiKeys ?? [];
      }),

      createApiKey: builder.createApiKey.use(requireAuth).handler(async ({ input, context }) => {
        const configId = input.configId ?? (input.organizationId ? "org-keys" : "user-keys");
        const result = await safeAuthApi(() =>
          services.auth.api.createApiKey({
            body: {
              userId: context.userId,
              configId,
              name: input.name,
              prefix: input.prefix,
              expiresIn: input.expiresIn,
              permissions: input.permissions,
              metadata: input.metadata,
              organizationId: input.organizationId,
              rateLimitEnabled: input.rateLimit?.enabled,
              rateLimitMax: input.rateLimit?.max,
              rateLimitTimeWindow: input.rateLimit?.timeWindow,
            },
          }),
        );
        return result;
      }),

      updateApiKey: builder.updateApiKey.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.updateApiKey({
            body: {
              userId: context.userId,
              keyId: input.id,
              name: input.name,
              enabled: input.enabled,
              permissions: input.permissions,
              metadata: input.metadata,
              expiresIn: input.expiresIn,
              rateLimitEnabled: input.rateLimit?.enabled,
              rateLimitMax: input.rateLimit?.max,
              rateLimitTimeWindow: input.rateLimit?.timeWindow,
            },
          }),
        );
        return result;
      }),

      deleteApiKey: builder.deleteApiKey.use(requireAuth).handler(async ({ input, context }) => {
        try {
          await safeAuthApi(() =>
            services.auth.api.deleteApiKey({
              headers: createHeaders(context.reqHeaders),
              body: { keyId: input.id },
            }),
          );
          return { success: true };
        } catch {
          throw new ORPCError("NOT_FOUND", { message: "API key not found" });
        }
      }),

      verifyApiKey: builder.verifyApiKey.handler(async ({ input, context }) => {
        if (input.configId) {
          const result = await safeAuthApi(() =>
            services.auth.api.verifyApiKey({
              headers: createHeaders(context.reqHeaders),
              body: {
                key: input.key,
                configId: input.configId,
                permissions: input.permissions,
              },
            }),
          );
          return {
            valid: result.valid,
            error: result.error
              ? {
                  code: result.error.code ?? "UNKNOWN",
                  message:
                    typeof result.error.message === "string" ? result.error.message : undefined,
                }
              : null,
            key: result.key ? { ...result.key, permissions: result.key.permissions ?? null } : null,
          };
        }

        for (const configId of API_KEY_CONFIG_IDS) {
          const result = await safeAuthApi(() =>
            services.auth.api.verifyApiKey({
              headers: createHeaders(context.reqHeaders),
              body: { key: input.key, configId, permissions: input.permissions },
            }),
          );
          if (result.valid) {
            return {
              valid: true,
              error: null,
              key: result.key
                ? { ...result.key, permissions: result.key.permissions ?? null }
                : null,
            };
          }
        }
        return {
          valid: false,
          error: { code: "KEY_NOT_FOUND", message: "Invalid API key" },
          key: null,
        };
      }),

      listMembers: builder.listMembers.use(requireAuth).handler(async ({ input }) => {
        const members = await services.db.query.member.findMany({
          where: eq(schema.member.organizationId, input.organizationId),
          with: { user: true },
        });
        return members.map((m) => ({
          id: m.id,
          userId: m.userId,
          organizationId: m.organizationId,
          role: m.role,
          createdAt: m.createdAt,
          user: m.user
            ? {
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
                image: m.user.image,
              }
            : null,
        }));
      }),

      removeMember: builder.removeMember.use(requireAuth).handler(async ({ input, context }) => {
        const myMembership = await services.db.query.member.findFirst({
          where: and(
            eq(schema.member.userId, context.userId),
            eq(schema.member.organizationId, input.organizationId),
          ),
        });
        if (!myMembership || (myMembership.role !== "owner" && myMembership.role !== "admin")) {
          throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
        }

        const targetMember = await services.db.query.member.findFirst({
          where: and(
            eq(schema.member.id, input.id),
            eq(schema.member.organizationId, input.organizationId),
          ),
        });
        if (!targetMember) {
          throw new ORPCError("NOT_FOUND", { message: "Member not found" });
        }

        if (targetMember.userId === context.userId && targetMember.role === "owner") {
          const otherOwners = await services.db.query.member.findMany({
            where: and(
              eq(schema.member.organizationId, input.organizationId),
              eq(schema.member.role, "owner"),
            ),
          });
          if (otherOwners.length <= 1) {
            throw new ORPCError("BAD_REQUEST", { message: "Cannot remove the last owner" });
          }
        }

        if (targetMember.role !== "member" && myMembership.role !== "owner") {
          throw new ORPCError("FORBIDDEN", { message: "Only owners can remove admins" });
        }

        await services.db.delete(schema.member).where(eq(schema.member.id, input.id));
        return { success: true };
      }),

      updateMemberRole: builder.updateMemberRole
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const myMembership = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.userId, context.userId),
              eq(schema.member.organizationId, input.organizationId),
            ),
          });
          if (!myMembership || (myMembership.role !== "owner" && myMembership.role !== "admin")) {
            throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
          }

          const targetMember = await services.db.query.member.findFirst({
            where: and(
              eq(schema.member.id, input.id),
              eq(schema.member.organizationId, input.organizationId),
            ),
            with: { user: true },
          });
          if (!targetMember) {
            throw new ORPCError("NOT_FOUND", { message: "Member not found" });
          }

          if (input.role === "owner" && myMembership.role !== "owner") {
            throw new ORPCError("FORBIDDEN", { message: "Only owners can assign owner role" });
          }

          if (targetMember.role === "owner" && input.role !== "owner") {
            const otherOwners = await services.db.query.member.findMany({
              where: and(
                eq(schema.member.organizationId, input.organizationId),
                eq(schema.member.role, "owner"),
              ),
            });
            if (otherOwners.length <= 1) {
              throw new ORPCError("BAD_REQUEST", { message: "Cannot demote the last owner" });
            }
          }

          await services.db
            .update(schema.member)
            .set({ role: input.role })
            .where(eq(schema.member.id, input.id));

          const updated = await services.db.query.member.findFirst({
            where: eq(schema.member.id, input.id),
            with: { user: true },
          });

          return {
            id: updated!.id,
            userId: updated!.userId,
            organizationId: updated!.organizationId,
            role: updated!.role,
            createdAt: updated!.createdAt,
            user: updated!.user
              ? {
                  id: updated!.user.id,
                  name: updated!.user.name,
                  email: updated!.user.email,
                  image: updated!.user.image,
                }
              : null,
          };
        }),

      listInvitations: builder.listInvitations.use(requireAuth).handler(async ({ input }) => {
        return await services.db.query.invitation.findMany({
          where: eq(schema.invitation.organizationId, input.organizationId),
        });
      }),

      cancelInvitation: builder.cancelInvitation.use(requireAuth).handler(async ({ input }) => {
        const invitation = await services.db.query.invitation.findFirst({
          where: eq(schema.invitation.id, input.id),
        });

        if (!invitation) {
          throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
        }

        await services.db.delete(schema.invitation).where(eq(schema.invitation.id, input.id));
        return { success: true };
      }),

      resendInvitation: builder.resendInvitation
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const invitation = await services.db.query.invitation.findFirst({
            where: eq(schema.invitation.id, input.id),
          });

          if (!invitation) {
            throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
          }

          const headers = createHeaders(context.reqHeaders);

          const roleParse = z
            .enum(["member", "owner", "admin"])
            .safeParse(invitation.role ?? "member");
          if (!roleParse.success) {
            throw new ORPCError("BAD_REQUEST", { message: "Invalid invitation role" });
          }

          await safeAuthApi(() =>
            services.auth.api.createInvitation({
              headers,
              body: {
                email: invitation.email,
                role: roleParse.data,
                organizationId: invitation.organizationId,
                resend: true,
              },
            }),
          );

          return { sent: true };
        }),

      acceptInvitation: builder.acceptInvitation
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          await safeAuthApi(() =>
            services.auth.api.acceptInvitation({
              headers: createHeaders(context.reqHeaders),
              body: { invitationId: input.id },
            }),
          );
          return { success: true };
        }),

      rejectInvitation: builder.rejectInvitation
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          await safeAuthApi(() =>
            services.auth.api.rejectInvitation({
              headers: createHeaders(context.reqHeaders),
              body: { invitationId: input.id },
            }),
          );
          return { success: true };
        }),

      // ── NEAR SIWN Endpoints ─────────────────────────────────────────────

      nearNonce: builder.nearNonce.handler(async ({ input }) => {
        const result = await safeCall<InferOutput<"nearNonce">>(() =>
          services.auth.api.getSiwnNonce({
            body: { accountId: input.accountId, networkId: input.networkId },
          }),
        );
        return result;
      }),

      nearVerify: builder.nearVerify.handler(async ({ input }) => {
        const result = await safeCall<InferOutput<"nearVerify">>(() =>
          services.auth.api.verifySiwnMessage({
            body: {
              signedMessage: input.signedMessage,
              message: input.message,
              recipient: input.recipient,
              nonce: input.nonce,
              accountId: input.accountId,
            },
          }),
        );
        return result;
      }),

      nearProfile: builder.nearProfile.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeCall<InferOutput<"nearProfile">>(() =>
          services.auth.api.getSiwnProfile({
            headers: createHeaders(context.reqHeaders),
            body: { accountId: input.accountId },
          }),
        );
        return result;
      }),

      nearLinkAccount: builder.nearLinkAccount
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeCall<InferOutput<"nearLinkAccount">>(() =>
            services.auth.api.linkNearAccount({
              headers: createHeaders(context.reqHeaders),
              body: {
                signedMessage: input.signedMessage,
                message: input.message,
                recipient: input.recipient,
                nonce: input.nonce,
                accountId: input.accountId,
              },
            }),
          );
          return result;
        }),

      nearUnlinkAccount: builder.nearUnlinkAccount
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeCall<InferOutput<"nearUnlinkAccount">>(() =>
            services.auth.api.unlinkNearAccount({
              headers: createHeaders(context.reqHeaders),
              body: { accountId: input.accountId, network: input.network },
            }),
          );
          return result;
        }),

      nearListAccounts: builder.nearListAccounts.use(requireAuth).handler(async ({ context }) => {
        const result = await safeCall<InferOutput<"nearListAccounts">>(() =>
          services.auth.api.listNearAccounts({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return result;
      }),

      nearRelay: builder.nearRelay.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeCall<InferOutput<"nearRelay">>(() =>
          services.auth.api.relayNearTransaction({
            headers: createHeaders(context.reqHeaders),
            body: { payload: input.payload },
          }),
        );
        return result;
      }),

      nearRelayStatus: builder.nearRelayStatus
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeCall<InferOutput<"nearRelayStatus">>(() =>
            services.auth.api.getRelayStatus({
              headers: createHeaders(context.reqHeaders),
              params: { txHash: input.txHash },
            }),
          );
          return result;
        }),

      nearRelayerInfo: builder.nearRelayerInfo
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeCall<InferOutput<"nearRelayerInfo">>(() =>
            services.auth.api.getRelayerInfo({
              headers: createHeaders(context.reqHeaders),
              body: input ?? {},
            }),
          );
          return result;
        }),

      nearRelayHistory: builder.nearRelayHistory.use(requireAuth).handler(async ({ context }) => {
        const result = await safeCall<InferOutput<"nearRelayHistory">>(() =>
          services.auth.api.getRelayHistory({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return result;
      }),

      nearView: builder.nearView.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeCall<InferOutput<"nearView">>(() =>
          services.auth.api.viewContract({
            headers: createHeaders(context.reqHeaders),
            body: { contractId: input.contractId, methodName: input.methodName, args: input.args },
          }),
        );
        return result;
      }),

      nearCheckSubAccountAvailability: builder.nearCheckSubAccountAvailability.handler(
        async ({ input }) => {
          const result = await safeCall<InferOutput<"nearCheckSubAccountAvailability">>(() =>
            services.auth.api.checkSubAccountAvailability({
              body: { subAccountId: input.subAccountId, network: input.network },
            }),
          );
          return result;
        },
      ),

      nearCreateSubAccount: builder.nearCreateSubAccount
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeCall<InferOutput<"nearCreateSubAccount">>(() =>
            services.auth.api.createSubAccount({
              headers: createHeaders(context.reqHeaders),
              body: {
                subAccountId: input.subAccountId,
                publicKey: input.publicKey,
                network: input.network,
              },
            }),
          );
          return result;
        }),
    };
  },
});
