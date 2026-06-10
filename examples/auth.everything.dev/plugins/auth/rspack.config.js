import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import DrizzleORMMigrations from "@proj-airi/unplugin-drizzle-orm-migrations/rspack";
import {
  EmitPluginManifest,
  EveryPluginDevServer,
  FixMfDataUriPlugin,
} from "every-plugin/build/rspack";
import { computeSriHashForUrl } from "everything-dev/integrity";
import { withZephyr } from "zephyr-rspack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shouldDeploy = process.env.DEPLOY === "true";

function _normalizePath(input) {
  return input.replace(/\\/g, "/").replace(/\/+$/, "");
}

function updateBosConfig(url, integrity) {
  try {
    const configPath = path.resolve(__dirname, "../../bos.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    if (config.app?.auth) {
      config.app.auth.production = url;
      if (integrity) {
        config.app.auth.integrity = integrity;
      } else {
        delete config.app.auth.integrity;
      }
      fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      console.log(`   ✅ Updated bos.config.json: auth.production`);
      if (integrity) {
        console.log(`   ✅ Updated bos.config.json: auth.integrity`);
      }
    }
  } catch (err) {
    console.error("   ❌ Failed to update bos.config.json:", err.message);
  }
}

const baseConfig = {
  externals: ["pg", "@electric-sql/pglite", "@opentelemetry/api"],
  devtool: shouldDeploy ? false : "source-map",
  plugins: [
    new EmitPluginManifest({
      additionalExports: [
        {
          srcPath: "auth-export.d.ts",
          exportNames: [
            "Auth",
            "AuthSession",
            "AuthConfig",
            "AuthDatabase",
            "DatabaseDriver",
            "createAuthInstance",
            "AuthServices",
          ],
        },
      ],
    }),
    new EveryPluginDevServer({ dts: false }),
    new FixMfDataUriPlugin(),
    DrizzleORMMigrations(),
  ],
  infrastructureLogging: {
    level: "error",
  },
  stats: "errors-warnings",
};

export default shouldDeploy
  ? withZephyr({
      hooks: {
        onDeployComplete: async (info) => {
          console.log("🚀 Auth Plugin Deployed:", info.url);
          const integrity = await computeSriHashForUrl(info.url);
          updateBosConfig(info.url, integrity ?? undefined);
        },
      },
    })(baseConfig)
  : baseConfig;
