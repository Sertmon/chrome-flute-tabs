import {
  buildMelodyNote,
  frequencyToMidiFloat,
  nearestMidiForPitchClass,
  pitchClassFromMidi,
} from './notes.js';

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
 * Сглаживание частоты; фиксирует имя ноты (pitch class) без октавы.
 */
export class PitchTracker {
  #freqHistory = [];
  #lockedPitchClass = null;
  #candidatePitchClass = null;
  #candidateSince = 0;
  #silenceSince = 0;
  #lastSungMidi = 60;

  reset() {
    this.#freqHistory = [];
    this.#lockedPitchClass = null;
    this.#candidatePitchClass = null;
    this.#candidateSince = 0;
    this.#silenceSince = 0;
    this.#lastSungMidi = 60;
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
        this.#lockedPitchClass = null;
        this.#candidatePitchClass = null;
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
    const sungMidi = Math.round(midiFloat);
    this.#lastSungMidi = sungMidi;

    const pitchClass = this.#resolvePitchClass(midiFloat);
    const liveNote = pitchClass === null
      ? null
      : buildMelodyNote(smoothedFreq, pitchClass, sungMidi);

    if (pitchClass === null) {
      return { liveNote, stableNote: null, freq: smoothedFreq, rms, isSilence: false };
    }

    if (this.#candidatePitchClass !== pitchClass) {
      this.#candidatePitchClass = pitchClass;
      this.#candidateSince = now;
    }

    let stableNote = null;
    const held = now - this.#candidateSince;
    if (held >= STABLE_NOTE_MS) {
      this.#lockedPitchClass = pitchClass;
      stableNote = buildMelodyNote(smoothedFreq, pitchClass, sungMidi);
    }

    return {
      liveNote,
      stableNote,
      freq: smoothedFreq,
      rms,
      isSilence: false,
    };
  }

  #resolvePitchClass(midiFloat) {
    const rounded = Math.round(midiFloat);
    const centsOff = Math.abs((midiFloat - rounded) * 100);
    const pitchClass = pitchClassFromMidi(rounded);

    if (centsOff > MAX_CENTS_OFF_CENTER && this.#lockedPitchClass !== null) {
      return this.#lockedPitchClass;
    }

    if (this.#lockedPitchClass === null) {
      return pitchClass;
    }

    if (pitchClass === this.#lockedPitchClass) {
      return this.#lockedPitchClass;
    }

    const refMidi = nearestMidiForPitchClass(midiFloat, this.#lockedPitchClass);
    const centsFromLocked = Math.abs((midiFloat - refMidi) * 100);
    if (centsFromLocked < HYSTERESIS_CENTS) {
      return this.#lockedPitchClass;
    }

    return pitchClass;
  }
}
