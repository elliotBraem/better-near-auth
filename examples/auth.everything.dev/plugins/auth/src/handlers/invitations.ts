import type { PluginServices } from "../service-types";
import { createHeaders, safeAuthApi } from "../utils";

export function createInvitationHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    inviteMember: builder.inviteMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
          expiresAt:
            result.expiresAt instanceof Date ? result.expiresAt : new Date(result.expiresAt),
          inviterId: result.inviterId,
        };
      }),

    getInvitation: builder.getInvitation.handler(
      async ({ input, context }: { input: any; context: any }) => {
        try {
          const invitation = await services.auth.api.getInvitation({
            headers: createHeaders(context.reqHeaders ?? {}),
            query: { id: input.id },
          });
          if (!invitation) return null;
          return {
            id: invitation.id,
            organizationId: invitation.organizationId,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt:
              invitation.expiresAt instanceof Date
                ? invitation.expiresAt
                : new Date(invitation.expiresAt),
            inviterId: invitation.inviterId,
            organizationName: invitation.organizationName,
            organizationSlug: invitation.organizationSlug,
            inviterEmail: invitation.inviterEmail,
          };
        } catch {
          return null;
        }
      },
    ),

    listInvitations: builder.listInvitations
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listInvitations({
            headers: createHeaders(context.reqHeaders),
            query: {
              organizationId: input.organizationId,
            },
          }),
        );
        return (result ?? []).map((inv: any) => ({
          id: inv.id,
          organizationId: inv.organizationId,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt instanceof Date ? inv.expiresAt : new Date(inv.expiresAt),
          inviterId: inv.inviterId,
        }));
      }),

    listUserInvitations: builder.listUserInvitations
      .use(requireAuth)
      .handler(async ({ context }: { context: any }) => {
        const result = await safeAuthApi(() =>
          services.auth.api.listUserInvitations({
            headers: createHeaders(context.reqHeaders),
          }),
        );
        return (result ?? []).map((inv: any) => ({
          id: inv.id,
          organizationId: inv.organizationId,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt instanceof Date ? inv.expiresAt : new Date(inv.expiresAt),
          inviterId: inv.inviterId,
        }));
      }),

    cancelInvitation: builder.cancelInvitation
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.cancelInvitation({
            headers: createHeaders(context.reqHeaders),
            body: { invitationId: input.invitationId },
          }),
        );
        return { success: true };
      }),

    acceptInvitation: builder.acceptInvitation
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.acceptInvitation({
            headers: createHeaders(context.reqHeaders),
            body: { invitationId: input.invitationId },
          }),
        );
        return { success: true };
      }),

    rejectInvitation: builder.rejectInvitation
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.rejectInvitation({
            headers: createHeaders(context.reqHeaders),
            body: { invitationId: input.invitationId },
          }),
        );
        return { success: true };
      }),
  };
}
