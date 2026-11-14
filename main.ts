// Token Radar's entrypoint (Node 22, standard library only).
//
// Reads the sealed snapshot, scores every pre-token protocol with the model in
// lib/model.ts, and writes the ranked board, the dashboard data, the dashboard
// itself, the screenshots and the judge's dossier into the output directory.
//
// Run it locally against the kit's snapshot:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
// The grader mounts the sealed snapshot at /input and the output at /output.

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, boardIssue, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

// The gate's own caps, as the scorer states them: the text cap shapes the
// dossier's bytes, the rest refuse an entry outright.
const TEXT_MAX_BYTES = 65_536;
const SHOT_LIMIT = 4;
const SHOT_MAX_BYTES = 524_288;
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
// PNG and JPEG magic bytes, checked before a screenshot is copied.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** The value of `--name <value>`, `--name=<value>`, or the fallback. */
function option(name: string, fallback: string): string {
  const argv = process.argv;
  const at = argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < argv.length) return argv[at + 1]!;
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = option('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`);
}
const out = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping dot-names, and report them. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyDir(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyDir(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
if (shots.length > SHOT_LIMIT) fail(`screenshots/ holds ${shots.length} images: the gate takes at most ${SHOT_LIMIT}`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  const buf = readFileSync(join(here, 'screenshots', name));
  const isImage = buf.subarray(0, 8).equals(PNG_MAGIC) || buf.subarray(0, 3).equals(JPEG_MAGIC);
  if (!isImage) fail(`screenshots/${name}: not a whole PNG or JPEG`);
  if (buf.length > SHOT_MAX_BYTES) fail(`screenshots/${name}: ${buf.length} bytes, past the ${SHOT_MAX_BYTES} cap`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: { max: SHOT_LIMIT, max_bytes: SHOT_MAX_BYTES }, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const top = board.slice(0, 3).map((r) => `#${r.rank} ${r.slug}`).join(', ');
process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
  `token radar: top of the board: ${top}\n` +
  `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
