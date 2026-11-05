import { Pieces } from "../colors";
import type { SpinBonuses } from "../room-config";
import type { Vec2 } from "../types";

export type Spin = { piece: Pieces; mini: boolean } | null;

/** What the piece's last successful action was, for spin detection. */
export interface LastRotation {
  /** Turns rotated, -1, 1 or 2. */
  turns: number;
  /** Index of the kick that let the rotation succeed. */
  kick: number;
}

/** Checks whether the current piece fits at an offset from where it is. */
type FitsOffset = (dx: number, dy: number) => boolean;

/** The two corners on the side the T's nub points to, per rotation. */
const T_FRONT_CORNERS: Record<number, Vec2[]> = {
  0: [
    [-1, 1],
    [1, 1],
  ],
  1: [
    [1, 1],
    [1, -1],
  ],
  2: [
    [-1, -1],
    [1, -1],
  ],
  3: [
    [-1, 1],
    [-1, -1],
  ],
};

const T_CORNERS: Vec2[] = [
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
];

/** SRS kick index that upgrades a T-spin mini to a full T-spin (the "TST kick"). */
const UPGRADE_KICK = 4;

/**
 * Classic three corner T-spin check. Returns whether it is a spin at all and
 * whether it only counts as a mini.
 */
function tSpin(
  center: Vec2,
  rotation: number,
  last: LastRotation,
  filled: (x: number, y: number) => boolean,
): { spin: boolean; mini: boolean } {
  const isFilled = ([dx, dy]: Vec2) => filled(center[0] + dx, center[1] + dy);
  const corners = T_CORNERS.filter(isFilled).length;
  if (corners < 3) return { spin: false, mini: false };

  const front = T_FRONT_CORNERS[rotation]!.filter(isFilled).length;
  const upgraded = Math.abs(last.turns) === 1 && last.kick === UPGRADE_KICK;
  return { spin: true, mini: front < 2 && !upgraded };
}

/** A piece is immobile when it cannot move one cell in any direction. */
function immobile(fitsOffset: FitsOffset): boolean {
  return (
    !fitsOffset(-1, 0) &&
    !fitsOffset(1, 0) &&
    !fitsOffset(0, 1) &&
    !fitsOffset(0, -1)
  );
}

/**
 * Works out whether a piece locking down counts as a spin under the room's
 * spin bonus rules.
 *
 * @param last the last successful action, or null if it wasn't a rotation
 * @param filled whether a board cell is blocked, walls and floor included
 */
export function detectSpin(
  bonuses: SpinBonuses,
  piece: Pieces,
  center: Vec2,
  rotation: number,
  last: LastRotation | null,
  filled: (x: number, y: number) => boolean,
  fitsOffset: FitsOffset,
): Spin {
  if (last === null || bonuses === "none") return null;
  if (bonuses === "stupid") return { piece, mini: false };

  if (piece === Pieces.T) {
    const t = tSpin(center, rotation, last, filled);
    if (t.spin) {
      if (bonuses === "handheld") return { piece, mini: false };
      return { piece, mini: t.mini || bonuses === "mini-only" };
    }
    // the "+" variants also reward a T that is stuck in place without
    // satisfying the corner rule, as a mini
    if (bonuses.endsWith("+") && immobile(fitsOffset))
      return { piece, mini: true };
    return null;
  }

  if (bonuses === "t-spins" || bonuses === "t-spins+") return null;
  if (bonuses === "handheld") return null;
  if (!immobile(fitsOffset)) return null;

  const full = bonuses === "all" || bonuses === "all+";
  return { piece, mini: !full };
}

const CLEAR_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE", "QUAD"];

/** Text for a line clear, e.g. "DOUBLE". Empty if no lines were cleared. */
export function clearText(lines: number): string {
  return lines > 0 ? (CLEAR_NAMES[lines] ?? `${lines} LINES`) : "";
}

/** Text for a spin, e.g. "T-SPIN MINI". */
export function spinText(spin: NonNullable<Spin>): string {
  return `${Pieces[spin.piece]}-SPIN${spin.mini ? " MINI" : ""}`;
}
