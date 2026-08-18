import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHandlers, createTestOrg, createTestServices, createTestUser } from "../helpers";

let services: Awaited<ReturnType<typeof createTestServices>>;

beforeAll(async () => {
  services = await createTestServices();
}, 30000);

afterAll(async () => {
  await services.driver.close();
}, 30000);

describe("invitation handlers", () => {
  describe("inviteMember", () => {
    it("creates an invitation as owner", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.invitations.inviteMember({
        input: { email: "invited@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe("invited@example.com");
      expect(result.role).toBe("member");
      expect(result.organizationId).toBe(org.id);
    });

    it("resends invitation when resend is true", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      await handlers.invitations.inviteMember({
        input: { email: "resend@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.inviteMember({
        input: {
          email: "resend@example.com",
          role: "member",
          organizationId: org.id,
          resend: true,
        },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.id).toBeDefined();
    });
  });

  describe("getInvitation", () => {
    it("returns an invitation by ID", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const invitedEmail = `get-invite-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const invitedUser = await createTestUser(services.services, { email: invitedEmail });
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: invitedEmail, role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.getInvitation({
        input: { id: invite.id },
        context: { reqHeaders: invitedUser.reqHeaders },
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(invite.id);
      expect(result!.organizationName).toBe(org.name);
      expect(result!.organizationSlug).toBe(org.slug);
    });

    it("returns null for non-existent invitation", async () => {
      const owner = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.invitations.getInvitation({
        input: { id: "nonexistent" },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result).toBeNull();
    });
  });

  describe("listInvitations", () => {
    it("lists invitations for an organization", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      await handlers.invitations.inviteMember({
        input: { email: "list1@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });
      await handlers.invitations.inviteMember({
        input: { email: "list2@example.com", role: "admin", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = (await handlers.invitations.listInvitations({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      })) as Array<{ id: string; email: string }>;

      expect(result).toHaveLength(2);
      const emails = result.map((i) => i.email);
      expect(emails).toContain("list1@example.com");
      expect(emails).toContain("list2@example.com");
    });
  });

  describe("listUserInvitations", () => {
    it("returns invitations for the current user", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const invitedEmail = `userinv-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const invitedUser = await createTestUser(services.services, { email: invitedEmail });
      const handlers = createTestHandlers(services.services);

      await handlers.invitations.inviteMember({
        input: { email: invitedEmail, role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = (await handlers.invitations.listUserInvitations({
        context: { reqHeaders: invitedUser.reqHeaders },
      })) as Array<{ id: string; email: string }>;

      expect(result.length).toBeGreaterThanOrEqual(1);
      const emails = result.map((i) => i.email);
      expect(emails).toContain(invitedEmail);
    });
  });

  describe("cancelInvitation", () => {
    it("cancels an invitation as owner", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: "cancel@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.cancelInvitation({
        input: { invitationId: invite.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.success).toBe(true);
    });

    it("throws FORBIDDEN for non-member", async () => {
      const owner = await createTestUser(services.services);
      const outsider = await createTestUser(services.services, {
        email: `out-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: "forbid-cancel@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      await expect(
        handlers.invitations.cancelInvitation({
          input: { invitationId: invite.id },
          context: { reqHeaders: outsider.reqHeaders },
        }),
      ).rejects.toThrow();
    });
  });

  describe("acceptInvitation", () => {
    it("accepts an invitation as the invited user", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const invitedEmail = `accept-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const invitedUser = await createTestUser(services.services, { email: invitedEmail });
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: invitedEmail, role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.acceptInvitation({
        input: { invitationId: invite.id },
        context: { reqHeaders: invitedUser.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("rejectInvitation", () => {
    it("rejects an invitation as the invited user", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const invitedEmail = `reject-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const invitedUser = await createTestUser(services.services, { email: invitedEmail });
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: invitedEmail, role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.rejectInvitation({
        input: { invitationId: invite.id },
        context: { reqHeaders: invitedUser.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });
});
