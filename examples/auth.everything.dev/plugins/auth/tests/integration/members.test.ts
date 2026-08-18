import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
      const result = (await handlers.members.listMembers({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      })) as { members: Array<{ role: string }>; total: number };

      expect(result.members).toHaveLength(3);
      const roles = result.members.map((m) => m.role).sort();
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

      expect(result.members[0].user).not.toBeNull();
      expect(result.members[0].user?.name).toBe("Owner User");
    });
  });

  describe("addMember", () => {
    it("adds a member directly without invitation", async () => {
      const owner = await createTestUser(services.services);
      const newMember = await createTestUser(services.services, {
        email: `addmem-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.addMember({
        input: { userId: newMember.userId, role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.id).toBeDefined();
      expect(result.role).toBe("member");
      expect(result.organizationId).toBe(org.id);
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
      const m1MemberId = await addTestMember(services.services, org.id, member1.userId, "member");
      await addTestMember(services.services, org.id, member2.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.removeMember({
          input: { memberIdOrEmail: m1MemberId, organizationId: org.id },
          context: { reqHeaders: member2.reqHeaders },
        }),
      ).rejects.toThrow();
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
      const memberMemberId = await addTestMember(
        services.services,
        org.id,
        member.userId,
        "member",
      );

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.removeMember({
        input: { memberIdOrEmail: memberMemberId, organizationId: org.id },
        context: { reqHeaders: admin.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("updateMemberRole", () => {
    it("updates member to admin as owner", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `up-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      const memberMemberId = await addTestMember(
        services.services,
        org.id,
        member.userId,
        "member",
      );

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.updateMemberRole({
        input: { memberId: memberMemberId, organizationId: org.id, role: "admin" },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.role).toBe("admin");
    });

    it("throws when admin tries to assign owner role", async () => {
      const owner = await createTestUser(services.services);
      const admin = await createTestUser(services.services, {
        email: `ao-${crypto.randomUUID()}@example.com`,
      });
      const member = await createTestUser(services.services, {
        email: `mo-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, admin.userId, "admin");
      const memberMemberId = await addTestMember(
        services.services,
        org.id,
        member.userId,
        "member",
      );

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.members.updateMemberRole({
          input: { memberId: memberMemberId, organizationId: org.id, role: "owner" },
          context: { reqHeaders: admin.reqHeaders },
        }),
      ).rejects.toThrow();
    });

    it("allows owner to demote when other owners exist", async () => {
      const owner1 = await createTestUser(services.services);
      const owner2 = await createTestUser(services.services, {
        email: `o2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner1.userId);
      const owner2MemberId = await addTestMember(services.services, org.id, owner2.userId, "owner");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.members.updateMemberRole({
        input: { memberId: owner2MemberId, organizationId: org.id, role: "admin" },
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

  describe("getActiveMemberRole", () => {
    it("returns role when user is in org", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);

      const handlers = createTestHandlers(services.services);
      await handlers.organizations.setActiveOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.members.getActiveMemberRole({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result).toEqual({ role: "owner" });
    });
  });
});
