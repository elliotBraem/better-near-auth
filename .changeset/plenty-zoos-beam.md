---
"better-near-auth": minor
---

feat: sub-account creation v2 — configurable keys, deploy/init, hooks, rollback

- **`parentHasFullAccess`**: Adds the parent's key as a full access key on the subaccount. Recommended default for recovery/rollback.
- **`deploy` / `init`**: Deploy a contract to the new subaccount (raw wasm, global contract by publisher account, or immutable hash). Optionally call `init` with static or dynamic args (function receiving `SubAccountTxCtx`).
- **`extendTx` hook**: Compose arbitrary NEAR Kit TransactionBuilder actions into the creation transaction. All actions are atomic with the createAccount.
- **`onCreated` / `onRollback` lifecycle**: Post-creation callback for side effects (DB writes, notifications). If `onCreated` throws, the plugin automatically deletes internal DB records, calls `onRollback` (consumer cleanup), and issues a `deleteAccount` on-chain transaction — full rollback.
- **`secrets.parentKey`**: `parentKey` moved from `SubAccountConfig` to `secrets` object on `SIWNPluginOptions` for security (kept out of config). Supports per-network config.
- **Relayer decoupled**: Sub-account creation works without a relayer when `secrets.parentKey` and `subAccount.parentAccount` are configured. The server creates a standalone `Near` instance and signs with the parent key.
- **Remove `parentKey` from `SubAccountConfig`**: Breaking change — migrate to `secrets.parentKey`.
- **New `subaccount` skill**: Dedicated skill document covering recommended defaults, config reference, deploy/init patterns, extendTx, lifecycle hooks, standalone mode, and 6 common mistakes.
