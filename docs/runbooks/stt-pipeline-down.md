# Runbook: STT pipeline down

**Symptom:** Live meetings show transcript silence, or `transcript-final` frames stop arriving over WS. Users see the typing indicator stuck or the muted banner.

**Severity:** P1 — every active call is blind.

**Detection:**
- Cloud Monitoring alert `scoach: STT errors > 10/5m` fires.
- Dashboard `SuperCloud Sales Coach — Live pipeline` → STT errors / minute panel turns red.
- Users report "the transcript stopped" in the rep Slack channel.

## First 5 minutes

1. **Confirm the blast radius.** Is it ALL meetings or some? Cloud Logging filter:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="scoach-api-prod"
   jsonPayload.msg="STT error"
   ```
2. **Check Cloud STT V2 status:** https://status.cloud.google.com (look for Speech-to-Text incident in the Cloud Run region).
3. **If GCP-side outage:** post in #cloud-status, follow the GCP incident. We can't fix it; reduce blast radius (step 5).

## Common root causes

| Cause | Signal | Fix |
| --- | --- | --- |
| **Quota exhausted** (Chirp 3 streaming concurrent sessions) | `429 RESOURCE_EXHAUSTED` in logs | File a quota increase via Cloud Console → IAM & Admin → Quotas. Short-term: reject new sessions until existing ones drain. |
| **Service Account token expired / revoked** | `401 UNAUTHENTICATED` | Rotate the `api-runtime` SA via Terraform. |
| **VPC connector down** (if private STT endpoint configured) | Connection refused / timeout | Re-create serverless VPC connector. |
| **Bad audio format from client** | `INVALID_ARGUMENT` referencing `explicitDecodingConfig` | Check that worklet still emits 16 kHz mono LINEAR16. Roll back the `apps/web` deploy if a recent change touched audio code. |
| **STT V2 SDK breaking change** | `TypeError` in api logs after a recent deploy | Roll back `apps/api` to previous Cloud Run revision: `gcloud run services update-traffic scoach-api-prod --to-revisions=<prev>=100`. |

## Mitigation: degrade gracefully

If we can't fix STT but want to keep the product alive:

1. **Set env to canned-replay mode:**
   ```bash
   gcloud run services update scoach-api-prod \
     --remove-env-vars GCP_PROJECT_ID
   ```
   Confirm the new revision logs `pipeline mode: canned-replay (no GCP_PROJECT_ID)`. Live meetings now show a canned demo transcript — bad, but not a blank screen.
2. **Post a banner in the app:** push `apps/web` with a top banner saying "Live transcription is temporarily unavailable. Coaching is paused; you can still take private notes."
3. **Notify reps in #sales-coach-alerts.**

## Recovery

1. Set the env back: `gcloud run services update scoach-api-prod --update-env-vars GCP_PROJECT_ID=gcp-sales-coach-prod`.
2. Tail logs: `gcloud logging tail "resource.labels.service_name=scoach-api-prod"` — confirm `pipeline mode: real (STT V2 + Vertex Gemini)`.
3. Smoke test: open a meeting, share a Meet tab, speak — confirm transcript arrives within 1.5 s.
4. Remove the in-app banner.

## Postmortem checklist

- Add a regression test that catches the failure mode.
- Update this runbook with what actually fixed it.
- If it was a quota issue, set a Cloud Monitoring alert at 80 % of new limit.
