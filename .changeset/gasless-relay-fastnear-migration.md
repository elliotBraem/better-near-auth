---
"better-near-auth": minor
---

Add gasless relay (NEP-366), replace @hot-labs/near-connect with @fastnear/wallet, and add `authClient.near.wallet` passthrough

- **Gasless relay**: Server relays signed delegate actions on-chain, paying gas from an auto-generated ephemeral keypair (encrypted in DB). New endpoints: `/near/relay`, `/near/relay-status/:txHash`, `/near/relayer-info`. New client methods: `buildSignedDelegateAction`, `relayTransaction`, `getRelayStatus`.
- **Wallet passthrough**: `authClient.near.wallet` exposes the full `@fastnear/wallet` API (connect, sendTransaction, signMessage, etc.) without wrapping each method.
- **Dependency swap**: `@hot-labs/near-connect` → `@fastnear/wallet`, `near-kit` → `@fastnear/api` + `@noble/curves` + `borsh`.
- **BigInt fix**: Delegate action gas/deposit now passed as strings to avoid `JSON.stringify` BigInt error.
- **Profile**: FastNear KV primary, NEAR Social fallback.
- **`requireFullAccessKey`** default changed from `true` to `false`.
- **Guestbook example**: Toggle between gasless relay and direct wallet send.
