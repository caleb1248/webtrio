// Messages sent over the WebRTC data channel, shared by the server and client.
// Keep this file free of server-only imports so the client can import it.

import type { BoardSnapshot } from '../gp/game';
import type { RoomConfig } from '../room-config';
import type { Identity } from './api';

export interface RtcOfferRequest {
  sdp: string;
}

export type RtcAnswerResponse = { sdp: string } | { error: string };

export interface IceServersResponse {
  iceServers: RTCIceServer[];
}

export interface RoomMember {
  /** Unique per connection, so the same account in two tabs shows up twice. */
  id: string;
  name: string;
  guest: boolean;
}

/** A room as shown in the room list. */
export interface RoomSummary {
  id: string;
  name: string;
  players: number;
  /** 0 means no limit. */
  userlimit: number;
  allowAnonymous: boolean;
}

/** Everything a member of a room knows about it. */
export interface RoomState {
  id: string;
  hostId: string;
  members: RoomMember[];
  config: RoomConfig;
  /** Whether a game is being played. Members who joined during it sit it out. */
  playing: boolean;
}

export type ClientMessage =
  | { t: 'create' }
  | { t: 'join'; id: string }
  | { t: 'leave' }
  /** Only the host may change the config. */
  | { t: 'config'; config: RoomConfig }
  | { t: 'chat'; text: string }
  /** Only the host may start a game. */
  | { t: 'start' }
  /** The sender's board, sent whenever it changes during a game. */
  | { t: 'board'; board: BoardSnapshot }
  /** Garbage the sender's clear sent, after cancelling their own incoming garbage. */
  | { t: 'attack'; lines: number }
  /** The sender topped out or forfeited. */
  | { t: 'topout' };

export const MAX_CHAT_LENGTH = 300;

export interface ChatMessage {
  from: RoomMember;
  text: string;
  /** When the server relayed it, in ms since the epoch. */
  at: number;
}

export type ServerMessage =
  /** Sent once the connection is ready. `memberId` is this connection's id in any room it joins. */
  | { t: 'hello'; identity: Identity; memberId: string }
  /** Sent while not in a room, whenever the list changes. */
  | { t: 'rooms'; rooms: RoomSummary[] }
  /** Sent on joining a room and whenever anything in it changes. */
  | { t: 'room'; room: RoomState }
  /**
   * A chat message from someone in the room. The server doesn't keep these, so
   * only members who were in the room when it was sent ever see it.
   */
  | { t: 'chat'; message: ChatMessage }
  /** A game started. Everyone in `players` plays it with the same seed and config. */
  | { t: 'start'; seed: number; config: RoomConfig; players: RoomMember[] }
  /** Another player's board changed. */
  | { t: 'board'; id: string; board: BoardSnapshot }
  /** Garbage sent to this player. */
  | { t: 'garbage'; lines: number; from: string }
  /** A player topped out. */
  | { t: 'dead'; id: string }
  /** The game ended. `winner` is null if there was no one left, e.g. a solo game. */
  | { t: 'end'; winner: RoomMember | null }
  /** Sent after leaving a room. */
  | { t: 'left' }
  | { t: 'error'; message: string };
