# ADR 0004: Hybrid Gemini routing (server-side for live + summary, browser-direct for Quiet Ask)

**Status:** Accepted · Sprint 0 · 2026-04-28

## Context

The original requirements doc specifies:
> All Gemini calls are made directly from the browser using the user's personal Gemini API key, stored in `localStorage`.

This works for one user. At 100+ concurrent users with reps actively coaching live calls, it breaks:

1. **Quota fairness.** Free tier is 60 RPM/key. A busy rep doing live hints + sentiment exhausts that in 30 seconds. Forces every rep to enable paid billing on a personal Cloud project — friction we'd be hiding.
2. **Audit.** No central log of what was sent to Gemini. Compliance cannot answer "show me all prompts that mentioned Acme Corp last week".
3. **Key rotation.** A leaked key (visible in DevTools, readable by browser extensions) can only be revoked by the user via Cloud Console. No central kill switch.
4. **Quality control.** No central place to measure hint relevance, A/B prompt variants, or roll back a regression.

For Quiet Ask specifically — user-initiated, low-frequency, conversational — the user-key model is fine and the privacy story ("your question goes directly to Gemini, never our servers") is genuinely valuable.

## Decision

**Hybrid routing:**

| Use case | Path | Identity | Quota |
| --- | --- | --- | --- |
| Live hint generation | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| Sentiment classification (10s cadence) | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| Entity extraction | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| Pre-meeting context analysis (PDF/DOCX summarization) | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| Post-meeting summary + client email | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| Email tone re-roll | Cloud Run → Vertex AI | `api-runtime` SA | SuperCloud team budget, central |
| **Quiet Ask** | Browser → `generativelanguage.googleapis.com` | User's personal API key | User's personal quota |

The user's personal Gemini key still lives in browser `localStorage`. It is **only** used for Quiet Ask. The Settings + ApiKeySetup flows still exist; the key field is required to enable Quiet Ask.

The server-side surface uses **Vertex AI** (`aiplatform.googleapis.com`) with Workload Identity → Cloud Run service account. No API keys; SA permissions only.

Models:
- Gemini 2.5 Pro: live hint generation, post-meeting summary, client email body
- Gemini 2.5 Flash: sentiment classification, entity extraction, email tone re-roll, context summarization

## Consequences

**Good:**
- Live hint quota is centrally controlled and observable.
- Audit logs in Cloud Logging cover every prompt (with PII scrubbing).
- Cost is borne by the team budget, not individual reps.
- Key rotation = rotate the SA, not chase down 100 users.
- The privacy story for Quiet Ask is preserved literally.

**Bad:**
- We pay for live hint generation even when reps would have used their free quota.
- Two LLM call paths to maintain (browser SDK + Vertex AI Node SDK).
- Reps still have to set up a personal Gemini API key for Quiet Ask, even though most of the LLM work is now server-side.

## Revisit when

- Quiet Ask usage is so low we could move it server-side too without quota concerns.
- Compliance requires *all* LLM traffic to be auditable — at that point Quiet Ask moves server-side and we drop the user-key UX entirely.
