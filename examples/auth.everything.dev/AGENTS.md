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
  - when: "Publish bos.config.json to the FastKV registry, sync from upstream, and upgrade workspace packages. Use when deploying, syncing, or managing runtime configuration across projects."
    use: "everything-dev#publish-sync"
<!-- intent-skills:end -->

# Agent Instructions

This document provides operational guidance for AI agents working on a BOS project scaffolded via `bos init`.

## Quick Reference

**Start Development:**
```bash
cp .env.example .env   # First time only
bun install
bun run dev
```

**Sync from Parent:**
```bash
bos sync              # Pull updates from parent template
bos upgrade           # Check for new versions, update, then sync
bos status            # Show project health (extends, versions, .env, last sync)
```

**Publish:**
```bash
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

This is a **Module Federation monorepo** with runtime-loaded configuration. The host is **remote** — it is not in this repository. You work on `/ui`, `/api`, and `/plugins` (auth, registry, projects, opencode, etc.).

```
┌─────────────────────────────────────────────────────────┐
│                    Host (Remote)                        │
│  - Hono.js + oRPC router                               │
│  - Runtime config loader (bos.config.json)              │
│  - Module Federation host                               │
│  - every-plugin runtime                                │
└─────────────────────────────────────────────────────────┘
            ↓                ↓                ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    UI (Local)    │ │  Auth Plugin     │ │  API + Plugins   │
│  - React 19      │ │  - every-plugin  │ │  - every-plugin  │
│  - TanStack      │ │  - Better-Auth   │ │  - oRPC contract │
│  - Module Fed.   │ │  - NEAR SIWN     │ │  - Effect svc    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

The host loads UI and API at runtime from URLs in `bos.config.json`. No rebuild is needed when URLs change.

### Runtime Config

All runtime configuration lives in `bos.config.json`. The UI reads `window.__RUNTIME_CONFIG__` to get account, gateway, API base URL, etc.

Use these helpers from `@/app`:
- `getAppName()` — active runtime title (falls back to account)
- `getAccount()` — NEAR account from config
- `getRepository()` — repository URL from config
- `getActiveRuntime()` — active runtime info (accountId, gatewayId, title)
- `getRuntimeConfig()` — full client config

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
- **UI Changes**: Edit `ui/src/` files → hot reload automatically
- **API Changes**: Edit `api/src/` files → hot reload automatically
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
3. Use in UI via `apiClient` from `useApiClient()` hook

### Plugin Architecture

Business logic is organized into independent plugins loaded via Module Federation:
- **`api/`** — Thin structural shell: ping, authHealth, error routes, middleware definitions
- **`plugins/auth/`** — Authentication and authorization (Better-Auth, NEAR SIWN, organizations, API keys)
- **`plugins/registry/`** — FastKV app discovery, metadata publish/relay (no database)
- **`plugins/projects/`** — Project and organization management
- **`plugins/opencode/`** — AI dev loop integration
- **`plugins/_template/`** — Scaffold for creating new plugins

Each plugin is self-contained with its own:
- `contract.ts` — oRPC route definitions and Zod schemas
- `index.ts` — `createPlugin` with variables, secrets, context, router
- rspack config for independent deployment

The UI accesses plugin routes via namespaced clients: `apiClient.registry.listRegistryApps()`, etc.

### Plugin Client (pluginsClient)

The API plugin receives typed client factories for all other plugins via `createPlugin.withPlugins<PluginsClient>()`, enabling in-process composition without HTTP roundtrips.

**Two-phase loading**: The host loads non-API plugins first (Phase 1), creates a `pluginsClient` map, then loads the API with that map injected (Phase 2). The host is generic — no plugin-specific code.

**Generated types**: `api/src/plugins-client.gen.ts` and `ui/src/api-contract.gen.ts` are generated by `bos types gen` from `bos.config.json`. These files are gitignored and auto-regenerated on `bun install`, `typecheck`, `bos dev`, `bos build`, and `bos pluginAdd`/`pluginRemove`.

Plugin types resolve in two ways:
- `local:plugins/<name>` → reads `src/contract.ts` directly from disk
- Remote URL → fetches bundled types from the deployed plugin manifest

If you hand-edit `bos.config.json`, run `bos types gen` or restart `bos dev` to regenerate.

## Changesets

**When to add a changeset:**
- Any user-facing change (features, fixes, deprecations)
- Breaking changes
- Skip for: docs-only changes, internal refactors, test-only changes

**Create changeset:**
```bash
bun run changeset
# Follow prompts to select packages and describe changes
```

## Testing & Quality

**Before committing:**
```bash
bun test        # Run all tests
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
import { useApiClient } from "@/lib/use-api-client";

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
