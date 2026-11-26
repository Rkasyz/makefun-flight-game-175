// main.ts — Sky Courier's hand-in program (Node 22, standard library only).
// It copies the static game (game/) and its screenshots (screenshots/) from
// beside this file into the output directory, then writes dossier.json there
// with the vendored make.fun library. The grader runs it inside its own
// container with MAKEFUN_OUTPUT_DIR set to /output; outside the container the
// same variable stands in for /output, so a local check looks like:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this file lives in is the entry; the output folder comes from
// the environment and defaults to /output, the grader's folder.
const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyGameFiles() {
  const gameDir = join(entryDir, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing — the entry is not complete');
  }
  mkdirSync(outputDir, { recursive: true });
  // Clear the previous run's output first, so a file deleted from the entry
  // can never linger in the dossier as a stale copy.
  rmSync(join(outputDir, 'game'), { recursive: true, force: true });
  rmSync(join(outputDir, 'screenshots'), { recursive: true, force: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(entryDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
}

function writeDossier() {
  // The scorer's caps, from the kit's reference/gate.json: text_max_bytes is
  // the only one that shapes bytes; the rest refuse an entry the scorer
  // itself would refuse — more than 4 screenshots or one over 256 KiB, more
  // than 993 files in game/ or 48 MiB of game files in all, or a path under
  // game/ longer than 1000 bytes.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

copyGameFiles();
writeDossier();
