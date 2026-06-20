---
"better-near-auth": patch
---

Fix login for non-.near NEAR accounts (.tg, .testnet, subaccounts, implicit accounts) by falling back to a temp-{random}@{recipient} email instead of an empty string that collides on the UNIQUE constraint
