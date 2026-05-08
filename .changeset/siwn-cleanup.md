---
"better-near-auth": patch
---

Remove process.env fallbacks in initRelayer, add rpcUrl to SIWNPluginOptions, and keep explicit BetterAuthPlugin return type to avoid TS2742 build errors in downstream consumers.
