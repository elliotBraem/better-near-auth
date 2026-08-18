import { hex } from "@scure/base";
import { generateKey, Near } from "near-kit";
import { EMPTY_CODE_HASH, Sandbox } from "near-kit/sandbox";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestServices } from "../helpers";

describe("NEAR SIWN Sandbox Integration", () => {
  let sandbox: Awaited<ReturnType<typeof Sandbox.start>>;
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
    const { driver } = await createTestServices();

    expect(driver).toBeDefined();
    await driver.close();
  }, 30000);

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

    const { services, driver } = await createTestServices({
      siwn: { recipient: TEST_RECIPIENT, rpcUrl: sandbox.rpcUrl },
    });

    const nonceRes = (await services.auth.api.getSiwnNonce({
      body: { accountId: TEST_ACCOUNT, networkId: "mainnet" },
    })) as unknown as { nonce: string };

    expect(nonceRes.nonce).toBeDefined();

    const nonceBytes = hex.decode(nonceRes.nonce);
    const message = `Sign in to ${TEST_RECIPIENT}`;
    const signedMessage = keyPair.signNep413Message!(TEST_ACCOUNT, {
      message,
      recipient: TEST_RECIPIENT,
      nonce: nonceBytes,
    });

    const verifyRaw = await services.auth.api.verifySiwnMessage({
      request: new Request("http://localhost:3000/api/auth/near/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedMessage,
          message,
          recipient: TEST_RECIPIENT,
          nonce: nonceRes.nonce,
          accountId: TEST_ACCOUNT,
        }),
      }),
      body: {
        signedMessage,
        message,
        recipient: TEST_RECIPIENT,
        nonce: nonceRes.nonce,
        accountId: TEST_ACCOUNT,
      },
    });
    const verifyRes = (verifyRaw instanceof Response ? await verifyRaw.json() : verifyRaw) as {
      success: boolean;
      token: string;
      user: { accountId: string };
    };

    expect(verifyRes.success).toBe(true);
    expect(verifyRes.token).toBeDefined();
    expect(verifyRes.user.accountId).toBe(TEST_ACCOUNT);

    const cookie = verifyRaw instanceof Response ? verifyRaw.headers.get("set-cookie") || "" : "";
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);

    const accountsRes = (await services.auth.api.listNearAccounts({ headers })) as {
      accounts: Array<{ accountId: string }>;
    };

    expect(accountsRes.accounts).toHaveLength(1);
    expect(accountsRes.accounts[0]?.accountId).toBe(TEST_ACCOUNT);

    await driver.close();
  }, 60000);

  it("link -> list -> unlink -> list accounts", async () => {
    const PRIMARY_ACCOUNT = "carol.test.near";
    const SECONDARY_ACCOUNT = "carol2.test.near";
    const TEST_RECIPIENT = "test.near";
    const keyPair2 = generateKey();

    await sandbox.patchState([
      {
        Account: {
          account_id: PRIMARY_ACCOUNT,
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
          account_id: PRIMARY_ACCOUNT,
          public_key: keyPair.publicKey.toString(),
          access_key: { nonce: 0, permission: "FullAccess" },
        },
      },
      {
        Account: {
          account_id: SECONDARY_ACCOUNT,
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
          account_id: SECONDARY_ACCOUNT,
          public_key: keyPair2.publicKey.toString(),
          access_key: { nonce: 0, permission: "FullAccess" },
        },
      },
    ]);

    await sandbox.fastForward(1);

    const { services, driver } = await createTestServices({
      siwn: { recipient: TEST_RECIPIENT, rpcUrl: sandbox.rpcUrl },
    });

    const nonceRes = (await services.auth.api.getSiwnNonce({
      body: { accountId: PRIMARY_ACCOUNT, networkId: "mainnet" },
    })) as unknown as { nonce: string };

    const nonceBytes = hex.decode(nonceRes.nonce);
    const message = `Sign in to ${TEST_RECIPIENT}`;
    const signedMessage = keyPair.signNep413Message!(PRIMARY_ACCOUNT, {
      message,
      recipient: TEST_RECIPIENT,
      nonce: nonceBytes,
    });

    const verifyRaw = await services.auth.api.verifySiwnMessage({
      request: new Request("http://localhost:3000/api/auth/near/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedMessage,
          message,
          recipient: TEST_RECIPIENT,
          nonce: nonceRes.nonce,
          accountId: PRIMARY_ACCOUNT,
        }),
      }),
      body: {
        signedMessage,
        message,
        recipient: TEST_RECIPIENT,
        nonce: nonceRes.nonce,
        accountId: PRIMARY_ACCOUNT,
      },
    });
    const cookie = verifyRaw instanceof Response ? verifyRaw.headers.get("set-cookie") || "" : "";
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);

    let accountsRes = (await services.auth.api.listNearAccounts({ headers })) as {
      accounts: Array<{ accountId: string }>;
    };
    expect(accountsRes.accounts).toHaveLength(1);

    const linkNonceRes = (await services.auth.api.getSiwnNonce({
      body: { accountId: SECONDARY_ACCOUNT, networkId: "mainnet" },
    })) as unknown as { nonce: string };
    const linkNonceBytes = hex.decode(linkNonceRes.nonce);
    const linkSignedMessage = keyPair2.signNep413Message!(SECONDARY_ACCOUNT, {
      message,
      recipient: TEST_RECIPIENT,
      nonce: linkNonceBytes,
    });

    const linkRes = await services.auth.api.linkNearAccount({
      request: new Request("http://localhost:3000/api/auth/near/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedMessage: linkSignedMessage,
          message,
          recipient: TEST_RECIPIENT,
          nonce: linkNonceRes.nonce,
          accountId: SECONDARY_ACCOUNT,
        }),
      }),
      headers,
      body: {
        signedMessage: linkSignedMessage,
        message,
        recipient: TEST_RECIPIENT,
        nonce: linkNonceRes.nonce,
        accountId: SECONDARY_ACCOUNT,
      },
    });
    const linkResult = (linkRes instanceof Response ? await linkRes.json() : linkRes) as {
      success: boolean;
    };
    expect(linkResult.success).toBe(true);

    accountsRes = (await services.auth.api.listNearAccounts({ headers })) as {
      accounts: Array<{ accountId: string }>;
    };
    expect(accountsRes.accounts).toHaveLength(2);
    const accountIds = accountsRes.accounts.map((a) => a.accountId);
    expect(accountIds).toContain(PRIMARY_ACCOUNT);
    expect(accountIds).toContain(SECONDARY_ACCOUNT);

    const unlinkRes = await services.auth.api.unlinkNearAccount({
      headers,
      body: { accountId: SECONDARY_ACCOUNT, network: "mainnet" },
    });
    const unlinkResult = (unlinkRes instanceof Response ? await unlinkRes.json() : unlinkRes) as {
      success: boolean;
    };
    expect(unlinkResult.success).toBe(true);

    accountsRes = (await services.auth.api.listNearAccounts({ headers })) as {
      accounts: Array<{ accountId: string }>;
    };
    expect(accountsRes.accounts).toHaveLength(1);
    expect(accountsRes.accounts[0]?.accountId).toBe(PRIMARY_ACCOUNT);

    await driver.close();
  }, 60000);
});
