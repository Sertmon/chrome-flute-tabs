import { initApp } from '../lib/app.js';
import { openAppTab, openExtensionMicSettings } from '../lib/mic-settings.js';

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
