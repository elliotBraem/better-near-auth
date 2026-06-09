---
"better-near-auth": patch
---

Clean up redundant type assertions and schema handling

- Remove all `as` casts on `safeAuthApi` results where the generic already infers the type
- Replace manual hex encoding in `hashNonce` with `hex.encode`
- Merge duplicate `./types.js` imports
- Remove redundant return type annotations on `client.ts` action functions
- Remove unused `UserWithAnonymous`, `User`, `InferOutput`, `apiKeySchema` imports
- Fix `getSiwnNonce` handler indentation
- Add `NearState` type alias to deduplicate state shape
