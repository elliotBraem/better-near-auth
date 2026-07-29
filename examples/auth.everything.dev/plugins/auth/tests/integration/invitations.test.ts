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
  });

  describe("getInvitation", () => {
    it("returns an invitation by ID", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: "get-invite@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.getInvitation({
        input: { id: invite.id },
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe(invite.id);
      expect(result!.organization).not.toBeNull();
      expect(result!.organization!.id).toBe(org.id);
    });

    it("returns null for non-existent invitation", async () => {
      const handlers = createTestHandlers(services.services);

      const result = await handlers.invitations.getInvitation({
        input: { id: "nonexistent" },
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

      const result = await handlers.invitations.listInvitations({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result).toHaveLength(2);
      const emails = result.map((i) => i.email);
      expect(emails).toContain("list1@example.com");
      expect(emails).toContain("list2@example.com");
    });

    it("returns empty array for org with no invitations", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.invitations.listInvitations({
        input: { organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result).toHaveLength(0);
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
        input: { id: invite.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.success).toBe(true);

      const dbInvite = await services.services.db.query.invitation.findFirst({
        where: eq(schema.invitation.id, invite.id),
      });
      expect(dbInvite).toBeUndefined();
    });

    it("throws NOT_FOUND for non-existent invitation", async () => {
      const owner = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      await expect(
        handlers.invitations.cancelInvitation({
          input: { id: "nonexistent" },
          context: { reqHeaders: owner.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
          input: { id: invite.id },
          context: { reqHeaders: outsider.reqHeaders },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("resendInvitation", () => {
    it("resends an invitation as owner", async () => {
      const owner = await createTestUser(services.services);
      const org = await createTestOrg(services.services, owner.userId);
      const handlers = createTestHandlers(services.services);

      const invite = await handlers.invitations.inviteMember({
        input: { email: "resend@example.com", role: "member", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.invitations.resendInvitation({
        input: { id: invite.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.sent).toBe(true);
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
        input: { id: invite.id },
        context: { reqHeaders: invitedUser.reqHeaders },
      });

      expect(result.success).toBe(true);

      const member = await services.services.db.query.member.findFirst({
        where: and(
          eq(schema.member.userId, invitedUser.userId),
          eq(schema.member.organizationId, org.id),
        ),
      });
      expect(member).toBeDefined();
      expect(member!.organizationId).toBe(org.id);
      expect(member!.role).toBe("member");
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
        input: { id: invite.id },
        context: { reqHeaders: invitedUser.reqHeaders },
      });

      expect(result.success).toBe(true);

      const member = await services.services.db.query.member.findFirst({
        where: eq(schema.member.userId, invitedUser.userId),
      });
      expect(member?.organizationId).not.toBe(org.id);
    });
  });
});
