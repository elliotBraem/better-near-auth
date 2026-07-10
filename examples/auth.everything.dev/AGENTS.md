<!-- intent-skills:start -->
# TanStack Intent - before editing files, run the matching guidance command.
tanstackIntent:
  - id: "@tanstack/devtools#devtools-app-setup"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools#devtools-app-setup"
    for: "Install TanStack Devtools, pick framework adapter (React/Vue/Solid/Preact), register plugins via plugins prop, configure shell (position, hotkeys, theme, hideUntilHover, requireUrlFlag, eventBusConfig). TanStackDevtools component, defaultOpen, localStorage persistence."
  - id: "@tanstack/devtools#devtools-marketplace"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools#devtools-marketplace"
    for: "Publish plugin to npm and submit to TanStack Devtools Marketplace. PluginMetadata registry format, plugin-registry.ts, pluginImport (importName, type), requires (packageName, minVersion), framework tagging, multi-framework submissions, featured plugins."
  - id: "@tanstack/devtools#devtools-plugin-panel"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools#devtools-plugin-panel"
    for: "Build devtools panel components that display emitted event data. Listen via EventClient.on(), handle theme (light/dark), use @tanstack/devtools-ui components. Plugin registration (name, render, id, defaultOpen), lifecycle (mount, activate, destroy), max 3 active plugins. Two paths: Solid.js core with devtools-ui for multi-framework support, or framework-specific panels."
  - id: "@tanstack/devtools#devtools-production"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools#devtools-production"
    for: "Handle devtools in production vs development. removeDevtoolsOnBuild, devDependency vs regular dependency, conditional imports, NoOp plugin variants for tree-shaking, non-Vite production exclusion patterns."
  - id: "@tanstack/devtools-event-client#devtools-bidirectional"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-bidirectional"
    for: "Two-way event patterns between devtools panel and application. App-to-devtools observation, devtools-to-app commands, time-travel debugging with snapshots and revert. structuredClone for snapshot safety, distinct event suffixes for observation vs commands, serializable payloads only."
  - id: "@tanstack/devtools-event-client#devtools-event-client"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-event-client"
    for: "Create typed EventClient for a library. Define event maps with typed payloads, pluginId auto-prepend namespacing, emit()/on()/onAll()/onAllPluginEvents() API. Connection lifecycle (5 retries, 300ms), event queuing, enabled/disabled state, SSR fallbacks, singleton pattern. Unique pluginId requirement to avoid event collisions."
  - id: "@tanstack/devtools-event-client#devtools-instrumentation"
    run: "bunx @tanstack/intent@latest load @tanstack/devtools-event-client#devtools-instrumentation"
    for: "Analyze library codebase for critical architecture and debugging points, add strategic event emissions. Identify middleware boundaries, state transitions, lifecycle hooks. Consolidate events (1 not 15), debounce high-frequency updates, DRY shared payload fields, guard emit() for production. Transparent server/client event bridging."
  - id: "better-near-auth#client"
    run: "bunx @tanstack/intent@latest load better-near-auth#client"
    for: "Set up the siwnClient plugin for Better Auth client, configure NEAR wallet connection via NearConnect, use authClient.near actions for sign-in, profile lookup, account management, delegate action building with TransactionBuilder, and relay submission. Load when implementing NEAR wallet sign-in on the client, using authClient.near.* methods, or building delegate actions for gasless relay."
  - id: "better-near-auth#relay"
    run: "bunx @tanstack/intent@latest load better-near-auth#relay"
    for: "Configure the gasless NEP-366 delegate action relayer in ephemeral or explicit mode, relay signed delegate actions on-chain, enforce contract whitelisting and gas/deposit limits, check relay status and history, and use the contract view endpoint. Load when setting up relayer config, debugging relay failures, or configuring RotatingKeyStore for high-throughput relay."
  - id: "better-near-auth#siwn"
    run: "bunx @tanstack/intent@latest load better-near-auth#siwn"
    for: "Set up the SIWN server plugin for Better Auth, configure NEP-413 authentication with recipient and API key, handle nonce generation, signature verification, account linking and unlinking, and NEAR profile lookup. Load when adding NEAR wallet sign-in to a Better Auth server, configuring siwn() plugin options, or debugging NEP-413 verify or nonce issues."
  - id: "better-near-auth#tanstack"
    run: "bunx @tanstack/intent@latest load better-near-auth#tanstack"
    for: "Integrate better-near-auth with TanStack Router (SSR or CSR). Set up auth client as a router context singleton, useAuthClient hook, session query options, inferred types from AuthClient, and ensureConnected before signing. Load when scaffolding a new TanStack Router app with better-near-auth, wiring auth into router context, or debugging wallet state loss after sign-in in SSR/CSR TanStack apps."
  - id: "dotenv#dotenv"
    run: "bunx @tanstack/intent@latest load dotenv#dotenv"
    for: "Load environment variables from a .env file into process.env for Node.js applications. Use when configuring apps with secrets, setting up local development environments, managing API keys and database uRLs, parsing .env file contents, or populating environment variables programmatically. Always use this skill when the user mentions .env, even for simple tasks like \"set up dotenv\" — the skill contains critical gotchas (encrypted keys, variable expansion, command substitution) that prevent common production issues."
  - id: "dotenv#dotenvx"
    run: "bunx @tanstack/intent@latest load dotenv#dotenvx"
    for: "Use dotenvx to run commands with environment variables, manage multiple .env files, expand variables, and encrypt env files for safe commits and CI/CD."
  - id: "every-plugin#plugin-development"
    run: "bunx @tanstack/intent@latest load every-plugin#plugin-development"
    for: "Build every-plugin modules with oRPC contracts, Effect services, and Module Federation. Use when creating or modifying plugins under plugins/ or the _template scaffold."
  - id: "every-plugin#plugin-testing"
    run: "bunx @tanstack/intent@latest load every-plugin#plugin-testing"
    for: "Test every-plugin modules with vitest and the plugin runtime. Use when writing or modifying plugin tests under plugins/*/src/__tests__/ or plugins/*/tests/."
  - id: "everything-dev#api-and-auth"
    run: "bunx @tanstack/intent@latest load everything-dev#api-and-auth"
    for: "API architecture, oRPC contracts, auth middleware, plugin-client composition, session handling, and client-side auth. Use when adding API routes, creating middleware, calling other plugins in-process, or integrating auth in routes and UI."
  - id: "everything-dev#cli-reference"
    run: "bunx @tanstack/intent@latest load everything-dev#cli-reference"
    for: "Quick reference for all bos CLI commands — flags, options, environment settings, and links to detailed guidance in related skills. Use when any bos command comes up or the user needs a CLI overview."
  - id: "everything-dev#code-style"
    run: "bunx @tanstack/intent@latest load everything-dev#code-style"
    for: "Code style conventions for everything-dev projects — component file naming (kebab-case, lowercase), CSS (semantic Tailwind only, no hardcoded colors), no comments in implementation, import/export conventions, and following neighboring file patterns."
  - id: "everything-dev#dev-workflow"
    run: "bunx @tanstack/intent@latest load everything-dev#dev-workflow"
    for: "Development workflow for everything-dev projects using bos dev, bos start, and the Module Federation runtime. Use when starting dev servers, debugging hot reload, or understanding the service-descriptor architecture."
  - id: "everything-dev#extends-config"
    run: "bunx @tanstack/intent@latest load everything-dev#extends-config"
    for: "How bos.config.json extends chains work, deep merge semantics, resolved config lifecycle, env-specific extends, and canonical field ordering. Use when debugging extends inheritance, configuring per-environment parents, understanding what dev writes vs publish writes, or reasoning about config merging."
  - id: "everything-dev#init-upgrade"
    run: "bunx @tanstack/intent@latest load everything-dev#init-upgrade"
    for: "bos init, bos sync, and bos upgrade workflows — template download, snapshot-based conflict detection, package version bumps, and how init/sync select and own files. Use when scaffolding new projects, syncing upstream changes, or upgrading framework packages."
  - id: "everything-dev#plugin-development"
    run: "bunx @tanstack/intent@latest load everything-dev#plugin-development"
    for: "Build, register, and deploy plugins within everything.dev. Covers the _template scaffold, contract/service/index pattern, database setup with Drizzle, bos.config.json registration, plugin UI/sidebar, and CLI workflow. Use when creating new plugins, adding database-backed routes, or deploying plugins to production."
  - id: "everything-dev#publish-sync"
    run: "bunx @tanstack/intent@latest load everything-dev#publish-sync"
    for: "Publish bos.config.json to the FastKV registry, sync from upstream, and upgrade workspace packages. Use when deploying, syncing, or managing runtime configuration across projects."
  - id: "everything-dev#super-app"
    run: "bunx @tanstack/intent@latest load everything-dev#super-app"
    for: "Build shared-host, shared-API super apps with tenant-specific UI composition. Use when setting up a base runtime plus custom tenant apps, configuring fixed-core multi-tenancy, reasoning about extends-based runtime lineage, or deciding what tenants can override today."
  - id: "everything-dev#ui-integration"
    run: "bunx @tanstack/intent@latest load everything-dev#ui-integration"
    for: "Route creation, API client usage, auth client, SSR hydration, sidebar system, and the @/app module surface. Use when adding new UI routes, fetching data from the API, implementing auth flows, or customizing sidebar navigation."
<!-- intent-skills:end -->

# Agent Instructions

This document provides operational guidance for AI agents working in this everything.dev project.

## Quick Reference

**Start Development:**
```bash
cp .env.example .env   # First time only
bun install
bun run dev
```

**Check Status:**
```bash
bos ps        # List running processes
bos status    # Project health check
bos info      # Show configuration
```

## Architecture

This is an everything.dev child project. Depending on your overrides, it may include:
- **UI** — React 19 + TanStack Router frontend, loaded via Module Federation
- **API** — Hono.js + oRPC backend with Effect services

The parent runtime provides the shared framework; your project provides custom overrides.

## Development Workflow

### Starting Development
1. `cp .env.example .env` (first time)
2. `bun install`
3. `bun run dev`

### Debugging Issues

**API not responding:**
- Check `bos ps` to see if the API process is running
- Check `.bos/logs/api.log` for errors

**UI not loading:**
- Verify the dev server is running: `bos ps`
- Check browser console for Module Federation errors
- Clear browser cache and retry

**Type errors:**
- Run `bun run typecheck`

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
- Component file naming: lowercase kebab-case (`data-table.tsx`, `user-profile.tsx`)
- Follow existing patterns in neighboring files

### Adding API Endpoints
1. Define in `api/src/contract.ts` — the oRPC route definitions and Zod schemas
2. Implement in `api/src/index.ts` — the `createRouter` function
3. Use in UI via `apiClient` from `useApiClient()` in `@/app`

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
}
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
- `.env` — Secrets (see `.env.example`)
- `bos.config.json` — Runtime configuration (committed)
