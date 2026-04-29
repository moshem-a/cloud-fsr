# Runbook: Audio capture failures

**Symptom:** Reps report "I clicked Start listening but the transcript never starts" or "the typing dots never go away". They may also see "No audio track in shared stream — tick Share tab audio" inline.

**Severity:** P1 for the affected user, P3 if isolated. P0 if reproducible across all reps after a deploy.

**Detection:**
- User reports in Slack or in-app feedback widget.
- `apps/web/src/features/meeting/live/audio/useAudioCapture.ts` emits `onError` callbacks; client side `analytics.ts` will surface these to Cloud Logging once Sprint 5 wires the telemetry sink.
- During a deploy: bump in `scoach_ws_errors` in the dashboard.

## Most common cause: user UX

By far the most frequent failure mode is the rep choosing the wrong source:

1. They picked **Window** instead of **Chrome Tab** → no audio.
2. They picked **Chrome Tab** but did NOT tick **"Share tab audio"** → silent.
3. They're on Linux + Wayland → tab audio capture genuinely doesn't work; no fix.

### Fix (one-time per affected user)

1. Have them click **End meeting** → **Pick source** in the share preview.
2. In the picker, choose **Chrome Tab** → select their Meet tab.
3. **Tick the "Share tab audio" checkbox** (very easy to miss).
4. Click Share → confirm the green "Capturing audio" indicator shows in the share preview.

## Diagnosing in the browser

Ask the user to open DevTools → Console and run:

```js
const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
console.log("audioTracks:", s.getAudioTracks().length, s.getAudioTracks()[0]?.label);
s.getTracks().forEach((t) => t.stop());
```

If `audioTracks` is `0`: they didn't tick "Share tab audio".
If it's `1` but transcript still fails: we have an actual pipeline issue (jump to STT runbook).

## Browser support matrix (per Risk 1 ADR 0006)

| Browser / OS | Tab audio | System audio | Notes |
| --- | --- | --- | --- |
| Chrome / macOS | ✅ "Chrome Tab" + checkbox | ❌ | Recommended path |
| Chrome / Windows | ✅ "Chrome Tab" + checkbox | ✅ "Entire Screen" + checkbox | Either works, tab-audio cleaner |
| Chrome / Linux X11 | ⚠ flaky | ⚠ depends on PulseAudio | Document hard requirement: macOS or Windows |
| Chrome / Linux Wayland | ❌ | ❌ | Tell user to switch OS or use a Mac |
| Firefox | ❌ | ❌ | Block sign-in for now (out of scope) |
| Safari | ❌ | ❌ | Block sign-in for now |
| Edge | ✅ same as Chrome | ✅ same as Chrome | Should work, occasionally tested |

## If it's reproducible across all reps after a deploy

This means the worklet or the audio pipeline broke. Check:

1. Did the resampler worklet get bundled into `apps/web/public/worklets/`? It's a static file, must be served at `/worklets/resampler-worklet.js`.
2. Did anything in `useAudioCapture.ts` change? Roll back the web deploy.
3. Did Chrome ship a breaking change to `getDisplayMedia` constraints? Check release notes, especially the `audio: { suppressLocalAudioPlayback: false }` flag.

## Long-term mitigations

- **Preflight check page:** before the live meeting, run a 5 s `getDisplayMedia` test and confirm an audio track. If missing, show a corrective gif before the meeting can start. (Sprint 5+ polish.)
- **Chrome Extension fallback:** for users who consistently fail screen-share audio capture, ship a Chrome Extension that uses `chrome.tabCapture` (more reliable). v2 scope.

## Postmortem checklist

- If many users hit it from the same OS/browser combo, push a targeted fix or add it to the support matrix.
- If it was a deploy regression, add a Playwright e2e that exercises `getDisplayMedia` on at least one CI runner.
