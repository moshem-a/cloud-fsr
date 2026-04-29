# ADR 0002: Fastify (over Express, Hono, Koa)

**Status:** Accepted · Sprint 0 · 2026-04-28

## Context

The Cloud Run service needs to handle:
- REST endpoints (auth, meetings, summary, sharing)
- WebSocket bridge (browser audio → Cloud STT V2 streaming → push transcript/hints)
- Multipart file upload (≤25 MB context PDFs)
- Firebase ID token validation on every request

It also needs:
- Cold start < 500 ms (Cloud Run scales from zero on bursts)
- Strong TypeScript story with shared types (`@scoach/types`)
- Plugin ecosystem covering websocket, cors, multipart, rate limiting

## Decision

Use **Fastify 5** for the API service.

- `@fastify/websocket` for the live meeting WS upgrade.
- `@fastify/cors` for the SPA origin gate.
- `@fastify/multipart` (Sprint 2) for context uploads.
- `firebase-admin` for ID token verification in a custom plugin.
- Pino logging built in, with PII scrubbing layered on top.

## Why not Express

- Express request/response is untyped — every plugin reinvents the wheel.
- Slower JSON serialization (no schema-based fast-json-stringify).
- WebSocket support requires `express-ws` which conflicts with modern middleware patterns.

## Why not Hono

- Edge-first design (Cloudflare Workers, Bun). We're committed to Cloud Run + Node 20.
- Smaller plugin ecosystem; we'd build more from scratch.
- WebSocket support is less mature than `@fastify/websocket`.

## Why not Koa

- Async middleware story is good but plugin ecosystem is thin.
- No first-class schema validation.

## Consequences

**Good:**
- ~300 ms cold start on Cloud Run (measured in similar shapes).
- Schema validation via JSON Schema or zod adapters.
- Rich plugin ecosystem.

**Bad:**
- Slightly steeper learning curve for engineers coming from Express.
- Fastify v5 type ergonomics aren't perfect (generic Request/Reply parameters can be verbose).

## Revisit when

- Edge deployment becomes a hard requirement (move to Hono on Cloudflare).
- We outgrow Cloud Run for the WS service and need a long-running container (Hono + Bun, or Go).
