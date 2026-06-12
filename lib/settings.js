export const SETTINGS_KEY = 'fluteTabsSettings';

export const DEFAULT_SETTINGS = {
  minNoteMs: 320,
  silenceMs: 200,
  stableNoteMs: 280,
  silenceGapMs: 220,
  rmsSilence: 0.01,
  hysteresisCents: 50,
  maxCentsOffCenter: 45,
  freqHistorySize: 9,
  yinThreshold: 0.12,
  fMin: 100,
  fMax: 4200,
  a4Frequency: 440,
  fftSize: 4096,
  pianoMinOctave: 2,
  pianoMaxOctave: 8,
  pitchScrollPxPerSec: 42,
  inputSource: 'mic',
  recorderType: 'soprano_c',
  recorderOctaveMode: 'nearest',
  noteLanguage: 'ru',
};

export const SETTINGS_FIELDS = [
  { key: 'minNoteMs', label: 'Длительность ноты для списка', unit: 'мс', min: 100, max: 1500, step: 20, group: 'Запись' },
  { key: 'silenceMs', label: 'Пауза = конец ноты', unit: 'мс', min: 50, max: 800, step: 10, group: 'Запись' },
  { key: 'stableNoteMs', label: 'Стабильность ноты', unit: 'мс', min: 80, max: 1000, step: 20, group: 'Запись' },
  { key: 'silenceGapMs', label: 'Пауза для повтора той же ноты', unit: 'мс', min: 50, max: 800, step: 10, group: 'Запись' },
  { key: 'rmsSilence', label: 'Порог тишины (чувствительность)', unit: '', min: 0.002, max: 0.05, step: 0.001, group: 'Микрофон' },
  { key: 'hysteresisCents', label: 'Липкость ноты', unit: 'центов', min: 10, max: 100, step: 5, group: 'Детектор' },
  { key: 'maxCentsOffCenter', label: 'Точность попадания в ноту', unit: 'центов', min: 10, max: 80, step: 5, group: 'Детектор' },
  { key: 'freqHistorySize', label: 'Сглаживание (кадров)', unit: '', min: 3, max: 21, step: 2, group: 'Детектор' },
  { key: 'yinThreshold', label: 'Порог YIN', unit: '', min: 0.05, max: 0.3, step: 0.01, group: 'Детектор' },
  { key: 'fMin', label: 'Мин. частота', unit: 'Hz', min: 80, max: 400, step: 10, group: 'Диапазон' },
  { key: 'fMax', label: 'Макс. частота', unit: 'Hz', min: 1500, max: 5000, step: 50, group: 'Диапазон' },
  { key: 'a4Frequency', label: 'Строй A4', unit: 'Hz', min: 430, max: 450, step: 1, group: 'Диапазон' },
  { key: 'fftSize', label: 'Размер буфера FFT', unit: '', min: 2048, max: 8192, step: 2048, group: 'Детектор' },
  { key: 'pitchScrollPxPerSec', label: 'Масштаб ленты (px/с)', unit: 'px/с', min: 12, max: 120, step: 6, group: 'Лента (клавиатура)' },
];

export const INPUT_SOURCE_OPTIONS = [
  { value: 'mic', label: 'Микрофон' },
  { value: 'tab', label: 'Звук вкладки (YouTube и др.)' },
];

export const RECORDER_TYPE_OPTIONS = [
  { value: 'soprano_c', label: 'Сопрано в C' },
  { value: 'alto_f', label: 'Альт в F' },
];

export const OCTAVE_MODE_OPTIONS = [
  { value: 'nearest', label: 'Ближайшая октава на флейте' },
  { value: 'octave5', label: 'Фикс. 5-я октава (сопрано)' },
  { value: 'octave6', label: 'Фикс. 6-я октава (сопрано)' },
  { value: 'alto4', label: 'Фикс. 4-я октава (альт)' },
];

export const NOTE_LANGUAGE_OPTIONS = [
  { value: 'ru', label: 'до, ре, ми' },
  { value: 'en', label: 'C, D, E' },
  { value: 'both', label: 'Оба варианта' },
];

export const PIANO_OCTAVE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((o) => ({
  value: o,
  label: `C${o}`,
}));

/** MIDI ноты C в заданной октаве (C2 = 36, C8 = 108). */
export function cOctaveToMidi(octave) {
  return 12 * (octave + 1);
}

export function getPianoMidiRange(settings) {
  let low = cOctaveToMidi(settings.pianoMinOctave ?? 2);
  let high = cOctaveToMidi(settings.pianoMaxOctave ?? 8);
  if (low > high) {
    [low, high] = [high, low];
  }
  return { minMidi: low, maxMidi: high };
}

export function clampSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  for (const field of SETTINGS_FIELDS) {
    const v = Number(s[field.key]);
    if (!Number.isFinite(v)) {
      s[field.key] = DEFAULT_SETTINGS[field.key];
      continue;
    }
    s[field.key] = Math.min(field.max, Math.max(field.min, v));
  }
  if (!RECORDER_TYPE_OPTIONS.some((o) => o.value === s.recorderType)) {
    s.recorderType = DEFAULT_SETTINGS.recorderType;
  }
  if (!OCTAVE_MODE_OPTIONS.some((o) => o.value === s.recorderOctaveMode)) {
    s.recorderOctaveMode = DEFAULT_SETTINGS.recorderOctaveMode;
  }
  if (!NOTE_LANGUAGE_OPTIONS.some((o) => o.value === s.noteLanguage)) {
    s.noteLanguage = DEFAULT_SETTINGS.noteLanguage;
  }
  if (!INPUT_SOURCE_OPTIONS.some((o) => o.value === s.inputSource)) {
    s.inputSource = DEFAULT_SETTINGS.inputSource;
  }
  s.pianoMinOctave = Math.min(9, Math.max(1, Math.round(Number(s.pianoMinOctave) || 2)));
  s.pianoMaxOctave = Math.min(9, Math.max(1, Math.round(Number(s.pianoMaxOctave) || 8)));
  if (s.pianoMinOctave > s.pianoMaxOctave) {
    s.pianoMaxOctave = s.pianoMinOctave;
  }
  return s;
}

export async function loadSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return clampSettings(data[SETTINGS_KEY] ?? {});
}

export async function saveSettings(settings) {
  const clamped = clampSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: clamped });
  return clamped;
}

export function getRecorderRange(recorderType) {
  if (recorderType === 'alto_f') {
    return { min: 65, max: 89 };
  }
  return { min: 72, max: 98 };
}
