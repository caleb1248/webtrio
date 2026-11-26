import type { BunRequest } from 'bun';
import { db } from './db';
import type { Identity } from './api';

export const SESSION_COOKIE = 'session';
/** Sessions last a long time since guests have no other way to be recognised. */
const SESSION_DAYS = 365;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

interface SessionRow {
  user_id: number | null;
  guest_id: number | null;
  user_name: string | null;
  guest_name: string | null;
}

const findUserQuery = db.query<UserRow, [string]>(
  'SELECT id, username, password_hash FROM users WHERE username = ?',
);
const insertUserQuery = db.query<{ id: number }, [string, string, number]>(
  'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?) RETURNING id',
);
const insertGuestQuery = db.query<{ id: number }, [string, number]>(
  'INSERT INTO guests (name, created_at) VALUES (?, ?) RETURNING id',
);
const insertSessionQuery = db.query<
  void,
  [string, number | null, number | null, number, number]
>(
  'INSERT INTO sessions (token_hash, user_id, guest_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
);
const findSessionQuery = db.query<SessionRow, [string, number]>(`
  SELECT s.user_id, s.guest_id, u.username AS user_name, g.name AS guest_name
  FROM sessions s
  LEFT JOIN users u ON u.id = s.user_id
  LEFT JOIN guests g ON g.id = s.guest_id
  WHERE s.token_hash = ? AND s.expires_at > ?
`);
const deleteSessionQuery = db.query<void, [string]>(
  'DELETE FROM sessions WHERE token_hash = ?',
);

export function findUser(username: string): UserRow | null {
  return findUserQuery.get(username);
}

export async function createUser(username: string, password: string): Promise<Identity> {
  const hash = await Bun.password.hash(password);
  const { id } = insertUserQuery.get(username, hash, Date.now())!;
  return { kind: 'user', id, name: username };
}

export async function checkPassword(user: UserRow, password: string): Promise<boolean> {
  return Bun.password.verify(password, user.password_hash);
}

export function createGuest(name: string): Identity {
  const { id } = insertGuestQuery.get(name, Date.now())!;
  // blank names are filled in with the id, which is only known after inserting
  const finalName = name || `guest-${id}`;
  if (!name) db.run('UPDATE guests SET name = ? WHERE id = ?', [finalName, id]);
  return { kind: 'guest', id, name: finalName };
}

function hashToken(token: string): string {
  return new Bun.CryptoHasher('sha256').update(token).digest('hex');
}

/** Starts a session for an identity and sets its cookie on the response. */
export function startSession(req: BunRequest, identity: Identity) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const now = Date.now();
  insertSessionQuery.run(
    hashToken(token),
    identity.kind === 'user' ? identity.id : null,
    identity.kind === 'guest' ? identity.id : null,
    now,
    now + SESSION_MS,
  );
  req.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(req.url).protocol === 'https:',
    path: '/',
    maxAge: SESSION_MS / 1000,
  });
}

/** The identity of whoever sent the request, or null if they aren't logged in. */
export function getIdentity(req: BunRequest): Identity | null {
  const token = req.cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const row = findSessionQuery.get(hashToken(token), Date.now());
  if (!row) return null;
  if (row.user_id !== null) return { kind: 'user', id: row.user_id, name: row.user_name! };
  return { kind: 'guest', id: row.guest_id!, name: row.guest_name! };
}

export function endSession(req: BunRequest) {
  const token = req.cookies.get(SESSION_COOKIE);
  if (token) deleteSessionQuery.run(hashToken(token));
  req.cookies.delete({ name: SESSION_COOKIE, path: '/' });
}
