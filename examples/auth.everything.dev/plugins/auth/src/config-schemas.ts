import { z } from "every-plugin/zod";

export const API_KEY_CONFIG_IDS = ["user-keys", "org-keys"] as const;

export const subAccountNetworkSchema = z.object({
  parentAccount: z.string().optional(),
  parentHasFullAccess: z.boolean().optional(),
  minDeposit: z.string().optional(),
  deploy: z
    .object({
      fromPublished: z
        .object({
          accountId: z.string().optional(),
          codeHash: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  init: z
    .object({
      methodName: z.string(),
      args: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  addRelayerFCAK: z.boolean().optional(),
  relayerFCAK: z
    .object({
      receiverId: z.string(),
      methodNames: z.array(z.string()).optional(),
      allowance: z.string().optional(),
    })
    .optional(),
});

export const relayerNetworkSchema = z.object({
  accountId: z.string().optional(),
  whitelistedContracts: z.array(z.string()).optional(),
  maxGasPerTransaction: z.string().optional(),
  maxDepositPerTransaction: z.string().optional(),
});

export const authSiwnBaseSchema = z.object({
  apiKey: z.string().optional(),
  rpcUrl: z.string().optional(),
  relayer: z
    .object({
      mainnet: relayerNetworkSchema.optional(),
      testnet: relayerNetworkSchema.optional(),
    })
    .optional(),
  subAccount: z
    .object({
      mainnet: subAccountNetworkSchema.optional(),
      testnet: subAccountNetworkSchema.optional(),
    })
    .optional(),
});

export const authSiwnRecipientSchema = authSiwnBaseSchema.extend({
  recipient: z.string(),
  recipients: z.never().optional(),
});

export const authSiwnRecipientsSchema = authSiwnBaseSchema.extend({
  recipient: z.never().optional(),
  recipients: z.object({
    mainnet: z.string(),
    testnet: z.string(),
  }),
});

export const authVariablesSchema = z.object({
  baseUrl: z.string().optional(),
  trustedOrigins: z.array(z.string()).optional(),
  apiKeyHeaders: z.array(z.string()).default(["x-api-key"]),
  socialProviders: z
    .object({
      github: z
        .object({
          clientId: z.string().optional(),
        })
        .optional(),
      google: z
        .object({
          clientId: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  passkey: z
    .object({
      rpID: z.string().optional(),
      rpName: z.string().optional(),
      origin: z.string().optional(),
    })
    .optional(),
  siwn: z.union([authSiwnRecipientSchema, authSiwnRecipientsSchema]),
  email: z
    .object({
      from: z.string(),
    })
    .optional(),
});

export const authSecretsSchema = z.object({
  AUTH_DATABASE_URL: z.string(),
  BETTER_AUTH_SECRET: z.string(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FASTNEAR_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  NEAR_RELAYER_PRIVATE_KEY_MAINNET: z.string().optional(),
  NEAR_RELAYER_PRIVATE_KEY_TESTNET: z.string().optional(),
  NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET: z.string().optional(),
  NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export type AuthPluginVariables = z.infer<typeof authVariablesSchema>;
export type AuthPluginSecrets = z.infer<typeof authSecretsSchema>;
