import { noteKey } from './notes.js';
import { DEFAULT_SETTINGS } from './settings.js';

export class NoteRecorder {
  #notes = [];
  #candidate = null;
  #candidateSince = 0;
  #lastFinalizeAt = 0;
  #onChange = () => {};
  #settings;

  constructor(onChange, settings = DEFAULT_SETTINGS) {
    this.#onChange = onChange;
    this.#settings = settings;
  }

  setSettings(settings) {
    this.#settings = settings;
  }

  get notes() {
    return this.#notes;
  }

  getPendingState(now = performance.now()) {
    if (!this.#candidate) {
      return null;
    }
    const heldMs = now - this.#candidateSince;
    return {
      note: this.#candidate,
      heldMs,
      saveReady: heldMs >= this.#settings.minNoteMs,
    };
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

  removeAt(index) {
    if (index < 0 || index >= this.#notes.length) {
      return;
    }
    this.#notes.splice(index, 1);
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

    if (this.#candidate && noteKey(this.#candidate) === key) {
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
    if (held < this.#settings.minNoteMs) {
      this.#candidate = null;
      return;
    }

    const gap = now - this.#lastFinalizeAt;
    const last = this.#notes[this.#notes.length - 1];
    if (noteKey(last) === noteKey(this.#candidate) && gap < this.#settings.silenceGapMs) {
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
