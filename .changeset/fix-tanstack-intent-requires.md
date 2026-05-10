---
"better-near-auth": patch
---

Fix TanStack Intent skill validation error by adding `requires` field to `tanstack` framework skill

The `skills/tanstack/SKILL.md` was missing the required `requires` array for `type: framework` skills, which caused `npx @tanstack/intent@latest validate` to fail with:

> Framework skills must have a "requires" field

This prevented the package from being properly indexed on the TanStack Intent Agent Skills Registry. Added:

```yaml
requires:
  - client
  - siwn
```

These dependencies are correct because the TanStack Router integration builds directly on the client-side `siwnClient` plugin (client skill) and the server-side SIWN authentication (siwn skill) must be configured for any of the auth flows to work.
