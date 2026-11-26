import './style.css';
await import('./canvas');
import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatTime } from './canvas';
import { ConfigGenerator } from './configGenerator';
import { DEFAULT_CONFIG, type Config } from './gp/config';
import { createGame, type Game } from './gp/game';
import type { GameStats } from './gp/gameState';
import { fetchIdentity, Login, logout } from './login';
import { MODES, type Mode } from './modes';
import { Multiplayer } from './multiplayer/Multiplayer';
import { DEFAULT_ROOM_CONFIG } from './room-config';
import type { Identity } from './server/api';

/** Holds the game canvas, which canvas.ts draws to outside of preact. */
const app = document.querySelector<HTMLDivElement>('#app')!;

type Screen = 'menu' | 'generator' | 'game' | 'multiplayer';

interface EndScreenProps {
  mode: Mode;
  stats: GameStats;
  onPlayAgain: () => void;
  onMenu: () => void;
}

function EndScreen({ mode, stats, onPlayAgain, onMenu }: EndScreenProps) {
  const seconds = stats.time / 1000;
  const entries: [string, string][] = [
    ['Lines', String(stats.lines)],
    ['Pieces', String(stats.pieces)],
    ['PPS', (seconds > 0 ? stats.pieces / seconds : 0).toFixed(2)],
  ];

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/70 text-white">
      <div class="flex flex-col items-center gap-6 p-10 bg-zinc-800 rounded-xl w-80">
        <h2 class="text-sm font-bold tracking-widest text-zinc-400 uppercase">
          {mode.name}
        </h2>
        <p class="text-5xl font-bold tabular-nums">{formatTime(stats.time)}</p>
        <dl class="grid grid-cols-2 gap-x-8 gap-y-1 w-full">
          {entries.flatMap(([label, value]) => [
            <dt class="text-zinc-400">{label}</dt>,
            <dd class="text-right font-bold tabular-nums">{value}</dd>,
          ])}
        </dl>
        <div class="flex flex-col gap-2 w-full">
          <button
            class="px-4 py-3 text-lg font-bold bg-zinc-600 rounded-lg hover:bg-zinc-500"
            onClick={onPlayAgain}
          >
            Play again
          </button>
          <button
            class="px-4 py-2 bg-zinc-700 rounded-lg hover:bg-zinc-600"
            onClick={onMenu}
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

interface AppProps {
  identity: Identity;
  onLogout: () => void;
}

function App({ identity, onLogout }: AppProps) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [end, setEnd] = useState<{ mode: Mode; stats: GameStats } | null>(
    null,
  );
  const game = useRef<Game | null>(null);
  /** The config games are started with, as last set in the config generator. */
  const config = useRef<Config>(DEFAULT_CONFIG);

  useEffect(() => {
    app.hidden = screen !== 'game';
  }, [screen]);

  function showMenu() {
    game.current?.stop();
    game.current = null;
    setEnd(null);
    setScreen('menu');
  }

  function playAgain() {
    setEnd(null);
    game.current?.restart();
    game.current?.start();
  }

  function play(mode: Mode) {
    setScreen('game');
    game.current = createGame(DEFAULT_ROOM_CONFIG, config.current, mode, {
      onExit: showMenu,
      onFinish: (stats) => setEnd({ mode, stats }),
    });
    game.current.start();
  }

  // the buttons aren't focused, since the space bar that hard dropped the last
  // piece would otherwise click play again as it is released
  useEffect(() => {
    if (end === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key === 'Enter') playAgain();
      if (event.key === 'Escape') showMenu();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [end]);

  return (
    <>
      {screen === 'menu' && (
        <div class="text-white p-10">
          <div class="flex items-center justify-between w-60 mb-6">
            <span class="text-zinc-400">
              {identity.name}
              {identity.kind === 'guest' && ' (guest)'}
            </span>
            <button class="text-sm text-zinc-400 hover:text-white" onClick={onLogout}>
              Log out
            </button>
          </div>
          <ul class="flex flex-col gap-2 w-60">
            {MODES.map((mode) => (
              <li key={mode.name}>
                <button
                  class="w-full px-4 py-3 text-left text-lg font-bold bg-zinc-800 rounded-lg hover:bg-zinc-700"
                  onClick={() => play(mode)}
                >
                  {mode.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            class="mt-2 w-60 px-4 py-3 text-left text-lg font-bold bg-zinc-800 rounded-lg hover:bg-zinc-700"
            onClick={() => setScreen('multiplayer')}
          >
            Multiplayer
          </button>
          <button
            class="mt-6 w-60 px-4 py-2 text-left bg-zinc-800 rounded-lg hover:bg-zinc-700"
            onClick={() => setScreen('generator')}
          >
            Config generator
          </button>
        </div>
      )}
      {screen === 'multiplayer' && (
        <Multiplayer
          onBack={() => setScreen('menu')}
          getConfig={() => config.current}
          showCanvas={(visible) => {
            app.hidden = !visible;
          }}
        />
      )}
      {/* kept mounted while hidden, so its form survives leaving it */}
      <ConfigGenerator
        hidden={screen !== 'generator'}
        onBack={() => setScreen('menu')}
        onChange={(changed) => {
          config.current = changed;
        }}
      />
      {end && (
        <EndScreen
          mode={end.mode}
          stats={end.stats}
          onPlayAgain={playAgain}
          onMenu={showMenu}
        />
      )}
    </>
  );
}

function Root() {
  /** undefined while the session is still being checked. */
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);

  useEffect(() => {
    fetchIdentity()
      .then(setIdentity)
      .catch(() => setIdentity(null));
  }, []);

  if (identity === undefined) return null;
  if (identity === null) return <Login onLogin={setIdentity} />;
  return (
    <App
      identity={identity}
      onLogout={() => {
        logout().finally(() => setIdentity(null));
      }}
    />
  );
}

render(<Root />, document.querySelector('#root')!);
