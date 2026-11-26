import {
  BAG_TYPES,
  BGMS,
  DEFAULT_ROOM_CONFIG,
  KICKSETS,
  SPIN_BONUSES,
  type RoomConfig,
} from '../room-config';

/** Every editable setting, labelled as in room-config.md, grouped into sections. */
const SECTIONS: { title: string; fields: [path: string, label: string][] }[] = [
  {
    title: 'Room',
    fields: [
      ['meta.name', 'room name'],
      ['meta.userlimit', 'player limit'],
      ['meta.allowAnonymous', 'allow anonymous users to join'],
      ['meta.bgm', 'music'],
      ['meta.match.ft', 'first to (FT)'],
      ['meta.match.wb', 'win by (WB)'],
    ],
  },
  {
    title: 'Game',
    fields: [
      ['game.options.stock', 'stock'],
      ['game.options.boardwidth', 'board width'],
      ['game.options.boardheight', 'board height'],
      ['game.options.bagtype', 'random bag type'],
      ['game.options.spinbonuses', 'allowed spins'],
      ['game.options.allow180', 'allow 180 spins'],
      ['game.options.kickset', 'kick table'],
      ['game.options.allow_harddrop', 'use hard drop'],
      ['game.options.display_next', 'use NEXT queue'],
      ['game.options.display_hold', 'use HOLD queue'],
      ['game.options.nextcount', 'next pieces'],
      ['game.options.display_shadow', 'show shadow piece'],
      ['game.options.are', 'ARE'],
      ['game.options.lineclear_are', 'line clear ARE'],
    ],
  },
  {
    title: 'Handling',
    fields: [
      ['game.options.room_handling', 'enforce below handling settings'],
      ['game.options.room_handling_arr', 'enforced ARR'],
      ['game.options.room_handling_das', 'enforced DAS'],
      ['game.options.room_handling_sdf', 'enforced SDF'],
    ],
  },
  {
    title: 'Gravity',
    fields: [
      ['game.options.g', 'gravity'],
      ['game.options.gincrease', 'gravity increase'],
      ['game.options.gmargin', 'gravity margin time'],
      ['game.options.locktime', 'lock delay'],
    ],
  },
  {
    title: 'Garbage',
    fields: [
      ['game.options.garbagemultiplier', 'garbage multiplier'],
      ['game.options.garbagemargin', 'garbage margin time'],
      ['game.options.garbageincrease', 'garbage increase'],
      ['game.options.garbagespeed', 'garbage travel speed'],
      ['game.options.garbagecap', 'garbage cap'],
      ['game.options.garbagecapincrease', 'garbage cap increase'],
      ['game.options.garbagecapmax', 'garbage cap max'],
      ['game.options.manual_allowed', 'allow manual targeting'],
      ['game.options.b2bchaining', 'enable back-to-back charging (surge)'],
      ['game.options.clutch', 'enable clutch clears'],
      ['game.options.passthrough', 'enable passthrough'],
    ],
  },
];

const ENUM_OPTIONS: Record<string, readonly string[]> = {
  'meta.bgm': BGMS,
  'game.options.bagtype': BAG_TYPES,
  'game.options.spinbonuses': SPIN_BONUSES,
  'game.options.kickset': KICKSETS,
};

const INPUT_CLASS = 'w-40 px-2 py-1 bg-zinc-900 rounded disabled:opacity-60';

function get(config: RoomConfig, path: string): unknown {
  return path.split('.').reduce<any>((obj, key) => obj[key], config);
}

function withValue(config: RoomConfig, path: string, value: unknown): RoomConfig {
  const copy = structuredClone(config);
  const keys = path.split('.');
  const last = keys.pop()!;
  keys.reduce<any>((obj, key) => obj[key], copy)[last] = value;
  return copy;
}

interface RoomConfigEditorProps {
  config: RoomConfig;
  /** Only the host can edit; everyone else sees the config read only. */
  editable: boolean;
  onChange: (config: RoomConfig) => void;
}

export function RoomConfigEditor({ config, editable, onChange }: RoomConfigEditorProps) {
  function field(path: string) {
    const value = get(config, path);
    const set = (next: unknown) => onChange(withValue(config, path, next));
    const options = ENUM_OPTIONS[path];

    if (options) {
      return (
        <select
          class={INPUT_CLASS}
          value={value as string}
          disabled={!editable}
          onChange={(e) => set(e.currentTarget.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    // the default's type says what kind of input to use
    switch (typeof get(DEFAULT_ROOM_CONFIG, path)) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            class="size-4"
            checked={value as boolean}
            disabled={!editable}
            onChange={(e) => set(e.currentTarget.checked)}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            class={INPUT_CLASS}
            min={0}
            step="any"
            value={value as number}
            disabled={!editable}
            onChange={(e) => {
              const next = e.currentTarget.valueAsNumber;
              if (Number.isFinite(next) && next >= 0) set(next);
              else e.currentTarget.value = String(value);
            }}
          />
        );
      default:
        return (
          <input
            class={INPUT_CLASS}
            value={value as string}
            disabled={!editable}
            onChange={(e) => set(e.currentTarget.value)}
          />
        );
    }
  }

  return (
    <div class="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <section key={section.title}>
          <h3 class="mb-2 text-sm font-bold tracking-widest text-zinc-400 uppercase">
            {section.title}
          </h3>
          <div class="max-w-md border-t border-zinc-800">
            {section.fields.map(([path, label]) => (
              <label
                key={path}
                class="flex items-center justify-between gap-4 py-1.5 border-b border-zinc-800"
              >
                <span>{label}</span>
                {field(path)}
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
