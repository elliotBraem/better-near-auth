---
"better-near-auth": patch
---

Fix relayer info to report against the runtime network instead of the signed-in user's NEAR account network, and make relayer state caching network-aware so funded relayers are reported correctly in the UI.

Also add regression coverage for runtime-network relayer info and fix first-use ephemeral relayer metadata initialization in tests.
