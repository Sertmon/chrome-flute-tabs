const CHANNEL_NAME = 'flute-tab-pitch-v1';

let senderChannel = null;

export function postTabPitch(tracked) {
  if (!senderChannel) {
    senderChannel = new BroadcastChannel(CHANNEL_NAME);
  }
  senderChannel.postMessage({ type: 'TAB_PITCH', tracked });
}

export function closeTabPitchSender() {
  senderChannel?.close();
  senderChannel = null;
}

export function listenTabPitch(onPitch) {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event) => {
    if (event.data?.type === 'TAB_PITCH' && event.data.tracked) {
      onPitch(event.data.tracked);
    }
  };
  return () => channel.close();
}
