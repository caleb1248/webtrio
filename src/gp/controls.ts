import type { Controls } from "./config";

/** Every bindable action. */
export type Action = keyof Controls["custom"];

/** Actions that drive the piece while a game is running. */
export const GAMEPLAY_ACTIONS = [
  "moveLeft",
  "moveRight",
  "softDrop",
  "hardDrop",
  "rotateCCW",
  "rotateCW",
  "rotate180",
  "hold",
  "retry",
  "exit",
] as const satisfies readonly Action[];

/** Actions that drive menus. */
export const MENU_ACTIONS = [
  "menuUp",
  "menuDown",
  "menuLeft",
  "menuRight",
  "menuBack",
  "menuConfirm",
  "openSocial",
] as const satisfies readonly Action[];

export const GUIDELINE_BINDS: Controls["custom"] = {
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  softDrop: ["ArrowDown"],
  hardDrop: ["Space"],
  rotateCCW: ["KeyZ", "ControlLeft", "ControlRight"],
  rotateCW: ["ArrowUp", "KeyX"],
  rotate180: ["KeyA"],
  hold: ["KeyC", "ShiftLeft", "ShiftRight"],
  exit: ["Escape"],
  retry: ["KeyR"],
  chat: ["KeyT"],
  target1: ["Digit1"],
  target2: ["Digit2"],
  target3: ["Digit3"],
  target4: ["Digit4"],
  menuUp: ["ArrowUp"],
  menuDown: ["ArrowDown"],
  menuLeft: ["ArrowLeft"],
  menuRight: ["ArrowRight"],
  menuBack: ["Escape"],
  menuConfirm: ["Enter"],
  openSocial: ["F1"],
};

export const WASD_BINDS: Controls["custom"] = {
  moveLeft: ["KeyA"],
  moveRight: ["KeyD"],
  softDrop: ["KeyS"],
  hardDrop: ["Space"],
  rotateCCW: ["KeyJ", "Comma"],
  rotateCW: ["KeyK", "Period"],
  rotate180: ["KeyL"],
  hold: ["ShiftLeft", "ShiftRight"],
  exit: ["Escape"],
  retry: ["KeyR"],
  chat: ["KeyT"],
  target1: ["Digit1"],
  target2: ["Digit2"],
  target3: ["Digit3"],
  target4: ["Digit4"],
  menuUp: ["KeyW"],
  menuDown: ["KeyS"],
  menuLeft: ["KeyA"],
  menuRight: ["KeyD"],
  menuBack: ["Escape"],
  menuConfirm: ["Enter"],
  openSocial: ["F1"],
};

export const DEFAULT_CONTROLS: Controls = {
  style: "guideline",
  custom: GUIDELINE_BINDS,
  sensitivity: 0.5,
  vibration: 1,
};

/** Resolves a control config down to the key list of each action. */
export function binds(controls: Controls = DEFAULT_CONTROLS): Controls["custom"] {
  if (controls.style === "guideline") return GUIDELINE_BINDS;
  if (controls.style === "wasd") return WASD_BINDS;
  return controls.custom;
}

/**
 * Builds a key -> action lookup covering only `actions`. Restricting the set
 * matters because a key may mean one thing in game and another in a menu.
 */
export function keymap(
  actions: readonly Action[],
  controls: Controls = DEFAULT_CONTROLS,
): Map<string, Action> {
  const resolved = binds(controls);
  const map = new Map<string, Action>();
  for (const action of actions) {
    for (const key of resolved[action] ?? []) map.set(key.toLowerCase(), action);
  }
  return map;
}
