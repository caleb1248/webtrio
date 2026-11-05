/** A way to play, as listed on the home screen menu. */
export interface Mode {
  name: string;
  /** Lines to clear to finish the game. Endless if omitted. */
  lines?: number;
  /** Seconds to count down before the game starts. */
  countdown?: number;
}

export const MODES: Mode[] = [
  { name: "40 Lines", lines: 40, countdown: 3 },
  { name: "Free Play" },
];
