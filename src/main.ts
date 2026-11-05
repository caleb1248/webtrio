import "./style.css";
await import("./canvas");
import { formatTime } from "./canvas";
import { mountConfigGenerator } from "./configGenerator";
import { createGame, type Game } from "./gp/game";
import type { GameStats } from "./gp/gameState";
import { MODES, type Mode } from "./modes";
import { DEFAULT_ROOM_CONFIG } from "./room-config";

const menu = document.querySelector<HTMLDivElement>("#menu")!;
const app = document.querySelector<HTMLDivElement>("#app")!;
const configInput = document.querySelector<HTMLInputElement>("#config-file")!;
const modeList = document.querySelector<HTMLUListElement>("#modes")!;
const endScreen = document.querySelector<HTMLDivElement>("#end")!;
const endMode = document.querySelector<HTMLHeadingElement>("#end-mode")!;
const endTime = document.querySelector<HTMLParagraphElement>("#end-time")!;
const endStats = document.querySelector<HTMLDListElement>("#end-stats")!;
const playAgainButton = document.querySelector<HTMLButtonElement>("#play-again")!;
const toMenuButton = document.querySelector<HTMLButtonElement>("#to-menu")!;
const generator = document.querySelector<HTMLDivElement>("#generator")!;
const openGeneratorButton =
  document.querySelector<HTMLButtonElement>("#open-generator")!;

let game: Game | null = null;

function showMenu() {
  game?.stop();
  game = null;
  endScreen.hidden = true;
  app.hidden = true;
  menu.hidden = false;
}

function showEnd(mode: Mode, stats: GameStats) {
  const seconds = stats.time / 1000;
  const entries: [string, string][] = [
    ["Lines", String(stats.lines)],
    ["Pieces", String(stats.pieces)],
    ["PPS", (seconds > 0 ? stats.pieces / seconds : 0).toFixed(2)],
  ];

  endMode.textContent = mode.name;
  endTime.textContent = formatTime(stats.time);
  endStats.replaceChildren(
    ...entries.flatMap(([label, value]) => {
      const term = document.createElement("dt");
      term.className = "text-zinc-400";
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.className = "text-right font-bold tabular-nums";
      detail.textContent = value;
      return [term, detail];
    }),
  );

  endScreen.hidden = false;
}

function playAgain() {
  endScreen.hidden = true;
  game?.restart();
  game?.start();
}

playAgainButton.addEventListener("click", playAgain);
toMenuButton.addEventListener("click", showMenu);

// the buttons aren't focused, since the space bar that hard dropped the last
// piece would otherwise click play again as it is released
window.addEventListener("keydown", (event) => {
  if (endScreen.hidden || event.repeat) return;
  if (event.key === "Enter") playAgain();
  if (event.key === "Escape") showMenu();
});

async function play(mode: Mode) {
  const file = configInput.files?.[0];
  if (!file) {
    alert("config file required");
    return;
  }

  // no file falls back to createGame's default config
  const config = file ? JSON.parse(await file.text()) : undefined;

  menu.hidden = true;
  app.hidden = false;
  game = createGame(DEFAULT_ROOM_CONFIG, config, mode, {
    onExit: showMenu,
    onFinish: (stats) => showEnd(mode, stats),
  });
  game.start();
}

for (const mode of MODES) {
  const button = document.createElement("button");
  button.textContent = mode.name;
  button.className =
    "w-full px-4 py-3 text-left text-lg font-bold bg-zinc-800 rounded-lg hover:bg-zinc-700";
  button.addEventListener("click", () => play(mode));

  const item = document.createElement("li");
  item.append(button);
  modeList.append(item);
}

mountConfigGenerator(generator, () => {
  generator.hidden = true;
  menu.hidden = false;
});

openGeneratorButton.addEventListener("click", () => {
  menu.hidden = true;
  generator.hidden = false;
});
