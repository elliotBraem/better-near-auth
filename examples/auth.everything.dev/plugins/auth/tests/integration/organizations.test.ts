import { eq } from "drizzle-orm";
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

describe("organization handlers", () => {
  describe("listOrganizations", () => {
    it("returns personal org and other memberships for user", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Team Org" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.listOrganizations({
        context: { reqHeaders: user.reqHeaders },
      });

      const orgIds = result.map((o) => o.id);
      expect(orgIds).toContain(user.personalOrgId);
      expect(orgIds).toContain(org.id);
      const teamOrg = result.find((o) => o.id === org.id);
      expect(teamOrg?.role).toBe("owner");
    });

    it("returns empty array for user with no orgs", async () => {
      const user = await createTestUser(services.services, {
        email: `norg-${crypto.randomUUID()}@example.com`,
      });
      await services.services.db.delete(schema.member).where(eq(schema.member.userId, user.userId));

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.listOrganizations({
        context: { reqHeaders: user.reqHeaders },
      });
      expect(result).toHaveLength(0);
    });
  });

  describe("listAllOrganizations", () => {
    it("returns orgs with daoAccountId metadata (non-personal)", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, {
        name: "DAO Org",
        metadata: { daoAccountId: "dao.near" },
      });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.listAllOrganizations({
        context: { reqHeaders: user.reqHeaders },
      });

      const orgIds = result.map((o) => o.id);
      expect(orgIds).toContain(org.id);
    });

    it("excludes personal orgs", async () => {
      const user = await createTestUser(services.services);

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.listAllOrganizations({
        context: { reqHeaders: user.reqHeaders },
      });

      const orgIds = result.map((o) => o.id);
      expect(orgIds).not.toContain(user.personalOrgId);
    });

    it("excludes orgs without daoAccountId metadata", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, {
        name: "Regular Org",
        metadata: { isPersonal: false },
      });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.listAllOrganizations({
        context: { reqHeaders: user.reqHeaders },
      });

      const orgIds = result.map((o) => o.id);
      expect(orgIds).not.toContain(org.id);
    });
  });

  describe("getOrganization", () => {
    it("returns org for member", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Get Org" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.getOrganization({
        input: { id: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.id).toBe(org.id);
      expect(result.name).toBe("Get Org");
    });

    it("throws NOT_FOUND for non-existent org", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      await expect(
        handlers.organizations.getOrganization({
          input: { id: "nonexistent" },
          context: { reqHeaders: user.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws FORBIDDEN for non-member", async () => {
      const user1 = await createTestUser(services.services);
      const user2 = await createTestUser(services.services, {
        email: `u2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, user1.userId);

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.getOrganization({
          input: { id: org.id },
          context: { reqHeaders: user2.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("createOrganization", () => {
    it("creates a new organization", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.organizations.createOrganization({
        input: { name: "New Org", slug: `new-${crypto.randomUUID().slice(0, 8)}` },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("New Org");
    });
  });

  describe("setActiveOrganization", () => {
    it("sets active organization", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Active Org" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.setActiveOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("updateOrganization", () => {
    it("updates org as owner", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Update Org" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.updateOrganization({
        input: { id: org.id, name: "Updated Name" },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.name).toBe("Updated Name");
    });

    it("updates org as admin", async () => {
      const owner = await createTestUser(services.services);
      const admin = await createTestUser(services.services, {
        email: `admin-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, admin.userId, "admin");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.updateOrganization({
        input: { id: org.id, name: "Admin Updated" },
        context: { reqHeaders: admin.reqHeaders },
      });

      expect(result.name).toBe("Admin Updated");
    });

    it("throws FORBIDDEN for member", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `mem-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.updateOrganization({
          input: { id: org.id, name: "Member Updated" },
          context: { reqHeaders: member.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("leaveOrganization", () => {
    it("throws BAD_REQUEST when leaving personal org", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      await expect(
        handlers.organizations.leaveOrganization({
          input: { id: user.personalOrgId },
          context: { reqHeaders: user.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("throws NOT_FOUND for non-member", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const nonMember = await createTestUser(services.services, {
        email: `nm-${crypto.randomUUID()}@example.com`,
      });

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.leaveOrganization({
          input: { id: org.id },
          context: { reqHeaders: nonMember.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws BAD_REQUEST when last owner leaves", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.leaveOrganization({
          input: { id: org.id },
          context: { reqHeaders: user.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("allows owner to leave when other owners exist", async () => {
      const owner1 = await createTestUser(services.services);
      const owner2 = await createTestUser(services.services, {
        email: `o2-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner1.userId);
      await addTestMember(services.services, org.id, owner2.userId, "owner");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.leaveOrganization({
        input: { id: org.id },
        context: { reqHeaders: owner1.reqHeaders },
      });

      expect(result.success).toBe(true);
    });

    it("allows member to leave", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `mem-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.leaveOrganization({
        input: { id: org.id },
        context: { reqHeaders: member.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("deleteOrganization", () => {
    it("throws FORBIDDEN for non-owner", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `del-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.deleteOrganization({
          input: { id: org.id },
          context: { reqHeaders: member.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("throws BAD_REQUEST when deleting personal org", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      await expect(
        handlers.organizations.deleteOrganization({
          input: { id: user.personalOrgId },
          context: { reqHeaders: user.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("deletes org as owner", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Delete Me" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.deleteOrganization({
        input: { id: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });
});
