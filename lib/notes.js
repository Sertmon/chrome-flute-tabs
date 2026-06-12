const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_RU = ['до', 'до#', 'ре', 'ре#', 'ми', 'фа', 'фа#', 'соль', 'соль#', 'ля', 'ля#', 'си'];

/** Диапазон сопрано блокфлейты в C */
export const RECORDER_MIDI_MIN = 72; // C5
export const RECORDER_MIDI_MAX = 98; // D7

export function frequencyToNote(freq) {
  if (freq <= 0) {
    return null;
  }

  const midiFloat = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(midiFloat);
  const cents = Math.round((midiFloat - midi) * 100);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[noteIndex];

  return {
    midi,
    name,
    nameRu: NOTE_NAMES_RU[noteIndex],
    octave,
    label: `${name}${octave}`,
    labelRu: `${NOTE_NAMES_RU[noteIndex]}${octave}`,
    cents,
    freq,
    inRange: midi >= RECORDER_MIDI_MIN && midi <= RECORDER_MIDI_MAX,
  };
}

export function noteKey(note) {
  return note?.midi ?? null;
}
