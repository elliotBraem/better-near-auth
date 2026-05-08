import { and, eq } from "drizzle-orm";
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { AuthServices } from "./auth-export";
import { createAuthInstance } from "./auth-instance";
import { contract } from "./contract";
import { createDatabaseDriver } from "./db/driver";
import { migrate } from "./db/migrator";
import * as schema from "./db/schema";

function tryJsonParse(value: string | null | undefined): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function createHeaders(reqHeaders?: Record<string, string>): Headers {
  return new Headers(Object.entries(reqHeaders ?? {}) as [string, string][]);
}

interface UserWithAnonymous {
  isAnonymous?: boolean | null;
}

function handleAuthApiError(error: unknown): never {
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
    throw new ORPCError(statusMap[apiError.status] || "INTERNAL_SERVER_ERROR", {
      message: apiError.message || "Auth API error",
    });
  }
  throw error;
}

async function safeAuthApi<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    handleAuthApiError(error);
    throw new Error("unreachable");
  }
}

export type { AuthServices } from "./auth-export";

export default createPlugin({
  variables: z.object({
    account: z.string(),
    hostUrl: z.string(),
    uiUrl: z.string().optional(),
    githubClientId: z.string().optional(),
    githubClientSecret: z.string().optional(),
  }),

  secrets: z.object({
    AUTH_DATABASE_URL: z.string().default("pglite:.bos/auth/:memory:"),
    BETTER_AUTH_SECRET: z.string(),
  }),

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

      const auth = createAuthInstance(
        {
          account: config.variables.account,
          hostUrl: config.variables.hostUrl,
          uiUrl: config.variables.uiUrl,
          githubClientId: config.variables.githubClientId,
          githubClientSecret: config.variables.githubClientSecret,
        },
        driver.db,
      );

      console.log("[Auth] Better Auth instance created");

      return {
        auth,
        db: driver.db,
        driver,
        handler: (req: Request) => auth.handler(req),
      } satisfies AuthServices;
    }),

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
                activeOrganizationId: s.activeOrganizationId ?? null,
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
                isAnonymous: (u as UserWithAnonymous).isAnonymous ?? null,
              }
            : null,
        };
      }),

      getContext: builder.getContext.handler(async ({ context }) => {
        const headers = createHeaders(context.reqHeaders);
        const session = await services.auth.api.getSession({ headers });
        const user = session?.user ?? null;

        const isAuthenticated = !!user;
        const authMethod = isAuthenticated ? ("session" as const) : ("none" as const);

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

        if (user?.id) {
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
            const activeMembership = memberships.find(
              (m) => m.organization?.id === activeOrgId,
            );

            if (activeMembership?.organization) {
              const org = activeMembership.organization;
              organizationContext = {
                activeOrganizationId: activeOrgId,
                organization: {
                  id: org.id,
                  name: org.name,
                  slug: org.slug,
                  logo: org.logo,
                  metadata: tryJsonParse(org.metadata) as Record<string, unknown> | undefined,
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

        return {
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image ?? null,
                role: user.role ?? null,
                isAnonymous: (user as UserWithAnonymous).isAnonymous ?? null,
              }
            : null,
          userId: user?.id ?? null,
          isAuthenticated,
          authMethod,
          near: nearCapabilities,
          organization: organizationContext,
          organizations: organizations.length > 0 ? organizations : undefined,
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
            metadata: tryJsonParse(updated.metadata) as Record<string, unknown> | undefined,
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
            throw new ORPCError("FORBIDDEN", { message: "Only the owner can delete the organization" });
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

          const m = member as { id: string; role: string; organizationId?: string };

          return {
            id: m.id,
            role: m.role,
            organizationId: m.organizationId ?? null,
          };
        }),

      listApiKeys: builder.listApiKeys.use(requireAuth).handler(async ({ context, input }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listApiKeys({
            headers: createHeaders(context.reqHeaders),
            query: input?.organizationId ? { organizationId: input.organizationId } : undefined,
          }),
        );
        return (
          (
            result as {
              apiKeys?: Array<{
                id: string;
                name: string | null;
                prefix: string | null;
                start: string | null;
                expiresAt: Date | null;
                createdAt: Date;
                updatedAt: Date;
                metadata: unknown;
                permissions: unknown;
              }>;
            }
          ).apiKeys ?? []
        );
      }),

      createApiKey: builder.createApiKey.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.createApiKey({
            headers: createHeaders(context.reqHeaders),
            body: {
              ...input,
              permissions: input.permissions,
            },
          }),
        );
        const r = result as {
          id: string;
          name: string | null;
          prefix: string | null;
          start: string | null;
          expiresAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
          metadata: unknown;
          permissions: unknown;
          key: string;
        };
        return r;
      }),

      updateApiKey: builder.updateApiKey.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.updateApiKey({
            headers: createHeaders(context.reqHeaders),
            body: {
              keyId: input.id,
              name: input.name,
              permissions: input.permissions,
              metadata: input.metadata,
              expiresAt: input.expiresAt,
            },
          }),
        );
        const r = result as {
          id: string;
          name: string | null;
          prefix: string | null;
          start: string | null;
          expiresAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
          metadata: unknown;
          permissions: unknown;
        };
        return r;
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

          await safeAuthApi(() =>
            services.auth.api.createInvitation({
              headers,
              body: {
                email: invitation.email,
                role: (invitation.role ?? "member") as "member" | "owner" | "admin",
                organizationId: invitation.organizationId,
                resend: true,
              },
            }),
          );

          return { sent: true };
        }),

      acceptInvitation: builder.acceptInvitation.use(requireAuth).handler(async ({ input, context }) => {
        await safeAuthApi(() =>
          services.auth.api.acceptInvitation({
            headers: createHeaders(context.reqHeaders),
            body: { invitationId: input.id },
          }),
        );
        return { success: true };
      }),

      rejectInvitation: builder.rejectInvitation.use(requireAuth).handler(async ({ input, context }) => {
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
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.getSiwnNonce({
            body: { accountId: input.accountId, networkId: input.networkId },
          }),
        );
        return result as { nonce: string };
      }),

      nearVerify: builder.nearVerify.handler(async ({ input }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
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
        return result as {
          token: string;
          success: true;
          user: { id: string; accountId: string; network: "mainnet" | "testnet" };
        };
      }),

      nearProfile: builder.nearProfile.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.getSiwnProfile({
            headers: createHeaders(context.reqHeaders),
            body: { accountId: input.accountId },
          }),
        );
        return result as {
          name?: string;
          description?: string;
          image?: { url?: string; ipfs_cid?: string };
          backgroundImage?: { url?: string; ipfs_cid?: string };
          linktree?: Record<string, string>;
        } | null;
      }),

      nearLinkAccount: builder.nearLinkAccount
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeAuthApi(() =>
            // @ts-expect-error better-near-auth plugin API types are not augmented
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
          return result as {
            success: boolean;
            accountId: string;
            network: string;
            message: string;
          };
        }),

      nearUnlinkAccount: builder.nearUnlinkAccount
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeAuthApi(() =>
            // @ts-expect-error better-near-auth plugin API types are not augmented
            services.auth.api.unlinkNearAccount({
              headers: createHeaders(context.reqHeaders),
              body: { accountId: input.accountId, network: input.network },
            }),
          );
          return result as {
            success: boolean;
            accountId: string;
            network: string;
            message: string;
          };
        }),

      nearListAccounts: builder.nearListAccounts.use(requireAuth).handler(async ({ context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.listNearAccounts({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return result as {
          accounts: Array<{
            id: string;
            userId: string;
            accountId: string;
            network: string;
            publicKey: string;
            isPrimary: boolean;
            createdAt: Date;
          }>;
        };
      }),

      nearRelay: builder.nearRelay.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.relayNearTransaction({
            headers: createHeaders(context.reqHeaders),
            body: { payload: input.payload },
          }),
        );
        return result as { txHash: string; status: "pending" | "completed" | "failed" };
      }),

      nearRelayStatus: builder.nearRelayStatus
        .use(requireAuth)
        .handler(async ({ input, context }) => {
          const result = await safeAuthApi(() =>
            // @ts-expect-error better-near-auth plugin API types are not augmented
            services.auth.api.getRelayStatus({
              headers: createHeaders(context.reqHeaders),
              params: { txHash: input.txHash },
            }),
          );
          return result as {
            status: "pending" | "completed" | "failed";
            gasUsed?: string;
            outcome?: unknown;
          };
        }),

      nearRelayerInfo: builder.nearRelayerInfo.use(requireAuth).handler(async ({ context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.getRelayerInfo({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return result as {
          enabled: boolean;
          accountId?: string;
          mode?: "ephemeral" | "explicit";
          network?: "mainnet" | "testnet";
          balance?: string;
          available?: string;
          staked?: string;
          storageUsage?: string;
          storageBytes?: number;
          hasContract?: boolean;
          hasKey?: boolean;
          createdAt?: string;
          lastUsedAt?: string;
        };
      }),

      nearRelayHistory: builder.nearRelayHistory.use(requireAuth).handler(async ({ context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.getRelayHistory({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return result as {
          transactions: Array<{
            id: string;
            userId: string;
            txHash: string;
            senderId: string;
            receiverId: string;
            network: string;
            status: string;
            gasUsed?: string;
            createdAt: string;
            updatedAt?: string;
          }>;
        };
      }),

      nearView: builder.nearView.use(requireAuth).handler(async ({ input, context }) => {
        const result = await safeAuthApi(() =>
          // @ts-expect-error better-near-auth plugin API types are not augmented
          services.auth.api.viewContract({
            headers: createHeaders(context.reqHeaders),
            body: { contractId: input.contractId, methodName: input.methodName, args: input.args },
          }),
        );
        return result as { result: unknown };
      }),
    };
  },
});
