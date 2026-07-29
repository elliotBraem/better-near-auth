import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Near, generateKey, generateNonce } from "near-kit";
import { Sandbox, EMPTY_CODE_HASH } from "near-kit/sandbox";
import { hex } from "@scure/base";
import { createDatabaseDriver } from "../../src/db";
import { createAuthInstance } from "../../src/auth-instance";

const TEST_DB_URL = "pglite::memory:";

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-secret-do-not-use-in-production";

describe("NEAR SIWN Sandbox Integration", () => {
  let sandbox: InstanceType<typeof Sandbox>;
  let keyPair: ReturnType<typeof generateKey>;

  beforeAll(async () => {
    sandbox = await Sandbox.start({ detached: false });
    keyPair = generateKey();
  }, 30000);

  afterAll(async () => {
    await sandbox.stop();
  });

  it("sandbox responds to RPC", async () => {
    const near = new Near({ network: sandbox });
    const status = await near.getStatus();
    expect(status).toBeDefined();
    expect(status.chain_id).toBeDefined();
  });

  it("creates auth instance with pglite driver", async () => {
    const driver = await createDatabaseDriver(TEST_DB_URL);
    const auth = createAuthInstance(
      {
        secret: process.env.BETTER_AUTH_SECRET!,
        baseUrl: "http://localhost:3000",
        siwn: { recipient: "test.near" },
      },
      driver.db,
    );

    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();

    await driver.close();
  });

  it("nonce -> sign -> verify -> list accounts", async () => {
    const TEST_ACCOUNT = "alice.test.near";
    const TEST_RECIPIENT = "test.near";

    await sandbox.patchState([
      {
        Account: {
          account_id: TEST_ACCOUNT,
          account: {
            amount: "1000000000000000000000000000",
            locked: "0",
            code_hash: EMPTY_CODE_HASH,
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

    await sandbox.fastForward(1);

    const near = new Near({ network: sandbox });
    const exists = await near.accountExists(TEST_ACCOUNT);
    expect(exists).toBe(true);

    const driver = await createDatabaseDriver(TEST_DB_URL);
    const auth = createAuthInstance(
      {
        secret: process.env.BETTER_AUTH_SECRET!,
        baseUrl: "http://localhost:3000",
        siwn: { recipient: TEST_RECIPIENT, rpcUrl: sandbox.rpcUrl },
      },
      driver.db,
    );

    const nonceRes = (await auth.api.getSiwnNonce({
      body: { accountId: TEST_ACCOUNT, networkId: sandbox.networkId },
    })) as { nonce: string };

    expect(nonceRes.nonce).toBeDefined();

    const nonceBytes = hex.decode(nonceRes.nonce);
    const message = `Sign in to ${TEST_RECIPIENT}`;
    const signedMessage = keyPair.signNep413Message!(TEST_ACCOUNT, {
      message,
      recipient: TEST_RECIPIENT,
      nonce: nonceBytes,
    });

    const verifyRes = (await auth.api.verifySiwnMessage({
      body: {
        signedMessage,
        message,
        recipient: TEST_RECIPIENT,
        nonce: nonceRes.nonce,
        accountId: TEST_ACCOUNT,
      },
    })) as { success: boolean; token: string; user: { accountId: string } };

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.token).toBeDefined();
    expect(verifyRes.user.accountId).toBe(TEST_ACCOUNT);

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${verifyRes.token}`);

    const accountsRes = (await auth.api.listNearAccounts({ headers })) as {
      accounts: Array<{ accountId: string }>;
    };

    expect(accountsRes.accounts).toHaveLength(1);
    expect(accountsRes.accounts[0].accountId).toBe(TEST_ACCOUNT);

    await driver.close();
  }, 60000);
});
