---
"better-near-auth": patch
---

fix: replace client: NearType with getNearClient() to fix better-auth type inference

The `client` getter caused TypeScript's UnionToIntersection to exceed the
instantiation depth limit when better-auth merged plugin actions, preventing
all client-only methods (detectNearAccount, getAccountId, isWalletConnected,
etc.) from appearing in the inferred type.

Replaced `client: NearType` with `getNearClient(): NearType` on the near
namespace. Also added `detectNearAccount()` for silent wallet detection on
login pages, and declared `@better-auth/core` as a peer dependency to prevent
duplicate package resolution when linking the package locally.

BREAKING CHANGE: `auth.near.client` is no longer available. Use
`auth.near.getNearClient()` instead.
