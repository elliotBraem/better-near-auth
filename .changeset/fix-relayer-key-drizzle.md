---
"better-near-auth": patch
---

Fix Drizzle adapter error when creating ephemeral relayer key

- Removed explicit `id` field from `relayerKey` creation in `initRelayer()` to resolve the Drizzle Adapter warning/error: "You are trying to create a record with an id. This is not allowed as we handle id generation for you."
- Updated `relayNearTransaction` to query `relayerKey` by `network` instead of the removed hardcoded `id`.
