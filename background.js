import { sessionGet, sessionRemove, sessionSet } from './lib/storage-session.js';

const INVOKED_TAB_KEY = 'invokedTabId';
const PENDING_STREAM_KEY = 'pendingStreamId';
const PENDING_STREAM_TAB_KEY = 'pendingStreamTabId';
const PENDING_STREAM_AT_KEY = 'pendingStreamAt';
const STREAM_TTL_MS = 5 * 60 * 1000;
const OFFSCREEN_URL = 'offscreen/offscreen.html';

function isHttpUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function isExtensionPageUrl(url) {
  return typeof url === 'string' && url.startsWith('chrome-extension://');
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(console.error);

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.windowId) {
    return;
  }

  if (tab.id != null) {
    void sessionSet({ [INVOKED_TAB_KEY]: tab.id });

    if (isHttpUrl(tab.url)) {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
        const err = chrome.runtime.lastError;
        if (!err && streamId) {
          void sessionSet({
            [PENDING_STREAM_KEY]: streamId,
            [PENDING_STREAM_TAB_KEY]: tab.id,
            [PENDING_STREAM_AT_KEY]: Date.now(),
          });
        }
      });
    }
  }

  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type?.startsWith('OFFSCREEN_TAB_AUDIO_') || message.type === 'TAB_PITCH') {
    return false;
  }

  handleMessage(message)
    .then((result) => {
      if (result !== undefined) {
        sendResponse(result);
      }
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'PANEL_OPENED':
    case 'REFRESH_CAPTURE_TAB':
      return registerInvokeTab(message.windowId);
    case 'GET_CAPTURE_TAB':
      return resolveCaptureTab(message.windowId);
    case 'CONSUME_PENDING_STREAM':
      return consumePendingStream(message.tabId);
    case 'START_TAB_AUDIO':
      return startTabAudio(message.streamId, message.settings);
    case 'STOP_TAB_AUDIO':
      return stopTabAudio();
    case 'UPDATE_TAB_AUDIO_SETTINGS':
      return updateTabAudioSettings(message.settings);
    default:
      return undefined;
  }
}

async function consumePendingStream(tabId) {
  const stored = await sessionGet([
    PENDING_STREAM_KEY,
    PENDING_STREAM_TAB_KEY,
    PENDING_STREAM_AT_KEY,
  ]);

  const age = Date.now() - (stored[PENDING_STREAM_AT_KEY] || 0);
  if (
    stored[PENDING_STREAM_KEY]
    && stored[PENDING_STREAM_TAB_KEY] === tabId
    && age < STREAM_TTL_MS
  ) {
    await sessionRemove([
      PENDING_STREAM_KEY,
      PENDING_STREAM_TAB_KEY,
      PENDING_STREAM_AT_KEY,
    ]);
    return { ok: true, streamId: stored[PENDING_STREAM_KEY] };
  }

  return { ok: false };
}

async function registerInvokeTab(windowId) {
  const tab = await findHttpTabInWindow(windowId);
  if (!tab?.id) {
    return { ok: false };
  }

  await sessionSet({ [INVOKED_TAB_KEY]: tab.id });
  return {
    ok: true,
    tab: {
      id: tab.id,
      title: tab.title,
      url: tab.url,
    },
  };
}

async function resolveCaptureTab(windowId) {
  let tab = await getStoredInvokeTab();

  if (!tab && windowId != null) {
    tab = await findHttpTabInWindow(windowId);
  }

  if (!tab) {
    tab = await findHttpTabInWindow(null);
  }

  if (!tab?.id) {
    return {
      ok: false,
      error: 'Откройте YouTube, нажмите иконку расширения на этой вкладке и затем «Слушать».',
    };
  }

  return {
    ok: true,
    tab: {
      id: tab.id,
      title: tab.title,
      url: tab.url,
    },
  };
}

async function getStoredInvokeTab() {
  const stored = await sessionGet(INVOKED_TAB_KEY);
  const tabId = stored[INVOKED_TAB_KEY];
  if (!tabId) {
    return null;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    return isHttpUrl(tab.url) ? tab : null;
  } catch {
    return null;
  }
}

async function findHttpTabInWindow(windowId) {
  const activeQuery = windowId != null
    ? { active: true, windowId }
    : { active: true, lastFocusedWindow: true };
  const [active] = await chrome.tabs.query(activeQuery);
  const scopeId = windowId ?? active?.windowId;

  if (scopeId == null) {
    return active?.id && isHttpUrl(active.url) ? active : null;
  }

  const tabs = await chrome.tabs.query({ windowId: scopeId });
  const httpTabs = tabs.filter((item) => isHttpUrl(item.url));
  const audibleTabs = httpTabs.filter((item) => item.audible);

  if (audibleTabs.length >= 1) {
    return audibleTabs[0];
  }

  if (active?.id && isHttpUrl(active.url)) {
    return active;
  }

  if (httpTabs.length === 1) {
    return httpTabs[0];
  }

  if (active?.id && isExtensionPageUrl(active.url)) {
    return null;
  }

  return httpTabs[0] ?? null;
}

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });

  if (existing.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Захват звука вкладки (YouTube) для распознавания нот',
  });
}

function sendToOffscreen(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function startTabAudio(streamId, settings) {
  await ensureOffscreen();

  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await sendToOffscreen({
        type: 'OFFSCREEN_TAB_AUDIO_START',
        streamId,
        settings,
      });
      if (response?.ok) {
        return response;
      }
      lastError = new Error(response?.error || 'offscreen не ответил');
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
  }

  throw lastError || new Error('Не удалось запустить захват в offscreen');
}

async function stopTabAudio() {
  try {
    return await sendToOffscreen({ type: 'OFFSCREEN_TAB_AUDIO_STOP' });
  } catch {
    return { ok: true };
  }
}

async function updateTabAudioSettings(settings) {
  try {
    return await sendToOffscreen({
      type: 'OFFSCREEN_TAB_AUDIO_SETTINGS',
      settings,
    });
  } catch {
    return { ok: false };
  }
}
