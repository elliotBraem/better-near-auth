import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRelayerConfig,
  buildSecrets,
  buildSubAccountConfig,
  ensureOrigin,
  normalizeAuthConfig,
  parseTrustedOrigins,
} from "../../src/config";
import type { AuthPluginSecrets, AuthPluginVariables } from "../../src/config-schemas";

const baseSecrets: AuthPluginSecrets = {
  AUTH_DATABASE_URL: "pglite::memory:",
  BETTER_AUTH_SECRET: "test-secret",
};

const baseVariables: AuthPluginVariables = {
  apiKeyHeaders: ["x-api-key"],
  siwn: {
    recipient: "test.near",
  },
};

describe("ensureOrigin", () => {
  it("returns origin for https URLs", () => {
    expect(ensureOrigin("https://example.com")).toBe("https://example.com");
  });

  it("returns origin for http URLs", () => {
    expect(ensureOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("strips path segments from URLs", () => {
    expect(ensureOrigin("https://example.com/auth/callback")).toBe("https://example.com");
  });

  it("treats bare localhost as http", () => {
    expect(ensureOrigin("localhost")).toBe("http://localhost");
  });

  it("treats localhost:port as http", () => {
    expect(ensureOrigin("localhost:8080")).toBe("http://localhost:8080");
  });

  it("treats 127.0.0.1 as http", () => {
    expect(ensureOrigin("127.0.0.1")).toBe("http://127.0.0.1");
  });

  it("treats 127.0.0.1:port as http", () => {
    expect(ensureOrigin("127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
  });

  it("treats ::1 as http with brackets", () => {
    expect(ensureOrigin("::1")).toBe("http://[::1]");
  });

  it("treats [::1] as http", () => {
    expect(ensureOrigin("[::1]")).toBe("http://[::1]");
  });

  it("treats [::1]:port as http", () => {
    expect(ensureOrigin("[::1]:4000")).toBe("http://[::1]:4000");
  });

  it("treats non-loopback bare domain as https", () => {
    expect(ensureOrigin("example.com")).toBe("https://example.com");
  });

  it("returns null for invalid URL", () => {
    expect(ensureOrigin("https://")).toBeNull();
  });

  it("returns null for invalid non-URL string", () => {
    expect(ensureOrigin("not a url")).toBeNull();
  });
});

describe("parseTrustedOrigins", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("defaults baseUrl to localhost:3000 when undefined", () => {
    const { baseUrl, trustedOrigins } = parseTrustedOrigins(undefined, undefined);
    expect(baseUrl).toBe("http://localhost:3000");
    expect(trustedOrigins).toContain("http://localhost:3000");
  });

  it("includes local dev origins in test environment", () => {
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", undefined);
    expect(trustedOrigins).toContain("http://localhost:3000");
    expect(trustedOrigins).toContain("http://127.0.0.1:3000");
    expect(trustedOrigins).toContain("http://[::1]:3000");
  });

  it("includes local dev origins in development environment", () => {
    process.env.NODE_ENV = "development";
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", undefined);
    expect(trustedOrigins).toContain("http://localhost:3000");
  });

  it("does not include local dev origins in production environment", () => {
    process.env.NODE_ENV = "production";
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", undefined);
    expect(trustedOrigins).not.toContain("http://localhost:3000");
    expect(trustedOrigins).not.toContain("http://127.0.0.1:3000");
  });

  it("parses trusted origins from input list", () => {
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", [
      "https://api.example.com",
      "localhost:4000",
    ]);
    expect(trustedOrigins).toContain("https://api.example.com");
    expect(trustedOrigins).toContain("http://localhost:4000");
  });

  it("deduplicates origins", () => {
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", ["https://example.com"]);
    const exampleCount = trustedOrigins.filter((o) => o === "https://example.com").length;
    expect(exampleCount).toBe(1);
  });

  it("skips empty/whitespace entries in trusted origins", () => {
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", [
      "  ",
      "",
      "https://valid.com",
    ]);
    expect(trustedOrigins).toContain("https://valid.com");
    expect(trustedOrigins).not.toContain("");
    expect(trustedOrigins).not.toContain("  ");
  });

  it("skips invalid origin entries", () => {
    const { trustedOrigins } = parseTrustedOrigins("https://example.com", [
      "https://",
      "https://valid.com",
    ]);
    expect(trustedOrigins).toContain("https://valid.com");
    expect(trustedOrigins).not.toContain("https://");
  });
});

describe("buildRelayerConfig", () => {
  it("returns undefined when relayer is not configured", () => {
    expect(buildRelayerConfig({ recipient: "test.near" }, baseSecrets)).toBeUndefined();
  });

  it("returns empty dual-network config when relayer is empty", () => {
    expect(buildRelayerConfig({ recipient: "test.near", relayer: {} }, baseSecrets)).toEqual({
      mainnet: undefined,
      testnet: undefined,
    });
  });

  it("resolves mainnet privateKey from NEAR_RELAYER_PRIVATE_KEY_MAINNET", () => {
    expect(
      buildRelayerConfig(
        { recipient: "test.near", relayer: { mainnet: { accountId: "relayer.near" } } },
        { ...baseSecrets, NEAR_RELAYER_PRIVATE_KEY_MAINNET: "ed25519:abc" },
      ),
    ).toEqual({
      mainnet: { accountId: "relayer.near", privateKey: "ed25519:abc" },
      testnet: undefined,
    });
  });

  it("resolves testnet privateKey from NEAR_RELAYER_PRIVATE_KEY_TESTNET", () => {
    expect(
      buildRelayerConfig(
        {
          recipient: "test.testnet",
          relayer: { testnet: { accountId: "relayer.testnet" } },
        },
        { ...baseSecrets, NEAR_RELAYER_PRIVATE_KEY_TESTNET: "ed25519:xyz" },
      ),
    ).toEqual({
      mainnet: undefined,
      testnet: { accountId: "relayer.testnet", privateKey: "ed25519:xyz" },
    });
  });

  it("throws when accountId is set but NEAR_RELAYER_PRIVATE_KEY_MAINNET is missing", () => {
    expect(() =>
      buildRelayerConfig(
        { recipient: "test.near", relayer: { mainnet: { accountId: "relayer.near" } } },
        baseSecrets,
      ),
    ).toThrow("NEAR_RELAYER_PRIVATE_KEY");
  });

  it("passes through ephemeral-only config (no accountId)", () => {
    expect(
      buildRelayerConfig(
        {
          recipient: "test.near",
          relayer: {
            mainnet: { whitelistedContracts: ["foo.near"] },
          },
        },
        baseSecrets,
      ),
    ).toEqual({
      mainnet: { whitelistedContracts: ["foo.near"] },
      testnet: undefined,
    });
  });
});

describe("buildSubAccountConfig", () => {
  it("returns undefined when subAccount is not configured", () => {
    expect(buildSubAccountConfig({ recipient: "test.near" })).toBeUndefined();
  });

  it("returns config with mainnet and testnet entries", () => {
    const result = buildSubAccountConfig({
      recipient: "test.near",
      subAccount: {
        mainnet: {
          parentAccount: "parent.near",
          minDeposit: "1",
        },
        testnet: {
          parentAccount: "parent.testnet",
        },
      },
    });
    expect(result).toEqual({
      mainnet: { parentAccount: "parent.near", minDeposit: "1" },
      testnet: { parentAccount: "parent.testnet" },
    });
  });

  it("strips undefined values from network config", () => {
    const result = buildSubAccountConfig({
      recipient: "test.near",
      subAccount: {
        mainnet: {
          parentAccount: "parent.near",
          minDeposit: undefined,
          parentHasFullAccess: undefined,
        },
      },
    });
    expect(result?.mainnet).toEqual({ parentAccount: "parent.near" });
  });

  it("returns undefined for empty network config after stripping", () => {
    const result = buildSubAccountConfig({
      recipient: "test.near",
      subAccount: {
        mainnet: {
          parentAccount: undefined,
          minDeposit: undefined,
        },
      },
    });
    expect(result?.mainnet).toBeUndefined();
  });

  it("handles missing testnet config", () => {
    const result = buildSubAccountConfig({
      recipient: "test.near",
      subAccount: {
        mainnet: { parentAccount: "parent.near" },
      },
    });
    expect(result?.mainnet).toEqual({ parentAccount: "parent.near" });
    expect(result?.testnet).toBeUndefined();
  });
});

describe("buildSecrets", () => {
  it("returns parentKey with mainnet and testnet from secrets", () => {
    const result = buildSecrets({
      ...baseSecrets,
      NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET: "key-mainnet",
      NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET: "key-testnet",
    });
    expect(result).toEqual({
      parentKey: {
        mainnet: "key-mainnet",
        testnet: "key-testnet",
      },
    });
  });

  it("returns undefined values when secrets are missing", () => {
    const result = buildSecrets(baseSecrets);
    expect(result).toEqual({
      parentKey: {
        mainnet: undefined,
        testnet: undefined,
      },
    });
  });
});

describe("normalizeAuthConfig", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("produces a valid auth config with required fields", () => {
    const { authConfig, apiKeyHeaders } = normalizeAuthConfig(baseVariables, baseSecrets);
    expect(authConfig.secret).toBe("test-secret");
    expect(authConfig.baseUrl).toBe("http://localhost:3000");
    expect(authConfig.trustedOrigins).toContain("http://localhost:3000");
    expect(authConfig.isProduction).toBe(false);
    expect(apiKeyHeaders).toEqual(["x-api-key"]);
  });

  it("uses recipient mode when recipient is set", () => {
    const { authConfig } = normalizeAuthConfig(
      { ...baseVariables, siwn: { recipient: "myapp.near" } },
      baseSecrets,
    );
    expect((authConfig.siwn as any).recipient).toBe("myapp.near");
    expect((authConfig.siwn as any).recipients).toBeUndefined();
  });

  it("uses recipients mode when recipients is set", () => {
    const { authConfig } = normalizeAuthConfig(
      {
        ...baseVariables,
        siwn: {
          recipients: { mainnet: "myapp.near", testnet: "myapp.testnet" },
        },
      } as AuthPluginVariables,
      baseSecrets,
    );
    expect((authConfig.siwn as any).recipients).toEqual({
      mainnet: "myapp.near",
      testnet: "myapp.testnet",
    });
    expect((authConfig.siwn as any).recipient).toBeUndefined();
  });

  it("passes relayer config through", () => {
    const { authConfig } = normalizeAuthConfig(
      {
        ...baseVariables,
        siwn: {
          recipient: "test.near",
          relayer: {
            mainnet: { accountId: "relayer.near" },
          },
        },
      },
      { ...baseSecrets, NEAR_RELAYER_PRIVATE_KEY_MAINNET: "ed25519:key" },
    );
    expect((authConfig.siwn as any).relayer).toEqual({
      mainnet: { accountId: "relayer.near", privateKey: "ed25519:key" },
      testnet: undefined,
    });
  });

  it("passes subAccount config through", () => {
    const { authConfig } = normalizeAuthConfig(
      {
        ...baseVariables,
        siwn: {
          recipient: "test.near",
          subAccount: {
            mainnet: { parentAccount: "parent.near" },
          },
        },
      },
      baseSecrets,
    );
    expect((authConfig.siwn as any).subAccount).toEqual({
      mainnet: { parentAccount: "parent.near" },
      testnet: undefined,
    });
  });

  it("includes secrets config with parentKey", () => {
    const { authConfig } = normalizeAuthConfig(baseVariables, {
      ...baseSecrets,
      NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET: "mk",
      NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET: "tk",
    });
    expect((authConfig.siwn as any).secrets).toEqual({
      parentKey: { mainnet: "mk", testnet: "tk" },
    });
  });

  it("uses FASTNEAR_API_KEY for siwn.apiKey", () => {
    const { authConfig } = normalizeAuthConfig(baseVariables, {
      ...baseSecrets,
      FASTNEAR_API_KEY: "fn-key",
    });
    expect(authConfig.siwn.apiKey).toBe("fn-key");
  });

  it("includes social providers when configured", () => {
    const { authConfig } = normalizeAuthConfig(
      {
        ...baseVariables,
        socialProviders: {
          github: { clientId: "gh-id" },
          google: { clientId: "goog-id" },
        },
      },
      {
        ...baseSecrets,
        GITHUB_CLIENT_SECRET: "gh-secret",
        GOOGLE_CLIENT_SECRET: "goog-secret",
      },
    );
    expect(authConfig.socialProviders?.github).toEqual({
      clientId: "gh-id",
      clientSecret: "gh-secret",
    });
    expect(authConfig.socialProviders?.google).toEqual({
      clientId: "goog-id",
      clientSecret: "goog-secret",
    });
  });

  it("includes twilio config when all twilio secrets are present", () => {
    const { authConfig } = normalizeAuthConfig(baseVariables, {
      ...baseSecrets,
      TWILIO_ACCOUNT_SID: "sid",
      TWILIO_AUTH_TOKEN: "token",
      TWILIO_PHONE_NUMBER: "+1234",
    });
    expect(authConfig.phoneNumber?.twilio).toEqual({
      accountSid: "sid",
      authToken: "token",
      phoneNumber: "+1234",
    });
  });

  it("omits twilio config when any twilio secret is missing", () => {
    const { authConfig } = normalizeAuthConfig(baseVariables, {
      ...baseSecrets,
      TWILIO_ACCOUNT_SID: "sid",
    });
    expect(authConfig.phoneNumber).toBeUndefined();
  });

  it("includes email config when email.from is set", () => {
    const { authConfig } = normalizeAuthConfig(
      { ...baseVariables, email: { from: "noreply@example.com" } },
      baseSecrets,
    );
    expect(authConfig.email).toEqual({ from: "noreply@example.com" });
  });

  it("omits email config when email is not set", () => {
    const { authConfig } = normalizeAuthConfig(baseVariables, baseSecrets);
    expect(authConfig.email).toBeUndefined();
  });

  it("passes passkey config through", () => {
    const { authConfig } = normalizeAuthConfig(
      {
        ...baseVariables,
        passkey: { rpID: "example.com", rpName: "Example", origin: "https://example.com" },
      },
      baseSecrets,
    );
    expect(authConfig.passkey).toEqual({
      rpID: "example.com",
      rpName: "Example",
      origin: "https://example.com",
    });
  });

  it("uses custom apiKeyHeaders when provided", () => {
    const { apiKeyHeaders } = normalizeAuthConfig(
      { ...baseVariables, apiKeyHeaders: ["x-custom-key", "x-other"] },
      baseSecrets,
    );
    expect(apiKeyHeaders).toEqual(["x-custom-key", "x-other"]);
  });

  it("defaults apiKeyHeaders to x-api-key", () => {
    const { apiKeyHeaders } = normalizeAuthConfig(baseVariables, baseSecrets);
    expect(apiKeyHeaders).toEqual(["x-api-key"]);
  });

  it("sets isProduction based on NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    const { authConfig } = normalizeAuthConfig(baseVariables, baseSecrets);
    expect(authConfig.isProduction).toBe(true);
  });
});
