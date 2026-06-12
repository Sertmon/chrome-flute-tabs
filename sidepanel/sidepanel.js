import { initApp } from '../lib/app.js';
import { openAppTab, openExtensionMicSettings } from '../lib/mic-settings.js';
import { refreshCaptureTab, setCaptureTab } from '../lib/tab-audio.js';

async function registerInvokeTab() {
  try {
    const tab = await refreshCaptureTab();
    if (tab) {
      setCaptureTab(tab);
    }
  } catch {
    // вкладка подставится при «Слушать»
  }
}

await registerInvokeTab();

const app = initApp();

document.getElementById('openMicSettingsBtn')?.addEventListener('click', () => {
  openExtensionMicSettings();
});

document.getElementById('openAppTabBtn')?.addEventListener('click', () => {
  openAppTab();
});

window.addEventListener('beforeunload', () => {
  app.stopListening();
});
