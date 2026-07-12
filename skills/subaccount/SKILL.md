---
name: subaccount
description: >
  Configure sub-account creation with parent ownership, contract deployment,
  init calls, composable transaction hooks, and lifecycle callbacks with
  automatic rollback. Load when setting up subAccount config, deploying
  contracts to new sub-accounts, or handling post-creation side effects.
metadata:
  type: core
  library: better-near-auth
  library_version: "1.6.5"
sources:
  - "elliotBraem/better-near-auth:src/index.ts"
  - "elliotBraem/better-near-auth:src/types.ts"
  - "elliotBraem/better-near-auth:src/near.test.ts"
  - "elliotBraem/better-near-auth:README.md"
  - "elliotBraem/better-near-auth:LLM.txt"
requires:
  - siwn
---

# Better-Near-Auth — Sub-Account Creation

Create named sub-accounts (e.g. `myapp.parent.near`) with configurable access keys, contract deployment, init calls, and composable transaction hooks. The server builds a single atomic NEAR transaction that either succeeds completely or reverts entirely.

For transaction building reference, see: [NEAR Kit — Action Reference](https://kit.near.tools/reference/actions.md) and [NEAR Kit — Advanced Transactions](https://kit.near.tools/in-depth/advanced-transactions.md)

## Setup

### Recommended default: parent owns it

The recommended configuration gives the parent account full access to the subaccount. This enables recovery, rollback, and admin operations.

```typescript
import { siwn } from "better-near-auth";

export const auth = betterAuth({
  plugins: [
    siwn({
      recipient: "myapp.near",
      relayer: {
        accountId: "myapp.near",
        privateKey: process.env.RELAYER_PRIVATE_KEY,
      },
      subAccount: {
        parentAccount: "myapp.near",       // parent = sub-account namespace
        parentHasFullAccess: true,         // recommended: parent retains ownership
        minDeposit: "0.1 NEAR",            // NEAR to transfer to new account
      },
    }),
  ],
});
```

The user provides a public key (from a wallet or generated keypair) when creating the sub-account. The server adds it as a full access key alongside the parent's key:

```
Transaction (atomic):
  createAccount("myapp.myapp.near")
  addKey(userPublicKey, fullAccess)
  addKey(parentPublicKey, fullAccess)   ← parentHasFullAccess: true
  transfer("myapp.myapp.near", "0.1 NEAR")
```

### Standalone mode (no relayer)

Sub-account creation works without a relayer when you provide the parent key via `secrets`. The server creates a `Near` instance from the RPC URL and signs with the parent key.

```typescript
siwn({
  recipient: "myapp.near",
  secrets: {
    parentKey: process.env.PARENT_KEY,  // used to sign as parent
  },
  subAccount: {
    parentAccount: "myapp.near",
    parentHasFullAccess: true,
  },
});
```

No relayer setup needed — the parent account pays gas directly.

### Parent different from relayer

When the parent account is different from the relayer, provide the parent key in `secrets.parentKey`:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  secrets: {
    parentKey: process.env.PARENT_KEY,   // to sign as "user.parent.near"
  },
  subAccount: {
    parentAccount: "user.parent.near",     // different from relayer
    parentHasFullAccess: true,
  },
});
```

## Configuration

### `SubAccountConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parentAccount` | `string` | relayer `accountId` | Named parent account for sub-account namespace |
| `minDeposit` | `string` | `"0.1 NEAR"` | NEAR transferred to new account |
| `parentHasFullAccess` | `boolean` | `false` | Add parent's key as full access on subaccount |
| `deploy` | `object` | — | Deploy a contract to the subaccount |
| `init` | `object` | — | Call a method after deploy |
| `extendTx` | `function` | — | Custom transaction building hook |
| `onCreated` | `function` | — | Post-creation callback (before response) |
| `onRollback` | `function` | — | Consumer cleanup when onCreated fails |

### `secrets` (on `SIWNPluginOptions`)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `parentKey` | `string \| DualNetworkConfig<string>` | — | `ed25519:...` key for signing as parent account |

### Context types

```typescript
interface SubAccountTxCtx {
  newAccountId: string;       // "myapp.myapp.near"
  parentAccount: string;      // "myapp.near"
  userPublicKey: string;      // from the request body
  userAccountId: string;      // from SIWN session (wallet account)
  userId: string;             // Better Auth internal user ID
  network: "mainnet" | "testnet";
}

interface SubAccountLifecycleCtx extends SubAccountTxCtx {
  near: Near;                 // for additional on-chain operations
}
```

## Contract deployment

### From a global contract (recommended)

Publish your contract to the global registry (once), then deploy by reference. This is cheaper and faster than uploading Wasm each time.

See: [NEAR Kit — Global Contracts](https://kit.near.tools/in-depth/global-contracts.md)

```typescript
// Server config
siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    deploy: { fromPublished: { accountId: "myapp.near" } },
    init: {
      methodName: "init",
      args: (ctx) => ({ owner: ctx.userAccountId }),
    },
  },
});
```

### From raw Wasm

```typescript
import { readFileSync } from "fs";
const wasm = readFileSync("./contract.wasm");

siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    deploy: { wasm },
  },
});
```

### From an immutable hash

```typescript
siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    deploy: { fromPublished: { codeHash: "5FzD8..." } },
    init: { methodName: "init", args: { owner: "myapp.near" } },
  },
});
```

### Dynamic init args

`init.args` accepts a function that receives the transaction context:

```typescript
init: {
  methodName: "init",
  args: (ctx) => ({
    owner: ctx.userAccountId,
    parent: ctx.parentAccount,
    subaccount: ctx.newAccountId,
  }),
}
```

## Transaction hooks

### `extendTx` — compose arbitrary actions

Add any NEAR Kit TransactionBuilder actions (stake, function calls, additional keys, delegate actions, etc.) to the creation transaction. All actions are atomic — if any fails, the entire transaction reverts.

The tx already has `createAccount`, `addKey` (user), `addKey` (parent if `parentHasFullAccess`), `transfer`, `deploy`, and `init` applied before `extendTx` is called.

```typescript
siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    parentHasFullAccess: true,
    extendTx: (tx, ctx) => tx
      .functionCall(ctx.newAccountId, "configure", {
        owner: ctx.userAccountId,
        quota: "100",
      }),
  },
});
```

Available TransactionBuilder methods: `createAccount`, `addKey`, `deleteKey`, `deleteAccount`, `functionCall`, `transfer`, `stake`, `deployContract`, `deployFromPublished`, `publishContract`, `stateInit`, `signWith`, `signedDelegateAction`, `delegate`.

Reference: [NEAR Kit — Action Reference](https://kit.near.tools/reference/actions.md)

## Lifecycle hooks

### `onCreated` — post-creation side effects

Runs after the transaction succeeds and internal DB records are written. Use for creating your own DB records, sending notifications, etc.

```typescript
siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    onCreated: async (ctx) => {
      // ctx has all tx context + a Near instance
      await db.wiki.create({
        accountId: ctx.newAccountId,
        owner: ctx.userAccountId,
      });
    },
  },
});
```

### `onRollback` — consumer cleanup

If `onCreated` throws, the plugin:
1. Deletes internal DB records (nearAccount, internalAdapter)
2. Calls `onRollback(ctx)` if provided (consumer cleanup)
3. Automatically deletes the on-chain account (`deleteAccount({ beneficiary: parentAccount })`)
4. Returns a 500 error

```typescript
siwn({
  // ...
  subAccount: {
    parentAccount: "myapp.near",
    onCreated: async (ctx) => {
      await db.wiki.create({ accountId: ctx.newAccountId });
    },
    onRollback: async (ctx) => {
      // Clean up any consumer side effects
      await db.wiki.delete({ accountId: ctx.newAccountId }).catch(() => {});
      // On-chain deleteAccount is handled automatically
    },
  },
});
```

The lifecycle flow:

```
1. Send atomic transaction
   → fail → return error (nothing to rollback)
   → succeed → continue
2. Write internal DB records (nearAccount, internalAdapter)
   → fail → ROLLBACK: onRollback → delete DB records → deleteAccount → return 500
   → succeed → continue
3. Call onCreated(ctx)
   → fail → ROLLBACK: onRollback → delete DB records → deleteAccount → return 500
   → succeed → return 200 success
```

Complete event: `SubAccountLifecycleCtx` includes `near: Near` for additional on-chain operations in both `onCreated` and `onRollback`.

## Client-side flow

```typescript
import { authClient } from "./auth-client";

// 1. Check availability
const { data: avail } = await authClient.near.checkSubAccountAvailability({
  subAccountName: "myapp",
});
if (!avail.available) {
  console.log("Not available:", avail.reason);
  return;
}

// 2. Create the sub-account
const result = await authClient.near.createSubAccount({
  subAccountName: "myapp",
  publicKey: "ed25519:...", // user's public key
});
console.log(result.data.accountId); // myapp.parent.near
```

## Common Mistakes

### HIGH Not setting parentHasFullAccess when parent needs recovery

Without `parentHasFullAccess: true`, the parent has no access to the subaccount. If the user loses their key, the subaccount is unrecoverable.

```typescript
// Wrong: no parent access
siwn({
  subAccount: { parentAccount: "myapp.near" },
});

// Correct: parent retains ownership
siwn({
  subAccount: {
    parentAccount: "myapp.near",
    parentHasFullAccess: true,
  },
});
```

### HIGH Missing secrets.parentKey when parent differs from relayer

The creation transaction must be signed by the parent account. If the parent account is different from the relayer, provide the parent key via `secrets`:

```typescript
// Wrong: relayer can't sign as parent
siwn({
  relayer: { accountId: "relayer.near", privateKey: "..." },
  subAccount: { parentAccount: "user.parent.near" },
});

// Correct: provide parent key
siwn({
  relayer: { accountId: "relayer.near", privateKey: "..." },
  secrets: { parentKey: process.env.PARENT_KEY },
  subAccount: { parentAccount: "user.parent.near" },
});
```

### MEDIUM Not checking availability before creation

Always check availability before attempting creation:

```typescript
// Wrong: create without checking
await authClient.near.createSubAccount({ subAccountName: "myapp", publicKey });

// Correct: check first
const { data } = await authClient.near.checkSubAccountAvailability({
  subAccountName: "myapp",
});
if (!data.available) return;
await authClient.near.createSubAccount({ subAccountName: "myapp", publicKey });
```

### MEDIUM Using relayer ephemeral mode without parentAccount

Ephemeral mode generates an implicit hex account that cannot own sub-accounts. Either set `subAccount.parentAccount` to a named account or use an explicit relayer.

### MEDIUM Forgetting to handle rollback cleanup in onCreated

If `onCreated` writes to your own database and throws, the plugin automatically deletes the on-chain account and its internal DB records. Your `onRollback` should clean up your own side effects:

```typescript
onCreated: async (ctx) => {
  await myDb.create({ id: ctx.newAccountId });
},
onRollback: async (ctx) => {
  await myDb.delete({ id: ctx.newAccountId }).catch(() => {});
  // on-chain deleteAccount happens automatically
},
```

### MEDIUM Assuming onRollback replaces on-chain cleanup

`onRollback` is for **consumer cleanup only**. The plugin always deletes the on-chain account and its internal DB records automatically when rollback is triggered. Do not call `deleteAccount` inside `onRollback`.

### LOW Using secrets.parentKey in subAccount config

`parentKey` is no longer a field on `SubAccountConfig`. It was moved to `secrets.parentKey` for security (kept out of config and encrypted storage):

```typescript
// Wrong: old API
subAccount: { parentKey: "ed25519:..." }

// Correct: new API
secrets: { parentKey: "ed25519:..." }
subAccount: { parentAccount: "myapp.near" }
```
