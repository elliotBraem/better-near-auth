# everything.dev skill

## Purpose

Understand and interact with everything.dev as a runtime-composed site on NEAR.

## Core model

- `bos.config.json` is the canonical runtime manifest.
- The host is the runtime shell and trust boundary.
- The UI is loaded at runtime through Module Federation.
- The API is loaded at runtime through `every-plugin`.
- Public metadata may describe the runtime, but should not replace the runtime manifest.

## Bootstrap flow

- Publish the root `bos.config.json` first at `dev.everything.near/everything.dev`.
- The root record should not extend anything while it is the bootstrap source of truth.
- After that root is live, other configs can extend it with `bos://dev.everything.near/everything.dev`.
- `domain` is the public open-app URL; use it for app launch links, not `hostUrl`.

## Useful assumptions

- The bootstrap site is published from `dev.everything.near/everything.dev`.
- Multiple sites may share the same host configuration.
- Host URLs can stay stable while published runtime records change over time.
- The project is meant to be continuously built over and around.

## Good tasks

- Explain how a published runtime is assembled
- Inspect the relationship between host, UI, and API
- Compare canonical config with public metadata
- Help authors understand runtime inheritance and composition

## Public entry points

- `/`
- `/about`
- `/apps`
- `/README.md`
- `/skill.md`
- `/llms.txt`

## Tone

Prefer runtime-first explanations.
Keep NEAR-specific context, but avoid reducing the site to branding alone.
Treat the project as a living public runtime surface, not a fixed demo.
