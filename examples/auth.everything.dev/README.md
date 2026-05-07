<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 4.25rem; font-weight: 800; line-height: 1; margin: 0;">everything.dev</h1>

<img src="ui/src/assets/under-construction.gif" alt="Under construction" width="380" />

</div>

Runtime apps that compose, verify, and evolve without rebuilding — built on [Module Federation](https://module-federation.io/), [every-plugin](https://plugin.everything.dev/), and [NEAR Protocol](https://near.dev/).

A published `bos.config.json` defines how host, UI, and API load together. Changing the config changes the composition. No rebuild needed. The configuration lives on-chain — inspectable, verifiable, and extendable by anyone.

Built with [Tanstack Start](https://tanstack.com/start/latest/docs/framework/react/quick-start), [Hono.js](https://hono.dev/), [oRPC](https://orpc.dev/), [better-auth](https://better-auth.com/), and [rsbuild](https://rsbuild.rs/).

## Quick Start

```bash
bun install             # Install dependencies
bos dev --host remote   # Start development (typical workflow)
```

This will start serving the UI, the API, and mounting it on a universally shared (remote) HOST application's build.

- Host: http://localhost:3000
- API: http://localhost:3000/api

This maintains a flexible, well-typed architecture that connects the entirity of the application, it's operating system, and a cli to interact with it. It is a perpetually in-development model for the [Blockchain Operating System (BOS)](https://near.social/#/)

## Why

Agents can now build software. But 45% of AI-generated code fails security tests — a rate flat for two years across 150+ models. The JavaScript supply chain saw a 15.3x increase in malicious packages. $1.46B was stolen via runtime JavaScript injection at Bybit. Only 2.8% of scripts on the median web page have integrity protection.

Build-time bundles have no compositional integrity. You cannot verify what is running matches what was published. You cannot swap a component without redeploying everything. You cannot prove provenance.

everything.dev is a composition protocol, not a framework. The `bos.config.json` is a verifiable manifest. every-plugin provides typed contracts for composable APIs. The registry discovers published runtimes on-chain. `extends` and `bos://` let any app compose from any other. better-near-auth gives cryptographic identity and verifiable on-chain actions. Integrity hashes prove what loads matches what was published.

**Runtime apps that compose, verify, and evolve without rebuilding.**

For the full argument, see [A New Renaissance: Why Software Must Compose or Collapse](./docs/article-new-renaissance.md).

## CLI Commands

`everything-dev` is the canonical runtime package and CLI. `bos` is a command alias for the same tool. See [AGENTS.md](./AGENTS.md) for the quick reference and [LLM.txt](./LLM.txt) for the full technical guide.

### Development

```bash
everything-dev dev --host remote   # Remote host, local UI + API (typical)
everything-dev dev --ui remote     # Isolate API work
everything-dev dev --api remote    # Isolate UI work
           |/ --proxy              # Use a proxy
everything-dev dev                 # Full local, client shell by default

# `bos` is an alias for the same commands
bos dev --ssr                      # Opt into local SSR
```

### Production

```bash
everything-dev start --no-interactive   # All remotes, production URLs
```

### Build & Publish

```bash
bos build               # Build all packages (updates bos.config.json)
bos publish             # Publish config to the temporary dev.everything.near registry
bos publish --deploy    # Build/deploy all workspaces, then publish
bun run publish         # Same publish command via root script
bos sync                # Sync from production (every.near/everything.dev)
```

### Project Management

```bash
bos create project <name>   # Scaffold new project
bos info                    # Show configuration
bos status                  # Check remote health
bos clean                   # Clean build artifacts
```

## Development Workflow

### Making Changes

- **UI Changes**: Edit `ui/src/` → hot reload automatically → publish with `bos publish --deploy`
- **API Changes**: Edit `api/src/` → hot reload automatically → publish with `bos publish --deploy`
- **Host Changes**: Edit `host/src/` or `bos.config.json` → publish with `bos publish --deploy`

### Before Committing

Always run these commands before committing:

```bash
bun test        # Run all tests
bun typecheck   # Type check all packages
bun lint        # Run linting (see lint setup below)
```

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning:

**When to add a changeset:**
- Any user-facing change (features, fixes, deprecations)
- Breaking changes
- Skip for: docs-only changes, internal refactors, test-only changes

**Create a changeset:**
```bash
bun run changeset
# Follow prompts to select packages and describe changes
```

The release workflow (`.github/workflows/release.yml`) handles versioning and GitHub releases automatically on merge to main.

### Git Workflow

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines including:
- Branch naming conventions
- Semantic commit format
- Pull request process

## Documentation

- **[AGENTS.md](./AGENTS.md)** - Quick operational guide for AI agents
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines and git workflow
- **[LLM.txt](./LLM.txt)** - Deep technical reference for implementation
- **[API README](./api/README.md)** - API plugin documentation
- **[UI README](./ui/README.md)** - Frontend documentation
- **[Host README](./host/README.md)** - Server host documentation
- **[Auth Plugin README](./plugins/auth/README.md)** - Auth plugin documentation

**Documentation Purpose:**
- `README.md` (this file) - Human quick start and overview
- `AGENTS.md` - Agent operational shortcuts
- `CONTRIBUTING.md` - How to contribute (branch, commit, PR workflow)
- `LLM.txt` - Technical deep-dive for implementation details
- Package READMEs (api/, ui/, host/, plugins/auth/) - Package-specific details

## Architecture

**Module Federation monorepo** with runtime-loaded configuration:

```
┌─────────────────────────────────────────────────────────┐
│                  host (Server)                          │
│  Hono.js + oRPC + bos.config.json loader                │
│  ┌──────────────────┐      ┌──────────────────┐         │
│  │ Module Federation│      │ every-plugin     │         │
│  │ Runtime          │      │ Runtime          │         │
│  └────────┬─────────┘      └────────┬─────────┘         │
│           ↓                         ↓                   │
│  Loads UI Runtime          Loads API + Auth Plugins     │
└───────────┬─────────────────────────┬───────────────────┘
            ↓                         ↓
┌───────────────────────┐ ┌───────────────────────┐
│    ui/ (Runtime)      │ │   api/ + plugins/     │
│  React + TanStack     │ │  oRPC + Effect        │
│  ui/src/app.ts        │ │  remoteEntry.js       │
└───────────────────────┘ └───────────────────────┘
```

**Key Features:**
- ✅ **Runtime Configuration** - All URLs from `bos.config.json` (no rebuild needed)
- ✅ **Independent Deployment** - UI, API, and Host deploy separately
- ✅ **Type Safety** - End-to-end with oRPC contracts
- ✅ **UI Runtime Boundary** - `everything-dev/ui/client` and `/server` own router/runtime glue
- ✅ **CDN-Ready** - Module Federation with [Zephyr Cloud](https://zephyr-cloud.io/)

## Configuration

All runtime configuration lives in `bos.config.json`:

```json
{
  "account": "dev.everything.near",
  "domain": "everything.dev",
  "staging": { "domain": "staging.dev.yourapp.dev" },
  "repository": "https://github.com/nearbuilders/everything-dev",
  "testnet": "dev.allthethings.testnet",
  "plugins": {
    "template": {
      "development": "local:plugins/_template"
    }
  },
  "app": {
    "host": {
      "name": "host",
      "development": "local:host",
      "production": "https://..."
    },
    "ui": {
      "name": "ui",
      "development": "local:ui",
      "production": "https://...",
      "ssr": "https://..."
    },
    "api": {
      "name": "api",
      "development": "local:api",
      "production": "https://...",
      "variables": {},
      "secrets": []
    },
    "auth": {
      "name": "everything-dev_auth-plugin",
      "development": "local:plugins/auth",
      "production": "https://...",
      "variables": {
        "account": "dev.everything.near",
        "hostUrl": "http://localhost:3000",
        "uiUrl": "http://localhost:3003"
      },
      "secrets": ["AUTH_DATABASE_URL", "BETTER_AUTH_SECRET"]
    }
  }
}
```

The temporary publish registry currently points at `dev.everything.near`, and `bos publish --deploy` is the release path when you want Zephyr URLs refreshed first.

### Railway

Use the repo `Dockerfile` for the service, and treat the GHCR image as the deployable artifact.

- Image source: `ghcr.io/<lowercased github.repository>:latest`
- Staging: `ghcr.io/<lowercased github.repository>:staging`
- Preview: `ghcr.io/<lowercased github.repository>:pr-<number>`

All configuration derives from `bos.config.json` (baked into the image). Only secrets need to be set as environment variables.

Required runtime vars:
- `APP_ENV` - `production` or `staging` (derives domain from `bos.config.json`)
- `BETTER_AUTH_SECRET` - Session encryption key
- `BETTER_AUTH_URL` - Auth callback URL (defaults to host URL from config)
- `HOST_DATABASE_URL` - Database connection string
- `HOST_DATABASE_AUTH_TOKEN` - Database auth token
- `CORS_ORIGIN` - Comma-separated allowed origins (defaults to host + UI URLs from config)

See [LLM.txt](./LLM.txt) for the complete schema and configuration reference.

## Lint Setup

This project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check linting
bun lint

# Fix auto-fixable issues
bun lint:fix

# Format code
bun format
```

Biome is configured in `biome.json` at the project root. Generated files (like `routeTree.gen.ts`) are automatically excluded.

## Tech Stack

**Frontend:**
- React 19 + TanStack Router (file-based) + TanStack Query
- Tailwind CSS v4 + shadcn/ui components
- Module Federation for microfrontend architecture

**Backend:**
- Hono.js server + oRPC (type-safe RPC + OpenAPI)
- [every-plugin](https://plugin.everything.dev/) architecture for modular APIs
- Effect-TS for service composition

**Database & Auth:**
- PostgreSQL + Drizzle ORM
- Better-Auth with NEAR Protocol support

## Related Projects

- **[every-plugin](https://plugin.everything.dev/)** - Plugin framework for modular APIs with typed contracts and runtime composition
- **[near-kit](https://kit.near.tools)** - Unified NEAR Protocol SDK
- **[better-near-auth](https://github.com/elliotBraem/better-near-auth)** - NEAR SIWN + gasless relay for Better-Auth (cryptographic identity, verifiable on-chain actions)
- **[TanStack Intent](https://tanstack.com/intent)** - Agent skills shipped as npm package artifacts (compositional knowledge versioned with code)

## NEAR Ecosystem

everything.dev sits within a broader ecosystem building a verifiable internet on NEAR:

- **[BOS](https://near.social/)** — Composable on-chain frontend components
- **[web4](https://web4.near.page)** — Web apps as verifiable on-chain smart contracts
- **[near-dns](https://github.com/frol/near-dns)** — Blockchain-backed DNS resolution
- **[NameSky](https://namesky.app)** — Named accounts as tradeable on-chain assets
- **[OutLayer](https://outlayer.fastnear.com)** — TEE-attested verifiable off-chain computation
- **[NEAR Intents](https://intents.near.org)** — Intent-based cross-chain settlement ($15B+ volume)
- **[Trezu](https://trezu.org)** — Multi-chain treasury management ($72M AUM)
- **[NEAR AI Cloud](https://near.ai/cloud)** — Confidential inference with hardware attestation

## License

MIT
