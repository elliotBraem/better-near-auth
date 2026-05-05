import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3021,
  config: {
    variables: {
      account: process.env.ACCOUNT || "dev.everything.near",
      hostUrl: process.env.HOST_URL || "http://localhost:3000",
      uiUrl: process.env.UI_URL || "http://localhost:3002",
    },
    secrets: {
      AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL || "file:./auth.db",
      AUTH_DATABASE_AUTH_TOKEN: process.env.AUTH_DATABASE_AUTH_TOKEN || undefined,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET || "dev-only-secret-do-not-use-in-production",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
