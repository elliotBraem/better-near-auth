import FederatedPlugin from "@s2s/plugin";
import { createPluginRuntime } from "every-plugin";

const env = {
  NEAR_ACCOUNT_ID: process.env.NEAR_ACCOUNT_ID!,
  NEAR_PRIVATE_KEY: process.env.NEAR_PRIVATE_KEY!,
};

export const runtime = createPluginRuntime({
  registry: {
    "@s2s/plugin": {
      module: FederatedPlugin,
    },
  },
  secrets: env,
});

const federated = await runtime.usePlugin("@s2s/plugin", {
  variables: {
    serverName: "server-1",
    targetServerUrl: process.env.TARGET_SERVER_URL || "http://localhost:3002",
    targetRecipient: process.env.TARGET_SERVER_RECIPIENT || "better-near-auth.near",
    networkId: "testnet",
  },
  secrets: {
    accountId: "{{NEAR_ACCOUNT_ID}}",
    privateKey: "{{NEAR_PRIVATE_KEY}}",
  },
});

export const plugins = { federated } as const;
