<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 4.25rem; font-weight: 800; line-height: 1; margin: 0;">auth.everything.dev</h1>

<p><strong>Standalone remote auth — configure independently, mount on any host, works with any better-auth client.</strong></p>

<p><strong>Built-in NEAR relayer. Your auth server is also your gateway for gasless on-chain actions.</strong></p>

</div>

A [better-auth](https://better-auth.com/) authentication service packaged as a [remote plugin](https://plugin.everything.dev/) — it runs its own database, its own build, its own runtime, and is composed into any host via [Module Federation](https://module-federation.io/) at runtime. Any better-auth client can point at it. No host-specific code required.

Built with [better-near-auth](https://github.com/elliotBraem/better-near-auth) — now listed on the [better-auth community plugins](https://better-auth.com/docs/plugins/community-plugins) page — which bakes in [Sign-In-With-NEAR](https://github.com/near/NEPs/blob/master/neps/nep-0413.md) and a [gasless delegate action relayer](https://github.com/near/NEPs/blob/master/neps/nep-0366.md). Wherever you deploy auth, you deploy a relayer.

## Why This Matters

**Auth is no longer baked into your app.** It's a remote plugin you configure independently and mount at runtime. The host is generic — it loads the auth plugin from a URL in `bos.config.json` and exposes its contract. No rebuild needed when auth changes.

**Works with any better-auth client.** Because this is a standard better-auth server under the hood, any client using `createAuthClient` can connect to it. Point your client at the auth URL, add the `siwnClient` plugin, and you have Sign-In-With-NEAR and gasless relay — regardless of what framework your app is built with.

**Your auth server is your relayer.** [better-near-auth](https://github.com/elliotBraem/better-near-auth) ships with a built-in NEAR delegate action relayer. In ephemeral mode (the default), an ED25519 keypair is auto-generated on first startup, the private key is encrypted with AES-256-GCM and stored in the database, and the same keypair is recovered on restart. No env vars, no extra infrastructure. Your authenticated users can call on-chain contracts gaslessly through the same server that handles their session.

**Listed on the better-auth community plugins page.** [better-near-auth](https://better-auth.com/docs/plugins/community-plugins) is an official community plugin — installable with `npm install better-near-auth` and documented alongside the rest of the better-auth ecosystem.

## Quick Start

```bash
cp .env.example .env   # First time only
bun install
bos dev --host remote   # Start development with remote host
```

- Host: http://localhost:3000
- API: http://localhost:3000/api
- Auth: http://localhost:3002 (standalone process, own database)

## Connecting a better-auth Client

Any app using better-auth can connect to this auth service — it's not tied to everything.dev. Point your client at the auth URL and add the `siwnClient` plugin:

```ts title="auth-client.ts"
import { createAuthClient } from "better-auth/client";
import { siwnClient } from "better-near-auth/client";

export const authClient = createAuthClient({
  baseURL: "https://auth.everything.dev",
  plugins: [
    siwnClient({
      recipient: "auth.everything.near",
      networkId: "mainnet",
    }),
  ],
});
```

Your users can now sign in with their NEAR wallet and relay gasless on-chain transactions — no additional infrastructure.

### Sign In with NEAR

```tsx
const handleSignIn = async () => {
  await authClient.signIn.near({
    onSuccess: () => console.log("Signed in!"),
    onError: (error) => console.error("Failed:", error.message),
  });
};
```

### Gasless Relay

```ts
const signedAction = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "some_method", {}, { gas: Gas.Tgas(30), attachedDeposit: BigInt(0) }),
);

const result = await authClient.near.relayTransaction({ payload: signedAction });
console.log("Tx hash:", result.txHash);
```

See the [better-near-auth README](https://github.com/elliotBraem/better-near-auth) for the full API reference.

## Architecture

Auth runs as a **decoupled remote plugin** — independently deployable, independently configurable, composed into any host at runtime:

```
┌──────────────────────────┐      ┌──────────────────────────────┐
│   Any Host               │      │   Auth Plugin (Remote)       │
│   Hono + oRPC + MF host  │◄────►│   better-auth + SIWN         │
│   bos.config.json        │mount │   + Relayer + Orgs + API Keys│
│   Generic — no auth code │      │   Own DB, own build          │
└──────────────────────────┘      └──────────────┬───────────────┘
                                                │
                                      ┌─────────┴──────────┐
                                      │  NEAR Protocol      │
                                      │  SIWN + Relay txs   │
                                      └────────────────────┘

  Any better-auth client ──► Auth Plugin ──► Session + Gasless Relay
```

The host loads the auth plugin from a URL in `bos.config.json`. Changing the URL changes the auth service — no rebuild. The host is generic and contains no auth-specific code.

### Plugin Internals

The auth plugin ([`plugins/auth/`](./plugins/auth/)) is built on the [every-plugin](https://plugin.everything.dev/) framework with an [oRPC](https://orpc.dev/) contract and [Effect](https://effect.website/) services. It wraps a standard [better-auth](https://better-auth.com/) instance with these plugins active:

- **[better-near-auth](https://github.com/elliotBraem/better-near-auth)** — SIWN authentication + gasless delegate action relayer
- **admin** — Role-based access control
- **anonymous** — Instant sign-up without credentials
- **phoneNumber** — OTP via SMS
- **passkey** — FIDO2/WebAuthn
- **organization** — Multi-tenant with personal orgs
- **apiKey** — Scoped, rate-limited API keys

See [Auth Plugin README](./plugins/auth/README.md) for the full contract, configuration, and endpoint reference.

## Built-in Relayer

The [better-near-auth](https://github.com/elliotBraem/better-near-auth) plugin starts a NEAR delegate action relayer by default. Two modes:

**Ephemeral mode (default):** An ED25519 keypair is generated on first startup. The implicit account ID is derived from the public key. The private key is encrypted with AES-256-GCM (using `BETTER_AUTH_SECRET` as KEK via HKDF-SHA256) and stored in the database. The same keypair is recovered on restart. No env vars, no config files, no private keys on disk.

**Named mode:** Set `accountId` and `privateKey` in the relayer config to use an existing funded NEAR account. Suitable for production workloads requiring a known relayer identity.

Both modes support `whitelistedContracts` to restrict which contracts can be called, and `maxGasPerTransaction` / `maxDepositPerTransaction` limits.

See the [better-near-auth README](https://github.com/elliotBraem/better-near-auth) for full relayer configuration.

## Configuration

All runtime configuration lives in `bos.config.json`. The auth entry defines a standalone remote:

```json
{
  "account": "auth.everything.near",
  "domain": "everything.dev",
  "app": {
    "auth": {
      "name": "everything-dev_auth-plugin",
      "development": "local:plugins/auth",
      "production": "https://...",
      "variables": {
        "account": "auth.everything.near",
        "domain": "http://localhost:3000"
      },
      "secrets": ["AUTH_DATABASE_URL", "BETTER_AUTH_SECRET"]
    }
  }
}
```

### Plugin Variables

| Variable | Type | Description |
|----------|------|-------------|
| `account` | `string` | NEAR account identifier (used for SIWN recipient) |
| `domain` | `string` | Base URL of the auth server |
| `githubClientId` | `string` | GitHub OAuth client ID (optional) |
| `githubClientSecret` | `string` | GitHub OAuth client secret (optional) |

### Plugin Secrets

| Secret | Description |
|--------|-------------|
| `AUTH_DATABASE_URL` | PostgreSQL connection string or `pglite:` path |
| `BETTER_AUTH_SECRET` | Secret key for session signing (also used as KEK for relayer key encryption) |

### Database

The plugin uses PostgreSQL via `pg` in production and `@electric-sql/pglite` for local development:

```bash
AUTH_DATABASE_URL=pglite:./auth-local.db    # Local (zero-config, no Docker)
AUTH_DATABASE_URL=postgres://user:pass@host:5432/dbname  # Production
```

### Railway

Use the repo `Dockerfile` for the service. All configuration derives from `bos.config.json` (baked into the image). Only secrets need to be set as environment variables.

Required runtime vars:
- `APP_ENV` — `production` or `staging`
- `BETTER_AUTH_SECRET` — Session encryption key
- `BETTER_AUTH_URL` — Auth callback URL (defaults to host URL from config)
- `HOST_DATABASE_URL` — Database connection string
- `HOST_DATABASE_AUTH_TOKEN` — Database auth token
- `CORS_ORIGIN` — Comma-separated allowed origins

## Development

```bash
bun install             # Install dependencies
bos dev --host remote   # Start with remote host (typical workflow)
```

### Making Changes

- **Auth Plugin**: Edit `plugins/auth/src/` → hot reload automatically → publish with `bos publish --deploy`
- **UI Changes**: Edit `ui/src/` → hot reload automatically
- **API Changes**: Edit `api/src/` → hot reload automatically

### Before Committing

```bash
bun test
bun typecheck
bun lint
bun run lint:fix    # Fix auto-fixable issues
bun run format      # Format code (Biome)
```

### Changesets

```bash
bun run changeset   # Select packages and describe changes
```

Add a changeset for any user-facing change (features, fixes, deprecations). Skip for docs-only or internal changes.

The deploy workflow in the parent repo (`.github/workflows/deploy-example.yml`) handles deploying this example and publishing to FastKV when a new `better-near-auth` version is released.

### Git Workflow

See [CONTRIBUTING.md](./CONTRIBUTING.md) for branch naming, semantic commits, and PR process.

## CLI Commands

`everything-dev` is the canonical runtime package and CLI. `bos` is an alias.

```bash
bos dev --host remote       # Remote host, local UI + API (typical)
bos dev --ui remote         # Isolate API work
bos dev --api remote        # Isolate UI work
bos dev                     # Full local

bos build                   # Build all packages
bos publish                 # Publish config to FastKV registry
bos publish --deploy        # Build/deploy all, then publish
bos sync                    # Sync from production (every.near/everything.dev)

bos create project <name>   # Scaffold new project
bos info                    # Show configuration
bos status                  # Check remote health
bos ps                      # List running processes
bos kill                    # Kill all tracked processes
```

## Tech Stack

**Auth:**
- [better-auth](https://better-auth.com/) — Authentication framework
- [better-near-auth](https://github.com/elliotBraem/better-near-auth) — SIWN + gasless relay ([community plugin](https://better-auth.com/docs/plugins/community-plugins))
- [near-kit](https://github.com/elliotBraem/near-kit) — NEAR Protocol SDK
- [@hot-labs/near-connect](https://github.com/azbang/near-connect) — Wallet connection

**Frontend:**
- React 19 + TanStack Router + TanStack Query
- Tailwind CSS v4 + shadcn/ui
- Module Federation for microfrontend architecture

**Backend:**
- [Hono.js](https://hono.dev/) + [oRPC](https://orpc.dev/) (type-safe RPC + OpenAPI)
- [every-plugin](https://plugin.everything.dev/) architecture
- [Effect-TS](https://effect.website/) for service composition

**Database:**
- PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)

## Related Projects

- **[better-near-auth](https://github.com/elliotBraem/better-near-auth)** — NEAR SIWN + gasless relay plugin for Better Auth ([community plugins page](https://better-auth.com/docs/plugins/community-plugins))
- **[every-plugin](https://plugin.everything.dev/)** — Plugin framework for modular APIs with typed contracts and runtime composition
- **[near-kit](https://github.com/elliotBraem/near-kit)** — Unified NEAR Protocol SDK
- **[everything-dev](https://github.com/nearbuilders/everything-dev)** — Runtime apps that compose, verify, and evolve without rebuilding
- **[TanStack Intent](https://tanstack.com/intent)** — Agent skills shipped as npm package artifacts

## NEAR Ecosystem

auth.everything.dev sits within a broader ecosystem building a verifiable internet on NEAR:

- **[BOS](https://near.social/)** — Composable on-chain frontend components
- **[web4](https://web4.near.page)** — Web apps as verifiable on-chain smart contracts
- **[near-dns](https://github.com/frol/near-dns)** — Blockchain-backed DNS resolution
- **[NameSky](https://namesky.app)** — Named accounts as tradeable on-chain assets
- **[OutLayer](https://outlayer.fastnear.com)** — TEE-attested verifiable off-chain computation
- **[NEAR Intents](https://intents.near.org)** — Intent-based cross-chain settlement ($15B+ volume)
- **[Trezu](https://trezu.org)** — Multi-chain treasury management ($72M AUM)
- **[NEAR AI Cloud](https://near.ai/cloud)** — Confidential inference with hardware attestation

## Documentation

- **[AGENTS.md](./AGENTS.md)** — Quick operational guide for AI agents
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Contribution guidelines and git workflow
- **[Auth Plugin README](./plugins/auth/README.md)** — Auth plugin contract, configuration, endpoints
- **[API README](./api/README.md)** — API plugin documentation
- **[UI README](./ui/README.md)** — Frontend documentation

## License

MIT
