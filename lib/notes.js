const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_RU = ['до', 'до#', 'ре', 'ре#', 'ми', 'фа', 'фа#', 'соль', 'соль#', 'ля', 'ля#', 'си'];

/** Диапазон сопрано блокфлейты в C (для аппликатуры) */
export const RECORDER_MIDI_MIN = 72; // C5
export const RECORDER_MIDI_MAX = 98; // D7

export function frequencyToMidiFloat(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

export function pitchClassFromMidi(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function pitchClassFromFreq(freq) {
  if (freq <= 0 || !Number.isFinite(freq)) {
    return null;
  }
  return pitchClassFromMidi(Math.round(frequencyToMidiFloat(freq)));
}

/**
 * Ближайшая нота на флейте с тем же именем (до/ре/ми), что и напетая.
 */
export function pitchClassToRecorderMidi(pitchClass, sungMidi) {
  let midi = Math.round(sungMidi);
  midi = midi - pitchClassFromMidi(midi) + pitchClass;
  while (midi < RECORDER_MIDI_MIN) {
    midi += 12;
  }
  while (midi > RECORDER_MIDI_MAX) {
    midi -= 12;
  }
  if (midi < RECORDER_MIDI_MIN || midi > RECORDER_MIDI_MAX) {
    return RECORDER_MIDI_MIN + pitchClass;
  }
  return midi;
}

export function nearestMidiForPitchClass(midiFloat, pitchClass) {
  const octave = Math.round((midiFloat - pitchClass) / 12);
  return octave * 12 + pitchClass;
}

export function buildMelodyNote(freq, pitchClass, sungMidi) {
  const recorderMidi = pitchClassToRecorderMidi(pitchClass, sungMidi);

  return {
    pitchClass,
    sungMidi: Math.round(sungMidi),
    recorderMidi,
    name: NOTE_NAMES[pitchClass],
    nameRu: NOTE_NAMES_RU[pitchClass],
    label: NOTE_NAMES[pitchClass],
    labelRu: NOTE_NAMES_RU[pitchClass],
    freq,
  };
}

export function noteKey(note) {
  return note?.pitchClass ?? null;
}
