<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 2.5rem; font-weight: bold;">better-near-auth</h1>

  <p>
    <strong>Sign in with NEAR + gasless relay plugin for Better Auth</strong>
  </p>

</div>

This [Better Auth](https://better-auth.com) plugin enables secure authentication via NEAR wallets following [NEP-413](https://github.com/near/NEPs/blob/master/neps/nep-0413.md) and adds a built-in [NEP-366](https://github.com/near/NEPs/blob/master/neps/nep-0366.md) delegate action relayer so authenticated users can call on-chain contracts gaslessly. It uses [FastNear](https://fastnear.com) for wallet connection, RPC queries, and transaction broadcasting.

## Features

- **SIWN authentication** — wallet-based sign-in with automatic single-step/two-step flow detection
- **Gasless relay** — server relays signed delegate actions on-chain, paying gas from a relayer account
- **Ephemeral relayer keypair** — auto-generated ED25519 keypair on first startup, private key encrypted with AES-256-GCM in the database, persists across restarts
- **Profile integration** — FastNear KV primary, NEAR Social fallback

## Installation

1. Install the package

```bash
npm install better-near-auth
```

2. Add the SIWN plugin to your auth configuration:

    ```ts title="auth.ts"
    import { betterAuth } from "better-auth";
    import { siwn } from "better-near-auth";

    export const auth = betterAuth({
        database: drizzleAdapter(db, {
          // db configuration
        }),
        plugins: [
            siwn({
                recipient: "myapp.com",
                anonymous: true,

                // Optional: enable gasless relay
                relayer: {
                  whitelistedContracts: ["myapp.near"],
                },
            }),
        ],
    });
    ```

3. Generate the schema to add the necessary fields and tables to the database.

  ```bash
  npx @better-auth/cli generate
  ```

4. Add the Client Plugin

    ```ts title="auth-client.ts"
    import { createAuthClient } from "better-auth/client";
    import { siwnClient } from "better-near-auth/client";

    export const authClient = createAuthClient({
        plugins: [
            siwnClient({
                recipient: "myapp.com",
                networkId: "mainnet",
            })
        ],
    });
    ```

## Usage

### Sign In with NEAR

The `signIn.near()` method automatically detects wallet capabilities and uses the best available flow:

```tsx title="LoginButton.tsx"
import { authClient } from "./auth-client";
import { useState } from "react";

export function LoginButton() {
  const { data: session } = authClient.useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (session) {
    return (
      <div>
        <p>Welcome, {session.user.name}!</p>
        <button onClick={() => authClient.near.disconnect()}>Sign out</button>
      </div>
    );
  }

  const handleSignIn = async () => {
    setIsSigningIn(true);
    await authClient.signIn.near({
      onSuccess: () => {
        setIsSigningIn(false);
      },
      onError: (error) => {
        setIsSigningIn(false);
        console.error("Sign in failed:", error.message);
      },
    });
  };

  return (
    <button onClick={handleSignIn} disabled={isSigningIn}>
      {isSigningIn ? "Signing in..." : "Sign in with NEAR"}
    </button>
  );
}
```

**Supported wallets for single-step flow:** Meteor Wallet, Intear Wallet, NEAR CLI, HOT Wallet, MyNearWallet, and more.

### Manual Two-Step Flow (Optional)

```ts
await authClient.requestSignIn.near({
  onSuccess: () => console.log("Wallet connected"),
});

await authClient.signIn.near({
  onSuccess: () => console.log("Signed in!"),
});
```

### Gasless Relay

Once the relayer is configured on the server, authenticated users can call on-chain contracts without paying gas:

```ts
// 1. Build a signed delegate action using the wallet's FAK
const signedAction = await authClient.near.buildSignedDelegateAction({
  receiverId: "myapp.near",
  actions: [{
    type: "FunctionCall",
    methodName: "some_method",
    args: new TextEncoder().encode(JSON.stringify({ key: "value" })),
    gas: "30000000000000",
    deposit: "0",
  }],
});

// 2. Relay it — the server pays gas
const result = await authClient.near.relayTransaction({
  signedDelegateAction: signedAction,
});

console.log("Tx hash:", result.txHash);

// 3. Check status
const status = await authClient.near.getRelayStatus(result.txHash);
```

### Profile Access

```ts
const myProfile = await authClient.near.getProfile();
const aliceProfile = await authClient.near.getProfile("alice.near");
```

### Wallet Management

```ts
const accountId = authClient.near.getAccountId();
await authClient.near.disconnect();
```

## Configuration Options

### Server Options

| Option | Type | Default | Description |
|---|---|---|---|
| `recipient` | `string` | — | NEP-413 recipient identifier (required) |
| `anonymous` | `boolean` | `true` | Allow anonymous sign-ins |
| `emailDomainName` | `string` | recipient | Email domain for non-anonymous accounts |
| `requireFullAccessKey` | `boolean` | `true` | Require full access keys |
| `getNonce` | `() => Promise<Uint8Array>` | — | Custom nonce generation |
| `validateNonce` | `(nonce: Uint8Array) => boolean` | — | Custom nonce validation |
| `validateRecipient` | `(recipient: string) => boolean` | — | Custom recipient validation |
| `validateMessage` | `(message: string) => boolean` | — | Custom message validation |
| `getProfile` | `(accountId: string) => Promise<Profile \| null>` | — | Custom profile lookup |
| `validateLimitedAccessKey` | `(args) => Promise<boolean>` | — | Validate FAK when `requireFullAccessKey` is false |
| `fastnearApiKey` | `string` | `process.env.FASTNEAR_API_KEY` | FastNear API key |
| `relayer` | `RelayerConfig` | — | Relayer configuration (see below) |

#### Relayer Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `accountId` | `string` | — | Named relayer account (explicit mode) |
| `privateKey` | `string` | — | Base64 private key (explicit mode) |
| `relayTarget` | `string` | FastNear RPC | RPC URL for broadcasting |
| `whitelistedContracts` | `string[]` | — | Restrict relay to these contracts |
| `maxGasPerTransaction` | `string` | `"300 Tgas"` | Max gas per relayed tx |
| `maxDepositPerTransaction` | `string` | `"0"` | Max deposit per relayed tx |

When `accountId` and `privateKey` are omitted, the relayer starts in **ephemeral mode**: an ED25519 keypair is generated on first startup, the implicit account ID is derived from the public key, and the private key is encrypted with AES-256-GCM (using `BETTER_AUTH_SECRET` as KEK via HKDF-SHA256) and stored in the database. The same keypair is recovered on restart.

### Client Options

| Option | Type | Default | Description |
|---|---|---|---|
| `recipient` | `string` | — | NEP-413 recipient (must match server) |
| `networkId` | `string` | `"mainnet"` | NEAR network |

## Schema

### nearAccount

| Field | Type | Description |
|---|---|---|
| id | string | Primary key |
| userId | string | → user.id |
| accountId | string | NEAR account ID |
| network | string | mainnet/testnet |
| publicKey | string | Associated public key |
| isPrimary | boolean | User's primary account |
| createdAt | date | |

### relayedTransaction

| Field | Type | Description |
|---|---|---|
| userId | string | → user.id |
| txHash | string | On-chain tx hash |
| senderId | string | Delegate action sender |
| receiverId | string | Contract called |
| status | string | pending/completed/failed |
| gasUsed | string | Gas consumed |
| createdAt | date | |

### relayerKey

| Field | Type | Description |
|---|---|---|
| id | string | Singleton per network |
| accountId | string | Implicit NEAR account ID |
| encryptedPrivateKey | string | AES-256-GCM encrypted, base64 |
| iv | string | Initialization vector, base64 |
| publicKey | string | ed25519:base64 format |
| network | string | mainnet/testnet |
| createdAt | date | |
| lastUsedAt | date | Updated on each relay |

## API Reference

### Client Actions — `authClient.near`

**SIWN**
- `nonce(params)` — Request a nonce from the server
- `verify(params)` — Verify an auth token with the server
- `getProfile(accountId?)` — Get user profile (FastNear KV → NEAR Social fallback)
- `getAccountId()` — Currently connected account ID
- `getState()` — Current wallet state
- `disconnect()` — Disconnect wallet and clear cached data
- `link(callbacks?)` — Link a NEAR account to the current session
- `unlink(params)` — Unlink a NEAR account
- `listAccounts()` — List all linked NEAR accounts

**Relay**
- `buildSignedDelegateAction({ receiverId, actions })` — Build + sign a delegate action via wallet FAK
- `relayTransaction({ signedDelegateAction })` — Submit a signed delegate action to the relayer
- `getRelayStatus(txHash)` — Check relayed transaction status

### `authClient.requestSignIn`
- `near(callbacks?)` — Connect wallet and cache nonce (two-step flow)

### `authClient.signIn`
- `near(callbacks?)` — Sign message and authenticate (single-step or two-step)

### Callback Interface

```typescript
interface AuthCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error & { status?: number; code?: string }) => void;
}
```

### Error Codes

| Code | Description |
|---|---|
| `SIGNER_NOT_AVAILABLE` | NEAR wallet not available |
| `WALLET_NOT_CONNECTED` | Wallet not connected before signing |
| `ACCOUNT_MISMATCH` | Cached nonce doesn't match current account |
| `UNAUTHORIZED_NONCE_REPLAY` | Nonce already used |
| `UNAUTHORIZED_INVALID_SIGNATURE` | Invalid signature verification |

### Server Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/near/nonce` | Generate nonce for signing |
| POST | `/near/verify` | Verify NEP-413 signature, create session |
| POST | `/near/profile` | Get NEAR profile |
| POST | `/near/link-account` | Link NEAR account to session |
| POST | `/near/unlink-account` | Unlink NEAR account |
| GET | `/near/list-accounts` | List linked NEAR accounts |
| POST | `/near/relay` | Relay a signed delegate action on-chain |
| GET | `/near/relay-status/:txHash` | Check relayed transaction status |
| GET | `/near/relayer-info` | Get relayer accountId, mode, balance |

## Advanced Configuration

```ts title="advanced-auth.ts"
import { betterAuth } from "better-auth";
import { siwn } from "better-near-auth";
import { generateNonce } from "near-sign-verify";

const usedNonces = new Set<string>();

export const auth = betterAuth({
  plugins: [
    siwn({
      recipient: "myapp.com",
      anonymous: false,
      emailDomainName: "myapp.com",
      requireFullAccessKey: false,

      getNonce: async () => generateNonce(),

      validateNonce: (nonce: Uint8Array) => {
        const nonceHex = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
        if (usedNonces.has(nonceHex)) return false;
        usedNonces.add(nonceHex);
        return true;
      },

      validateRecipient: (recipient: string) => {
        return ["myapp.com", "staging.myapp.com"].includes(recipient);
      },

      validateMessage: (message: string) => {
        return message.includes("Sign in to") && message.length > 10;
      },

      getProfile: async (accountId) => {
        try {
          const res = await fetch(`https://api.myapp.com/profiles/${accountId}`);
          if (res.ok) {
            const p = await res.json();
            return { name: p.displayName, description: p.bio, image: { url: p.avatar } };
          }
        } catch {}
        return null;
      },

      validateLimitedAccessKey: async ({ accountId, publicKey, recipient }) => {
        const allowed = ["myapp.near", "social.near"];
        return recipient ? allowed.includes(recipient) : true;
      },

      fastnearApiKey: process.env.FASTNEAR_API_KEY,

      relayer: {
        accountId: "relayer.myapp.near",
        privateKey: process.env.RELAYER_PRIVATE_KEY,
        whitelistedContracts: ["myapp.near"],
        maxGasPerTransaction: "300000000000000",
        maxDepositPerTransaction: "0",
      },
    }),
  ],
});
```

## Network Support

The plugin detects the network from the account ID:

- Accounts ending with `.testnet` → testnet
- All other accounts → mainnet

## Security

### NEP-413 Compliance
- Proper nonce handling prevents replay attacks
- Message format and recipient validation
- 15-minute server-side nonce expiration, 5-minute client-side cache

### Relayer Key Security
- Ephemeral private key encrypted at rest with AES-256-GCM
- KEK derived from `BETTER_AUTH_SECRET` via HKDF-SHA256
- Private key held only in process memory — never in env vars or config files
- Trust model matches Better Auth session tokens: DB access + secret = full access

### Access Key Support
- Full access keys and function-call access keys (FAK)
- FAK scoped to recipient contract for delegate actions
- Configurable validation for limited access keys

## Troubleshooting

| Issue | Solution |
|---|---|
| "Wallet not connected" | Call `requestSignIn.near()` before `signIn.near()` |
| "No valid nonce found" | Ensure `requestSignIn.near()` completed; client nonces expire after 5 min |
| "Invalid or expired nonce" | Server nonces expire after 15 min; check clock sync |
| "Account ID mismatch" | Verify signed message account ID matches wallet |
| "Network ID mismatch" | Ensure networkId matches the account's network |
| Relay fails with "insufficient balance" | Fund the relayer account with NEAR |
| Relay fails with "contract not whitelisted" | Add `receiverId` to `whitelistedContracts` |

## Examples

### Browser to Server Example

A full-stack example showing NEAR authentication + gasless relay.

- **Location**: `examples/browser-2-server/`
- **Live Demo**: [better-near-auth.near.page](https://better-near-auth.near.page)
- **Tech Stack**: Hono, Drizzle ORM, React, TanStack Router

```bash
# From repo root
pnpm install
cd examples/browser-2-server
pnpm dev
```

## Development

Interested in contributing? See [CONTRIBUTING.md](./CONTRIBUTING.md).

**Quick start:**
```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

**Build output:**
- `dist/index.js` — Server plugin (ESM)
- `dist/client.js` — Client plugin (ESM)
- `dist/*.d.ts` — TypeScript declarations

## Links

- [Better Auth Documentation](https://better-auth.com)
- [NEAR Protocol](https://near.org)
- [NEP-413 Specification](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [NEP-366 Delegate Actions](https://github.com/near/NEPs/blob/master/neps/nep-0366.md)
- [FastNear](https://fastnear.com)
- [near-sign-verify](https://github.com/elliotBraem/near-sign-verify)
- [Example Implementation](https://better-near-auth.near.page)
- [Contributing Guide](./CONTRIBUTING.md)
