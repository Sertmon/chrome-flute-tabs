import {
  buildMelodyNote,
  frequencyToMidiFloat,
  nearestMidiForPitchClass,
  pitchClassFromMidi,
} from './notes.js';
import { DEFAULT_SETTINGS } from './settings.js';

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

export class PitchTracker {
  #freqHistory = [];
  #lockedPitchClass = null;
  #candidatePitchClass = null;
  #candidateSince = 0;
  #silenceSince = 0;
  #settings;

  constructor(settings = DEFAULT_SETTINGS) {
    this.#settings = settings;
  }

  setSettings(settings) {
    this.#settings = settings;
  }

  reset() {
    this.#freqHistory = [];
    this.#lockedPitchClass = null;
    this.#candidatePitchClass = null;
    this.#candidateSince = 0;
    this.#silenceSince = 0;
  }

  process({ freq, rms }, now = performance.now()) {
    const s = this.#settings;

    if (freq <= 0 || rms < s.rmsSilence) {
      if (!this.#silenceSince) {
        this.#silenceSince = now;
      }
      const isSilence = now - this.#silenceSince >= s.silenceMs;
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
    const maxHistory = Math.max(3, Math.round(s.freqHistorySize));
    if (this.#freqHistory.length > maxHistory) {
      this.#freqHistory.shift();
    }

    const smoothedFreq = median(this.#freqHistory);
    const midiFloat = frequencyToMidiFloat(smoothedFreq, s.a4Frequency);
    const sungMidi = Math.round(midiFloat);

    const pitchClass = this.#resolvePitchClass(midiFloat);
    const liveNote = pitchClass === null
      ? null
      : buildMelodyNote(smoothedFreq, pitchClass, sungMidi, s);

    if (pitchClass === null) {
      return { liveNote, stableNote: null, freq: smoothedFreq, rms, isSilence: false };
    }

    if (this.#candidatePitchClass !== pitchClass) {
      this.#candidatePitchClass = pitchClass;
      this.#candidateSince = now;
    }

    let stableNote = null;
    const held = now - this.#candidateSince;
    if (held >= s.stableNoteMs) {
      this.#lockedPitchClass = pitchClass;
      stableNote = buildMelodyNote(smoothedFreq, pitchClass, sungMidi, s);
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
    const s = this.#settings;
    const rounded = Math.round(midiFloat);
    const centsOff = Math.abs((midiFloat - rounded) * 100);
    const pitchClass = pitchClassFromMidi(rounded);

    if (centsOff > s.maxCentsOffCenter && this.#lockedPitchClass !== null) {
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
    if (centsFromLocked < s.hysteresisCents) {
      return this.#lockedPitchClass;
    }

    return pitchClass;
  }
}
