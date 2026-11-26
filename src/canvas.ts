import type { GameStats } from "./gp/gameState";
import type { Vec2 } from "./types";

const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;

const SQUARE_SIZE = 30;

/** Rows drawn inside the board outline. */
export let visibleRows = 20;
/** Extra rows above the visible board that pieces may occupy. */
export let bufferRows = 20;
/** Total addressable rows, visible plus buffer. */
export let rows = visibleRows + bufferRows;
export let columns = 10;

/** Top-left corner of the visible board within the canvas, in CSS pixels. */
let originX = 0;
let originY = 0;

/** Canvas size in CSS pixels. */
let cssWidth = 0;
let cssHeight = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  cssWidth = window.innerWidth;
  cssHeight = window.innerHeight;

  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  originX = Math.round((cssWidth - columns * SQUARE_SIZE) / 2);
  originY = Math.round((cssHeight - visibleRows * SQUARE_SIZE) / 2);
}

export function drawGrid() {
  ctx.strokeStyle = "gray";
  ctx.lineWidth = 1;
  for (let i = 1; i < columns; i++) {
    let x = originX + i * SQUARE_SIZE - 0.5;
    ctx.beginPath();
    ctx.moveTo(x, originY);
    ctx.lineTo(x, originY + visibleRows * SQUARE_SIZE);
    ctx.stroke();
  }

  for (let i = 1; i < visibleRows; i++) {
    let y = originY + i * SQUARE_SIZE - 0.5;
    ctx.beginPath();
    ctx.moveTo(originX, y);
    ctx.lineTo(originX + columns * SQUARE_SIZE, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "black";
  ctx.strokeRect(
    originX - 0.5,
    originY - 0.5,
    columns * SQUARE_SIZE + 1,
    visibleRows * SQUARE_SIZE + 1,
  );
}

/** Width of a preview panel, in cells. */
const PANEL_COLUMNS = 4;
/** Height of one preview slot, in cells. */
const SLOT_ROWS = 3;
/** Space between the board outline and a preview panel, in CSS pixels. */
const PANEL_GAP = 12;
/** Height of the labelled strip at the top of a panel, in CSS pixels. */
const PANEL_HEADER = 24;
/** Space between a panel border and its contents, in CSS pixels. */
const PANEL_PADDING = 12;

/** A piece to show in a preview panel, as offsets around its own centre. */
export interface Preview {
  squares: Vec2[];
  color: number;
  /** Greys the piece out, marking it as unusable. */
  dimmed?: boolean;
}

let holdPreview: Preview | null = null;
let nextPreviews: Preview[] = [];

/** Sets what the hold and next panels show on the following `draw()`. */
export function setPreviews(hold: Preview | null, next: Preview[]) {
  holdPreview = hold;
  nextPreviews = next;
}

function drawPreview(preview: Preview, panelX: number, slotY: number) {
  const xs = preview.squares.map(([x]) => x);
  const ys = preview.squares.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // centre the piece's bounding box inside its slot
  const left = panelX + ((PANEL_COLUMNS - (maxX - minX + 1)) * SQUARE_SIZE) / 2;
  const top = slotY + ((SLOT_ROWS - (maxY - minY + 1)) * SQUARE_SIZE) / 2;

  ctx.globalAlpha = preview.dimmed ? 0.3 : 1;
  ctx.fillStyle = `#${preview.color.toString(16).padStart(6, "0")}`;
  for (const [x, y] of preview.squares) {
    // board coordinates count upwards, screen coordinates downwards
    ctx.fillRect(
      left + (x - minX) * SQUARE_SIZE,
      top + (maxY - y) * SQUARE_SIZE,
      SQUARE_SIZE,
      SQUARE_SIZE,
    );
  }
  ctx.globalAlpha = 1;
}

/** Draws a labelled, outlined panel `slots` preview slots tall. */
function drawPanel(label: string, x: number, slots: number) {
  ctx.fillStyle = "gray";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(label, x, originY + PANEL_HEADER - 7);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x - PANEL_PADDING - 0.5,
    originY - PANEL_PADDING - 0.5,
    PANEL_COLUMNS * SQUARE_SIZE + 2 * PANEL_PADDING + 1,
    PANEL_HEADER + slots * SLOT_ROWS * SQUARE_SIZE + 2 * PANEL_PADDING + 1,
  );
}

function drawPanels() {
  const holdX =
    originX - PANEL_GAP - PANEL_PADDING - PANEL_COLUMNS * SQUARE_SIZE;
  const nextX = originX + columns * SQUARE_SIZE + PANEL_GAP + PANEL_PADDING;

  drawPanel("HOLD", holdX, 1);
  drawPanel("NEXT", nextX, Math.max(nextPreviews.length, 1));

  const slotsY = originY + PANEL_HEADER;
  if (holdPreview !== null) drawPreview(holdPreview, holdX, slotsY);
  for (let i = 0; i < nextPreviews.length; i++) {
    drawPreview(nextPreviews[i]!, nextX, slotsY + i * SLOT_ROWS * SQUARE_SIZE);
  }
}

let stats: GameStats | null = null;

/** Sets the stats shown beside the board on the following `draw()`. */
export function setStats(next: GameStats | null) {
  stats = next;
}

/** Height of one label and value pair in the stats column, in CSS pixels. */
const STAT_HEIGHT = 48;

export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centis = Math.floor((ms % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

/** Draws the stats right-aligned against the left of the board, bottom up. */
function drawStats() {
  if (stats === null) return;

  const entries: [string, string][] = [
    ["TIME", formatTime(stats.time)],
    ["PIECES", String(stats.pieces)],
    ["LINES", String(stats.lines)],
    ["PPS", stats.pps.toFixed(2)],
  ];

  const x = originX - PANEL_GAP;
  let y = originY + visibleRows * SQUARE_SIZE - entries.length * STAT_HEIGHT;

  ctx.textAlign = "right";
  for (const [label, value] of entries) {
    ctx.fillStyle = "gray";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(label, x, y + 16);
    ctx.fillStyle = "white";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(value, x, y + 40);
    y += STAT_HEIGHT;
  }
  ctx.textAlign = "left";
}

/** How long a line clear label stays on screen, in milliseconds. */
const CLEAR_LABEL_MS = 1500;

/** Spin text shown above a line clear, drawn in the spinning piece's color. */
export interface SpinLabel {
  text: string;
  color: number;
}

let clearLabel: {
  clear: string;
  spin: SpinLabel | null;
  shownAt: number;
} | null = null;

/**
 * Shows a line clear label with an optional spin label above it. Hides any
 * current label if there is nothing to show.
 */
export function showClear(clear: string, spin: SpinLabel | null = null) {
  clearLabel =
    clear !== "" || spin !== null
      ? { clear, spin, shownAt: performance.now() }
      : null;
}

/** Draws the line clear label left of the board, fading out over time. */
function drawClearLabel() {
  if (clearLabel === null) return;

  const elapsed = performance.now() - clearLabel.shownAt;
  if (elapsed >= CLEAR_LABEL_MS) {
    clearLabel = null;
    return;
  }

  const x = originX - PANEL_GAP;
  const y = originY + (visibleRows * SQUARE_SIZE) / 2;

  ctx.globalAlpha = 1 - elapsed / CLEAR_LABEL_MS;
  ctx.textAlign = "right";
  if (clearLabel.clear !== "") {
    ctx.fillStyle = "white";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(clearLabel.clear, x, y);
  }
  if (clearLabel.spin !== null) {
    ctx.fillStyle = `#${clearLabel.spin.color.toString(16).padStart(6, "0")}`;
    ctx.font = "500 16px sans-serif";
    // sits on the clear's line when there is no clear, otherwise just above it
    ctx.fillText(
      clearLabel.spin.text,
      x,
      clearLabel.clear !== "" ? y - 28 : y,
    );
  }
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

export let drawBuffer = new Uint32Array(rows * columns);

/**
 * Resizes the board, discarding its contents. Call this when starting a game
 * whose dimensions differ from the previous one.
 *
 * @param buffer rows above the visible board that pieces may occupy
 */
export function setBoardSize(width: number, height: number, buffer = height) {
  columns = width;
  visibleRows = height;
  bufferRows = buffer;
  rows = visibleRows + bufferRows;
  drawBuffer = new Uint32Array(rows * columns);
  resize();
  draw();
}

/** Incoming garbage lines, split by whether they can enter the board yet. */
let garbage = { waiting: 0, ready: 0 };

/** Sets the incoming garbage meter shown on the following `draw()`. */
export function setGarbageMeter(waiting: number, ready: number) {
  garbage = { waiting, ready };
}

/** Width of the incoming garbage meter, in CSS pixels. */
const METER_WIDTH = 6;

/** Draws incoming garbage as a bar up the left edge of the board, ready lines at the bottom. */
function drawGarbageMeter() {
  const x = originX - METER_WIDTH - 2;
  const bottom = originY + visibleRows * SQUARE_SIZE;
  const ready = Math.min(garbage.ready, visibleRows);
  const waiting = Math.min(garbage.waiting, visibleRows - ready);

  ctx.fillStyle = "#e5484d";
  ctx.fillRect(x, bottom - ready * SQUARE_SIZE, METER_WIDTH, ready * SQUARE_SIZE);
  ctx.fillStyle = "#f5a524";
  ctx.fillRect(
    x,
    bottom - (ready + waiting) * SQUARE_SIZE,
    METER_WIDTH,
    waiting * SQUARE_SIZE,
  );
}

let b2b = { count: 0, surge: 0 };

/** Sets the B2B counter and charged Surge shown on the following `draw()`. */
export function setB2B(count: number, surge: number) {
  b2b = { count, surge };
}

/** Draws the B2B counter and Surge left of the board, below the line clear label. */
function drawB2B() {
  if (b2b.count < 1) return;
  const x = originX - PANEL_GAP;
  const y = originY + (visibleRows * SQUARE_SIZE) / 2 + 36;

  ctx.textAlign = "right";
  ctx.fillStyle = "#f5c542";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`B2B ×${b2b.count}`, x, y);
  if (b2b.surge > 0) {
    ctx.fillStyle = "#f5a524";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText(`SURGE ${b2b.surge}`, x, y + 28);
  }
  ctx.textAlign = "left";
}

let countdown: { text: string; alpha: number } | null = null;

/** Sets the countdown text shown over the board; null hides it. */
export function setCountdown(text: string | null, alpha = 1) {
  countdown = text === null ? null : { text, alpha };
}

/** Draws the countdown text centred over the board. */
function drawCountdown() {
  if (countdown === null) return;

  ctx.globalAlpha = countdown.alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.font = "bold 96px sans-serif";
  ctx.fillText(
    countdown.text,
    originX + (columns * SQUARE_SIZE) / 2,
    originY + (visibleRows * SQUARE_SIZE) / 2,
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
}

export function draw() {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawGrid();
  drawPanels();
  drawStats();
  drawClearLabel();
  drawGarbageMeter();
  drawB2B();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const color = drawBuffer[row * columns + col];
      if (color !== 0) {
        // rows at or above visibleRows sit above the board outline, so they are
        // dimmed to mark them as being in the buffer zone
        ctx.globalAlpha = row < visibleRows ? 1 : 0.4;
        ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
        ctx.fillRect(
          originX + col * SQUARE_SIZE,
          originY + (visibleRows - 1 - row) * SQUARE_SIZE,
          SQUARE_SIZE,
          SQUARE_SIZE,
        );
      }
    }
  }
  ctx.globalAlpha = 1;
  drawCountdown();
}

window.addEventListener("resize", () => {
  resize();
  draw();
});

resize();
draw();
