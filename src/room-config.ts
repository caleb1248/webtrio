/**
 * Room config schema, mirroring room-config.md.
 *
 * Only `game.options.g`, `game.options.nextcount` and `game.options.locktime`
 * are actually honoured by the game right now; everything else is here so the
 * shape is right when the rest gets implemented.
 */

export type Bgm =
  | "RANDOM"
  | "RANDOMcalm"
  | "RANDOMbattle"
  | "kuchu-toshi"
  | "shikiichi-made-mousukoshi"
  | "touhoudaiensei"
  | "asayake-no-taiyou"
  | "in-sorrow-and-pains"
  | "honemi-ni-shimiiru-karasukaze"
  | "inorimichite"
  | "kaze-no-sanpomichi"
  | "muscat-to-shiroi-osara"
  | "natsuzora-to-syukudai"
  | "success-story"
  | "kaiser-hige-na-neko"
  | "akindo"
  | "philosophy"
  | "yoru-no-niji"
  | "shiroi-hyoutan"
  | "smoke"
  | "aijin-sanka"
  | "akai-tsuchi-wo-funde"
  | "burari-tokyo"
  | "back-water"
  | "burning-heart"
  | "hayate-no-sei"
  | "ice-eyes"
  | "ima-koso"
  | "prism"
  | "risky-area"
  | "fuyu-no-jinkoueisei"
  | "hatsuyuki"
  | "kansen-gairo"
  | "chiheisen-wo-koete"
  | "moyase-toushi-yobisamase-tamashii"
  | "naraku-heno-abyssmaze"
  | "samurai-sword"
  | "super-machine-soul"
  | "uchuu-5239"
  | "ultra-super-heros"
  | "21seiki-no-hitobito"
  | "haru-wo-machinagara"
  | "go-go-go-summer"
  | "sasurai-no-hitoritabi"
  | "wakana"
  | "zange-no-ma"
  | "subarashii-nichijou"
  | "asphalt"
  | "madobe-no-hidamari"
  | "minamoto"
  | "sora-no-sakura"
  | "suiu"
  | "freshherb-wreath-wo-genkan-ni";

export type BagType = "7-bag" | "14-bag" | "classic" | "pairs" | "total mayhem";

export type SpinBonuses =
  | "t-spins"
  | "t-spins+"
  | "all-mini"
  | "all-mini+"
  | "all"
  | "all+"
  | "mini-only"
  | "handheld"
  | "stupid"
  | "none";

export type Kickset = "SRS+" | "SRS" | "SRS-X" | "TETRA-X" | "NRS" | "ARS" | "ASC" | "none";

export interface RoomMeta {
  /** Name this room will display in the listing as. */
  name: string;
  /** Maximum players in this room. 0 = no limit. Does not apply retroactively. */
  userlimit: number;
  /** Whether to allow anonymous users to enter this room. Does not apply retroactively. */
  allowAnonymous: boolean;
  /** Background song to play. If random, not everyone will hear the same song. */
  bgm: Bgm;
  match: {
    /** Amount of rounds one must win to win the game. */
    ft: number;
    /** Amount of points one must have over the second place to secure the win. */
    wb: number;
  };
}

export interface GameOptions {
  /** Amount of extra lives one has. */
  stock: number;
  /** Width of the playfield, in columns. */
  boardwidth: number;
  /** Height of the visible playfield, in rows. */
  boardheight: number;
  /** The type of system used to generate random pieces. */
  bagtype: BagType;
  /** The type of pieces allowed to do spins. */
  spinbonuses: SpinBonuses;
  /** Whether to allow the 180 rotation key to be used. */
  allow180: boolean;
  /** The type of kicks that pieces can do. */
  kickset: Kickset;
  /** Whether to allow use of the Hard Drop button. */
  allow_harddrop: boolean;
  /** Whether to show the NEXT queue. */
  display_next: boolean;
  /** Whether to use the HOLD queue. */
  display_hold: boolean;
  /** Amount of pieces shown in the NEXT queue, if said queue is enabled. */
  nextcount: number;
  /** Whether to show the shadow piece. */
  display_shadow: boolean;
  /** Frames between a piece being placed and the next one spawning. */
  are: number;
  /** Frames between a piece being placed and the next one spawning, if a line was cleared. */
  lineclear_are: number;
  /** Whether to enforce the handling settings below. */
  room_handling: boolean;
  /** Auto Repeat Rate, enforced if `room_handling` is enabled. */
  room_handling_arr: number;
  /** Delayed Auto Shift, enforced if `room_handling` is enabled. */
  room_handling_das: number;
  /** Soft Drop Factor, enforced if `room_handling` is enabled. Use 21 for MAX. */
  room_handling_sdf: number;
  /** Starting gravity, in squares dropped per second. Higher is faster. */
  g: number;
  /** The amount of gravity increase per second. */
  gincrease: number;
  /** Frames until the gravity starts to increase. */
  gmargin: number;
  /** Starting garbage multiplier. 1 means normal amount of garbage, 2 means double. */
  garbagemultiplier: number;
  /** Frames until the garbage multiplier starts to increase. */
  garbagemargin: number;
  /** The amount of garbage multiplier increase per second. */
  garbageincrease: number;
  /** Frames until a piece locks down, if not using master levels. */
  locktime: number;
  /** The time it takes in frames for garbage to travel. */
  garbagespeed: number;
  /** Amount of garbage that may enter the screen at once. */
  garbagecap: number;
  /** The amount of garbage cap increase per second. */
  garbagecapincrease: number;
  /** Maximum amount the garbage cap may reach. */
  garbagecapmax: number;
  /** Whether to allow users to click boards to manually target them. */
  manual_allowed: boolean;
  /** Whether to make long Back-to-Back chains become more powerful. */
  b2bchaining: boolean;
  /** Whether to allow out-of-bound placements when they clear a line. */
  clutch: boolean;
  /** If disabled, attacks can be canceled while in transit or during latency. */
  passthrough: boolean;
}

/**
 * Values that aren't modifiable through `/set`, but which show up in options
 * objects sent by the server.
 */
export interface HiddenOptions {
  /** Protocol version. Always 15. */
  version: number;
  seed_random: boolean;
  seed: number;
  countdown: boolean;
  countdown_count: number;
  /** Milliseconds between each count. */
  countdown_interval: number;
  /** Milliseconds before the countdown begins. */
  precountdown: number;
  /** Milliseconds before the time before the countdown begins. */
  prestart: number;
  /** Seems to be the room name. */
  mission: string;
  /** Unused. Always "mission_versus". */
  mission_type: string;
  zoominto: string;
  slot_counter1: string | null;
  slot_counter2: string | null;
  slot_counter3: string | null;
  slot_counter4: string | null;
  slot_counter5: string | null;
  slot_bar1: string | null;
  display_lines: boolean;
  display_attack: boolean;
  display_pieces: boolean;
  display_impending: boolean;
  display_kills: boolean;
  display_placement: boolean;
  display_fire: boolean;
  display_username: boolean;
  hasgarbage: boolean;
  /** Whether to keep the BGM playing between games. */
  neverstopbgm: boolean;
  /** Frames that a player needs to hold the quit button to forfeit. */
  forfeit_time: number;
  /** Whether to disable lock resets. */
  infinitemovement: boolean;
  /** How many times the lock delay may be reset by moving or rotating. */
  lockresets: number;
  objective: { type: string };
}

export interface RoomConfig {
  meta: RoomMeta;
  game: {
    options: GameOptions;
  };
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  meta: {
    name: "webtrio room",
    userlimit: 0,
    allowAnonymous: true,
    bgm: "RANDOM",
    match: { ft: 1, wb: 1 },
  },
  game: {
    options: {
      stock: 0,
      boardwidth: 10,
      boardheight: 20,
      bagtype: "7-bag",
      spinbonuses: "all-mini+",
      allow180: true,
      kickset: "SRS+",
      allow_harddrop: true,
      display_next: true,
      display_hold: true,
      nextcount: 5,
      display_shadow: true,
      are: 0,
      lineclear_are: 0,
      room_handling: false,
      room_handling_arr: 0,
      room_handling_das: 6,
      room_handling_sdf: 6,
      g: 1,
      gincrease: 0,
      gmargin: 0,
      garbagemultiplier: 1,
      garbagemargin: 0,
      garbageincrease: 0,
      locktime: 30,
      garbagespeed: 20,
      garbagecap: 8,
      garbagecapincrease: 0,
      garbagecapmax: 40,
      manual_allowed: false,
      b2bchaining: true,
      clutch: true,
      passthrough: false,
    },
  },
};
