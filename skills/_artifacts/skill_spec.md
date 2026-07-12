# Better-Near-Auth — Skill Spec
# Generated: 2026-07-11 | Library version: 1.6.5

Better-near-auth is a Better Auth plugin implementing Sign in with NEAR (SIWN, NEP-413) and a built-in NEP-366 delegate action relayer. It provides wallet-based authentication for web applications and enables gasless on-chain transactions on behalf of authenticated users.

## Domains

| Domain | Description | Skills |
| ------ | ----------- | ------ |
| SIWN authentication | Server-side NEAR wallet sign-in: plugin setup, NEP-413 flow, account linking, profile lookup, sub-account creation | siwn |
| Gasless relay | Delegate action relay: ephemeral/explicit config, NEP-366 flow, whitelisting, limits | relay |
| Client integration | Client-side plugin: wallet connection, authClient.near actions, sign-in flow | client |
| TanStack Router integration | Framework integration: router context singleton, SSR safety, hooks, query options, type inference | tanstack |
| Auth plugin (everything.dev) | Plugin consumption: bos.config.json registration, UI auth client, route protection, in-process composition, auth context | auth-plugin |

## Skill Inventory

| Skill | Type | Domain | What it covers | Failure modes |
| ------ | ---- | ------ | -------------- | ------------- |
| siwn | core | siwn | Plugin setup, nonce/verify, account linking, profiles, sub-account creation | 6 |
| relay | core | relay | Relayer modes, delegate actions, whitelisting, gas limits | 4 |
| client | core | client | siwnClient config, wallet actions, sign-in, delegate building, SSR behavior | 5 |
| tanstack | framework | tanstack | Router context singleton, useAuthClient hook, sessionQueryOptions, type inference, SSR wiring | 5 |
| auth-plugin | composition | auth-plugin | bos.config.json registration, UI auth client, route protection, in-process composition, auth context | 6 |

## Failure Mode Inventory

### siwn (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|--------------|
| 1 | Recipient mismatch between server and client | CRITICAL | src/index.ts:225, src/client.ts:108 | client, tanstack |
| 2 | Sending raw nonce bytes instead of hex-encoded string | HIGH | src/types.ts:53-58, src/client.ts:174-175 | client |
| 3 | Forgetting to generate DB schema after adding plugin | HIGH | README.md:56-60 | — |
| 4 | Not configuring parentAccount for sub-account creation with ephemeral relayer | HIGH | src/index.ts:1386-1393, src/index.ts:284-298 | — |
| 5 | Network detected from wrong account ID format | MEDIUM | src/profile.ts:6-8, src/index.ts:546-552 | client |
| 6 | Forgetting parentKey when parent account differs from relayer | MEDIUM | src/index.ts:1395-1400, src/index.ts:1419-1421 | — |

### relay (4 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|--------------|
| 1 | Not funding the ephemeral relayer account | CRITICAL | src/index.ts:179-181, maintainer interview | — |
| 2 | Omitting whitelistedContracts in production | CRITICAL | src/index.ts:891-898, maintainer interview | — |
| 3 | Constructing transactions with wrong builder pattern | HIGH | src/client.ts:240-260, maintainer interview | client, tanstack |
| 4 | Missing BETTER_AUTH_SECRET for ephemeral key encryption | HIGH | src/utils.ts:21-41, src/index.ts:134 | — |

### client (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|--------------|
| 1 | Creating multiple siwnClient instances | CRITICAL | src/client.ts:64-72 | tanstack |
| 2 | Recipient mismatch between server and client | CRITICAL | src/client.ts:108, src/index.ts:225 | siwn, tanstack |
| 3 | Using near.client.send() without ensureConnected | HIGH | src/client.ts:249-253, src/client.ts:310-317 | tanstack |
| 4 | Constructing transactions with wrong builder pattern | HIGH | src/client.ts:240-260 | relay, tanstack |
| 5 | Using authClient.near.verify directly instead of signIn.near | MEDIUM | src/client.ts:402-437 | — |
| 6 | Not listening to wallet disconnect events | MEDIUM | src/client.ts:65-66, src/client.ts:102-108 | — |

### tanstack (5 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|--------------|
| 1 | Creating multiple siwnClient instances via factory | CRITICAL | src/client.ts:64-72 | client |
| 2 | Threading runtimeConfig through query options and component props | HIGH | auth.ts:54-67 | — |
| 3 | Using near.client.send() without ensureConnected | HIGH | src/client.ts:249-253 | client |
| 4 | Module-level singleton in SSR causes cross-request state leaks | MEDIUM | router.server.tsx:60-71 | — |
| 5 | Calling createAuthClient() without runtimeConfig on the server | MEDIUM | auth.ts:18-27 | — |

### auth-plugin (6 failure modes)

| # | Mistake | Priority | Source | Cross-skill? |
|---|---------|----------|--------|--------------|
| 1 | SIWN recipient mismatch between bos.config.json and server | CRITICAL | bos.config.json, auth-instance.ts | siwn, client |
| 2 | Not forwarding headers in SSR auth client | CRITICAL | ui/src/router.server.tsx | tanstack |
| 3 | Using apiClient.auth.* instead of authClient for auth actions | HIGH | ui/src/lib/api.ts, ui/src/lib/auth.ts | — |
| 4 | Forgetting inferAdditionalFields\<Auth\>() | HIGH | ui/src/lib/auth.ts | — |
| 5 | Not refreshing session cache after sign-in/sign-out | HIGH | ui/src/routes/_layout/login.tsx | tanstack |
| 6 | Missing credentials: "include" in auth client | MEDIUM | ui/src/lib/auth.ts | tanstack |

## Tensions

| Tension | Skills | Agent implication |
| ------- | ------ | ----------------- |
| Ephemeral simplicity vs production reliability | relay | Agents may default to ephemeral without warning about funding requirements |
| Whitelist security vs development flexibility | relay | Agents may copy quickstart without whitelistedContracts into production |
| Type safety with better-auth peer dependency | siwn ↔ client | Agents may write code that compiles but fails at runtime due to config mismatch |
| Singleton vs factory pattern | client ↔ tanstack | Agents may create factories that produce multiple instances, losing wallet state |
| Module singleton vs router context | tanstack | Agents may use module-level singleton in SSR apps, causing cross-request leaks |
| oRPC vs Better Auth client for auth actions | auth-plugin | Agents may call auth endpoints via the oRPC API client instead of the Better Auth client, missing cookie/CSRF handling |
| Runtime config vs build-time config for SIWN recipient | auth-plugin ↔ siwn | Agents may hardcode the recipient in the UI instead of reading from runtimeConfig, causing mismatch when deploying to different networks |

## Cross-References

| From | To | Reason |
| ---- | -- | ------ |
| siwn | client | Client sign-in calls server nonce/verify; understanding both prevents mismatch |
| relay | client | Client builds delegate actions submitted to relay; server validation logic prevents rejections |
| client | siwn | Client recipient must match server recipient; loading server skill ensures consistency |
| client | tanstack | Client skill documents siwnClient singleton requirement; tanstack skill implements it |
| tanstack | client | TanStack skill references ensureConnected, SSR behavior, and wallet state patterns from client skill |
| tanstack | siwn | TanStack skill depends on server-side SIWN plugin options (recipient, key validation) for correct router context setup |
| siwn | tanstack | SIWN server plugin config affects TanStack client setup (recipient, networkId); understanding both prevents SSR misconfiguration |
| auth-plugin | siwn | Auth plugin wraps the SIWN server plugin; understanding siwn options prevents recipient/config mismatch |
| auth-plugin | client | Auth plugin UI uses siwnClient and authClient.near.* actions; client skill documents the API |
| auth-plugin | tanstack | Auth plugin UI uses router context singleton and session query patterns; tanstack skill documents the pattern |
| siwn | auth-plugin | SIWN server config must match bos.config.json variables; understanding the plugin wrapper prevents mismatch |
| client | auth-plugin | Client siwnClient recipient must match runtimeConfig variables; understanding the plugin consumer flow ensures consistency |

## Subsystems & Reference Candidates

| Skill | Subsystems | Reference candidates |
| ----- | ---------- | -------------------- |
| siwn | — | — |
| relay | Ephemeral mode, Explicit mode (single key), Explicit mode (rotating keys) | — |
| client | Lazy wallet init (SSR guard), Wallet state atoms, Session restore | — |
| tanstack | Auth file consolidation, Router context wiring, SSR router setup | auth.everything.dev/ui/src/auth.ts |
| auth-plugin | bos.config.json registration, UI auth client, In-process composition, Auth context resolution | auth.everything.dev/ui/src/lib/auth.ts, auth.everything.dev/api/src/lib/auth.ts |

## Recommended Skill File Structure

- **Core skills:** siwn, relay, client (all framework-agnostic)
- **Framework skills:** tanstack (TanStack Router integration pattern)
- **Composition skills:** auth-plugin (everything.dev plugin consumption)
- **Lifecycle skills:** None — covered within individual skills
- **Reference files:** auth.ts (tanstack) — canonical integration file, auth.ts + auth.ts (auth-plugin) — consumer-side auth client and middleware

## Composition Opportunities

| Library | Integration points | Composition skill needed? |
| ------- | ------------------ | ------------------------ |
| better-auth | Peer dependency; plugin registration, DB adapter | No — covered within each skill |
| near-kit | Internal dependency; TransactionBuilder, Near, verify | No — usage patterns shown inline |
| @hot-labs/near-connect | Internal dependency; wallet connector | No — handled by client skill |
| TanStack Router | Auth client in router context, SSR, hooks | Yes — tanstack skill |
| everything-dev / every-plugin | Plugin registration, oRPC composition, Module Federation | Yes — auth-plugin skill |
