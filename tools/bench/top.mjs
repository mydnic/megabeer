// Résume un profil CPU de Node : temps propre par fonction (les plus coûteuses d'abord).
import { readdirSync, readFileSync } from 'node:fs';
const dir = 'tools/bench/out';
const file = readdirSync(dir).filter((f) => f.endsWith('.cpuprofile')).sort().pop();
const p = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
const self = new Map();
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const dt = p.timeDeltas; let total = 0;
p.samples.forEach((id, i) => {
  const n = byId.get(id), f = n.callFrame;
  const key = `${f.functionName || '(anonyme)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + dt[i]); total += dt[i];
});
const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, Number(process.argv[2] ?? 30));
for (const [k, v] of rows) console.log(`${(v / total * 100).toFixed(1).padStart(5)} %  ${k}`);
