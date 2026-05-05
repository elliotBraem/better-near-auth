---
"better-near-auth": minor
---

Add relay history endpoint and improve relayer reliability

- Added `/near/relay-history` endpoint for fetching user's relayed transaction history
- Added `authClient.near.relayHistory()` client action
- Updated relay transaction to wait until `EXECUTED` before returning
- Updated `near-kit` dependency from local path to published `^0.14.0`
- Updated `zod` to `^4.4.3`
- Refactored example app: removed authenticated layout guard, simplified dashboard route
- Added `relay-feed` component and `auth-hooks` for cleaner data fetching patterns
- Switched `NearProfile` to use `@tanstack/react-query` instead of manual `useEffect`
