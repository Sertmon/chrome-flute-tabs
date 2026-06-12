import { initApp } from '../lib/app.js';
import { openExtensionMicSettings } from '../lib/mic-settings.js';

const app = initApp();

document.getElementById('openMicSettingsBtn')?.addEventListener('click', () => {
  openExtensionMicSettings();
});

window.addEventListener('beforeunload', () => {
  app.stopListening();
});
