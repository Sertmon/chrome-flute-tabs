function captureActiveTabAudio() {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (!stream?.getAudioTracks?.().length) {
        stream?.getTracks?.().forEach((track) => track.stop());
        reject(new Error('Нет аудиодорожки вкладки'));
        return;
      }
      resolve(stream);
    });
  });
}

function captureTabAudioById(targetTabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, async (streamId) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'tab',
              chromeMediaSourceId: streamId,
            },
          },
          video: false,
        });
        if (!stream.getAudioTracks().length) {
          stream.getTracks().forEach((track) => track.stop());
          reject(new Error('Нет аудиодорожки вкладки'));
          return;
        }
        resolve(stream);
      } catch (mediaError) {
        reject(mediaError);
      }
    });
  });
}

/**
 * Как в расширении Shazam: chrome.tabCapture без диалога getDisplayMedia.
 * Нужен клик по иконке на вкладке YouTube, затем «Слушать» в панели.
 */
export async function openTabCaptureAudioStream(targetTabId) {
  try {
    return await captureActiveTabAudio();
  } catch (firstError) {
    if (!targetTabId) {
      throw firstError;
    }
    return captureTabAudioById(targetTabId);
  }
}
