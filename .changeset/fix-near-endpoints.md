---
"better-near-auth": patch
---

Fix type inference for NEAR SIWN endpoints

- Added explicit type imports for `@better-auth/core/env`, `@better-auth/core/oauth2`, and `better-call` to resolve TS2742 declaration emit errors
- Removed `as const` from the `siwn` plugin return object to prevent readonly/mutable type mismatch in `BetterAuthClientPlugin` inference
- This enables `Auth["api"]` to properly infer all 14 NEAR endpoint types (getSiwnNonce, verifySiwnMessage, getSiwnProfile, linkNearAccount, etc.) instead of collapsing to `BetterAuthPlugin`
