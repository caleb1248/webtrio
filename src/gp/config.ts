/**
 * Client config schema, matching the `.ttc` files in sample_configs.
 *
 * A few of the video sliders come back as strings rather than numbers depending
 * on how they were last written, hence `Numeric`.
 */
type Numeric = number | string;

interface Config {
  controls: Controls;
  handling: Handling;
  volume: Volume;
  video: Video;
  gameoptions: GameOptions;
  electron: Electron;
  notifications: Notifications;
}

interface Controls {
  style: "guideline" | "wasd" | "custom";
  custom: {
    moveLeft: string[];
    moveRight: string[];
    softDrop: string[];
    hardDrop: string[];
    rotateCCW: string[];
    rotateCW: string[];
    rotate180: string[];
    hold: string[];
    exit: string[];
    retry: string[];
    chat: string[];
    target1: string[];
    target2: string[];
    target3: string[];
    target4: string[];
    menuUp: string[];
    menuDown: string[];
    menuLeft: string[];
    menuRight: string[];
    menuBack: string[];
    menuConfirm: string[];
    openSocial: string[];
  };
  /** Analog stick dead zone / sensitivity. */
  sensitivity: number;
  /** Gamepad vibration strength. */
  vibration: number;
}

/** Whether a rotate/hold buffered during ARE fires on tap or while held. */
type InitialAction = "off" | "tap" | "hold";

interface Handling {
  /** Auto Repeat Rate, in frames. */
  arr: number;
  /** Delayed Auto Shift, in frames. */
  das: number;
  /** DAS Cut Delay, in frames. */
  dcd: number;
  /** Soft Drop Factor. 41 is MAX. */
  sdf: number;
  /** Prevents locking a piece the frame soft drop is pressed. */
  safelock: boolean;
  /** Whether DAS is cancelled when the opposite direction is pressed. */
  cancel: boolean;
  /** Prefer softdrop over movement */
  may20g: boolean;
  /** Initial Rotation System. */
  irs: InitialAction;
  /** Initial Hold System. */
  ihs: InitialAction;
}

interface Volume {
  /** Mute everything. */
  disable: boolean;
  music: number;
  sfx: number;
  /** Stereo separation. */
  stereo: number;
  /** Play sounds for other players' boards. */
  others: boolean;
  /** Play sounds for incoming attacks. */
  attacks: boolean;
  zenithrank: boolean;
  /** Play a sound when a new piece enters the NEXT queue. */
  next: boolean;
  /** Don't restart the music between games. */
  noreset: boolean;
  oof: boolean;
  scrollable: boolean;
  /** Per-track volume overrides, keyed by track id. */
  bgmtweak: Record<string, number>;
}

type GraphicsQuality = "minimal" | "low" | "medium" | "high" | "ultra";
type CachingQuality = "low" | "medium" | "high";
type ActionText = "off" | "some" | "most" | "all";
type WebglMode = "off" | "webgl" | "webgl2";

interface Video {
  graphics: GraphicsQuality;
  caching: CachingQuality;
  /** How much of the clear/spin text to show. */
  actiontext: ActionText;
  particles: Numeric;
  /** Background brightness. */
  background: Numeric;
  /** Board bounce on hard drop. */
  bounciness: Numeric;
  /** Screen shake on hard drop. */
  shakiness: Numeric;
  gridopacity: Numeric;
  boardopacity: Numeric;
  shadowopacity: Numeric;
  zoom: Numeric;
  /** Always use the small board layout. */
  alwaystiny: boolean;
  nosuperlobbyanim: boolean;
  nozenithanim: boolean;
  /** Tint the shadow piece with the piece's colour. */
  colorshadow: boolean;
  /** Grey out the hold piece once hold has been used. */
  holdlocked: boolean;
  sidebyside: boolean;
  /** Animate piece spins. */
  spin: boolean;
  chatfilter: boolean;
  /** Custom background image, or null for the default. */
  background_url: string | null;
  background_usecustom: boolean | null;
  nochat: boolean;
  hideroomids: boolean;
  emotes: boolean;
  emotes_anim: boolean;
  /** Danger siren when the stack gets high. */
  siren: boolean;
  powersave: boolean;
  invert: boolean;
  nobg: boolean;
  chatbg: boolean;
  replaytoolsnocollapse: boolean;
  /** Show KO counters. */
  kos: boolean;
  /** Show the fire effect. */
  fire: boolean;
  /** Warn when the window loses focus mid-game. */
  focuswarning: boolean;
  hidenetwork: boolean;
  /** Show the finesse/placement guide. */
  guide: boolean;
  lowrescounters: boolean;
  desktopnotifications: boolean;
  lowres: boolean;
  webgl: WebglMode;
  bloom: Numeric;
  chroma: Numeric;
  flashwave: Numeric;
}

interface GameOptions {
  /** Pro mode
   * Shows semi-transparent big numbers on top of the board indicating the number of lines left to clear.
   * Additionally, (explain later idk)
   */
  pro_40l: boolean;
  /** alert on finesse fault */
  pro_40l_alert: boolean;
  /** restart on finesse fault */
  pro_40l_retry: boolean;
  /** Show the stride/pace line in 40L. */
  stride_40l: boolean;
  pro_blitz: boolean;
  pro_blitz_alert: boolean;
  pro_blitz_retry: boolean;
  stride_blitz: boolean;
}

type LoginSkip = "never" | "once" | "always";

interface Electron {
  loginskip: LoginSkip;
  /** Frame rate cap, expressed as a multiple of the display refresh rate. */
  frameratelimit: string;
  /** Discord rich presence. */
  presence: boolean;
  taskbarflash: boolean;
  autoupdate: boolean;
  anglecompat: boolean;
  adblock: boolean;
  devtools: boolean;
}

/** When a given notification should fire. */
type NotificationMode = "off" | "ingame" | "outgame" | "both";

interface Notifications {
  /** Suppress all notifications. */
  suppress: boolean;
  forcesound: boolean;
  /** A friend came online. */
  online: NotificationMode;
  /** A friend went offline. */
  offline: NotificationMode;
  dm: NotificationMode;
  dm_pending: NotificationMode;
  invite: NotificationMode;
  other: NotificationMode;
}

/** The stock config, matching sample_configs/default.ttc. */
const DEFAULT_CONFIG: Config = {
  controls: {
    style: "guideline",
    custom: {
      moveLeft: [],
      moveRight: [],
      softDrop: [],
      hardDrop: [],
      rotateCCW: [],
      rotateCW: [],
      rotate180: [],
      hold: [],
      exit: [],
      retry: [],
      chat: [],
      target1: [],
      target2: [],
      target3: [],
      target4: [],
      menuUp: [],
      menuDown: [],
      menuLeft: [],
      menuRight: [],
      menuBack: [],
      menuConfirm: [],
      openSocial: [],
    },
    sensitivity: 0.5,
    vibration: 1,
  },
  handling: {
    arr: 2,
    das: 10,
    dcd: 2,
    sdf: 6,
    safelock: true,
    cancel: false,
    may20g: true,
    irs: "tap",
    ihs: "tap",
  },
  volume: {
    disable: false,
    music: 1,
    sfx: 1,
    stereo: 0.5,
    others: true,
    attacks: true,
    zenithrank: true,
    next: false,
    noreset: true,
    oof: true,
    scrollable: true,
    bgmtweak: {},
  },
  video: {
    graphics: "medium",
    caching: "low",
    actiontext: "all",
    particles: 0.6,
    background: 0.7,
    bounciness: 1,
    shakiness: 1,
    gridopacity: 0.1,
    boardopacity: 0.85,
    shadowopacity: 0.15,
    zoom: 1,
    alwaystiny: false,
    nosuperlobbyanim: false,
    nozenithanim: false,
    colorshadow: false,
    holdlocked: true,
    sidebyside: true,
    spin: true,
    chatfilter: true,
    background_url: null,
    background_usecustom: null,
    nochat: false,
    hideroomids: false,
    emotes: true,
    emotes_anim: true,
    siren: true,
    powersave: false,
    invert: false,
    nobg: false,
    chatbg: true,
    replaytoolsnocollapse: false,
    kos: true,
    fire: true,
    focuswarning: true,
    hidenetwork: false,
    guide: true,
    lowrescounters: false,
    desktopnotifications: true,
    lowres: false,
    webgl: "webgl2",
    bloom: 1,
    chroma: 0.5,
    flashwave: 1,
  },
  gameoptions: {
    pro_40l: false,
    pro_40l_alert: false,
    pro_40l_retry: false,
    stride_40l: false,
    pro_blitz: false,
    pro_blitz_alert: false,
    pro_blitz_retry: false,
    stride_blitz: false,
  },
  electron: {
    loginskip: "always",
    frameratelimit: "4x",
    presence: true,
    taskbarflash: true,
    autoupdate: true,
    anglecompat: false,
    adblock: false,
    devtools: false,
  },
  notifications: {
    suppress: false,
    forcesound: true,
    online: "ingame",
    offline: "off",
    dm: "both",
    dm_pending: "both",
    invite: "both",
    other: "both",
  },
};

export { DEFAULT_CONFIG };

export type {
  ActionText,
  CachingQuality,
  Config,
  Controls,
  Electron,
  GameOptions,
  GraphicsQuality,
  Handling,
  InitialAction,
  LoginSkip,
  NotificationMode,
  Notifications,
  Numeric,
  Video,
  Volume,
  WebglMode,
};
