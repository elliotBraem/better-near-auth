# @everything-dev/auth-plugin

An **everything-plugin** that provides authentication and authorization for the Everything platform. Built on top of [Better Auth](https://www.better-auth.com/) with full support for NEAR Protocol (Sign-In-With-NEAR), passkeys, social login, phone number verification, and organization management.

## What It Does

This plugin exposes a complete **oRPC contract** with endpoints for:

- **Session Management**: Get session, context, and active member info
- **Multi-Auth Methods**: Email/password, phone number (OTP), GitHub OAuth, FIDO2/WebAuthn passkeys, anonymous accounts
- **Organization Support**: Members, invitations, roles, and personal organizations (auto-created per user)
- **API Keys**: Scoped, rate-limited, organization-aware API keys
- **NEAR SIWN**: Sign-In-With-NEAR — link NEAR accounts to platform users, view profiles, relay transactions via a built-in relayer, and view contract state
- **Multi-Database Driver**: SQLite via libsql (default), better-sqlite3, Bun SQLite, or Node.js built-in sqlite

It runs inside the **everything-plugin** framework (oRPC + Effect) and is designed to be mounted as a federated module in the Everything workspace.

## Versions & Dependencies

| Package | Version | Required |
|---------|---------|----------|
| Node.js | `>=22.5.0` | Yes |
| `better-auth` | `^1.6.9` | Yes |
| `better-near-auth` | `catalog:` | Yes |
| `drizzle-orm` | `^0.44.0` | Yes |
| `every-plugin` | `workspace:*` | Yes |
| `@orpc/contract` | `^1.13.4` | Yes |
| `@orpc/server` | `^1.13.4` | Yes |
| `@libsql/client` | `^0.15.7` | Optional (for libsql driver) |
| `better-sqlite3` | `^11.0.0` | Optional (for better-sqlite3 driver) |

## Configuration

### Plugin Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `account` | `string` | — | Your app account identifier (used for NEAR SIWN recipient) |
| `hostUrl` | `string` | — | Base URL of the auth server (e.g. `https://auth.example.com`) |
| `uiUrl` | `string` | — | Base URL of your frontend (for CORS/trusted origins) |
| `githubClientId` | `string` | — | GitHub OAuth client ID |
| `githubClientSecret` | `string` | — | GitHub OAuth client secret |

### Plugin Secrets

| Secret | Type | Default | Description |
|--------|------|---------|-------------|
| `AUTH_DATABASE_URL` | `string` | `file:./auth.db` | SQLite database URL |
| `AUTH_DATABASE_AUTH_TOKEN` | `string` | — | Auth token for remote libsql databases (Turso) |
| `AUTH_DATABASE_DRIVER` | `"libsql" \| "better-sqlite3" \| "bun" \| "node"` | `libsql` | SQLite driver backend |
| `BETTER_AUTH_SECRET` | `string` | — | Secret key for Better Auth session signing |

### Environment Variables

The plugin also reads these from `process.env` at runtime:

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_URL` | Overrides `hostUrl` for Better Auth base URL |
| `CORS_ORIGIN` | Comma-separated list of additional trusted origins |
| `GITHUB_CLIENT_ID` | Fallback for GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | Fallback for GitHub OAuth client secret |
| `FASTNEAR_API_KEY` | API key for FastNEAR (NEAR profile lookups) |
| `NEAR_RPC_URL` | Custom NEAR RPC endpoint (e.g. sandbox, private node) |
| `NODE_ENV` | Enables cookie cache when `production` |

## Database Drivers

The plugin supports multiple SQLite backends via a configurable driver:

### `libsql` (default)
Best for Turso, edge runtimes, and remote databases.
```bash
AUTH_DATABASE_DRIVER=libsql
AUTH_DATABASE_URL=https://my-db.turso.io
AUTH_DATABASE_AUTH_TOKEN=eyJ...
```

### `better-sqlite3`
Fastest for local development (native Node.js).
```bash
AUTH_DATABASE_DRIVER=better-sqlite3
AUTH_DATABASE_URL=file:./auth.db
```

### `bun`
Uses Bun's built-in `bun:sqlite`.
```bash
AUTH_DATABASE_DRIVER=bun
AUTH_DATABASE_URL=file:./auth.db
```

### `node`
Uses Node.js 22.5+ built-in `node:sqlite`.
```bash
AUTH_DATABASE_DRIVER=node
AUTH_DATABASE_URL=file:./auth.db
```

Drivers are loaded lazily — only the one you use is imported at runtime.

## Auth Features

### Email & Password
- Registration with email verification
- Password reset via email
- Sign-in with verified email

### Phone Number
- OTP via SMS (preview mode writes to `.dev-preview/sms.jsonl`)
- Auto-creates temp email from phone number

### GitHub OAuth
- Standard OAuth 2.0 flow
- Account linking supported

### Passkeys (FIDO2/WebAuthn)
- Uses `@better-auth/passkey`
- `@simplewebauthn/server` required at dev time

### Anonymous Accounts
- Instant sign-up without credentials
- Upgradeable to full account

### NEAR SIWN (Sign-In-With-NEAR)
Full NEAR Protocol integration:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /v1/near/nonce` | No | Generate SIWN nonce for an account |
| `POST /v1/near/verify` | No | Verify NEP-413 signed message, create/link session |
| `POST /v1/near/profile` | Yes | Fetch NEAR Social profile (name, image, links) |
| `POST /v1/near/link-account` | Yes | Link additional NEAR account to existing user |
| `POST /v1/near/unlink-account` | Yes | Remove a linked NEAR account |
| `GET /v1/near/accounts` | Yes | List all linked NEAR accounts for the user |
| `POST /v1/near/relay` | Yes | Relay a signed NEAR transaction via the relayer |
| `GET /v1/near/relay-status/:txHash` | Yes | Check status of a relayed transaction |
| `GET /v1/near/relayer-info` | Yes | Get relayer account info (balance, mode, etc.) |
| `GET /v1/near/relay-history` | Yes | Get user's relayed transaction history |
| `POST /v1/near/view` | Yes | Call a NEAR contract view method |

### Organizations
- Multi-tenant with personal orgs (auto-created on user creation)
- Member roles: `owner`, `admin`, `member`
- Invitations via email
- Organization-aware API keys and sessions

### API Keys
- Scoped to user or organization
- Optional rate limiting and expiration
- Prefix-based identification

## Contract (oRPC)

The plugin exposes its full contract via `./contract`:

```typescript
import type { ContractType } from "@everything-dev/auth-plugin/contract";
```

This gives you end-to-end type safety when calling endpoints from a client.

## Usage in everything-plugin

Mount in your `everything-plugin` workspace:

```typescript
// plugin.dev.ts
import type { PluginConfigInput } from "every-plugin";
import Plugin from "@everything-dev/auth-plugin";

export default {
  pluginId: "@everything-dev/auth-plugin",
  port: 3021,
  config: {
    variables: {
      account: "myapp.near",
      hostUrl: "http://localhost:3000",
      uiUrl: "http://localhost:3002",
    },
    secrets: {
      AUTH_DATABASE_URL: "file:./auth.db",
      AUTH_DATABASE_DRIVER: "better-sqlite3",
      BETTER_AUTH_SECRET: "dev-only-secret",
    },
  } satisfies PluginConfigInput<typeof Plugin>,
};
```

## Dev Mode

```bash
# Install dependencies (in mounted workspace)
pnpm install

# Run migrations
pnpm db:push

# Start dev server
pnpm dev

# Run tests
pnpm test
```

## Build

```bash
# Build types + bundle
pnpm build

# Deploy
pnpm deploy
```

## License

MIT
