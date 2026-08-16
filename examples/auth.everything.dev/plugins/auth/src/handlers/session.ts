import { eq } from "drizzle-orm";
import { API_KEY_CONFIG_IDS } from "../config-schemas";
import * as schema from "../db/schema";
import type { PluginServices } from "../service-types";
import { createHeaders, getActiveOrganizationId, tryJsonParse } from "../utils";

export function createSessionHandlers(services: PluginServices, builder: any) {
  return {
    health: builder.health.handler(async () => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    })),

    getSession: builder.getSession.handler(async ({ context }: { context: any }) => {
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

    getContext: builder.getContext.handler(async ({ context }: { context: any }) => {
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

        const verifyHeaders = new Headers(headers);
        for (const headerName of apiKeyHeaderNames) {
          verifyHeaders.delete(headerName.toLowerCase());
        }
        verifyHeaders.delete("authorization");

        for (const configId of API_KEY_CONFIG_IDS) {
          if (apiKeyResolved) break;

          let keyResult: any;
          try {
            keyResult = await services.auth.api.verifyApiKey({
              headers: verifyHeaders,
              body: { key: apiKeyValue, configId },
            });
          } catch {
            continue;
          }

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
          user = rawUser as typeof schema.user.$inferSelect;
          authMethod = "session";
          principal = {
            type: "user",
            userId: rawUser.id,
            user: rawUser as typeof schema.user.$inferSelect,
          };
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
                isAnonymous: principal.user.isAnonymous ?? null,
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
              isAnonymous: user.isAnonymous ?? null,
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
  };
}
