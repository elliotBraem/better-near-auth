# Contributing to better-near-auth

Thank you for your interest in contributing to better-near-auth! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run type checking:
   ```bash
   pnpm typecheck
   ```
4. Run tests:
   ```bash
   pnpm test
   ```

## Building

The package is written in TypeScript and compiled to JavaScript for distribution.

**Build process:**
```bash
# Compile TypeScript to JavaScript
pnpm build

# Output:
# - dist/index.js (ESM)
# - dist/client.js (ESM)
# - dist/*.d.ts (TypeScript declarations)
# - dist/*.js.map (source maps)
```

**Before publishing:**
- The `prepublishOnly` script automatically builds the package
- Only `dist/` is published to npm (not `src/`)
- TypeScript declarations are included for IDE support

## Development Workflow

### Making Changes

1. Create a new branch for your changes
2. Make your changes following the existing code style
3. Ensure all tests pass: `pnpm test`
4. Ensure type checking passes: `pnpm typecheck`
5. Update relevant skill files in `skills/` (see [Updating Skills](#updating-skills) below)
6. Test your changes with the auth.everything.dev example (see [Working with Examples](#working-with-examples) below)

### Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versions and changelogs. Read [.changeset/README.md](.changeset/README.md) for an overview of the changeset system.

#### Adding a Changeset

After making your changes, run:

```bash
pnpm changeset
```

You'll be prompted to:

1. **Select packages**: Choose `better-near-auth` (the main package)
2. **Select change type**:
   - `patch` (0.0.x): Bug fixes, documentation updates, internal refactoring
   - `minor` (0.x.0): New features, non-breaking API changes
   - `major` (x.0.0): Breaking changes
3. **Write a summary**: Describe your changes in a clear, user-facing way

Example summary:
```
Add support for custom nonce validation
```

This creates a markdown file in `.changeset/` that should be committed with your changes.

#### Semantic Versioning Guidelines

- **Patch (0.0.x)**:
  - Bug fixes
  - Documentation updates
  - Internal refactoring
  - Performance improvements
  - Dependency updates (non-breaking)

- **Minor (0.x.0)**:
  - New features
  - New optional configuration options
  - Non-breaking API enhancements
  - New exported functions/types

- **Major (x.0.0)**:
  - Breaking changes to the API
  - Removed features
  - Changed function signatures
  - Configuration changes that require user action

### Pull Request Process

1. **Create a PR** from your branch to `main`
2. **Include a changeset** if your changes should be released
3. **Update the examples** if you're changing behavior:
   - Update `examples/auth.everything.dev/plugins/auth/` for server-side changes
   - Update `examples/auth.everything.dev/ui/` for client-side changes
4. **Update skill files** in `skills/` (see [Updating Skills](#updating-skills) below)
5. **Add tests** for new functionality
6. **Ensure CI passes** (type checking, tests)

### What Happens After Your PR is Merged

1. If your PR includes a changeset, a "Version Packages" PR will be automatically created
2. The version PR will:
   - Bump the package version
   - Update CHANGELOG.md with your summary
   - Update dependencies if needed
3. When the version PR is merged:
   - The package is automatically published to npm
   - A git tag is created
   - A GitHub release is created

## Release Process (for Maintainers)

### Automatic Releases

Releases are fully automated via GitHub Actions:

1. Contributors add changesets in their PRs
2. When PRs merge to `main`, a "Version Packages" PR is created
3. Review and merge the version PR
4. The package is automatically published to npm

### Manual Release (if needed)

If you need to release manually:

```bash
# Version packages
pnpm version

# Publish to npm
pnpm release
```

## Working with Examples

Examples are part of the pnpm workspace and use the local `better-near-auth` package via `workspace:*`. There are two key areas in `examples/auth.everything.dev/`:

### `examples/auth.everything.dev/plugins/auth/`

This is the everything-plugin (`@everything-dev/auth-plugin`) that wraps `better-near-auth` with Better Auth into an oRPC + Module Federation plugin. It provides session management, SIWN, passkeys, OAuth, phone OTP, anonymous accounts, organizations, API keys, and a NEAR relayer.

When making server-side changes to `better-near-auth`, update this plugin's source files accordingly:

- `src/auth-instance.ts` — Better Auth instance wiring (siwn plugin, email, OAuth, etc.)
- `src/contract.ts` — oRPC contract (endpoints, Zod schemas)
- `src/index.ts` — Plugin entry and all handler implementations
- `src/db/schema.ts` — Drizzle ORM schema

**Running locally:**
```bash
cd examples/auth.everything.dev/plugins/auth
pnpm dev
```

### `examples/auth.everything.dev/ui/`

This is the TanStack Router + React 19 UI that consumes the auth plugin. It provides sign-in flows (SIWN, passkey, email, anonymous, phone OTP, OAuth), organization management, NEAR wallet integration, relay feed, and profile display.

When making client-side changes to `better-near-auth`, update this frontend:

- `src/lib/auth.ts` — Auth client factory, hooks, session query options
- `src/app.ts` — Public API surface, router context, runtime helpers
- `src/router.tsx` / `src/router.server.tsx` — Router wiring (CSR and SSR)
- `src/components/` — UI components (near-profile, relay-feed, etc.)

**Running locally:**
```bash
cd examples/auth.everything.dev/ui
pnpm dev
```

## Updating Skills

The `skills/` directory contains AI-guided skill documents loaded via `@tanstack/intent`. These provide canonical patterns, code examples, and common mistakes for each domain. When you make changes to the library or examples, you must keep the corresponding skill files in sync.

### Skill Structure

Each skill lives in its own subdirectory with a single `SKILL.md` file:

```
skills/
├── _artifacts/       # Generated discovery artifacts (domain_map.yaml, skill_spec.md, skill_tree.yaml)
├── siwn/             # Server-side SIWN plugin skill
├── client/           # Client-side siwnClient plugin skill
├── relay/            # Gasless NEP-366 relay skill
├── subaccount/       # Sub-account creation skill
├── tanstack/         # TanStack Router integration skill
└── auth-plugin/      # everything.dev plugin consumption skill
```

### Which Skill to Update

- **Server-side (`src/index.ts`) changes** → update `skills/siwn/SKILL.md`
- **Client-side (`src/client.ts`) changes** → update `skills/client/SKILL.md`
- **Relay changes** → update `skills/relay/SKILL.md`
- **Sub-account changes** → update `skills/subaccount/SKILL.md`
- **Example plugin changes** → update `skills/auth-plugin/SKILL.md`
- **Example UI / TanStack integration changes** → update `skills/tanstack/SKILL.md`

### Artifacts

`skills/_artifacts/domain_map.yaml` is the master discovery artifact. It is generated from a source analysis pass, but manual updates to individual `SKILL.md` files are expected for accuracy. After updating skills, consider whether the domain map or skill tree also needs updating.

### More Information

See `skills/README.md` for details on the skills system and how to load skills with `@tanstack/intent`.

## Project Structure

```
better-near-auth/
├── src/                                  # Main package source
│   ├── index.ts                         # Server-side siwn() plugin
│   ├── client.ts                        # Client-side siwnClient() plugin
│   ├── types.ts                         # TypeScript types
│   ├── schema.ts                        # Database schema
│   ├── profile.ts                       # Profile utilities
│   └── utils.ts                         # Utility functions (encryption, helpers)
├── examples/
│   └── auth.everything.dev/             # Reference consumer app
│       ├── plugins/auth/                # everything-plugin (oRPC, Better Auth)
│       └── ui/                          # TanStack Router + React 19 frontend
├── skills/                              # AI-guided skill documents
│   ├── _artifacts/                      # Generated discovery artifacts
│   ├── siwn/                            # Server plugin skill
│   ├── client/                          # Client plugin skill
│   ├── relay/                           # Gasless relay skill
│   ├── subaccount/                      # Sub-account creation skill
│   ├── tanstack/                        # TanStack Router integration skill
│   └── auth-plugin/                     # everything-plugin consumption skill
├── .changeset/                          # Changeset files (versioning)
└── .github/
    └── workflows/
        └── release.yml                  # Automated release workflow
```

## Code Style

- Use TypeScript for all code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write self-documenting code

## Testing

- Write tests for new functionality
- Ensure all tests pass before submitting PRs
- Test both success and error cases

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Be respectful and constructive in all interactions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
