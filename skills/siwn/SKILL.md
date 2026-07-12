---
name: siwn
description: >
  Set up the SIWN server plugin for Better Auth, configure NEP-413 authentication
  with recipient and API key, handle nonce generation, signature verification,
  account linking and unlinking, and NEAR profile lookup. Load when adding
  NEAR wallet sign-in to a Better Auth server, configuring siwn() plugin options,
  or debugging NEP-413 verify or nonce issues.
metadata:
  type: core
  library: better-near-auth
  library_version: "1.7.0"
sources:
  - "elliotBraem/better-near-auth:src/index.ts"
  - "elliotBraem/better-near-auth:src/profile.ts"
  - "elliotBraem/better-near-auth:src/types.ts"
  - "elliotBraem/better-near-auth:src/schema.ts"
  - "elliotBraem/better-near-auth:README.md"
  - "elliotBraem/better-near-auth:LLM.txt"
---

# Better-Near-Auth — SIWN Authentication

Better Auth plugin for NEAR wallet authentication following NEP-413. Provides server-side nonce generation, signature verification, account linking, and profile lookup.

## Setup

```typescript
import { betterAuth } from "better-auth";
import { siwn } from "better-near-auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    // your DB adapter config
  }),
  plugins: [
    siwn({
      recipient: "myapp.com",
      apiKey: process.env.FASTNEAR_API_KEY,
    }),
  ],
});
```

After adding the plugin, generate the database schema:

```bash
npx @better-auth/cli generate
```

This creates three tables: `nearAccount`, `relayedTransaction`, and `relayerKey`.

## Core Patterns

### Configure with custom RPC URL

For sandbox or private nodes, override the default RPC endpoint:

```typescript
siwn({
  recipient: "myapp.com",
  rpcUrl: "http://localhost:3030",
  apiKey: process.env.FASTNEAR_API_KEY,
});
```

### Custom profile lookup

Override the default FastNear KV → NEAR Social fallback chain:

```typescript
siwn({
  recipient: "myapp.com",
  getProfile: async (accountId) => {
    const res = await fetch(`https://api.myapp.com/profiles/${accountId}`);
    if (res.ok) {
      const p = await res.json();
      return { name: p.displayName, description: p.bio, image: { url: p.avatar } };
    }
    return null;
  },
});
```

### Validate function-call access keys

By default the plugin validates that the signing key is either a full-access key or a function-call key scoped to the recipient. Override with `validateLimitedAccessKey`:

```typescript
siwn({
  recipient: "myapp.com",
  validateLimitedAccessKey: async ({ accountId, publicKey, recipient }) => {
    const allowed = ["myapp.near", "social.near"];
    return recipient ? allowed.includes(recipient) : true;
  },
});
```

### Link and unlink NEAR accounts

After authentication, link additional NEAR accounts to the same session:

```typescript
// Client: link another NEAR account
await authClient.near.link({
  onSuccess: () => console.log("linked"),
  onError: (err) => console.error(err),
});

// Client: unlink an account
await authClient.near.unlink({ accountId: "alice.near" });
```

You cannot unlink the last authentication method — link another account first.

### Sub-account creation

Create named sub-accounts (e.g. `myapp.parent.near`). See the **[subaccount skill](../subaccount/SKILL.md)** for the full reference.

Basic setup:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  subAccount: {
    parentAccount: "myapp.near",
  },
});
```

If the parent account differs from the relayer account, provide the parent key via `secrets`:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  secrets: {
    parentKey: process.env.PARENT_KEY,  // for signing as a different parent
  },
  subAccount: {
    parentAccount: "user.parent.near",
    minDeposit: "0.5 NEAR",
  },
});
```

Client-side flow:

```typescript
// 1. Check availability first
const { data } = await authClient.near.checkSubAccountAvailability({
  subAccountName: "myapp",
});
if (!data.available) {
  console.log("Not available:", data.reason);
  return;
}

// 2. Create the sub-account with the user's public key
const result = await authClient.near.createSubAccount({
  subAccountName: "myapp",
  publicKey: "ed25519:...", // user's public key
});
console.log(result.data.accountId); // myapp.parent.near
```

To use parent ownership, contract deployment, init calls, transaction hooks, or lifecycle callbacks with automatic rollback, see the **[subaccount skill](../subaccount/SKILL.md)**.

## Server Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/near/nonce` | Generate hex-encoded nonce for signing |
| POST | `/near/verify` | Verify NEP-413 signature, create session |
| POST | `/near/profile` | Get NEAR profile (requires session) |
| POST | `/near/link-account` | Link NEAR account to session |
| POST | `/near/unlink-account` | Unlink NEAR account |
| GET | `/near/list-accounts` | List linked NEAR accounts |
| POST | `/near/set-primary-account` | Set primary linked NEAR account |
| POST | `/near/create-sub-account` | Create a sub-account under a parent account |
| POST | `/near/check-sub-account-availability` | Check if a sub-account name is available |

## Plugin Options

| Option | Type | Default | Description |
| ------ | ---- | ------- | ----------- |
| `recipient` | `string` | — | NEP-413 recipient identifier (required) |
| `requireFullAccessKey` | `boolean` | `false` | Require full access keys |
| `getNonce` | `() => Promise<Uint8Array>` | `generateNonce()` | Custom nonce generation |
| `getProfile` | `(accountId) => Promise<Profile \| null>` | FastNear KV → NEAR Social | Custom profile lookup |
| `validateLimitedAccessKey` | `(args) => Promise<boolean>` | Default FAK validation | Validate limited access keys |
| `apiKey` | `string` | `process.env.FASTNEAR_API_KEY` | API key for RPC |
| `rpcUrl` | `string` | — | Custom RPC URL |
| `relayer` | `RelayerConfig` | — | See relay skill |
| `recipients` | `DualNetworkConfig<string>` | — | Per-network recipient (overrides `recipient` for mainnet/testnet) |
| `subAccount` | `SubAccountConfig \| DualNetworkConfig<SubAccountConfig>` | — | Sub-account configuration for delegated account creation |

## Email Handling

- `.near` accounts: `efiz.near` → `efiz@near.email` (automatic)
- Non-`.near` accounts (e.g. implicit hex accounts): no email set; users add email via other Better Auth plugins

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

The client signs a message with the recipient embedded. The server verifies against its own recipient. A mismatch causes verification to fail with no clear error.

Source: src/index.ts:225, src/client.ts:17

See also: client/SKILL.md — client recipient must match server recipient

### HIGH Sending raw nonce bytes instead of hex-encoded string

Wrong:

```typescript
const nonce = new Uint8Array(32);
await authClient.near.verify({
  signedMessage,
  message,
  recipient,
  nonce: nonce, // raw bytes
  accountId,
});
```

Correct:

```typescript
const nonceBytes = generateNonce();
const nonceHex = hex.encode(nonceBytes);
// ...sign with nonceBytes via wallet...
await authClient.near.verify({
  signedMessage,
  message,
  recipient,
  nonce: nonceHex, // hex-encoded string
  accountId,
});
```

The verify endpoint hex-decodes the nonce string. Sending raw bytes or a non-hex string causes decode failure or nonce replay detection failure.

Source: src/types.ts:53-58, src/client.ts:106-109

### HIGH Forgetting to generate DB schema after adding plugin

Wrong:

```typescript
// Add siwn() to plugins, then start the server immediately
export const auth = betterAuth({
  plugins: [siwn({ recipient: "myapp.com" })],
});
```

Correct:

```typescript
// Add siwn() to plugins, THEN generate schema before starting
export const auth = betterAuth({
  plugins: [siwn({ recipient: "myapp.com" })],
});
// Run: npx @better-auth/cli generate
```

The plugin adds nearAccount, relayedTransaction, and relayerKey tables. Without running the CLI, the database will be missing these tables and all endpoints will fail at runtime with adapter errors.

Source: README.md:56-60

### MEDIUM Network mismatch from account ID suffix

Wrong:

```typescript
await authClient.near.nonce({
  accountId: "alice.near",
  networkId: "testnet", // .near is mainnet
});
```

Correct:

```typescript
await authClient.near.nonce({
  accountId: "alice.near",
  networkId: "mainnet", // matches .near suffix
});
```

Network is auto-detected from the accountId: `.testnet` → testnet, otherwise → mainnet. The nonce endpoint validates that networkId matches the account's detected network and rejects mismatches.

Source: src/profile.ts:6-8, src/index.ts:546-552

See also: client/SKILL.md — client siwnClient networkId should match the account's network

### HIGH Not configuring parentAccount for sub-account creation with ephemeral relayer

Wrong:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {}, // ephemeral mode — implicit hex account
  subAccount: {}, // no parentAccount set
});
// Server throws: "Sub-account creation requires a named parent account"
```

Correct:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  subAccount: {
    parentAccount: "myapp.near",
  },
});
```

Ephemeral mode generates an implicit hex account (e.g. `7a3c4b5c...`) which cannot own sub-accounts — NEAR only allows named accounts to create sub-accounts. Set `subAccount.parentAccount` to a named account, or use an explicit relayer with a named account and omit `parentAccount` (defaults to relayer accountId).

Source: src/index.ts:1395-1405, src/index.ts:290-304

### MEDIUM Missing secrets.parentKey when parent account differs from relayer

Wrong:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  subAccount: {
    parentAccount: "user.parent.near", // different from relayer
    // no secrets.parentKey
  },
});
// Server throws: "Sub-account parent differs from relayer account"
```

Correct:

```typescript
siwn({
  recipient: "myapp.com",
  relayer: {
    accountId: "relayer.myapp.near",
    privateKey: process.env.RELAYER_PRIVATE_KEY,
  },
  secrets: {
    parentKey: process.env.PARENT_KEY,  // used to sign as parent
  },
  subAccount: {
    parentAccount: "user.parent.near",
    minDeposit: "0.5 NEAR",
  },
});
```

The creation transaction must be signed by the parent account. If `parentAccount` differs from the relayer account, provide `secrets.parentKey` so the server can sign as the parent.

Source: src/index.ts:1403-1415, src/index.ts:1420-1423

See also: [subaccount skill](../subaccount/SKILL.md)
