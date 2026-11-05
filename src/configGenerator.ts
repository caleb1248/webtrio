import {
  DEFAULT_CONFIG,
  type Config,
  type Controls,
  type Handling,
  type InitialAction,
} from "./gp/config";
import { GUIDELINE_BINDS, WASD_BINDS, type Action } from "./gp/controls";

/** Labels for every bindable action, in the order they are listed. */
const ACTION_LABELS: Record<Action, string> = {
  moveLeft: "Move left",
  moveRight: "Move right",
  softDrop: "Soft drop",
  hardDrop: "Hard drop",
  rotateCCW: "Rotate CCW",
  rotateCW: "Rotate CW",
  rotate180: "Rotate 180",
  hold: "Hold",
  exit: "Exit",
  retry: "Retry",
  chat: "Chat (unused)",
  target1: "Target 1 (unused)",
  target2: "Target 2 (unused)",
  target3: "Target 3 (unused)",
  target4: "Target 4 (unused)",
  menuUp: "Menu up (unused)",
  menuDown: "Menu down (unused)",
  menuLeft: "Menu left (unused)",
  menuRight: "Menu right (unused)",
  menuBack: "Menu back (unused)",
  menuConfirm: "Menu confirm (unused)",
  openSocial: "Open social (unused)",
};

const INITIAL_ACTIONS: InitialAction[] = ["off", "tap", "hold"];

/** .ttc files store key codes upper case, e.g. "ARROWLEFT". */
function copyBinds(binds: Controls["custom"]): Controls["custom"] {
  const copy = {} as Controls["custom"];
  for (const action of Object.keys(ACTION_LABELS) as Action[])
    copy[action] = (binds[action] ?? []).map((key) => key.toUpperCase());
  return copy;
}

/** Keys each action may be bound to. */
const SLOTS = 3;

type Slots = Record<Action, (string | null)[]>;

function blankSlots(): Slots {
  const slots = {} as Slots;
  for (const action of Object.keys(ACTION_LABELS) as Action[])
    slots[action] = Array(SLOTS).fill(null);
  return slots;
}

/** Drops the unset slots, leaving each action's keys in slot order. */
function packSlots(slots: Slots): Controls["custom"] {
  const custom = {} as Controls["custom"];
  for (const action of Object.keys(ACTION_LABELS) as Action[])
    custom[action] = slots[action].filter((key) => key !== null);
  return custom;
}

const INPUT_CLASS = "px-2 py-1 bg-zinc-800 rounded";
const SLOT_CLASS =
  "w-32 px-2 py-0.5 text-sm text-left font-mono bg-zinc-800 rounded hover:bg-zinc-700 disabled:hover:bg-zinc-800";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function heading(text: string) {
  return element("h2", "mt-8 mb-3 text-xl font-bold", text);
}

/**
 * Fills `root` with a form for the controls and handling sections of a config,
 * and a button that downloads the whole config as config.ttc.
 *
 * @param onBack called when the back button is pressed
 */
export function mountConfigGenerator(root: HTMLElement, onBack: () => void) {
  const controls: Controls = { ...DEFAULT_CONFIG.controls };
  /**
   * The custom keys, slot by slot. Slots may be unset in any order, so they're
   * only packed into `controls.custom` when the config is downloaded.
   */
  let customSlots = blankSlots();
  const handling: Handling = { ...DEFAULT_CONFIG.handling };

  /** The action and slot waiting for a key press to bind, if any. */
  let listening: { action: Action; slot: number } | null = null;

  root.replaceChildren();
  root.append(element("h1", "text-3xl font-bold", "Config generator"));

  // controls

  root.append(heading("Controls"));

  const styleLabel = element("label", "flex items-center gap-3", "Style");
  const styleSelect = element("select", INPUT_CLASS);
  for (const style of ["guideline", "wasd", "custom"] as const) {
    const option = element("option", "", style);
    option.value = style;
    styleSelect.append(option);
  }
  styleSelect.value = controls.style;
  styleLabel.append(styleSelect);
  root.append(styleLabel);

  const bindsTable = element("div", "mt-4 grid grid-cols-[10rem_1fr] gap-2");
  root.append(bindsTable);

  function renderBinds() {
    const custom = controls.style === "custom";
    const shown = custom
      ? customSlots
      : copyBinds(controls.style === "wasd" ? WASD_BINDS : GUIDELINE_BINDS);

    bindsTable.replaceChildren();
    for (const action of Object.keys(ACTION_LABELS) as Action[]) {
      bindsTable.append(
        element("span", "text-zinc-400 py-0.5", ACTION_LABELS[action]),
      );

      const slots = element("div", "flex flex-wrap gap-2");
      for (let slot = 0; slot < SLOTS; slot++) {
        const key = shown[action][slot] ?? null;
        const waiting =
          listening?.action === action && listening.slot === slot;

        const button = element(
          "button",
          `${SLOT_CLASS} ${key === null && !waiting ? "text-zinc-500" : ""}`,
          waiting ? "press a key…" : (key ?? "unset"),
        );
        button.disabled = !custom;
        // a set slot is unset by a click, and an unset one then asks for a key
        button.addEventListener("click", () => {
          if (key !== null) {
            customSlots[action][slot] = null;
            listening = null;
          } else {
            listening = waiting ? null : { action, slot };
          }
          renderBinds();
        });
        slots.append(button);
      }
      bindsTable.append(slots);
    }
  }

  styleSelect.addEventListener("change", () => {
    controls.style = styleSelect.value as Controls["style"];
    // custom starts from a blank slate, with every slot unset
    if (controls.style === "custom") customSlots = blankSlots();
    listening = null;
    renderBinds();
  });

  function onKeyDown(event: KeyboardEvent) {
    if (listening === null || root.hidden) return;
    event.preventDefault();

    const key = event.code.toUpperCase();
    const slots = customSlots[listening.action];
    // a key already in another slot of this action moves to this one
    const existing = slots.indexOf(key);
    if (existing !== -1) slots[existing] = null;
    slots[listening.slot] = key;
    listening = null;
    renderBinds();
  }
  window.addEventListener("keydown", onKeyDown);

  renderBinds();

  // handling

  root.append(heading("Handling"));
  const handlingGrid = element(
    "div",
    "grid grid-cols-[10rem_auto] justify-start gap-x-4 gap-y-2 items-center",
  );
  root.append(handlingGrid);

  function sliderField(
    key: "arr" | "das" | "dcd" | "sdf",
    label: string,
    min: number,
    max: number,
    step: number,
    format: (value: number) => string,
    /** Puts the lowest value on the right, so dragging right lowers it. */
    reversed = false,
  ) {
    const row = element("div", "flex items-center gap-3");
    const input = element("input", "w-48 accent-zinc-400");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    if (reversed) input.dir = "rtl";
    input.value = String(Math.min(Math.max(handling[key], min), max));
    handling[key] = Number(input.value);

    const value = element("span", "w-12 tabular-nums", format(handling[key]));
    input.addEventListener("input", () => {
      handling[key] = Number(input.value);
      value.textContent = format(handling[key]);
    });

    row.append(input, value);
    handlingGrid.append(element("span", "text-zinc-400", label), row);
  }

  function checkboxField(
    key: "safelock" | "cancel" | "may20g",
    label: string,
  ) {
    const input = element("input", "justify-self-start");
    input.type = "checkbox";
    input.checked = handling[key];
    input.addEventListener("change", () => {
      handling[key] = input.checked;
    });
    handlingGrid.append(element("span", "text-zinc-400", label), input);
  }

  function initialActionField(key: "irs" | "ihs", label: string) {
    const select = element("select", INPUT_CLASS);
    for (const value of INITIAL_ACTIONS) {
      const option = element("option", "", value);
      option.value = value;
      select.append(option);
    }
    select.value = handling[key];
    select.addEventListener("change", () => {
      handling[key] = select.value as InitialAction;
    });
    handlingGrid.append(element("span", "text-zinc-400", label), select);
  }

  const frames = (value: number) => `${value.toFixed(1)}F`;
  sliderField("arr", "ARR", 0, 5, 0.1, frames, true);
  sliderField("das", "DAS", 1, 20, 0.1, frames, true);
  sliderField("dcd", "DCD", 0, 20, 0.1, frames, true);
  sliderField("sdf", "SDF", 5, 41, 1, (value) =>
    value >= 41 ? "∞x" : `${value}x`,
  );
  checkboxField("safelock", "Safe lock");
  checkboxField("cancel", "Cancel DAS");
  checkboxField("may20g", "Prefer soft drop");
  initialActionField("irs", "IRS");
  initialActionField("ihs", "IHS");

  // actions

  const actions = element("div", "mt-10 flex gap-3");
  const download = element(
    "button",
    "px-4 py-3 text-lg font-bold bg-zinc-600 rounded-lg hover:bg-zinc-500",
    "Download config.ttc",
  );
  const back = element(
    "button",
    "px-4 py-3 bg-zinc-800 rounded-lg hover:bg-zinc-700",
    "Back",
  );
  actions.append(download, back);
  root.append(actions);

  download.addEventListener("click", () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      controls: { ...controls, custom: packSlots(customSlots) },
      handling: { ...handling },
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = element("a");
    link.href = url;
    link.download = "config.ttc";
    link.click();
    URL.revokeObjectURL(url);
  });

  back.addEventListener("click", () => {
    listening = null;
    renderBinds();
    onBack();
  });
}
