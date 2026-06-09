---
"better-near-auth": patch
"@examples/auth.everything.dev": patch
---

**Fix type inference for auth client plugin**

### better-near-auth
- Fixed `siwnClient` return type to explicitly use `SIWNClientPlugin` interface instead of `satisfies BetterAuthClientPlugin`, ensuring proper `$InferServerPlugin` type inference
- Updated `auth-export.ts` to export the specific `Auth` instance type (`ReturnType<typeof createAuthInstance>`) instead of the generic `better-auth` type, which fixes `inferAdditionalFields` type inference

### @examples/auth.everything.dev
- Added type-safe `isRecipientsConfig` type guard for `AuthSiwnConfig` narrowing
- Fixed `buildSiwnOptions` to include `testnet` subAccount configuration in both recipient and recipients config paths
- Removed unused `assetsUrl` from `_layout.tsx` `beforeLoad` return type
- Added proper `PrivateData` and `RelayerData` type definitions inferred from API contract and `better-near-auth` exports
- Fixed `auth-types.gen.ts` to import `BaseAuth` correctly

These changes resolve the `Property 'near' does not exist` type errors by ensuring the plugin's server type metadata flows correctly through the client type system.