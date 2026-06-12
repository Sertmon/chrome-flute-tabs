import { createPitchAnalyser, readPitchFrame } from './pitch.js';
import { getFingering, renderFingeringSvg } from './fingering.js';
import { NoteRecorder } from './recorder-session.js';
import { PitchTracker } from './pitch-tracker.js';
import { PitchVisual } from './pitch-visual.js';
import {
  formatNoteLabels,
  frequencyToMidiFloat,
  midiFloatToLabel,
  pitchClassToRecorderMidi,
} from './notes.js';
import {
  explainTabCaptureError,
  getCaptureTab,
  getTabCaptureBlockReason,
  openTabCaptureAudioStream,
} from './tab-audio.js';
import { downloadNotes } from './export-notes.js';
import { DEFAULT_SETTINGS, getPianoMidiRange, loadSettings, saveSettings } from './settings.js';
import { initSettingsForm } from './settings-form.js';

export function initApp(root = document) {
  const startBtn = root.getElementById('startBtn');
  const stopBtn = root.getElementById('stopBtn');
  const clearBtn = root.getElementById('clearBtn');
  const undoBtn = root.getElementById('undoBtn');
  const saveNotesBtn = root.getElementById('saveNotesBtn');
  const liveNote = root.getElementById('liveNote');
  const liveFreq = root.getElementById('liveFreq');
  const liveMelody = root.getElementById('liveMelody');
  const liveFingering = root.getElementById('liveFingering');
  const liveHint = root.getElementById('liveHint');
  const liveMeta = root.querySelector('.live-meta');
  const noteList = root.getElementById('noteList');
  const emptyState = root.getElementById('emptyState');
  const micHelp = root.getElementById('micHelp');
  const subtitle = root.querySelector('.subtitle');
  const visualCanvas = root.getElementById('pitchVisualCanvas');
  const inputSourceSelect = root.getElementById('inputSourceSelect');
  const tabTargetHint = root.getElementById('tabTargetHint');
  let audioContext = null;
  let mediaStream = null;
  let pitchKit = null;
  let pitchTracker = null;
  const initialPiano = getPianoMidiRange(DEFAULT_SETTINGS);
  let pitchVisual = visualCanvas
    ? new PitchVisual(visualCanvas, {
      ...initialPiano,
      scrollPxPerSec: DEFAULT_SETTINGS.pitchScrollPxPerSec,
    })
    : null;
  if (pitchVisual) {
    pitchVisual.attachScrollSlider(
      root.getElementById('pitchTapeScroll'),
      root.getElementById('pitchTapeScrollCol'),
    );
    pitchVisual.setOnPitchZoomChange(syncPitchZoomUi);
    syncPitchZoomUi({ zoomed: false, canPan: false });

    const canvasHost = visualCanvas?.parentElement;
    canvasHost?.addEventListener('wheel', (event) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      if (event.deltaY < 0) {
        pitchVisual.zoomIn();
      } else {
        pitchVisual.zoomOut();
      }
    }, { passive: false });

    root.getElementById('pitchZoomIn')?.addEventListener('click', () => pitchVisual.zoomIn());
    root.getElementById('pitchZoomOut')?.addEventListener('click', () => pitchVisual.zoomOut());
    root.getElementById('pitchZoomReset')?.addEventListener('click', () => pitchVisual.resetPitchView());
    root.getElementById('pitchPanLeft')?.addEventListener('click', () => pitchVisual.panPitchSemitones(-3));
    root.getElementById('pitchPanRight')?.addEventListener('click', () => pitchVisual.panPitchSemitones(3));
  }

  function syncPitchZoomUi(state) {
    const panLeft = root.getElementById('pitchPanLeft');
    const panRight = root.getElementById('pitchPanRight');
    const zoomReset = root.getElementById('pitchZoomReset');
    if (panLeft) {
      panLeft.disabled = !state?.canPan;
    }
    if (panRight) {
      panRight.disabled = !state?.canPan;
    }
    if (zoomReset) {
      zoomReset.disabled = !state?.zoomed;
    }
  }
  let rafId = 0;
  let settings = { ...DEFAULT_SETTINGS };

  const session = new NoteRecorder(renderSequence, settings);

  function applySettings(next) {
    settings = next;
    session.setSettings(settings);
    pitchTracker?.setSettings(settings);
    const piano = getPianoMidiRange(settings);
    pitchVisual?.setRange(piano.minMidi, piano.maxMidi);
    pitchVisual?.setTapeOptions({
      scrollPxPerSec: settings.pitchScrollPxPerSec,
    });
    updateSubtitle();
    syncInputSourceUi();
    if (session.notes.length) {
      renderSequence();
    }
  }

  function updateSubtitle() {
    if (!subtitle) {
      return;
    }
    const typeLabel = settings.recorderType === 'alto_f' ? 'Альт в F' : 'Сопрано в C';
    const sourceLabel = settings.inputSource === 'tab' ? 'звук вкладки' : 'микрофон';
    subtitle.textContent = `${typeLabel} · ${sourceLabel} → ноты → аппликатура`;
  }

  function syncInputSourceUi() {
    if (inputSourceSelect) {
      inputSourceSelect.value = settings.inputSource;
    }
    updateTabTargetHint();
  }

  async function updateTabTargetHint() {
    if (!tabTargetHint) {
      return;
    }
    if (settings.inputSource !== 'tab') {
      tabTargetHint.hidden = true;
      return;
    }
    try {
      const tab = await getCaptureTab();
      const block = getTabCaptureBlockReason(tab.url);
      if (block) {
        tabTargetHint.textContent = block;
        tabTargetHint.hidden = false;
        return;
      }
      const title = tab.title?.trim() || tab.url || 'вкладка';
      tabTargetHint.textContent = `«${title}». Нажмите «Слушать» — звук пойдёт с вкладки, без диалога Chrome.`;
      tabTargetHint.hidden = false;
    } catch {
      tabTargetHint.hidden = true;
    }
  }

  loadSettings().then((loaded) => {
    applySettings(loaded);
    initSettingsForm(root, applySettings);
  });

  inputSourceSelect?.addEventListener('change', async () => {
    const next = await saveSettings({
      ...settings,
      inputSource: inputSourceSelect.value,
    });
    applySettings(next);
  });

  startBtn.addEventListener('click', startListening);
  stopBtn.addEventListener('click', stopListening);
  clearBtn.addEventListener('click', () => {
    session.reset();
    pitchTracker?.reset();
    pitchVisual?.clear();
    renderSequence();
  });
  undoBtn.addEventListener('click', () => {
    session.undoLast();
  });
  saveNotesBtn?.addEventListener('click', () => {
    if (!downloadNotes(session.notes, settings)) {
      return;
    }
    const prev = liveHint.textContent;
    liveHint.textContent = 'Ноты с аппликатурой сохранены в HTML (порядок 1, 2, 3…).';
    liveHint.classList.remove('error');
    window.setTimeout(() => {
      if (liveHint.textContent === 'Ноты с аппликатурой сохранены в HTML (порядок 1, 2, 3…).') {
        liveHint.textContent = prev;
      }
    }, 2500);
  });

  function getPitchSettings() {
    if (settings.inputSource === 'tab') {
      return { ...settings, rmsSilence: Math.min(settings.rmsSilence, 0.002) };
    }
    return settings;
  }

  async function startLocalPitchLoop(hintText) {
    const pitchSettings = getPitchSettings();
    audioContext = new AudioContext();
    await audioContext.resume();

    const source = audioContext.createMediaStreamSource(mediaStream);
    pitchKit = createPitchAnalyser(audioContext, pitchSettings.fftSize);
    pitchTracker = new PitchTracker(pitchSettings);
    source.connect(pitchKit.analyser);

    if (settings.inputSource === 'tab') {
      source.connect(audioContext.destination);
    } else {
      const silent = audioContext.createGain();
      silent.gain.value = 0;
      pitchKit.analyser.connect(silent);
      silent.connect(audioContext.destination);
    }

    pitchVisual?.clear();
    pitchVisual?.setLiveMode(true);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    clearBtn.disabled = false;
    undoBtn.disabled = false;
    if (inputSourceSelect) {
      inputSourceSelect.disabled = true;
    }
    liveHint.textContent = hintText;
    loop();
  }

  async function startListening() {
    hideMicHelp();
    liveHint.classList.remove('error');

    if (!navigator.mediaDevices?.getUserMedia) {
      showMicError(
        'Браузер не поддерживает захват звука в этом окне.',
        'Откройте расширение через боковую панель (клик по иконке) и попробуйте снова.',
      );
      return;
    }

    const useTab = settings.inputSource === 'tab';

    try {
      if (useTab) {
        const tab = await getCaptureTab();
        const block = getTabCaptureBlockReason(tab.url);
        if (block) {
          throw new Error(block);
        }
        liveHint.textContent = `Подключаем звук вкладки «${tab.title?.trim() || 'YouTube'}»…`;
        mediaStream = await openTabCaptureAudioStream(tab.id);
        await startLocalPitchLoop(
          'Слушаем вкладку — ноты появятся ниже. Лучше всего одна флейта в записи.',
        );
        return;
      }

      liveHint.textContent = 'Запрашиваем доступ к микрофону…';
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await startLocalPitchLoop('Играйте или напевайте — ноты появятся ниже.');
    } catch (err) {
      showMicError(...describeCaptureError(err, useTab));
      console.error(err);
    }
  }

  function stopListening() {
    cancelAnimationFrame(rafId);
    session.flush();

    const stopTime = performance.now();
    pitchVisual?.setLiveMode(false, stopTime);

    if (mediaStream) {
      for (const track of mediaStream.getTracks()) {
        track.stop();
      }
      mediaStream = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    pitchKit = null;
    pitchTracker?.reset();
    pitchTracker = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (inputSourceSelect) {
      inputSourceSelect.disabled = false;
    }

    resetLiveDisplay();
    if (pitchVisual?.hasHistory()) {
      liveHint.textContent = 'Стоп. Ползунок слева от ленты — просмотр истории. «Слушать» — новая запись.';
    } else {
      liveHint.textContent = 'Нажмите «Слушать» и играйте на флейте или напевайте.';
    }
  }

  function resetLiveDisplay() {
    liveNote.textContent = '—';
    liveFreq.textContent = '— Hz';
    if (liveMelody) {
      liveMelody.textContent = '';
    }
    liveFingering.innerHTML = '';
    liveMeta?.classList.remove('note-save-ready');
    if (pitchKit) {
      pitchVisual?.update({ active: false });
    }
  }

  function syncSaveReadyIndicator() {
    if (!liveMeta) {
      return;
    }
    const pending = session.getPendingState();
    liveMeta.classList.toggle('note-save-ready', Boolean(pending?.saveReady));
  }

  function loop() {
    if (!pitchKit) {
      return;
    }

    const frame = readPitchFrame(pitchKit, getPitchSettings());
    const tracked = pitchTracker.process(frame);

    updateLive(tracked);
    session.tick(tracked.stableNote, tracked.isSilence);
    syncSaveReadyIndicator();
    rafId = requestAnimationFrame(loop);
  }

  function updateLive(tracked) {
    const { liveNote: melodyNote, freq } = tracked;
    const rms = tracked.rms;

    if (freq <= 0) {
      liveNote.textContent = '…';
      if (settings.inputSource === 'tab' && rms > 0.0003) {
        const pct = Math.min(100, Math.round(rms * 400));
        liveFreq.textContent = `сигнал ~${pct}%`;
      } else {
        liveFreq.textContent = '— Hz';
      }
      if (liveMelody) {
        liveMelody.textContent = '';
      }
      liveFingering.innerHTML = '';
      liveMeta?.classList.remove('note-save-ready');
      pitchVisual?.update({ active: false });
      return;
    }

    const midiFloat = frequencyToMidiFloat(freq, settings.a4Frequency);
    const cents = Math.round((midiFloat - Math.round(midiFloat)) * 100);

    liveNote.textContent = midiFloatToLabel(midiFloat);
    liveFreq.textContent = `${Math.round(freq)} Hz`;

    pitchVisual?.update({ midiFloat, cents, active: true });

    if (melodyNote) {
      const labels = formatNoteLabels(melodyNote, settings);
      if (liveMelody) {
        liveMelody.textContent = `→ ${labels.primary}`;
      }
      const recorderMidi = pitchClassToRecorderMidi(
        melodyNote.pitchClass,
        melodyNote.sungMidi,
        settings,
      );
      const fingering = getFingering(recorderMidi, settings.recorderType, settings.fingeringSystem);
      liveFingering.innerHTML = fingering
        ? renderFingeringSvg(fingering.holes, 'large')
        : '<span class="hint">Нет аппликатуры</span>';
    } else {
      if (liveMelody) {
        liveMelody.textContent = '';
      }
      liveFingering.innerHTML = '';
    }
  }

  function renderSequence() {
    const notes = session.notes;
    const hasNotes = notes.length > 0;

    emptyState.hidden = hasNotes;
    noteList.hidden = !hasNotes;
    if (saveNotesBtn) {
      saveNotesBtn.disabled = !hasNotes;
    }
    noteList.innerHTML = '';

    for (let i = notes.length - 1; i >= 0; i -= 1) {
      const note = notes[i];
      const labels = formatNoteLabels(note, settings);
      const recorderMidi = note.recorderMidi
        ?? pitchClassToRecorderMidi(note.pitchClass, note.sungMidi, settings);
      const fingering = getFingering(recorderMidi, settings.recorderType, settings.fingeringSystem);
      const item = document.createElement('li');
      item.className = 'note-item';
      item.innerHTML = `
        <span class="note-label">${labels.primary}${labels.secondary ? ` <small>${labels.secondary}</small>` : ''}</span>
        <span class="note-fingering"></span>
        <button type="button" class="note-delete" data-index="${i}" title="Удалить ноту" aria-label="Удалить ноту">×</button>
      `;
      const slot = item.querySelector('.note-fingering');
      if (fingering) {
        slot.innerHTML = renderFingeringSvg(fingering.holes, 'small');
      }
      item.querySelector('.note-delete')?.addEventListener('click', () => {
        session.removeAt(i);
      });
      noteList.appendChild(item);
    }

    noteList.scrollTop = 0;
  }

  function showMicError(title, details) {
    liveHint.textContent = title;
    liveHint.classList.add('error');
    if (micHelp) {
      micHelp.hidden = false;
      micHelp.querySelector('.mic-help-text').textContent = details;
    }
  }

  function hideMicHelp() {
    if (micHelp) {
      micHelp.hidden = true;
    }
  }

  return { stopListening };
}

function describeCaptureError(err, useTab) {
  const name = err?.name ?? 'Error';
  const message = err?.message ?? String(err);

  if (message && !useTab && name === 'Error') {
    return [message, ''];
  }

  if (useTab) {
    const explained = explainTabCaptureError(message);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return [
        'Захват звука вкладки запрещён.',
        explained,
      ];
    }
    return [
      explained || message,
      'Откройте YouTube, нажмите иконку расширения на этой вкладке, затем «Слушать».',
    ];
  }

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return [
      'Доступ к микрофону запрещён.',
      'В общий список сайтов расширение вручную не добавить. '
        + 'Нажмите «Разрешения расширения» ниже и выберите «Микрофон → Разрешить». '
        + 'Или откройте версию во вкладке и снова нажмите «Слушать».',
    ];
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return [
      'Микрофон не найден.',
      'Подключите микрофон или проверьте, что он не отключён в Windows: Параметры → Конфиденциальность → Микрофон.',
    ];
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return [
      'Микрофон занят другим приложением.',
      'Закройте Zoom, Telegram, Discord и другие программы, использующие микрофон, и попробуйте снова.',
    ];
  }

  return [
    `Ошибка микрофона (${name}).`,
    message,
  ];
}
