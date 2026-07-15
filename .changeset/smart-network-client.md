---
"better-near-auth": patch
---

Client methods `createSubAccount`, `getRelayerInfo`, and `checkSubAccountAvailability` now auto-populate `network` from the client's internal `activeNetwork` store when not explicitly provided. When `setNetwork("testnet")` is called via the UI toggle, all subsequent API calls automatically use the correct network.

Server-side error message for 503 "sub-account creation unavailable" now reports which network failed and whether the root cause is a missing `parentAccount` or `parentKey`, rather than generically suggesting to configure `subAccount.parentAccount`.
