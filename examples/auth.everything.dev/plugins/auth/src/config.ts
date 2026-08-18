import type {
  DualNetworkConfig,
  RelayerConfig,
  RelayerDualNetworkConfig,
  SubAccountConfig,
} from "better-near-auth";
import type { AuthConfig } from "./auth-config";
import type { AuthPluginSecrets, AuthPluginVariables } from "./config-schemas";
import { localDevTrustedOrigins } from "./utils";

export function ensureOrigin(value: string): string | null {
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).origin;
    } catch {
      console.warn(`[Auth] Invalid origin URL: ${value}`);
      return null;
    }
  }
  const isLoopback =
    value === "localhost" ||
    value.startsWith("localhost:") ||
    value === "127.0.0.1" ||
    value.startsWith("127.0.0.1:") ||
    value === "::1" ||
    value.startsWith("[::1]");
  const host = value === "::1" ? "[::1]" : value;
  const withProtocol = isLoopback ? `http://${host}` : `https://${value}`;
  try {
    new URL(withProtocol);
    return withProtocol;
  } catch {
    console.warn(`[Auth] Invalid origin: ${value} (resolved to ${withProtocol})`);
    return null;
  }
}

export function parseTrustedOrigins(
  baseUrlInput?: string,
  trustedOriginsInput?: string[],
): { baseUrl: string; trustedOrigins: string[] } {
  const baseUrl = baseUrlInput ? ensureOrigin(baseUrlInput) : "http://localhost:3000";
  const origins: string[] = [];
  if (baseUrl) origins.push(baseUrl);
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    origins.push(...localDevTrustedOrigins);
  }

  for (const entry of trustedOriginsInput ?? []) {
    const trimmed = entry.trim();
    if (trimmed) {
      const origin = ensureOrigin(trimmed);
      if (origin) origins.push(origin);
    }
  }

  return { baseUrl: baseUrl ?? "http://localhost:3000", trustedOrigins: [...new Set(origins)] };
}

function pickDefined<T extends Record<string, unknown>>(obj: T | undefined): T | undefined {
  if (!obj) return undefined;
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) delete result[key];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function buildRelayerConfig(
  siwn: AuthPluginVariables["siwn"],
  secrets: AuthPluginSecrets,
): RelayerDualNetworkConfig | undefined {
  if (!siwn.relayer) return undefined;

  function resolveRelayerPrivateKey(
    config: { accountId?: string } | undefined,
    privateKey: string | undefined,
  ): RelayerConfig | undefined {
    const base = pickDefined(config);
    if (!base?.accountId) {
      return base as RelayerConfig | undefined;
    }
    if (!privateKey) {
      throw new Error(
        `Relayer accountId "${base.accountId}" is set but no NEAR_RELAYER_PRIVATE_KEY is configured for its network. ` +
          `Set the secret for that network or remove accountId to use ephemeral mode.`,
      );
    }
    return { ...base, privateKey };
  }

  return {
    mainnet: resolveRelayerPrivateKey(
      siwn.relayer.mainnet,
      secrets.NEAR_RELAYER_PRIVATE_KEY_MAINNET,
    ),
    testnet: resolveRelayerPrivateKey(
      siwn.relayer.testnet,
      secrets.NEAR_RELAYER_PRIVATE_KEY_TESTNET,
    ),
  };
}

export function buildSubAccountConfig(
  siwn: AuthPluginVariables["siwn"],
): DualNetworkConfig<SubAccountConfig> | undefined {
  if (!siwn.subAccount) return undefined;

  return {
    mainnet: pickDefined(siwn.subAccount.mainnet),
    testnet: pickDefined(siwn.subAccount.testnet),
  } as DualNetworkConfig<SubAccountConfig>;
}

export function buildSecrets(secrets: AuthPluginSecrets): AuthConfig["siwn"]["secrets"] {
  const parentKey = {
    mainnet: secrets.NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET,
    testnet: secrets.NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET,
  } as DualNetworkConfig<string>;
  return { parentKey } as AuthConfig["siwn"]["secrets"];
}

export function normalizeAuthConfig(
  variables: AuthPluginVariables,
  secrets: AuthPluginSecrets,
): { authConfig: AuthConfig; apiKeyHeaders: string[] } {
  const { baseUrl, trustedOrigins } = parseTrustedOrigins(
    variables.baseUrl,
    variables.trustedOrigins,
  );

  const relayer = buildRelayerConfig(variables.siwn, secrets);
  const subAccount = buildSubAccountConfig(variables.siwn);
  const secretsConfig = buildSecrets(secrets);
  const commonSiwn = {
    apiKey: variables.siwn.apiKey,
    rpcUrl: variables.siwn.rpcUrl,
    relayer,
    subAccount,
    secrets: secretsConfig,
  };

  const siwn =
    variables.siwn.recipients !== undefined
      ? {
          recipients: {
            mainnet: variables.siwn.recipients.mainnet,
            testnet: variables.siwn.recipients.testnet,
          },
          ...commonSiwn,
        }
      : {
          recipient: variables.siwn.recipient,
          ...commonSiwn,
        };

  const authConfig: AuthConfig = {
    secret: secrets.BETTER_AUTH_SECRET,
    baseUrl,
    trustedOrigins,
    isProduction: process.env.NODE_ENV === "production",
    socialProviders: {
      github: {
        clientId: variables.socialProviders?.github?.clientId,
        clientSecret: secrets.GITHUB_CLIENT_SECRET,
      },
      google: {
        clientId: variables.socialProviders?.google?.clientId,
        clientSecret: secrets.GOOGLE_CLIENT_SECRET,
      },
    },
    passkey: variables.passkey,
    phoneNumber:
      secrets.TWILIO_ACCOUNT_SID && secrets.TWILIO_AUTH_TOKEN && secrets.TWILIO_PHONE_NUMBER
        ? {
            twilio: {
              accountSid: secrets.TWILIO_ACCOUNT_SID,
              authToken: secrets.TWILIO_AUTH_TOKEN,
              phoneNumber: secrets.TWILIO_PHONE_NUMBER,
            },
          }
        : undefined,
    siwn: {
      ...siwn,
      apiKey: secrets.FASTNEAR_API_KEY,
    },
    email: variables.email?.from
      ? {
          from: variables.email.from,
        }
      : undefined,
  };

  return { authConfig, apiKeyHeaders: variables.apiKeyHeaders ?? ["x-api-key"] };
}
