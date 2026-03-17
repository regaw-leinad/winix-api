# winix-api

Winix device API client library for Node.js.

## Commands

- `npm run lint` - lint with eslint (zero warnings allowed)
- `npm run build` - clean build to dist/
- `npm run validate` - lint + build
- `npm test` - run unit tests (vitest)
- `npm run test:integration` - run integration tests (requires WINIX_USERNAME, WINIX_PASSWORD, WINIX_DEVICE_ID env vars)

## Release Process

Releases are fully automated via GitHub Actions on push to main.

The workflow reads the **first line** of the merge commit message and determines the version bump:

| Commit prefix | Bump | Example |
|---|---|---|
| `fix:` or `fix(scope):` | patch | `fix: handle empty status response` |
| `feat:` or `feat(scope):` | minor | `feat: add child lock support` |
| `feat!:` or `feat(scope)!:` | major | `feat!: remove deprecated methods` |
| anything else (`chore:`, `ci:`, `docs:`, etc.) | no release | `chore: update deps` |

**What happens on release:**
1. Bumps version in package.json
2. Commits with `[skip ci] release: X.Y.Z`
3. Creates git tag `vX.Y.Z`
4. Creates GitHub Release with auto-generated notes
5. Publishes to npm

**Required secret:** `NPM_TOKEN` in repository settings.

## Style

- Do not use em dashes
- Conventional commits for all commit messages
- TypeScript strict mode, CommonJS output
