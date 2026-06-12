import { noteKey } from './notes.js';

const MIN_NOTE_MS = 320;
const SILENCE_GAP_MS = 220;

/**
 * Записывает стабильные ноты (имя без октавы) от PitchTracker.
 */
export class NoteRecorder {
  #notes = [];
  #candidate = null;
  #candidateSince = 0;
  #lastFinalizeAt = 0;
  #onChange = () => {};

  constructor(onChange) {
    this.#onChange = onChange;
  }

  get notes() {
    return this.#notes;
  }

  reset() {
    this.#notes = [];
    this.#candidate = null;
    this.#candidateSince = 0;
    this.#lastFinalizeAt = 0;
    this.#onChange();
  }

  undoLast() {
    this.#notes.pop();
    this.#onChange();
  }

  tick(stableNote, isSilence, now = performance.now()) {
    const key = noteKey(stableNote);

    if (key === null) {
      if (isSilence) {
        this.#finalize(now);
      }
      return;
    }

    if (this.#candidate?.pitchClass === key) {
      if (isSilence) {
        this.#finalize(now);
      }
      return;
    }

    this.#finalize(now);
    this.#candidate = stableNote;
    this.#candidateSince = now;
  }

  #finalize(now) {
    if (!this.#candidate) {
      return;
    }

    const held = now - this.#candidateSince;
    if (held < MIN_NOTE_MS) {
      this.#candidate = null;
      return;
    }

    const gap = now - this.#lastFinalizeAt;
    const last = this.#notes[this.#notes.length - 1];
    if (last?.pitchClass === this.#candidate.pitchClass && gap < SILENCE_GAP_MS) {
      this.#candidate = null;
      return;
    }

    this.#notes.push({ ...this.#candidate, recordedAt: now });
    this.#lastFinalizeAt = now;
    this.#candidate = null;
    this.#onChange();
  }

  flush(now = performance.now()) {
    this.#finalize(now);
  }
}
