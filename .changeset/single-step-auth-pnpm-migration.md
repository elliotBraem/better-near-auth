---
"better-near-auth": minor
---

Add single-step authentication flow, migrate to pnpm, and improve security

- Add single-step authentication flow for wallets with signMessage support
- Migrate from bun to pnpm package manager
- Update dependencies: near-connect 0.11.0, near-kit 0.12.0, better-auth 1.5.4
- Simplify API: rename `domain` to `recipient`, remove redundant params
- Add replay attack protection with nonce hashing
- Improve link account endpoint with better validation
- Update documentation with new authentication flows
