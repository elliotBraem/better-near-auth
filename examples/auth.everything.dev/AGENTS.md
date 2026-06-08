<!-- intent-skills:start -->
# Skill mappings - load `use` with `npx @tanstack/intent@latest load <use>`.
skills:
  - when: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
    use: "@tanstack/devtools#devtools-app-setup"
  - when: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
    use: "@tanstack/devtools#devtools-marketplace"
  - when: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
    use: "@tanstack/devtools#devtools-plugin-panel"
  - when: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
    use: "@tanstack/devtools#devtools-production"
  - when: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
    use: "@tanstack/devtools-event-client#devtools-bidirectional"
  - when: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
    use: "@tanstack/devtools-event-client#devtools-event-client"
  - when: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
    use: "@tanstack/devtools-event-client#devtools-instrumentation"
  - when: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."
    use: "@tanstack/router-plugin#router-plugin"
  - when: "Load environment variables from a .env file into process.env for Node.js applications. Use when configuring apps with secrets, setting up local development environments, managing API keys and database uRLs, parsing .env file contents, or populating environment variables programmatically. Always use this skill when the user mentions .env, even for simple tasks like \"set up dotenv\" — the skill contains critical gotchas (encrypted keys, variable expansion, command substitution) that prevent common production issues."
    use: "dotenv#dotenv"
  - when: "Use dotenvx to run commands with environment variables, manage multiple .env files, expand variables, and encrypt env files for safe commits and CI/CD."
    use: "dotenv#dotenvx"
  - when: "Build every-plugin modules with oRPC contracts, Effect services, and Module Federation. Use when creating or modifying plugins under plugins/ or the _template scaffold."
    use: "every-plugin#plugin-development"
  - when: "Test every-plugin modules with vitest and the plugin runtime. Use when writing or modifying plugin tests under plugins/*/src/__tests__/ or plugins/*/tests/."
    use: "every-plugin#plugin-testing"
  - when: "Development workflow for everything-dev projects using bos dev, bos start, and the Module Federation runtime. Use when starting dev servers, debugging hot reload, or understanding the service-descriptor architecture."
    use: "everything-dev#dev-workflow"
  - when: "How bos.config.json extends chains work, deep merge semantics, resolved config lifecycle, env-specific parents, tenant runtime inheritance, or debugging config merge behavior."
    use: "everything-dev#extends-config"
  - when: "Scaffold a new project, extend an existing project from a parent runtime, sync upstream files, upgrade framework packages, or choose local override sections for ui/api/host/plugins."
    use: "everything-dev#init-upgrade"
  - when: "Build a super app with a shared host and shared API, set up fixed-core tenant mode, reason about extends-based runtime lineage, configure tenant UI overrides, or create custom tenant apps that extend a base runtime."
    use: "everything-dev#super-app"
  - when: "Publish bos.config.json to the FastKV registry, sync from upstream, and upgrade workspace packages. Use when deploying, syncing, or managing runtime configuration across projects."
    use: "everything-dev#publish-sync"
<!-- intent-skills:end -->

# Agent Instructions

This document provides operational guidance for AI agents working in the parent `everything.dev` repository.

## Quick Reference

**Start Development:**
```bash
cp .env.example .env   # First time only
bun install
bun run dev
```

**Sync and Publish:**
```bash
bos sync              # Pull updates from published config/template state
bos upgrade           # Check for new versions, update, then sync
bos publish           # Publish config to the FastKV registry
bos publish --deploy  # Build/deploy all workspaces, then publish
```

**Check Status:**
```bash
bos ps        # List running processes
bos status    # Project health check
bos info      # Show configuration
```

## Architecture

This is the parent **Module Federation monorepo** for `everything.dev`. The host is in this repository under `host/`. You may work across `/host`, `/ui`, `/api`, `/plugins`, and `/packages`.

```
┌─────────────────────────────────────────────────────────┐
│                    Host (Server)                        │
│  - Hono.js + oRPC router                               │
│  - Runtime config loader (bos.config.json)              │
│  - Module Federation host                               │
│  - every-plugin runtime                                │
└─────────────────────────────────────────────────────────┘
            ↓                ↓                ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│       UI         │ │  Auth Plugin     │ │  API + Plugins   │
│  - React 19      │ │  - every-plugin  │ │  - every-plugin  │
│  - TanStack      │ │  - Better-Auth   │ │  - oRPC contract │
│  - Module Fed.   │ │  - NEAR SIWN     │ │  - Effect svc    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

The host loads UI and API at runtime from URLs in `bos.config.json`. In production today, the host still boots one base `RuntimeConfig` snapshot at startup, but it can resolve tenant-specific UI overrides per request while keeping the server core fixed.

### Runtime Config

All runtime configuration lives in `bos.config.json`. The UI reads `window.__RUNTIME_CONFIG__` to get account, gateway, API base URL, etc. The host uses the same config to wire Module Federation remotes, auth, plugins, and SSR.

Use these helpers from `@/app`:
- `getAppName()` — active runtime title (falls back to account)
- `getAccount()` — NEAR account from config
- `getRepository()` — repository URL from config
- `getActiveRuntime()` — active runtime info (accountId, gatewayId, title)
- `getRuntimeConfig()` — full client config

Important: fixed-core tenant runtime composition now lives primarily in:
- `host/src/services/tenant-runtime.ts`
- `host/src/program.ts`
- `host/src/services/federation.server.ts`

Tenant model:
- `extends` is the lineage edge between runtimes
- `account` is the tenant namespace root for the active runtime
- `domain` is the public ingress for that runtime
- a runtime can extend another runtime and still become a new tenant root on its own domain

Current fixed-core host rules:
- the shared host still boots once from one base runtime snapshot
- child runtime config must extend the active BOS runtime
- supported request-scoped overrides are `ui`, existing `plugins.<id>.ui`, and existing `plugins.<id>.sidebar`
- tenant SSR is gated by `TENANT_WHITELIST` and `ALLOW_UNTRUSTED_SSR`
- nested label routing and account-relative tenant derivation are the intended architecture direction, but not the complete resolver behavior today

For full per-request host/plugin/auth/api swapping, start from `plans/runtime-config-hot-swap.md`.

## Development Workflow

### Typical Session
1. `bun run dev` to start development
2. UI available at http://localhost:3003, API at http://localhost:3001, Auth at http://localhost:3002
3. Check `.bos/logs/` for process logs if issues occur
4. Use `bos kill` to clean up processes when done

### Debugging Issues

**API not responding:**
- Check `bos ps` to see if API process is running
- Check `.bos/logs/api.log` for errors

**UI not loading:**
- Verify host is running: `bos ps`
- Check browser console for Module Federation errors
- Clear browser cache and retry

**Type errors:**
- Run `bun typecheck`
- Ensure `api/src/contract.ts` is in sync with UI usage

## Code Changes

### Making Changes
- **Host Changes**: Edit `host/src/` when changing runtime resolution, auth wiring, SSR, proxying, or plugin mounting
- **UI Changes**: Edit `ui/src/` files → hot reload automatically
- **API Changes**: Edit `api/src/` files → hot reload automatically
- **CLI/Scaffolding Changes**: Edit `packages/everything-dev/` when changing init/dev/publish flows or child-project scaffolding
- **New Components**: Create in `ui/src/components/ui/`, export from `ui/src/components/index.ts`
- **New Routes**: Create file in `ui/src/routes/`, TanStack Router auto-generates tree

### Style Requirements
- Use semantic Tailwind classes: `bg-background`, `text-foreground`, `text-muted-foreground`
- No hardcoded colors like `bg-blue-600`
- No code comments in implementation
- Follow existing patterns in neighboring files

### Adding API Endpoints
1. Define in `api/src/contract.ts` — the oRPC route definitions and Zod schemas
2. Implement in `api/src/index.ts` — the `createRouter` function
3. Use in UI via `apiClient` from `useApiClient()` in `@/app`

### Plugin Architecture

Business logic is organized into independent plugins loaded via Module Federation:
- **`api/`** — Thin structural shell: ping, authHealth, error routes, middleware definitions
- **`plugins/auth/`** — Authentication and authorization (Better-Auth, NEAR SIWN, organizations, API keys)
- **`plugins/registry/`** — FastKV app discovery, metadata publish/relay (no database)
- **`plugins/projects/`** — Project and organization management
- **`plugins/_template/`** — Scaffold for creating new plugins

Each plugin is self-contained with its own:
- `contract.ts` — oRPC route definitions and Zod schemas
- `index.ts` — `createPlugin` with variables, secrets, context, router
- rspack config for independent deployment

The UI accesses plugin routes via namespaced clients: `apiClient.registry.listRegistryApps()`, etc.

### Plugin Client (pluginsClient)

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips.

**Two-phase loading**: The host loads non-API plugins first (Phase 1), creates a `pluginsClient` map, then loads the API with that map injected (Phase 2). The host is generic — no plugin-specific code.

**Generated types**: `api/src/lib/plugins-types.gen.ts`, `api/src/lib/auth-types.gen.ts`, `ui/src/lib/api-types.gen.ts`, and `ui/src/lib/auth-types.gen.ts` are generated by `bos types gen` from `bos.config.json`. These files are gitignored and auto-regenerated on `bun install`, `typecheck`, `bos dev`, `bos build`, and `bos pluginAdd`/`pluginRemove`.

Plugin types resolve in two ways:
- `local:plugins/<name>` → reads `src/contract.ts` directly from disk
- Remote URL → fetches bundled types from the deployed plugin manifest

If you hand-edit `bos.config.json`, run `bos types gen` or restart `bos dev` to regenerate.

## Parent vs Child

This repo is the parent platform, not a generated child project.

- Prefer changing `host/` and `packages/everything-dev/` when the request is about runtime resolution, domain routing, config loading, CLI behavior, or scaffolding.
- Prefer changing child project repos when the request is about project-specific content, shell navigation, or app-specific plugin/sidebar composition.
- Do not assume the host is remote-only or out of tree; that is true for many child repos, not for this one.

## Changesets

**When to add a changeset:**
- Any user-facing change (features, fixes, deprecations)
- Breaking changes
- Skip for: docs-only changes, internal refactors, test-only changes

**Release flow:**
- Parent repo production releases run through `.github/workflows/packages-release.yml`, which creates or updates the `chore: version packages` PR when changesets are pending.
- After that version PR is merged, `packages-release.yml` calls `.github/workflows/release.yml`, which runs `bun run deploy`, publishes `bos.config.json` to FastKV, and commits the updated deployment URLs.
- Generated child repos use the same `CI` -> `Packages Release` -> `Release` pattern, but only version and deploy their local workspaces and runtime surfaces.

**Create changeset:**
```bash
bun run changeset
# Follow prompts to select packages and describe changes
```

## Testing & Quality

**Before committing:**
```bash
bun run test    # Run all tests
bun typecheck   # Type check all packages
bun lint        # Run linting
```

## Common Patterns

### Authentication Check
Routes requiring auth use `_authenticated.tsx` layout:
```typescript
export const Route = createFileRoute('/_layout/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { data: session } = await authClient.getSession();
    if (!session?.user) {
      throw redirect({ to: '/login', search: { redirect: location.pathname } });
    }
  },
});
```

### API Client Usage
```typescript
import { useApiClient } from "@/app";

function MyComponent() {
  const apiClient = useApiClient();
  const { data } = await apiClient.ping();
  const { data } = await apiClient.registry.listRegistryApps({ limit: 24 });
}
```

### App Name in UI
```typescript
import { getAppName } from "@/app";

// In a component (client-side only)
const appName = useClientValue(() => getAppName(), "app");

// In a head() function (server-side, from loaderData)
const { runtimeConfig } = Route.useLoaderData();
const appName = getActiveRuntime(runtimeConfig)?.title ?? getAccount(runtimeConfig);
```

## Security

### Shared Singleton Trust Model

Module Federation shares React, TanStack Query, and TanStack Router as singletons across remotes. A compromise of these packages affects all remotes simultaneously. Defense:

- **Catalog pinning** — versions are locked in root `package.json` catalogs. Bump versions deliberately, not reactively.
- **Renovate `minimumReleaseAge`** — 3 days general, 5 days for `@tanstack/*`. Malicious versions detected within hours are blocked from auto-merge.
- **Minor bumps never automerged** — supply chain attacks typically ship as minor version bumps. All minor updates require manual review.

### Dependency Security

- **Renovate** manages dependency updates for this parent repo (not Dependabot). Config: `.github/renovate.json`. New generated child repos no longer scaffold that config by default.
- **`--ignore-scripts`** — all CI workflows use `bun install --frozen-lockfile --ignore-scripts`. Lifecycle scripts (the TanStack attack vector) never execute during install.
- **`dependency-review-action`** runs on every PR to flag known vulnerabilities.
- **`bun audit`** runs in CI and fails on critical/high findings.
- **GitHub Actions pinned to commit SHAs** — all `uses:` references are SHA-pinned to prevent tag-hijacking attacks (e.g. tj-actions).

### Supply Chain Incident Response

If a dependency is compromised:

1. **Catalog pin protects all remotes** — all workspaces resolve from the same catalog, so pinning one version secures everything.
2. **Independent deployment enables instant containment** — update the compromised remote's URL in `bos.config.json` and publish. No host rebuild needed.
3. **On-chain config is verifiable** — `bos.config.json` is published to FastKV. URL changes are inspectable and auditable on-chain.
4. **Runtime isolation limits blast radius** — a compromised UI dep cannot access API database secrets or auth keys. Remotes run in separate processes.

### CI Hardening

- No `pull_request_target` in any workflow — prevents the "Pwn Request" cache-poisoning pattern used in the TanStack compromise.
- Secrets scoped to individual steps, not job-level env — limits exposure if any step is compromised.
- `id-token: write` removed from job-level permissions — only granted where explicitly needed.
- `permissions:` set to minimum required on every workflow.

## Troubleshooting

**Process won't start:**
```bash
bos kill        # Kill all tracked processes
bun install     # Ensure dependencies
bun run dev     # Restart
```

**Module Federation errors:**
- Check `bos.config.json` URLs are accessible
- Verify shared dependency versions match in package.json
- Clear browser cache

**Database issues:**
```bash
bun run db:push   # Push schema changes
bun run db:studio # Open Drizzle Studio
```

## Environment

**Required files:**
- `.env` - Secrets (see `.env.example`)
- `bos.config.json` - Runtime configuration (committed)

**Key ports:**
- 3003 - UI dev server
- 3001 - API dev server
