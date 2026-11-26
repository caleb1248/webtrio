import { useEffect, useRef, useState } from "preact/hooks";
import type { Config } from "../gp/config";
import { createGame, type Game } from "../gp/game";
import type { Mode } from "../modes";
import type {
  ChatMessage,
  RoomState,
  RoomSummary,
  ServerMessage,
} from "../server/protocol";
import { Chat } from "./Chat";
import { connect, type ServerConnection } from "./connection";
import { MatchOverlay, type MatchView } from "./MatchOverlay";
import { RoomConfigEditor } from "./RoomConfigEditor";

const PRIMARY_BUTTON =
  "px-4 py-2 font-bold bg-zinc-600 rounded-lg hover:bg-zinc-500";
const SECONDARY_BUTTON = "px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700";

const MATCH_MODE: Mode = { name: "Multiplayer", countdown: 3 };
/** How often to check the board for changes to send, in ms. */
const SNAPSHOT_INTERVAL = 50;
/** How long the result stays up before returning to the room, in ms. */
const RESULT_MS = 3000;

type Status =
  | { kind: "connecting" }
  | { kind: "failed"; message: string }
  | { kind: "connected" };

interface MultiplayerProps {
  onBack: () => void;
  /** The player's own handling and controls, read when a game starts. */
  getConfig: () => Config;
  /** Shows or hides the game canvas. */
  showCanvas: (visible: boolean) => void;
}

/** Connects to the server while open, showing the room list or the current room. */
export function Multiplayer({
  onBack,
  getConfig,
  showCanvas,
}: MultiplayerProps) {
  const [status, setStatus] = useState<Status>({ kind: "connecting" });
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Only kept in memory, and only from when this client joined the room. */
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const conn = useRef<ServerConnection | null>(null);
  /** The room last seen, so joining a different one can clear the chat. */
  const roomId = useRef<string | null>(null);
  /** Set while a game is being played or its result is showing. */
  const [match, setMatch] = useState<MatchView | null>(null);
  const memberIdRef = useRef<string | null>(null);
  const props = useRef({ getConfig, showCanvas });
  props.current = { getConfig, showCanvas };

  useEffect(() => {
    let cancelled = false;
    let game: Game | null = null;
    let snapshotTimer: ReturnType<typeof setInterval> | undefined;
    let resultTimer: ReturnType<typeof setTimeout> | undefined;

    /** Stops the local game, leaving its last frame on screen. */
    function stopGame() {
      clearInterval(snapshotTimer);
      game?.stop();
      game = null;
    }

    /** Stops any game and goes back to the room view. */
    function closeMatch() {
      stopGame();
      clearTimeout(resultTimer);
      props.current.showCanvas(false);
      setMatch(null);
    }

    function startMatch(message: Extract<ServerMessage, { t: "start" }>) {
      closeMatch();
      const me = memberIdRef.current;
      if (!message.players.some((player) => player.id === me)) return;

      // a focused input would otherwise take the game's key presses
      (document.activeElement as HTMLElement | null)?.blur();
      props.current.showCanvas(true);

      const local = createGame(
        message.config,
        props.current.getConfig(),
        MATCH_MODE,
        {},
        {
          seed: message.seed,
          onAttack: (lines) => conn.current?.send({ t: "attack", lines }),
          onTopOut: () => conn.current?.send({ t: "topout" }),
        },
      );
      game = local;
      local.start();

      let lastSent = "";
      snapshotTimer = setInterval(() => {
        const board = local.snapshot();
        if (board.cells === lastSent) return;
        lastSent = board.cells;
        conn.current?.send({ t: "board", board });
      }, SNAPSHOT_INTERVAL);

      const { boardwidth, boardheight } = message.config.game.options;
      setMatch({
        opponents: message.players.filter((player) => player.id !== me),
        visibleRows: boardheight,
        width: boardwidth,
        boards: {},
        dead: [],
        result: null,
      });
    }

    connect().then(
      (connection) => {
        if (cancelled) return connection.close();
        conn.current = connection;
        setStatus({ kind: "connected" });

        connection.onMessage((message) => {
          switch (message.t) {
            case "hello":
              memberIdRef.current = message.memberId;
              setMemberId(message.memberId);
              break;
            case "rooms":
              setRooms(message.rooms);
              break;
            case "room":
              if (roomId.current !== message.room.id) setChat([]);
              roomId.current = message.room.id;
              setRoom(message.room);
              setError(null);
              break;
            case "chat":
              setChat((messages) => [...messages, message.message]);
              break;
            case "start":
              startMatch(message);
              break;
            case "board":
              setMatch(
                (m) =>
                  m && {
                    ...m,
                    boards: { ...m.boards, [message.id]: message.board },
                  },
              );
              break;
            case "garbage":
              game?.receiveGarbage(message.lines);
              break;
            case "dead":
              setMatch((m) => m && { ...m, dead: [...m.dead, message.id] });
              break;
            case "end":
              stopGame();
              setMatch(
                (m) => m && { ...m, result: { winner: message.winner } },
              );
              resultTimer = setTimeout(closeMatch, RESULT_MS);
              break;
            case "left":
              closeMatch();
              roomId.current = null;
              setRoom(null);
              setChat([]);
              break;
            case "error":
              setError(message.message);
              break;
          }
        });
        connection.onClose(() => {
          closeMatch();
          conn.current = null;
          roomId.current = null;
          setRoom(null);
          setChat([]);
          setStatus({
            kind: "failed",
            message: "Lost connection to the server.",
          });
        });
      },
      (err: Error) => {
        if (!cancelled) setStatus({ kind: "failed", message: err.message });
      },
    );

    return () => {
      cancelled = true;
      closeMatch();
      conn.current?.close();
      conn.current = null;
    };
  }, []);

  if (status.kind !== "connected") {
    return (
      <div class="p-10 text-white">
        <p class={status.kind === "failed" ? "text-red-400" : "text-zinc-400"}>
          {status.kind === "failed" ? status.message : "Connecting…"}
        </p>
        <button class={`mt-6 ${SECONDARY_BUTTON}`} onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  if (match) return <MatchOverlay match={match} memberId={memberId} />;

  if (room) {
    return (
      <Room
        room={room}
        memberId={memberId}
        error={error}
        chat={chat}
        onChat={(text) => conn.current?.send({ t: "chat", text })}
        onConfig={(config) => conn.current?.send({ t: "config", config })}
        onLeave={() => conn.current?.send({ t: "leave" })}
        onStart={() => conn.current?.send({ t: "start" })}
      />
    );
  }

  return (
    <Lobby
      rooms={rooms}
      error={error}
      onCreate={() => conn.current?.send({ t: "create" })}
      onJoin={(id) => conn.current?.send({ t: "join", id })}
      onBack={onBack}
    />
  );
}

interface LobbyProps {
  rooms: RoomSummary[];
  error: string | null;
  onCreate: () => void;
  onJoin: (id: string) => void;
  onBack: () => void;
}

function Lobby({ rooms, error, onCreate, onJoin, onBack }: LobbyProps) {
  const [code, setCode] = useState("");

  return (
    <div class="fixed inset-0 overflow-y-auto">
      <div class="flex flex-col gap-6 p-10 text-white max-w-xl">
        <h2 class="text-2xl font-bold">Multiplayer</h2>

        <div class="flex flex-wrap gap-2">
          <button class={PRIMARY_BUTTON} onClick={onCreate}>
            Create room
          </button>
          <form
            class="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) onJoin(code);
            }}
          >
            <input
              class="w-32 px-3 py-2 bg-zinc-900 rounded-lg uppercase placeholder:text-zinc-500"
              placeholder="Room code"
              value={code}
              onInput={(e) => setCode(e.currentTarget.value)}
            />
            <button class={SECONDARY_BUTTON}>Join</button>
          </form>
        </div>

        {error && <p class="text-sm text-red-400">{error}</p>}

        <section>
          <h3 class="mb-2 text-sm font-bold tracking-widest text-zinc-400 uppercase">
            Rooms
          </h3>
          {rooms.length === 0 ? (
            <p class="text-zinc-500">No rooms yet.</p>
          ) : (
            <ul class="flex flex-col gap-2">
              {rooms.map((room) => (
                <li key={room.id}>
                  <button
                    class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left bg-zinc-800 rounded-lg hover:bg-zinc-700"
                    onClick={() => onJoin(room.id)}
                  >
                    <span class="font-bold truncate">{room.name}</span>
                    <span class="shrink-0 text-sm text-zinc-400 tabular-nums">
                      {!room.allowAnonymous && "no guests · "}
                      {room.players}
                      {room.userlimit > 0 && ` / ${room.userlimit}`} · {room.id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button class={`self-start ${SECONDARY_BUTTON}`} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

interface RoomProps {
  room: RoomState;
  memberId: string | null;
  error: string | null;
  chat: ChatMessage[];
  onChat: (text: string) => void;
  onConfig: (config: RoomState["config"]) => void;
  onLeave: () => void;
  onStart: () => void;
}

function Room({
  room,
  memberId,
  error,
  chat,
  onChat,
  onConfig,
  onLeave,
  onStart,
}: RoomProps) {
  const isHost = room.hostId === memberId;

  return (
    <div class="fixed inset-0 flex flex-col text-white">
      <header class="flex shrink-0 items-center gap-4 px-6 py-3 border-b border-zinc-800">
        <h2 class="text-xl font-bold truncate">{room.config.meta.name}</h2>
        <span class="px-2 py-1 font-mono text-sm bg-zinc-800 rounded">
          {room.id}
        </span>
        <button class={`ml-auto ${SECONDARY_BUTTON}`} onClick={onLeave}>
          Leave
        </button>
      </header>

      {/* each column scrolls on its own */}
      <div class="flex flex-1 min-h-0">
        <aside class="w-60 shrink-0 p-6 overflow-y-auto border-r border-zinc-800">
          <h3 class="mb-3 text-sm font-bold tracking-widest text-zinc-400 uppercase">
            Players ({room.members.length})
          </h3>
          <ul class="flex flex-col gap-1">
            {room.members.map((member) => (
              <li key={member.id} class="flex items-center gap-2">
                <span
                  class={`truncate ${member.id === memberId ? "font-bold" : ""}`}
                >
                  {member.name}
                </span>
                {member.guest && (
                  <span class="text-xs text-zinc-500">guest</span>
                )}
                {member.id === room.hostId && (
                  <span class="ml-auto text-xs font-bold text-yellow-400">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <main class="flex-1 flex flex-col gap-6 p-10 min-w-0 overflow-y-auto">
          {error && <p class="text-sm text-red-400">{error}</p>}
          {!isHost && (
            <p class="text-sm text-zinc-400">
              Only the host can change the room config.
            </p>
          )}
          <RoomConfigEditor
            config={room.config}
            editable={isHost}
            onChange={onConfig}
          />
        </main>

        <aside class="w-80 shrink-0 border-l border-zinc-800">
          <Chat messages={chat} memberId={memberId} onSend={onChat} />
        </aside>
      </div>

      <footer class="flex shrink-0 items-center justify-center px-6 py-4 border-t border-zinc-800">
        {room.playing ? (
          <p class="text-zinc-400">
            A game is in progress. You'll play in the next one.
          </p>
        ) : isHost ? (
          <button class={`px-12 text-lg ${PRIMARY_BUTTON}`} onClick={onStart}>
            Start
          </button>
        ) : (
          <p class="text-zinc-400">Waiting for the host to start…</p>
        )}
      </footer>
    </div>
  );
}
