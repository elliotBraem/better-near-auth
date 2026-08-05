---
"better-near-auth": minor
---

feat: add detectNearAccount() for silent wallet detection

Add `detectNearAccount()` method to the client SIWN actions that silently
probes for a previously authorized NEAR wallet across all supported networks
without prompting the user. Returns the account info or null.

Also adds a wallet detection prompt to the example login page and documents
the method in the client skill.
