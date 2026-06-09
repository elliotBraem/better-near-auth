---
"better-near-auth": patch
---

**Fix type inference for auth client plugin**

- Fixed `siwnClient` return type to explicitly use `SIWNClientPlugin` interface instead of `satisfies BetterAuthClientPlugin`, ensuring proper `$InferServerPlugin` type inference
- Updated `auth-export.ts` to export the specific `Auth` instance type (`ReturnType<typeof createAuthInstance>`) instead of the generic `better-auth` type, which fixes `inferAdditionalFields` type inference

These changes resolve the `Property 'near' does not exist` type errors by ensuring the plugin's server type metadata flows correctly through the client type system.

### Auth Plugin Changes
- Added `isRecipientsConfig` type guard for proper `AuthSiwnConfig` narrowing
- Fixed `buildSiwnOptions` to use type-safe narrowing instead of `in` operator checks
- Added `testnet` subAccount configuration to single-recipient config path
- Fixed `createAuthInstance` recipient resolution to use the type guard