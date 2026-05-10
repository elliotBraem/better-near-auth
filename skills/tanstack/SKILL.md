---
name: tanstack
description: >
  Integrate better-near-auth with TanStack Router (SSR or CSR). Set up auth
  client as a router context singleton, useAuthClient hook, session query
  options, inferred types from AuthClient, and ensureConnected before signing.
  Load when scaffolding a new TanStack Router app with better-near-auth,
  wiring auth into router context, or debugging wallet state loss after
  sign-in in SSR/CSR TanStack apps.
type: framework
requires:
  - client
  - siwn
library: better-near-auth
library_version: "1.4.1"
sources:
  - "elliotBraem/better-near-auth:src/client.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/auth.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/app.ts"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/hydrate.tsx"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/router.tsx"
  - "elliotBraem/better-near-auth:examples/auth.everything.dev/ui/src/router.server.tsx"
  - "elliotBraem/better-near-auth:examples/browser-2-server/apps/web/src/lib/auth-client.ts"
---

# Better-Near-Auth — TanStack Router Integration

Integration pattern for better-near-auth with TanStack Router apps, covering both CSR (client-side only) and SSR (server-rendered) setups. Establishes the auth client as a router context singleton, provides hooks and query options, and ensures wallet state survives page navigation and hydration.

## Architecture: Two Patterns

### Pattern A: Module singleton (CSR only)

For apps without SSR — config is known at build time or from env vars:

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:3000",
  plugins: [
    siwnClient({ recipient: "myapp.near", networkId: "mainnet" }),
  ],
});
```

Import directly in any component or route. Simple, correct for CSR.

### Pattern B: Router context singleton (SSR or CSR with runtime config)

For TanStack Router apps with SSR, Module Federation, or runtime config (`window.__RUNTIME_CONFIG__`):

```typescript
// auth.ts — single file for client factory, types, hooks, and query options
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Auth } from "./auth-types.gen";
import { getAccount, getHostUrl, getNetworkId } from "@/app";

export function createAuthClient() {
  return createBetterAuthClient({
    baseURL: getHostUrl(),
    fetchOptions: { credentials: "include" },
    plugins: [
      siwnClient({ recipient: getAccount(), networkId: getNetworkId() }),
    ],
  });
}

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionData = AuthClient["$Infer"]["Session"];

export function useAuthClient(): AuthClient {
  return useRouter().options.context.authClient;
}
```

The auth client is created once in the router setup (not per component call) and accessed via context:

```typescript
// hydrate.tsx
import { createAuthClient } from "./auth";

const { router } = createRouter({
  context: {
    authClient: createAuthClient(),
  },
});

// router.server.tsx — same pattern
context: {
  authClient: createAuthClient(),
}
```

## Type Inference from AuthClient

Don't manually define `Organization`, `Passkey`, or other entity types. Infer them from the client's API responses:

```typescript
type UnwrapListResponse<T> = T extends (...args: any[]) => Promise<{
  data: (infer U)[] | null; error: any
}> ? U : never;

export type Organization = UnwrapListResponse<AuthClient["organization"]["list"]>;
export type Passkey = UnwrapListResponse<AuthClient["passkey"]["listUserPasskeys"]>;
```

This automatically includes any additional fields the server configured. Single source of truth: the `AuthClient` type, which is itself derived from the plugin list.

## Session Query Options

Always pass the auth client directly — never thread `runtimeConfig` through query options:

```typescript
export function sessionQueryOptions(
  authClient: AuthClient,
  initialSession?: SessionData | null,
) {
  return {
    queryKey: ["session"],
    queryFn: async () => {
      const { data: session } = await authClient.getSession();
      return session ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialData: initialSession,
  };
}
```

In `beforeLoad`/`loader` (not components), use `context.authClient`:

```typescript
beforeLoad: async ({ context }) => {
  const session = await context.queryClient.ensureQueryData(
    sessionQueryOptions(context.authClient, context.session),
  );
  if (!session?.user) {
    throw redirect({ to: "/login" });
  }
  return { session };
},
```

In components, use `useAuthClient()`:

```typescript
const auth = useAuthClient();
const { data } = await auth.organization.list();
```

## Router Context Setup

### Define RouterContext with authClient

```typescript
// app.ts
import type { AuthClient, SessionData } from "./auth";

export interface RouterContext extends BaseRouterContext {
  apiClient: ApiClient;
  authClient: AuthClient;
}
```

### Wire in router files

Both `router.tsx` (client) and `router.server.tsx` (server) must include `authClient` in context:

```typescript
context: {
  queryClient,
  authClient: opts.context.authClient,
  apiClient: opts.context.apiClient,
  runtimeConfig: opts.context.runtimeConfig,
  session: opts.context.session,
},
```

### Remove runtimeConfig from component props

Components no longer need `runtimeConfig` props for auth. They use `useAuthClient()` instead. Remove `runtimeConfig` prop threading from:
- Route components that pass it to child components
- Shared components like `UserNav`, `OrgSwitcher`, `RelayFeed`, `NearProfile`

## Wallet State and Signing

### ensureConnected before signing

Wallet extensions (Meteor, HERE) may disconnect after the initial sign-in popup. Always call `ensureConnected()` before any signing operation:

```typescript
// Relay mode — automatic (buildSignedDelegateAction calls ensureConnected internally)
const payload = await authClient.near.buildSignedDelegateAction(...);

// Direct mode — manual
await authClient.near.ensureConnected();
authClient.near.client.transaction(accountId)
  .functionCall(contract, "method", args, opts)
  .send({ waitUntil: "FINAL" });
```

### nearState persists accountId across disconnects

When the wallet disconnects externally:
- `getAccountId()` still returns the accountId (from session restore)
- `isWalletConnected()` returns false
- `publicKey` is cleared from state

This means UI can display the user's NEAR account even when the wallet is disconnected. Signing operations automatically prompt reconnection.

## SSR Safety

`siwnClient()` is SSR-safe — wallet resources are lazily initialized on first client-side access. On the server they sit dormant. This means `createAuthClient()` can safely run in `router.server.tsx` without accessing browser APIs.

Methods that work on server (via `$fetch` only): `nonce`, `verify`, `view`, `relayTransaction`, `getRelayStatus`, `getRelayerInfo`, `relayHistory`, `getProfile`, `listAccounts`.

Methods that throw on server: `buildSignedDelegateAction`, `ensureConnected`, `signIn.near`, `link`, `disconnect`.

Properties that return defaults on server: `getAccountId()` → `null`, `getState()` → `null`, `isWalletConnected()` → `false`.

## File Consolidation

Replace three separate files with one `auth.ts`:

| Before | After |
| ------ | ----- |
| `lib/auth-client.ts` (factory + types) | `auth.ts` (factory + types + hooks + queries) |
| `lib/session.ts` (query options) | `auth.ts` |
| `lib/auth-hooks.ts` (relay history hook) | `auth.ts` |

The consolidated `auth.ts` is ~80 lines and eliminates all `runtimeConfig` parameter threading.

## Common Mistakes

### CRITICAL Creating multiple siwnClient instances via factory

Wrong:

```typescript
function getAuthClient(config) {
  return createAuthClient({
    plugins: [siwnClient({ recipient: getAccount(config) })],
  });
}
// Every call creates new nearState atom — wallet state lost
```

Correct:

```typescript
// Module singleton (CSR)
export const authClient = createAuthClient({
  plugins: [siwnClient({ recipient: "myapp.near" })],
});

// OR: Router context singleton (SSR)
export function createAuthClient() {
  return createBetterAuthClient({
    plugins: [siwnClient({ recipient: getAccount() })],
  });
}
// Create once in router setup, access via useAuthClient()
```

`siwnClient()` creates stateful singletons: `nearState` atom, `walletConnected` atom, `NearConnector` with event listeners, `Near` instance. Multiple instances means wallet sign-in populates one atom while your app reads from another. Always create exactly one per app lifecycle.

Source: src/client.ts:64-72

See also: client/SKILL.md — CRITICAL singleton requirement

### HIGH Threading runtimeConfig through query options and component props

Wrong:

```typescript
// session.ts
export const sessionQueryOptions = (initialSession, runtimeConfig) => ({
  queryFn: () => getAuthClient(runtimeConfig).getSession(),
});

// Component
<UserNav runtimeConfig={runtimeConfig} />
// Inside UserNav: const auth = getAuthClient(runtimeConfig);
```

Correct:

```typescript
// auth.ts
export const sessionQueryOptions = (authClient, initialSession?) => ({
  queryFn: () => authClient.getSession(),
});

// Component
function UserNav() {
  const auth = useAuthClient();
}
```

`runtimeConfig` was threaded through props and query options solely to create auth client instances. With router context, the auth client is a singleton accessed via `useAuthClient()`. No config threading needed.

Source: auth.ts:54-67

### HIGH Using near.client.send() without ensureConnected

Wrong:

```typescript
authClient.near.client.transaction(accountId)
  .functionCall(contract, "method", args, opts)
  .send(); // fails if wallet disconnected after sign-in
```

Correct:

```typescript
await authClient.near.ensureConnected();
authClient.near.client.transaction(accountId)
  .functionCall(contract, "method", args, opts)
  .send();
```

Wallet extensions disconnect between sign-in and subsequent signing. `buildSignedDelegateAction` calls `ensureConnected` automatically, but direct `.send()` does not.

Source: src/client.ts:249-253

### MEDIUM Module-level singleton in SSR causes cross-request state leaks

Wrong (SSR):

```typescript
// Module-level singleton — shared across all server requests
export const authClient = createAuthClient({
  plugins: [siwnClient({ recipient: "myapp.near" })],
});
```

Correct (SSR):

```typescript
// Factory — one instance per router/request
export function createAuthClient() {
  return createBetterAuthClient({
    plugins: [siwnClient({ recipient: getAccount() })],
  });
}
// Created in createRouter() context
```

On the server, a module-level singleton's `$fetch` and session state would be shared across concurrent requests. Router context isolates one client per request on server, one per app on client.

Source: router.server.tsx:60-71
