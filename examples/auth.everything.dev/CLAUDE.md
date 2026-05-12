# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A standalone, remotely-deployable **authentication plugin** built on the `everything-dev` framework. It packages `better-auth` + NEAR Sign-In-With-NEAR (SIWN) + gasless transaction relay into a self-contained Module Federation plugin that any host app can load from a URL at runtime. The host is **remote** (from ZephyrCloud) and is **not in this repo**.

## Commands

```bash
# Development
bun run dev                 # Full local (all services local)
bos dev --host remote       # Typical: remote host, local UI + API + auth
bos dev --ui remote         # Isolate API/auth work
bos dev --api remote        # Isolate UI work

# Quality
bun test                    # Run all tests
bun typecheck               # Type check all packages
bun lint                    # Lint (Biome)
bun run lint:fix            # Fix auto-fixable lint issues
bun run format              # Format code

# Tests (run from workspace root)
bun run test:api            # API integration + unit tests
cd api && bun run test tests/integration/some.test.ts  # Single test file

# Database
bun run db:migrate          # Run migrations
bun run db:push             # Push schema changes
bun run db:studio           # Open Drizzle Studio

# Process management
bos kill                    # Kill all tracked processes (use when ports are stuck)
bos ps                      # List running processes
bos status                  # Project health check

# Type generation (run after editing bos.config.json)
bos types gen
```

**Key ports:** UI → 3003, API → 3001, Auth Plugin → 3002, Host → 3000

If ports are occupied by stale processes, run `bos kill` before restarting.

## Architecture

```
bos.config.json         ← Runtime composition (which plugins load from where)
plugins/auth/           ← Auth plugin (better-auth + NEAR SIWN + relayer)
api/                    ← Thin API shell (ping, health, auth middleware)
ui/                     ← React 19 SPA (TanStack Router + Query)
```

**The host is generic and remote** — it reads `bos.config.json`, loads each piece from a URL via Module Federation, and routes requests. No auth code lives in the host.

### How Plugins Work

Each plugin (`plugins/auth/`, `api/`) follows the same structure:
- **`contract.ts`** — oRPC route definitions with Zod schemas (the public API surface)
- **`index.ts`** — `createPlugin()` call: declares `variables`, `secrets`, initializes services with Effect-TS, returns the oRPC router
- **`rspack.config.js`** — Module Federation build config for independent deployment

Effect-TS (`Effect.acquireRelease`) manages DB connection lifecycles. Plugins don't read `process.env` directly — the host passes `variables` and `secrets` from `bos.config.json`.

### Generated Type Files

`*-types.gen.ts` files are **gitignored and auto-generated** — never edit them manually:
- `api/src/lib/plugins-types.gen.ts`
- `api/src/lib/auth-types.gen.ts`
- `ui/src/lib/api-types.gen.ts`
- `ui/src/lib/auth-types.gen.ts`

They regenerate automatically on `bun install`, `bos dev`, `bos build`, and `bos types gen`. If you edit `bos.config.json`, run `bos types gen` to regenerate.

### Two-Phase Plugin Loading

The host loads non-API plugins first (Phase 1), builds a `pluginsClient` map, then injects that map into the API plugin (Phase 2). This means the API can call other plugins **in-process** (no HTTP roundtrip) via `services.plugins.{key}()`. The UI always goes through HTTP.

### Auth Plugin Internals (`plugins/auth/`)

Wraps `better-auth` with: SIWN (NEP-413 verify + gasless relay), admin, anonymous, phoneNumber, passkey, organization (auto-creates personal org on signup), and apiKey plugins.

The built-in NEAR relayer runs in **ephemeral mode** by default: generates an ED25519 keypair on first startup, encrypts the private key with AES-256-GCM using `BETTER_AUTH_SECRET` as KEK (via HKDF-SHA256), stores in DB, recovers on restart. No extra config needed.

### UI Patterns (`ui/src/`)

**Route protection** — authenticated routes live under `_layout/_authenticated/` and use a layout route that redirects to `/login` if no session:
```typescript
// _layout/_authenticated.tsx
const { data: session } = await authClient.getSession();
if (!session?.user) throw redirect({ to: '/login', ... });
```

**Clients** — always get clients from context, never instantiate directly:
```typescript
import { useApiClient, useAuthClient } from "@/app";
const apiClient = useApiClient();       // → apiClient.ping(), apiClient.registry.*()
const authClient = useAuthClient();     // → authClient.signIn.near(), authClient.near.*()
```

**Runtime config helpers** from `@/app`:
- `getAppName()`, `getAccount()`, `getRepository()`, `getActiveRuntime()`, `getRuntimeConfig()`
- In components: `useClientValue(() => getAppName(), "app")`
- In `head()` / server context: use `loaderData.runtimeConfig` + `getActiveRuntime(runtimeConfig)`

**Styling** — semantic Tailwind only. Use `bg-background`, `text-foreground`, `text-muted-foreground`, etc. No hardcoded colors like `bg-blue-600`. No code comments in implementation files.

### Adding API Endpoints

1. Add route definition + Zod schema to `api/src/contract.ts`
2. Implement handler in `api/src/createRouter` in `api/src/index.ts`
3. Use in UI via `apiClient.yourEndpoint()` from `useApiClient()`

Same pattern applies to auth plugin endpoints in `plugins/auth/src/contract.ts`.

### New Routes

Create a file in `ui/src/routes/` — TanStack Router auto-generates the route tree. Protected routes go under `_layout/_authenticated/`.

### New UI Components

Create in `ui/src/components/`, export from `ui/src/components/index.ts`.

## Environment

Copy `.env.example` → `.env`. Required for dev:
- `AUTH_DATABASE_URL` — `postgresql://everythingdev:everythingdev@localhost:5433/auth_db` (Docker) or `pglite:.bos/auth/:memory:` (zero-config)
- `API_DATABASE_URL` — `postgresql://everythingdev:everythingdev@localhost:5432/api_db` (Docker) or `pglite:.bos/api/:memory:`
- `BETTER_AUTH_SECRET` — any string for local dev

Docker (two Postgres instances): `docker-compose up -d` (port 5432 = api_db, 5433 = auth_db).

## Changesets

Add a changeset for any user-facing change; skip for docs/internal/test-only:
```bash
bun run changeset
```
