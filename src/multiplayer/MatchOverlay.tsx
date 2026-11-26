import { useEffect, useRef } from "preact/hooks";
import { colors, type Cell } from "../colors";
import type { BoardSnapshot } from "../gp/game";
import type { RoomMember } from "../server/protocol";

/** Size of one cell on an opponent's board, in CSS pixels. */
const CELL = 12;

/** What the overlay shows during a game, on top of the player's own board. */
export interface MatchView {
  /** Everyone else playing. */
  opponents: RoomMember[];
  /** Visible rows of every board. */
  visibleRows: number;
  /** Board width, used until an opponent's first snapshot arrives. */
  width: number;
  boards: Record<string, BoardSnapshot>;
  /** Ids of players who have topped out, this player included. */
  dead: string[];
  /** Set once the game is over. */
  result: { winner: RoomMember | null } | null;
}

function OpponentBoard({
  member,
  board,
  width,
  visibleRows,
  dead,
}: {
  member: RoomMember;
  board: BoardSnapshot | undefined;
  width: number;
  visibleRows: number;
  dead: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const columns = board?.width ?? width;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = columns * CELL * dpr;
    el.height = visibleRows * CELL * dpr;
    const ctx = el.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, columns * CELL, visibleRows * CELL);
    if (!board) return;

    for (let i = 0; i < board.cells.length; i++) {
      const char = board.cells[i]!;
      if (char === ".") continue;
      const x = i % board.width;
      const y = Math.floor(i / board.width);
      if (y >= visibleRows) break;
      const color = colors[Number(char) as Cell];
      ctx.fillStyle = `#${color.toString(16).padStart(8, "0")}`;
      // board rows count up from the bottom
      ctx.fillRect(x * CELL, (visibleRows - 1 - y) * CELL, CELL, CELL);
    }
  }, [board, columns, visibleRows]);

  return (
    <div class={`flex flex-col items-center gap-1 ${dead ? "opacity-40" : ""}`}>
      <span class="max-w-full text-xs font-bold truncate">{member.name}</span>
      <canvas
        ref={canvas}
        class="bg-black/40 border border-zinc-600"
        style={{ width: columns * CELL, height: visibleRows * CELL }}
      />
    </div>
  );
}

export function MatchOverlay({
  match,
  memberId,
}: {
  match: MatchView;
  memberId: string | null;
}) {
  const selfDead = memberId !== null && match.dead.includes(memberId);
  const { result } = match;

  let banner: string | null = null;
  if (result) {
    if (result.winner === null) banner = "Game over";
    else if (result.winner.id === memberId) banner = "You win!";
    else banner = `${result.winner.name} wins`;
  } else if (selfDead) {
    banner = "You topped out";
  }

  return (
    <div class="fixed inset-0 pointer-events-none text-white">
      <div class="absolute top-4 right-4 bottom-4 flex flex-col flex-wrap-reverse content-start gap-4">
        {match.opponents.map((member) => (
          <OpponentBoard
            key={member.id}
            member={member}
            board={match.boards[member.id]}
            width={match.width}
            visibleRows={match.visibleRows}
            dead={match.dead.includes(member.id)}
          />
        ))}
      </div>
      {banner && (
        <div class="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-3 text-3xl font-bold bg-black/70 rounded-xl">
          {banner}
        </div>
      )}
    </div>
  );
}
