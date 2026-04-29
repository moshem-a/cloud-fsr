# ADR 0006: Audio capture strategy (Risk 1)

**Status:** PROPOSED · Sprint 1 · 2026-04-28
**Will be promoted to Accepted once the spike test matrix is filled in.**

## Context

GCP Sales Coach captures call audio from the rep's browser via
`getDisplayMedia({ audio: true })`. The rep shares the Google Meet tab,
ticks "Share tab audio", and the worker thread resamples to 16 kHz mono
PCM and ships frames to Cloud Run, which proxies to Cloud STT V2 (Chirp 3).

Risk 1 in the main plan flags this as the highest-risk technical area:
- Tab-audio capture has invisible failure modes (forgot the checkbox).
- Behavior varies across macOS / Windows / Linux.
- Firefox + Safari don't support tab audio at all.
- Mute/unmute interactions with Meet are subtle.

The spike at `spikes/audio-capture/` measures this empirically.

## Test results

To be filled in before Sprint 4 starts.

| OS | Browser | Source | Audio? | Notes |
| --- | --- | --- | --- | --- |
| macOS 14 | Chrome 131 | Tab + tab audio | TODO | TODO |
| macOS 14 | Chrome 131 | Window | TODO | TODO |
| Windows 11 | Chrome 131 | Tab + tab audio | TODO | TODO |
| Windows 11 | Chrome 131 | Entire screen + system audio | TODO | TODO |
| Linux Wayland | Chrome 131 | (any) | TODO | TODO |

## Decision

To be made after spike runs.

Options ranked from preferred:

1. **"Chrome Tab + Share tab audio" only.** Document hard requirement; build a preflight that detects misconfigured streams and shows a corrective gif before the meeting starts. Simplest, no extra moving parts.
2. **Hybrid mic + tab.** `getUserMedia` for the rep's mic + `getDisplayMedia` for customer audio. Server-side mix. Handles "rep mute breaks tab capture" cases. Doubles WebSocket payload.
3. **Chrome Extension (`chrome.tabCapture`).** More reliable than `getDisplayMedia` for this exact use case. Adds Chrome Web Store review delay (~1 week). Bumps to v1.5.

## Consequences

To be filled in after the decision.

## Revisit when

- Web Speech API / Cloud STT adds direct WebSocket support that bypasses our proxy (we'd inherit their audio capture story).
- We need to support browsers other than Chrome (Edge for some teams uses different `getDisplayMedia` behavior).
- A user reports >5% audio dropouts on supported configs.
