/**
 * Определение высоты тона по буферу (автокорреляция).
 * Возвращает частоту в Hz или -1, если сигнал слишком слабый.
 */
export function detectPitch(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.008) {
    return -1;
  }

  let r1 = 0;
  let r2 = size - 1;
  const threshold = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buffer[size - i]) < threshold) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buffer.subarray(r1, r2);
  const trimmedSize = trimmed.length;
  if (trimmedSize < 2) {
    return -1;
  }

  const correlation = new Float32Array(trimmedSize);
  for (let lag = 0; lag < trimmedSize; lag++) {
    let sum = 0;
    for (let i = 0; i < trimmedSize - lag; i++) {
      sum += trimmed[i] * trimmed[i + lag];
    }
    correlation[lag] = sum;
  }

  let d = 0;
  while (d < trimmedSize - 1 && correlation[d] > correlation[d + 1]) {
    d++;
  }

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < trimmedSize; i++) {
    if (correlation[i] > maxVal) {
      maxVal = correlation[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) {
    return -1;
  }

  let t0 = maxPos;
  const x1 = correlation[t0 - 1] ?? correlation[t0];
  const x2 = correlation[t0];
  const x3 = correlation[t0 + 1] ?? correlation[t0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a !== 0) {
    t0 = t0 - b / (2 * a);
  }

  const freq = sampleRate / t0;
  if (freq < 200 || freq > 2500) {
    return -1;
  }

  return freq;
}

export function createPitchAnalyser(audioContext, fftSize = 2048) {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  const buffer = new Float32Array(fftSize);
  return { analyser, buffer, sampleRate: audioContext.sampleRate };
}

export function readPitch({ analyser, buffer, sampleRate }) {
  analyser.getFloatTimeDomainData(buffer);
  return detectPitch(buffer, sampleRate);
}
