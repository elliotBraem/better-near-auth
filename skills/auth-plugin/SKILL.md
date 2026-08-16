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
  calling auth endpoints from another plugin, or debugging auth context
  resolution. As of better-near-auth 1.8.2 the client uses getNearClient()
  (not .client) and signIn.near / near.link refresh the session atomically.
requires:
  - siwn
  - client
metadata:
  type: composition
  library: better-near-auth
  library_version: "1.8.3"
sources:
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/bos.config.json"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/contract.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/auth-export.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/auth-instance.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/config.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/plugins/auth/src/config-schemas.ts"
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

## Library version compatibility

| Library | Plugin version |
| --- | --- |
| `better-near-auth` | 1.8.3 |
| `@everything-dev/auth-plugin` (this skill) | tracks `better-near-auth` 1.8.x |

The auth plugin is read from the registry and forwards its `variables.siwn` and `secrets` to the underlying `siwn()` plugin instance. The plugin does **not** lock to a specific `better-near-auth` version — it accepts whatever the bundled `dist` contains.

### 1.8.x changes that affect plugin consumers

- **1.8.2** — `signIn.near` and `near.link` now notify the session atom on completion, so TanStack Query subscribers pick up the new session without `setQueryData` + `invalidateQueries`. Existing explicit cache refreshes still work; this is a no-op when you already do that.
- **1.8.1** — The client plugin's `authClient.near` namespace no longer exposes a `.client` getter. Use `authClient.near.getNearClient()` to access the near-kit `Near` instance. Code that referenced `authClient.near.client.transaction(...)` must migrate.
- **1.8.0** — Added `authClient.near.detectNearAccount()` for silent wallet probing on login pages.

## Registering in bos.config.json

The current canonical example lives in `examples/auth.everything.dev/bos.config.json`:

```json
{
  "app": {
    "auth": {
      "name": "everything-dev_auth-plugin",
      "development": "local:plugins/auth",
      "production": "https://cdn.example.com/auth-plugin.js",
      "integrity": "sha384-...",
      "variables": {
        "socialProviders": {
          "github": {},
          "google": {}
        },
        "passkey": {
          "rpID": "auth.everything.dev",
          "rpName": "Better NEAR Auth"
        },
        "siwn": {
          "recipients": {
            "mainnet": "auth.everything.near",
            "testnet": "dev.allthethings.testnet"
          },
          "relayer": {
            "accountId": ""
          },
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
      "secrets": [
        "AUTH_DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "GITHUB_CLIENT_SECRET",
        "GOOGLE_CLIENT_SECRET",
        "FASTNEAR_API_KEY",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "RESEND_API_KEY",
        "NEAR_RELAYER_PRIVATE_KEY",
        "NEAR_SUB_ACCOUNT_PARENT_KEY_MAINNET",
        "NEAR_SUB_ACCOUNT_PARENT_KEY_TESTNET"
      ]
    }
  }
}
```

| Field | Description |
| ----- | ----------- |
| `variables` | Non-secret config — injected as `runtimeConfig.auth.variables` for UI, `config.variables` for plugin `initialize` |
| `secrets` | Resolved from `.env` (dev) or platform secret store (prod). Plugin does **not** read `process.env` directly |

The `variables.siwn` shape is validated by `plugins/auth/src/config-schemas.ts`. It accepts either a single `recipient: "app.near"` OR a `recipients: { mainnet, testnet }` pair. The plugin forwards both shapes to `siwn({ recipient | recipients, ... })`. UI must read the recipient it ends up using and pass it to `siwnClient` — the two must match exactly.

`plugin.dev.ts` reads env vars (`ACCOUNT`, `TESTNET_ACCOUNT`, `NEAR_SUB_ACCOUNT_PARENT_*`, `NEAR_RELAYER_*`) so you can override locally without editing `bos.config.json`.

## UI Auth Client

Created once, placed on TanStack Router context:

```typescript
export function createAuthClient(options: { runtimeConfig?, headers?, cspNonce? } = {}) {
  const variables = getAuthVariables(options.runtimeConfig);
  const recipient = resolveSiwnRecipient(variables.siwn, options.runtimeConfig?.networkId);

  return createBetterAuthClient({
    baseURL: getHostUrl(options.runtimeConfig),
    fetchOptions: {
      credentials: "include",
      ...(options.headers ? { headers: options.headers } : {}),
    },
    plugins: [
      inferAdditionalFields<Auth>(),
      siwnClient({ recipient, networkId, cspNonce: options.cspNonce }),
      adminClient(),
      anonymousClient(),
      phoneNumberClient(),
      passkeyClient(),
      organizationClient(),
      apiKeyClient(),
    ],
  });
}
```

Key points:
- `credentials: "include"` for cookie-based sessions.
- `inferAdditionalFields<Auth>()` as the **first** plugin — wires `$Infer` types to the server's actual `Auth` schema (custom fields surface as typed instead of `unknown`).
- Recipient from runtime config must match server's `siwn()` recipient exactly. With dual-network configs, the UI picks the recipient for the active network.
- Client is singleton on router context — `useAuthClient()` accesses it. SSR requires `headers: request.headers` so session cookies are forwarded.
- For direct NEAR Kit transactions, use `authClient.near.getNearClient()` (`1.8.1+`). `authClient.near.client` was removed.

## Route Protection

The `_authenticated` layout pattern from `examples/auth.everything.dev/ui/src/routes/_layout/_authenticated.tsx`:

```typescript
export const Route = createFileRoute('/_layout/_authenticated')({
  beforeLoad: async ({ location, context }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );
    if (!session?.user) {
      throw redirect({ to: "/login", search: { redirect: location.pathname } });
    }
    return { session };
  },
});
```

Always pass `authClient` directly to `sessionQueryOptions` — never thread `runtimeConfig` through query options or component props.

After sign-in or sign-out, refresh the cache so `ensureQueryData` resolves the new session. In `1.8.2+` the SIWN client already notifies the session atom on completion, so explicit `setQueryData` + `invalidateQueries` is no longer required for the NEAR sign-in/sign-out flows. Still required for non-NEAR flows (passkey, social, email/password):

```typescript
await authClient.signIn.near({ ... });
queryClient.setQueryData(["session"], await authClient.getSession().then(r => r.data));
queryClient.invalidateQueries({ queryKey: ["session"] });
```

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
| --- | --- | --- |
| Check availability | `auth.near.checkSubAccountAvailability({ subAccountName })` | `POST /v1/near/check-sub-account-availability` |
| Create sub-account | `auth.near.createSubAccount({ subAccountName, publicKey })` | `POST /v1/near/create-sub-account` |

Pass `network: "mainnet" \| "testnet"` optionally — both endpoints auto-populate from the active network atom when omitted. Both require authentication. Sub-account config (`parentAccount`, `parentHasFullAccess`, `minDeposit`, etc.) is set via `bos.config.json` `variables.siwn.subAccount` — see `better-near-auth#subaccount` for the full config reference and which fields are serializable through JSON.

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

Another plugin receives the auth client via `createPlugin.withPlugins<PluginsClient>()`. In `initialize`, `plugins.auth` is a `ClientFactory<authContract>` — call it with request context for a typed oRPC client:

```typescript
const auth = await plugins.auth({ context });
const session = await auth.getAuthContext();
```

Create typed middleware from auth context using `createAuthMiddleware(builder)`:

```typescript
const { requireAuth, requireAuthOrApiKey, requireRole, requireAdmin, requireOrgRole, requireApiKey } =
  createAuthMiddleware(builder);

myRoute: builder.myRoute
  .use(requireAuth)
  .handler(async ({ context }) => {
    // context.userId, context.user, context.near, context.organization, context.apiKey
  }),
```

## The Auth Context (getContext)

The plugin's `GET /v1/auth/context` resolves per-request auth state. The host injects it into consuming plugins — `context.user`, `context.organization`, `context.apiKey`, `context.near` are resolved before your handler runs.

Resolution order: API key check (`x-api-key`, `Authorization: Bearer`) → session fallback (cookies) → NEAR accounts → organization context.

```typescript
interface AuthRequestContext {
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    isAnonymous: boolean | null;
  } | null;
  userId: string | null;
  isAuthenticated: boolean;
  authMethod: "session" | "apiKey" | "anonymous" | "none";
  principal: {
    type: "user" | "organization" | "anonymous";
    userId?: string;
    organizationId?: string;
  } | null;
  apiKey: {
    id: string;
    name: string | null;
    permissions: Record<string, string[]> | null;
  } | null;
  near: {
    primaryAccountId: string | null;
    linkedAccounts: Array<{
      accountId: string;
      network: string;
      publicKey: string;
      isPrimary: boolean;
    }>;
    hasNearAccount: boolean;
  };
  organization: {
    activeOrganizationId: string | null;
    organization: { id: string; name: string; slug: string } | null;
    member: { id: string; role: string } | null;
    isPersonal: boolean;
    hasOrganization: boolean;
  };
  organizations?: Array<{
    id: string;
    role: string;
    name?: string;
    slug?: string;
  }>;
}
```

## Common Mistakes

### CRITICAL SIWN recipient mismatch

- **Cause**: UI reads recipient from `runtimeConfig.auth.variables.siwn`, server has a different `siwn({ recipient })`. NEP-413 signature is valid, just for a different recipient — verification fails with no clear error.
- **Fix**: `bos.config.json` `variables.siwn.recipient` / `variables.siwn.recipients.{mainnet,testnet}` must match the server's `siwn({ recipient | recipients })`. With dual networks, the UI picks the recipient for the active network and the server resolves it from the same `recipients.mainnet` / `recipients.testnet` map.

### CRITICAL Not forwarding headers in SSR auth client

- **Cause**: `createAuthClient({ runtimeConfig })` without `headers: request.headers`. SSR cannot read session cookies → `getSession()` returns null → authenticated routes redirect to login on every render.
- **Fix**: `createAuthClient({ runtimeConfig, headers: request.headers, cspNonce: renderOptions.cspNonce })`.

### CRITICAL Using authClient.near.client (removed in 1.8.1)

- **Cause**: `authClient.near.client.transaction(...)` was a getter that broke better-auth's `$InferServerPlugin` type inference. It was removed in 1.8.1.
- **Fix**: `authClient.near.getNearClient().transaction(...)`. The method still throws on the server (no wallet there).

### HIGH Using apiClient.auth.* instead of authClient for auth actions

- **Cause**: Both oRPC contract (`apiClient.auth.*`) and Better Auth client (`authClient.*`) work, but `apiClient.auth.getSession()` skips cookie/CSRF handling.
- **Fix**: Auth operations go through `authClient` (Better Auth client). The oRPC API client is for app data routes, not auth.

### HIGH Forgetting inferAdditionalFields<Auth>()

- **Cause**: Without `inferAdditionalFields<Auth>()`, `$Infer` types miss custom plugin fields (`isAnonymous`, NEAR account fields, org fields). They compile as `unknown`.
- **Fix**: Add `inferAdditionalFields<Auth>()` as the first plugin in `createAuthClient()`.

### MEDIUM Not refreshing session cache after non-NEAR sign-in flows

- **Cause**: TanStack Query caches session with `staleTime: 60s`. NEAR sign-in/sign-out auto-notify in `1.8.2+`, but passkey/social/email flows still need an explicit refresh to avoid the next `ensureQueryData` returning the stale null session.
- **Fix**: After passkey/social/email sign-in/sign-out: `getSession()` → `setQueryData(["session"], freshSession)` → `invalidateQueries({ queryKey: ["session"] })`. NEAR flows can rely on the built-in signal notification but explicit refresh remains safe.

### MEDIUM Missing credentials: "include" in auth client

- **Cause**: HTTP-only cookies for session management. Without `credentials: "include"`, the browser does not send cookies → `getSession()` always returns null.
- **Fix**: `createBetterAuthClient({ fetchOptions: { credentials: "include" } })`.

### MEDIUM Configuring sub-account fields that aren't serializable through JSON

- **Cause**: Only scalar fields survive JSON round-trip (`bos.config.json`). Function-typed fields (`extendTx`, `onCreated`, `onRollback`, dynamic `init.args`) and binary data (`deploy.wasm`) cannot be expressed in a config file.
- **Fix**: Use `bos.config.json` for `parentAccount`, `parentHasFullAccess`, `minDeposit`, `deploy.fromPublished`, static `init.args`, `addRelayerFCAK`, `relayerFCAK`. Configure `extendTx` / `onCreated` / `onRollback` / dynamic `init.args` / raw wasm through `siwn()` directly on the server instead of through the plugin.
