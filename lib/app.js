import { createPitchAnalyser, readPitchFrame } from './pitch.js';
import { getFingering, renderFingeringSvg } from './fingering.js';
import { NoteRecorder } from './recorder-session.js';
import { PitchTracker } from './pitch-tracker.js';

export function initApp(root = document) {
  const startBtn = root.getElementById('startBtn');
  const stopBtn = root.getElementById('stopBtn');
  const clearBtn = root.getElementById('clearBtn');
  const undoBtn = root.getElementById('undoBtn');
  const liveNote = root.getElementById('liveNote');
  const liveFreq = root.getElementById('liveFreq');
  const liveRu = root.getElementById('liveRu');
  const liveFingering = root.getElementById('liveFingering');
  const liveHint = root.getElementById('liveHint');
  const noteList = root.getElementById('noteList');
  const emptyState = root.getElementById('emptyState');
  const micHelp = root.getElementById('micHelp');

let audioContext = null;
let mediaStream = null;
let pitchKit = null;
let pitchTracker = null;
let rafId = 0;

const session = new NoteRecorder(renderSequence);

  startBtn.addEventListener('click', startListening);
  stopBtn.addEventListener('click', stopListening);
  clearBtn.addEventListener('click', () => {
    session.reset();
    pitchTracker?.reset();
    renderSequence();
  });
  undoBtn.addEventListener('click', () => {
    session.undoLast();
  });

  async function startListening() {
    hideMicHelp();
    liveHint.textContent = 'Запрашиваем доступ к микрофону…';
    liveHint.classList.remove('error');

    if (!navigator.mediaDevices?.getUserMedia) {
      showMicError(
        'Браузер не поддерживает доступ к микрофону в этом окне.',
        'Откройте расширение через боковую панель (клик по иконке) и попробуйте снова.',
      );
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext = new AudioContext();
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(mediaStream);
    pitchKit = createPitchAnalyser(audioContext);
    pitchTracker = new PitchTracker();
    source.connect(pitchKit.analyser);

    startBtn.disabled = true;
      stopBtn.disabled = false;
      clearBtn.disabled = false;
      undoBtn.disabled = false;
      liveHint.textContent = 'Играйте или напевайте — ноты появятся ниже.';

      loop();
    } catch (err) {
      showMicError(...describeMicError(err));
      console.error(err);
    }
  }

  function stopListening() {
    cancelAnimationFrame(rafId);
    session.flush();

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

    liveNote.textContent = '—';
    liveNote.classList.remove('out-of-range');
    liveFreq.textContent = '— Hz';
    liveRu.textContent = '';
    liveFingering.innerHTML = '';
    liveHint.textContent = 'Нажмите «Слушать» и играйте на флейте или напевайте.';
  }

  function loop() {
    if (!pitchKit) {
      return;
    }

    const frame = readPitchFrame(pitchKit);
    const tracked = pitchTracker.process(frame);

    updateLive(tracked.liveNote, tracked.freq);
    session.tick(tracked.stableNote, tracked.isSilence);
    rafId = requestAnimationFrame(loop);
  }

  function updateLive(note, freq) {
    if (!note) {
      liveNote.textContent = '…';
      liveNote.classList.remove('out-of-range');
      liveFreq.textContent = '— Hz';
      liveRu.textContent = '';
      liveFingering.innerHTML = '';
      return;
    }

    liveNote.textContent = note.label;
    liveNote.classList.toggle('out-of-range', !note.inRange);
    liveFreq.textContent = `${Math.round(freq)} Hz`;
    liveRu.textContent = note.labelRu;

    const fingering = getFingering(note.midi);
    liveFingering.innerHTML = fingering
      ? renderFingeringSvg(fingering.holes, 'large')
      : '<span class="hint">Нет аппликатуры для этой ноты</span>';
  }

  function renderSequence() {
    const notes = session.notes;
    const hasNotes = notes.length > 0;

    emptyState.hidden = hasNotes;
    noteList.hidden = !hasNotes;
    noteList.innerHTML = '';

    notes.forEach((note, index) => {
      const fingering = getFingering(note.midi);
      const item = document.createElement('li');
      item.className = 'note-item';
      item.innerHTML = `
        <span class="note-index">${index + 1}</span>
        <span class="note-label">${note.label} <small>${note.labelRu}</small></span>
        <span class="note-fingering"></span>
      `;
      const slot = item.querySelector('.note-fingering');
      if (fingering) {
        slot.innerHTML = renderFingeringSvg(fingering.holes, 'small');
      }
      noteList.appendChild(item);
    });
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

function describeMicError(err) {
  const name = err?.name ?? 'Error';
  const message = err?.message ?? String(err);

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
