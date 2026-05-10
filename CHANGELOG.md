# better-near-auth

## 1.4.2

### Patch Changes

- [`648b0b4`](https://github.com/elliotBraem/better-near-auth/commit/648b0b4d46a758cfc3afca14432970c8dd164b88) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Switch example deps to `catalog:` protocol and fix not-found handling

  - Changed `better-near-auth` spec in `ui/`, `plugins/auth/`, and root `dependencies` from pinned versions to `catalog:` so the root workspace catalog (`^1.4.1`) is the single source of truth
  - Added post-publish step to `release.yml` that bumps the catalog version automatically after each release
  - Fixed `$slug.tsx` loader: replaced silent `return` with `throw notFound()` so TanStack Router renders proper not-found UI
  - Removed stale `ui/node_modules/better-near-auth@1.1.0` that was shadowing the resolved `1.4.1`

## 1.4.1

### Patch Changes

- [`707e2d3`](https://github.com/elliotBraem/better-near-auth/commit/707e2d34dfcc49c4774199f8fb2bbc8e1ac731f5) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Fix TanStack Intent skill validation error by adding `requires` field to `tanstack` framework skill

  The `skills/tanstack/SKILL.md` was missing the required `requires` array for `type: framework` skills, which caused `npx @tanstack/intent@latest validate` to fail with:

  > Framework skills must have a "requires" field

  This prevented the package from being properly indexed on the TanStack Intent Agent Skills Registry. Added:

  ```yaml
  requires:
    - client
    - siwn
  ```

  These dependencies are correct because the TanStack Router integration builds directly on the client-side `siwnClient` plugin (client skill) and the server-side SIWN authentication (siwn skill) must be configured for any of the auth flows to work.

## 1.4.0

### Minor Changes

- [`ca4ddb2`](https://github.com/elliotBraem/better-near-auth/commit/ca4ddb2168aecb6640068048ebd1706c2a8f091b) Thanks [@elliotBraem](https://github.com/elliotBraem)! - SSR-safe lazy init, router context singleton, and improved wallet state management

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

## 1.3.0

### Minor Changes

- [`b8a2104`](https://github.com/elliotBraem/better-near-auth/commit/b8a2104c98705a0befbe25941e04e03769ed4e26) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Make auth-export types self-contained for remote consumption

  Rewrite `auth-export.ts` to eliminate all relative imports to local files — types now reference only npm packages (`better-auth`, `drizzle-orm/pg-core`). This ensures the emitted `auth-export.d.ts` works as a standalone file fetched from a deployed plugin manifest, with no broken relative references to missing transitive `.d.ts` files.

  - `AuthConfig` moved to `auth-export.ts` as source of truth; `auth-instance.ts` imports from it
  - `AuthDatabase` expressed as `PgDatabase<PgQueryResultHKT, Record<string, unknown>>` from `drizzle-orm/pg-core`
  - `createAuthInstance` expressed as a type alias `(config: AuthConfig, db: AuthDatabase) => Auth`
  - `ContractType` removed from `auth-export.ts` (already emitted via `contract.d.ts`)
  - `tsconfig.contract.json` now includes `src/auth-export.ts` so `build:types` generates both `.d.ts` files
  - `rspack.config.js` `exportNames` updated with all exports from `auth-export.ts`
  - `index.ts` uses a precise local `PluginAuthServices` type for `satisfies` while still re-exporting generic `AuthServices`
  - `CORS_ORIGIN` added to auth secrets in `bos.config.json`

## 1.2.1

### Patch Changes

- [`dda59e4`](https://github.com/elliotBraem/better-near-auth/commit/dda59e40d79bfb20df025d906da813f596f5a688) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Remove process.env fallbacks in initRelayer, add rpcUrl to SIWNPluginOptions, and keep explicit BetterAuthPlugin return type to avoid TS2742 build errors in downstream consumers.

## 1.2.0

### Minor Changes

- [#20](https://github.com/elliotBraem/better-near-auth/pull/20) [`99392f0`](https://github.com/elliotBraem/better-near-auth/commit/99392f01ab0880d3c2f2dbb4826049e9918e1454) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add TanStack Intent agent skills for SIWN authentication, gasless relay, and client integration. Skills ship inside the npm package and are auto-discovered by `@tanstack/intent` consumers. Includes CI workflow for skill validation and staleness checks.

### Patch Changes

- [#21](https://github.com/elliotBraem/better-near-auth/pull/21) [`ef7af0e`](https://github.com/elliotBraem/better-near-auth/commit/ef7af0e5b6f8d31bd71ca5eb2e9c94327f78f35a) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Fix Drizzle adapter error when creating ephemeral relayer key

  - Removed explicit `id` field from `relayerKey` creation in `initRelayer()` to resolve the Drizzle Adapter warning/error: "You are trying to create a record with an id. This is not allowed as we handle id generation for you."
  - Updated `relayNearTransaction` to query `relayerKey` by `network` instead of the removed hardcoded `id`.

## 1.1.0

### Minor Changes

- [`0233610`](https://github.com/elliotBraem/better-near-auth/commit/0233610c563c8f822d73961fbf47bd4181a291b4) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add `rpcUrl` option for custom NEAR RPC endpoints and fix documentation

  - Added `rpcUrl` option to `SIWNPluginOptions` for specifying custom NEAR RPC endpoints
    - Enables use with private nodes, NEAR sandbox, and alternative RPC providers
    - Wires through all `Near` instance creation points via new `createNear()` helper
  - Fixed `buildSignedDelegateAction` documentation to match actual API signature
  - Removed non-existent options from docs: `validateNonce`, `validateRecipient`, `validateMessage`
  - Corrected default values in documentation (`expiresIn` 15m not 5m, `requireNewNonce` true not false)
  - Added missing API documentation for `nearListAccounts`, `nearProfile`, `nearLinkAccount`, `nearUnlinkAccount`, `nearRelay`, `nearRelayHistory`, `nearView`, and `nearRelayerInfo`
  - Fixed `nearRelayStatus` error code in docs from `500` to `200`

## 1.0.0

### Major Changes

- [#17](https://github.com/elliotBraem/better-near-auth/pull/17) [`1127f48`](https://github.com/elliotBraem/better-near-auth/commit/1127f4880c1acc24c4efb23d121d7593d4904c55) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Migrate from @fastnear/wallet to near-kit with full type safety

  - **Breaking**: Removed `requestSignIn.near()` — consolidated into `signIn.near()` with single-popup flow
  - **Breaking**: Renamed `fastnearApiKey` → `apiKey` in server config
  - **Breaking**: Renamed `authClient.near.near` → `authClient.near.client` for near-kit access
  - **Breaking**: Changed `relayTransaction({ signedDelegateAction })` → `relayTransaction({ payload })`
  - **Breaking**: Changed `NearActionInput` gas/deposit from `string` to `GasInput`/`AmountInput` from near-kit
  - **Breaking**: Removed `anonymous` and `emailDomainName` options
  - **Breaking**: Removed `validateNonce`, `validateRecipient`, `validateMessage` options (dead code)
  - **Breaking**: Removed `apiKey` from client config (unused)
  - **Breaking**: `RelayerInfo` now extends near-kit's `AccountState`
  - Added `/near/view` endpoint for server-side contract view calls
  - Added `authClient.near.view()` client action
  - Added `deriveEmail()` for automatic near.email derivation on .near accounts
  - Added `accountExists` check during nonce generation
  - Added `defaultValidateLimitedAccessKey()` for FAK validation
  - Added `RotatingKeyStore` / `InMemoryKeyStore` for relayer key management
  - Single-popup sign-in and link flows via `signWithWallet()` helper
  - Zero `as any` type casts — full type safety via near-kit/near-connect imports

### Minor Changes

- [#17](https://github.com/elliotBraem/better-near-auth/pull/17) [`1127f48`](https://github.com/elliotBraem/better-near-auth/commit/1127f4880c1acc24c4efb23d121d7593d4904c55) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add relay history endpoint and improve relayer reliability

  - Added `/near/relay-history` endpoint for fetching user's relayed transaction history
  - Added `authClient.near.relayHistory()` client action
  - Updated relay transaction to wait until `EXECUTED` before returning
  - Updated `near-kit` dependency from local path to published `^0.14.0`
  - Updated `zod` to `^4.4.3`
  - Refactored example app: removed authenticated layout guard, simplified dashboard route
  - Added `relay-feed` component and `auth-hooks` for cleaner data fetching patterns
  - Switched `NearProfile` to use `@tanstack/react-query` instead of manual `useEffect`

### Patch Changes

- [#17](https://github.com/elliotBraem/better-near-auth/pull/17) [`1127f48`](https://github.com/elliotBraem/better-near-auth/commit/1127f4880c1acc24c4efb23d121d7593d4904c55) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Fix base58/base64 encoding bugs and wallet connection issues

  - Fix relayer key recovery: `parseKey` now uses `base58.encode` instead of `bytesToBase64`, and private key extraction uses `base58.decode` instead of `hexToBytes` — both were producing corrupted keys that crashed on server restart with "Unknown letter: +" base58 errors
  - Fix nonce endpoint encoding: `/near/nonce` now returns hex-encoded nonces matching the verify endpoint's `hex.decode`
  - Fix "No wallet selected" error: `connector.getConnectedWallet()` now caught gracefully so the `connector.connect()` wallet picker path is reached
  - Fix "Not authenticated" after page refresh: `nearState` atom now auto-restores from persisted wallet connection on init
  - Fix unfunded relayer crash: `/near/relayer-info` returns zero-balance defaults instead of throwing `AccountDoesNotExistError`
  - Add `getRelayerInfo()` client action for relayer balance/account monitoring
  - Fix example guestbook `buildSignedDelegateAction` call signature

## 0.6.0

### Minor Changes

- [`2ec6e28`](https://github.com/elliotBraem/better-near-auth/commit/2ec6e28878fd3e542df1721ee32f4a3eb31d3d46) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add gasless relay (NEP-366), replace @hot-labs/near-connect with @fastnear/wallet, and add `authClient.near.wallet` passthrough

  - **Gasless relay**: Server relays signed delegate actions on-chain, paying gas from an auto-generated ephemeral keypair (encrypted in DB). New endpoints: `/near/relay`, `/near/relay-status/:txHash`, `/near/relayer-info`. New client methods: `buildSignedDelegateAction`, `relayTransaction`, `getRelayStatus`.
  - **Wallet passthrough**: `authClient.near.wallet` exposes the full `@fastnear/wallet` API (connect, sendTransaction, signMessage, etc.) without wrapping each method.
  - **Dependency swap**: `@hot-labs/near-connect` → `@fastnear/wallet`, `near-kit` → `@fastnear/api` + `@noble/curves` + `borsh`.
  - **BigInt fix**: Delegate action gas/deposit now passed as strings to avoid `JSON.stringify` BigInt error.
  - **Profile**: FastNear KV primary, NEAR Social fallback.
  - **`requireFullAccessKey`** default changed from `true` to `false`.
  - **Guestbook example**: Toggle between gasless relay and direct wallet send.

### Patch Changes

- [`e86e184`](https://github.com/elliotBraem/better-near-auth/commit/e86e18424378785228cc6d99019e32bfe9ea1387) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add better-auth 1.6.x compatibility, rewrite test suite, vendor @fastnear packages

  - **Schema fix**: Remove duplicate `id` field from `relayerKey` table (better-auth 1.6+ auto-adds `id` to all plugin tables, causing migration errors)
  - **Client plugin**: Update `getActions` signature to `($fetch, $store, options)` matching better-auth 1.6.9's `BetterAuthClientPlugin` type
  - **Dependencies**: Update `better-auth` devDependency to `^1.6.9` (peerDependency remains `^1.5.4` which already covers 1.6.x by semver), update `drizzle-orm` in example to `^0.45.2`
  - **Vendor @fastnear packages**: Replace `file:../js-monorepo/...` dependencies with vendored workspace packages under `vendor/`, keeping `signMessageParams` and `signedMessage` features from the unreleased wallet API
  - **Tests**: Rewrite full test suite (32 tests) covering nonce, verify, nonce replay detection, anonymous mode, account ID validation, link account, profile, and relayer endpoints

## 0.5.2

### Patch Changes

- Fix race condition in `signIn.near()` two-step flow where `connectionPromise` was created after `connector.connect()`, causing the promise to never resolve for wallets without `signInAndSignMessage` support (HOT Wallet, Ledger, WalletConnect).

  Fix silent no-op in `handleSignInAndSignMessage` when wallet returns accounts without `signedMessage` — now calls `onError` callback instead of hanging indefinitely.

## 0.5.1

### Patch Changes

- [`c9a2b95`](https://github.com/elliotBraem/better-near-auth/commit/c9a2b95f2b6e1fd4eacc2ba9a684b494c2994ce6) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Fix wallet selection bug in signIn.near() method

  - Fixed "No accounts found" error when calling signIn.near() without prior wallet connection
  - Now properly shows wallet selector and determines authentication flow based on selected wallet's capabilities
  - Fixed feature detection to check `signInAndSignMessage` instead of `signMessage` for single-step flow
  - Automatically uses single-step flow for wallets with signInAndSignMessage support
  - Automatically falls back to two-step flow for wallets without signInAndSignMessage support
  - Improved user experience by letting users select any wallet first
  - HOT wallet now correctly falls back to two-step flow (has signMessage but not signInAndSignMessage)

## 0.5.0

### Minor Changes

- [#11](https://github.com/elliotBraem/better-near-auth/pull/11) [`437bf40`](https://github.com/elliotBraem/better-near-auth/commit/437bf4096d92ebb161abcd4cd5806d78fc20974c) Thanks [@elliotBraem](https://github.com/elliotBraem)! - Add single-step authentication flow, migrate to pnpm, and improve security

  - Add single-step authentication flow for wallets with signMessage support
  - Migrate from bun to pnpm package manager
  - Update dependencies: near-connect 0.11.0, near-kit 0.12.0, better-auth 1.5.4
  - Simplify API: rename `domain` to `recipient`, remove redundant params
  - Add replay attack protection with nonce hashing
  - Improve link account endpoint with better validation
  - Update documentation with new authentication flows
