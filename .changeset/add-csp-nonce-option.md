---
"better-near-auth": minor
---

Add `cspNonce` option to `SIWNClientConfig` for sites with nonce-based Content Security Policy

When the parent page uses nonce-based CSP (e.g. `script-src 'nonce-abc123'`), the `srcdoc` iframe's inline `<script>` tags are blocked because they have no `nonce` attribute. Pass `cspNonce` to propagate the parent's nonce into the wallet iframe so scripts execute correctly:

```ts
const client = siwnClient({
  recipient: "your-app.near",
  cspNonce: document.querySelector("script[nonce]")?.getAttribute("nonce") ?? undefined,
});
```