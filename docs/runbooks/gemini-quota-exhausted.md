# Runbook: Gemini quota exhausted

**Symptom:** Hint cards stop appearing in live meetings; sentiment numbers freeze; client email regenerate fails. Server logs show 429s from Vertex AI.

**Severity:** P2 — meetings continue functioning (transcript still works) but the value-add of the product collapses.

**Detection:**
- Cloud Logging filter:
  ```
  resource.labels.service_name="scoach-api-prod"
  (jsonPayload.msg=~"hint pipeline" OR severity=ERROR)
  jsonPayload.error=~"RESOURCE_EXHAUSTED|429"
  ```
- Cloud Monitoring → Vertex AI → Requests panel shows the rate hitting the cap.
- Hint generation latency p95 spikes as retries pile up.

## Why it happens

Two paths burn Gemini quota:

| Path | Model | Quota | Cost driver |
| --- | --- | --- | --- |
| Live hint generation | Gemini 2.5 Pro | RPM per project | One call per fresh-entity batch per active call |
| Sentiment classification | Gemini 2.5 Flash | RPM per project | One call every 10 s per active call |
| Entity extraction | Gemini 2.5 Flash | RPM per project | One call per `transcript-final` line |
| Quiet Ask | Gemini 2.5 Flash (browser-direct) | Per-user key quota | User-driven, occasional |
| Summary generation | Gemini 2.5 Pro | RPM per project | One call at meeting end |

Concentrated traffic (a "lunch crush" of 50 concurrent reps starting calls in the same 60 s window) commonly trips the Pro RPM ceiling first.

## First 5 minutes

1. **Check current quota usage:** Cloud Console → IAM & Admin → Quotas → filter "Vertex AI". Look at "Generative Language API requests per minute per project".
2. **Confirm we're hitting the cap, not a transient outage:** if the throttling is consistent for >2 min and aligns with our request rate, it's quota.
3. **Throttle on our side first.** Edit `apps/api/src/routes/ws.meeting.ts` to increase the gap between hint generation calls (e.g. require 2 fresh entities instead of 1, or skip if we generated a hint within the last 30 s on this session).

## Mitigation: graceful degradation

The system is designed to keep working even with no Gemini:

- Set `GCP_PROJECT_ID` to empty → falls back to `extractEntities` regex-only, `classifySentiment` returns neutral defaults, `generateHint` returns null. Transcript still works.
- This is a P2 mitigation (no hints) but keeps reps able to take notes + see what's said.

```bash
gcloud run services update scoach-api-prod \
  --remove-env-vars GCP_PROJECT_ID
```

For Quiet Ask (browser-direct, user's personal key): users hitting their own quota see the error banner in the UI. They self-serve via aistudio.google.com/apikey to bump their tier.

## Recovery

1. **Request a quota increase.** Cloud Console → Quotas → "Edit quota" → bump RPM for `gemini-2.5-pro` and `gemini-2.5-flash` by 50–100%. Approval typically takes 24–48 h.
2. **Implement back-pressure for the next surge.** Add a token bucket per Cloud Run instance for hint calls (Sprint 5 polish, currently a TODO).
3. **Long term:** consider switching live hints to Gemini 2.5 Flash and reserving Pro for end-of-meeting summary. Halves Pro burn rate.

## Postmortem checklist

- Document peak concurrent calls during the incident.
- Update the quota request with the new peak.
- If we degraded by removing GCP_PROJECT_ID, confirm reps were notified and the in-app banner was visible.
