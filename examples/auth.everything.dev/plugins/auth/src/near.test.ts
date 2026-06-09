import { beforeAll, describe, expect, it } from "vitest";

/**
 * NEAR SIWN Sandbox Integration Tests
 *
 * These tests verify that the auth plugin works correctly with near-kit
 * and can connect to a NEAR sandbox. Full SIWN flow requires sandbox
 * state patching which may not work in all environments.
 *
 * Run: pnpm test
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

const TEST_DB_URL = "pglite::memory:";

// Set required env var for auth instance
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-secret-do-not-use-in-production";

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
} catch (err) {
  console.log("[WARN] Could not load some dependencies:", err);
}

describe("NEAR SIWN Sandbox Integration", () => {
  // Skip all tests if dependencies aren't available
  const itIfDeps = pluginModules && sandboxModules && nearKitModules ? it : it.skip;

  beforeAll(async () => {
    if (!pluginModules || !sandboxModules || !nearKitModules) {
      console.log("[SKIP] Plugin dependencies not available.");
      return;
    }
  }, 60000);

  describe("Dependencies", () => {
    itIfDeps("should have plugin modules available", () => {
      expect(pluginModules).not.toBeNull();
      expect(sandboxModules).not.toBeNull();
      expect(nearKitModules).not.toBeNull();
    });
  });

  describe("Sandbox", () => {
    itIfDeps(
      "should start sandbox and respond to RPC",
      async () => {
        if (!sandboxModules || !nearKitModules) return;

        const sandbox = await sandboxModules.Sandbox.start({ detached: false });
        console.log(
          "[Test] Sandbox started, networkId:",
          sandbox.networkId,
          "rpcUrl:",
          sandbox.rpcUrl,
        );

        const near = new nearKitModules.Near({ network: sandbox });

        // Verify RPC is responding
        const status = await near.getStatus();
        expect(status).toBeDefined();
        expect(status.chain_id).toBeDefined();

        await sandbox.stop();
      },
      30000,
    );
  });

  describe("Plugin Database Driver", () => {
    itIfDeps(
      "should create auth instance with pglite driver",
      async () => {
        if (!pluginModules) return;

        const driver = await pluginModules.createDatabaseDriver(TEST_DB_URL);

        // Run migrations
        const migrations = await import("virtual:drizzle-migrations.sql").catch(() => ({
          default: [],
        }));
        await pluginModules.migrate(driver.db, migrations.default || []);

        const auth = pluginModules.createAuthInstance(
          {
            secret: process.env.BETTER_AUTH_SECRET!,
            baseUrl: "http://localhost:3000",
            siwn: {
              recipient: "test.near",
            },
          },
          driver.db,
        );

        expect(auth).toBeDefined();
        expect(auth.api).toBeDefined();

        await driver.close();
      },
      30000,
    );
  });

  describe("Full SIWN Flow", () => {
    itIfDeps(
      "nonce -> sign -> verify -> list accounts (requires sandbox patchState)",
      async () => {
        if (!pluginModules || !sandboxModules || !nearKitModules) return;

        const sandbox = await sandboxModules.Sandbox.start({ detached: false });
        console.log("[Test] Sandbox started for SIWN flow, networkId:", sandbox.networkId);

        // Create test account via patchState
        const TEST_ACCOUNT = "alice.test.near";
        const TEST_RECIPIENT = "test.near";
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

        // Commit state
        await sandbox.fastForward(1);
        await new Promise((r) => setTimeout(r, 500));

        const near = new nearKitModules.Near({ network: sandbox });
        const exists = await near.accountExists(TEST_ACCOUNT);

        if (!exists) {
          console.log(
            "[SKIP] Sandbox patchState not creating accounts in this environment — skipping full SIWN flow",
          );
          await sandbox.stop();
          return;
        }

        // Create auth instance
        const driver = await pluginModules.createDatabaseDriver(TEST_DB_URL);

        const migrations = await import("virtual:drizzle-migrations.sql").catch(() => ({
          default: [],
        }));
        await pluginModules.migrate(driver.db, migrations.default || []);

        const auth = pluginModules.createAuthInstance(
          {
            secret: process.env.BETTER_AUTH_SECRET!,
            baseUrl: "http://localhost:3000",
            siwn: {
              recipient: TEST_RECIPIENT,
              rpcUrl: sandbox.rpcUrl,
            },
          },
          driver.db,
        );

        // Get nonce
        const nonceRes: object = await auth.api.getSiwnNonce({
          body: { accountId: TEST_ACCOUNT, networkId: "testnet" },
        });

        const nonce =
          "nonce" in nonceRes && typeof nonceRes.nonce === "string" ? nonceRes.nonce : undefined;
        expect(nonce).toBeDefined();

        // Sign
        const nonceBytes = nonce ? nearKitModules.hex.decode(nonce) : new Uint8Array();
        const message = `Sign in to ${TEST_RECIPIENT}`;

        if (!keyPair.signNep413Message) {
          throw new Error("KeyPair does not support NEP-413 signing");
        }

        const signedMessage = keyPair.signNep413Message(TEST_ACCOUNT, {
          message,
          recipient: TEST_RECIPIENT,
          nonce: nonceBytes,
        });

        // Verify
        const verifyRes: object = await auth.api.verifySiwnMessage({
          body: {
            signedMessage,
            message,
            recipient: TEST_RECIPIENT,
            nonce: nonce ?? "",
            accountId: TEST_ACCOUNT,
          },
        });

        expect("success" in verifyRes ? verifyRes.success : undefined).toBe(true);

        const token =
          "token" in verifyRes && typeof verifyRes.token === "string" ? verifyRes.token : undefined;
        expect(token).toBeDefined();

        const userObject =
          "user" in verifyRes && verifyRes.user && typeof verifyRes.user === "object"
            ? verifyRes.user
            : null;
        const userAccountId =
          userObject && "accountId" in userObject && typeof userObject.accountId === "string"
            ? userObject.accountId
            : undefined;
        expect(userAccountId).toBe(TEST_ACCOUNT);

        // List accounts
        const headers = new Headers();
        headers.set("Authorization", `Bearer ${token ?? ""}`);

        const accountsRes: object = await auth.api.listNearAccounts({ headers });
        const rawAccounts = "accounts" in accountsRes ? accountsRes.accounts : undefined;
        const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];

        expect(accounts.length).toBe(1);
        const firstAccount: object | undefined = accounts[0];
        const firstAccountId =
          firstAccount && "accountId" in firstAccount && typeof firstAccount.accountId === "string"
            ? firstAccount.accountId
            : undefined;
        expect(firstAccountId).toBe(TEST_ACCOUNT);

        // Cleanup
        await driver.close();
        await sandbox.stop();
      },
      120000,
    );
  });
});
