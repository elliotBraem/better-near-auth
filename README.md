<!-- markdownlint-disable MD014 -->
<!-- markdownlint-disable MD033 -->
<!-- markdownlint-disable MD041 -->
<!-- markdownlint-disable MD029 -->

<div align="center">

<h1 style="font-size: 2.5rem; font-weight: bold;">better-near-auth</h1>

  <p>
    <strong>Sign in with NEAR (SIWN) plugin for better-auth</strong>
  </p>

</div>

This [Better Auth](https://better-auth.com) plugin enables secure authentication via NEAR wallets and keypairs by following the [NEP-413 standard](https://github.com/near/NEPs/blob/master/neps/nep-0413.md). It leverages [near-sign-verify](https://github.com/elliotBraem/near-sign-verify) and [fastintear](https://github.com/elliotBraem/fastintear) to provide a complete drop-in solution with session management, secure defaults, and automatic profile integration.

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
                anonymous: true, // optional, default is true
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
                domain: "myapp.com", // this doesn't actually do anything yet... taking suggestions
                networkId: "mainnet", // optional, default is "mainnet"
            })
        ],
    });
    ```

## Usage

### Two-Step Authentication Flow

The plugin uses a secure two-step authentication process:

1. **Step 1**: Connect wallet and cache nonce
2. **Step 2**: Sign message and authenticate

```ts title="two-step-auth.ts"
// Step 1: Connect wallet and get nonce
await authClient.requestSignIn.near(
  { recipient: "myapp.com" },
  {
    onSuccess: () => {
      console.log("Wallet connected, nonce cached!");
    },
    onError: (error) => {
      console.error("Wallet connection failed:", error.message);
    }
  }
);

// Step 2: Sign message and authenticate
await authClient.signIn.near(
  { recipient: "myapp.com" },
  {
    onSuccess: () => {
      console.log("Successfully signed in!");
    },
    onError: (error) => {
      console.error("Sign in failed:", error.message);
    }
  }
);
```

### Complete React Component Example

```tsx title="LoginButton.tsx"
import { authClient } from "./auth-client";
import { useState } from "react";

export function LoginButton() {
  const { data: session } = authClient.useSession();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  // Get account ID from embedded fastintear client
  const accountId = authClient.near.getAccountId();

  if (session) {
    return (
      <div>
        <p>Welcome, {session.user.name}!</p>
        <button onClick={() => authClient.signOut()}>Sign out</button>
      </div>
    );
  }

  const handleWalletConnect = async () => {
    setIsConnectingWallet(true);
    
    try {
      await authClient.requestSignIn.near(
        { recipient: "myapp.com" },
        {
          onSuccess: () => {
            setIsConnectingWallet(false);
            console.log("Wallet connected!");
          },
          onError: (error) => {
            setIsConnectingWallet(false);
            console.error("Wallet connection failed:", error.message);
          },
        }
      );
    } catch (error) {
      setIsConnectingWallet(false);
      console.error("Authentication error:", error);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    
    try {
      await authClient.signIn.near(
        { recipient: "myapp.com" },
        {
          onSuccess: () => {
            setIsSigningIn(false);
            console.log("Successfully signed in!");
          },
          onError: (error) => {
            setIsSigningIn(false);
            console.error("Sign in failed:", error.message);
          },
        }
      );
    } catch (error) {
      setIsSigningIn(false);
      console.error("Authentication error:", error);
    }
  };

  return (
    <div>
      {!accountId ? (
        <button onClick={handleWalletConnect} disabled={isConnectingWallet}>
          {isConnectingWallet ? "Connecting..." : "Connect NEAR Wallet"}
        </button>
      ) : (
        <button onClick={handleSignIn} disabled={isSigningIn}>
          {isSigningIn ? "Signing in..." : `Sign in with NEAR (${accountId})`}
        </button>
      )}
    </div>
  );
}
```

### Profile Access

Access user profiles from NEAR Social automatically:

```ts title="profile-usage.ts"
// Get current user's profile (requires authentication)
const myProfile = await authClient.near.getProfile();
console.log("My profile:", myProfile);

// Get specific user's profile (no auth required)
const aliceProfile = await authClient.near.getProfile("alice.near");
console.log("Alice's profile:", aliceProfile);
```

### Wallet Management

```ts title="wallet-management.ts"
// Check if wallet is connected
const accountId = authClient.near.getAccountId();
console.log("Connected account:", accountId);

// Get the embedded NEAR client
const nearClient = authClient.near.getNearClient();

// Disconnect wallet and clear cached data
await authClient.near.disconnect();
```

## Configuration Options

### Server Options

The SIWN plugin accepts the following configuration options:

* **recipient**: The recipient identifier for NEP-413 messages (required)
* **anonymous**: Whether to allow anonymous sign-ins without requiring an email. Default is `true`
* **emailDomainName**: The email domain name for creating user accounts when not using anonymous mode. Defaults to the recipient value
* **requireFullAccessKey**: Whether to require full access keys. Default is `true`
* **getNonce**: Function to generate a unique nonce for each sign-in attempt. Optional, uses secure defaults
* **validateNonce**: Function to validate nonces. Optional, uses time-based validation by default
* **validateRecipient**: Function to validate recipients. Optional, uses exact match by default
* **validateMessage**: Function to validate messages. Optional, no validation by default
* **getProfile**: Function to fetch user profiles. Optional, uses NEAR Social by default
* **validateLimitedAccessKey**: Function to validate function call access keys when `requireFullAccessKey` is false

### Client Options

The SIWN client plugin accepts the following configuration options:

* **domain**: Domain identifier... idk what it should do yet. Maybe shade agent.
* **networkId**: NEAR network to use ("mainnet" or "testnet"). Default is "mainnet"

```ts title="auth-client.ts"
import { createAuthClient } from "better-auth/client";
import { siwnClient } from "better-near-auth/client";

export const authClient = createAuthClient({
  plugins: [
    siwnClient({
      domain: "myapp.com",
      networkId: "testnet", // Use testnet
    }),
  ],
});
```

## Schema

The SIWN plugin adds a `nearAccount` table to store user NEAR account associations:

| Field     | Type    | Description                               |
| --------- | ------- | ----------------------------------------- |
| id        | string  | Primary key                               |
| userId    | string  | Reference to user.id                      |
| accountId | string  | NEAR account ID                           |
| network   | string  | Network (mainnet or testnet)              |
| publicKey | string  | Associated public key                     |
| isPrimary | boolean | Whether this is the user's primary account|
| createdAt | date    | Creation timestamp                        |

## API Reference

### Client Actions

The client plugin provides the following actions:

#### `authClient.near`

- `nonce(params)` - Request a nonce from the server
- `verify(params)` - Verify an auth token with the server
- `getProfile(accountId?)` - Get user profile from NEAR Social
- `getNearClient()` - Get the embedded fastintear client
- `getAccountId()` - Get the currently connected account ID
- `disconnect()` - Disconnect wallet and clear cached data

#### `authClient.requestSignIn`

- `near(params, callbacks?)` - Connect wallet and cache nonce (Step 1)

#### `authClient.signIn`

- `near(params, callbacks?)` - Sign message and authenticate (Step 2)

### Callback Interface

```typescript
interface AuthCallbacks {
  onSuccess?: () => void;
  onError?: (error: Error & { status?: number; code?: string }) => void;
}
```

### Error Codes

Common error codes you may encounter:

- `SIGNER_NOT_AVAILABLE` - NEAR wallet not available
- `WALLET_NOT_CONNECTED` - Wallet not connected before signing
- `NONCE_NOT_FOUND` - No valid cached nonce found
- `ACCOUNT_MISMATCH` - Cached nonce doesn't match current account
- `UNAUTHORIZED_INVALID_OR_EXPIRED_NONCE` - Server nonce expired or invalid

## Advanced Configuration

For advanced use cases, you can customize the validation functions:

```ts title="advanced-auth.ts"
import { betterAuth } from "better-auth";
import { siwn } from "better-near-auth";
import { generateNonce } from "near-sign-verify";

const usedNonces = new Set<string>();

export const auth = betterAuth({
  plugins: [
    siwn({
      recipient: "myapp.com",
      anonymous: false, // Require email for users
      emailDomainName: "myapp.com",
      requireFullAccessKey: false, // Allow function call keys
      
      // Custom nonce generation
      getNonce: async () => {
        return generateNonce();
      },
      
      // Custom nonce validation (prevents replay attacks)
      validateNonce: (nonce: Uint8Array) => {
        const nonceHex = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');
        if (usedNonces.has(nonceHex)) {
          return false; // Prevent replay attacks
        }
        usedNonces.add(nonceHex);
        return true;
      },
      
      // Custom recipient validation (allow multiple domains)
      validateRecipient: (recipient: string) => {
        const allowedRecipients = ["myapp.com", "staging.myapp.com", "localhost:3000"];
        return allowedRecipients.includes(recipient);
      },
      
      // Custom message validation
      validateMessage: (message: string) => {
        // Add custom message format validation
        return message.includes("Sign in to") && message.length > 10;
      },
      
      // Custom profile lookup
      getProfile: async (accountId) => {
        // Custom profile logic, falls back to NEAR Social
        try {
          const response = await fetch(`https://api.myapp.com/profiles/${accountId}`);
          if (response.ok) {
            const customProfile = await response.json();
            return {
              name: customProfile.displayName,
              description: customProfile.bio,
              image: { url: customProfile.avatar },
            };
          }
        } catch (error) {
          console.error("Custom profile fetch failed:", error);
        }
        return null; // Use default NEAR Social lookup
      },
      
      // Validate function call keys against allowed contracts
      validateLimitedAccessKey: async ({ accountId, publicKey, recipient }) => {
        const allowedContracts = ["myapp.near", "social.near"];
        return recipient ? allowedContracts.includes(recipient) : true;
      },
    }),
  ],
});
```

## Network Support

The plugin automatically detects the network from the account ID:

- Accounts ending with `.testnet` use the testnet network
- All other accounts use the mainnet network

You can configure the client to use a specific network:

```ts title="testnet-config.ts"
export const authClient = createAuthClient({
  plugins: [
    siwnClient({
      domain: "myapp.com",
      networkId: "testnet", // Use testnet
    }),
  ],
});
```

## Security Features

### NEP-413 Compliance
- Follows NEAR Enhancement Proposal 413 for secure message signing
- Implements proper nonce handling to prevent replay attacks
- Validates message format and recipient information

### Nonce Management
- Unique nonce storage per account/network/publicKey combination
- 15-minute server-side expiration for nonces
- 5-minute client-side cache expiration
- Automatic cleanup after successful authentication

### Access Key Support
- Supports both full access keys and function call access keys
- Configurable validation for limited access keys
- Contract-specific access control when using function call keys

## Troubleshooting

### Common Issues

1. **"Wallet not connected"**
   - You must call `requestSignIn.near()` before `signIn.near()`
   - Check that the embedded fastintear client is properly initialized

2. **"No valid nonce found"**
   - Ensure `requestSignIn.near()` completed successfully before calling `signIn.near()`
   - Client nonces expire after 5 minutes

3. **"Invalid or expired nonce"**
   - Server nonces expire after 15 minutes
   - Ensure client and server clocks are synchronized

4. **"Account ID mismatch"**
   - Verify the signed message contains the correct account ID
   - Check for wallet switching between the two authentication steps

5. **"Network ID mismatch"**
   - Ensure the networkId sent to the server matches the account's network
   - Testnet accounts must use "testnet", mainnet accounts use "mainnet"


## Links

* [Better Auth Documentation](https://better-auth.com)
* [NEAR Protocol](https://near.org)
* [NEP-413 Specification](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
* [near-sign-verify](https://github.com/elliotBraem/near-sign-verify)
* [fastintear](https://github.com/elliotBraem/fastintear)
* [Example Implementation](https://better-near-auth.near.page)
