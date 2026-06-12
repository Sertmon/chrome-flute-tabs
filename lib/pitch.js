/** YIN: устойчивее автокорреляции для голоса и духовых. */

import { DEFAULT_SETTINGS } from './settings.js';

function parabolicInterpolate(arr, i) {
  const x0 = i > 0 ? arr[i - 1] : arr[i];
  const x1 = arr[i];
  const x2 = i + 1 < arr.length ? arr[i + 1] : arr[i];
  const denom = x0 + x2 - 2 * x1;
  return denom === 0 ? i : i + (x0 - x2) / (2 * denom);
}

function yinPitch(frame, sampleRate, settings) {
  const fMin = settings.fMin;
  const yinThreshold = settings.yinThreshold;
  const fMax = settings.fMax;
  const n = frame.length;
  const maxTau = Math.min(Math.floor(sampleRate / fMin), Math.floor(n / 2));
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
  while (tau < maxTau && cmndf[tau] > yinThreshold) {
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

  if (freq < fMin || freq > fMax || !Number.isFinite(freq)) {
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

export function createPitchAnalyser(audioContext, fftSize = 4096) {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  const buffer = new Float32Array(fftSize);
  return { analyser, buffer, sampleRate: audioContext.sampleRate, fftSize };
}

export function readPitchFrame(pitchKit, settings = DEFAULT_SETTINGS) {
  pitchKit.analyser.getFloatTimeDomainData(pitchKit.buffer);
  const rms = measureRms(pitchKit.buffer);
  const freq = rms < settings.rmsSilence
    ? -1
    : yinPitch(pitchKit.buffer, pitchKit.sampleRate, settings);
  return { freq, rms };
}
