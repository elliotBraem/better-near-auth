# 1.1.4

- **New `addFunctionCallKey({ contractId, methodNames, allowance, network, signerId })`
  export.** Wraps the underlying `NearConnector.addFunctionCallKey` from
  `@fastnear/near-connect@^0.12.1`. The wallet executor generates a fresh
  keypair locally, the user approves an `AddKey` transaction (one popup),
  and the private key is stored under `functionCallKey:<contractId>` so
  subsequent zero-deposit function calls to that contract sign silently.
  Routes through the per-network slot — `network` is optional and falls
  back to the active network.
- Use case this unlocks: a page can `connect({ contractId: "a.near" })` to
  set up a session-key sign-in for one contract, then call
  `nearWallet.addFunctionCallKey({ contractId: "b.near", methodNames: [...] })`
  immediately afterwards (e.g., from an `onConnect` listener) so a second
  contract also gets zero-popup signing — without re-entering the
  sign-in modal. Throws if the connected wallet doesn't implement
  `addFunctionCallKey` (currently MyNearWallet does; injected wallets
  forward to the wallet's own implementation when present).
- Bumps `@fastnear/near-connect` floor to `^0.12.1`. The 0.12.1 release
  closed the silent-mainnet RPC routing bug in MNW for testnet sessions
  and added `DEFAULT_PROVIDERS` on `NearConnector`. No api surface
  changes in `@fastnear/near-connect` itself relevant to consumers.
- Pairs with `@fastnear/api@1.1.4`, metadata-only.

# 1.1.3

- **Bundle fix:** the published 1.1.2 IIFE/UMD bundle inadvertently
  included `@fastnear/near-connect@0.11.2` instead of 0.12.0. The
  workspace lockfile had a stale `@fastnear/near-connect@npm:*`
  resolution pointing at 0.11.2 (recorded before 0.12.0 was published),
  and `yarn install` left it pinned there even after the monorepo's
  root `^0.12.0` resolution was added. Refreshing the lockfile so the
  wildcard collapses onto the same 0.12.0 entry as the root pin makes
  the bundle ship the correct near-connect. The wallet's own
  `package.json` keeps `"@fastnear/near-connect": "*"`; the root
  monorepo `package.json` is the source of truth for the pin.
- Consequence of the 1.1.2 bug: the per-network storage migration
  shipped in near-connect 0.12.0
  (`<walletId>:<key>` → `<walletId>:mainnet:<key>`) was missing from
  the bundle, so existing users with pre-1.1.x localStorage state were
  silently logged out on upgrade. The 1.1.3 bundle restores that
  migration; it runs on first load.
- npm consumers were unaffected (they resolve `*` to the latest
  near-connect at install time, which is 0.12.0 today). This release
  matters specifically for callers loading the IIFE from
  `js.fastnear.com/wallet.js`.
- No API surface changes. Pairs with `@fastnear/api@1.1.3`, also
  metadata-only.

# 1.1.2

- Metadata-only release for `@fastnear/wallet` itself — no source
  changes. The bundle is byte-identical to 1.1.0/1.1.1.
- Pairs with `@fastnear/api@1.1.2`, which closes both seams left
  documented in 1.1.1: api now keeps a per-network account map and
  threads `network` through `sendTx`, `signMessage`, `accountId`,
  `publicKey`, `authStatus`, `selected`, and the recipe wrappers
  (`functionCall`, `transfer`, `signMessage`). The transport layer
  (`sendRpc`, `sendServiceRequest`) and every helper built on top of it
  (`view`, `queryAccount`, `queryBlock`, `queryAccessKey`, `queryTx`,
  `tx.*`, `api.v1.*`, `transfers.*`, `neardata.*`, `fastdata.kv.*`,
  `ft.*`, `nft.*`) accept the same `network` override. All of those
  calls resolve through the wallet's per-network slot — and the per-
  network RPC URL — the same way direct
  `nearWallet.sendTransaction({ network })` /
  `nearWallet.signMessage({ network })` calls do today.
- Recipe catalog (hosted at `js.fastnear.com/recipes.json`) gains a
  `function-call-testnet` recipe that demonstrates the closed loop:
  `near.recipes.connect({ network: "testnet" })` followed by
  `near.recipes.functionCall({ network: "testnet" })` without
  disturbing an active mainnet session.

# 1.1.1

- Metadata-only release for `@fastnear/wallet` itself — no source
  changes. The bundle is byte-identical to 1.1.0.
- Pairs with `@fastnear/api@1.1.1`, which closed the
  `near.recipes.connect({ network })` seam by threading the per-network
  parameter through to the wallet provider's `connect` /
  `disconnect` / `isConnected` calls. Pages using `near.recipes.connect`
  now hit the wallet's per-network code paths the same way direct
  `nearWallet.connect({ network })` calls do.
- Recipe catalog (hosted at `js.fastnear.com/recipes.json`) gained a
  `connect-testnet` recipe that demonstrates the per-network connect
  parameter and `connectedNetworks()` helper.

# 1.1.0

- **Parallel mainnet + testnet sessions.** Internal state (connector,
  connected wallet, current account id) is now keyed by network, so a page
  can hold simultaneous sessions on both networks. Signing in on testnet no
  longer evicts a mainnet session.
- **Optional `network` argument** on `accountId()`, `isConnected()`,
  `walletName()`, `sendTransaction()`, `sendTransactions()`, `signMessage()`,
  `disconnect()`, and `reset()`. Without the argument, calls operate on the
  *active* network — the most recent successful `connect()` / `restore()` —
  so existing single-session callers don't need to change.
- **`connect({ network })` / `restore({ network })`** route to the per-
  network slot. Calling `connect({ network: "testnet" })` while a mainnet
  session is already active just opens a new testnet session alongside it.
- **`ConnectResult.network`** added (non-breaking).
- New helpers `connectedNetworks()` (returns the networks with an active
  session) and `getActiveNetwork()`.
- Requires `@fastnear/near-connect@^0.12.0`. The underlying library handles
  per-network storage namespacing; legacy unscoped keys are migrated to the
  mainnet slot on first load.

# 1.0.2

- Initial public release of the rewritten connector.
