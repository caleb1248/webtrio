import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_CONFIG,
  type Config,
  type Controls,
  type Handling,
  type InitialAction,
} from './gp/config';
import { GUIDELINE_BINDS, WASD_BINDS, type Action } from './gp/controls';

/** Labels for every bindable action, in the order they are listed. */
const ACTION_LABELS: Record<Action, string> = {
  moveLeft: 'Move left',
  moveRight: 'Move right',
  softDrop: 'Soft drop',
  hardDrop: 'Hard drop',
  rotateCCW: 'Rotate CCW',
  rotateCW: 'Rotate CW',
  rotate180: 'Rotate 180',
  hold: 'Hold',
  exit: 'Exit',
  retry: 'Retry',
  chat: 'Chat (unused)',
  target1: 'Target 1 (unused)',
  target2: 'Target 2 (unused)',
  target3: 'Target 3 (unused)',
  target4: 'Target 4 (unused)',
  menuUp: 'Menu up (unused)',
  menuDown: 'Menu down (unused)',
  menuLeft: 'Menu left (unused)',
  menuRight: 'Menu right (unused)',
  menuBack: 'Menu back (unused)',
  menuConfirm: 'Menu confirm (unused)',
  openSocial: 'Open social (unused)',
};

const INITIAL_ACTIONS: InitialAction[] = ['off', 'tap', 'hold'];

/** .ttc files store key codes upper case, e.g. "ARROWLEFT". */
function copyBinds(binds: Controls['custom']): Controls['custom'] {
  const copy = {} as Controls['custom'];
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
function packSlots(slots: Slots): Controls['custom'] {
  const custom = {} as Controls['custom'];
  for (const action of Object.keys(ACTION_LABELS) as Action[])
    custom[action] = slots[action].filter((key) => key !== null);
  return custom;
}

const INPUT_CLASS = 'px-2 py-1 bg-zinc-800 rounded';
const SLOT_CLASS =
  'w-32 px-2 py-0.5 text-sm text-left font-mono bg-zinc-800 rounded hover:bg-zinc-700 disabled:hover:bg-zinc-800';

function Heading({ text }: { text: string }) {
  return <h2 class="mt-8 mb-3 text-xl font-bold">{text}</h2>;
}

/** Fills slots from a config's custom keys, adding slots past SLOTS if needed. */
function slotsFrom(binds: Controls['custom']): Slots {
  const slots = blankSlots();
  const copy = copyBinds(binds);
  for (const action of Object.keys(ACTION_LABELS) as Action[])
    copy[action].forEach((key, slot) => (slots[action][slot] = key));
  return slots;
}

/** Fills in any sections or values missing from a loaded config. */
function withDefaults(loaded: Partial<Config>): Config {
  const config = { ...DEFAULT_CONFIG };
  for (const section of Object.keys(DEFAULT_CONFIG) as (keyof Config)[])
    (config as Record<keyof Config, unknown>)[section] = {
      ...DEFAULT_CONFIG[section],
      ...loaded[section],
    };
  config.controls.custom = {
    ...DEFAULT_CONFIG.controls.custom,
    ...loaded.controls?.custom,
  };
  return config;
}

type SliderKey = 'arr' | 'das' | 'dcd' | 'sdf';

const frames = (value: number) => `${value.toFixed(1)}F`;

const SLIDERS: {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  /** Puts the lowest value on the right, so dragging right lowers it. */
  reversed?: boolean;
}[] = [
  {
    key: 'arr',
    label: 'ARR',
    min: 0,
    max: 5,
    step: 0.1,
    format: frames,
    reversed: true,
  },
  {
    key: 'das',
    label: 'DAS',
    min: 1,
    max: 20,
    step: 0.1,
    format: frames,
    reversed: true,
  },
  {
    key: 'dcd',
    label: 'DCD',
    min: 0,
    max: 20,
    step: 0.1,
    format: frames,
    reversed: true,
  },
  {
    key: 'sdf',
    label: 'SDF',
    min: 5,
    max: 41,
    step: 1,
    format: (value) => (value >= 41 ? '∞x' : `${value}x`),
  },
];

const CHECKBOXES: { key: 'safelock' | 'cancel' | 'may20g'; label: string }[] = [
  { key: 'safelock', label: 'Safe lock' },
  { key: 'cancel', label: 'Cancel DAS' },
  { key: 'may20g', label: 'Prefer soft drop' },
];

const INITIAL_ACTION_FIELDS: { key: 'irs' | 'ihs'; label: string }[] = [
  { key: 'irs', label: 'IRS' },
  { key: 'ihs', label: 'IHS' },
];

/** Pulls the slider values into their sliders' ranges. */
function clampHandling(handling: Handling): Handling {
  const clamped = { ...handling };
  for (const { key, min, max } of SLIDERS)
    clamped[key] = Math.min(Math.max(clamped[key], min), max);
  return clamped;
}

interface ConfigGeneratorProps {
  /** Hides the generator without losing its state. */
  hidden: boolean;
  /** Called when the back button is pressed. */
  onBack: () => void;
  /**
   * Called with the whole config whenever it changes, whether from a loaded
   * file or an edit in the form.
   */
  onChange: (config: Config) => void;
}

/**
 * A config file picker, a form for the controls and handling sections of a
 * config, and a button that downloads the whole config as config.ttc.
 */
export function ConfigGenerator({
  hidden,
  onBack,
  onChange,
}: ConfigGeneratorProps) {
  /** The loaded config, which supplies the sections the form doesn't cover. */
  const [base, setBase] = useState<Config>(DEFAULT_CONFIG);
  const [style, setStyle] = useState<Controls['style']>(
    DEFAULT_CONFIG.controls.style,
  );
  /**
   * The custom keys, slot by slot. Slots may be unset in any order, so they're
   * only packed into `controls.custom` when the config is read.
   */
  const [customSlots, setCustomSlots] = useState<Slots>(blankSlots);
  const [handling, setHandling] = useState<Handling>(() =>
    clampHandling(DEFAULT_CONFIG.handling),
  );
  /** The action and slot waiting for a key press to bind, if any. */
  const [listening, setListening] = useState<{
    action: Action;
    slot: number;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  function current(): Config {
    return {
      ...base,
      controls: { ...base.controls, style, custom: packSlots(customSlots) },
      handling: { ...handling },
    };
  }

  useEffect(() => {
    onChange(current());
  }, [base, style, customSlots, handling]);

  useEffect(() => {
    if (listening === null || hidden) return;
    const target = listening;

    function onKeyDown(event: KeyboardEvent) {
      event.preventDefault();

      const key = event.code.toUpperCase();
      setCustomSlots((prev) => {
        const slots = [...prev[target.action]];
        // a key already in another slot of this action moves to this one
        const existing = slots.indexOf(key);
        if (existing !== -1) slots[existing] = null;
        slots[target.slot] = key;
        return { ...prev, [target.action]: slots };
      });
      setListening(null);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [listening, hidden]);

  async function loadFile() {
    const input = fileInput.current!;
    const file = input.files?.[0];
    if (!file) return;

    let loaded: Config;
    try {
      loaded = withDefaults(JSON.parse(await file.text()));
    } catch {
      alert("couldn't read config file");
      return;
    } finally {
      // lets the same file be picked again to reload it
      input.value = '';
    }

    setBase(loaded);
    setStyle(loaded.controls.style);
    setCustomSlots(slotsFrom(loaded.controls.custom));
    setHandling(clampHandling(loaded.handling));
    setListening(null);
  }

  function changeStyle(next: Controls['style']) {
    setStyle(next);
    // custom starts from a blank slate, with every slot unset
    if (next === 'custom') setCustomSlots(blankSlots());
    setListening(null);
  }

  // a set slot is unset by a click, and an unset one then asks for a key
  function clickSlot(action: Action, slot: number, key: string | null) {
    if (key !== null) {
      setCustomSlots((prev) => ({
        ...prev,
        [action]: prev[action].map((k, i) => (i === slot ? null : k)),
      }));
      setListening(null);
    } else {
      const waiting = listening?.action === action && listening.slot === slot;
      setListening(waiting ? null : { action, slot });
    }
  }

  function setHandlingValue<K extends keyof Handling>(
    key: K,
    value: Handling[K],
  ) {
    setHandling((prev) => ({ ...prev, [key]: value }));
  }

  function download() {
    const blob = new Blob([JSON.stringify(current(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.ttc';
    link.click();
    URL.revokeObjectURL(url);
  }

  function back() {
    setListening(null);
    onBack();
  }

  const custom = style === 'custom';
  const shown = custom
    ? customSlots
    : copyBinds(style === 'wasd' ? WASD_BINDS : GUIDELINE_BINDS);

  return (
    <div class="fixed inset-0 overflow-y-auto p-10 text-white" hidden={hidden}>
      <div class="mb-4 flex gap-3">
        <button
          class="px-4 py-3 bg-zinc-800 rounded-lg hover:bg-zinc-700"
          onClick={back}
        >
          Back
        </button>
      </div>

      <h1 class="text-3xl font-bold">Config generator</h1>

      {/* the input itself stays hidden, so its "no file chosen" text never shows */}
      <div class="mt-6 flex gap-3">
        <button
          class="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
          onClick={() => fileInput.current?.click()}
        >
          Import config
        </button>
        <button
          class="px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700"
          onClick={download}
        >
          Export config
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".ttc,application/json"
        hidden
        onChange={loadFile}
      />

      <Heading text="Controls" />

      <label class="flex items-center gap-3">
        Style
        <select
          class={INPUT_CLASS}
          value={style}
          onChange={(event) =>
            changeStyle(event.currentTarget.value as Controls['style'])
          }
        >
          {(['guideline', 'wasd', 'custom'] as const).map((option) => (
            <option value={option}>{option}</option>
          ))}
        </select>
      </label>

      <span class="block w-fit mt-4 py-3 px-4 bg-blue-500/5 border border-blue-500 rounded-lg text-[0.9rem] text-zinc-200">
        <b>Hint:</b> Use the "Custom" preset to modify individual keybinds.
      </span>

      <div class="mt-4 grid grid-cols-[10rem_1fr] gap-2">
        {(Object.keys(ACTION_LABELS) as Action[]).map((action) => (
          <Fragment key={action}>
            <span class="text-zinc-400 py-0.5">{ACTION_LABELS[action]}</span>
            <div class="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.max(SLOTS, shown[action].length) },
                (_, slot) => {
                  const key = shown[action][slot] ?? null;
                  const waiting =
                    listening?.action === action && listening.slot === slot;
                  return (
                    <button
                      class={`${SLOT_CLASS} ${key === null && !waiting ? 'text-zinc-500' : ''}`}
                      disabled={!custom}
                      onClick={() => clickSlot(action, slot, key)}
                    >
                      {waiting ? 'press a key…' : (key ?? 'unset')}
                    </button>
                  );
                },
              )}
            </div>
          </Fragment>
        ))}
      </div>

      <Heading text="Handling" />

      <div class="grid grid-cols-[10rem_auto] justify-start gap-x-4 gap-y-2 items-center">
        {SLIDERS.map(({ key, label, min, max, step, format, reversed }) => (
          <Fragment key={key}>
            <span class="text-zinc-400">{label}</span>
            <div class="flex items-center gap-3">
              <input
                class="w-48 accent-zinc-400"
                type="range"
                min={min}
                max={max}
                step={step}
                dir={reversed ? 'rtl' : undefined}
                value={handling[key]}
                onInput={(event) =>
                  setHandlingValue(key, Number(event.currentTarget.value))
                }
              />
              <span class="w-12 tabular-nums">{format(handling[key])}</span>
            </div>
          </Fragment>
        ))}
        {CHECKBOXES.map(({ key, label }) => (
          <Fragment key={key}>
            <span class="text-zinc-400">{label}</span>
            <input
              class="justify-self-start"
              type="checkbox"
              checked={handling[key]}
              onChange={(event) =>
                setHandlingValue(key, event.currentTarget.checked)
              }
            />
          </Fragment>
        ))}
        {INITIAL_ACTION_FIELDS.map(({ key, label }) => (
          <Fragment key={key}>
            <span class="text-zinc-400">{label}</span>
            <select
              class={INPUT_CLASS}
              value={handling[key]}
              onChange={(event) =>
                setHandlingValue(
                  key,
                  event.currentTarget.value as InitialAction,
                )
              }
            >
              {INITIAL_ACTIONS.map((value) => (
                <option value={value}>{value}</option>
              ))}
            </select>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
