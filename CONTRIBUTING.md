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
3. Test locally with the example:
   ```bash
   cd examples/browser-2-server
   pnpm dev
   ```
4. Ensure all tests pass: `pnpm test`
5. Ensure type checking passes: `pnpm typecheck`

### Example Development

The example uses `workspace:*` to always use the latest unpublished changes:
```json
{
  "dependencies": {
    "better-near-auth": "workspace:*"
  }
}
```

This allows you to test changes locally before publishing.

```
better-near-auth/
├── src/                    # Main package source
│   ├── index.ts           # Server-side plugin
│   ├── client.ts          # Client-side plugin
│   └── ...
├── examples/              # Example applications
│   └── browser-2-server/  # Full-stack example
│       ├── apps/
│       │   ├── server/    # Backend (Hono)
│       │   └── web/       # Frontend (React)
│       └── railway.toml   # Deployment config
├── .changeset/            # Changeset files
└── .github/
    └── workflows/
        └── release.yml    # Automated releases
```

## Working with Examples

Examples are part of the pnpm workspace and use the local `better-near-auth` package via `workspace:*`.

**Running examples locally:**
```bash
# From repo root
pnpm install

# Run specific example
cd examples/browser-2-server
pnpm dev
```

**Building examples:**
```bash
# Build from example directory
cd examples/browser-2-server
pnpm build

# Or from root with filter
pnpm --filter @b2s/server build
```

## Development Workflow

### Making Changes

1. Create a new branch for your changes
2. Make your changes following the existing code style
3. Ensure all tests pass: `pnpm test`
4. Ensure type checking passes: `pnpm typecheck`

### Changesets

This project uses [changesets](https://github.com/changesets/changesets) to manage versions and changelogs. When you make changes that should be released, you need to add a changeset.

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
3. **Update documentation** if you're adding features or changing behavior
4. **Add tests** for new functionality
5. **Ensure CI passes** (type checking, tests)

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

## Project Structure

```
better-near-auth/
├── src/
│   ├── index.ts        # Server-side plugin
│   ├── client.ts       # Client-side plugin
│   ├── types.ts        # TypeScript types
│   ├── schema.ts       # Database schema
│   ├── profile.ts      # Profile utilities
│   └── utils.ts        # Utility functions
├── examples/
│   └── browser-2-server/  # Example application
├── .changeset/         # Changeset files
└── .github/
    └── workflows/
        └── release.yml # Automated release workflow
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
