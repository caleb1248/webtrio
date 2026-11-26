import type { BunRequest } from 'bun';
import {
  USERNAME_PATTERN,
  USERNAME_RULES,
  MIN_PASSWORD_LENGTH,
  type AuthResponse,
  type CheckUsernameRequest,
  type CheckUsernameResponse,
  type GuestRequest,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RegisterRequest,
} from './api';
import {
  checkPassword,
  createGuest,
  createUser,
  endSession,
  findUser,
  getIdentity,
  startSession,
} from './auth';
import { getIceServers } from './ice';
import type { IceServersResponse, RtcAnswerResponse } from './protocol';
import { acceptOffer } from './rtc';

const MAX_GUEST_NAME = 20;

/** Reads a JSON body, returning only the string fields that were asked for. */
async function readBody<K extends string>(
  req: Request,
  keys: K[],
): Promise<Record<K, string> | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = (body as Record<string, unknown>)[key];
    out[key] = typeof value === 'string' ? value : '';
  }
  return out;
}

const badRequest = () =>
  Response.json({ status: 'error', message: 'Bad request.' } satisfies AuthResponse, {
    status: 400,
  });

async function login(req: BunRequest) {
  const body = await readBody<keyof LoginRequest>(req, ['username', 'password']);
  if (!body) return badRequest();
  const username = body.username.trim();

  if (username === '') {
    const identity = createGuest('');
    startSession(req, identity);
    return Response.json({ status: 'ok', identity } satisfies LoginResponse);
  }

  const user = findUser(username);
  if (!user) {
    return Response.json({ status: 'unknown-user', username } satisfies LoginResponse);
  }
  if (!(await checkPassword(user, body.password))) {
    return Response.json(
      { status: 'error', message: 'Wrong password.' } satisfies LoginResponse,
      { status: 401 },
    );
  }

  const identity = { kind: 'user', id: user.id, name: user.username } as const;
  startSession(req, identity);
  return Response.json({ status: 'ok', identity } satisfies LoginResponse);
}

async function checkUsername(req: BunRequest) {
  const body = await readBody<keyof CheckUsernameRequest>(req, ['username']);
  if (!body) return badRequest();
  const username = body.username.trim();
  const user = findUser(username);
  const res: CheckUsernameResponse = user
    ? { exists: true, username: user.username }
    : { exists: false, username };
  return Response.json(res);
}

async function register(req: BunRequest) {
  const body = await readBody<keyof RegisterRequest>(req, ['username', 'password']);
  if (!body) return badRequest();
  const username = body.username.trim();

  const error = (message: string, status = 400) =>
    Response.json({ status: 'error', message } satisfies AuthResponse, { status });

  if (!USERNAME_PATTERN.test(username)) return error(USERNAME_RULES);
  if (body.password.length < MIN_PASSWORD_LENGTH) {
    return error(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (findUser(username)) return error('That username is taken.', 409);

  let identity;
  try {
    identity = await createUser(username, body.password);
  } catch {
    // someone else registered the name while the password was hashing
    return error('That username is taken.', 409);
  }
  startSession(req, identity);
  return Response.json({ status: 'ok', identity } satisfies AuthResponse);
}

async function guest(req: BunRequest) {
  const body = await readBody<keyof GuestRequest>(req, ['name']);
  if (!body) return badRequest();
  const identity = createGuest(body.name.trim().slice(0, MAX_GUEST_NAME));
  startSession(req, identity);
  return Response.json({ status: 'ok', identity } satisfies AuthResponse);
}

function me(req: BunRequest) {
  return Response.json({ identity: getIdentity(req) } satisfies MeResponse);
}

function logout(req: BunRequest) {
  endSession(req);
  return new Response(null, { status: 204 });
}

const unauthorized = () => Response.json({ error: 'Not logged in.' }, { status: 401 });

async function ice(req: BunRequest) {
  if (!getIdentity(req)) return unauthorized();
  try {
    return Response.json({ iceServers: await getIceServers() } satisfies IceServersResponse);
  } catch {
    return Response.json({ error: 'failed to generate TURN credentials' }, { status: 502 });
  }
}

async function rtc(req: BunRequest) {
  const identity = getIdentity(req);
  if (!identity) return unauthorized();
  const body = await readBody(req, ['sdp']);
  if (!body?.sdp) return Response.json({ error: 'Bad request.' } satisfies RtcAnswerResponse, { status: 400 });
  try {
    return Response.json({ sdp: await acceptOffer(identity, body.sdp) } satisfies RtcAnswerResponse);
  } catch (error) {
    console.error('WebRTC connection failed', error);
    return Response.json({ error: 'Could not connect.' } satisfies RtcAnswerResponse, { status: 502 });
  }
}

export const apiRoutes = {
  '/api/check-username': { POST: checkUsername },
  '/api/login': { POST: login },
  '/api/register': { POST: register },
  '/api/guest': { POST: guest },
  '/api/me': { GET: me },
  '/api/logout': { POST: logout },
  '/api/ice': { GET: ice },
  '/api/rtc': { POST: rtc },
};
