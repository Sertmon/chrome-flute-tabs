import { sessionGet, sessionSet } from './lib/storage-session.js';

const INVOKED_TAB_KEY = 'invokedTabId';

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
  if (tab?.id != null) {
    void sessionSet({ [INVOKED_TAB_KEY]: tab.id });
  }
  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
    default:
      return undefined;
  }
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
      error: 'Откройте YouTube, нажмите иконку расширения на этой вкладке.',
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
