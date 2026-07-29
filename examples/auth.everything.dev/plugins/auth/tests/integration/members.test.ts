import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import {
  addTestMember,
  createTestHandlers,
  createTestOrg,
  createTestServices,
  createTestUser,
} from "../helpers";

let services: Awaited<ReturnType<typeof createTestServices>>;

beforeAll(async () => {
  services = await createTestServices();
}, 30000);

afterAll(async () => {
  await services.driver.close();
}, 30000);

describe("member handlers", () => {
  describe("listMembers", () => {
    it("returns all members for an organization", async () => {
      const owner = await createTestUser(services.services);
      const member1 = await createTestUser(services.services, {
        email: `m1-${crypto.randomUUID()}@example.com`,
      });
      const member2 = await createTestUser(services.services, {
        email: `m2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member1.userId, "member");
      await addTestMember(services.services, org.id, member2.userId, "admin");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.listMembers({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result).toHaveLength(3);
      const roles = result.map((m) => m.role).sort();
      expect(roles).toContain("owner");
      expect(roles).toContain("member");
      expect(roles).toContain("admin");
    });

    it("includes user info for each member", async () => {
      const owner = await createTestUser(services.services, { name: "Owner User" });
      const org = await createTestOrg(services.services, owner.userId);

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.listMembers({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result[0].user).not.toBeNull();
      expect(result[0].user?.name).toBe("Owner User");
    });
  });

  describe("removeMember", () => {
    it("throws FORBIDDEN when non-admin tries to remove", async () => {
      const owner = await createTestUser(services.services);
      const member1 = await createTestUser(services.services, {
        email: `r1-${crypto.randomUUID()}@example.com`,
      });
      const member2 = await createTestUser(services.services, {
        email: `r2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      const m1Id = await addTestMember(services.services, org.id, member1.userId, "member");
      await addTestMember(services.services, org.id, member2.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.removeMember({
          input: { id: m1Id, organizationId: org.id },
          context: { reqHeaders: member2.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws NOT_FOUND for non-existent member", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.removeMember({
          input: { id: "nonexistent", organizationId: org.id },
          context: { reqHeaders: owner.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST when removing last owner", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const memberships = await services.services.db.query.member.findMany({
        where: and(eq(schema.member.organizationId, org.id), eq(schema.member.role, "owner")),
      });
      const ownerMemberId = memberships[0]?.id;

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.removeMember({
          input: { id: ownerMemberId, organizationId: org.id },
          context: { reqHeaders: owner.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("allows admin to remove member", async () => {
      const owner = await createTestUser(services.services);
      const admin = await createTestUser(services.services, {
        email: `adm-${crypto.randomUUID()}@example.com`,
      });
      const member = await createTestUser(services.services, {
        email: `rem-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, admin.userId, "admin");
      const memberId = await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.removeMember({
        input: { id: memberId, organizationId: org.id },
        context: { reqHeaders: admin.reqHeaders },
      });

      expect(result.success).toBe(true);
    });

    it("throws FORBIDDEN when admin tries to remove another admin", async () => {
      const owner = await createTestUser(services.services);
      const admin1 = await createTestUser(services.services, {
        email: `a1-${crypto.randomUUID()}@example.com`,
      });
      const admin2 = await createTestUser(services.services, {
        email: `a2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, admin1.userId, "admin");
      const admin2Id = await addTestMember(services.services, org.id, admin2.userId, "admin");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.removeMember({
          input: { id: admin2Id, organizationId: org.id },
          context: { reqHeaders: admin1.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("updateMemberRole", () => {
    it("updates member to admin as owner", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `up-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      const memberId = await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.updateMemberRole({
        input: { id: memberId, organizationId: org.id, role: "admin" },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.role).toBe("admin");
    });

    it("throws FORBIDDEN when admin tries to assign owner role", async () => {
      const owner = await createTestUser(services.services);
      const admin = await createTestUser(services.services, {
        email: `ao-${crypto.randomUUID()}@example.com`,
      });
      const member = await createTestUser(services.services, {
        email: `mo-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, admin.userId, "admin");
      const memberId = await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.updateMemberRole({
          input: { id: memberId, organizationId: org.id, role: "owner" },
          context: { reqHeaders: admin.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws BAD_REQUEST when demoting last owner", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const memberships = await services.services.db.query.member.findMany({
        where: and(eq(schema.member.organizationId, org.id), eq(schema.member.role, "owner")),
      });
      const ownerMemberId = memberships[0]?.id;

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.updateMemberRole({
          input: { id: ownerMemberId, organizationId: org.id, role: "member" },
          context: { reqHeaders: owner.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("allows owner to demote when other owners exist", async () => {
      const owner1 = await createTestUser(services.services);
      const owner2 = await createTestUser(services.services, {
        email: `o2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner1.userId);
      const owner2Id = await addTestMember(services.services, org.id, owner2.userId, "owner");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.updateMemberRole({
        input: { id: owner2Id, organizationId: org.id, role: "admin" },
        context: { reqHeaders: owner1.reqHeaders },
      });

      expect(result.role).toBe("admin");
    });
  });

  describe("getActiveMember", () => {
    it("returns member info when user is in org", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);

      const handlers = createTestHandlers(services.services);
      await handlers.organizations.setActiveOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.members.getActiveMember({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.id).not.toBeNull();
      expect(result.role).toBe("owner");
    });
  });
});
