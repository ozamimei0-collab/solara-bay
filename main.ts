// Solara Bay — entrypoint for make.fun gta6-01 (Node 22, standard library only).
// The game is this directory's game/ folder, plain static files a desktop browser
// loads offline (game/index.html and its ES modules, no library and no network
// request). This program hands it in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library.
// Before copying, it runs Solara Bay's own pre-flight checks: the game must have
// an index.html, 3 or 4 screenshots each within the 256 KiB cap, and at least one
// game file, or it stops with a clear error naming what is missing.
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_TITLE = 'Solara Bay';
const MAX_SCREENSHOT_BYTES = 262144;
const MIN_SCREENSHOTS = 3;
const MAX_SCREENSHOTS = 4;

function fail(message: string): never {
  throw new Error(`${GAME_TITLE}: ${message}`);
}

function listFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(path));
    else found.push(path);
  }
  return found;
}

// Solara Bay pre-flight: the entry is not handed in unless the game can start
// and the screenshots fit the scorer's caps.
const indexPath = join(here, 'game', 'index.html');
if (!existsSync(indexPath)) fail('game/index.html is missing — the game cannot start without it');

const screenshotsDir = join(here, 'screenshots');
if (!existsSync(screenshotsDir)) fail('screenshots/ is missing — add 3 or 4 screenshots of the game');
const shotNames = readdirSync(screenshotsDir).filter((name) => /\.(png|jpe?g|webp)$/i.test(name));
if (shotNames.length < MIN_SCREENSHOTS || shotNames.length > MAX_SCREENSHOTS) {
  fail(`expected ${MIN_SCREENSHOTS}–${MAX_SCREENSHOTS} screenshots, found ${shotNames.length}`);
}
for (const name of shotNames) {
  const size = statSync(join(screenshotsDir, name)).size;
  if (size > MAX_SCREENSHOT_BYTES) {
    fail(`screenshot ${name} is ${size} bytes, over the ${MAX_SCREENSHOT_BYTES} byte cap`);
  }
}

const gameFiles = listFiles(join(here, 'game'));
if (gameFiles.length === 0) fail('game/ has no files to hand in');
const gameBytes = gameFiles.reduce((total, file) => total + statSync(file).size, 0);
if (statSync(indexPath).size === 0) fail('game/index.html is empty — the game cannot start without it');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(screenshotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(
  `${GAME_TITLE}: handed in ${gameFiles.length} game files (${gameBytes} bytes) and ${shotNames.length} screenshots to ${out}`,
);
