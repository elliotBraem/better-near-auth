import { and, eq } from "drizzle-orm";
import { ORPCError } from "every-plugin/orpc";
import type { AuthServices } from "../auth-export";
import * as schema from "../db/schema";
import { createHeaders, safeAuthApi } from "../utils";

export function createMemberHandlers(services: AuthServices, builder: any, requireAuth: any) {
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

    listMembers: builder.listMembers.use(requireAuth).handler(async ({ input }: { input: any }) => {
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

    removeMember: builder.removeMember
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
  };
}
