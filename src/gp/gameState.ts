import { setBoardSize } from "../canvas";
import type { Pieces } from "../colors";
import type { RoomConfig } from "../room-config";
import type { Vec2 } from "../types";
import { spawnPiece } from "./piece";
import type { PieceOrder } from "./pieceOrder";
import * as pieceOrder from "./pieceOrder";

export interface GameState {
  queue: Pieces[];
  current: {
    piece: Pieces;
    center: Vec2;
    /** 0 for top, 1 for right, 2 for bottom, 3 for left */
    rotation: number;
  };

  hold: Pieces | null;
  board: (Pieces | null)[][];

  pieceOrder: PieceOrder;
  config: RoomConfig;
  stats: GameStats;
}

export interface GameStats {
  /** milliseconds since start */
  time: number;
  /** self explanatory */
  pieces: number;
  /** num lines cleared */
  lines: number;
  /** pieces per second */
  pps: number;
}

function newPieceOrder(
  bagtype: RoomConfig["game"]["options"]["bagtype"],
): PieceOrder {
  if (bagtype === "7-bag") return pieceOrder.bag(7);
  if (bagtype === "14-bag") return pieceOrder.bag(14);
  return pieceOrder.random();
}

export function newGame(config: RoomConfig): GameState {
  const { boardwidth, boardheight, bagtype } = config.game.options;
  setBoardSize(boardwidth, boardheight);

  const state: GameState = {
    queue: [],
    current: {
      piece: 0,
      center: [0, 0],
      rotation: 0,
    },
    hold: null,
    board: Array(boardheight)
      .fill(null)
      .map(() => Array(boardwidth).fill(null)),
    pieceOrder: newPieceOrder(bagtype),
    stats: {
      time: 0,
      pieces: 0,
      lines: 0,
      pps: 0,
    },
    config,
  };

  spawnPiece(state);

  return state;
}
