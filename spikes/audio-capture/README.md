# Audio capture spike (Risk 1)

Standalone HTML page that proves whether `getDisplayMedia({ audio: true })` can reliably capture Google Meet tab audio for the live coaching pipeline.

## Run it

The page must be served over HTTP (or HTTPS) — `file://` URLs can't open a media stream picker. Easiest way:

```bash
cd /home/user/gcp-sales-coach/spikes/audio-capture
python3 -m http.server 7000
# then open http://localhost:7000/ in Chrome
```

For a real Meet session, host on a workstation that has Meet access. This spike was intentionally built dependency-free so it can run on any laptop.

## What it tests

| Capability | Why it matters |
| --- | --- |
| `getDisplayMedia({ audio: true })` returns an audio track | If the user picks the wrong source or forgets to tick "Share tab audio", we get video without audio — silent failure. |
| AudioWorklet resampler ($N$ Hz → 16 kHz mono PCM) | Cloud STT V2 / Chirp 3 wants 16 kHz. AudioContext defaults to 44.1/48 kHz. |
| 100 ms PCM frame cadence | Matches the WebSocket frame size we'll send to Cloud Run. |
| Track mute/unmute events | Detects when the user mutes Meet — does our captured stream go silent or drop the rep? |
| Frame gap detection | Catches dropouts > 250 ms (likely OS audio mixer hiccup). |

## What to fill into ADR 0006

After running on each combo:

| OS | Browser | Source choice | Audio captured? | Mute behavior | CPU impact | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| macOS | Chrome | Tab + tab audio | TODO | TODO | TODO | TODO |
| macOS | Chrome | Window | TODO | TODO | TODO | TODO |
| macOS | Chrome | Entire screen | TODO | TODO | TODO | TODO |
| Windows | Chrome | Tab + tab audio | TODO | TODO | TODO | TODO |
| Windows | Chrome | Entire screen + system | TODO | TODO | TODO | TODO |
| Linux X11 | Chrome | Tab + tab audio | TODO | TODO | TODO | TODO |
| Linux Wayland | Chrome | (any) | (likely fails) | n/a | n/a | TODO |

Outcome shapes the **Sprint 1 fallback ladder** in the main plan:
- If "Tab + tab audio" works on macOS+Windows: ship with that as the documented requirement + preflight detector.
- If it's fragile: switch to "rep mic via getUserMedia + customer audio via tab audio" (server mixes).
- If both are bad: bump Chrome Extension v2 (`chrome.tabCapture`) into v1 scope.

## Outputs

- **Live meter** + per-frame stats in the UI.
- **Download last 10s PCM** → WAV file at 16 kHz mono. Open in Audacity to verify quality.
- **Record 30s WebM Opus** → reference recording for STT QA.
- **Event log** → copy/paste into the ADR.
