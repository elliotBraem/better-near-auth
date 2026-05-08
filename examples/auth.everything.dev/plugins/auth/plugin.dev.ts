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
      domain: process.env.DOMAIN || "http://localhost:3000",
      githubClientId: process.env.GITHUB_CLIENT_ID,
      githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
    secrets: {
      AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL || "pglite:.bos/auth/:memory:",
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET || "dev-only-secret-do-not-use-in-production",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
