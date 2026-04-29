# Load tests

## Live meeting WebSocket (Sprint 5 SLO)

```bash
# Local (canned-replay mode — useful for protocol-level smoke):
k6 run scripts/load-test/live-meeting.js

# Against staging (real STT + Vertex Gemini):
API_BASE=https://api-staging.gcp-sales-coach.dev \
API_TOKEN=<firebase-id-token> \
VUS=100 DURATION=30m \
k6 run scripts/load-test/live-meeting.js
```

### Pass criteria

| Metric | Threshold |
| --- | --- |
| `scoach_transcript_final_ms` p95 | < 1500 ms |
| `scoach_hint_ms` p95 | < 3500 ms |
| `scoach_ws_errors` total | < 10 |
| `scoach_ws_ok` rate | > 99.9% |

### Notes

- The PCM frames are **silent** — they exercise the WS + STT plumbing but
  won't trigger transcript output in real mode. To validate end-to-end with
  real audio, run with a recorded `.wav` payload instead (see TODO in script).
- For a 30-min run at VUs=100, expect Cloud Run to scale up to ~10 instances
  (concurrency=80, with 100 concurrent WS each consuming ~1 connection slot).
- Monitor the Cloud Monitoring dashboard `SuperCloud Sales Coach — Live pipeline`
  during the run.
