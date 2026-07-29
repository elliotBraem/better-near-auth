/**
 * Auth context types and Better-Auth plugin client factory for the API.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import type { DecoratedMiddleware } from "every-plugin/orpc";
import { ORPCError } from "every-plugin/orpc";
import type { z } from "every-plugin/zod";
import type {
  AuthOrganizationContext,
  AuthOrganizationSummary,
  AuthPluginContext,
} from "./auth-types.gen";

export type AuthContext = AuthPluginContext;
export type RequestAuthUser = NonNullable<AuthContext["user"]>;
export type ApiKeyContext = NonNullable<AuthContext["apiKey"]>;

export interface AuthenticatedContext extends AuthContext {
  userId: string;
  user: RequestAuthUser;
}

type OrgMetaType<TSchema extends z.ZodType | undefined> = TSchema extends z.ZodType
  ? z.infer<TSchema>
  : Record<string, unknown>;

export type OrgAuthenticatedContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedContext & {
  organization: NonNullable<AuthOrganizationContext> & {
    activeOrganizationId: string;
    organization: (AuthOrganizationSummary & { metadata: TMeta | null }) | null;
  };
};

export type OrgMemberAuthenticatedContext<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = AuthenticatedContext & {
  organization: NonNullable<AuthOrganizationContext> & {
    activeOrganizationId: string;
    member: NonNullable<AuthOrganizationContext["member"]>;
    organization: (AuthOrganizationSummary & { metadata: TMeta | null }) | null;
  };
};

function parseOrgMetadata<TSchema extends z.ZodType | undefined>(
  raw: Record<string, unknown> | null | undefined,
  schema: TSchema | undefined,
): OrgMetaType<TSchema> | null {
  if (!raw) return null;
  if (!schema) return raw as OrgMetaType<TSchema>;
  const result = schema.safeParse(raw);
  if (result.success) return result.data as OrgMetaType<TSchema>;
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Invalid organization metadata",
    data: { errors: result.error.issues },
  });
}

export function createAuthMiddleware<TOrgMetaSchema extends z.ZodType | undefined = undefined>(
  builder: any,
  options?: { orgMetaSchema?: TOrgMetaSchema },
) {
  type TOrgMeta = OrgMetaType<TOrgMetaSchema>;
  type UserMiddleware = DecoratedMiddleware<
    AuthContext,
    { userId: string; user: RequestAuthUser },
    any,
    any,
    any,
    any
  >;
  type OrgMiddleware = DecoratedMiddleware<
    AuthContext,
    {
      userId: string;
      user: RequestAuthUser;
      organization: NonNullable<AuthOrganizationContext> & {
        activeOrganizationId: string;
        organization: (AuthOrganizationSummary & { metadata: TOrgMeta | null }) | null;
      };
    },
    any,
    any,
    any,
    any
  >;
  type MemberMiddleware = DecoratedMiddleware<
    AuthContext,
    {
      userId: string;
      user: RequestAuthUser;
      organization: NonNullable<AuthOrganizationContext> & {
        activeOrganizationId: string;
        member: NonNullable<AuthOrganizationContext["member"]>;
        organization: (AuthOrganizationSummary & { metadata: TOrgMeta | null }) | null;
      };
    },
    any,
    any,
    any,
    any
  >;
  type ApiKeyMiddleware = DecoratedMiddleware<
    AuthContext,
    { apiKey: ApiKeyContext },
    any,
    any,
    any,
    any
  >;

  const requireAuth = builder.middleware(
    async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { hint: "Sign in to continue" },
        });
      }
      return next({ context: { userId: context.userId, user: context.user } });
    },
  ) as UserMiddleware;

  const requireAuthOrApiKey = builder.middleware(
    async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.user && !context.userId && !context.apiKey) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { hint: "Sign in or provide an API key" },
        });
      }
      return next({ context });
    },
  ) as DecoratedMiddleware<AuthContext, Record<string, never>, any, any, any, any>;

  const requireRole = <TRoles extends readonly string[]>(...roles: TRoles) =>
    builder.middleware(async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { authType: "session", hint: "Sign in to continue" },
        });
      }
      const currentRole = context.user.role;
      if (!currentRole || !roles.includes(currentRole)) {
        throw new ORPCError("FORBIDDEN", {
          message: `Requires role: ${roles.join(" or ")}`,
          data: { requiredRoles: roles, currentRole },
        });
      }
      return next({ context: { userId: context.userId, user: context.user } });
    }) as UserMiddleware;

  const requireAdmin = requireRole("admin");

  const requireOrganization = builder.middleware(
    async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { authType: "session", hint: "Sign in to continue" },
        });
      }
      if (!context.organization?.activeOrganizationId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Active organization required",
          data: { hint: "Select or create an organization" },
        });
      }
      const org = context.organization;
      return next({
        context: {
          userId: context.userId,
          user: context.user,
          organization: {
            ...org,
            activeOrganizationId: org.activeOrganizationId,
            organization: org.organization
              ? {
                  ...org.organization,
                  metadata: parseOrgMetadata(org.organization.metadata, options?.orgMetaSchema),
                }
              : null,
          },
        },
      });
    },
  ) as OrgMiddleware;

  const requireOrgRole = <TRoles extends readonly string[]>(...roles: TRoles) =>
    builder.middleware(async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { authType: "session", hint: "Sign in to continue" },
        });
      }
      if (!context.organization?.activeOrganizationId) {
        throw new ORPCError("FORBIDDEN", {
          message: "Active organization required",
          data: { hint: "Select or create an organization" },
        });
      }
      const member = context.organization?.member;
      if (!member?.id || !member?.role || !roles.includes(member.role)) {
        throw new ORPCError("FORBIDDEN", {
          message: `Requires organization role: ${roles.join(" or ")}`,
          data: { requiredRoles: roles, currentRole: member?.role ?? null },
        });
      }
      const org = context.organization;
      return next({
        context: {
          userId: context.userId,
          user: context.user,
          organization: {
            ...org,
            activeOrganizationId: org.activeOrganizationId,
            member: { id: member.id, role: member.role },
            organization: org.organization
              ? {
                  ...org.organization,
                  metadata: parseOrgMetadata(org.organization.metadata, options?.orgMetaSchema),
                }
              : null,
          },
        },
      });
    }) as MemberMiddleware;

  const requireApiKey = (requiredPermissions?: Record<string, string[]>) =>
    builder.middleware(async ({ context, next }: { context: AuthContext; next: any }) => {
      if (!context.apiKey) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "API key required",
          data: { authType: "apiKey", hint: "Provide a valid API key via x-api-key header" },
        });
      }
      if (requiredPermissions) {
        const keyPerms = context.apiKey.permissions ?? {};
        for (const [resource, actions] of Object.entries(requiredPermissions)) {
          const allowed = keyPerms[resource] ?? [];
          const missing = actions.filter((a: string) => !allowed.includes(a));
          if (missing.length > 0) {
            throw new ORPCError("FORBIDDEN", {
              message: `API key lacks permission: ${resource}:${missing.join(",")}`,
              data: { requiredPermissions, keyPermissions: keyPerms },
            });
          }
        }
      }
      return next({ context: { apiKey: context.apiKey } });
    }) as ApiKeyMiddleware;

  return {
    requireAuth,
    requireAuthOrApiKey,
    requireRole,
    requireAdmin,
    requireOrganization,
    requireOrgRole,
    requireApiKey,
  };
}
