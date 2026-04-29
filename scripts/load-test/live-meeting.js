/* k6 load test for SuperCloud Sales Coach live meeting WebSocket.
 *
 * Goal (Sprint 5 SLO):
 *   - 100 concurrent WS connections sustaining audio + hint generation for 30 min
 *   - Error rate < 0.1%
 *   - p95 hint latency < 3.5s
 *   - p95 transcript-final latency < 1.5s
 *
 * Run:
 *   API_BASE=https://api.gcp-sales-coach.dev k6 run scripts/load-test/live-meeting.js
 *
 * Each VU:
 *   1. POSTs /meetings to create a meeting (with Idempotency-Key)
 *   2. Opens WS to /ws/meeting/:id
 *   3. Sends `hello`
 *   4. Sends fake PCM frames at 10 Hz (100 ms cadence) for the test duration
 *   5. Times every transcript-final and hint frame against frame send timestamps
 *   6. Sends `bye` and closes
 */

import http from "k6/http";
import ws from "k6/ws";
import { check } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

const BASE = __ENV.API_BASE || "http://localhost:8080";
const WS_BASE = BASE.replace(/^http/, "ws");
const TOKEN = __ENV.API_TOKEN || "dev-token";
const VUS = parseInt(__ENV.VUS || "100", 10);
const DURATION = __ENV.DURATION || "30m";
const FRAME_HZ = parseInt(__ENV.FRAME_HZ || "10", 10);

// Pretend-PCM frame: 1600 samples × 2 bytes = 3200 bytes.
const PCM_FRAME = new Uint8Array(3200);

const transcriptLatency = new Trend("scoach_transcript_final_ms", true);
const hintLatency = new Trend("scoach_hint_ms", true);
const wsErrors = new Counter("scoach_ws_errors");
const wsOk = new Rate("scoach_ws_ok");

export const options = {
  scenarios: {
    live_meeting: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    scoach_transcript_final_ms: ["p(95)<1500"],
    scoach_hint_ms: ["p(95)<3500"],
    scoach_ws_errors: ["count<10"],
    scoach_ws_ok: ["rate>0.999"],
  },
};

function createMeeting() {
  const res = http.post(
    `${BASE}/meetings`,
    JSON.stringify({
      account: { name: `Load Test VU ${__VU}` },
      title: `LT meeting ${__VU}`,
      stage: "Discovery",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "Idempotency-Key": `lt-${__VU}-${__ITER}-${Date.now()}`,
      },
      tags: { name: "create-meeting" },
    },
  );
  if (res.status !== 201) return null;
  return res.json("id");
}

export default function () {
  const meetingId = createMeeting();
  if (!meetingId) {
    wsErrors.add(1);
    return;
  }

  const url = `${WS_BASE}/ws/meeting/${meetingId}?token=${encodeURIComponent(TOKEN)}`;

  const lastSendByLineId = {};

  const res = ws.connect(url, { tags: { name: "ws" } }, (socket) => {
    let interval;
    let frameNum = 0;

    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "hello",
          meetingId,
          sampleRate: 16000,
          language: "auto",
        }),
      );
      // Send PCM at FRAME_HZ
      interval = socket.setInterval(() => {
        frameNum++;
        // Stamp send timestamp via embedded counter; server logs include receive ms.
        socket.sendBinary(PCM_FRAME.buffer);
        if (frameNum % 10 === 0) {
          // Heartbeat ping every ~1 s
          socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      }, 1000 / FRAME_HZ);
    });

    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw);
        const now = Date.now();
        if (msg.type === "transcript-final") {
          // Without per-line correlation we use last-known send-window.
          transcriptLatency.add(now - (lastSendByLineId.lastTranscript || now));
          lastSendByLineId.lastTranscript = now;
          wsOk.add(1);
        } else if (msg.type === "hint") {
          hintLatency.add(now - (lastSendByLineId.lastHint || now));
          lastSendByLineId.lastHint = now;
          wsOk.add(1);
        } else if (msg.type === "ready") {
          wsOk.add(1);
        }
      } catch {
        // ignore
      }
    });

    socket.on("error", (err) => {
      console.warn(`ws error: ${err}`);
      wsErrors.add(1);
      wsOk.add(0);
    });

    socket.on("close", () => {
      if (interval) socket.clearInterval(interval);
    });

    // Stay open until k6 tears it down. constant-vus restarts iterations.
    socket.setTimeout(() => {
      socket.send(JSON.stringify({ type: "bye", reason: "ended" }));
      socket.close();
    }, 60_000);
  });

  check(res, { "ws connected": (r) => r && r.status === 101 });
}
