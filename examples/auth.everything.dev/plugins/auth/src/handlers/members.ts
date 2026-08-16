import type { PluginServices } from "../service-types";
import { createHeaders, safeAuthApi } from "../utils";

export function createMemberHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    getActiveMember: builder.getActiveMember
      .use(requireAuth)
      .handler(async ({ context, input }: { context: any; input: any }) => {
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

    getActiveMemberRole: builder.getActiveMemberRole
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.getActiveMemberRole({
            headers: createHeaders(context.reqHeaders),
            query: input?.organizationId ? { organizationId: input.organizationId } : undefined,
          }),
        );
        const role = typeof result === "string" ? result : ((result as any)?.role ?? null);
        return { role };
      }),

    listMembers: builder.listMembers
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listMembers({
            headers: createHeaders(context.reqHeaders),
            query: {
              organizationId: input.organizationId,
              limit: input.limit,
              offset: input.offset,
            },
          }),
        );
        return {
          members: (result.members ?? []).map((m: any) => ({
            id: m.id,
            userId: m.userId,
            organizationId: m.organizationId,
            role: m.role,
            createdAt: m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt),
            user: m.user
              ? {
                  id: m.user.id,
                  name: m.user.name,
                  email: m.user.email,
                  image: m.user.image,
                }
              : null,
          })),
          total: result.total,
        };
      }),

    addMember: builder.addMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.addMember({
            headers: createHeaders(context.reqHeaders),
            body: {
              userId: input.userId,
              role: input.role,
              organizationId: input.organizationId,
            },
          }),
        );
        return {
          id: result.id,
          userId: result.userId,
          organizationId: result.organizationId,
          role: result.role,
          createdAt:
            result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt),
        };
      }),

    removeMember: builder.removeMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.removeMember({
            headers: createHeaders(context.reqHeaders),
            body: {
              memberIdOrEmail: input.memberIdOrEmail,
              organizationId: input.organizationId,
            },
          }),
        );
        return { success: true };
      }),

    updateMemberRole: builder.updateMemberRole
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.updateMemberRole({
            headers: createHeaders(context.reqHeaders),
            body: {
              role: input.role,
              memberId: input.memberId,
              organizationId: input.organizationId,
            },
          }),
        );
        return {
          id: result.id,
          userId: result.userId,
          organizationId: result.organizationId,
          role: result.role,
          createdAt:
            result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt),
          user: result.user
            ? {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                image: result.user.image,
              }
            : null,
        };
      }),
  };
}
