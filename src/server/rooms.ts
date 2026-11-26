import {
  BAG_TYPES,
  BGMS,
  DEFAULT_ROOM_CONFIG,
  KICKSETS,
  SPIN_BONUSES,
  type RoomConfig,
} from '../room-config';
import type { Identity } from './api';
import {
  MAX_CHAT_LENGTH,
  type ClientMessage,
  type RoomMember,
  type RoomState,
  type RoomSummary,
  type ServerMessage,
} from './protocol';

/** A client connected over the data channel. */
export interface Connection {
  id: string;
  identity: Identity;
  send(message: ServerMessage): void;
}

/** A game being played in a room. */
interface Match {
  /** Everyone who was in the room when it started. */
  players: Map<string, Connection>;
  /** Players who haven't topped out. */
  alive: Set<string>;
}

interface Room {
  id: string;
  match: Match | null;
  hostId: string;
  /** Members in the order they joined, so the next host is the oldest member. */
  members: Map<string, Connection>;
  config: RoomConfig;
}

const ROOM_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ROOM_ID_LENGTH = 4;
const MAX_ROOM_NAME = 40;
/** Most garbage one attack may send, in case a client sends nonsense. */
const MAX_ATTACK = 100;

const rooms = new Map<string, Room>();
const connections = new Set<Connection>();
/** Which room each connection is in, if any. */
const roomOf = new Map<Connection, Room>();

/** Fields that must be one of a fixed list of strings. */
const ENUM_FIELDS: Record<string, readonly string[]> = {
  bgm: BGMS,
  bagtype: BAG_TYPES,
  spinbonuses: SPIN_BONUSES,
  kickset: KICKSETS,
};

function newRoomId(): string {
  let id: string;
  do {
    id = '';
    for (let i = 0; i < ROOM_ID_LENGTH; i++) {
      id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    }
  } while (rooms.has(id));
  return id;
}

/**
 * Builds a valid value shaped like `fallback` out of untrusted input, keeping
 * each field of `input` only if it has the right type.
 */
function sanitize<T>(input: unknown, fallback: T): T {
  if (typeof fallback === 'object' && fallback !== null) {
    const source = typeof input === 'object' && input !== null ? input : {};
    const out = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(fallback)) {
      const given = (source as Record<string, unknown>)[key];
      const allowed = ENUM_FIELDS[key];
      if (allowed) out[key] = allowed.includes(given as string) ? given : value;
      else out[key] = sanitize(given, value);
    }
    return out as T;
  }
  if (typeof fallback === 'number') {
    return (typeof input === 'number' && Number.isFinite(input) && input >= 0
      ? input
      : fallback) as T;
  }
  return (typeof input === typeof fallback ? input : fallback) as T;
}

function sanitizeConfig(input: unknown, current: RoomConfig): RoomConfig {
  const config = sanitize(input, current);
  config.meta.name = config.meta.name.trim().slice(0, MAX_ROOM_NAME) || current.meta.name;
  config.meta.userlimit = Math.floor(config.meta.userlimit);
  return config;
}

function summary(room: Room): RoomSummary {
  return {
    id: room.id,
    name: room.config.meta.name,
    players: room.members.size,
    userlimit: room.config.meta.userlimit,
    allowAnonymous: room.config.meta.allowAnonymous,
  };
}

function memberOf(conn: Connection): RoomMember {
  return { id: conn.id, name: conn.identity.name, guest: conn.identity.kind === 'guest' };
}

function roomState(room: Room): RoomState {
  const members = [...room.members.values()].map(memberOf);
  return {
    id: room.id,
    hostId: room.hostId,
    members,
    config: room.config,
    playing: room.match !== null,
  };
}

function sendRoomList(to: Iterable<Connection>) {
  const list = [...rooms.values()].map(summary);
  for (const conn of to) conn.send({ t: 'rooms', rooms: list });
}

/** Tells everyone not in a room that the room list changed. */
function broadcastRoomList() {
  sendRoomList([...connections].filter((conn) => !roomOf.has(conn)));
}

function broadcastRoom(room: Room) {
  const state = roomState(room);
  for (const conn of room.members.values()) conn.send({ t: 'room', room: state });
}

function sendToRoom(room: Room, message: ServerMessage, except?: Connection) {
  for (const member of room.members.values()) {
    if (member !== except) member.send(message);
  }
}

/** Ends the game once at most one player is left, or none in a solo game. */
function checkMatchEnd(room: Room) {
  const match = room.match;
  if (!match) return;
  const needed = match.players.size > 1 ? 1 : 0;
  if (match.alive.size > needed) return;

  const winnerId = match.alive.values().next().value;
  const winner = winnerId === undefined ? undefined : match.players.get(winnerId);
  room.match = null;
  sendToRoom(room, { t: 'end', winner: winner ? memberOf(winner) : null });
  broadcastRoom(room);
}

function topOut(conn: Connection, room: Room) {
  if (!room.match?.alive.delete(conn.id)) return;
  sendToRoom(room, { t: 'dead', id: conn.id });
  checkMatchEnd(room);
}

function leaveRoom(conn: Connection) {
  const room = roomOf.get(conn);
  if (!room) return;
  // leaving mid-game counts as topping out
  topOut(conn, room);
  room.match?.players.delete(conn.id);
  room.members.delete(conn.id);
  roomOf.delete(conn);

  if (room.members.size === 0) {
    rooms.delete(room.id);
  } else {
    if (room.hostId === conn.id) room.hostId = room.members.keys().next().value!;
    broadcastRoom(room);
  }
  broadcastRoomList();
}

function joinRoom(conn: Connection, room: Room) {
  room.members.set(conn.id, conn);
  roomOf.set(conn, room);
  broadcastRoom(room);
  broadcastRoomList();
}

function handle(conn: Connection, message: ClientMessage) {
  const error = (text: string) => conn.send({ t: 'error', message: text });

  switch (message.t) {
    case 'create': {
      leaveRoom(conn);
      const config = structuredClone(DEFAULT_ROOM_CONFIG);
      config.meta.name = `${conn.identity.name}'s room`;
      const room: Room = {
        id: newRoomId(),
        match: null,
        hostId: conn.id,
        members: new Map(),
        config,
      };
      rooms.set(room.id, room);
      joinRoom(conn, room);
      return;
    }

    case 'join': {
      const id = typeof message.id === 'string' ? message.id.trim().toUpperCase() : '';
      const room = rooms.get(id);
      if (!room) return error('That room does not exist.');
      if (roomOf.get(conn) === room) return;
      const { userlimit, allowAnonymous } = room.config.meta;
      if (!allowAnonymous && conn.identity.kind === 'guest') {
        return error('This room does not allow guests.');
      }
      if (userlimit > 0 && room.members.size >= userlimit) return error('This room is full.');
      leaveRoom(conn);
      joinRoom(conn, room);
      return;
    }

    case 'leave': {
      const wasInRoom = roomOf.has(conn);
      leaveRoom(conn);
      conn.send({ t: 'left' });
      // leaving already sent the list to everyone outside a room
      if (!wasInRoom) sendRoomList([conn]);
      return;
    }

    case 'config': {
      const room = roomOf.get(conn);
      if (!room) return error('You are not in a room.');
      if (room.hostId !== conn.id) return error('Only the host can change the room config.');
      if (room.match) return error("The config can't be changed during a game.");
      room.config = sanitizeConfig(message.config, room.config);
      broadcastRoom(room);
      broadcastRoomList();
      return;
    }

    case 'chat': {
      const room = roomOf.get(conn);
      if (!room) return error('You are not in a room.');
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      if (!text) return;
      const chat = {
        from: memberOf(conn),
        text: text.slice(0, MAX_CHAT_LENGTH),
        at: Date.now(),
      };
      for (const member of room.members.values()) member.send({ t: 'chat', message: chat });
      return;
    }

    case 'start': {
      const room = roomOf.get(conn);
      if (!room) return error('You are not in a room.');
      if (room.hostId !== conn.id) return error('Only the host can start the game.');
      if (room.match) return error('A game is already running.');

      room.match = {
        players: new Map(room.members),
        alive: new Set(room.members.keys()),
      };
      const seed = Math.floor(Math.random() * 2 ** 32);
      const players = [...room.members.values()].map(memberOf);
      sendToRoom(room, { t: 'start', seed, config: room.config, players });
      broadcastRoom(room);
      return;
    }

    case 'board': {
      const room = roomOf.get(conn);
      if (!room?.match?.players.has(conn.id)) return;
      const board = message.board;
      if (typeof board?.width !== 'number' || typeof board.cells !== 'string') return;
      sendToRoom(room, { t: 'board', id: conn.id, board }, conn);
      return;
    }

    case 'attack': {
      const room = roomOf.get(conn);
      const match = room?.match;
      if (!match?.alive.has(conn.id)) return;
      const lines = Math.min(Math.floor(Number(message.lines)), MAX_ATTACK);
      if (!(lines > 0)) return;
      // each attack goes to a random opponent who is still in
      const targets = [...match.alive].filter((id) => id !== conn.id);
      if (targets.length === 0) return;
      const target = targets[Math.floor(Math.random() * targets.length)]!;
      match.players.get(target)!.send({ t: 'garbage', lines, from: conn.id });
      return;
    }

    case 'topout': {
      const room = roomOf.get(conn);
      if (room) topOut(conn, room);
      return;
    }

    default:
      return error('Unknown message.');
  }
}

export function onConnect(conn: Connection) {
  connections.add(conn);
  conn.send({ t: 'hello', identity: conn.identity, memberId: conn.id });
  sendRoomList([conn]);
}

export function onMessage(conn: Connection, raw: string) {
  let message: ClientMessage;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof message !== 'object' || message === null) return;
  handle(conn, message);
}

export function onDisconnect(conn: Connection) {
  if (!connections.delete(conn)) return;
  leaveRoom(conn);
}
