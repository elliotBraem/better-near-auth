---
"better-near-auth": patch
---

Fixed the release workflow to properly authenticate with npm and separate versioning from publishing. The workflow now uses `NODE_AUTH_TOKEN` with `registry-url` for npm auth, adds idempotent publish guards, and creates GitHub releases manually with changelog extraction.
