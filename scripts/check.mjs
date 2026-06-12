import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'manifest.json',
  'background.js',
  'sidepanel/sidepanel.html',
  'lib/app.js',
  'lib/tab-audio-stream.js',
];

const forbidden = [
  'offscreen/offscreen.js',
  'lib/tab-pitch-channel.js',
];

let failed = false;

for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  }
}

for (const rel of forbidden) {
  if (existsSync(join(root, rel))) {
    console.error(`SHOULD BE REMOVED: ${rel}`);
    failed = true;
  }
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
if (!manifest.permissions?.includes('tabCapture')) {
  console.error('manifest: tab mode needs tabCapture permission');
  failed = true;
}
if (manifest.permissions?.includes('offscreen')) {
  console.error('manifest: remove unused offscreen');
  failed = true;
}

const app = readFileSync(join(root, 'lib/app.js'), 'utf8');
if (!app.includes('openTabCaptureAudioStream')) {
  console.error('app.js: tab mode must use tabCapture');
  failed = true;
}

const stream = readFileSync(join(root, 'lib/tab-audio-stream.js'), 'utf8');
if (!stream.includes('chrome.tabCapture.capture')) {
  console.error('tab-audio-stream.js: must use chrome.tabCapture.capture');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('check: ok');
