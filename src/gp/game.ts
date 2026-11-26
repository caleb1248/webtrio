import {
  columns,
  draw,
  drawBuffer,
  rows,
  setB2B,
  setCountdown,
  setGarbageMeter,
  setPreviews,
  setStats,
  showClear,
} from '../canvas';
import { colors, GARBAGE, type Cell, type Pieces } from '../colors';
import type { Mode } from '../modes';
import { DEFAULT_ROOM_CONFIG, type RoomConfig } from '../room-config';
import type { Vec2 } from '../types';
import { ALL_CLEAR_BONUS, baseAttack, comboTables } from './comboTables';
import { DEFAULT_CONFIG, type Config } from './config';
import { GAMEPLAY_ACTIONS, keymap, type Action } from './controls';
import { newGame, type GameState, type GameStats } from './gameState';
import { kickTable, type Rotation } from './kicktable';
import { getSquaresTaken, spawnPiece, spawnPieceFromHold } from './piece';
import { clearText, detectSpin, spinText, type LastRotation } from './spin';

/** The game runs on a fixed 60 frames per second tick, independent of refresh rate. */
const FPS = 60;
const FRAME_MS = 1000 / FPS;
/** Upper bound on frames simulated in one animation frame, so a stall can't spiral. */
const MAX_CATCHUP = 5;
/** Soft drop factor at which soft dropping becomes instant. */
const SDF_MAX = 41;
/** How many times a movement may restart the lock delay. */
const MAX_LOCK_RESETS = 15;
/** Displayed B2B count at which Surge starts charging, one line per B2B. */
const SURGE_AT = 4;
/** Surge is released as this many separate attacks. */
const SURGE_SEGMENTS = 3;
/** Frames "GO" takes to fade out once the countdown ends. */
const GO_FRAMES = FPS;

export interface Game {
  readonly state: GameState;
  /** True once a piece can no longer be spawned, or the mode's goal is met. */
  readonly over: boolean;
  start(): void;
  stop(): void;
  restart(): void;
  /** Queues incoming garbage. It enters the board once it has travelled. */
  receiveGarbage(lines: number): void;
  /** The board with the current piece drawn in, for showing to other players. */
  snapshot(): BoardSnapshot;
}

/**
 * A board as other players see it: `cells` holds `width` characters per row,
 * bottom row first, with "." for empty and the cell's number otherwise.
 */
export interface BoardSnapshot {
  width: number;
  cells: string;
}

/** Hooks for a game played against others. Retry is disabled and exit forfeits. */
export interface NetPlay {
  /** Seeds the piece order, so every player gets the same pieces. */
  seed: number;
  /** Called with the garbage an attack sends, after cancelling incoming garbage. */
  onAttack(lines: number): void;
  /** Called once when the player tops out or forfeits. */
  onTopOut(): void;
}

/** Garbage on its way to this board. */
interface IncomingGarbage {
  lines: number;
  /** Column left open in every line of this attack. */
  hole: number;
  /** Play frame from which it may enter the board. */
  readyFrame: number;
}

export interface GameEvents {
  /** Called after the exit key stops the game. */
  onExit?(): void;
  /** Called after the mode's goal is met and the game has stopped. */
  onFinish?(stats: GameStats): void;
}

export function createGame(
  room: RoomConfig = DEFAULT_ROOM_CONFIG,
  config: Config = DEFAULT_CONFIG,
  mode: Mode = { name: 'Endless' },
  events: GameEvents = {},
  net?: NetPlay,
): Game {
  const keys = keymap(GAMEPLAY_ACTIONS, config.controls);
  const options = room.game.options;
  const handling = config.handling;

  let state = init();
  let over = false;
  let running = false;
  let frame = 0;

  /** Real time not yet simulated, in milliseconds. */
  let accumulator = 0;
  let lastTime = 0;
  /** Fraction of a cell the piece has fallen towards the next one. */
  let gravityProgress = 0;
  /** Frames the piece has spent grounded. */
  let lockFrames = 0;
  let lockResets = 0;
  let grounded = false;
  let holdUsed = false;
  let softDropping = false;
  /** Set by a successful rotation, cleared by any successful movement. */
  let lastRotation: LastRotation | null = null;
  /** Frames left before play begins. Gameplay keys are ignored until then. */
  let countdownFrames = (mode.countdown ?? 0) * FPS;
  /** Frames left in the "GO" fade out. */
  let goFrames = 0;
  /** Frames played since the countdown ended. */
  let playFrames = 0;
  /** Clears in a row before the current one, -1 when there's no combo. */
  let combo = -1;
  /** Difficult clears (quads and spins) in a row, without an easy clear between. */
  let b2b = 0;
  let incoming: IncomingGarbage[] = [];
  /** Gameplay actions whose keys are down, pressed when the countdown ends. */
  const heldActions = new Set<Action>();

  /** Direction currently held, and how many frames it has been held for. */
  let shiftDirection = 0;
  let shiftFrames = 0;
  /** Whether the held direction has finished charging DAS. */
  let dasCharged = false;
  /** Frames accrued towards the next auto-repeated movement. */
  let arrProgress = 0;

  function init(): GameState {
    const fresh = newGame(room, net?.seed);

    // newGame spawns before the queue has been filled, so top the queue up and
    // spawn again to get a real piece into play
    while (fresh.queue.length < options.nextcount)
      fresh.queue.push(fresh.pieceOrder.next());
    spawnPiece(fresh);

    // the playfield extends above the visible board, but newGame only allocates
    // the visible rows
    while (fresh.board.length < rows)
      fresh.board.push(Array(columns).fill(null));

    return fresh;
  }

  function fits(piece: Pieces, center: Vec2, rotation: number): boolean {
    for (const [x, y] of getSquaresTaken(
      piece,
      { x: center[0], y: center[1] },
      rotation,
    )) {
      if (x < 0 || x >= columns || y < 0 || y >= rows) return false;
      if (state.board[y]![x] !== null) return false;
    }
    return true;
  }

  function move(dx: number, dy: number): boolean {
    const { piece, center, rotation } = state.current;
    const target: Vec2 = [center[0] + dx, center[1] + dy];
    if (!fits(piece, target, rotation)) return false;
    state.current.center = target;
    lastRotation = null;
    resetLock();
    return true;
  }

  function rotate(turns: number): boolean {
    const { piece, center, rotation } = state.current;
    const to = (((rotation + turns) % 4) + 4) % 4;
    let table = kickTable[piece] ?? kickTable.default;

    if ((to + 2) % 4 == rotation) table = kickTable.default;

    const kicks = table[rotation as Rotation][to as Rotation] ?? [[0, 0]];

    for (const [kick, [dx, dy]] of kicks.entries()) {
      const target: Vec2 = [center[0] + dx, center[1] + dy];
      if (!fits(piece, target, to)) continue;
      state.current.center = target;
      state.current.rotation = to;
      lastRotation = { turns, kick };
      resetLock();
      return true;
    }
    return false;
  }

  function resetLock() {
    if (grounded && lockResets < MAX_LOCK_RESETS) {
      lockResets++;
      lockFrames = 0;
    }
  }

  function hold() {
    if (holdUsed) return;
    holdUsed = true;

    if (state.hold === null) {
      state.hold = state.current.piece;
      spawnPiece(state);
    } else {
      spawnPieceFromHold(state);
    }

    if (
      !fits(state.current.piece, state.current.center, state.current.rotation)
    ) {
      topOut();
    }
    resetPieceTimers();
  }

  function topOut() {
    if (over) return;
    over = true;
    net?.onTopOut();
  }

  function hardDrop() {
    while (move(0, -1));
    lock();
  }

  function lock() {
    const { piece, center, rotation } = state.current;
    const spin = detectSpin(
      options.spinbonuses,
      piece,
      center,
      rotation,
      lastRotation,
      (x, y) => x < 0 || x >= columns || y < 0 || state.board[y]?.[x] != null,
      (dx, dy) => fits(piece, [center[0] + dx, center[1] + dy], rotation),
    );

    for (const [x, y] of getSquaresTaken(
      piece,
      { x: center[0], y: center[1] },
      rotation,
    )) {
      state.board[y]![x] = piece;
    }

    const lines = clearLines();
    const clear = clearText(lines);
    if (lines > 0) attack(lines, spin);
    else {
      combo = -1;
      takeGarbage();
    }
    if (clear !== '' || spin !== null)
      showClear(
        clear,
        spin && { text: spinText(spin), color: colors[spin.piece] },
      );
    state.stats.pieces++;
    holdUsed = false;

    if (mode.lines !== undefined && state.stats.lines >= mode.lines) {
      over = true;
      queueMicrotask(() => {
        stop();
        events.onFinish?.(state.stats);
      });
      return;
    }

    spawnPiece(state);
    while (state.queue.length < options.nextcount)
      state.queue.push(state.pieceOrder.next());

    if (
      !fits(state.current.piece, state.current.center, state.current.rotation)
    )
      topOut();
    resetPieceTimers();
  }

  /** Works out the garbage a clear sends, cancels incoming garbage with it, and sends the rest. */
  function attack(lines: number, spin: ReturnType<typeof detectSpin>) {
    combo++;
    let surge = 0;
    if (lines >= 4 || spin !== null) b2b++;
    else {
      surge = surgeLines();
      b2b = 0;
    }

    // a B2B streak adds a line to every attack after the first difficult clear
    const base = baseAttack(lines, spin) + (b2b >= 2 ? 1 : 0);
    let sent = comboTables.multiplier(base, combo);
    const allClear = state.board.every((row) => row.every((cell) => cell === null));
    if (allClear) sent += ALL_CLEAR_BONUS;
    sent = Math.floor(sent * options.garbagemultiplier);
    send(sent);

    // breaking the streak releases Surge as separate attacks, the first ones
    // taking the remainder, e.g. 8 lines is 3, 3, 2
    for (let i = 0; i < SURGE_SEGMENTS; i++) {
      const segment =
        Math.floor(surge / SURGE_SEGMENTS) + (i < surge % SURGE_SEGMENTS ? 1 : 0);
      send(segment);
    }
  }

  /** Lines of Surge charged by the current B2B streak. */
  function surgeLines(): number {
    // the displayed B2B count is one less than the streak, since the first
    // difficult clear doesn't count as back-to-back
    const shown = b2b - 1;
    return options.b2bchaining && shown >= SURGE_AT ? shown : 0;
  }

  /** Cancels incoming garbage with an attack, then sends what's left. */
  function send(lines: number) {
    while (lines > 0 && incoming.length > 0) {
      const cancelled = Math.min(lines, incoming[0]!.lines);
      lines -= cancelled;
      incoming[0]!.lines -= cancelled;
      if (incoming[0]!.lines === 0) incoming.shift();
    }
    if (lines > 0) net?.onAttack(lines);
  }

  /** Raises garbage that has finished travelling into the board, up to the garbage cap. */
  function takeGarbage() {
    let capacity = options.garbagecap;
    while (capacity > 0 && incoming.length > 0 && incoming[0]!.readyFrame <= playFrames) {
      const entry = incoming[0]!;
      const amount = Math.min(entry.lines, capacity);
      for (let i = 0; i < amount; i++) {
        const row: (Cell | null)[] = Array(columns).fill(GARBAGE);
        row[entry.hole] = null;
        state.board.unshift(row);
        // blocks pushed off the top of the playfield end the game
        if (state.board.pop()!.some((cell) => cell !== null)) topOut();
      }
      entry.lines -= amount;
      capacity -= amount;
      if (entry.lines === 0) incoming.shift();
    }
  }

  function receiveGarbage(lines: number) {
    if (over || lines <= 0) return;
    incoming.push({
      lines,
      hole: Math.floor(Math.random() * columns),
      readyFrame: playFrames + options.garbagespeed,
    });
  }

  function snapshot(): BoardSnapshot {
    const grid = state.board.map((row) => row.slice());
    if (!over) {
      const { piece, center, rotation } = state.current;
      for (const [x, y] of getSquaresTaken(piece, { x: center[0], y: center[1] }, rotation)) {
        if (grid[y]) grid[y]![x] = piece;
      }
    }
    // empty rows at the top don't need sending
    while (grid.length > 0 && grid[grid.length - 1]!.every((cell) => cell === null)) grid.pop();
    const cells = grid
      .map((row) => row.map((cell) => (cell === null ? '.' : String(cell))).join(''))
      .join('');
    return { width: columns, cells };
  }

  function clearLines(): number {
    let cleared = 0;
    for (let y = state.board.length - 1; y >= 0; y--) {
      if (state.board[y]!.some((cell) => cell === null)) continue;
      state.board.splice(y, 1);
      state.board.push(Array(columns).fill(null));
      cleared++;
    }
    state.stats.lines += cleared;
    return cleared;
  }

  function resetPieceTimers() {
    lastRotation = null;
    gravityProgress = 0;
    lockFrames = 0;
    lockResets = 0;
    grounded = false;
  }

  /**
   * Horizontal auto-shift: DAS charge followed by ARR repeats.
   *
   * @param preferDrop drop the piece as far as gravity allows before every
   * single cell of movement, so a gap under the piece is always taken first
   */
  function autoShift(preferDrop: boolean) {
    if (shiftDirection !== 0) {
      shiftFrames++;
      if (shiftFrames >= handling.das) {
        if (dasCharged) {
          arrProgress++;
        } else {
          // the first auto-repeat lands on the frame DAS finishes charging
          dasCharged = true;
          arrProgress = handling.arr;
        }

        if (handling.arr === 0) {
          for (;;) {
            if (preferDrop) fall();
            if (!move(shiftDirection, 0)) break;
          }
        } else {
          while (arrProgress >= handling.arr) {
            arrProgress -= handling.arr;
            if (preferDrop) fall();
            if (!move(shiftDirection, 0)) break;
          }
        }
      }
    }
  }

  /**
   * Adds this frame's gravity to the bank, in cells per second scaled down to
   * one frame. Soft dropping multiplies it, with a floor of 1 cell/s so it
   * stays quick under low gravity.
   */
  function chargeGravity() {
    const g = gravity();
    const cellsPerSecond = softDropping
      ? Math.max(g, 1) * handling.sdf
      : Math.max(g, 0);
    gravityProgress += cellsPerSecond / FPS;
  }

  /** Current gravity: the starting gravity, increasing every second once the margin time has passed. */
  function gravity(): number {
    const secondsIncreasing = Math.max(playFrames - options.gmargin, 0) / FPS;
    return options.g + options.gincrease * secondsIncreasing;
  }

  /** Spends whole cells of banked gravity, moving the piece down. */
  function fall() {
    if (softDropping && handling.sdf >= SDF_MAX) {
      while (move(0, -1));
      gravityProgress = 0;
      return;
    }

    while (gravityProgress >= 1) {
      gravityProgress--;
      if (!move(0, -1)) {
        gravityProgress = 0;
        break;
      }
    }
  }

  /** Advances the simulation by exactly one frame. */
  function step() {
    if (countdownFrames > 0) {
      countdownFrames--;
      if (countdownFrames > 0) return;

      // keys held through the countdown act as if pressed the moment it ends
      goFrames = GO_FRAMES;
      for (const action of heldActions) press(action);
      return;
    }
    if (goFrames > 0) goFrames--;
    playFrames++;

    state.stats.time += FRAME_MS;
    state.stats.pps =
      state.stats.time > 0 ? state.stats.pieces / (state.stats.time / 1000) : 0;

    // with may20g the frame's gravity is banked before the piece shifts, so
    // every cell of movement gives way to a fall whenever there is room below
    const preferDrop = handling.may20g && softDropping;
    if (preferDrop) chargeGravity();
    autoShift(preferDrop);
    if (!preferDrop) chargeGravity();
    fall();

    // lock delay
    const { piece, center, rotation } = state.current;
    if (!fits(piece, [center[0], center[1] - 1], rotation)) {
      if (!grounded) {
        grounded = true;
        lockFrames = 0;
      }
      lockFrames++;
      if (lockFrames >= options.locktime) lock();
    } else {
      grounded = false;
      lockFrames = 0;
    }
  }

  function preview(piece: Pieces, dimmed = false) {
    return {
      squares: getSquaresTaken(piece, { x: 0, y: 0 }, 0),
      color: colors[piece],
      dimmed,
    };
  }

  function render() {
    drawBuffer.fill(0);

    setPreviews(
      state.hold === null
        ? null
        : preview(state.hold, holdUsed && config.video.holdlocked),
      state.queue.slice(0, options.nextcount).map((piece) => preview(piece)),
    );
    setStats(state.stats);
    setB2B(b2b - 1, surgeLines());
    const ready = incoming.filter((entry) => entry.readyFrame <= playFrames);
    const total = (entries: IncomingGarbage[]) =>
      entries.reduce((sum, entry) => sum + entry.lines, 0);
    setGarbageMeter(total(incoming) - total(ready), total(ready));
    if (countdownFrames > 0)
      setCountdown(String(Math.ceil(countdownFrames / FPS)));
    else if (goFrames > 0) setCountdown('GO', goFrames / GO_FRAMES);
    else setCountdown(null);

    for (let y = 0; y < rows; y++) {
      const row = state.board[y];
      if (row === undefined) continue;
      for (let x = 0; x < columns; x++) {
        const cell = row[x];
        if (cell !== null && cell !== undefined)
          drawBuffer[y * columns + x] = colors[cell];
      }
    }

    const { piece, center, rotation } = state.current;

    // ghost piece: the current piece dropped as far as it will go
    let ghostY = center[1];
    while (fits(piece, [center[0], ghostY - 1], rotation)) ghostY--;
    if (ghostY !== center[1]) {
      for (const [x, y] of getSquaresTaken(
        piece,
        { x: center[0], y: ghostY },
        rotation,
      )) {
        drawBuffer[y * columns + x] = (colors[piece] & 0xffffff00) | 0x60;
      }
    }

    for (const [x, y] of getSquaresTaken(
      piece,
      { x: center[0], y: center[1] },
      rotation,
    )) {
      drawBuffer[y * columns + x] = colors[piece];
    }

    draw();
  }

  function tick(now: number) {
    frame = requestAnimationFrame(tick);

    // the display may refresh at any rate, so bank the elapsed time and spend it
    // in whole 60hz frames
    accumulator += now - lastTime;
    lastTime = now;
    accumulator = Math.min(accumulator, MAX_CATCHUP * FRAME_MS);

    while (accumulator >= FRAME_MS) {
      accumulator -= FRAME_MS;
      if (!over) step();
    }

    render();
  }

  function startShift(direction: number) {
    shiftDirection = direction;
    shiftFrames = 0;
    dasCharged = false;
    arrProgress = 0;
    move(direction, 0);
  }

  function stopShift() {
    shiftDirection = 0;
    shiftFrames = 0;
    dasCharged = false;
    arrProgress = 0;
  }

  function press(action: Action) {
    switch (action) {
      case 'moveLeft':
        startShift(-1);
        break;
      case 'moveRight':
        startShift(1);
        break;
      case 'softDrop':
        softDropping = true;
        // drop a cell on the next frame rather than waiting out the interval
        gravityProgress = 1;
        break;
      case 'hardDrop':
        hardDrop();
        break;
      case 'rotateCCW':
        rotate(-1);
        break;
      case 'rotateCW':
        rotate(1);
        break;
      case 'rotate180':
        rotate(2);
        break;
      case 'hold':
        hold();
        break;
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const action =
      keys.get(event.code.toLowerCase()) ?? keys.get(event.key.toLowerCase());
    if (action === undefined) return;
    event.preventDefault();

    if (action === 'retry') {
      if (!net) restart();
      return;
    }
    if (action === 'exit') {
      if (net) {
        topOut();
        return;
      }
      stop();
      events.onExit?.();
      return;
    }

    if (event.repeat) return;
    heldActions.add(action);
    if (over || countdownFrames > 0) return;

    console.log('[keydown]', action);
    press(action);
  }

  function onKeyUp(event: KeyboardEvent) {
    const action =
      keys.get(event.code.toLowerCase()) ?? keys.get(event.key.toLowerCase());
    if (action === undefined) return;

    heldActions.delete(action);
    if (action === 'softDrop') softDropping = false;
    if (action === 'moveLeft' && shiftDirection === -1) stopShift();
    if (action === 'moveRight' && shiftDirection === 1) stopShift();
  }

  function start() {
    if (running) return;
    running = true;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    accumulator = 0;
    lastTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    cancelAnimationFrame(frame);
    // key releases go unheard while stopped
    heldActions.clear();
  }

  function restart() {
    state = init();
    countdownFrames = (mode.countdown ?? 0) * FPS;
    goFrames = 0;
    showClear('');
    over = false;
    holdUsed = false;
    softDropping = false;
    stopShift();
    accumulator = 0;
    lastTime = performance.now();
    resetPieceTimers();
    playFrames = 0;
    combo = -1;
    b2b = 0;
    incoming = [];
  }

  return {
    get state() {
      return state;
    },
    get over() {
      return over;
    },
    start,
    stop,
    restart,
    receiveGarbage,
    snapshot,
  };
}
