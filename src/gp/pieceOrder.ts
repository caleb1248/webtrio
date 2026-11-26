import type { Pieces } from "../colors";

export interface PieceOrder {
  next(): Pieces;
}

/** Returns a number in [0, 1), like Math.random. */
export type Rng = () => number;

/** A small seeded RNG, so every player in a room gets the same pieces. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function random(rng: Rng = Math.random): PieceOrder {
  return {
    next: () => Math.floor(rng() * 7) as Pieces,
  };
}

export function bag(length: number, rng: Rng = Math.random): PieceOrder {
  const bag: Pieces[] = Array.from({ length }, (_, i) => (i % 7) as Pieces);
  let index = bag.length; // start at the end so it gets shuffled immediately

  return {
    next: () => {
      if (index >= bag.length) {
        console.log("the bag is", bag);
        // shuffle the bag
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        index = 0;
      }
      console.log("loading piece", index);
      return bag[index++] as Pieces;
    },
  };
}
