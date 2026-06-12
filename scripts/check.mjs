import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'manifest.json',
  'background.js',
  'sidepanel/sidepanel.html',
  'sidepanel/sidepanel.js',
  'lib/app.js',
  'lib/tab-audio-stream.js',
  'lib/storage-session.js',
];

let failed = false;

for (const rel of required) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  }
}

try {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  if (manifest.background?.type !== 'module') {
    console.error('manifest: background.type should be module');
    failed = true;
  }
  if (!manifest.permissions?.includes('storage')) {
    console.error('manifest: missing storage permission');
    failed = true;
  }
} catch (error) {
  console.error('manifest.json invalid:', error.message);
  failed = true;
}

const tabAudio = readFileSync(join(root, 'lib/tab-audio-stream.js'), 'utf8');
if (tabAudio.includes('preferCurrentTab') || tabAudio.includes('selfBrowserSurface')) {
  console.error('tab-audio-stream: contradictory getDisplayMedia options still present');
  failed = true;
}

const app = readFileSync(join(root, 'lib/app.js'), 'utf8');
if (app.includes('beginTabAudioCapture')) {
  console.error('app.js: should not use broken offscreen tab capture on Listen');
  failed = true;
}
if (!app.includes('openDisplayMediaAudioStream')) {
  console.error('app.js: tab mode should use openDisplayMediaAudioStream');
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('check: ok');
