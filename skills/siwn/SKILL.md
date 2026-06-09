---
name: siwn
description: >
  Set up the SIWN server plugin for Better Auth, configure NEP-413 authentication
  with recipient and API key, handle nonce generation, signature verification,
  account linking and unlinking, and NEAR profile lookup. Load when adding
  NEAR wallet sign-in to a Better Auth server, configuring siwn() plugin options,
  or debugging NEP-413 verify or nonce issues.
type: core
library: better-near-auth
library_version: "1.6.2"
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

## Server Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/near/nonce` | Generate hex-encoded nonce for signing |
| POST | `/near/verify` | Verify NEP-413 signature, create session |
| POST | `/near/profile` | Get NEAR profile (requires session) |
| POST | `/near/link-account` | Link NEAR account to session |
| POST | `/near/unlink-account` | Unlink NEAR account |
| GET | `/near/list-accounts` | List linked NEAR accounts |

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
