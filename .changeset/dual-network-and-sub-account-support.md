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

## Sub-account parent account separation

- **`parentAccount` on `RelayerInfo`**: Server reports which named account owns sub-accounts, so the client can display it without guessing
- **`subAccountAvailable` on `RelayerInfo`**: Boolean flag — `false` when the parent would be an implicit (hex) account or when no relayer is configured. UI can show a clear "not configured" state instead of a broken form
- **`parentKey` on `SubAccountConfig`**: Allows the parent account and relayer to differ. Uses near-kit's `.signWith(parentKey)` so the transaction is signed by the parent while the relayer submits it
- **Implicit account rejection**: `isImplicitAccount()` and `resolveParentAccount()` prevent `testing.89d3b16ea6d0...` garbage sub-account names by rejecting hex-only parent account IDs at both `createSubAccount` and `checkSubAccountAvailability` endpoints

## Network toggle wallet bug fix

- **Disconnect on switch**: `setNetwork()` now disconnects the previous network's wallet connector and clears `walletConnected`/`nearState` when switching between mainnet and testnet. Previously, the shared `"selected-wallet"` localStorage key caused `getConnectedWallet()` to return stale mainnet data after toggling to testnet, silently signing on the wrong network
- **Account/network validation**: `signWithWallet()` now checks that a connected wallet's account domain matches the active network (`*.testnet` for testnet, anything else for mainnet) and treats mismatches as disconnected, forcing a fresh wallet popup

## Breaking changes

- **`getRelayerInfo` → POST**: Changed from GET to POST with optional `{ network }` body. Update any direct API calls.

## Other changes

- `RelayerState` now includes `publicKey`
- `RelayerInfo` response includes `publicKey`, `parentAccount`, and `subAccountAvailable` fields
- Server validates sub-account names: `^[a-z0-9]+$`