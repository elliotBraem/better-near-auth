# @everything-dev/auth-plugin

An **everything-plugin** that provides authentication and authorization for the Everything platform. Built on top of [Better Auth](https://www.better-auth.com/) with full support for NEAR Protocol (Sign-In-With-NEAR), passkeys, social login, phone number verification, and organization management.

## What It Does

This plugin exposes a complete **oRPC contract** with endpoints for:

- **Session Management**: Get session, context, and active member info
- **Multi-Auth Methods**: Email/password, phone number (OTP), GitHub OAuth, FIDO2/WebAuthn passkeys, anonymous accounts
- **Organization Support**: Members, invitations, roles, and personal organizations (auto-created per user)
- **API Keys**: Scoped, rate-limited, organization-aware API keys
- **NEAR SIWN**: Sign-In-With-NEAR — link NEAR accounts to platform users, view profiles, relay transactions via a built-in relayer, and view contract state
- **PostgreSQL Database**: Uses `pg` for production (Railway, etc.) and `@electric-sql/pglite` for local development and tests

It runs inside the **everything-plugin** framework (oRPC + Effect) and is designed to be mounted as a federated module in the Everything workspace.

## Versions & Dependencies

| Package | Version | Required |
|---------|---------|----------|
| Node.js | `>=22.5.0` | Yes |
| `better-auth` | `catalog:` | Yes |
| `better-near-auth` | `catalog:` | Yes |
| `drizzle-orm` | `catalog:` | Yes |
| `every-plugin` | `workspace:*` | Yes |
| `pg` | `catalog:` | Yes |
| `@electric-sql/pglite` | `^0.2.0` | Dev only |
| `@orpc/contract` | `catalog:` | Dev only |
| `@orpc/server` | `catalog:` | Dev only |

## Configuration

### Plugin Variables

| Field | Type | Default | Description |
|------|------|---------|-------------|
| `baseUrl` | `string` | — | Base URL of the auth server |
| `trustedOrigins` | `string[]` | — | Optional browser origins trusted by Better Auth |
| `apiKeyHeaders` | `string[]` | `['x-api-key']` | Request headers checked for API key auth |

| Nested field | Type | Default | Description |
|-------------|------|---------|-------------|
| `socialProviders.github.clientId` | `string` | — | GitHub OAuth client ID |
| `passkey.rpID` | `string` | Derived from `baseUrl` | WebAuthn relying party ID |
| `passkey.rpName` | `string` | `Everything Dev` | Human-readable relying party name |
| `passkey.origin` | `string` | Derived from `baseUrl` | Browser origin for passkeys |
| `siwn.recipient` | `string` | — | Single-network SIWN recipient |
| `siwn.recipients.mainnet` | `string` | — | Mainnet SIWN recipient |
| `siwn.recipients.testnet` | `string` | — | Testnet SIWN recipient |
| `siwn.rpcUrl` | `string` | — | Optional NEAR RPC endpoint |
| `siwn.relayer.accountId` | `string` | — | Optional relayer account ID |
| `siwn.subAccount.mainnet.parentAccount` | `string` | — | Optional mainnet sub-account parent |
| `siwn.subAccount.testnet.parentAccount` | `string` | — | Optional testnet sub-account parent |

### Plugin Secrets

| Secret | Type | Default | Description |
|--------|------|---------|-------------|
| `AUTH_DATABASE_URL` | `string` | — | PostgreSQL connection string or pglite path |
| `BETTER_AUTH_SECRET` | `string` | — | Secret key for Better Auth session signing |
| `GITHUB_CLIENT_SECRET` | `string` | — | GitHub OAuth client secret |
| `FASTNEAR_API_KEY` | `string` | — | FASTNEAR API key for SIWN profile lookup |
| `TWILIO_ACCOUNT_SID` | `string` | — | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | `string` | — | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | `string` | — | Twilio sender phone number |
| `NEAR_RELAYER_PRIVATE_KEY` | `string` | — | Optional relayer private key |
| `NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET` | `string` | — | Optional mainnet sub-account parent key |
| `NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET` | `string` | — | Optional testnet sub-account parent key |

### Plugin Context

| Field | Type | Description |
|-------|------|-------------|
| `reqHeaders` | `Record<string, string>` | Optional. Request headers forwarded for session resolution |

### Environment Variables

The plugin itself does **not** read `process.env`. The host passes all configuration via `variables` and `secrets`. In development, `plugin.dev.ts` can map environment variables into the same nested shape:

| Variable | Description |
|----------|-------------|
| `BASE_URL` | Auth server base URL |
| `DOMAIN` | Fallback base URL for local dev only |
| `TRUSTED_ORIGINS` | Additional comma-separated trusted origins |
| `CORS_ORIGIN` | Alias for `TRUSTED_ORIGINS` |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `PASSKEY_RP_ID` | WebAuthn relying party ID override |
| `PASSKEY_RP_NAME` | WebAuthn relying party display name override |
| `PASSKEY_ORIGIN` | WebAuthn origin override |
| `ACCOUNT` | Single-network SIWN recipient or mainnet recipient |
| `TESTNET_ACCOUNT` | Testnet SIWN recipient |
| `NEAR_RPC_URL` | Custom NEAR RPC endpoint |
| `NEAR_RELAYER_ACCOUNT_ID` | Optional relayer account ID |
| `AUTH_DATABASE_URL` | Database URL |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `FASTNEAR_API_KEY` | FASTNEAR API key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number |
| `NEAR_RELAYER_PRIVATE_KEY` | Optional relayer private key |
| `NEAR_SUB_ACCOUNT_PARENT_MAINNET` | Optional mainnet sub-account parent account |
| `NEAR_SUB_ACCOUNT_PARENT_TESTNET` | Optional testnet sub-account parent account |

## Database

The plugin uses PostgreSQL via `pg` in production and `@electric-sql/pglite` for local development and tests. `pg` is externalized in the Module Federation bundle and must be provided by the host at runtime.

```bash
# Local development (zero-config, no Docker needed)
AUTH_DATABASE_URL=pglite:./auth-local.db

# Production (Railway, etc.)
AUTH_DATABASE_URL=postgres://user:pass@host:5432/dbname
```

## Auth Features

### Email & Password
- Registration with email verification
- Password reset via email
- Sign-in with verified email

### Phone Number
- OTP via SMS (preview mode logs to console)
- Auto-creates temp email from phone number

### GitHub OAuth
- Standard OAuth 2.0 flow
- Account linking supported

### Passkeys (FIDO2/WebAuthn)
- Uses `@better-auth/passkey`
- `@simplewebauthn/server` required at dev time
- Configures `rpID`, `rpName`, and `origin` explicitly from plugin variables so passkeys work on localhost, staging, and production domains
- Users can sign in with passkeys and manage registered credentials from settings

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
        baseUrl: "http://localhost:3000",
        socialProviders: {
          github: {
            clientId: "",
          },
        },
        siwn: {
          recipient: "myapp.near",
        },
      },
      secrets: {
        AUTH_DATABASE_URL: "pglite:./.local/auth.db",
        BETTER_AUTH_SECRET: "dev-only-secret",
      },
  } satisfies PluginConfigInput<typeof Plugin>,
};
```

## Dev Mode

```bash
# Install dependencies (in workspace root)
bun install

# Run migrations
bun run db:push

# Start dev server
bun run dev

# Run tests
bun run test
```

## Build

```bash
# Build types + bundle
bun run build

# Deploy
bun run deploy
```

## TODO

### End-to-End SIWN Flow Validation

The plugin's core login flow — a NEAR wallet signing a NEP-413 message, posting to `POST /v1/near/verify`, and receiving an authenticated session — is not yet fully validated through the plugin's oRPC router. The unit tests in `better-near-auth` (30 tests) cover the library-level nonce generation, signature verification, and account linking, but the integration through the plugin needs work.

**Current status:**
- ✅ Dependencies resolve correctly (`every-plugin@2.4.0`, `everything-dev@1.7.0`, `near-kit@0.14.0`)
- ✅ Sandbox starts and responds to RPC
- ✅ Auth instance creates successfully with the pglite database driver
- ⚠️ Full SIWN flow test **skips the actual verification** because `near-kit`'s `Sandbox.patchState()` does not create visible accounts in this environment. The patched account is not queryable via `near.accountExists()` after `patchState` + `fastForward(1)`.

**What's needed:**
1. **Fix or understand `patchState` visibility:** Investigate why `sandbox.patchState()` followed by `sandbox.fastForward(1)` does not make accounts visible to `near.accountExists()`. This may be a `near-kit` sandbox binary issue, a timing issue, or a state format mismatch. Test with `near.getAccount()` directly after `patchState` to verify.
2. **End-to-end router test:** Once `patchState` works, validate the full flow:
   - `POST /v1/near/nonce` → returns nonce
   - Sign with keypair → `POST /v1/near/verify` → returns `{ token, success, user }`
   - `GET /v1/near/accounts` with Bearer token → returns linked account
   - `POST /v1/near/profile` → returns NEAR Social profile
3. **Mock-based plugin test:** If sandbox state patching remains unreliable, write a test that mocks `auth.api.verifySiwnMessage()` at the router level to validate that the plugin correctly delegates to Better Auth.
4. **Relay flow test:** Validate `POST /v1/near/relay` and `GET /v1/near/relay-status/:txHash` with a real signed delegate action.
5. **Remove debug logging:** Clean up `console.log` statements in `src/near.test.ts` once the flow is validated.

## License

MIT
