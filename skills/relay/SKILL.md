---
name: relay
description: >
  Configure the gasless NEP-366 delegate action relayer in ephemeral or explicit
  mode, relay signed delegate actions on-chain, enforce contract whitelisting and
  gas/deposit limits, check relay status and history, and use the contract view
  endpoint. Load when setting up relayer config, debugging relay failures, or
  configuring RotatingKeyStore for high-throughput relay.
metadata:
  type: core
  library: better-near-auth
  library_version: "1.9.0"
sources:
  - "elliotBraem/better-near-auth:src/index.ts"
  - "elliotBraem/better-near-auth:src/utils.ts"
  - "elliotBraem/better-near-auth:src/types.ts"
  - "elliotBraem/better-near-auth:src/schema.ts"
  - "elliotBraem/better-near-auth:README.md"
  - "elliotBraem/better-near-auth:LLM.txt"
---

# Better-Near-Auth — Gasless Relay

Built-in NEP-366 delegate action relayer that broadcasts signed transactions on behalf of authenticated users, paying gas from a relayer account. Supports ephemeral mode (auto-generated keypair) and explicit mode (named account with provided keys).

## Setup

### Ephemeral mode (zero-config)

```typescript
import { siwn } from "better-near-auth";

export const auth = betterAuth({
  plugins: [
    siwn({
      recipient: "myapp.com",
      relayer: true, // auto-generates keypair on first startup
    }),
  ],
});
```

On first startup, the server logs the ephemeral account ID. **Fund this account with NEAR** to enable relay:

```
[siwn] Relayer initialized: 7a3c4b5c... (mainnet, ephemeral)
[siwn] Fund this account with NEAR to enable gasless relay
[siwn] Private key is encrypted in DB — persists across restarts
```

The private key is encrypted with AES-256-GCM using `BETTER_AUTH_SECRET` as the KEK and stored in the `relayerKey` database table.

### Ephemeral with settings

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    ephemeral: true, // explicit marker (optional)
    whitelistedContracts: ["myapp.near"],
    maxGasPerTransaction: "300000000000000", // 300 Tgas
    maxDepositPerTransaction: "0",
  },
});
```

### Explicit mode (production)

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY, // base64 ed25519:...
    whitelistedContracts: ["myapp.near"],
    maxGasPerTransaction: "300000000000000", // 300 Tgas
    maxDepositPerTransaction: "0",
  },
});
```

### Per-network configuration

```typescript
siwn({
  recipients: {
    mainnet: "myapp.com",
    testnet: "myapp.testnet",
  },
  relayer: {
    mainnet: {
      whitelistedContracts: ["myapp.near"],
    },
    testnet: {
      whitelistedContracts: ["myapp.testnet"],
      maxGasPerTransaction: "100000000000000", // lower for testing
    },
  },
});
```

Creates separate ephemeral keys for each network with independent settings.

### Rotating keys (high-throughput)

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKeys: [
      process.env.RELAYER_KEY_1,
      process.env.RELAYER_KEY_2,
      process.env.RELAYER_KEY_3,
    ],
    whitelistedContracts: ["myapp.near"],
  },
});
```

Multiple keys cycle round-robin via `RotatingKeyStore`, eliminating nonce collisions for high-throughput relayers.

## Core Patterns

### Relay a delegate action from client to on-chain

```typescript
import { Gas } from "near-kit";

// 1. Build signed delegate action using wallet's function-call access key
const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "some_method", { key: "value" }, {
    gas: Gas.Tgas(30),
    attachedDeposit: BigInt(0),
  })
);

// 2. Relay it — the server pays gas
const result = await authClient.near.relayTransaction({ payload });
console.log("Tx hash:", result.data.txHash);

// 3. Check status
const status = await authClient.near.getRelayStatus(result.data.txHash);
console.log("Status:", status.data.status); // "pending" | "completed" | "failed"
```

The `buildSignedDelegateAction` callback receives a `TransactionBuilder` and the `receiverId`. The builder must use `.functionCall()` — external code constructs the transaction object using near-kit's builder API. Do not use `.send()` directly.

### Check relayer info and balance

```typescript
const info = await authClient.near.getRelayerInfo();
console.log("Relayer:", info.data.accountId);
console.log("Mode:", info.data.mode); // "ephemeral" | "explicit"
console.log("Balance:", info.data.balance);
console.log("Enabled:", info.data.enabled);
```

### Server-side contract view call

```typescript
const result = await authClient.near.view({
  contractId: "myapp.near",
  methodName: "get_value",
  args: { account_id: "alice.near" },
});
console.log("Result:", result.data.result);
```

View calls are read-only, authenticated, and executed server-side.

## Relay Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/near/relay` | Relay a signed delegate action on-chain |
| GET | `/near/relay-status/:txHash` | Check relayed transaction status |
| POST | `/near/relayer-info` | Get relayer accountId, mode, balance |
| GET | `/near/relay-history` | List relayed transactions for current user |
| POST | `/near/view` | Server-side read-only contract call |

## Relayer Configuration

The relayer can be configured in several ways:

| Value | Mode | Description |
|-------|------|-------------|
| `true` | Ephemeral | Auto-generated ED25519 keypair (simplest) |
| `RelayerEphemeralConfig` | Ephemeral | Ephemeral with custom settings |
| `RelayerExplicitConfig` | Explicit | Bring your own key |
| `RelayerDualNetworkConfig` | Mixed | Per-network configuration |

**Ephemeral Config (`RelayerEphemeralConfig`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `whitelistedContracts` | `string[]` | — | Restrict relay to these contract IDs |
| `maxGasPerTransaction` | `string` | — | Max gas per relayed transaction (yoctoNEAR) |
| `maxDepositPerTransaction` | `string` | — | Max deposit per relayed transaction (yoctoNEAR) |

**Explicit Config (`RelayerExplicitConfig`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `accountId` | `string` | — | Named relayer account (required) |
| `privateKey` | `string` | — | Base64 ed25519:... (required) |
| `privateKeys` | `string[]` | — | Multiple keys for RotatingKeyStore |
| `whitelistedContracts` | `string[]` | — | Restrict relay to these contract IDs |
| `maxGasPerTransaction` | `string` | — | Max gas per relayed transaction (yoctoNEAR) |
| `maxDepositPerTransaction` | `string` | — | Max deposit per relayed transaction (yoctoNEAR) |

**Dual Network Config (`RelayerDualNetworkConfig`):**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mainnet` | `RelayerEphemeralConfig \| RelayerExplicitConfig` | — | Mainnet relayer config |
| `testnet` | `RelayerEphemeralConfig \| RelayerExplicitConfig` | — | Testnet relayer config |

When using `relayer: true` or ephemeral config (no `accountId`/`privateKey`), an ED25519 keypair is generated on first startup, the implicit account ID is derived from the public key, and the private key is encrypted with AES-256-GCM (using `BETTER_AUTH_SECRET` as KEK via HKDF-SHA256) and stored in the database. The same keypair is recovered on restart.

## Encryption Details

- **KEK derivation**: HKDF-SHA256 with `BETTER_AUTH_SECRET`, salt `better-near-auth-relayer`, info empty
- **Encryption**: AES-256-GCM with 12-byte random IV
- **Storage**: `encryptedPrivateKey` (base64) + `iv` (base64) in `relayerKey` table
- **Trust model**: Same as Better Auth session tokens — DB access + `BETTER_AUTH_SECRET` = full access

## Common Mistakes

### CRITICAL Not funding the ephemeral relayer account

Wrong:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: true, // ephemeral — but account has zero balance
});
// Server starts, relayer created, but every relay attempt fails
```

Correct:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: true, // ephemeral
});
// After startup, check logs for the accountId:
// [siwn] Relayer initialized: 7a3c4b5c... (mainnet, ephemeral)
// Send NEAR to that account ID to fund the relayer
```

The ephemeral mode generates an implicit account (hex of public key) with zero balance. Without funding, every relay attempt fails with an insufficient balance error from the NEAR RPC. The server catches this at src/index.ts:952-958 and surfaces it as `"Relay failed"` — check server logs for the actual RPC error. Alternatively, use explicit mode with a pre-funded named account.

Source: src/index.ts:179-181, maintainer interview

### CRITICAL Empty relayer_key table (config not passed)

Wrong:

```typescript
// Config builder returns undefined when checking for accountId
if (!siwn.relayer?.accountId) return undefined;
// Relayer never initializes, relayer_key table stays empty
```

Correct:

```typescript
// Use relayer: true or provide config object
relayer: true
// OR
relayer: {
  whitelistedContracts: ["myapp.near"],
}
```

If the `relayer_key` table exists but is empty after startup, the relayer config is not being passed correctly. Check:
1. `BETTER_AUTH_SECRET` is set (required for ephemeral mode)
2. Relayer config is actually passed to `siwn()` plugin
3. Startup logs show `[siwn] Relayer initialized` message

Source: maintainer interview

### CRITICAL Omitting whitelistedContracts in production

Wrong:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
    // No whitelistedContracts — any contract can be called at relayer's expense
  },
});
```

Correct:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
    whitelistedContracts: ["myapp.near"],
  },
});
```

Without whitelistedContracts, any authenticated user can relay transactions to arbitrary contracts, spending the relayer's NEAR. Always restrict in production.

Source: src/index.ts:891-898, maintainer interview

### HIGH Constructing transactions with wrong builder pattern

Wrong:

```typescript
// Wrong: trying to send directly instead of delegate
const result = await near.transaction(accountId)
  .functionCall(receiverId, "method", args, { gas: Gas.Tgas(30) })
  .send({ waitUntil: "EXECUTED" });
```

Correct:

```typescript
// Correct: build signed delegate action, then relay via server
const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "method", args, {
    gas: Gas.Tgas(30),
    attachedDeposit: BigInt(0),
  })
);
const result = await authClient.near.relayTransaction({ payload });
```

Delegate actions must be built using the near-kit `TransactionBuilder` with `.delegate()`, not `.send()` directly. The wallet signs a delegate action; the relayer submits it on-chain. For direct sends (user pays gas), call `authClient.near.ensureConnected()` first — wallet extensions may disconnect between sign-in and signing.

Source: src/client.ts:172-185, maintainer interview

See also: client/SKILL.md — client buildSignedDelegateAction API

### HIGH Missing BETTER_AUTH_SECRET for ephemeral key encryption

Wrong:

```typescript
// No BETTER_AUTH_SECRET set — ephemeral key encryption uses empty string
siwn({
  recipient: "myapp.com",
  relayer: true,
});
```

Correct:

```typescript
// BETTER_AUTH_SECRET is required by Better Auth and used by the relayer
// Set it in your environment or Better Auth config
process.env.BETTER_AUTH_SECRET = "your-secure-secret";
siwn({
  recipient: "myapp.com",
  relayer: true,
});
```

The ephemeral relayer encrypts its private key using HKDF-SHA256 derived from `BETTER_AUTH_SECRET`. If missing, key derivation falls back to an empty string, which is insecure and may cause decryption failures on server restart.

Source: src/utils.ts:21-41, src/index.ts:134


