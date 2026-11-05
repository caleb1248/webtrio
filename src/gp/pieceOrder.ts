import type { Pieces } from "../colors";

export interface PieceOrder {
  next(): Pieces;
}

export function random(): PieceOrder {
  return {
    next: () => Math.floor(Math.random() * 7) as Pieces,
  };
}

export function bag(length: number): PieceOrder {
  const bag: Pieces[] = Array.from({ length }, (_, i) => (i % 7) as Pieces);
  let index = bag.length; // start at the end so it gets shuffled immediately

  return {
    next: () => {
      if (index >= bag.length) {
        console.log("the bag is", bag);
        // shuffle the bag
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        index = 0;
      }
      console.log("loading piece", index);
      return bag[index++] as Pieces;
    },
  };
}
