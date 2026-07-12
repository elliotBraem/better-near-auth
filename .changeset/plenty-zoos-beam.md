---
"better-near-auth": minor
---

feat: pre-flight sub-account availability check

- **Auth required**: `checkSubAccountAvailability` now requires an authenticated session with a linked NEAR wallet
- **NEAR-valid regex**: Added `SUB_ACCOUNT_LABEL_REGEX` (`^([a-z\d]+[-_])*[a-z\d]+$`) matching NEAR account label rules — allows hyphens and underscores, rejects leading/trailing separators
- **Length validation**: Sub-account names enforce min 2, max 64 characters; composed `accountId` length checked against 64-char limit
- **Enriched response**: Returns `parentAccount` and `reason` field (`"taken" | "invalid" | "too-long" | "not-configured"`) so clients can show specific feedback
- **Relayer decoupled**: Availability check reads `parentAccount` from config directly — no longer requires a relayer to be initialized, works as long as `subAccount.parentAccount` is configured
- **Client-side guard**: `auth.near.checkSubAccountAvailability` short-circuits with `reason: "invalid"` for obviously invalid input before making the server call
- **Bug fix**: Example app oRPC contract fixed field name from `subAccountId` to `subAccountName`; added auth middleware and header forwarding to `nearCheckSubAccountAvailability` handler
