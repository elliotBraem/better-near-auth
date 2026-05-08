import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Generator, getConfig } from "@tanstack/router-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

interface BosConfig {
  app?: Record<string, { development?: string; name?: string }>;
  plugins?: Record<string, { development?: string }>;
}

function readBosConfig(): BosConfig {
  const configPath = path.join(rootDir, "bos.config.json");
  return JSON.parse(readFileSync(configPath, "utf8")) as BosConfig;
}

function getLocalPlugins(config: BosConfig): Array<{ key: string; path: string }> {
  const plugins: Array<{ key: string; path: string }> = [];

  // App-level plugins (e.g., auth)
  if (config.app) {
    for (const [key, value] of Object.entries(config.app)) {
      if (key === "host" || key === "ui" || key === "api") continue;
      if (value.development?.startsWith("local:")) {
        plugins.push({ key, path: value.development.replace("local:", "") });
      }
    }
  }

  // Explicit plugins section
  if (config.plugins) {
    for (const [key, value] of Object.entries(config.plugins)) {
      if (value.development?.startsWith("local:")) {
        plugins.push({ key, path: value.development.replace("local:", "") });
      }
    }
  }

  return plugins;
}

async function generateRouteTree() {
  const uiDir = path.join(rootDir, "ui");
  const config = getConfig(
    {
      target: "react",
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    },
    uiDir,
  );

  const generator = new Generator({ config, root: uiDir });
  await generator.run();
  console.log("Generated ui/src/routeTree.gen.ts");
}

function generateApiContract(plugins: Array<{ key: string; path: string }>) {
  const lines: string[] = [
    'import type { ContractType as BaseApiContract } from "../../api/src/contract.ts";',
  ];

  for (const plugin of plugins) {
    lines.push(
      `import type { ContractType as ${plugin.key}Contract } from "../../${plugin.path}/src/contract.ts";`,
    );
  }

  lines.push("");
  lines.push("export type ApiContract = BaseApiContract & {");
  for (const plugin of plugins) {
    lines.push(`  ${plugin.key}: ${plugin.key}Contract;`);
  }
  lines.push("};");

  const outputPath = path.join(rootDir, "ui", "src", "api-contract.gen.ts");
  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log("Generated ui/src/api-contract.gen.ts");
}

function generateAuthTypes(plugins: Array<{ key: string; path: string }>) {
  const authPlugin = plugins.find((p) => p.key === "auth");
  if (!authPlugin) return;

  const content = `export type { createAuthInstance } from "../../${authPlugin.path}/src/auth-export.ts";\n`;
  const outputPath = path.join(rootDir, "ui", "src", "auth-types.gen.ts");
  writeFileSync(outputPath, content);
  console.log("Generated ui/src/auth-types.gen.ts");
}

function generateAuthClient(plugins: Array<{ key: string; path: string }>) {
  const authPlugin = plugins.find((p) => p.key === "auth");
  if (!authPlugin) return;

  const lines = [
    `import type { ContractType as authContract } from "../../${authPlugin.path}/src/contract.ts";`,
    'import type { ContractRouterClient, AnyContractRouter } from "@orpc/contract";',
    "type ClientFactory<C extends AnyContractRouter> = (context?: Record<string, unknown>) => ContractRouterClient<C>;",
    "",
    "export type AuthClient = ClientFactory<authContract>;",
    "",
  ];

  const outputPath = path.join(rootDir, "api", "src", "auth-client.gen.ts");
  writeFileSync(outputPath, lines.join("\n"));
  console.log("Generated api/src/auth-client.gen.ts");
}

function generatePluginsClient(plugins: Array<{ key: string; path: string }>) {
  const lines: string[] = [];

  for (const plugin of plugins) {
    lines.push(
      `import type { ContractType as ${plugin.key}Contract } from "../../${plugin.path}/src/contract.ts";`,
    );
  }

  lines.push('import type { ContractRouterClient, AnyContractRouter } from "@orpc/contract";');
  lines.push(
    "type ClientFactory<C extends AnyContractRouter> = (context?: Record<string, unknown>) => ContractRouterClient<C>;",
  );
  lines.push("");
  lines.push("export type PluginsClient = {");
  for (const plugin of plugins) {
    lines.push(`  ${plugin.key}: ClientFactory<${plugin.key}Contract>;`);
  }
  lines.push("};");

  const outputPath = path.join(rootDir, "api", "src", "plugins-client.gen.ts");
  writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log("Generated api/src/plugins-client.gen.ts");
}

async function main() {
  const config = readBosConfig();
  const plugins = getLocalPlugins(config);

  // Ensure directories exist
  mkdirSync(path.join(rootDir, "ui", "src"), { recursive: true });
  mkdirSync(path.join(rootDir, "api", "src"), { recursive: true });

  await generateRouteTree();
  generateApiContract(plugins);
  generateAuthTypes(plugins);
  generateAuthClient(plugins);
  generatePluginsClient(plugins);

  console.log("Postinstall generation complete.");
}

main().catch((err) => {
  console.error("Postinstall generation failed:", err);
  process.exit(1);
});
