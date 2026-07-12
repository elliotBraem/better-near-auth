---
name: auth-plugin
description: >
  Mount and consume the @everything-dev/auth-plugin in an everything-dev or
  every-plugin project. Register it in bos.config.json, wire the Better Auth
  client into the UI with siwnClient/passkey/API-key/organization plugins,
  protect routes with session checks, compose with the auth plugin in-process
  via createPlugin.withPlugins, and use the auth context (getContext) in your
  own oRPC middleware. Sub-account creation is supported in bos.config.json
  for scalar fields (parentHasFullAccess, minDeposit, deploy.fromPublished,
  init with static args, addRelayerFCAK, relayerFCAK). Load when adding auth
  to an everything.dev app, configuring SIWN recipients from runtime config,
  calling auth endpoints from another plugin, or debugging auth context resolution.
requires:
  - siwn
  - client
metadata:
  type: composition
  library: better-near-auth
  library_version: "1.6.5"
sources:
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/bos.config.json"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/contract.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/auth-export.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/index.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/README.md"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/plugin.dev.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/lib/auth.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/app.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/routes/_layout/_authenticated.tsx"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/api/src/index.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/api/src/lib/auth.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/api/src/lib/context.ts"
---

# Better-Near-Auth — Auth Plugin (everything.dev)

The `@everything-dev/auth-plugin` wraps `better-near-auth` and Better Auth into an everything-plugin (oRPC + Effect + Module Federation). It provides session management, NEAR SIWN, passkeys, OAuth, phone OTP, anonymous accounts, organizations, API keys, and a NEAR relayer — all behind a typed oRPC contract.

This skill covers **consuming** the plugin: registration, UI auth client, route protection, in-process composition, and the auth context. See also `better-near-auth#siwn`, `better-near-auth#client`, `better-near-auth#relay`, `better-near-auth#subaccount` for the underlying plugin config.

## Registering in bos.config.json

Deployed under `app.auth` as a Module Federation container:

```json
{
  "app": {
    "auth": {
      "name": "everything-dev_auth-plugin",
      "development": "local:plugins/auth",
      "production": "https://cdn.example.com/auth-plugin.js",
      "integrity": "sha384-...",
      "variables": {
        "socialProviders": { "github": {}, "google": {} },
        "passkey": { "rpID": "auth.everything.dev", "rpName": "Better NEAR Auth" },
        "siwn": {
          "recipients": {
            "mainnet": "auth.everything.near",
            "testnet": "dev.allthethings.testnet"
          },
          "relayer": { "accountId": "" },
          "subAccount": {
            "mainnet": {
              "parentAccount": "myapp.near",
              "parentHasFullAccess": true,
              "minDeposit": "0.1 NEAR",
              "deploy": { "fromPublished": { "accountId": "myapp.near" } },
              "init": { "methodName": "init", "args": { "owner": "myapp.near" } }
            },
            "testnet": {
              "parentAccount": "dev.myapp.testnet"
            }
          }
        }
      },
      "secrets": ["AUTH_DATABASE_URL", "BETTER_AUTH_SECRET", "GITHUB_CLIENT_SECRET", "FASTNEAR_API_KEY", "NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET", "NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET"]
    }
  }
}
```

| Field | Description |
| ----- | ----------- |
| `variables` | Non-secret config — injected as `runtimeConfig.auth.variables` for UI, `config.variables` for plugin `initialize` |
| `secrets` | Resolved from `.env` (dev) or platform secret store (prod). Plugin does **not** read `process.env` directly |

UI reads SIWN recipient from `runtimeConfig.auth.variables.siwn` — must match server's `siwn()` recipient. Use `pglite:./auth-local.db` for local dev.

## UI Auth Client

Created once, placed on TanStack Router context:

```typescript
export function createAuthClient(options: { runtimeConfig?, headers?, cspNonce? } = {}) {
  const variables = getAuthVariables(options.runtimeConfig);
  const recipient = resolveSiwnRecipient(variables.siwn, options.runtimeConfig?.networkId);

  return createBetterAuthClient({
    baseURL: getHostUrl(options.runtimeConfig),
    fetchOptions: { credentials: "include", ...(options.headers ? { headers: options.headers } : {}) },
    plugins: [
      inferAdditionalFields<Auth>(),
      siwnClient({ recipient, networkId, cspNonce: options.cspNonce }),
      adminClient(), anonymousClient(), phoneNumberClient(),
      passkeyClient(), organizationClient(), apiKeyClient(),
    ],
  });
}
```

Key points: `credentials: "include"` for cookie-based sessions. `inferAdditionalFields<Auth>()` for typed custom fields. Recipient from runtime config (must match server). Client is singleton on router context — `useAuthClient()` accesses it. SSR requires `headers: request.headers` to read session cookies.

## Route Protection

_authenticated layout pattern: use `sessionQueryOptions` to fetch session, `ensureQueryData` in `beforeLoad`, redirect to login if null. Always pass authClient directly, never thread `runtimeConfig` through query options. After sign-in/sign-out, refresh cache: `getSession()` → `setQueryData` → `invalidateQueries`.

## Sign-In Flows

| Method | Client call |
| ------ | ----------- |
| NEAR SIWN | `auth.signIn.near()` |
| Passkey | `auth.signIn.passkey()` |
| Email/password | `auth.signIn.email()` / `auth.signUp.email()` |
| Anonymous | `auth.signIn.anonymous()` |
| Phone OTP | `.sendOtp()` → `.verify()` |
| GitHub/Google | `auth.signIn.social({ provider, callbackURL })` |

The `auth.near.*`, `auth.organization.*`, `auth.passkey.*`, `auth.apiKey.*` namespaces are available. See `better-near-auth#client` for `authClient.near.*` API.

### Sub-Account Creation

The plugin supports sub-account creation and availability checks through the Better Auth client and the oRPC contract:

| Operation | Client call | oRPC route |
|-----------|-------------|------------|
| Check availability | `auth.near.checkSubAccountAvailability({ subAccountName })` | `POST /v1/near/check-sub-account-availability` |
| Create sub-account | `auth.near.createSubAccount({ subAccountName, publicKey })` | `POST /v1/near/create-sub-account` |

Pass `network: "mainnet" | "testnet"` optionally. Both require authentication. Sub-account config (`parentAccount`, `parentHasFullAccess`, `minDeposit`, etc.) is set via `bos.config.json` `variables.siwn.subAccount` — see `better-near-auth#subaccount` for the full config reference and which fields are serializable through JSON config.

## Contract and Types

Import the contract for type-safe calls: `@everything-dev/auth-plugin/contract` (exports `ContractType`, `InferOutput`, `InferInput`). Auth instance types from `@everything-dev/auth-plugin` (exports `Auth`, `AuthServices`, `AuthConfig`).

Generated type bridges connect contract to UI/API:

| File | Bridges |
| ---- | ------- |
| `ui/src/lib/auth-types.gen.ts` | `Auth`, `AuthSession`, `AuthPluginContext` |
| `ui/src/lib/api-types.gen.ts` | `authContract` merged into `ApiContract` |
| `api/src/lib/auth-types.gen.ts` | `AuthPluginContext` for API middleware |
| `api/src/lib/plugins-types.gen.ts` | `PluginsClient = { auth: ClientFactory<authContract> }` |

`AuthPluginContext` is the key type — it flows into every consuming plugin's oRPC context.

## In-Process Plugin Composition

Another plugin receives the auth client via `createPlugin.withPlugins<PluginsClient>()`. In `initialize`, `plugins.auth` is a `ClientFactory<authContract>` — call it with request context for a typed oRPC client.

Create typed middleware from auth context using `createAuthMiddleware(builder)`:

```typescript
const { requireAuth, requireAuthOrApiKey, requireRole, requireAdmin, requireOrgRole, requireApiKey } = createAuthMiddleware(builder);

myRoute: builder.myRoute.use(requireAuth).handler(async ({ context }) => {
  // context.userId, context.user, context.near, context.organization, context.apiKey
}),
```

## The Auth Context (getContext)

The plugin's `GET /v1/auth/context` resolves per-request auth state. Host injects it into consuming plugins — `context.user`, `context.organization`, `context.apiKey`, `context.near` are resolved before your handler runs.

Resolution order: API key check (`x-api-key`, `Authorization: Bearer`) → session fallback (cookies) → NEAR accounts → organization context.

```typescript
interface AuthRequestContext {
  user: { id: string; name: string; email: string; role: string | null; isAnonymous: boolean | null } | null;
  userId: string | null;
  isAuthenticated: boolean;
  authMethod: "session" | "apiKey" | "anonymous" | "none";
  principal: { type: "user" | "organization" | "anonymous"; userId?: string; organizationId?: string } | null;
  apiKey: { id: string; name: string | null; permissions: Record<string, string[]> | null } | null;
  near: { primaryAccountId: string | null; linkedAccounts: Array<{ accountId: string; network: string; publicKey: string; isPrimary: boolean }>; hasNearAccount: boolean };
  organization: { activeOrganizationId: string | null; organization: { id: string; name: string; slug: string } | null; member: { id: string; role: string } | null; isPersonal: boolean; hasOrganization: boolean };
  organizations?: Array<{ id: string; role: string; name?: string; slug?: string }>;
}
```

## Common Mistakes

### CRITICAL SIWN recipient mismatch
- **Cause**: UI reads recipient from `runtimeConfig.auth.variables.siwn`, server has a different `siwn({ recipient })`. NEP-413 signature is valid, just for a different recipient — no clear error.
- **Fix**: The `bos.config.json` `variables.siwn.recipient`/`recipients` **must match** the server's `siwn({ recipient })`.

### CRITICAL Not forwarding headers in SSR auth client
- **Cause**: `createAuthClient({ runtimeConfig })` without `headers: request.headers`. SSR cannot read session cookies → `getSession()` returns null → authenticated routes redirect to login on every render.
- **Fix**: `createAuthClient({ runtimeConfig, headers: request.headers, cspNonce: renderOptions.cspNonce })`.

### HIGH Using apiClient.auth.* instead of authClient for auth actions
- **Cause**: Both oRPC contract (`apiClient.auth.*`) and Better Auth client (`authClient.*`) work, but `apiClient.auth.getSession()` skips cookie/CSRF handling.
- **Fix**: Auth operations go through `authClient` (Better Auth client). The oRPC API client is for app data routes, not auth.

### HIGH Forgetting inferAdditionalFields\<Auth\>()
- **Cause**: Without `inferAdditionalFields<Auth>()`, `$Infer` types miss custom plugin fields (`isAnonymous`, NEAR account fields, org fields). They compile as `unknown`.
- **Fix**: Add `inferAdditionalFields<Auth>()` as the first plugin in `createAuthClient()`.

### HIGH Not refreshing session cache after sign-in/sign-out
- **Cause**: TanStack Query caches session with `staleTime: 60s`. After sign-in, `ensureQueryData` returns the stale null session → redirect to login.
- **Fix**: `getSession()` → `setQueryData(["session"], freshSession)` → `invalidateQueries({ queryKey: ["session"] })` after sign-in/sign-out.

### MEDIUM Missing credentials: "include" in auth client
- **Cause**: HTTP-only cookies for session management. Without `credentials: "include"`, the browser does not send cookies → `getSession()` always returns null.
- **Fix**: `createBetterAuthClient({ fetchOptions: { credentials: "include" } })`.
