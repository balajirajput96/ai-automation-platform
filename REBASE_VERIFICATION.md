# AstraFlow Rebase & Verification Report

**Prepared:** 18 August 2026

## Rebase result

The `main` branch was successfully rebased onto the incoming GitHub branch `fix/analytics-and-pnpm-config` after explicit user authorization. The rebased history was safely published with `git push --force-with-lease github main`.

## Verification commands and outcomes

| Command | Outcome |
|---|---|
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm check` | Passed |
| `pnpm test` | Passed — 20 tests across 8 test files |
| `pnpm build` | Passed |
| `pnpm audit --prod --json` | Passed — 0 production vulnerabilities |
| GitHub quality-gate workflow | Passed — run `32097614748` |
| GitHub opt-in live-provider workflow | Passed — run `32095983163` |

## Included integrity fix

Project creation is now transactional: the project record and its linked agents/workflows are written together, so invalid linked-resource input cannot leave an orphaned project. The regression test is located at `server/routers/projects.transaction.test.ts`.

## Reproduce locally

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm audit --prod
```

> This report intentionally excludes passwords, access tokens, cookies, and any other credentials.
