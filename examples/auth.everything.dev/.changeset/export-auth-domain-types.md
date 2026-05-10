---
"@everything-dev/auth-plugin": minor
---

Export contract-derived auth domain and input types from `auth-export.ts`, including canonical session, request context, organization, member, invitation, and API key shapes. This lets downstream generated auth type barrels re-export the plugin's auth types directly instead of reconstructing local aliases.
