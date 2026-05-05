---
"better-near-auth": minor
---

Add `rpcUrl` option for custom NEAR RPC endpoints and fix documentation

- Added `rpcUrl` option to `SIWNPluginOptions` for specifying custom NEAR RPC endpoints
  - Enables use with private nodes, NEAR sandbox, and alternative RPC providers
  - Wires through all `Near` instance creation points via new `createNear()` helper
- Fixed `buildSignedDelegateAction` documentation to match actual API signature
- Removed non-existent options from docs: `validateNonce`, `validateRecipient`, `validateMessage`
- Corrected default values in documentation (`expiresIn` 15m not 5m, `requireNewNonce` true not false)
- Added missing API documentation for `nearListAccounts`, `nearProfile`, `nearLinkAccount`, `nearUnlinkAccount`, `nearRelay`, `nearRelayHistory`, `nearView`, and `nearRelayerInfo`
- Fixed `nearRelayStatus` error code in docs from `500` to `200`
