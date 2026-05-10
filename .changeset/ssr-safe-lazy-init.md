---
"better-near-auth": minor
---

SSR-safe lazy init, router context singleton, and improved wallet state management

**Library (`src/client.ts`):**
- siwnClient defers all browser APIs (wallet selector, event listeners) to `initClient()` guarded by `typeof window` — `createAuthClient()` is now safe to call on the server
- `near.client` is a getter that throws on server; `requireConnector()`/`requireNear()` guards on all wallet-dependent methods
- `walletConnected` atom tracks connection separately from `nearState`; `nearState` preserves `accountId` on disconnect (clears `publicKey` only) so `getAccountId()` still works for display
- `ensureWalletConnected()` / `authClient.near.ensureConnected()` — lazy reconnect before signing ops; `buildSignedDelegateAction` calls it automatically
- `restoreFromSession()` populates `nearState` from server session on client init
- Better error messages: "Wallet sign-in was cancelled or failed", "No NEAR account found", "Wallet connection required"
- `near as NearType` → getter that throws; `catch {}` → logged error; `session: any` → `SessionData | null | undefined`

**Example app (`auth.everything.dev`):**
- Consolidated `ui/src/auth.ts` — merged auth-client.ts, session.ts, auth-hooks.ts; `createAuthClient()`, `useAuthClient()`, `sessionQueryOptions(authClient, session?)`, `useRelayHistory(session, authClient)`
- Types inferred via `AuthClient["$Infer"]["Organization"]` / `AuthClient["$Infer"]["Passkey"]` — single source of truth, no manual interfaces
- `authClient` added to `RouterContext`; created once in `hydrate.tsx` (client) and `router.server.tsx` (per SSR request); passed through `router.tsx`
- All call sites updated: `getAuthClient(runtimeConfig)` → `useAuthClient()` / `context.authClient`; removed `runtimeConfig` props from UserNav, OrgSwitcher, RelayFeed, NearProfile
- Deleted `lib/auth-client.ts`, `lib/session.ts`, `lib/auth-hooks.ts`
- Relay polling now fails after 10 consecutive errors instead of looping forever on `catch {}`
- `relay-feed.tsx` uses shared `sessionQueryOptions` instead of raw duplicate query
- `useRelayHistory` no longer `console.error`s on behalf of callers
- Tests use pglite `:memory:` instead of file-backed DB

**Demo (`browser-2-server`):**
- `dashboard.tsx` adds `await authClient.near.ensureConnected()` before `.send()` in direct mode
