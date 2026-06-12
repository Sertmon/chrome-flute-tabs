import { noteKey } from './notes.js';

const MIN_NOTE_MS = 160;
const SILENCE_GAP_MS = 120;

/**
 * Накапливает стабильные ноты: при смене ноты или паузе фиксирует предыдущую.
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

  tick(note, now = performance.now()) {
    const key = noteKey(note);

    if (key === null || !note?.inRange) {
      this.#maybeFinalize(now);
      this.#candidate = null;
      return;
    }

    if (this.#candidate?.midi === key) {
      return;
    }

    this.#maybeFinalize(now);
    this.#candidate = note;
    this.#candidateSince = now;
  }

  #maybeFinalize(now) {
    if (!this.#candidate) {
      return;
    }

    const held = now - this.#candidateSince;
    if (held < MIN_NOTE_MS) {
      return;
    }

    const gap = now - this.#lastFinalizeAt;
    const last = this.#notes[this.#notes.length - 1];
    if (last?.midi === this.#candidate.midi && gap < SILENCE_GAP_MS) {
      this.#candidate = null;
      return;
    }

    this.#notes.push({ ...this.#candidate, recordedAt: now });
    this.#lastFinalizeAt = now;
    this.#candidate = null;
    this.#onChange();
  }

  flush(now = performance.now()) {
    this.#maybeFinalize(now);
  }
}
