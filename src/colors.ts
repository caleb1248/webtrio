export enum Pieces {
  S = 0,
  Z = 1,
  J = 2,
  L = 3,
  I = 4,
  T = 5,
  O = 6,
}

/** Board cell value for garbage lines, which aren't any piece. */
export const GARBAGE = 7;
/** What a filled board cell can hold. */
export type Cell = Pieces | typeof GARBAGE;

export const colors = {
  TRANSPARENT: 0x00000000,
  [GARBAGE]: 0x6b6b6bff,
  [Pieces.S]: 0x80ce52ff,
  [Pieces.Z]: 0xce5259ff,
  [Pieces.J]: 0x6652ceff,
  [Pieces.L]: 0xce8152ff,

  [Pieces.I]: 0x52ceacff,
  [Pieces.T]: 0xc352ceff,
  [Pieces.O]: 0xcec552ff,
};
