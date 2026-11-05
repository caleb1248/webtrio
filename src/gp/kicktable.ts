// This file holds the SRS+ kick table used in tetr.io
// If a piece is blocked from rotating, the game will try each "kick", which moves the piece by a certain amount.
// The first kick that succeeds is used.
// If all fail, the rotation never happens.
// (clarification: Rotate then apply kick)

// SRS+: the 180° kick table is the same for all pieces including the I piece.

import { Pieces } from "../colors";
import type { Vec2 } from "../types";
type Rotation = 0 | 1 | 2 | 3;

type RotationMap = {
  [from in Rotation]: {
    [to in Rotation]?: Vec2[];
  };
}

type KickTable = {
  [piece in Pieces]?: RotationMap;
} & {
  default: RotationMap;
};
const kickTable: KickTable = {
  [Pieces.I]: {
    0: {
      1: [[0, 0], [-2, 0], [+1, 0], [-2, -1], [+1, +2]],
      3: [[0, 0], [-1, 0], [+2, 0], [-1, +2], [+2, -1]],
    },
    1: {
      0: [[0, 0], [+2, 0], [-1, 0], [+2, +1], [-1, -2]],
      2: [[0, 0], [-1, 0], [+2, 0], [-1, +2], [+2, -1]],
    },
    2: {
      1: [[0, 0], [+1, 0], [-2, 0], [+1, -2], [-2, +1]],
      3: [[0, 0], [+2, 0], [-1, 0], [+2, +1], [-1, -2]],
    },
    3: {
      2: [[0, 0], [-2, 0], [+1, 0], [-2, -1], [+1, +2]],
      0: [[0, 0], [+1, 0], [-2, 0], [+1, -2], [-2, +1]],
    },
  },

  default: {
    0: {
      1: [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
      2: [[0, 0], [0, +1], [+1, +1], [-1, +1], [+1, 0], [-1, 0]],
      3: [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
    },
    1: {
      0: [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
      3: [[0, 0], [+1, 0], [+1, +2], [+1, +1], [0, +2], [0, 1]],
      2: [[0, 0], [+1, 0], [+1, -1], [0, +2], [+1, +2]],
    },
    2: {
      1: [[0, 0], [-1, 0], [-1, +1], [0, -2], [-1, -2]],
      0: [[0,0], [0,-1], [-1, -1], [+1, -1], [-1, 0], [+1, 0]],
      3: [[0, 0], [+1, 0], [+1, +1], [0, -2], [+1, -2]],
    },
    3: {
      2: [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
      1: [[0, 0], [-1, 0], [-1, +2], [-1, 1], [0,  +2], [0, 1]],
      0: [[0, 0], [-1, 0], [-1, -1], [0, +2], [-1, +2]],
    },
  },
};



export type { Rotation, KickTable, RotationMap };
export { kickTable };