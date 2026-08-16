import type { PluginServices } from "../service-types";
import { createHeaders, safeAuthApi } from "../utils";

export function createTeamHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    createTeam: builder.createTeam
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.createTeam({
            headers: createHeaders(context.reqHeaders),
            body: {
              name: input.name,
              organizationId: input.organizationId,
            },
          }),
        );
        return {
          id: result.id,
          name: result.name,
          organizationId: result.organizationId,
          createdAt:
            result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt as any),
          updatedAt:
            result.updatedAt instanceof Date
              ? result.updatedAt
              : result.updatedAt
                ? new Date(result.updatedAt as any)
                : new Date(),
        };
      }),

    updateTeam: builder.updateTeam
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.updateTeam({
            headers: createHeaders(context.reqHeaders),
            body: {
              teamId: input.teamId,
              data: {
                name: input.data.name,
              },
            },
          }),
        );
        if (!result) {
          throw new Error("Team not found");
        }
        return {
          id: result.id,
          name: result.name,
          organizationId: result.organizationId,
          createdAt:
            result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt as any),
          updatedAt:
            result.updatedAt instanceof Date
              ? result.updatedAt
              : result.updatedAt
                ? new Date(result.updatedAt as any)
                : new Date(),
        };
      }),

    deleteTeam: builder.deleteTeam
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.removeTeam({
            headers: createHeaders(context.reqHeaders),
            body: {
              teamId: input.teamId,
              organizationId: input.organizationId,
            },
          }),
        );
        return { success: true };
      }),

    listTeams: builder.listTeams
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listOrganizationTeams({
            headers: createHeaders(context.reqHeaders),
            query: {
              organizationId: input.organizationId,
            },
          }),
        );
        return (result ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          organizationId: t.organizationId,
          createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
          updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt),
        }));
      }),

    listTeamMembers: builder.listTeamMembers
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listTeamMembers({
            headers: createHeaders(context.reqHeaders),
            query: {
              teamId: input.teamId,
            },
          }),
        );
        return (result ?? []).map((tm: any) => ({
          id: tm.id,
          teamId: tm.teamId,
          userId: tm.userId,
          createdAt: tm.createdAt instanceof Date ? tm.createdAt : new Date(tm.createdAt),
        }));
      }),

    addTeamMember: builder.addTeamMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.addTeamMember({
            headers: createHeaders(context.reqHeaders),
            body: {
              teamId: input.teamId,
              userId: input.userId,
              organizationId: input.organizationId,
            },
          }),
        );
        return {
          id: result.id,
          teamId: result.teamId,
          userId: result.userId,
          createdAt:
            result.createdAt instanceof Date ? result.createdAt : new Date(result.createdAt),
        };
      }),

    removeTeamMember: builder.removeTeamMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.removeTeamMember({
            headers: createHeaders(context.reqHeaders),
            body: {
              teamId: input.teamId,
              userId: input.userId,
              organizationId: input.organizationId,
            },
          }),
        );
        return { success: true };
      }),
  };
}
