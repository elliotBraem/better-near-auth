# better-near-auth

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
