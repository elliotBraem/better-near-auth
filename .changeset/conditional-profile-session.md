---
"better-near-auth": patch
---

The `getSiwnProfile` endpoint no longer requires `sessionMiddleware` when an explicit `accountId` is provided in the request body. Uses `getSessionFromCtx` internally to conditionally resolve the session only when needed. This allows public profile lookups by account ID without requiring authentication.
