import { and, eq } from "drizzle-orm";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { AuthServices } from "../auth-export";
import * as schema from "../db/schema";
import { createHeaders, safeAuthApi, tryJsonParse } from "../utils";

export function createInvitationHandlers(services: AuthServices, builder: any, requireAuth: any) {
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
          expiresAt: result.expiresAt,
          inviterId: result.inviterId,
        };
      }),

    getInvitation: builder.getInvitation.handler(async ({ input }: { input: any }) => {
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

    listInvitations: builder.listInvitations
      .use(requireAuth)
      .handler(async ({ input }: { input: any }) => {
        const invitations = await services.db.query.invitation.findMany({
          where: eq(schema.invitation.organizationId, input.organizationId),
        });
        return invitations.map((inv) => ({
          id: inv.id,
          organizationId: inv.organizationId,
          email: inv.email,
          role: inv.role,
          status: inv.status,
          expiresAt: inv.expiresAt,
          inviterId: inv.inviterId,
        }));
      }),

    cancelInvitation: builder.cancelInvitation
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const invitation = await services.db.query.invitation.findFirst({
          where: eq(schema.invitation.id, input.id),
        });

        if (!invitation) {
          throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
        }

        const membership = await services.db.query.member.findFirst({
          where: and(
            eq(schema.member.userId, context.userId),
            eq(schema.member.organizationId, invitation.organizationId),
          ),
        });

        if (!membership) {
          throw new ORPCError("FORBIDDEN", { message: "Not a member of this organization" });
        }

        await services.db.delete(schema.invitation).where(eq(schema.invitation.id, input.id));
        return { success: true };
      }),

    resendInvitation: builder.resendInvitation
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
        await safeAuthApi(() =>
          services.auth.api.rejectInvitation({
            headers: createHeaders(context.reqHeaders),
            body: { invitationId: input.id },
          }),
        );
        return { success: true };
      }),
  };
}
