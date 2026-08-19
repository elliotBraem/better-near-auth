---
"better-near-auth": patch
---

fix: secure relayer config validation, eager boot init, and clear error reporting

- **Reject hybrid relayer configs at startup.** Passing `siwn({ relayer: { mainnet: {}, testnet: {}, whitelistedContracts: [...], maxGasPerTransaction, maxDepositPerTransaction } })` previously activated the dual-network branch and silently discarded the top-level security fields — the relayer then ran with no contract whitelist, no gas cap, and no deposit cap. `siwn()` now parses `relayer` with Zod and throws a `BetterAuthError` if it mixes per-network (`mainnet`/`testnet`) keys with top-level security fields, contains unknown keys, or has the wrong types (e.g. `maxGasPerTransaction` not a non-negative integer string).
- **Export relayer schemas.** `relayerConfigSchema` and `relayerDualNetworkConfigSchema` are now exported so consumers can validate configurations at build time.
- **Eager relayer init at boot.** Docs and tooling described the relayer keypair as generated "on first startup", but the keypair was only created the first time a `/near/...` endpoint was hit. The plugin now uses the better-auth `init` hook to fire-and-forget `ensureRelayer` for every configured network during boot (deferred via `setImmediate` so it runs after schema migrations and is visible in operator logs without any API call). For each initialized network it logs `[siwn] Relayer initialized: <accountId> (<network>, <mode>)`. Init failures are logged at error level.
- **Distinguish "not configured" from a runtime relayer failure.** `getRelayerInfo` now wraps `ensureRelayer` in a try/catch and returns `{ enabled: false, error: <message>, subAccountAvailable: false }` when initialization throws at runtime — distinguishable from `{ enabled: false }` (no config) by the presence of `error`. The dashboard renders a distinct "Relayer Error" card with the message instead of the misleading "Not Configured" message.

**Upgrade notes**

- `ephemeral?: true` is now rejected at runtime (it was already removed from the type but previously accepted silently). Remove it from any relayer config that still passes it.
