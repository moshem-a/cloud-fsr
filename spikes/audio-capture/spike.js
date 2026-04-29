/* Audio Capture Spike — Risk 1 (Sprint 1)
 *
 * Captures audio from a screen-share tab via getDisplayMedia({ audio: true }),
 * runs it through an AudioWorklet that resamples to 16 kHz mono PCM, and
 * exposes timing / level / drop metrics.
 *
 * Tested matrix to be filled in ADR 0006:
 *   macOS Chrome  (Tab + Share tab audio): TODO
 *   macOS Chrome  (Window): TODO
 *   macOS Chrome  (Entire Screen): TODO
 *   Windows Chrome (Tab + Share tab audio): TODO
 *   Windows Chrome (Entire Screen + Share system audio): TODO
 *   Linux Chrome (Wayland): TODO (likely fails)
 *   Firefox: out of scope (no tab audio)
 */

const SAMPLE_RATE_OUT = 16000;
const FRAME_MS = 100; // 100ms PCM frame = 1600 samples = 3200 bytes
const RECENT_PCM_SECONDS = 10;

const els = {
  start: document.getElementById("start"),
  stop: document.getElementById("stop"),
  record: document.getElementById("record"),
  exportPcm: document.getElementById("exportPcm"),
  meter: document.getElementById("meter"),
  status: document.getElementById("status"),
  trackLabel: document.getElementById("trackLabel"),
  srIn: document.getElementById("srIn"),
  channels: document.getElementById("channels"),
  frames: document.getElementById("frames"),
  bytes: document.getElementById("bytes"),
  rms: document.getElementById("rms"),
  peak: document.getElementById("peak"),
  silentFrames: document.getElementById("silentFrames"),
  drops: document.getElementById("drops"),
  elapsed: document.getElementById("elapsed"),
  support: document.getElementById("support"),
  log: document.getElementById("log"),
};

const state = {
  audioCtx: null,
  workletNode: null,
  source: null,
  mediaStream: null,
  recorder: null,
  recentPcm: [], // ring of Int16Array frames for export
  framesSent: 0,
  bytesSent: 0,
  silentFrames: 0,
  dropEvents: 0,
  startedAt: 0,
  lastFrameAt: 0,
  elapsedTimer: null,
};

// ---------- support detection ----------
(function detectSupport() {
  const ua = navigator.userAgent;
  const isChromeFamily = /Chrome|Chromium|Edg|Brave/.test(ua) && !/Firefox/.test(ua);
  const supportsGdmAudio = "mediaDevices" in navigator && "getDisplayMedia" in navigator.mediaDevices;
  const supportsWorklet = typeof AudioWorkletNode !== "undefined";
  const supportsMediaRecorder = typeof MediaRecorder !== "undefined";

  els.support.innerHTML = `
    <span class="stat">UA: <strong>${ua.split(") ")[0]?.slice(0, 80) ?? ua.slice(0, 80)}</strong></span>
    <span class="stat ${isChromeFamily ? "ok" : "err"}">Chromium-family: <strong>${isChromeFamily}</strong></span>
    <span class="stat ${supportsGdmAudio ? "ok" : "err"}">getDisplayMedia: <strong>${supportsGdmAudio}</strong></span>
    <span class="stat ${supportsWorklet ? "ok" : "err"}">AudioWorklet: <strong>${supportsWorklet}</strong></span>
    <span class="stat ${supportsMediaRecorder ? "ok" : "warn"}">MediaRecorder: <strong>${supportsMediaRecorder}</strong></span>
  `;

  if (!isChromeFamily) log("warn", "Non-Chromium browser detected; tab audio capture is unreliable outside Chromium.");
  if (!supportsGdmAudio) log("err", "getDisplayMedia not supported. Cannot proceed.");
})();

function log(level, msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${level.toUpperCase()} — ${msg}`;
  els.log.textContent = `${line}\n${els.log.textContent === "(start a capture to see events)" ? "" : els.log.textContent}`;
}

function setStatus(s) {
  els.status.textContent = s;
}

// ---------- capture flow ----------
els.start.addEventListener("click", async () => {
  try {
    log("info", "Requesting display media with audio...");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        // chrome-specific hints; ignored elsewhere
        suppressLocalAudioPlayback: false,
        echoCancellation: false,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      log(
        "err",
        'No audio track in returned stream. You probably forgot to tick "Share tab audio" in the picker. ' +
          'Try again — choose "Chrome Tab", select the Meet tab, then tick the audio checkbox.',
      );
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    state.mediaStream = stream;
    const aTrack = audioTracks[0];
    els.trackLabel.textContent = aTrack.label || "(unnamed)";
    log("info", `Got audio track: "${aTrack.label}"`);

    aTrack.addEventListener("ended", () => {
      log("warn", `Audio track ended — likely the user stopped sharing.`);
      cleanup();
    });
    aTrack.addEventListener("mute", () => {
      log("warn", `Audio track went MUTE`);
      state.dropEvents++;
      els.drops.textContent = state.dropEvents;
    });
    aTrack.addEventListener("unmute", () => log("info", "Audio track UNMUTE"));

    const settings = aTrack.getSettings();
    els.srIn.textContent = settings.sampleRate ?? "?";
    els.channels.textContent = settings.channelCount ?? "?";
    log("info", `Track settings: ${JSON.stringify(settings)}`);

    state.audioCtx = new AudioContext({ sampleRate: settings.sampleRate ?? 48000 });
    await state.audioCtx.audioWorklet.addModule("./resampler-worklet.js");

    state.source = state.audioCtx.createMediaStreamSource(new MediaStream([aTrack]));
    state.workletNode = new AudioWorkletNode(state.audioCtx, "resampler", {
      processorOptions: { targetSampleRate: SAMPLE_RATE_OUT, frameMs: FRAME_MS },
    });

    state.workletNode.port.onmessage = (ev) => onPcmFrame(ev.data);
    state.source.connect(state.workletNode);
    // Don't connect to destination — we don't want to play it back into the meeting.

    state.startedAt = performance.now();
    state.lastFrameAt = state.startedAt;
    state.elapsedTimer = setInterval(() => {
      els.elapsed.textContent = `${Math.round((performance.now() - state.startedAt) / 1000)}s`;
    }, 250);

    setStatus("capturing");
    els.start.disabled = true;
    els.stop.disabled = false;
    els.record.disabled = false;
    els.exportPcm.disabled = false;

    log("ok", `Capture started. AudioContext sampleRate=${state.audioCtx.sampleRate}Hz, target out=${SAMPLE_RATE_OUT}Hz`);
  } catch (err) {
    log("err", `getDisplayMedia failed: ${err.name}: ${err.message}`);
  }
});

els.stop.addEventListener("click", cleanup);

els.record.addEventListener("click", () => {
  if (!state.mediaStream) return;
  const audioOnly = new MediaStream(state.mediaStream.getAudioTracks());
  state.recorder = new MediaRecorder(audioOnly, { mimeType: "audio/webm;codecs=opus" });
  const chunks = [];
  state.recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  state.recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/webm" });
    download(blob, `capture-${Date.now()}.webm`);
    log("ok", `Recorded ${blob.size} bytes WebM Opus.`);
  };
  state.recorder.start();
  log("info", "Recording 30s WebM Opus...");
  setTimeout(() => state.recorder?.state === "recording" && state.recorder.stop(), 30_000);
});

els.exportPcm.addEventListener("click", () => {
  if (state.recentPcm.length === 0) {
    log("warn", "No PCM frames yet.");
    return;
  }
  const totalSamples = state.recentPcm.reduce((sum, f) => sum + f.length, 0);
  const out = new Int16Array(totalSamples);
  let offset = 0;
  for (const f of state.recentPcm) {
    out.set(f, offset);
    offset += f.length;
  }
  const wav = pcm16ToWav(out, SAMPLE_RATE_OUT);
  download(new Blob([wav], { type: "audio/wav" }), `pcm-${Date.now()}.wav`);
  log("ok", `Exported ${out.length} samples as WAV.`);
});

function onPcmFrame({ pcm, rmsDb, peakDb, silent }) {
  // pcm is an Int16Array passed as a Transferable (zero-copy).
  state.framesSent++;
  state.bytesSent += pcm.byteLength;

  state.recentPcm.push(pcm);
  const maxFrames = Math.ceil((RECENT_PCM_SECONDS * 1000) / FRAME_MS);
  while (state.recentPcm.length > maxFrames) state.recentPcm.shift();

  els.frames.textContent = state.framesSent;
  els.bytes.textContent = state.bytesSent.toLocaleString();
  els.rms.textContent = `${rmsDb.toFixed(1)} dB`;
  els.peak.textContent = `${peakDb.toFixed(1)} dB`;

  if (silent) {
    state.silentFrames++;
    els.silentFrames.textContent = state.silentFrames;
  }

  // Visualize: clamp -60..0 dB to 0..100%
  const meterPct = Math.max(0, Math.min(100, ((rmsDb + 60) / 60) * 100));
  els.meter.style.width = `${meterPct}%`;

  // Detect a gap: if previous frame > 200ms ago, log a drop event
  const now = performance.now();
  const since = now - state.lastFrameAt;
  if (since > FRAME_MS * 2.5) {
    state.dropEvents++;
    els.drops.textContent = state.dropEvents;
    log("warn", `Frame gap of ${since.toFixed(0)}ms detected (expected ~${FRAME_MS}ms).`);
  }
  state.lastFrameAt = now;
}

function cleanup() {
  state.workletNode?.disconnect();
  state.source?.disconnect();
  state.audioCtx?.close();
  state.mediaStream?.getTracks().forEach((t) => t.stop());
  state.workletNode = null;
  state.source = null;
  state.audioCtx = null;
  state.mediaStream = null;
  if (state.elapsedTimer) clearInterval(state.elapsedTimer);
  setStatus("stopped");
  els.start.disabled = false;
  els.stop.disabled = true;
  els.record.disabled = true;
  els.exportPcm.disabled = true;
  els.meter.style.width = "0%";
  log("info", "Capture stopped. Stats above persist; refresh to reset.");
}

// ---------- helpers ----------
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

function pcm16ToWav(pcm, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  let p = 0;
  const writeStr = (s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i));
  };
  writeStr("RIFF");
  v.setUint32(p, 36 + dataSize, true); p += 4;
  writeStr("WAVE"); writeStr("fmt ");
  v.setUint32(p, 16, true); p += 4;
  v.setUint16(p, 1, true); p += 2;
  v.setUint16(p, numChannels, true); p += 2;
  v.setUint32(p, sampleRate, true); p += 4;
  v.setUint32(p, byteRate, true); p += 4;
  v.setUint16(p, blockAlign, true); p += 2;
  v.setUint16(p, bitsPerSample, true); p += 2;
  writeStr("data");
  v.setUint32(p, dataSize, true); p += 4;
  new Int16Array(buf, 44).set(pcm);
  return buf;
}
