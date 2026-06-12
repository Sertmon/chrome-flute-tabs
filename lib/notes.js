import { DEFAULT_SETTINGS, getRecorderRange } from './settings.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_RU = ['до', 'до#', 'ре', 'ре#', 'ми', 'фа', 'фа#', 'соль', 'соль#', 'ля', 'ля#', 'си'];

export function frequencyToMidiFloat(freq, a4 = 440) {
  return 69 + 12 * Math.log2(freq / a4);
}

export function pitchClassFromMidi(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

function fixedRecorderMidi(pitchClass, settings) {
  const type = settings.recorderType;
  const mode = settings.recorderOctaveMode;
  const refPc = type === 'alto_f' || mode === 'alto4' ? 5 : 0;

  let base = 72;
  if (type === 'alto_f' || mode === 'alto4') {
    base = mode === 'octave5' ? 77 : 65;
  } else if (mode === 'octave6') {
    base = 84;
  }

  return base + ((pitchClass - refPc + 12) % 12);
}

export function pitchClassToRecorderMidi(pitchClass, sungMidi, settings = DEFAULT_SETTINGS) {
  const { min, max } = getRecorderRange(settings.recorderType);

  if (settings.recorderOctaveMode !== 'nearest') {
    let midi = fixedRecorderMidi(pitchClass, settings);
    while (midi < min) {
      midi += 12;
    }
    while (midi > max) {
      midi -= 12;
    }
    if (midi >= min && midi <= max) {
      return midi;
    }
  }

  let midi = Math.round(sungMidi);
  midi = midi - pitchClassFromMidi(midi) + pitchClass;
  while (midi < min) {
    midi += 12;
  }
  while (midi > max) {
    midi -= 12;
  }
  if (midi < min || midi > max) {
    return fixedRecorderMidi(pitchClass, settings);
  }
  return midi;
}

export function nearestMidiForPitchClass(midiFloat, pitchClass) {
  const octave = Math.round((midiFloat - pitchClass) / 12);
  return octave * 12 + pitchClass;
}

export function formatNoteLabels(note, settings = DEFAULT_SETTINGS) {
  const { noteLanguage } = settings;
  if (noteLanguage === 'en') {
    return { primary: note.name, secondary: note.nameRu };
  }
  if (noteLanguage === 'both') {
    return { primary: `${note.labelRu} / ${note.name}`, secondary: '' };
  }
  return { primary: note.labelRu, secondary: note.name };
}

export function buildMelodyNote(freq, pitchClass, sungMidi, settings = DEFAULT_SETTINGS) {
  const recorderMidi = pitchClassToRecorderMidi(pitchClass, sungMidi, settings);

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

export function midiFloatToLabel(midiFloat) {
  if (!Number.isFinite(midiFloat)) {
    return '—';
  }
  const midi = Math.round(midiFloat);
  const pc = pitchClassFromMidi(midi);
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}
