---
"better-near-auth": minor
---

## Dual network (mainnet/testnet) support

- **`recipients` option**: New `DualNetworkConfig<string>` pattern for `recipient`, `relayer`, and `rpcUrl` — pass `{ mainnet: "app.near", testnet: "app.testnet" }` to enable both networks. Backwards compatible: `recipient: "app.near"` still works for single-network setups.
- **`relayer` per-network**: Accepts `{ mainnet: RelayerConfig, testnet: RelayerConfig }` for independent relayer keys per network.
- **`rpcUrl` per-network**: Accepts `{ mainnet: "...", testnet: "..." }` for different RPC endpoints per network.
- **Client network switching**: `near.setNetwork()`, `near.getNetwork()`, `near.getSupportedNetworks()`, `near.getRecipient(network?)`. Lazily initializes a `Near` + wallet connector per network.
- **`activeNetwork` atom**: Exposed via `getAtoms()` for reactive UI tracking.

## Sub-account creation via relayer

- **`POST /near/create-sub-account`**: Authenticated users can create `username.parent.near` sub-accounts via the relayer
- **`POST /near/check-sub-account-availability`**: Check if a sub-account name is available on-chain (no auth required)
- Client-side keypair generation (`generateKey()`) — private key never touches the server
- Transaction includes `createAccount`, `addKey` (user's FAK), and `transfer` (minimum deposit)
- Optional FCAK for the relayer: `subAccount.addRelayerFCAK` + `relayerFCAK: { receiverId, methodNames?, allowance? }` for scoped Function Call Access Key
- New `SubAccountConfig` type per-network
- New client actions: `near.createSubAccount()`, `near.checkSubAccountAvailability()`

## Breaking changes

- **`getRelayerInfo` → POST**: Changed from GET to POST with optional `{ network }` body. Update any direct API calls.

## Other changes

- `RelayerState` now includes `publicKey`
- `RelayerInfo` response includes `publicKey` field
- Server validates sub-account names: `^[a-z0-9]+$`