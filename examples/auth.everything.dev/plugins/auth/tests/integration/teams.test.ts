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

describe("team handlers", () => {
  describe("createTeam", () => {
    it("creates a team in an organization", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.teams.createTeam({
        input: { name: "Engineering", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe("Engineering");
      expect(result.organizationId).toBe(org.id);
    });
  });

  describe("listTeams", () => {
    it("lists teams for an organization", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const handlers = createTestHandlers(services.services);

      await handlers.teams.createTeam({
        input: { name: "Frontend", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      await handlers.teams.createTeam({
        input: { name: "Backend", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const result = (await handlers.teams.listTeams({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      })) as Array<{ id: string; name: string }>;

      expect(result.length).toBeGreaterThanOrEqual(2);
      const names = result.map((t) => t.name);
      expect(names).toContain("Frontend");
      expect(names).toContain("Backend");
    });
  });

  describe("updateTeam", () => {
    it("updates team name", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const handlers = createTestHandlers(services.services);

      await handlers.organizations.setActiveOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const team = await handlers.teams.createTeam({
        input: { name: "Old Name", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const result = await handlers.teams.updateTeam({
        input: { teamId: team.id, data: { name: "New Name" } },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.name).toBe("New Name");
    });
  });

  describe("addTeamMember", () => {
    it("adds a member to a team", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `tm-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");
      const handlers = createTestHandlers(services.services);

      const team = await handlers.teams.createTeam({
        input: { name: "Design", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.teams.addTeamMember({
        input: { teamId: team.id, userId: member.userId, organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.id).toBeDefined();
      expect(result.teamId).toBe(team.id);
      expect(result.userId).toBe(member.userId);
    });
  });

  describe("listTeamMembers", () => {
    it("lists members of a team", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `ltm-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");
      const handlers = createTestHandlers(services.services);

      const team = await handlers.teams.createTeam({
        input: { name: "QA", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });
      await handlers.teams.addTeamMember({
        input: { teamId: team.id, userId: member.userId, organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.teams.listTeamMembers({
        input: { teamId: team.id },
        context: { reqHeaders: member.reqHeaders },
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(member.userId);
    });
  });

  describe("removeTeamMember", () => {
    it("removes a member from a team", async () => {
      const owner = await createTestUser(services.services);
      const member = await createTestUser(services.services, {
        email: `rtm-${crypto.randomUUID()}@example.com`,
      });
      const org = await createTestOrg(services.services, owner.userId);
      await addTestMember(services.services, org.id, member.userId, "member");
      const handlers = createTestHandlers(services.services);

      const team = await handlers.teams.createTeam({
        input: { name: "Infra", organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });
      await handlers.teams.addTeamMember({
        input: { teamId: team.id, userId: owner.userId, organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });
      await handlers.teams.addTeamMember({
        input: { teamId: team.id, userId: member.userId, organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      const result = await handlers.teams.removeTeamMember({
        input: { teamId: team.id, userId: member.userId, organizationId: org.id },
        context: { reqHeaders: owner.reqHeaders },
      });

      expect(result.success).toBe(true);

      const afterMembers = await handlers.teams.listTeamMembers({
        input: { teamId: team.id },
        context: { reqHeaders: owner.reqHeaders },
      });
      expect(afterMembers).toHaveLength(1);
    });
  });

  describe("deleteTeam", () => {
    it("deletes a team", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const handlers = createTestHandlers(services.services);

      await handlers.organizations.setActiveOrganization({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const team = await handlers.teams.createTeam({
        input: { name: "Temp Team", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const teamsBefore = await handlers.teams.listTeams({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      const result = await handlers.teams.deleteTeam({
        input: { teamId: team.id, organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);

      const teamsAfter = await handlers.teams.listTeams({
        input: { organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });
      expect(teamsAfter).toHaveLength(teamsBefore.length - 1);
    });
  });
});
