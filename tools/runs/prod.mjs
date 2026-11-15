// Journaux des parties jouées en prod (table run_logs de la base D1, envoyés par le jeu à la fin de chaque run).
//
//   node tools/runs/prod.mjs              les 30 dernières parties (joueur, perso, difficulté, durée, kills, fin, armes)
//   node tools/runs/prod.mjs --last 100   les 100 dernières
//   node tools/runs/prod.mjs --stats      par arme : parties où elle finit équipée, durée et kills moyens ; fins de partie
//   node tools/runs/prod.mjs --dump 42    le journal complet de la partie 42 dans logs/prod/42.json
//
// Il faut l'accès Cloudflare en variables d'environnement : CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN (droits D1).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] ?? true : null; };

function query(sql) {
  const out = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'megabeer', '--remote', '--json', '--command', sql], {
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

const time = (s) => (s == null ? '?' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);
const date = (ms) => new Date(ms).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

// Champs lus dans le JSON du journal, sans rapatrier les instantanés
const FIELDS = `r.id, r.at, r.duration, r.kills, r.end_reason, u.name,
  json_extract(r.data, '$.meta.character') AS character, json_extract(r.data, '$.meta.difficulty') AS difficulty,
  json_extract(r.data, '$.meta.touch') AS touch, json_extract(r.data, '$.meta.level') AS level,
  json_extract(r.data, '$.meta.loadout') AS loadout, json_extract(r.data, '$.meta.items') AS items`;

const dump = opt('--dump');
if (dump) {
  const [row] = query(`SELECT data FROM run_logs WHERE id = ${Number(dump)}`);
  if (!row) { console.error('Partie introuvable :', dump); process.exit(1); }
  mkdirSync('logs/prod', { recursive: true });
  writeFileSync(`logs/prod/${Number(dump)}.json`, row.data);
  console.log(`logs/prod/${Number(dump)}.json`);
} else if (args.includes('--stats')) {
  const rows = query(`SELECT ${FIELDS} FROM run_logs r LEFT JOIN users u ON u.id = r.user_id`);
  console.log(`${rows.length} parties`);
  const byWeapon = {};
  const ends = {};
  for (const r of rows) {
    ends[r.end_reason] = (ends[r.end_reason] ?? 0) + 1;
    for (const w of JSON.parse(r.loadout ?? '[]')) {
      const id = w.split(':')[0];
      const b = (byWeapon[id] ??= { n: 0, time: 0, kills: 0, evolved: 0 });
      b.n++; b.time += r.duration ?? 0; b.kills += r.kills ?? 0; if (w.endsWith(':evolue')) b.evolved++;
    }
  }
  console.log('\nArme             parties  durée moy.  kills moy.  évoluée');
  for (const [id, b] of Object.entries(byWeapon).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${pad(id, 16)} ${String(b.n).padStart(7)}  ${time(b.time / b.n).padStart(10)}  ${String(Math.round(b.kills / b.n)).padStart(10)}  ${String(b.evolved).padStart(7)}`);
  }
  console.log('\nFins de partie :', Object.entries(ends).map(([k, v]) => `${k} ${v}`).join(', '));
} else {
  const n = Number(opt('--last') ?? 30);
  const rows = query(`SELECT ${FIELDS} FROM run_logs r LEFT JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT ${n}`);
  console.log('id    date         joueur        perso    diff.     durée  kills  niv  fin           armes');
  for (const r of rows) {
    const weapons = JSON.parse(r.loadout ?? '[]').join(' ');
    console.log(`${pad(r.id, 5)} ${pad(date(r.at), 12)} ${pad(r.name ?? 'invité', 13)} ${pad(r.character, 8)} ${pad(r.difficulty, 9)} ${pad(time(r.duration), 6)} ${pad(r.kills, 6)} ${pad(r.level, 4)} ${pad(r.end_reason, 13)} ${weapons}${r.touch ? '  (tél.)' : ''}`);
  }
}
