---
"better-near-auth": patch
---

fix: NEP-413 key policy now governs both ed25519 and ml-dsa-65 signatures

The SIWN endpoints (`/api/auth/near/verify` and `/api/auth/near/link-account`) delegated the on-chain access-key check to `near-kit`'s `verifyNep413Signature`, which hard-requires a FullAccess key before the plugin's own `requireFullAccessKey` / `validateLimitedAccessKey` policy ever runs. That made the documented default (`requireFullAccessKey: false` — full-access key or function-call key scoped to the recipient) unreachable: function-call keys were rejected with `401 Invalid signature`, and custom validators could restrict but never enable limited keys.

Signature verification and key policy are now separated. Both endpoints verify the NEP-413 signature (ed25519 via near-kit, ml-dsa-65 via `@noble/post-quantum`) and then enforce the plugin's key policy uniformly: the signing key must exist on the claimed account (the defense-in-depth `getAccessKey` check is preserved, now once per request in the policy step instead of inside each signature verifier), and then `requireFullAccessKey` / `validateLimitedAccessKey` decide which key permissions are accepted. Function-call access keys scoped to the recipient are accepted by default, matching the documented behavior, and the ml-dsa-65 path now honors the same policy as ed25519. Also dedupes the identical verify/link-account signature-dispatch and key-policy blocks into shared helpers.
