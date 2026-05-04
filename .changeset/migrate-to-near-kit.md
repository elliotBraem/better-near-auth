---
"better-near-auth": major
---

Migrate from @fastnear/wallet to near-kit with full type safety

- **Breaking**: Removed `requestSignIn.near()` — consolidated into `signIn.near()` with single-popup flow
- **Breaking**: Renamed `fastnearApiKey` → `apiKey` in server config
- **Breaking**: Renamed `authClient.near.near` → `authClient.near.client` for near-kit access
- **Breaking**: Changed `relayTransaction({ signedDelegateAction })` → `relayTransaction({ payload })`
- **Breaking**: Changed `NearActionInput` gas/deposit from `string` to `GasInput`/`AmountInput` from near-kit
- **Breaking**: Removed `anonymous` and `emailDomainName` options
- **Breaking**: Removed `validateNonce`, `validateRecipient`, `validateMessage` options (dead code)
- **Breaking**: Removed `apiKey` from client config (unused)
- **Breaking**: `RelayerInfo` now extends near-kit's `AccountState`
- Added `/near/view` endpoint for server-side contract view calls
- Added `authClient.near.view()` client action
- Added `deriveEmail()` for automatic near.email derivation on .near accounts
- Added `accountExists` check during nonce generation
- Added `defaultValidateLimitedAccessKey()` for FAK validation
- Added `RotatingKeyStore` / `InMemoryKeyStore` for relayer key management
- Single-popup sign-in and link flows via `signWithWallet()` helper
- Zero `as any` type casts — full type safety via near-kit/near-connect imports
