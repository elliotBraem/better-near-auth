import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import bosConfig from "../../bos.config.json" with { type: "json" };
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

function splitList(value?: string) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const configuredSiwn = bosConfig.app?.auth?.variables?.siwn;
const mainnetRecipient =
  process.env.ACCOUNT || configuredSiwn?.recipients?.mainnet || bosConfig.account;
const testnetRecipient =
  process.env.TESTNET_ACCOUNT || configuredSiwn?.recipients?.testnet || bosConfig.testnet;

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3002,
  config: {
    variables: {
      baseUrl: process.env.BASE_URL || process.env.DOMAIN || "http://localhost:3000",
      trustedOrigins: splitList(process.env.TRUSTED_ORIGINS || process.env.CORS_ORIGIN),
      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
        },
      },
      passkey: {
        rpID: process.env.PASSKEY_RP_ID,
        rpName: process.env.PASSKEY_RP_NAME,
        origin: process.env.PASSKEY_ORIGIN,
      },
      siwn: {
        ...(testnetRecipient
          ? {
              recipients: {
                mainnet: mainnetRecipient,
                testnet: testnetRecipient,
              },
            }
          : {
              recipient: mainnetRecipient,
            }),
        rpcUrl: process.env.NEAR_RPC_URL,
        relayer: {
          accountId: process.env.NEAR_RELAYER_ACCOUNT_ID,
        },
        subAccount: {
          mainnet: {
            parentAccount: process.env.NEAR_SUB_ACCOUNT_PARENT_MAINNET,
          },
          testnet: {
            parentAccount: process.env.NEAR_SUB_ACCOUNT_PARENT_TESTNET,
          },
        },
      },
    },
    secrets: {
      AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL || "pglite:.bos/auth/:memory:",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET || "dev-only-secret-do-not-use-in-production",
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      FASTNEAR_API_KEY: process.env.FASTNEAR_API_KEY,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
      NEAR_RELAYER_PRIVATE_KEY: process.env.NEAR_RELAYER_PRIVATE_KEY,
      NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET: process.env.NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET,
      NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET: process.env.NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET,
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
