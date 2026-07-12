---
name: auth-plugin
description: >
  Mount and consume the @everything-dev/auth-plugin in an everything-dev or
  every-plugin project. Register it in bos.config.json, wire the Better Auth
  client into the UI with siwnClient/passkey/API-key/organization plugins,
  protect routes with session checks, compose with the auth plugin in-process
  via createPlugin.withPlugins, and use the auth context (getContext) in your
  own oRPC middleware. Load when adding auth to an everything.dev app,
  configuring SIWN recipients from runtime config, calling auth endpoints from
  another plugin, or debugging auth context resolution.
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

The `@everything-dev/auth-plugin` wraps `better-near-auth` and Better Auth into an everything-plugin (oRPC + Effect + Module Federation). It provides session management, NEAR SIWN, passkeys, GitHub/Google OAuth, phone OTP, anonymous accounts, organizations, API keys, and a NEAR relayer — all behind a typed oRPC contract.

This skill covers **consuming** the plugin from an everything-dev or every-plugin project: registration, UI auth client, route protection, in-process composition, and the auth context.

## Related Skills

| Skill | When to load |
| ----- | ------------ |
| `everything-dev#api-and-auth` | Broad API architecture, oRPC contract patterns, session handling |
| `everything-dev#plugin-development` | Plugin scaffold, bos.config.json registration, deploy workflow |
| `every-plugin#plugin-development` | Contract/service/index pattern, Effect services |
| `every-plugin#plugin-testing` | Vitest setup for plugins |
| `better-near-auth#siwn` | Server-side SIWN plugin options (recipient, nonce, verify) |
| `better-near-auth#client` | Client-side siwnClient, wallet actions, delegate building |
| `better-near-auth#relay` | Relayer config, delegate actions, whitelisting |
| `better-near-auth#tanstack` | Router context singleton, SSR wiring, session query options |

## Registering in bos.config.json

The auth plugin is declared under `app.auth` as a federated Module Federation container:

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
          "relayer": { "accountId": "" }
        }
      },
      "secrets": [
        "AUTH_DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "GITHUB_CLIENT_SECRET",
        "FASTNEAR_API_KEY"
      ]
    }
  }
}
```

| Field | Description |
| ----- | ----------- |
| `name` | Module Federation container name (`everything-dev_auth-plugin`) |
| `development` | Local workspace path (`local:plugins/auth`) |
| `production` | Deployed bundle URL (Zephyr CDN) |
| `integrity` | SRI hash for the production bundle |
| `variables` | Non-secret config passed to the plugin at runtime |
| `secrets` | Secret names resolved from `.env` (dev) or platform secret store (prod) |

The host injects `variables` as `runtimeConfig.auth.variables` for the UI and as `config.variables` / `config.secrets` for the plugin's `initialize` function. The plugin itself does **not** read `process.env` — all config flows through the host.

### SIWN recipient configuration

Use `siwn.recipient` for single-network, or `siwn.recipients.mainnet` + `siwn.recipients.testnet` for dual-network. The UI auth client reads these from runtime config to configure `siwnClient`.

### Environment variables

The `.env.example` is auto-generated from the `secrets` arrays:

```bash
# app.auth
AUTH_DATABASE_URL=pglite:./auth-local.db
BETTER_AUTH_SECRET=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_SECRET=
FASTNEAR_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
NEAR_RELAYER_PRIVATE_KEY=
RESEND_API_KEY=
```

Use `pglite:./auth-local.db` for zero-config local dev (no Docker). Use a Postgres connection string for production.

## UI Auth Client

The auth client is a Better Auth React client wired with all plugin client modules. It is created once and placed on the TanStack Router context.

### createAuthClient factory

```typescript
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient, anonymousClient,
  inferAdditionalFields, organizationClient, phoneNumberClient,
} from "better-auth/client/plugins";
import type { Auth } from "./auth-types.gen";
import { getRuntimeConfig } from "everything-dev/ui/runtime";

export function createAuthClient(options: { runtimeConfig?, headers?, cspNonce? } = {}) {
  const variables = getAuthVariables(options.runtimeConfig);
  const siwn = variables.siwn;
  const mainnetRecipient = siwn.recipients?.mainnet ?? siwn.recipient;
  const networkId = runtimeConfig?.networkId
    ?? (mainnetRecipient.endsWith(".testnet") ? "testnet" : "mainnet");
  const recipient = networkId === "testnet" && siwn.recipients?.testnet
    ? siwn.recipients.testnet
    : mainnetRecipient;

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

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionData = AuthClient["$Infer"]["Session"];
```

Key points:

- **`credentials: "include"`** is required — auth uses HTTP cookies for sessions.
- **`inferAdditionalFields<Auth>()`** pulls type inference from the plugin's exported `Auth` type (from `auth-export.ts`). Without it, custom fields like `isAnonymous` are untyped.
- **SIWN recipient** is resolved from `runtimeConfig.auth.variables.siwn` — the same `variables` block from `bos.config.json`. The recipient **must match** the server's `siwn()` recipient.
- **`baseURL`** is the host URL (same origin). The Better Auth handler is mounted by the plugin and proxied by the host.

### Router context singleton

```typescript
export function useAuthClient(): AuthClient {
  return useRouter().options.context.authClient;
}
```

The auth client is created once in the router setup and accessed via `useAuthClient()`. Do not create multiple instances — `siwnClient()` creates stateful singletons (wallet atoms, event listeners).

### SSR: per-request client with header forwarding

```typescript
// router.server.tsx — pass runtimeConfig AND headers
authClient: createAuthClient({
  runtimeConfig: renderOptions.runtimeConfig,
  headers: request.headers,
  cspNonce: renderOptions.cspNonce,
}),
```

On the server, `headers` must be forwarded so the Better Auth client can read session cookies. Without headers, SSR cannot resolve the session.

## Route Protection

### The _authenticated layout pattern

```typescript
export const Route = createFileRoute("/_layout/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(
      sessionQueryOptions(context.authClient, context.session),
    );

    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    if (session.user.banned) {
      throw redirect({ to: "/login", hash: "banned" });
    }

    return {
      auth: {
        isAuthenticated: true,
        user: session.user,
        session: session.session,
        activeOrganizationId: session.session?.activeOrganizationId || null,
        isAnonymous: session.user.isAnonymous || false,
        isAdmin: session.user.role === "admin",
      },
    };
  },
});
```

Child routes under `_authenticated/` access the auth context via `Route.useRouteContext()`.

### sessionQueryOptions

```typescript
export function sessionQueryOptions(
  authClient: AuthClient,
  initialSession?: SessionData | null,
) {
  const base = {
    queryKey: ["session"] as const,
    queryFn: async () => {
      const { data: session } = await authClient.getSession();
      return session ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };
  return initialSession === undefined ? base : { ...base, initialData: initialSession };
}
```

Always pass the auth client directly — never thread `runtimeConfig` through query options.

### Post-sign-in session refresh

After any sign-in or sign-out action, refresh the session cache:

```typescript
await auth.signIn.near({ onSuccess, onError });
const { data: freshSession } = await auth.getSession();
queryClient.setQueryData(["session"], freshSession);
queryClient.invalidateQueries({ queryKey: ["session"] });
navigate({ to: "/home" });
```

## Sign-In Flows

| Method | Client call |
| ------ | ----------- |
| NEAR SIWN | `auth.signIn.near({ onSuccess, onError })` |
| Passkey | `auth.signIn.passkey({ autoFill, fetchOptions })` |
| Email/password | `auth.signIn.email({ email, password })` / `auth.signUp.email(...)` |
| Anonymous | `auth.signIn.anonymous()` |
| Phone OTP | `auth.phoneNumber.sendOtp({ phoneNumber })` → `auth.phoneNumber.verify({ phoneNumber, code })` |
| GitHub OAuth | `auth.signIn.social({ provider: "github", callbackURL })` |
| Google OAuth | `auth.signIn.social({ provider: "google", callbackURL })` |

The `near`, `organization`, `passkey`, and `apiKey` namespaces are available on the auth client:

```typescript
auth.near.listAccounts();
auth.near.getProfile();
auth.near.buildSignedDelegateAction(receiverId, (builder, r) => builder.functionCall(r, "method", args, opts));
auth.near.relayTransaction({ payload });
auth.organization.list();
auth.passkey.listUserPasskeys();
```

See also: `better-near-auth#client` for the full `authClient.near.*` API.

## Contract and Types

### Import paths

```typescript
// Full contract (oRPC route definitions + Zod schemas)
import type { ContractType } from "@everything-dev/auth-plugin/contract";
import type { InferOutput, InferInput } from "@everything-dev/auth-plugin/contract";

// Auth instance types
import type { Auth, AuthServices, AuthConfig, AuthDatabase } from "@everything-dev/auth-plugin";
```

### Type bridge files

The everything.dev scaffold generates type bridges that connect the plugin's contract to the UI and API:

| File | Purpose |
| ---- | ------- |
| `ui/src/lib/auth-types.gen.ts` | Re-exports `Auth`, `AuthSession`, `AuthRequestContext`, `AuthPluginContext` from the plugin |
| `ui/src/lib/api-types.gen.ts` | Merges `authContract` into `ApiContract` so `apiClient.auth.*` is typed |
| `api/src/lib/auth-types.gen.ts` | Same as UI — provides `AuthPluginContext` for API middleware |
| `api/src/lib/plugins-types.gen.ts` | Defines `PluginsClient = { auth: ClientFactory<authContract> }` |

`AuthPluginContext` is the key type — it is the output shape of the auth plugin's `getContext` endpoint, and it flows into every consuming plugin's oRPC context.

## In-Process Plugin Composition

When another plugin (e.g., the app API) needs to call the auth plugin or use auth context, it uses `createPlugin.withPlugins<PluginsClient>()`.

### Receiving the auth plugin client

```typescript
import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import type { PluginsClient } from "./lib/plugins-types.gen";

export default createPlugin.withPlugins<PluginsClient>()({
  // ...

  initialize: (config, plugins) =>
    Effect.gen(function* () {
      // plugins.auth is a ClientFactory<authContract>
      // Call it with request context to get a typed oRPC client
      const authClient = plugins.auth;
      return { auth: authClient, /* other services */ };
    }),

  createRouter: (services, builder) => {
    const { requireAuth } = createAuthMiddleware(builder);
    return {
      myRoute: builder.myRoute.use(requireAuth).handler(async ({ context }) => {
        return { userId: context.userId };
      }),
    };
  },
});
```

`plugins.auth` is a factory `(context?) => ContractRouterClient<authContract>`. The host runtime wires the auth plugin's oRPC router in-process via Module Federation shared scope.

### Auth context flow

The host calls the auth plugin's `getContext` endpoint per request and injects the result into the consuming plugin's oRPC context. This means `context.user`, `context.userId`, `context.organization`, `context.apiKey`, and `context.near` are already resolved before your route handler runs.

### createAuthMiddleware

The consuming plugin creates typed middleware from the auth context:

```typescript
import { createAuthMiddleware } from "./lib/auth";

const {
  requireAuth,          // requires context.user + context.userId
  requireAuthOrApiKey,  // accepts session OR API key
  requireRole,          // requires specific user role
  requireAdmin,         // shorthand for requireRole("admin")
  requireOrganization,  // requires active organization
  requireOrgRole,       // requires org + member role (owner/admin/member)
  requireApiKey,        // requires API key, optionally checks permissions
} = createAuthMiddleware(builder);
```

Attach to routes:

```typescript
myProtectedRoute: builder.myProtectedRoute
  .use(requireAuth)
  .handler(async ({ context }) => {
    return { userId: context.userId };
  }),

orgAdminRoute: builder.orgAdminRoute
  .use(requireOrgRole("owner", "admin"))
  .handler(async ({ context }) => {
    return {
      orgId: context.organization.activeOrganizationId,
      memberRole: context.organization.member.role,
    };
  }),

apiKeyRoute: builder.apiKeyRoute
  .use(requireApiKey({ "resource": ["read", "write"] }))
  .handler(async ({ context }) => {
    return { keyId: context.apiKey.id };
  }),
```

## The Auth Context (getContext)

The auth plugin's `GET /v1/auth/context` endpoint resolves the full request context. The host injects this into consuming plugins. The shape:

```typescript
interface AuthRequestContext {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string | null;
    isAnonymous: boolean | null;
  } | null;

  userId: string | null;
  isAuthenticated: boolean;
  authMethod: "session" | "apiKey" | "anonymous" | "none";

  principal:
    | { type: "user"; userId: string; user: SessionUser }
    | { type: "organization"; organizationId: string }
    | { type: "anonymous"; userId: string; user: SessionUser | null }
    | null;

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
    organization: {
      id: string;
      name: string;
      slug: string;
      logo: string | null;
      metadata?: Record<string, unknown>;
    } | null;
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

### Auth resolution flow

1. **API key check**: scans `apiKeyHeaders` (default `x-api-key`) and `Authorization: Bearer` tokens with `api_` or `org_` prefixes. Verifies against `user-keys` and `org-keys` configs.
2. **Session fallback**: if no API key, resolves the Better Auth session from cookies via `auth.api.getSession({ headers })`.
3. **NEAR capabilities**: queries `nearAccount` table for linked NEAR accounts.
4. **Organization context**: resolves active organization from session's `activeOrganizationId`, or from the API key's org reference.

### Using auth context in route handlers

```typescript
myRoute: builder.myRoute.use(requireAuth).handler(async ({ context }) => {
  // context.userId — string (guaranteed by requireAuth)
  // context.user — full user object
  // context.near — NEAR account capabilities
  // context.organization — active org context
  // context.apiKey — API key info (null if session auth)
}),
```

## oRPC Contract Reference

The auth plugin exposes these endpoint groups via its oRPC contract:

| Group | Endpoints |
| ----- | --------- |
| Session | `getSession`, `getContext`, `getActiveMember`, `health` |
| Organizations | `listOrganizations`, `listAllOrganizations`, `createOrganization`, `setActiveOrganization`, `getOrganization`, `updateOrganization`, `deleteOrganization`, `leaveOrganization` |
| Members | `listMembers`, `removeMember`, `updateMemberRole` |
| Invitations | `inviteMember`, `getInvitation`, `listInvitations`, `cancelInvitation`, `resendInvitation`, `acceptInvitation`, `rejectInvitation` |
| API Keys | `listApiKeys`, `createApiKey`, `updateApiKey`, `deleteApiKey`, `verifyApiKey` |
| NEAR SIWN | `nearNonce`, `nearVerify`, `nearProfile`, `nearLinkAccount`, `nearUnlinkAccount`, `nearListAccounts` |
| NEAR Relay | `nearRelay`, `nearRelayStatus`, `nearRelayerInfo`, `nearRelayHistory`, `nearView` |
| NEAR Sub-accounts | `nearCheckSubAccountAvailability`, `nearCreateSubAccount` |

Import the contract for type-safe calls from another plugin or client:

```typescript
import type { ContractType } from "@everything-dev/auth-plugin/contract";
import type { InferOutput } from "@everything-dev/auth-plugin/contract";

type SessionResult = InferOutput<"getSession">;
type ContextResult = InferOutput<"getContext">;
```

## Common Mistakes

### CRITICAL SIWN recipient mismatch between bos.config.json and server

Wrong:

```json
// bos.config.json — variables.siwn
{ "recipient": "myapp.near" }
```

```typescript
// Server plugin (auth-instance.ts)
siwn({ recipient: "myapp.com" }) // different!
```

Correct:

```json
// bos.config.json
{ "recipient": "myapp.near" }
```

```typescript
// Server — same recipient
siwn({ recipient: "myapp.near" })
```

The UI client reads the recipient from `runtimeConfig.auth.variables.siwn` and embeds it in the NEP-413 signed message. The server verifies against its own `siwn()` recipient. A mismatch causes verification to fail with "Invalid signature" — confusing because the signature is valid, just for a different recipient.

See also: `better-near-auth#siwn` — server recipient configuration

### CRITICAL Not forwarding headers in SSR auth client

Wrong:

```typescript
// router.server.tsx
authClient: createAuthClient({ runtimeConfig: renderOptions.runtimeConfig }),
// No headers — SSR cannot read session cookies
```

Correct:

```typescript
authClient: createAuthClient({
  runtimeConfig: renderOptions.runtimeConfig,
  headers: request.headers,
  cspNonce: renderOptions.cspNonce,
}),
```

The Better Auth client resolves sessions via HTTP cookies. On the server, `request.headers` must be forwarded to the auth client so it can read the cookie header. Without headers, `getSession()` returns null during SSR, causing authenticated routes to redirect to login on every server render.

Source: ui/src/router.server.tsx

### HIGH Using apiClient.auth.* instead of authClient for auth actions

Wrong:

```typescript
const api = useApiClient();
await api.auth.getSession(); // oRPC call — no cookie handling
```

Correct:

```typescript
const auth = useAuthClient();
const { data: session } = await auth.getSession(); // Better Auth client — cookies
```

The auth plugin exposes its endpoints via both the oRPC contract (typed as `apiClient.auth.*`) and the Better Auth HTTP handler (used by `authClient.*`). Auth actions (sign-in, sign-out, session, passkey, organization, NEAR) must go through the Better Auth client (`authClient`) because it handles cookies, CSRF tokens, and plugin-specific client logic. The oRPC API client is for app data routes.

### HIGH Forgetting inferAdditionalFields\<Auth\>()

Wrong:

```typescript
plugins: [
  siwnClient({ recipient, networkId }),
  // no inferAdditionalFields — custom fields untyped
],
```

Correct:

```typescript
plugins: [
  inferAdditionalFields<Auth>(),
  siwnClient({ recipient, networkId }),
  // ...
],
```

Without `inferAdditionalFields<Auth>()`, the auth client's `$Infer` types don't include fields added by the plugin (e.g., `isAnonymous`, NEAR account fields, organization fields). Type inference still works for built-in Better Auth fields, but custom fields are `unknown`.

Source: ui/src/lib/auth.ts

### HIGH Not refreshing session cache after sign-in/sign-out

Wrong:

```typescript
await auth.signIn.near({ onSuccess: () => navigate({ to: "/home" }) });
// Session cache still has stale null — _authenticated layout redirects back to login
```

Correct:

```typescript
await auth.signIn.near({
  onSuccess: async () => {
    const { data: freshSession } = await auth.getSession();
    queryClient.setQueryData(["session"], freshSession);
    await queryClient.invalidateQueries({ queryKey: ["session"] });
    navigate({ to: "/home" });
  },
});
```

TanStack Query caches the session with `staleTime: 60s`. After sign-in, the cache still holds the previous (null) session. Without `setQueryData` + `invalidateQueries`, the `_authenticated` layout's `ensureQueryData` returns the stale null session and redirects to login.

Source: ui/src/routes/_layout/login.tsx

### MEDIUM Missing credentials: "include" in auth client

Wrong:

```typescript
createBetterAuthClient({
  baseURL: hostUrl,
  // no fetchOptions — cookies not sent
  plugins: [siwnClient({ recipient })],
});
```

Correct:

```typescript
createBetterAuthClient({
  baseURL: hostUrl,
  fetchOptions: { credentials: "include" },
  plugins: [siwnClient({ recipient })],
});
```

Better Auth uses HTTP-only cookies for session management. Without `credentials: "include"`, the browser does not send cookies with auth requests, so `getSession()` always returns null even when the user is logged in.

Source: ui/src/lib/auth.ts
