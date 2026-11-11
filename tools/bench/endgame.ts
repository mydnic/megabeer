/**
 * Banc de mesure du noyau en fin de partie : 4 armes très améliorées, plein de projectiles, une horde
 * dense tout autour du joueur. Mesure le temps de `game.step` par image (sans rendu ni navigateur).
 *
 *   node tools/bench/run.mjs            temps moyen et pire image
 *   node tools/bench/run.mjs --prof     en plus, un profil CPU (.cpuprofile) dans tools/bench/out/
 */
import * as THREE from 'three';
import { ROSTERS, type EnemyId } from '../../src/config/enemies';
import { NO_INPUT } from '../../src/game/game';
import { createTestGame } from '../../tests/support/testGame';

const ZOMBIES = Number(process.env.BENCH_ZOMBIES ?? 800);
const FRAMES = Number(process.env.BENCH_FRAMES ?? 600);

const t = createTestGame(7, { coins: 'real' });
t.startRunAndLand();
const g = t.game;
g.cheats.god = true;
// Fin de partie : toutes les armes, cadence et projectiles au plafond, quelques objets qui pèsent
for (const id of ['stout', 'fut', 'gueuze'] as const) g.loadout.add(id);
for (const w of g.loadout.weapons) Object.assign(w.mods, { level: 30, damage: 6, rate: 3, projectiles: 6, pierce: 3, range: 1.6, size: 1.5 });
g.stats.attackSpeed = 2.5;
g.stats.extraProjectiles = 4;
for (const id of ['cendrier', 'glacons', 'seauAGlace', 'echarpe', 'sifflet', 'jukeBox'] as const) g.gainItem(id, 4);
g.runTime = 14 * 60;

const roster = (ROSTERS.abbaye as readonly { enemy: EnemyId }[]).map((r) => r.enemy);
const ring = () => {
  const p = g.player, up = p.pos.clone().normalize();
  const side = new THREE.Vector3().crossVectors(up, p.facing).normalize();
  const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 34;
  return p.pos.clone().addScaledVector(p.facing, Math.cos(a) * d).addScaledVector(side, Math.sin(a) * d).normalize();
};
const alive = () => g.horde.zombies.reduce((n, z) => n + (z.dead ? 0 : 1), 0);
const refill = () => { for (let n = alive(); n < ZOMBIES; n++) g.spawnZombie(roster[n % roster.length], ring(), g.player.facing.clone().negate()); };

refill();
// Mise en route (JIT, premières volées)
for (let i = 0; i < 120; i++) { g.step(1 / 60, { ...NO_INPUT, moveY: 1 }); if (g.offer) g.pickCard(g.offer[0]); refill(); }

let total = 0, worst = 0, projectiles = 0;
const times: number[] = [];
for (let i = 0; i < FRAMES; i++) {
  refill();
  const t0 = performance.now();
  g.step(1 / 60, { ...NO_INPUT, moveY: 1 });
  const ms = performance.now() - t0;
  if (g.offer) g.pickCard(g.offer[0]);
  total += ms; worst = Math.max(worst, ms); times.push(ms);
  projectiles += g.loadout.weapons.reduce((n, w) => n + w.projectiles.filter((b) => b.active).length, 0);
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({
  zombies: ZOMBIES, frames: FRAMES,
  avgMs: +(total / FRAMES).toFixed(3), p95Ms: +times[Math.floor(FRAMES * 0.95)].toFixed(3), worstMs: +worst.toFixed(3),
  avgProjectiles: Math.round(projectiles / FRAMES), kills: g.kills, xpDrops: g.xp.drops.length,
}));
