import { ORPCError } from "every-plugin/orpc";
import type { PluginsClient } from "./plugins-types.gen";

export interface RequestAuthUser {
  id: string;
  role?: string;
  email?: string;
  name?: string;
}

export interface RequestAuthContext {
  userId?: string;
  user?: RequestAuthUser;
  organizationId?: string;
  reqHeaders?: Headers;
  getRawBody?: () => Promise<string>;
}

export interface AuthContext extends RequestAuthContext {
  userId: RequestAuthUser["id"];
  user: RequestAuthUser;
}

export interface RoleAuthContext<TRole extends string = string> extends AuthContext {
  user: RequestAuthUser & { role: TRole };
}

export interface OrganizationContext extends AuthContext {
  organizationId: string;
}

type MiddlewareNext<TContext extends RequestAuthContext> = (args: { context: TContext }) => unknown;

export type AuthPluginClientFactory = PluginsClient["auth"];
export type AuthPluginClient = ReturnType<AuthPluginClientFactory>;

export interface AuthCapableServices {
  auth?: AuthPluginClientFactory | null;
}

export function getAuthClient(
  services: AuthCapableServices,
  context?: Record<string, unknown>,
): AuthPluginClient {
  if (!services.auth) {
    throw new Error("Auth plugin client unavailable");
  }

  return services.auth(context);
}

function toAuthContext(context: RequestAuthContext): AuthContext {
  return {
    userId: context.userId!,
    user: context.user!,
    organizationId: context.organizationId,
    reqHeaders: context.reqHeaders,
    getRawBody: context.getRawBody,
  };
}

export function createAuthGuards(builder: any) {
  const requireAuthHandler = async ({
    context,
    next,
  }: {
    context: RequestAuthContext;
    next: MiddlewareNext<AuthContext>;
  }) => {
    if (!context.user || !context.userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
        data: {
          authType: "session",
          hint: "Sign in with NEAR, passkey, email, phone, or anonymous",
        },
      });
    }

    return next({ context: toAuthContext(context) });
  };

  const requireRoleHandler =
    <TRoles extends readonly string[]>(...roles: TRoles) =>
    async ({
      context,
      next,
    }: {
      context: RequestAuthContext;
      next: MiddlewareNext<RoleAuthContext<TRoles[number]>>;
    }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: { authType: "session", hint: "Sign in to continue" },
        });
      }

      const currentRole = context.user.role ?? undefined;
      if (!currentRole || !roles.includes(currentRole)) {
        throw new ORPCError("FORBIDDEN", {
          message: `Requires role: ${roles.join(" or ")}`,
          data: { requiredRoles: roles, currentRole },
        });
      }

      const authContext = toAuthContext(context);
      const roleContext: RoleAuthContext<TRoles[number]> = {
        ...authContext,
        user: { ...authContext.user, role: currentRole as TRoles[number] },
      };

      return next({ context: roleContext });
    };

  const requireOrganizationHandler = async ({
    context,
    next,
  }: {
    context: RequestAuthContext;
    next: MiddlewareNext<OrganizationContext>;
  }) => {
    if (!context.user || !context.userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
        data: { authType: "session", hint: "Sign in to continue" },
      });
    }

    if (!context.organizationId) {
      throw new ORPCError("FORBIDDEN", {
        message: "Active organization required",
        data: { hint: "Select or create an organization" },
      });
    }

    const authContext = toAuthContext(context);
    const organizationContext: OrganizationContext = {
      ...authContext,
      organizationId: context.organizationId,
    };

    return next({ context: organizationContext });
  };

  const requireAuth = builder.middleware(requireAuthHandler);

  const requireRole = <TRoles extends readonly string[]>(...roles: TRoles) =>
    builder.middleware(requireRoleHandler(...roles));

  const requireAdmin = requireRole("admin");

  const requireOrganization = builder.middleware(requireOrganizationHandler);

  return { requireAuth, requireRole, requireAdmin, requireOrganization };
}
