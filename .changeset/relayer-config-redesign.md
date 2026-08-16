---
"better-near-auth": minor
---

feat: redesign relayer configuration with true shorthand and per-network support

- Add `relayer: true` shorthand for ephemeral mode (simplest API)
- Support per-network relayer configs (`{ mainnet, testnet }`)
- Strengthen Zod schema validation for relayer configs
- Fix bug in buildRelayerConfig() that prevented ephemeral mode from initializing
- Add startup warnings for relayer initialization failures
- Update documentation with new configuration examples
