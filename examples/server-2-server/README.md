# Server-to-Server Authentication Example

This example demonstrates **federated server-to-server authentication** using NEAR keypairs with `better-near-auth`.

## Architecture

```bash
┌─────────────────┐                    ┌─────────────────┐
│    Server 1     │◄──────────────────►│    Server 2     │
│   (port 3000)   │   NEAR KeyPair     │   (port 3002)   │
│                 │   Authentication   │                 │
│ NEAR_ACCOUNT=   │                    │ NEAR_ACCOUNT=   │
│ server1.testnet │                    │ server2.testnet │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │        ┌─────────────────┐          │
         └────────┤  @s2s/plugin    ├──────────┘
                  │ (shared plugin) │
                  └─────────────────┘
```

Both servers mount the **same shared plugin** (`@s2s/plugin`) with different environment variables. The plugin provides:

- NEAR keypair authentication to target servers
- Federated API endpoints (ping, callTarget, getIdentity)

## How It Works

1. Each server initializes the `@s2s/plugin` with its NEAR keypair and target server URL
2. The plugin uses `better-near-auth/server` to authenticate (nonce → sign → verify)
3. Authenticated requests are made with Bearer tokens
4. Both servers can call each other's protected endpoints

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

```bash
cp apps/server-1/.env.example apps/server-1/.env
cp apps/server-2/.env.example apps/server-2/.env
```

Add your NEAR keypairs (testnet recommended for development).

### 3. Run database migrations

```bash
bun run db:migrate
```

### 4. Start both servers

```bash
bun run dev
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/rpc/health
# {"status":"ok","server":"server-1"}
```

### Get Server Identity
```bash
curl http://localhost:3000/rpc/federated/identity
# {"accountId":"server1.testnet","publicKey":"ed25519:...","networkId":"testnet"}
```

### Call Target Server
```bash
curl -X POST http://localhost:3000/rpc/federated/call-target \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/federated/ping"}'
# {"calledFrom":"server-1","targetResponse":{...}}
```

## Project Structure

```
apps/
├── server-1/
│   └── src/
│       └── lib/
│           ├── plugins.ts    # Plugin initialization with server-1 config
│           └── auth.ts       # Better Auth with SIWN + bearer
│       └── routers/
│           └── index.ts      # Mounts @s2s/plugin router
├── server-2/
│   └── src/
│       └── lib/
│           ├── plugins.ts    # Plugin initialization with server-2 config
│           └── auth.ts       # Better Auth with SIWN + bearer
│       └── routers/
│           └── index.ts      # Mounts @s2s/plugin router
packages/
└── plugin/                   # @s2s/plugin - shared federated plugin
    └── src/
        ├── index.ts          # Plugin definition
        ├── contract.ts       # oRPC contract
        └── service.ts        # FederatedService using better-near-auth/server
```

## Using better-near-auth/server

The plugin uses `createServerClient` from `better-near-auth/server`:

```typescript
import { createServerClient } from "better-near-auth/server";

const client = await createServerClient({
  accountId: "server1.testnet",
  privateKey: "ed25519:...",
  targetServerUrl: "http://localhost:3002",
  recipient: "better-near-auth.near",
});

// Make authenticated requests
const response = await client.fetch("/rpc/federated/ping");

// Access the Near instance for blockchain operations
const balance = await client.near.getBalance("alice.near");
```
