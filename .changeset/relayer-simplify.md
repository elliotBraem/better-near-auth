---
"better-near-auth": patch
---

feat: collapse relayer config into a single shape with per-network secrets

- Replace the `RelayerEphemeralConfig | RelayerExplicitConfig | RelayerDualNetworkConfig | true` union with a single flat `RelayerConfig` interface. The relayer mode is now determined at runtime by whether `accountId` is set.
- Always use the dual-network shape (`{ mainnet, testnet }`) — each entry may be omitted.
- Remove `privateKeys` (the rotation-array field). Key rotation is no longer exposed in the public API; the SIWN plugin uses a single key.
- Add a warning when `accountId` is set but `privateKey` is missing (previously fell silently back to ephemeral mode).

**Breaking changes**

- `SIWNPluginOptions.relayer` no longer accepts `true` as a shorthand, `ephemeral?: true` marker, or `accountId?: never`/`privateKey?: never` from the previous `RelayerEphemeralConfig`. Pass a `RelayerConfig` (with or without `accountId`) or a `RelayerDualNetworkConfig` instead.
- The flat per-network `RelayerConfig` interface replaces `RelayerEphemeralConfig` and `RelayerExplicitConfig`. `RelayerEphemeralConfig` and `RelayerExplicitConfig` are no longer exported; type narrowings on those names need to switch to `RelayerConfig`.
- `privateKeys` is no longer a supported field. Applications using key rotation need to manage rotation outside of this plugin.

Hosts passing per-network relayer keys via env vars should rename `NEAR_RELAYER_PRIVATE_KEY` to `NEAR_RELAYER_PRIVATE_KEY_MAINNET` and `NEAR_RELAYER_PRIVATE_KEY_TESTNET` (one per network).
