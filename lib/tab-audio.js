function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

let captureTab = null;

export function setCaptureTab(tab) {
  if (tab?.id) {
    captureTab = {
      id: tab.id,
      title: tab.title,
      url: tab.url,
    };
  }
}

export function getCachedCaptureTab() {
  return captureTab;
}

export function getTabCaptureBlockReason(url) {
  if (!url) {
    return 'Вкладка без адреса';
  }
  const blocked = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://'];
  if (blocked.some((prefix) => url.startsWith(prefix))) {
    return 'Нельзя захватить звук страницы Chrome. Нужна обычная вкладка с YouTube.';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'Захват доступен только для обычных сайтов (http/https).';
  }
  return null;
}

export function explainTabCaptureError(message) {
  const text = String(message || '');

  if (text.includes('activeTab') || text.includes('has not been invoked')) {
    return 'Доступ к вкладке истёк. Закройте панель, на YouTube снова нажмите иконку расширения '
      + '(откроется панель) и сразу «Слушать».';
  }

  if (text.includes('Chrome pages cannot be captured')) {
    return 'Страницы Chrome (chrome://) нельзя захватывать. Откройте YouTube и повторите.';
  }

  return text || 'Не удалось подключить звук вкладки.';
}

export async function refreshCaptureTab() {
  const win = await chrome.windows.getCurrent();
  const response = await sendMessage({
    type: 'REFRESH_CAPTURE_TAB',
    windowId: win.id,
  });

  if (response?.ok && response.tab) {
    setCaptureTab(response.tab);
    return response.tab;
  }

  return null;
}

export async function getCaptureTab() {
  if (captureTab?.id) {
    try {
      const live = await chrome.tabs.get(captureTab.id);
      if (!getTabCaptureBlockReason(live.url)) {
        captureTab = {
          id: live.id,
          title: live.title,
          url: live.url,
        };
        return captureTab;
      }
    } catch {
      captureTab = null;
    }
  }

  const win = await chrome.windows.getCurrent();
  const response = await sendMessage({
    type: 'GET_CAPTURE_TAB',
    windowId: win.id,
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'Не найдена вкладка с видео. Откройте YouTube и нажмите иконку расширения.');
  }

  setCaptureTab(response.tab);
  return response.tab;
}

function requestStreamIdCallback(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const err = chrome.runtime.lastError;
      if (err || !streamId) {
        reject(new Error(explainTabCaptureError(err?.message)));
        return;
      }
      resolve(streamId);
    });
  });
}

async function resolveStreamIdForTab(tabId) {
  try {
    return await requestStreamIdCallback(tabId);
  } catch (primaryError) {
    const pending = await sendMessage({
      type: 'CONSUME_PENDING_STREAM',
      tabId,
    });
    if (pending?.ok && pending.streamId) {
      return pending.streamId;
    }
    throw primaryError;
  }
}

export async function isCaptureTabAudible(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return Boolean(tab.audible);
  } catch {
    return false;
  }
}

/**
 * streamId запрашивается при клике по иконке (background, user gesture).
 * Анализ звука — в offscreen-документе.
 */
export async function beginTabAudioCapture(settings) {
  const tab = captureTab;
  if (!tab?.id) {
    throw new Error('Сначала откройте YouTube и нажмите иконку расширения на этой вкладке.');
  }

  const block = getTabCaptureBlockReason(tab.url);
  if (block) {
    throw new Error(block);
  }

  const streamId = await resolveStreamIdForTab(tab.id);

  const response = await sendMessage({
    type: 'START_TAB_AUDIO',
    streamId,
    settings,
  });

  if (!response?.ok) {
    throw new Error(response?.error || 'Не удалось запустить захват вкладки');
  }

  return response;
}

export async function endTabAudioCapture() {
  await sendMessage({ type: 'STOP_TAB_AUDIO' });
}

export async function updateTabAudioCaptureSettings(settings) {
  await sendMessage({ type: 'UPDATE_TAB_AUDIO_SETTINGS', settings });
}

export { openDisplayMediaAudioStream } from './tab-audio-stream.js';
