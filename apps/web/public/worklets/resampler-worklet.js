/* Resampler AudioWorkletProcessor.
 *
 * Receives 128-sample buffers at the AudioContext sample rate (typically
 * 44100 or 48000), resamples to the configured target rate (16000 for STT),
 * and emits Int16 PCM frames of `frameMs` length to the main thread.
 *
 * Algorithm: simple linear interpolation. Quality is fine for STT — Cloud
 * Speech-to-Text V2 / Chirp 3 doesn't need >16 kHz and is robust to mild
 * resampling artifacts. If we ever need higher fidelity, swap for a
 * polyphase filter (e.g. soxr-wasm).
 *
 * Channel handling: if input has >1 channel, downmix to mono by averaging.
 */

class Resampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate = options.processorOptions?.targetSampleRate ?? 16000;
    this.frameMs = options.processorOptions?.frameMs ?? 100;
    this.frameSamples = (this.targetSampleRate * this.frameMs) / 1000; // 1600 for 16k/100ms
    this.outBuffer = new Int16Array(this.frameSamples);
    this.outIdx = 0;
    this.ratio = sampleRate / this.targetSampleRate; // sampleRate is a global in worklets
    this.fracIndex = 0; // accumulator for resampling
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Downmix to mono if needed
    const numChannels = input.length;
    const inLen = input[0]?.length ?? 0;
    if (inLen === 0) return true;

    let mono;
    if (numChannels === 1) {
      mono = input[0];
    } else {
      mono = new Float32Array(inLen);
      for (let c = 0; c < numChannels; c++) {
        const ch = input[c];
        if (!ch) continue;
        for (let i = 0; i < inLen; i++) mono[i] += ch[i];
      }
      for (let i = 0; i < inLen; i++) mono[i] /= numChannels;
    }

    // Linear interpolation resample from sampleRate -> targetSampleRate
    let i = this.fracIndex;
    while (i < inLen) {
      const i0 = Math.floor(i);
      const i1 = Math.min(i0 + 1, inLen - 1);
      const frac = i - i0;
      const sample = mono[i0] * (1 - frac) + mono[i1] * frac;

      // Float32 [-1, 1] -> Int16
      const s = Math.max(-1, Math.min(1, sample));
      this.outBuffer[this.outIdx++] = (s < 0 ? s * 0x8000 : s * 0x7fff) | 0;

      if (this.outIdx >= this.frameSamples) {
        this.emitFrame();
        this.outIdx = 0;
      }

      i += this.ratio;
    }
    this.fracIndex = i - inLen;

    return true;
  }

  emitFrame() {
    // Copy because we're going to start writing into outBuffer again.
    const pcm = new Int16Array(this.outBuffer);
    const { rmsDb, peakDb, silent } = computeLevels(pcm);
    this.port.postMessage({ pcm, rmsDb, peakDb, silent }, [pcm.buffer]);
  }
}

function computeLevels(pcm) {
  let sumSquares = 0;
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 0x8000;
    sumSquares += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sumSquares / pcm.length);
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
  return { rmsDb, peakDb, silent: rmsDb < -55 };
}

registerProcessor("resampler", Resampler);
