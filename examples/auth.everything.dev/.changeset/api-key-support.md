---
"@everything-dev/auth-plugin": minor
---

Full support for Better Auth API keys. The contract now uses `expiresIn` (seconds) for create/update — the previous `expiresAt` was silently dropped by Better Auth. Adds `enabled`, `rateLimit`, `remaining`, and `lastRequest` to the returned key, exposes pagination + sorting on list, and adds a `verifyApiKey` endpoint. The example UI gains expiration presets, optional rate limiting, key verification, and enable/disable toggles in both personal settings and organization management.
