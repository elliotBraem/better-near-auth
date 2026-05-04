---
"better-near-auth": patch
---

Fix base58/base64 encoding bugs and wallet connection issues

- Fix relayer key recovery: `parseKey` now uses `base58.encode` instead of `bytesToBase64`, and private key extraction uses `base58.decode` instead of `hexToBytes` — both were producing corrupted keys that crashed on server restart with "Unknown letter: +" base58 errors
- Fix nonce endpoint encoding: `/near/nonce` now returns hex-encoded nonces matching the verify endpoint's `hex.decode`
- Fix "No wallet selected" error: `connector.getConnectedWallet()` now caught gracefully so the `connector.connect()` wallet picker path is reached
- Fix "Not authenticated" after page refresh: `nearState` atom now auto-restores from persisted wallet connection on init
- Fix unfunded relayer crash: `/near/relayer-info` returns zero-balance defaults instead of throwing `AccountDoesNotExistError`
- Add `getRelayerInfo()` client action for relayer balance/account monitoring
- Fix example guestbook `buildSignedDelegateAction` call signature
