import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("API key handlers", () => {
  describe("createApiKey", () => {
    it("creates a user API key", async () => {
      const user = await createTestUser(services.services);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.createApiKey({
        input: { name: "My User Key" },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^api_/);
      expect(result.name).toBe("My User Key");
    });

    it("creates an org API key when organizationId is provided", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.createApiKey({
        input: { name: "My Org Key", organizationId: org.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.key).toBeDefined();
      expect(result.key).toMatch(/^org_/);
    });
  });

  describe("verifyApiKey", () => {
    it("verifies a valid user key with explicit configId", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, { userId: user.userId });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: apiKey.key, configId: "user-keys" },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(true);
      expect(result.key).not.toBeNull();
      expect(result.key?.configId).toBe("user-keys");
    });

    it("verifies a valid org key with explicit configId", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const apiKey = await createTestApiKey(services.services, {
        userId: user.userId,
        organizationId: org.id,
      });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: apiKey.key, configId: "org-keys" },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(true);
      expect(result.key).not.toBeNull();
      expect(result.key?.configId).toBe("org-keys");
    });

    it("finds valid key via configId fallback loop", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, { userId: user.userId });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: apiKey.key },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(true);
    });

    it("finds org key via configId fallback loop", async () => {
      const user = await createTestUser(services.services);
      const org = await createTestOrg(services.services, user.userId);
      const apiKey = await createTestApiKey(services.services, {
        userId: user.userId,
        organizationId: org.id,
      });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: apiKey.key },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(true);
    });

    it("returns invalid for non-existent key", async () => {
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: "api_nonexistent" },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("KEY_NOT_FOUND");
    });

    it("returns invalid for wrong configId", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, { userId: user.userId });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.verifyApiKey({
        input: { key: apiKey.key, configId: "org-keys" },
        context: { reqHeaders: {} },
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("listApiKeys", () => {
    it("lists API keys for a user", async () => {
      const user = await createTestUser(services.services);
      await createTestApiKey(services.services, { userId: user.userId, name: "Key 1" });
      await createTestApiKey(services.services, { userId: user.userId, name: "Key 2" });
      const handlers = createTestHandlers(services.services);

      const result = (await handlers.apiKeys.listApiKeys({
        input: {},
        context: { reqHeaders: user.reqHeaders },
      })) as Array<{ id: string; name: string | null }>;

      expect(result).toHaveLength(2);
      expect(result.map((k) => k.name)).toContain("Key 1");
      expect(result.map((k) => k.name)).toContain("Key 2");
    });
  });

  describe("updateApiKey", () => {
    it("updates an API key name", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, {
        userId: user.userId,
        name: "Old Name",
      });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.updateApiKey({
        input: { id: apiKey.id, name: "New Name" },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.name).toBe("New Name");
    });

    it("disables an API key", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, {
        userId: user.userId,
        name: "Disable Me",
      });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.updateApiKey({
        input: { id: apiKey.id, enabled: false },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.enabled).toBe(false);
    });
  });

  describe("deleteApiKey", () => {
    it("deletes an API key", async () => {
      const user = await createTestUser(services.services);
      const apiKey = await createTestApiKey(services.services, {
        userId: user.userId,
        name: "Delete Me",
      });
      const handlers = createTestHandlers(services.services);

      const result = await handlers.apiKeys.deleteApiKey({
        input: { id: apiKey.id },
        context: { reqHeaders: user.reqHeaders },
      });

      expect(result.success).toBe(true);
    });
  });
});
