import { createPitchAnalyser, readPitchFrame } from '../lib/pitch.js';
import { PitchTracker } from '../lib/pitch-tracker.js';
import { openAudioStreamFromId } from '../lib/tab-audio-stream.js';
import { closeTabPitchSender, postTabPitch } from '../lib/tab-pitch-channel.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';

let audioContext = null;
let mediaStream = null;
let pitchKit = null;
let pitchTracker = null;
let rafId = 0;
let settings = { ...DEFAULT_SETTINGS };

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message.type?.startsWith('OFFSCREEN_TAB_AUDIO_')) {
    return false;
  }

  handleMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'OFFSCREEN_TAB_AUDIO_START':
      return startCapture(message.streamId, message.settings);
    case 'OFFSCREEN_TAB_AUDIO_STOP':
      return stopCapture();
    case 'OFFSCREEN_TAB_AUDIO_SETTINGS':
      settings = message.settings ?? settings;
      pitchTracker?.setSettings(settings);
      return { ok: true };
    default:
      return { ok: false, error: 'Неизвестная команда' };
  }
}

function tabPitchSettings() {
  return {
    ...settings,
    rmsSilence: Math.min(settings.rmsSilence ?? 0.01, 0.001),
  };
}

function emitPitch(tracked) {
  const payload = {
    liveNote: tracked.liveNote,
    stableNote: tracked.stableNote,
    freq: tracked.freq,
    rms: tracked.rms,
    isSilence: tracked.isSilence,
  };
  postTabPitch(payload);
  chrome.runtime.sendMessage({ type: 'TAB_PITCH', tracked: payload }).catch(() => {});
}

async function measurePeakRms(samples = 8) {
  let peak = 0;
  for (let i = 0; i < samples; i++) {
    const frame = readPitchFrame(pitchKit, tabPitchSettings());
    peak = Math.max(peak, frame.rms);
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return peak;
}

async function startCapture(streamId, incomingSettings) {
  await stopCapture();

  if (!streamId) {
    throw new Error('Нет идентификатора потока вкладки');
  }

  settings = incomingSettings ?? settings;
  mediaStream = await openAudioStreamFromId(streamId);

  for (const track of mediaStream.getAudioTracks()) {
    track.enabled = true;
  }

  audioContext = new AudioContext();
  await audioContext.resume();

  const source = audioContext.createMediaStreamSource(mediaStream);
  const boost = audioContext.createGain();
  boost.gain.value = 4;

  pitchKit = createPitchAnalyser(audioContext, settings.fftSize);
  pitchTracker = new PitchTracker(tabPitchSettings());

  source.connect(boost);
  boost.connect(pitchKit.analyser);

  const silent = audioContext.createGain();
  silent.gain.value = 0;
  pitchKit.analyser.connect(silent);
  silent.connect(audioContext.destination);

  loop();

  const peakRms = await measurePeakRms();
  return {
    ok: true,
    hasSignal: peakRms > 0.0002,
    peakRms,
  };
}

function loop() {
  if (!pitchKit || !pitchTracker) {
    return;
  }

  const frame = readPitchFrame(pitchKit, tabPitchSettings());
  const tracked = pitchTracker.process(frame);
  emitPitch(tracked);

  rafId = requestAnimationFrame(loop);
}

async function stopCapture() {
  cancelAnimationFrame(rafId);
  rafId = 0;

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  pitchKit = null;
  pitchTracker = null;
  closeTabPitchSender();
  return { ok: true };
}
