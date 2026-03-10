# better-near-auth

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
