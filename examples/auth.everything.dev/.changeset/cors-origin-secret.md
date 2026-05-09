---
"@everything-dev/auth-plugin": minor
---

Add `CORS_ORIGIN` secret to configure trusted origins for the auth plugin. Accepts a comma-separated list of origins (supports `better-auth` wildcard patterns like `https://*.example.dev`). Origins without a protocol automatically get `https://` prepended (loopback addresses like `localhost` and `127.0.0.1` get `http://`). Invalid origins are skipped with a console warning. Renamed internal `corsOrigins` config to `trustedOrigins` to match `better-auth` naming.
