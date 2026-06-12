function muteVideoTracks(stream) {
  for (const track of stream.getVideoTracks()) {
    track.enabled = false;
  }
}

export async function openAudioStreamFromId(streamId) {
  const attempts = [
    {
      audio: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
      video: false,
    },
    {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    },
  ];

  let lastError = null;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      muteVideoTracks(stream);
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('В потоке вкладки нет звука.');
      }
      return stream;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Не удалось открыть звук вкладки');
}

/** Диалог Chrome: выбрать вкладку YouTube + «Поделиться звуком вкладки». */
export async function openDisplayMediaAudioStream() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  });

  muteVideoTracks(stream);

  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error(
      'Не выбран звук вкладки. В диалоге включите «Также предоставить доступ к аудио» / «Share tab audio».',
    );
  }

  return stream;
}
