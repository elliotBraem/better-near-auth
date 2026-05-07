import "dotenv/config";
import type { PluginConfigInput } from "every-plugin";
import packageJson from "./package.json" with { type: "json" };
import type Plugin from "./src/index";

export default {
  pluginId: packageJson.name,
  port: Number(process.env.PORT) || 3002,
  config: {
    variables: {
      account: process.env.ACCOUNT || "dev.everything.near",
      hostUrl: process.env.HOST_URL || "http://localhost:3000",
      uiUrl: process.env.UI_URL || "http://localhost:3003",
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    secrets: {
      AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL || ":memory:",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET || "dev-only-secret-do-not-use-in-production",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
