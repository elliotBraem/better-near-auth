---
"@everything-dev/auth-plugin": patch
---

Refactored API `initialize` to use `DatabaseLive`/`DatabaseTag` Layer from `./db/layer` instead of manually calling `createDatabase` + `migrate` with `Effect.acquireRelease`. This fixes TypeScript errors caused by incorrect imports (non-existent `createDatabase` export and `"db/migrator"` module path) and delegates driver creation, migration, drift detection, and scoped cleanup to the existing `DatabaseLive` Layer.
