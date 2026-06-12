import { frequencyToNote, frequencyToMidiFloat, midiToFrequency, normalizeToRecorderRange } from './notes.js';

const FREQ_HISTORY_SIZE = 9;
const STABLE_NOTE_MS = 280;
const SILENCE_MS = 200;
const HYSTERESIS_CENTS = 50;
const MAX_CENTS_OFF_CENTER = 45;

function median(values) {
  if (!values.length) {
    return -1;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Сглаживание частоты, гистерезис по ноте, стабильность по времени.
 */
export class PitchTracker {
  #freqHistory = [];
  #lockedMidi = null;
  #candidateMidi = null;
  #candidateSince = 0;
  #silenceSince = 0;
  #lastStableNote = null;

  reset() {
    this.#freqHistory = [];
    this.#lockedMidi = null;
    this.#candidateMidi = null;
    this.#candidateSince = 0;
    this.#silenceSince = 0;
    this.#lastStableNote = null;
  }

  /**
   * @returns {{ liveNote, stableNote, freq, rms, isSilence }}
   */
  process({ freq, rms }, now = performance.now()) {
    if (freq <= 0 || rms < 0.01) {
      if (!this.#silenceSince) {
        this.#silenceSince = now;
      }
      const isSilence = now - this.#silenceSince >= SILENCE_MS;
      if (isSilence) {
        this.#lockedMidi = null;
        this.#candidateMidi = null;
      }
      return {
        liveNote: null,
        stableNote: null,
        freq: -1,
        rms,
        isSilence,
      };
    }

    this.#silenceSince = 0;
    this.#freqHistory.push(freq);
    if (this.#freqHistory.length > FREQ_HISTORY_SIZE) {
      this.#freqHistory.shift();
    }

    const smoothedFreq = median(this.#freqHistory);
    const midiFloat = frequencyToMidiFloat(smoothedFreq);
    const resolvedMidi = this.#resolveMidi(midiFloat, smoothedFreq);
    const liveNote = normalizeToRecorderRange(frequencyToNote(smoothedFreq));
    if (liveNote && resolvedMidi !== null) {
      liveNote.midi = resolvedMidi;
      const corrected = frequencyToNote(midiToFrequency(resolvedMidi));
      Object.assign(liveNote, corrected, { freq: smoothedFreq });
    }

    if (resolvedMidi === null) {
      return { liveNote, stableNote: null, freq: smoothedFreq, rms, isSilence: false };
    }

    if (this.#candidateMidi !== resolvedMidi) {
      this.#candidateMidi = resolvedMidi;
      this.#candidateSince = now;
    }

    let stableNote = null;
    const held = now - this.#candidateSince;
    if (held >= STABLE_NOTE_MS) {
      this.#lockedMidi = resolvedMidi;
      const note = normalizeToRecorderRange(frequencyToNote(midiToFrequency(resolvedMidi)));
      if (note?.inRange) {
        note.freq = smoothedFreq;
        stableNote = note;
        this.#lastStableNote = note;
      }
    }

    return {
      liveNote,
      stableNote,
      freq: smoothedFreq,
      rms,
      isSilence: false,
    };
  }

  #resolveMidi(midiFloat, freq) {
    const rounded = Math.round(midiFloat);
    const centsOff = Math.abs((midiFloat - rounded) * 100);
    if (centsOff > MAX_CENTS_OFF_CENTER) {
      return this.#lockedMidi;
    }

    if (this.#lockedMidi === null) {
      return rounded;
    }

    const lockedFreq = midiToFrequency(this.#lockedMidi);
    const centsFromLocked = Math.abs(1200 * Math.log2(freq / lockedFreq));
    if (centsFromLocked < HYSTERESIS_CENTS) {
      return this.#lockedMidi;
    }

    return rounded;
  }
}
