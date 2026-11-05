/// <reference types="bun" />
import {
  RTCPeerConnection,
  type RTCIceCandidateInit,
  type RTCSessionDescriptionInit,
} from 'werift';
import { apps, type App } from './apps';
import { Mailbox, POLL_TIMEOUT_MS } from './src/long-poll/server';

const peers = new Set<RTCPeerConnection>();

// Signaling sessions, keyed by id. Each holds the server's ICE candidates until the client polls for them.
type Session = {
  pc: RTCPeerConnection;
  candidates: Mailbox<RTCIceCandidateInit>;
  expiry: ReturnType<typeof setTimeout>;
};

const sessions = new Map<string, Session>();

// Clients that vanish mid-handshake never send DELETE, so give up on them eventually.
const SESSION_TTL_MS = 60_000;

async function createSession(app: App, offer: RTCSessionDescriptionInit) {
  console.log('got offer');
  const id = crypto.randomUUID();
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  const candidates = new Mailbox<RTCIceCandidateInit>();
  sessions.set(id, {
    pc,
    candidates,
    expiry: setTimeout(() => endSession(id), SESSION_TTL_MS),
  });
  peers.add(pc);

  pc.onDataChannel.subscribe((channel) => app.server.onChannel(channel));
  pc.connectionStateChange.subscribe((state) => {
    console.log(`[${pc.id}] connection ${state}`);
    if (state === 'failed' || state === 'closed' || state === 'disconnected') {
      peers.delete(pc);
      pc.close();
    }
  });

  // The client only starts polling after it has the answer, so candidates can never beat it there.
  pc.onIceCandidate.subscribe((c) => {
    if (!c) return;
    candidates.push({
      candidate: c.candidate,
      sdpMid: c.sdpMid,
      sdpMLineIndex: c.sdpMLineIndex,
    });
  });

  await pc.setRemoteDescription(offer);
  await pc.setLocalDescription(await pc.createAnswer());
  return { id, sdp: pc.localDescription };
}

function endSession(id: string) {
  const session = sessions.get(id);
  if (!session) return;
  sessions.delete(id);
  clearTimeout(session.expiry);
  session.candidates.close();
  // The client hangs up once the data channel opens; only tear down peers that never connected.
  if (session.pc.connectionState !== 'connected') {
    peers.delete(session.pc);
    session.pc.close();
  }
}

const sessionNotFound = () => new Response('Unknown signaling session', { status: 404 });

async function getIce() {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.TOKEN_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    },
  );
  if (!res.ok) {
    console.error('TURN credential request failed', res.status, await res.text());
    return { error: 'failed to generate TURN credentials' };
  }
  // Shape: { iceServers: RTCIceServer[] }
  return await res.json();
}

const server = Bun.serve({
  // port: 3000, // dev
  // port: 39268, // prod
  port: process.env.NODE_ENV == 'production' ? 39268 : 3000,
  hostname: '0.0.0.0',
  routes: {
    // Short-lived Cloudflare TURN credentials for the client's RTCPeerConnection.
    '/ice': {
      GET: async () => {
        const ice = await getIce();
        if (ice.error) {
          return Response.json({ error: ice.error }, { status: 502 });
        }
        // Shape: { iceServers: RTCIceServer[] }
        return Response.json(ice);
      },
    },

    // Signaling over plain HTTP: the offer is answered directly, then both sides trickle ICE
    // candidates (client -> server via POST, server -> client via long polling).
    '/signal': {
      POST: async (req) => {
        const { app, sdp } = (await req.json()) as {
          app: string;
          sdp: RTCSessionDescriptionInit;
        };
        if (!Object.hasOwn(apps, app)) {
          return new Response(`Unknown app: ${app}`, { status: 404 });
        }
        return Response.json(await createSession(apps[app]!, sdp));
      },
    },
    '/signal/:id/delete': (req) => {
      endSession(req.params.id);
      return new Response(null, { status: 204 });
    },
    '/signal/:id/candidate': {
      POST: async (req) => {
        const session = sessions.get(req.params.id);
        if (!session) return sessionNotFound();
        await session.pc.addIceCandidate((await req.json()) as RTCIceCandidateInit);
        return new Response(null, { status: 204 });
      },
    },
    '/signal/:id/poll': (req) =>
      sessions.get(req.params.id)?.candidates.poll(req) ?? sessionNotFound(),
  },
  // Long polls hold requests open for up to POLL_TIMEOUT_MS; keep the connection alive past that.
  idleTimeout: POLL_TIMEOUT_MS / 1000 + 10,

  // Comment the following lines out before building
  // development: {
  //   hmr: true,
  //   console: true,
  // },
});

console.log(`Server running at http://localhost:${server.port}`);
