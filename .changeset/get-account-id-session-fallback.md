---
"better-near-auth": patch
---

fix: `getAccountId()` returns the primary SIWN-linked account before NearConnect initializes; `setPrimaryAccount()` now refreshes the session's `nearAccount`

`authClient.near.getAccountId()` previously returned `null` on a fresh page load after a SIWN sign-in until `restoreFromSession` populated the wallet atom — that path dynamically imports `@hot-labs/near-connect` and hits `/near/list-accounts`, which lags behind the better-auth session fetch. UI that read `getAccountId()` for display (dashboard identity, connected-wallet indicator, onramp destination) showed "Connect a NEAR wallet" despite the user being authenticated.

The server plugin already attaches the primary SIWN-linked account to the session response as `session.user.nearAccount` (via an `after` hook on `GET /auth/session` that selects `isPrimary === true` from the `nearAccount` table). `getAccountId()` now reads that field as a fallback, so it returns the user's identity as soon as the session resolves and before NearConnect is initialized. The live NearConnect connection still takes precedence when present, so `getState()`/`isWalletConnected()` callers can distinguish a live signing connection from a session-only identity exactly as before.

`setPrimaryAccount()` now also notifies `$sessionSignal` after a successful primary change so the session's `nearAccount` is re-fetched and reflects the new primary. Previously the field could stay stale until the next unrelated session fetch.

Downstream consumers that hand-rolled `getNearAccountId(linkedAccounts)` workarounds (splitting the `:network` suffix off the core `account` table row) can now rely on `getAccountId()` directly. `session.user.nearAccount` is also available for cases where the public API is too narrow — note that this field is populated by an `after` hook and is therefore not part of the inferred session user type; consumers that want strict typing can narrow it with a small cast (the example app exposes a `readNearAccountId(session)` helper for this).
