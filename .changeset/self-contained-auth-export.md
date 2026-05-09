---
"better-near-auth": minor
---

Make auth-export types self-contained for remote consumption

Rewrite `auth-export.ts` to eliminate all relative imports to local files — types now reference only npm packages (`better-auth`, `drizzle-orm/pg-core`). This ensures the emitted `auth-export.d.ts` works as a standalone file fetched from a deployed plugin manifest, with no broken relative references to missing transitive `.d.ts` files.

- `AuthConfig` moved to `auth-export.ts` as source of truth; `auth-instance.ts` imports from it
- `AuthDatabase` expressed as `PgDatabase<PgQueryResultHKT, Record<string, unknown>>` from `drizzle-orm/pg-core`
- `createAuthInstance` expressed as a type alias `(config: AuthConfig, db: AuthDatabase) => Auth`
- `ContractType` removed from `auth-export.ts` (already emitted via `contract.d.ts`)
- `tsconfig.contract.json` now includes `src/auth-export.ts` so `build:types` generates both `.d.ts` files
- `rspack.config.js` `exportNames` updated with all exports from `auth-export.ts`
- `index.ts` uses a precise local `PluginAuthServices` type for `satisfies` while still re-exporting generic `AuthServices`
- `CORS_ORIGIN` added to auth secrets in `bos.config.json`
