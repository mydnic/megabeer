// Compile le banc de mesure (tools/bench/endgame.ts) avec esbuild, puis le lance dans Node.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';

mkdirSync('tools/bench/out', { recursive: true });
await build({
  entryPoints: ['tools/bench/endgame.ts'], bundle: true, platform: 'node', format: 'esm',
  outfile: 'tools/bench/out/endgame.mjs', logLevel: 'error',
});
const prof = process.argv.includes('--prof') ? ['--cpu-prof', '--cpu-prof-dir=tools/bench/out'] : [];
const r = spawnSync(process.execPath, [...prof, 'tools/bench/out/endgame.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
