import type { Spin } from "./spin";

/** Base garbage for a clear with no spin, indexed by lines cleared. */
const BASE_NORMAL = [0, 0, 1, 2, 4, 5];
/** Base garbage for a mini spin, indexed by lines cleared. Mini triples+ fall back to normal clears. */
const BASE_MINI = [0, 0, 1, 2, 4, 5];
/** Base garbage for a full spin, indexed by lines cleared. */
const BASE_SPIN = [0, 2, 4, 6, 10, 12];

/** Multiplier applied per combo step. */
const COMBO_BONUS = 0.25;
/** Log scale used for combos on attacks with no base value (e.g. singles). */
const COMBO_MINIFIER_LOG = 1.25;
/** All clears send this as a separate attack. */
export const ALL_CLEAR_BONUS = 10;

/** Base garbage for a line clear, before any B2B bonus or combo is applied. */
export function baseAttack(lines: number, spin: Spin): number {
  if (lines <= 0) return 0;
  const table = spin === null ? BASE_NORMAL : spin.mini ? BASE_MINI : BASE_SPIN;
  return table[Math.min(lines, table.length - 1)];
}

/**
 * The "multiplier" combo table. Returns garbage rounded down to whole lines.
 * @param attack Garbage before combo (base attack plus any B2B bonus).
 * @param combo Clears in a row before this one (0 = first clear).
 */
export function multiplier(attack: number, combo: number): number {
  if (attack > 0) return Math.floor(attack * (1 + COMBO_BONUS * combo));
  if (combo >= 2) return Math.floor(Math.log1p(COMBO_MINIFIER_LOG * combo));
  return 0;
}

export type ComboTableName = "multiplier";

export const comboTables: Record<ComboTableName, (attack: number, combo: number) => number> = {
  multiplier,
};
