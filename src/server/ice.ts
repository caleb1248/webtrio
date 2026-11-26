/** How long Cloudflare's TURN credentials stay valid, in seconds. */
const TTL = 86400;
/** Fetch new credentials once the cached ones have less than this left, in ms. */
const REFRESH_MARGIN = 60 * 60 * 1000;

let cached: { iceServers: RTCIceServer[]; expiresAt: number } | null = null;
let pending: Promise<RTCIceServer[]> | null = null;

async function generate(): Promise<RTCIceServer[]> {
  const res = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.TOKEN_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: TTL }),
    },
  );
  if (!res.ok) {
    console.error('TURN credential request failed', res.status, await res.text());
    throw new Error('failed to generate TURN credentials');
  }
  const body: { iceServers: RTCIceServer[] } = await res.json();
  cached = { iceServers: body.iceServers, expiresAt: Date.now() + TTL * 1000 };
  return body.iceServers;
}

/** ICE servers for both the server and clients, cached until shortly before they expire. */
export function getIceServers(): Promise<RTCIceServer[]> {
  if (cached && cached.expiresAt - Date.now() > REFRESH_MARGIN) {
    return Promise.resolve(cached.iceServers);
  }
  pending ??= generate().finally(() => (pending = null));
  return pending;
}
