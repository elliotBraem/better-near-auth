/**
 * Rspack configuration with Module Federation for the API remote.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import DrizzleORMMigrations from "@proj-airi/unplugin-drizzle-orm-migrations/rspack";
import {
  EmitPluginManifest,
  EveryPluginDevServer,
  FixMfDataUriPlugin,
} from "every-plugin/build/rspack";
import { computeSriHashForUrl, reportDeployResult } from "everything-dev/integrity";
import { withZephyr } from "zephyr-rspack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shouldDeploy = process.env.DEPLOY === "true";

const resolvedConfigPath = path.resolve(__dirname, "../.bos/bos.resolved-config.json");
const bosConfigPath = path.resolve(__dirname, "../bos.config.json");

function readBosConfig() {
  const configPath = fs.existsSync(resolvedConfigPath) ? resolvedConfigPath : bosConfigPath;
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (raw._resolved) {
    const { _resolved, ...data } = raw;
    return data;
  }
  return raw;
}

const _bosConfig = readBosConfig();

const baseConfig = {
  externals: ["pg", "@electric-sql/pglite"],
  devtool: shouldDeploy ? false : "source-map",
  plugins: [
    new EmitPluginManifest(),
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
          console.log("🚀 API Deployed:", info.url);
          const integrity = await computeSriHashForUrl(info.url);
          reportDeployResult({
            url: info.url,
            integrity,
            bosConfigPath: bosConfigPath,
            urlField: "app.api.production",
            integrityField: "app.api.integrity",
          });
        },
      },
    })(baseConfig)
  : baseConfig;
