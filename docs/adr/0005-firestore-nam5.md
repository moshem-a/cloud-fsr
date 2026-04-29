# ADR 0005: Firestore region — `nam5` (US multi-region)

**Status:** Accepted · Sprint 0 · 2026-04-28

## Context

Firestore region is a **permanent decision per project** — once a database is created in a region, it cannot be moved. We have to pick before creating any infrastructure.

Our access pattern:
- Sales reps live in EMEA (mockup persona is Tel Aviv), NAMER, APAC.
- Customer data discussed in calls is global.
- Backend (Cloud Run) will be deployed multi-region eventually but starts in `us-central1` for v1.

Two real candidates:
- `nam5` — US multi-region (Iowa + South Carolina). Highest durability, best CCC SLA.
- `me-west1` — Tel Aviv. Best latency for the Israeli rep persona.
- `eur3` — EU multi-region. Compromise.

## Decision

Use **`nam5`** for all three projects (`dev`, `staging`, `prod`).

## Why

- This is an internal Google tool. Reps span global regions; no single region serves the majority best.
- Multi-region (`nam5`) gets us automatic geo-redundancy and a stronger SLA than `me-west1` (single-region).
- Cloud Run is currently US-anchored. Co-locating Firestore + Cloud Run in US avoids cross-region read latency on every request, which would dwarf the ~150 ms penalty Tel Aviv reps eat on their browser → Cloud Run RTT.
- Reps are reading/writing small Firestore docs (meeting metadata, hints). The dominant per-request latency is Cloud Run + Vertex AI, not Firestore.

## Consequences

**Good:**
- Multi-region durability for free.
- Cloud Run + Firestore co-located → no cross-region database hops.
- One region for all environments → simpler ops.

**Bad:**
- Tel Aviv reps eat ~150 ms RTT to Cloud Run for every API call vs. ~10 ms if we'd picked `me-west1`. Acceptable because (a) our slowest path is Vertex AI not Firestore, (b) the live screen uses WebSocket so most data flows over a kept-open connection.
- If Israeli customer data residency becomes a hard requirement later, we'd have to spin up a separate `me-west1` project and dual-write — a major refactor.

## Revisit when

- A specific customer's contract requires data residency in EMEA or APAC.
- We add a second Cloud Run region (`europe-west1`) and want Firestore co-located with it.
