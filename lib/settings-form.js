import {
  DEFAULT_SETTINGS,
  INPUT_SOURCE_OPTIONS,
  NOTE_LANGUAGE_OPTIONS,
  OCTAVE_MODE_OPTIONS,
  PIANO_OCTAVE_OPTIONS,
  FINGERING_SYSTEM_OPTIONS,
  RECORDER_TYPE_OPTIONS,
  SETTINGS_FIELDS,
  loadSettings,
  saveSettings,
} from './settings.js';

function buildRangeField(field, value) {
  const id = `setting-${field.key}`;
  const display = field.step < 1 ? Number(value).toFixed(3) : String(value);
  return `
    <label class="setting-row" for="${id}">
      <span class="setting-label">${field.label}</span>
      <span class="setting-control">
        <input type="range" id="${id}" name="${field.key}"
          min="${field.min}" max="${field.max}" step="${field.step}" value="${value}">
        <output for="${id}" class="setting-value">${display}${field.unit ? ` ${field.unit}` : ''}</output>
      </span>
    </label>
  `;
}

function buildSelect(name, label, options, value) {
  const id = `setting-${name}`;
  const opts = options.map((o) => {
    const v = String(o.value);
    const selected = String(value) === v ? ' selected' : '';
    return `<option value="${v}"${selected}>${o.label}</option>`;
  }).join('');
  return `
    <label class="setting-row" for="${id}">
      <span class="setting-label">${label}</span>
      <span class="setting-control">
        <select id="${id}" name="${name}">${opts}</select>
      </span>
    </label>
  `;
}

export function renderSettingsForm(container, settings) {
  const groups = [...new Set(SETTINGS_FIELDS.map((f) => f.group))];
  let html = '';

  for (const group of groups) {
    html += `<fieldset class="settings-group"><legend>${group}</legend>`;
    for (const field of SETTINGS_FIELDS.filter((f) => f.group === group)) {
      html += buildRangeField(field, settings[field.key]);
    }
    html += '</fieldset>';
  }

  html += '<fieldset class="settings-group"><legend>Пианино (монитор)</legend>';
  html += buildSelect('pianoMinOctave', 'Нижняя октава (C)', PIANO_OCTAVE_OPTIONS, settings.pianoMinOctave);
  html += buildSelect('pianoMaxOctave', 'Верхняя октава (C)', PIANO_OCTAVE_OPTIONS, settings.pianoMaxOctave);
  html += '</fieldset>';

  html += '<fieldset class="settings-group"><legend>Источник звука</legend>';
  html += buildSelect('inputSource', 'По умолчанию', INPUT_SOURCE_OPTIONS, settings.inputSource);
  html += '</fieldset>';

  html += '<fieldset class="settings-group"><legend>Флейта и отображение</legend>';
  html += buildSelect('recorderType', 'Тип флейты', RECORDER_TYPE_OPTIONS, settings.recorderType);
  html += buildSelect('fingeringSystem', 'Система аппликатуры', FINGERING_SYSTEM_OPTIONS, settings.fingeringSystem);
  html += buildSelect('recorderOctaveMode', 'Октава для табов', OCTAVE_MODE_OPTIONS, settings.recorderOctaveMode);
  html += buildSelect('noteLanguage', 'Язык нот', NOTE_LANGUAGE_OPTIONS, settings.noteLanguage);
  html += '</fieldset>';

  html += `
    <div class="settings-actions">
      <button type="button" id="resetSettingsBtn" class="btn-secondary">Сбросить по умолчанию</button>
    </div>
  `;

  container.innerHTML = html;
}

export function readSettingsForm(container) {
  const data = {};
  for (const field of SETTINGS_FIELDS) {
    const input = container.querySelector(`[name="${field.key}"]`);
    data[field.key] = field.step < 1 ? parseFloat(input.value) : parseInt(input.value, 10);
  }
  for (const key of ['inputSource', 'recorderType', 'fingeringSystem', 'recorderOctaveMode', 'noteLanguage', 'pianoMinOctave', 'pianoMaxOctave']) {
    const el = container.querySelector(`[name="${key}"]`);
    data[key] = key.startsWith('piano') ? parseInt(el.value, 10) : el.value;
  }
  return data;
}

export async function initSettingsForm(root, onChange) {
  const details = root.getElementById('settingsPanel');
  const container = root.getElementById('settingsForm');
  if (!details || !container) {
    return () => {};
  }

  let settings = await loadSettings();
  renderSettingsForm(container, settings);

  const apply = async (next) => {
    settings = await saveSettings({ ...settings, ...next });
    onChange(settings);
  };

  container.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
      return;
    }
    if (target instanceof HTMLInputElement && target.type === 'range') {
      const output = target.parentElement?.querySelector('output');
      const field = SETTINGS_FIELDS.find((f) => f.key === target.name);
      if (output && field) {
        const v = field.step < 1 ? Number(target.value).toFixed(3) : target.value;
        output.textContent = `${v}${field.unit ? ` ${field.unit}` : ''}`;
      }
    }
    apply(readSettingsForm(container));
  });

  container.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement) {
      apply(readSettingsForm(container));
    }
  });

  root.getElementById('resetSettingsBtn')?.addEventListener('click', async () => {
    settings = await saveSettings({ ...DEFAULT_SETTINGS });
    renderSettingsForm(container, settings);
    onChange(settings);
  });

  return () => settings;
}
