const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_RU = ['до', 'до#', 'ре', 'ре#', 'ми', 'фа', 'фа#', 'соль', 'соль#', 'ля', 'ля#', 'си'];

/** Диапазон сопрано блокфлейты в C */
export const RECORDER_MIDI_MIN = 72; // C5
export const RECORDER_MIDI_MAX = 98; // D7

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyToMidiFloat(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

function buildNote(midi, freq) {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const midiFloat = frequencyToMidiFloat(freq);
  const cents = Math.round((midiFloat - midi) * 100);

  return {
    midi,
    name: NOTE_NAMES[noteIndex],
    nameRu: NOTE_NAMES_RU[noteIndex],
    octave,
    label: `${NOTE_NAMES[noteIndex]}${octave}`,
    labelRu: `${NOTE_NAMES_RU[noteIndex]}${octave}`,
    cents,
    freq,
    inRange: midi >= RECORDER_MIDI_MIN && midi <= RECORDER_MIDI_MAX,
  };
}

export function frequencyToNote(freq) {
  if (freq <= 0 || !Number.isFinite(freq)) {
    return null;
  }

  const midi = Math.round(frequencyToMidiFloat(freq));
  return buildNote(midi, freq);
}

/**
 * Напевание часто на октаву ниже флейты — сдвигаем в диапазон блокфлейты.
 */
export function normalizeToRecorderRange(note) {
  if (!note) {
    return null;
  }
  if (note.inRange) {
    return note;
  }

  for (const shift of [12, -12, 24, -24]) {
    const shifted = note.midi + shift;
    if (shifted >= RECORDER_MIDI_MIN && shifted <= RECORDER_MIDI_MAX) {
      return buildNote(shifted, midiToFrequency(shifted));
    }
  }

  return note;
}

export function noteKey(note) {
  return note?.midi ?? null;
}
