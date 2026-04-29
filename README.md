# GCP Sales Coach (SuperCloud)

Real-time AI assistant that runs alongside Google Meet during Google Cloud sales calls. Listens to screen-shared audio (Cloud STT V2 / Chirp 3), surfaces competitive + coaching hints (Gemini 2.5 Pro / Flash), tracks sentiment, and produces a dual post-meeting deliverable (internal summary + client email draft).

**Internal tool — `@google.com` access only.**

## Stack

| Layer    | Choice                                                                |
| -------- | --------------------------------------------------------------------- |
| Repo     | pnpm workspaces                                                       |
| Frontend | Vite + React 18 + TypeScript + TanStack Router + Zustand              |
| Backend  | Node 20 + Fastify + TypeScript                                        |
| Auth     | Firebase Auth + Google OAuth (Workspace Internal app)                 |
| DB       | Firestore (Native mode, `nam5` multi-region)                          |
| Storage  | Cloud Storage (context uploads, exports)                              |
| STT      | Cloud Speech-to-Text V2 (Chirp 3, he-IL ↔ en-US, streaming)           |
| LLM      | Gemini 2.5 Pro / Flash via Vertex AI (server) + browser-direct (Quiet Ask) |
| Compute  | Cloud Run (API), Cloud Storage + Cloud CDN (web)                      |
| CI/CD    | GitHub Actions → Cloud Build → Cloud Run / GCS                        |
| IaC      | Terraform + Firebase CLI                                              |

See `docs/architecture.md` for the full picture and `docs/adr/` for decisions.

## Layout

```
apps/
  web/    # React SPA (Vite)
  api/    # Cloud Run service (Fastify)
packages/
  types/    # Shared API + WS contracts (single source of truth)
  ui/       # Design system primitives + icons
  tokens/   # Design tokens (colors, typography, spacing, ...)
  tsconfig/ # Shared tsconfig presets
infra/
  terraform/  # GCP project + Cloud Run + Firestore + Storage + Monitoring
  firebase/   # Firestore + Storage rules, indexes
  cloudbuild/ # CI/CD pipelines
spikes/
  audio-capture/  # Risk 1 derisking spike (getDisplayMedia + AudioWorklet)
docs/
  adr/        # Architecture decision records
  runbooks/   # Operational runbooks
```

## Local development

Requires Node 20.10+ and pnpm 9+.

```bash
pnpm install
pnpm dev          # starts web (5173) + api (8080) in parallel
pnpm test         # runs all workspace tests
pnpm typecheck
pnpm lint
```

The web app uses MSW in dev so it works without the api service running.

## Sprint status

| Sprint | Goal | Status |
| --- | --- | --- |
| 0 — Foundation | Repo scaffold, types, tokens, ui, web/api shells, ADRs, infra skeleton, CI/CD config, dev verification | ✅ done |
| 1 — Auth, design system, audio spike | 7 CSS files migrated, 40 icons ported, 14 ui primitives, Firebase Auth wiring, Risk 1 spike | ✅ done |
| 2 — Dashboard + Pre-meeting | MSW fixtures, auth state, routing, real Popover + Autocomplete, Dashboard, PreMeeting wizard, Settings, ApiKeySetup, BE Firestore repo with in-memory dev fallback, context routes | ✅ done |
| 3 — Live meeting MVP (read-only) | 3-column layout, transcript replay over canned WS, mute/RTL, Quiet Bar private notes | ✅ done |
| 4 — Real-time pipeline | getDisplayMedia → WS → Cloud STT V2 → Vertex AI Gemini hints + sentiment | ✅ done (dual-mode: real with `GCP_PROJECT_ID`, canned otherwise) |
| 5 — Summary + sharing + polish | SummaryScreen, ShareModal, PDF export, observability, k6 load test, runbooks | ✅ done (excl. live prod cutover, which needs real GCP project provisioning by you) |

Full plan: `/home/user/.claude/plans/i-m-building-a-production-frolicking-hopcroft.md`
