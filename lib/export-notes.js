import { getFingering, renderFingeringSvg } from './fingering.js';
import { formatNoteLabels, pitchClassToRecorderMidi } from './notes.js';

const EXPORT_STYLES = `
body { font: 14px/1.4 system-ui, sans-serif; margin: 16px; color: #1c1c1c; }
h1 { font-size: 18px; margin: 0 0 12px; }
ol { margin: 0; padding: 0; list-style: none; }
.note { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #e8ecf2; }
.num { color: #5c6672; min-width: 1.5em; text-align: right; }
.label { font-weight: 600; min-width: 4em; }
.alt { font-weight: 400; color: #5c6672; }
.fingering-svg { flex-shrink: 0; }
`;

export function buildNotesExportText(notes, settings) {
  if (!notes.length) {
    return '';
  }

  return notes
    .map((note, index) => {
      const labels = formatNoteLabels(note, settings);
      const extra = labels.secondary ? ` ${labels.secondary}` : '';
      return `${index + 1}. ${labels.primary}${extra}`;
    })
    .join('\n');
}

export function buildNotesExportHtml(notes, settings) {
  if (!notes.length) {
    return '';
  }

  const items = notes.map((note, index) => {
    const labels = formatNoteLabels(note, settings);
    const recorderMidi = note.recorderMidi
      ?? pitchClassToRecorderMidi(note.pitchClass, note.sungMidi, settings);
    const fingering = getFingering(recorderMidi, settings.recorderType);
    const svg = fingering ? renderFingeringSvg(fingering.holes, 'small') : '';
    const extra = labels.secondary
      ? ` <span class="alt">${escapeHtml(labels.secondary)}</span>`
      : '';
    return `<li class="note"><span class="num">${index + 1}.</span>`
      + `<span class="label">${escapeHtml(labels.primary)}${extra}</span>${svg}</li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Флейта — записанные ноты</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  <h1>Записанные ноты</h1>
  <ol>${items}</ol>
</body>
</html>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadNotes(notes, settings) {
  const html = buildNotesExportHtml(notes, settings);
  if (!html) {
    return false;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fleyta-noty_${stamp}.html`;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
