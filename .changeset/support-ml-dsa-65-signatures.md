---
"better-near-auth": patch
---

Fix ML-DSA-65 NEP-413 signed messages being rejected by the SIWN endpoints (`/api/auth/near/verify` and `/api/auth/near/link-account`). Wallets holding post-quantum `ml-dsa-65:` (FIPS 204) full-access keys can now complete Sign in with NEAR — previously they returned `401 Unauthorized: Invalid signature` because `near-kit`'s `verifyNep413Signature` is hardcoded to Ed25519.

Adds a sibling `verifyMlDsa65Nep413Signature` helper that handles the `ml-dsa-65:` key type via `@noble/post-quantum`, reusing the same NEP-413 SHA-256 + borsh payload format and the same timestamp-based maxAge check. The post-quantum branch hits the same `near.getAccessKey` defense-in-depth as the ed25519 path, so the key still has to be a real full-access key on the claimed account. Bumps `near-kit` to `^0.19.0` so `getAccessKey` understands the `ml-dsa-65:` and `ml-dsa-65-hash:` prefixes on the RPC side.
