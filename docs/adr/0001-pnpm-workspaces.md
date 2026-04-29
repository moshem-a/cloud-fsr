# ADR 0001: pnpm workspaces (not Nx, not Turborepo)

**Status:** Accepted · Sprint 0 · 2026-04-28

## Context

We have two deployable apps (`apps/web`, `apps/api`) and three shared packages
(`packages/types`, `packages/ui`, `packages/tokens`). We need a monorepo
solution that handles workspace linking, hoisting, and cross-package builds
without dragging in a heavy task runner.

## Decision

Use **pnpm workspaces** (no Nx, no Turborepo, no Bazel).

- `pnpm-workspace.yaml` with `apps/*` and `packages/*`.
- Cross-package imports via `workspace:*` protocol.
- Root `package.json` scripts use `pnpm -r run <task>` for fanout.
- Build ordering relies on TS project references (`composite: true`), not a task graph.

## Consequences

**Good:**
- Zero net-new tooling — pnpm is already part of every Node toolchain we touch.
- Disk efficient (content-addressed store).
- Project references give us correct rebuild ordering for free.
- No vendor lock-in if we later need Nx or Turborepo.

**Bad:**
- No remote build cache. If the team grows past ~6 devs and CI build time
  becomes painful, revisit Turborepo (Vercel-hosted remote cache) or Nx Cloud.
- Less ergonomic than Nx for "run this task only on affected projects".

## Revisit when

- CI build time > 8 min consistently.
- More than 6 packages or 3 deployable apps.
