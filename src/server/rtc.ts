import { RTCPeerConnection, type RTCDataChannel } from 'werift';
import type { Identity } from './api';
import { getIceServers } from './ice';
import { onConnect, onDisconnect, onMessage, type Connection } from './rooms';

/** How long to wait for ICE gathering before answering with what's been found. */
const GATHER_TIMEOUT = 5000;
/** How long a peer may take to open its data channel before it's dropped. */
const CONNECT_TIMEOUT = 30_000;
/** How long a disconnected peer gets to recover before it's dropped. */
const DISCONNECT_GRACE = 10_000;

/** werift wants each ICE server to have a single url. */
function toWeriftIceServers(servers: RTCIceServer[]) {
  return servers.flatMap((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.map((url) => ({
      urls: url,
      username: server.username,
      credential: server.credential,
    }));
  });
}

/**
 * Answers a client's offer, and once the client opens a data channel, hands
 * the connection to the room logic. Returns the answer SDP.
 */
export async function acceptOffer(identity: Identity, offerSdp: string): Promise<string> {
  const pc = new RTCPeerConnection({
    iceServers: toWeriftIceServers(await getIceServers()),
  });

  let conn: Connection | null = null;
  let closed = false;
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined;

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(connectTimer);
    clearTimeout(disconnectTimer);
    if (conn) onDisconnect(conn);
    pc.close().catch(() => {});
  }

  const connectTimer = setTimeout(() => {
    if (!conn) close();
  }, CONNECT_TIMEOUT);

  pc.connectionStateChange.subscribe((state) => {
    clearTimeout(disconnectTimer);
    if (state === 'failed' || state === 'closed') close();
    else if (state === 'disconnected') disconnectTimer = setTimeout(close, DISCONNECT_GRACE);
  });

  pc.onDataChannel.subscribe((channel: RTCDataChannel) => {
    // only one channel per peer is expected
    if (conn || closed) return;

    const start = () => {
      if (conn || closed) return;
      conn = {
        id: crypto.randomUUID(),
        identity,
        send(message) {
          if (channel.readyState === 'open') channel.send(JSON.stringify(message));
        },
      };
      onConnect(conn);
    };

    channel.onMessage.subscribe((data) => {
      if (conn) onMessage(conn, typeof data === 'string' ? data : data.toString());
    });
    channel.stateChanged.subscribe((state) => {
      if (state === 'open') start();
      if (state === 'closed') close();
    });
    if (channel.readyState === 'open') start();
  });

  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    await pc.setLocalDescription(await pc.createAnswer());
    if (pc.iceGatheringState !== 'complete') {
      await pc.iceGatheringStateChange
        .watch((state) => state === 'complete', GATHER_TIMEOUT)
        .catch(() => {});
    }
    return pc.localDescription!.sdp;
  } catch (error) {
    close();
    throw error;
  }
}
