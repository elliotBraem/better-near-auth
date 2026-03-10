# better-near-auth

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
