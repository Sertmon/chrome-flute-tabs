/** YIN: устойчивее автокорреляции для голоса и духовых. */

const YIN_THRESHOLD = 0.12;
const F_MIN = 100;
const F_MAX = 2400;
const RMS_SILENCE = 0.01;

function parabolicInterpolate(arr, i) {
  const x0 = i > 0 ? arr[i - 1] : arr[i];
  const x1 = arr[i];
  const x2 = i + 1 < arr.length ? arr[i + 1] : arr[i];
  const denom = x0 + x2 - 2 * x1;
  return denom === 0 ? i : i + (x0 - x2) / (2 * denom);
}

function yinPitch(frame, sampleRate) {
  const n = frame.length;
  const maxTau = Math.min(Math.floor(sampleRate / F_MIN), Math.floor(n / 2));
  if (maxTau < 2) {
    return -1;
  }

  const diff = new Float32Array(maxTau);
  const cmndf = new Float32Array(maxTau);

  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < n - tau; i++) {
      const d = frame[i] - frame[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  let tau = 2;
  while (tau < maxTau && cmndf[tau] > YIN_THRESHOLD) {
    tau++;
  }

  if (tau >= maxTau) {
    let bestTau = 2;
    let bestVal = cmndf[2];
    for (let t = 3; t < maxTau; t++) {
      if (cmndf[t] < bestVal) {
        bestVal = cmndf[t];
        bestTau = t;
      }
    }
    if (bestVal > 0.35) {
      return -1;
    }
    tau = bestTau;
  } else {
    while (tau + 1 < maxTau && cmndf[tau + 1] < cmndf[tau]) {
      tau++;
    }
  }

  const refinedTau = parabolicInterpolate(cmndf, tau);
  const freq = sampleRate / refinedTau;

  if (freq < F_MIN || freq > F_MAX || !Number.isFinite(freq)) {
    return -1;
  }

  return freq;
}

export function measureRms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

export function detectPitch(buffer, sampleRate) {
  const rms = measureRms(buffer);
  if (rms < RMS_SILENCE) {
    return -1;
  }
  return yinPitch(buffer, sampleRate);
}

export function createPitchAnalyser(audioContext, fftSize = 4096) {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  const buffer = new Float32Array(fftSize);
  return { analyser, buffer, sampleRate: audioContext.sampleRate };
}

export function readPitchFrame(pitchKit) {
  pitchKit.analyser.getFloatTimeDomainData(pitchKit.buffer);
  const rms = measureRms(pitchKit.buffer);
  const freq = rms < RMS_SILENCE ? -1 : yinPitch(pitchKit.buffer, pitchKit.sampleRate);
  return { freq, rms };
}

/** @deprecated используйте readPitchFrame */
export function readPitch(pitchKit) {
  return readPitchFrame(pitchKit).freq;
}
