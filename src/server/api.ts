// Types shared between the server and the client. Keep this file free of
// server-only imports so the client can import it.

export type Identity =
  | { kind: 'user'; id: number; name: string }
  | { kind: 'guest'; id: number; name: string };

export interface LoginRequest {
  /** Blank logs in as a new guest. */
  username: string;
  password: string;
}

export type LoginResponse =
  | { status: 'ok'; identity: Identity }
  /** No account has this username. The client should offer to register it or continue as a guest. */
  | { status: 'unknown-user'; username: string }
  | { status: 'error'; message: string };

export interface CheckUsernameRequest {
  username: string;
}

export type CheckUsernameResponse =
  /** `username` is spelled the way the account was registered. */
  | { exists: true; username: string }
  | { exists: false; username: string };

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface GuestRequest {
  /** Name to show for the guest. Blank gets a generated name. */
  name: string;
}

export type AuthResponse =
  | { status: 'ok'; identity: Identity }
  | { status: 'error'; message: string };

export type MeResponse = { identity: Identity | null };

export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;
export const USERNAME_RULES = 'Usernames are 3-20 letters, numbers, _ or -.';
export const MIN_PASSWORD_LENGTH = 6;
