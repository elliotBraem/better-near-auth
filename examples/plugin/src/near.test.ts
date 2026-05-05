import { describe, expect, it, beforeAll, afterAll } from "vitest";

/**
 * NEAR SIWN Sandbox Integration Tests
 *
 * These tests require the plugin to be mounted in a workspace with
 * every-plugin and near-kit dependencies available.
 *
 * They run against a local NEAR sandbox node, providing fully isolated,
 * deterministic testing without needing testnet accounts.
 *
 * Run in the mounted workspace: pnpm test
 */

// Dynamically import plugin modules so tests can be skipped if deps are missing
let pluginModules: {
  createDatabaseDriver: typeof import("../src/db/driver").createDatabaseDriver;
  createAuthInstance: typeof import("../src/auth-instance").createAuthInstance;
  migrate: typeof import("../src/db/migrator").migrate;
  schema: typeof import("../src/db/schema");
} | null = null;

let sandboxModules: {
  Sandbox: typeof import("near-kit/sandbox").Sandbox;
  EMPTY_CODE_HASH: string;
} | null = null;

let nearKitModules: {
  Near: typeof import("near-kit").Near;
  generateKey: typeof import("near-kit").generateKey;
  generateNonce: typeof import("near-kit").generateNonce;
  hex: typeof import("@scure/base").hex;
} | null = null;

const TEST_ACCOUNT = "alice.test.near";
const TEST_RECIPIENT = "test.near";
const TEST_DB_URL = "file:./test-auth-sandbox.db";

// Try to load dependencies
try {
  const driverMod = await import("../src/db/driver");
  const authMod = await import("../src/auth-instance");
  const migratorMod = await import("../src/db/migrator");
  const schemaMod = await import("../src/db/schema");

  pluginModules = {
    createDatabaseDriver: driverMod.createDatabaseDriver,
    createAuthInstance: authMod.createAuthInstance,
    migrate: migratorMod.migrate,
    schema: schemaMod,
  };

  const sandboxMod = await import("near-kit/sandbox");
  sandboxModules = {
    Sandbox: sandboxMod.Sandbox,
    EMPTY_CODE_HASH: sandboxMod.EMPTY_CODE_HASH,
  };

  const nearMod = await import("near-kit");
  const baseMod = await import("@scure/base");
  nearKitModules = {
    Near: nearMod.Near,
    generateKey: nearMod.generateKey,
    generateNonce: nearMod.generateNonce,
    hex: baseMod.hex,
  };
} catch {
  // Dependencies not available in this repo — tests will be skipped
}

describe("NEAR SIWN Sandbox Integration", () => {
  // Skip all tests if dependencies aren't available
  const itIfDeps = pluginModules && sandboxModules && nearKitModules ? it : it.skip;

  beforeAll(async () => {
    if (!pluginModules || !sandboxModules || !nearKitModules) {
      console.log("[SKIP] Plugin dependencies not available. Run in mounted workspace.");
      return;
    }

    // Setup will be done in individual tests
  }, 60000);

  afterAll(async () => {
    // Cleanup handled per-test
  });

  describe("Dependencies", () => {
    itIfDeps("should have plugin modules available", () => {
      expect(pluginModules).not.toBeNull();
      expect(sandboxModules).not.toBeNull();
      expect(nearKitModules).not.toBeNull();
    });
  });

  describe("Sandbox Setup", () => {
    itIfDeps("should create a test account with full access key", async () => {
      if (!sandboxModules || !nearKitModules) return;

      const sandbox = await sandboxModules.Sandbox.start({ detached: false });
      const near = new nearKitModules.Near({ network: sandbox });
      const keyPair = nearKitModules.generateKey();

      await sandbox.patchState([
        {
          Account: {
            account_id: TEST_ACCOUNT,
            account: {
              amount: "1000000000000000000000000000",
              locked: "0",
              code_hash: sandboxModules.EMPTY_CODE_HASH,
              storage_usage: 100,
            },
          },
        },
        {
          AccessKey: {
            account_id: TEST_ACCOUNT,
            public_key: keyPair.publicKey.toString(),
            access_key: {
              nonce: 0,
              permission: "FullAccess",
            },
          },
        },
      ]);

      const exists = await near.accountExists(TEST_ACCOUNT);
      expect(exists).toBe(true);

      const key = await near.getAccessKey(TEST_ACCOUNT, keyPair.publicKey.toString());
      expect(key?.permission).toBe("FullAccess");

      await sandbox.stop();
    });
  });

  describe("Full SIWN Flow", () => {
    itIfDeps("nonce -> sign -> verify -> list accounts", async () => {
      if (!pluginModules || !sandboxModules || !nearKitModules) return;

      // 1. Start sandbox
      const sandbox = await sandboxModules.Sandbox.start({ detached: false });
      const near = new nearKitModules.Near({ network: sandbox });
      const keyPair = nearKitModules.generateKey();

      // 2. Create test account
      await sandbox.patchState([
        {
          Account: {
            account_id: TEST_ACCOUNT,
            account: {
              amount: "1000000000000000000000000000",
              locked: "0",
              code_hash: sandboxModules.EMPTY_CODE_HASH,
              storage_usage: 100,
            },
          },
        },
        {
          AccessKey: {
            account_id: TEST_ACCOUNT,
            public_key: keyPair.publicKey.toString(),
            access_key: {
              nonce: 0,
              permission: "FullAccess",
            },
          },
        },
      ]);

      // 3. Create auth instance with better-sqlite3 driver
      const driver = pluginModules.createDatabaseDriver(TEST_DB_URL, {
        driver: "better-sqlite3",
      });

      // Run migrations
      const migrations = await import("virtual:drizzle-migrations.sql").catch(() => ({ default: [] }));
      await pluginModules.migrate(driver, migrations.default || []);

      const auth = pluginModules.createAuthInstance(
        {
          account: TEST_RECIPIENT,
          hostUrl: "http://localhost:3000",
        },
        driver.db,
      );

      // 4. Get nonce via auth API
      const nonceRes = await (auth.api as any).getSiwnNonce({
        body: { accountId: TEST_ACCOUNT, networkId: "testnet" },
      });
      expect(nonceRes.nonce).toBeDefined();

      // 5. Sign with keypair
      const nonceBytes = nearKitModules.hex.decode(nonceRes.nonce);
      const message = `Sign in to ${TEST_RECIPIENT}`;

      if (!keyPair.signNep413Message) {
        throw new Error("KeyPair does not support NEP-413 signing");
      }

      const signedMessage = keyPair.signNep413Message(TEST_ACCOUNT, {
        message,
        recipient: TEST_RECIPIENT,
        nonce: nonceBytes,
      });

      // 6. Verify
      const verifyRes = await (auth.api as any).verifySiwnMessage({
        body: {
          signedMessage,
          message,
          recipient: TEST_RECIPIENT,
          nonce: nonceRes.nonce,
          accountId: TEST_ACCOUNT,
        },
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.token).toBeDefined();
      expect(verifyRes.user.accountId).toBe(TEST_ACCOUNT);

      // 7. List accounts
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${verifyRes.token}`);

      const accountsRes = await (auth.api as any).listNearAccounts({ headers });
      expect(accountsRes.accounts.length).toBe(1);
      expect(accountsRes.accounts[0].accountId).toBe(TEST_ACCOUNT);

      // Cleanup
      driver.close();
      await sandbox.stop();
    }, 120000);
  });
});
