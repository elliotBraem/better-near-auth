import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { ORPCError } from "every-plugin/orpc";
import type { PluginServices } from "../service-types";
import * as schema from "../db/schema";
import { createHeaders, safeAuthApi, tryJsonParse } from "../utils";

export function createOrganizationHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    listOrganizations: builder.listOrganizations
      .use(requireAuth)
      .handler(async ({ context }: { context: any }) => {
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

    listAllOrganizations: builder.listAllOrganizations.use(requireAuth).handler(async () => {
      const orgs = await services.db
        .select()
        .from(schema.organization)
        .where(
          and(
            isNotNull(schema.organization.metadata),
            sql`${schema.organization.metadata}::jsonb ? 'daoAccountId'`,
            sql`(${schema.organization.metadata}::jsonb ->> 'isPersonal') IS DISTINCT FROM 'true'`,
          ),
        )
        .orderBy(desc(schema.organization.createdAt));
      return orgs.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? null,
        createdAt: org.createdAt,
        metadata: tryJsonParse<Record<string, unknown>>(org.metadata) ?? null,
      }));
    }),

    createOrganization: builder.createOrganization
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
            where: and(eq(schema.member.organizationId, input.id), eq(schema.member.role, "owner")),
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

    getOrganization: builder.getOrganization
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const membership = await services.db.query.member.findFirst({
          where: and(
            eq(schema.member.userId, context.userId),
            eq(schema.member.organizationId, input.id),
          ),
        });
        if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
          throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });
        }

        const setData: Record<string, unknown> = {};
        if (input.name !== undefined) setData.name = input.name;
        if (input.slug !== undefined) setData.slug = input.slug;
        if (input.logo !== undefined) setData.logo = input.logo;
        if (input.metadata !== undefined) {
          setData.metadata =
            typeof input.metadata === "string" ? input.metadata : JSON.stringify(input.metadata);
        }

        const [updated] = await services.db
          .update(schema.organization)
          .set(setData)
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
      .handler(async ({ input, context }: { input: any; context: any }) => {
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

        await services.db.delete(schema.member).where(eq(schema.member.organizationId, input.id));
        await services.db.delete(schema.organization).where(eq(schema.organization.id, input.id));
        return { success: true };
      }),
  };
}
