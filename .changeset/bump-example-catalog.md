---
"better-near-auth": patch
---

Switch example deps to `catalog:` protocol and fix not-found handling

- Changed `better-near-auth` spec in `ui/`, `plugins/auth/`, and root `dependencies` from pinned versions to `catalog:` so the root workspace catalog (`^1.4.1`) is the single source of truth
- Added post-publish step to `release.yml` that bumps the catalog version automatically after each release
- Fixed `$slug.tsx` loader: replaced silent `return` with `throw notFound()` so TanStack Router renders proper not-found UI
- Removed stale `ui/node_modules/better-near-auth@1.1.0` that was shadowing the resolved `1.4.1`
