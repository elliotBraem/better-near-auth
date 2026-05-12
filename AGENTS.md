# better-near-auth — Agent Guide

## Commands
```
pnpm build          # tsc → dist/index.js + dist/client.js (ESM)
pnpm typecheck      # tsc --noEmit (same as lint)
pnpm test           # vitest (mocked, no chain needed)
pnpm lint           # alias for typecheck
pnpm changeset      # add changeset for release
pnpm release        # build + changeset publish
```
**Order**: `pnpm build` (if src changed) → `pnpm typecheck` → `pnpm test`

## Key facts
- Single npm package (`better-near-auth`), pnpm workspace only for examples
- Server plugin: `import { siwn } from "better-near-auth"` (src/index.ts)
- Client plugin: `import { siwnClient } from "better-near-auth/client"` (src/client.ts)
- Exports conform to Better Auth plugin convention (default + `/client` subpath)
- Tests in `src/near.test.ts` — excluded from tsconfig, not typechecked. Must run separately via `pnpm test`
- Lockfile: `pnpm-lock.yaml` (maintain with `pnpm install --frozen-lockfile` in CI)
- Requires Node >=24, pnpm 10.30.3
- Packages are ESM with `"type": "module"`, imports use `.js` extensions (`verbatimModuleSyntax`)
- No formatter (no prettier/eslint) — only tsc for quality

## Source layout
```
src/index.ts    — SIWN plugin (endpoints: nonce, verify, relay, profile, link, view, etc.)
src/client.ts   — SIWN client plugin (near wallet connect, sign, delegate actions)
src/types.ts    — Zod schemas + TS types (AccountId, nonce/verify/relay request types)
src/schema.ts   — DB schema (3 models: nearAccount, relayedTransaction, relayerKey)
src/profile.ts  — Profile lookup (FastNear KV → NEAR Social fallback)
src/utils.ts    — AES-256-GCM encrypt/decrypt for relayer key, hex/base64 helpers
src/near.test.ts — Vitest tests (mocked near-kit, no chain needed)
```

## DB models (Better Auth plugin schema)
- **nearAccount**: maps NEAR account to user (accountId, network, publicKey, isPrimary)
- **relayedTransaction**: tracks on-chain tx (txHash, senderId, receiverId, status)
- **relayerKey**: singleton per network — encrypted ED25519 private key (AES-256-GCM)

## Architecture
- Uses `near-kit` for NEAR RPC/tx/wallet and `@hot-labs/near-connect` for browser wallet
- Auth flow: wallet signs NEP-413 message → server verifies via `verifyNep413Signature` → session created
- Relayer: wraps user's signed delegate action in a tx signed by relayer key → broadcasts on-chain
- Two relayer modes: **ephemeral** (auto-generated key, encrypted in DB) and **explicit** (configured accountId + privateKey)
- Relayer key encryption: HKDF-SHA256 from `BETTER_AUTH_SECRET` + AES-256-GCM
- Profile: FastNear KV → `api.near.social` fallback
- Network detection: accounts ending `.testnet` → testnet, everything else → mainnet
- Email: `.near` accounts get `localpart@near.email`, non-`.near` accounts get no email
- Client state management via `nanostores` (not React state)
- SDK endpoints all under `/near/*` prefix
- `near.listAccounts()` returns `{ accounts, activeAccount, availableAccounts }`; active means `isPrimary`, available means selectable non-active NEAR accounts
- `near.setPrimaryAccount({ accountId, network? })` updates `isPrimary` and should be used when switching the active NEAR account

## Release (changesets)
- `pnpm changeset` → select `better-near-auth`, bump type, write summary
- CI on main merges creates "Version Packages" PR automatically
- `pnpm release` publishes to npm (CI only; requires NPM_TOKEN)

## Style conventions
- No code comments
- Use `satisfies BetterAuthPlugin` / `satisfies BetterAuthClientPlugin`
- All imports use `.js` extensions (ESM)
- Zod schemas defined in types.ts, re-exported via `export * from "./types.js"`

## Test conventions
- Uses `getTestInstance` from `better-auth/test` — in-memory DB, full Better Auth server
- `disableTestUser: true` for tests that create users via SIWN flow
- near-kit is fully mocked — no real RPC or wallet needed
- Nonce endpoints validated against `AccountIdSchema` from `near-kit/schemas`
- For protected SIWN endpoints after `/near/verify`, use `customFetchImpl` with the returned session cookie when the generated test client does not preserve auth state

## CI workflows (`.github/workflows/`)
- `release.yml` — changesets auto-release on main
- `deploy-example.yml` — deploys `auth.everything.dev` example
- `check-skills.yml` — validates TanStack intent skills artifacts
- `update-example-version.yml` — updates `browser-2-server` example on release
