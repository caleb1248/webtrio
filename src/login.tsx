import { useState } from 'preact/hooks';
import type {
  AuthResponse,
  CheckUsernameResponse,
  Identity,
  LoginResponse,
  MeResponse,
} from './server/api';

const INPUT_CLASS =
  'px-3 py-2 bg-zinc-900 rounded-lg placeholder:text-zinc-500';
const PRIMARY_BUTTON =
  'px-4 py-3 text-lg font-bold bg-zinc-600 rounded-lg hover:bg-zinc-500 disabled:opacity-50';
const SECONDARY_BUTTON =
  'px-4 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 disabled:opacity-50';

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchIdentity(): Promise<Identity | null> {
  const res = await fetch('/api/me');
  const body: MeResponse = await res.json();
  return body.identity;
}

export async function logout() {
  await fetch('/api/logout', { method: 'POST' });
}

interface LoginProps {
  onLogin: (identity: Identity) => void;
}

/**
 * - username: asks for a username, blank plays as a guest straight away
 * - password: the username has an account, so ask for its password
 * - choice: the username has no account, so offer to register it or play as a guest
 * - register: picking a password for a new account
 */
type Step = 'username' | 'password' | 'choice' | 'register';

export function Login({ onLogin }: LoginProps) {
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goTo(next: Step) {
    setError(null);
    setPassword('');
    setConfirm('');
    setStep(next);
  }

  /** Runs a request, showing any error it gives or throws. */
  async function run<T>(request: () => Promise<T>, handle: (res: T) => void) {
    setBusy(true);
    setError(null);
    try {
      handle(await request());
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  function finish(res: LoginResponse | AuthResponse) {
    if (res.status === 'ok') onLogin(res.identity);
    else if (res.status === 'unknown-user') goTo('choice');
    else setError(res.message);
  }

  function submitUsername(event: Event) {
    event.preventDefault();
    const name = username.trim();
    if (name === '') {
      run(() => post<AuthResponse>('/api/guest', { name: '' }), finish);
      return;
    }
    run(
      () =>
        post<CheckUsernameResponse>('/api/check-username', { username: name }),
      (res) => {
        setUsername(res.username);
        goTo(res.exists ? 'password' : 'choice');
      },
    );
  }

  function submitPassword(event: Event) {
    event.preventDefault();
    run(
      () => post<LoginResponse>('/api/login', { username, password }),
      finish,
    );
  }

  function submitRegister(event: Event) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    run(
      () => post<AuthResponse>('/api/register', { username, password }),
      finish,
    );
  }

  function playAsGuest() {
    run(() => post<AuthResponse>('/api/guest', { name: username }), finish);
  }

  const errorText = error && <p class="text-sm text-red-400">{error}</p>;
  const backButton = (
    <button
      type="button"
      class={SECONDARY_BUTTON}
      disabled={busy}
      onClick={() => goTo('username')}
    >
      Back
    </button>
  );

  return (
    <div class="fixed inset-0 flex items-center justify-center text-white">
      <div class="flex flex-col gap-4 p-10 bg-zinc-800 rounded-xl w-160">
        {step === 'username' && (
          <form class="flex flex-col gap-3" onSubmit={submitUsername}>
            <h2 class="text-2xl font-bold">Welcome to webtrio!</h2>
            <p>
              Enter a username to continue, or leave it blank to get a random
              one.
            </p>
            <input
              class={`${INPUT_CLASS} uppercase`}
              placeholder="Username"
              autocomplete="username"
              value={username}
              onInput={(e) => setUsername(e.currentTarget.value)}
              autofocus
            />
            {errorText}
            <button class={PRIMARY_BUTTON} disabled={busy}>
              Continue
            </button>
          </form>
        )}

        {step === 'password' && (
          <form class="flex flex-col gap-3" onSubmit={submitPassword}>
            <h2 class="text-2xl font-bold">Welcome back</h2>
            <p class="text-zinc-300">
              Enter the password for <b>{username}</b>.
            </p>
            {/* lets password managers pair the password with the username */}
            <input type="hidden" autocomplete="username" value={username} />
            <input
              class={INPUT_CLASS}
              type="password"
              placeholder="Password"
              autocomplete="current-password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              autofocus
            />
            {errorText}
            <button class={PRIMARY_BUTTON} disabled={busy}>
              Log in
            </button>
            {backButton}
          </form>
        )}

        {step === 'choice' && (
          <div class="flex flex-col gap-3">
            <h2 class="text-2xl font-bold">New username</h2>
            <p class="text-zinc-300">
              There's no account named <b>{username}</b>. Do you want to
              register it?
            </p>
            {errorText}
            <button
              class={PRIMARY_BUTTON}
              disabled={busy}
              onClick={() => goTo('register')}
            >
              Register
            </button>
            <button
              class={SECONDARY_BUTTON}
              disabled={busy}
              onClick={playAsGuest}
            >
              Play as guest
            </button>
            {backButton}
          </div>
        )}

        {step === 'register' && (
          <form class="flex flex-col gap-3" onSubmit={submitRegister}>
            <h2 class="text-2xl font-bold">Register</h2>
            <p class="text-zinc-300">
              Pick a password for <b>{username}</b>.
            </p>
            <input type="hidden" autocomplete="username" value={username} />
            <input
              class={INPUT_CLASS}
              type="password"
              placeholder="Password"
              autocomplete="new-password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              autofocus
            />
            <input
              class={INPUT_CLASS}
              type="password"
              placeholder="Confirm password"
              autocomplete="new-password"
              value={confirm}
              onInput={(e) => setConfirm(e.currentTarget.value)}
            />
            {errorText}
            <button class={PRIMARY_BUTTON} disabled={busy}>
              Register
            </button>
            <button
              type="button"
              class={SECONDARY_BUTTON}
              disabled={busy}
              onClick={() => goTo('choice')}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
