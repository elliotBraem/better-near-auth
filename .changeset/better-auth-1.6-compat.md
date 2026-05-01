---
"better-near-auth": patch
---

Add better-auth 1.6.x compatibility, rewrite test suite, vendor @fastnear packages

- **Schema fix**: Remove duplicate `id` field from `relayerKey` table (better-auth 1.6+ auto-adds `id` to all plugin tables, causing migration errors)
- **Client plugin**: Update `getActions` signature to `($fetch, $store, options)` matching better-auth 1.6.9's `BetterAuthClientPlugin` type
- **Dependencies**: Update `better-auth` devDependency to `^1.6.9` (peerDependency remains `^1.5.4` which already covers 1.6.x by semver), update `drizzle-orm` in example to `^0.45.2`
- **Vendor @fastnear packages**: Replace `file:../js-monorepo/...` dependencies with vendored workspace packages under `vendor/`, keeping `signMessageParams` and `signedMessage` features from the unreleased wallet API
- **Tests**: Rewrite full test suite (32 tests) covering nonce, verify, nonce replay detection, anonymous mode, account ID validation, link account, profile, and relayer endpoints
