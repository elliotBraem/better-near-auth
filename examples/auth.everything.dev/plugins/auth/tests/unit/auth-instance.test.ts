import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../../src/auth-config";
import {
  buildSiwnOptions,
  isRecipientsConfig,
  resolvePasskeyRelyingPartyOptions,
} from "../../src/auth-instance";

describe("resolvePasskeyRelyingPartyOptions", () => {
  it("derives localhost relying party options from baseUrl", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
      }),
    ).toEqual({
      rpID: "localhost",
      rpName: "Everything Dev",
      origin: "http://localhost:3000",
    });
  });

  it("drops path segments when deriving production origin", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "https://everything.dev/auth",
      }),
    ).toEqual({
      rpID: "everything.dev",
      rpName: "Everything Dev",
      origin: "https://everything.dev",
    });
  });

  it("normalizes explicit passkey overrides", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkey: {
          origin: "https://auth.example.com/passkey",
          rpID: "https://example.com:443",
          rpName: "Example Auth",
        },
      }),
    ).toEqual({
      rpID: "example.com",
      rpName: "Example Auth",
      origin: "https://auth.example.com",
    });
  });

  it("treats localhost origins without a protocol as http", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkey: { origin: "localhost:3000" },
      }),
    ).toMatchObject({
      rpID: "localhost",
      origin: "http://localhost:3000",
    });
  });

  it("throws a descriptive error for invalid passkey origin", () => {
    expect(() =>
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkey: { origin: "https://" },
      }),
    ).toThrow('Invalid passkey origin value: "https://"');
  });

  it("throws a descriptive error for invalid passkey RP ID", () => {
    expect(() =>
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkey: { rpID: "https://" },
      }),
    ).toThrow('Invalid passkey RP ID value: "https://"');
  });
});

const baseConfig: AuthConfig = {
  secret: "test-secret",
  baseUrl: "http://localhost:3000",
  siwn: { recipient: "test.near" },
};

describe("isRecipientsConfig", () => {
  it("returns true when recipients is defined", () => {
    expect(
      isRecipientsConfig({
        recipients: { mainnet: "app.near", testnet: "app.testnet" },
      }),
    ).toBe(true);
  });

  it("returns false when recipients is undefined", () => {
    expect(isRecipientsConfig({ recipient: "test.near" })).toBe(false);
  });

  it("returns false when recipients is not present", () => {
    expect(isRecipientsConfig({ recipient: "test.near" })).toBe(false);
  });

  it("returns false when recipients is null", () => {
    expect(isRecipientsConfig({ recipient: "test.near", recipients: undefined })).toBe(false);
  });
});

describe("buildSiwnOptions", () => {
  it("builds recipient-mode options from recipient config", () => {
    const result = buildSiwnOptions(baseConfig);
    expect(result.recipient).toBe("test.near");
    expect((result as any).recipients).toBeUndefined();
  });

  it("builds recipients-mode options from dual-network config", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: {
        recipients: { mainnet: "app.near", testnet: "app.testnet" },
      } as any,
    };
    const result = buildSiwnOptions(config);
    expect((result as any).recipients).toEqual({
      mainnet: "app.near",
      testnet: "app.testnet",
    });
    expect((result as any).recipient).toBeUndefined();
  });

  it("passes apiKey through", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: { recipient: "test.near", apiKey: "fn-key" } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.apiKey).toBe("fn-key");
  });

  it("passes rpcUrl through", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: { recipient: "test.near", rpcUrl: "https://rpc.testnet.near.org" } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.rpcUrl).toBe("https://rpc.testnet.near.org");
  });

  it("builds relayer config when accountId is present", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: {
        recipient: "test.near",
        relayer: { accountId: "relayer.near", privateKey: "ed25519:abc" },
      } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.relayer).toEqual({
      accountId: "relayer.near",
      privateKey: "ed25519:abc",
    });
  });

  it("omits relayer when accountId is missing", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: { recipient: "test.near" } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.relayer).toBeUndefined();
  });

  it("passes subAccount through", () => {
    const subAccount = {
      mainnet: { parentAccount: "parent.near" },
      testnet: { parentAccount: "parent.testnet" },
    };
    const config: AuthConfig = {
      ...baseConfig,
      siwn: { recipient: "test.near", subAccount } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.subAccount).toEqual(subAccount);
  });

  it("passes secrets through", () => {
    const secrets = { parentKey: { mainnet: "mk", testnet: "tk" } };
    const config: AuthConfig = {
      ...baseConfig,
      siwn: { recipient: "test.near", secrets } as any,
    };
    const result = buildSiwnOptions(config);
    expect(result.secrets).toEqual(secrets);
  });

  it("handles recipients mode with relayer", () => {
    const config: AuthConfig = {
      ...baseConfig,
      siwn: {
        recipients: { mainnet: "app.near", testnet: "app.testnet" },
        relayer: { accountId: "relayer.near", privateKey: "ed25519:key" },
      } as any,
    };
    const result = buildSiwnOptions(config);
    expect((result as any).recipients).toEqual({
      mainnet: "app.near",
      testnet: "app.testnet",
    });
    expect(result.relayer).toEqual({
      accountId: "relayer.near",
      privateKey: "ed25519:key",
    });
  });
});
