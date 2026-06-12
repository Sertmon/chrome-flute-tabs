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
    return 'Нужна обычная вкладка с YouTube, не страница Chrome.';
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'Захват доступен только для обычных сайтов (http/https).';
  }
  return null;
}

export function explainTabCaptureError(message) {
  const text = String(message || '');

  if (text.includes('Extension has not been invoked')) {
    return 'Откройте YouTube, нажмите иконку расширения на этой вкладке, затем «Слушать».';
  }

  if (text.includes('Cannot capture a tab with an active stream')) {
    return 'Звук этой вкладки уже захватывается. Нажмите «Стоп» и попробуйте снова.';
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
    throw new Error(response?.error || 'Откройте YouTube и нажмите иконку расширения на этой вкладке.');
  }

  setCaptureTab(response.tab);
  return response.tab;
}

export { openTabCaptureAudioStream } from './tab-audio-stream.js';
