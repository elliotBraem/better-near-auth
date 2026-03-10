---
"better-near-auth": patch
---

Fix wallet selection bug in signIn.near() method

- Fixed "No accounts found" error when calling signIn.near() without prior wallet connection
- Now properly shows wallet selector and determines authentication flow based on selected wallet's capabilities
- Fixed feature detection to check `signInAndSignMessage` instead of `signMessage` for single-step flow
- Automatically uses single-step flow for wallets with signInAndSignMessage support
- Automatically falls back to two-step flow for wallets without signInAndSignMessage support
- Improved user experience by letting users select any wallet first
- HOT wallet now correctly falls back to two-step flow (has signMessage but not signInAndSignMessage)
