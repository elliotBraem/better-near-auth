---
name: client
description: >
  Set up the siwnClient plugin for Better Auth client, configure NEAR wallet
  connection via NearConnect, use authClient.near actions for sign-in, profile
  lookup, account management, delegate action building with TransactionBuilder,
  and relay submission. Load when implementing NEAR wallet sign-in on the client,
  using authClient.near.* methods, or building delegate actions for gasless relay.
type: core
library: better-near-auth
library_version: "1.1.0"
sources:
  - "elliotBraem/better-near-auth:src/client.ts"
  - "elliotBraem/better-near-auth:src/types.ts"
  - "elliotBraem/better-near-auth:README.md"
  - "elliotBraem/better-near-auth:LLM.txt"
---

# Better-Near-Auth — Client Integration

Client-side plugin for NEAR wallet authentication and gasless relay. Connects to NEAR wallets via NearConnect, provides `authClient.near.*` actions for sign-in, account management, profile lookup, and delegate action building.

## Setup

```typescript
import { createAuthClient } from "better-auth/client";
import { siwnClient } from "better-near-auth/client";

export const authClient = createAuthClient({
  plugins: [
    siwnClient({
      recipient: "myapp.com",
      networkId: "mainnet",
    }),
  ],
});
```

The `recipient` must match the server's `siwn()` recipient exactly. `networkId` defaults to `"mainnet"`.

## Core Patterns

### Sign in with NEAR wallet

```typescript
await authClient.signIn.near({
  onSuccess: () => {
    console.log("Signed in!");
  },
  onError: (error) => {
    console.error("Sign in failed:", error.message);
  },
});
```

`signIn.near()` handles the full flow: wallet connection → NEP-413 message signing → server verification → session creation. It automatically detects wallet capabilities and uses single-step or two-step flow.

### Build and relay a delegate action

```typescript
import { Gas } from "near-kit";

const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "some_method", { key: "value" }, {
    gas: Gas.Tgas(30),
    attachedDeposit: BigInt(0),
  })
);

const result = await authClient.near.relayTransaction({ payload });
console.log("Tx hash:", result.data.txHash);

const status = await authClient.near.getRelayStatus(result.data.txHash);
console.log("Status:", status.data.status);
```

The `buildSignedDelegateAction` callback receives a `TransactionBuilder` from near-kit and the `receiverId`. Use `builder.functionCall()` to construct actions. The builder calls `.delegate()` internally and returns a base64 payload string.

### Wallet state and profile management

```typescript
// Get current account
const accountId = authClient.near.getAccountId(); // string | null

// Get full wallet state
const state = authClient.near.getState(); // { accountId, publicKey, networkId } | null

// Get profile
const profile = await authClient.near.getProfile();
const aliceProfile = await authClient.near.getProfile("alice.near");

// Disconnect wallet
await authClient.near.disconnect();
```

### Account linking and contract view calls

```typescript
// Link another NEAR account to current session
await authClient.near.link({
  onSuccess: () => console.log("Linked"),
  onError: (err) => console.error(err),
});

// Unlink
await authClient.near.unlink({ accountId: "alice.near" });

// List linked accounts
const { data } = await authClient.near.listAccounts();

// Server-side read-only contract call
const result = await authClient.near.view({
  contractId: "myapp.near",
  methodName: "get_value",
  args: { account_id: "alice.near" },
});
```

## Client Actions Reference

### authClient.near

| Method | Returns | Description |
| ------ | ------- | ----------- |
| `nonce(params)` | `Promise<Response<NonceResponse>>` | Request nonce from server |
| `verify(params)` | `Promise<Response<VerifyResponse>>` | Verify NEP-413 signature |
| `getProfile(accountId?)` | `Promise<Response<Profile>>` | Get NEAR profile |
| `view(params)` | `Promise<Response<ViewResponse>>` | Server-side contract view call |
| `getAccountId()` | `string \| null` | Currently connected account ID |
| `getState()` | `{ accountId, publicKey, networkId } \| null` | Wallet state |
| `disconnect()` | `Promise<void>` | Disconnect wallet |
| `link(callbacks?)` | `Promise<void>` | Link NEAR account to session |
| `unlink(params)` | `Promise<Response>` | Unlink NEAR account |
| `listAccounts()` | `Promise<Response>` | List linked NEAR accounts |
| `buildSignedDelegateAction(receiverId, buildActions)` | `Promise<string>` | Build + sign delegate action, returns base64 payload |
| `relayTransaction({ payload })` | `Promise<Response<RelayResponse>>` | Submit delegate action to relayer |
| `getRelayStatus(txHash)` | `Promise<Response<RelayStatusResponse>>` | Check relayed tx status |
| `getRelayerInfo()` | `Promise<Response<RelayerInfo>>` | Get relayer info and balance |
| `relayHistory()` | `Promise<Response<RelayHistoryResponse>>` | List relayed transactions |
| `client` | `Near` | Access near-kit Near instance directly |

### authClient.signIn

| Method | Description |
| ------ | ----------- |
| `near(callbacks?)` | Connect wallet, sign message, verify — single popup |

### Callback Interface

```typescript
interface AuthCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error & { status?: number; code?: string }) => void;
}
```

## Common Mistakes

### CRITICAL Recipient mismatch between server and client

Wrong:

```typescript
// Server
siwn({ recipient: "myapp.near" });

// Client
siwnClient({ recipient: "myapp.com" });
```

Correct:

```typescript
// Server
siwn({ recipient: "myapp.com" });

// Client
siwnClient({ recipient: "myapp.com" });
```

The client embeds the recipient in the signed message. The server verifies against its own recipient. A mismatch causes the verify endpoint to reject the signature with "Unauthorized: Invalid signature" — which is confusing because the signature is valid, just for a different recipient.

Source: src/client.ts:17, src/index.ts:225

See also: siwn/SKILL.md — server plugin recipient configuration

### HIGH Calling buildSignedDelegateAction without connected wallet

Wrong:

```typescript
// No wallet connected yet
const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "method", {})
);
```

Correct:

```typescript
// Check wallet state before building delegate action
const accountId = authClient.near.getAccountId();
if (!accountId) {
  await authClient.signIn.near();
}
const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "method", {})
);
```

`buildSignedDelegateAction` reads `accountId` from the `nearState` atom. If the wallet is not connected, nearState is null and the function throws "No wallet connected — cannot sign delegate action" with no user-facing prompt to connect.

Source: src/client.ts:176-179

### HIGH Constructing transactions with wrong builder pattern

Wrong:

```typescript
// Wrong: trying to use .send() directly instead of delegate flow
const result = await near.transaction(accountId)
  .functionCall(receiverId, "method", args, { gas: Gas.Tgas(30) })
  .send({ waitUntil: "EXECUTED" });
```

Correct:

```typescript
// Correct: use buildSignedDelegateAction + relayTransaction
const payload = await authClient.near.buildSignedDelegateAction(
  "myapp.near",
  (builder, receiverId) => builder.functionCall(receiverId, "method", args, {
    gas: Gas.Tgas(30),
    attachedDeposit: BigInt(0),
  })
);
const result = await authClient.near.relayTransaction({ payload });
```

Delegate actions must be built through `buildSignedDelegateAction`, which uses near-kit's `TransactionBuilder.delegate()` method. Direct `.send()` broadcasts from the client account and requires the user to pay gas — defeating the gasless relay purpose.

Source: src/client.ts:172-185, maintainer interview

See also: relay/SKILL.md — relay endpoint validation and whitelisting

### MEDIUM Using authClient.near.verify directly instead of signIn.near

Wrong:

```typescript
// Manually calling verify without proper wallet signing flow
await authClient.near.verify({
  signedMessage: someMessage,
  message: "Sign in to myapp.com",
  recipient: "myapp.com",
  nonce: someNonce,
  accountId: "alice.near",
});
```

Correct:

```typescript
// Use the single-step sign-in method that handles the full flow
await authClient.signIn.near({
  onSuccess: () => { /* signed in */ },
  onError: (error) => { console.error(error); },
});
```

`signIn.near()` handles wallet connection, NEP-413 message signing, nonce management, and server verification in a single call. Calling `verify` directly requires manually constructing all parameters and does not handle wallet connection.

Source: src/client.ts:314-348

### MEDIUM Not subscribing to wallet disconnect events

Wrong:

```typescript
// Read account ID once — never updates
const accountId = authClient.near.getAccountId();
```

Correct:

```typescript
// Subscribe to nearState for reactive updates
import { useStore } from "nanostores/react";
const { nearState } = authClient.$store;
const state = useStore(nearState);
// state is null when wallet disconnects externally
```

When the wallet disconnects externally (user signs out from wallet UI), the `nearState` atom is set to null. UI components that only read `getAccountId()` once will show stale account info.

Source: src/client.ts:62,82-92

See also: siwn/SKILL.md — server-side nonce and verify endpoints
