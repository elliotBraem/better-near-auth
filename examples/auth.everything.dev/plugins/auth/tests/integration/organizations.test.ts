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

describe("organization handlers", () => {
  describe("listOrganizations", () => {
    it("returns organizations for user", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Team Org" });

      const handlers = createTestHandlers(services.services);
      const result = (await handlers.organizations.listOrganizations({
        context: { reqHeaders: user.reqHeaders },
      })) as Array<{ id: string; name: string; slug: string }>;

      const orgIds = result.map((o) => o.id);
      expect(orgIds).toContain(user.personalOrgId);
      expect(orgIds).toContain(org.id);
    });
  });

  describe("getFullOrganization", () => {
    it("returns org with members, invitations, teams for member", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Get Org" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.getFullOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.id).toBe(org.id);
      expect(result.name).toBe("Get Org");
      expect(result.members).toBeDefined();
      expect(result.invitations).toBeDefined();
    });

    it("returns null for non-existent org", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.organizations.getFullOrganization({
        input: { organizationId: "nonexistent" },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result).toBeNull();
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
        input: { data: { name: "Updated Name" }, organizationId: org.id },
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
        input: { data: { name: "Admin Updated" }, organizationId: org.id },
        context: { reqHeaders: admin.reqHeaders },
      });

      expect(result.name).toBe("Admin Updated");
    });
  });

  describe("leaveOrganization", () => {
    it("throws when leaving personal org", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      await expect(
        handlers.organizations.leaveOrganization({
          input: { organizationId: user.personalOrgId },
          context: { reqHeaders: user.reqHeaders },
        }),
      ).rejects.toThrow();
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
        input: { organizationId: org.id },
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
        input: { organizationId: org.id },
        context: { reqHeaders: member.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("deleteOrganization", () => {
    it("throws when non-owner tries to delete", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `del-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");

      const handlers = createTestHandlers(services.services);
      await expect(
        handlers.organizations.deleteOrganization({
          input: { organizationId: org.id },
          context: { reqHeaders: member.reqHeaders },
        }),
      ).rejects.toThrow();
    });

    it("deletes org as owner", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId, { name: "Delete Me" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.deleteOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("checkSlug", () => {
    it("returns true for available slug", async () => {
      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.checkSlug({
        input: { slug: `available-${crypto.randomUUID().slice(0, 8)}` },
      });
      expect(result.status).toBe(true);
    });

    it("returns false for taken slug", async () => {
      const user = await createTestUser(services.services);
      await createTestOrg(services.services, user.userId, { slug: "taken-slug" });

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.checkSlug({
        input: { slug: "taken-slug" },
      });
      expect(result.status).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("returns success for owner", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.hasPermission({
        input: { organizationId: org.id, permissions: { organization: ["update"] } },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("dao linking", () => {
    it("links and gets dao account", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);

      const handlers = createTestHandlers(services.services);

      const linkResult = await handlers.organizations.linkDao({
        input: { organizationId: org.id, daoAccountId: "dao.near", daoNetwork: "mainnet" },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(linkResult.success).toBe(true);

      const daoResult = await handlers.organizations.getDao({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(daoResult.daoAccountId).toBe("dao.near");
      expect(daoResult.daoNetwork).toBe("mainnet");
    });

    it("unlinks dao account", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);

      const handlers = createTestHandlers(services.services);

      const linkResult = await handlers.organizations.linkDao({
        input: { organizationId: org.id, daoAccountId: "other.near", daoNetwork: "testnet" },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(linkResult.success).toBe(true);

      const unlinkResult = await handlers.organizations.unlinkDao({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(unlinkResult.success).toBe(true);

      const afterResult = await handlers.organizations.getDao({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(afterResult.daoAccountId).toBeNull();
    });

    it("returns null dao for org without dao", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);

      const handlers = createTestHandlers(services.services);
      const result = await handlers.organizations.getDao({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(result.daoAccountId).toBeNull();
    });
  });
});
