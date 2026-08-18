import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import {
  createTestApiKey,
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

describe("getContext handler", () => {
  it("returns anonymous context when no headers provided", async () => {
    const handlers = createTestHandlers(services.services);
    const result = await handlers.session.getContext({ context: { reqHeaders: undefined } });

    expect(result.authMethod).toBe("none");
    expect(result.isAuthenticated).toBe(false);
    expect(result.user).toBeNull();
    expect(result.principal).toBeNull();
    expect(result.userId).toBeNull();
  });

  it("returns session context when session cookie is valid", async () => {
    const user = await createTestUser(services.services);
    const handlers = createTestHandlers(services.services);

    const result = await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    });

    expect(result.authMethod).toBe("session");
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe(user.userId);
    expect(result.user).not.toBeNull();
    expect(result.user!.id).toBe(user.userId);
    expect(result.user!.email).toBe(user.email);
    expect(result.principal).not.toBeNull();
    expect(result.principal!.type).toBe("user");
    expect(result.principal!.type === "user" && result.principal.userId).toBe(user.userId);
  });

  it("returns organization context when session has active org", async () => {
    const user = await createTestUser(services.services);
    const org = await createTestOrg(services.services, user.userId, { name: "My Org" });

    await services.services.db
      .update(schema.session)
      .set({ activeOrganizationId: org.id })
      .where(eq(schema.session.token, user.token));

    const handlers = createTestHandlers(services.services);
    const result = await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    });

    expect(result.organization.hasOrganization).toBe(true);
    expect(result.organization.activeOrganizationId).toBe(org.id);
    expect(result.organization.organization?.name).toBe("My Org");
    expect(result.organization.member?.role).toBe("owner");
    expect(result.organization.isPersonal).toBe(false);
  });

  it("detects personal organization via slug matching userId", async () => {
    const user = await createTestUser(services.services);

    await services.services.db
      .update(schema.session)
      .set({ activeOrganizationId: user.personalOrgId })
      .where(eq(schema.session.token, user.token));

    const handlers = createTestHandlers(services.services);
    const result = await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    });

    expect(result.organization.isPersonal).toBe(true);
    expect(result.organization.activeOrganizationId).toBe(user.personalOrgId);
  });

  it("returns apiKey context for user API key", async () => {
    const user = await createTestUser(services.services);
    const apiKey = await createTestApiKey(services.services, { userId: user.userId });
    const handlers = createTestHandlers(services.services);

    const result = await handlers.session.getContext({
      context: { reqHeaders: { "x-api-key": apiKey.key } },
    });

    expect(result.authMethod).toBe("apiKey");
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe(user.userId);
    expect(result.principal).not.toBeNull();
    expect(result.principal!.type).toBe("user");
    expect(result.apiKey).not.toBeNull();
    expect(result.apiKey!.name).toBe("Test Key");
  });

  it("returns apiKey context for Bearer token with api_ prefix", async () => {
    const user = await createTestUser(services.services);
    const apiKey = await createTestApiKey(services.services, { userId: user.userId });
    const handlers = createTestHandlers(services.services);

    const result = await handlers.session.getContext({
      context: { reqHeaders: { authorization: `Bearer ${apiKey.key}` } },
    });

    expect(result.authMethod).toBe("apiKey");
    expect(result.isAuthenticated).toBe(true);
    expect(result.userId).toBe(user.userId);
  });

  it("returns organization principal for org API key", async () => {
    const user = await createTestUser(services.services);
    const org = await createTestOrg(services.services, user.userId);
    const apiKey = await createTestApiKey(services.services, {
      userId: user.userId,
      organizationId: org.id,
    });
    const handlers = createTestHandlers(services.services);

    const result = await handlers.session.getContext({
      context: { reqHeaders: { "x-api-key": apiKey.key } },
    });

    expect(result.authMethod).toBe("apiKey");
    expect(result.principal).not.toBeNull();
    expect(result.principal!.type).toBe("organization");
    expect(result.principal!.type === "organization" && result.principal.organizationId).toBe(
      org.id,
    );
    expect(result.organization.hasOrganization).toBe(true);
    expect(result.organization.organization?.id).toBe(org.id);
  });

  it("falls back to none for invalid API key", async () => {
    const handlers = createTestHandlers(services.services);
    const result = await handlers.session.getContext({
      context: { reqHeaders: { "x-api-key": "invalid-key" } },
    });

    expect(result.authMethod).toBe("none");
    expect(result.isAuthenticated).toBe(false);
  });

  it("returns near capabilities from DB", async () => {
    const user = await createTestUser(services.services);

    await services.services.db.insert(schema.nearAccount).values({
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: "alice.test.near",
      network: "testnet",
      publicKey: "ed25519:abc",
      isPrimary: true,
      createdAt: new Date(),
    });

    await services.services.db.insert(schema.nearAccount).values({
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: "alice.near",
      network: "mainnet",
      publicKey: "ed25519:def",
      isPrimary: false,
      createdAt: new Date(),
    });

    const handlers = createTestHandlers(services.services);
    const result = await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    });

    expect(result.near.hasNearAccount).toBe(true);
    expect(result.near.primaryAccountId).toBe("alice.test.near");
    expect(result.near.linkedAccounts).toHaveLength(2);
  });

  it("lists organizations for session user", async () => {
    const user = await createTestUser(services.services);
    const org1 = await createTestOrg(services.services, user.userId, { name: "Org 1" });
    const org2 = await createTestOrg(services.services, user.userId, { name: "Org 2" });

    const handlers = createTestHandlers(services.services);
    const result = (await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    })) as { organizations?: Array<{ id: string; role: string; name?: string; slug?: string }> };

    expect(result.organizations).toBeDefined();
    const orgIds = result.organizations!.map((o) => o.id);
    expect(orgIds).toContain(user.personalOrgId);
    expect(orgIds).toContain(org1.id);
    expect(orgIds).toContain(org2.id);
  });

  it("returns empty near capabilities for user without NEAR accounts", async () => {
    const user = await createTestUser(services.services);
    const handlers = createTestHandlers(services.services);

    const result = await handlers.session.getContext({
      context: { reqHeaders: user.reqHeaders },
    });

    expect(result.near.hasNearAccount).toBe(false);
    expect(result.near.primaryAccountId).toBeNull();
    expect(result.near.linkedAccounts).toHaveLength(0);
  });
});
