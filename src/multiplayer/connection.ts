import type {
  ClientMessage,
  IceServersResponse,
  RtcAnswerResponse,
  ServerMessage,
} from '../server/protocol';

/** How long to wait for ICE gathering before sending the offer with what's been found. */
const GATHER_TIMEOUT = 5000;

export interface ServerConnection {
  send(message: ClientMessage): void;
  /** Returns a function that removes the listener. */
  onMessage(listener: (message: ServerMessage) => void): () => void;
  /** Called once if the connection drops. Not called after `close()`. */
  onClose(listener: () => void): () => void;
  close(): void;
}

function waitForGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const timer = setTimeout(done, GATHER_TIMEOUT);
    function done() {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    function check() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

/** Opens a WebRTC data channel to the server. Needs the user to be logged in. */
export async function connect(): Promise<ServerConnection> {
  const iceRes = await fetch('/api/ice');
  if (!iceRes.ok) throw new Error('Could not get ICE servers.');
  const { iceServers }: IceServersResponse = await iceRes.json();

  const pc = new RTCPeerConnection({ iceServers });
  const channel = pc.createDataChannel('main', { ordered: true });

  const messageListeners = new Set<(message: ServerMessage) => void>();
  /** Messages that arrived before anything was listening, so none are missed. */
  const queued: ServerMessage[] = [];
  channel.addEventListener('message', (event) => {
    const message: ServerMessage = JSON.parse(event.data);
    if (messageListeners.size === 0) queued.push(message);
    for (const listener of messageListeners) listener(message);
  });

  await pc.setLocalDescription(await pc.createOffer());
  await waitForGathering(pc);

  const res = await fetch('/api/rtc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sdp: pc.localDescription!.sdp }),
  });
  const answer: RtcAnswerResponse = await res.json();
  if ('error' in answer) {
    pc.close();
    throw new Error(answer.error);
  }
  await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });

  await new Promise<void>((resolve, reject) => {
    channel.addEventListener('open', () => resolve(), { once: true });
    channel.addEventListener('close', () => reject(new Error('Could not connect.')), {
      once: true,
    });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') reject(new Error('Could not connect.'));
    });
  }).catch((error) => {
    pc.close();
    throw error;
  });

  const closeListeners = new Set<() => void>();
  let closed = false;

  function dropped() {
    if (closed) return;
    closed = true;
    pc.close();
    for (const listener of closeListeners) listener();
  }

  channel.addEventListener('close', dropped);
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropped();
  });

  return {
    send(message) {
      if (channel.readyState === 'open') channel.send(JSON.stringify(message));
    },
    onMessage(listener) {
      messageListeners.add(listener);
      for (const message of queued.splice(0)) listener(message);
      return () => messageListeners.delete(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    close() {
      closed = true;
      pc.close();
    },
  };
}
