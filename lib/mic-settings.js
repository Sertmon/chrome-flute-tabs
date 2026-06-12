/** Прямая ссылка на разрешения микрофона для этого расширения (не общий список сайтов). */
export function getExtensionMicSettingsUrl() {
  const site = `chrome-extension://${chrome.runtime.id}`;
  return `chrome://settings/content/siteDetails?site=${encodeURIComponent(site)}`;
}

export function openExtensionMicSettings() {
  return chrome.tabs.create({ url: getExtensionMicSettingsUrl() });
}

export function openAppTab() {
  return chrome.tabs.create({ url: chrome.runtime.getURL('app/app.html') });
}
