import * as THREE from 'three';
import { DIFFICULTIES, type DifficultyId } from '../config/spawn';
import { WEAPON_FACTORIES } from '../weapons/registry';
import type { WeaponId } from '../weapons/weapon';
import { ENEMIES, type EnemyId } from '../config/enemies';
import type { createMusic } from '../audio/music';
import type { createRunLog } from '../dev/runLog';
import type { Game } from '../game/game';

/**
 * Panneau DEV (yarn dev seulement, importé dynamiquement : absent du build). Toutes ses actions
 * passent par le noyau et sont notées dans le journal de run (run "trichée").
 */
export async function wireDevTools(game: Game, d: {
  music: ReturnType<typeof createMusic>;
  runLog: ReturnType<typeof createRunLog>;
  seed: () => number;
}) {
  const { createDevPanel } = await import('../dev/devPanel');
  const { music, runLog } = d;
  const models = Object.keys(ENEMIES) as EnemyId[];
  const inRun = () => game.phase === 'run';
  createDevPanel({
    models,
    cheats: game.cheats,
    spawn(model, n, rMin, rMax) {
      if (!inRun()) return;
      const p = game.player;
      const up = p.pos.clone().normalize();
      const a = new THREE.Vector3().crossVectors(up, p.facing).normalize(), b = p.facing.clone();
      for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
        const at = p.pos.clone().addScaledVector(a, Math.cos(t) * r).addScaledVector(b, Math.sin(t) * r);
        game.spawnZombie(model === 'mix' ? models[i % models.length] : model as EnemyId, at, p.pos.clone().sub(at));
      }
      runLog.event('dev', 'spawn', model, n);
    },
    killAll(withXp) {
      if (!inRun()) return;
      for (const z of [...game.horde.zombies]) {
        if (z.dead) continue;
        const push = z.pos.clone().sub(game.player.pos);
        game.hitZombie(z, z.hp + 1, false, z.pos, push);
      }
      if (!withXp) game.xp.clear();
      runLog.event('dev', 'killAll');
    },
    clearZombies() { if (inRun()) { game.horde.clear(); runLog.event('dev', 'clear'); } },
    setAutoSpawn(v) { game.director.enabled = v; runLog.event('dev', 'autoSpawn', v ? 1 : 0); },
    skipTime(s) { if (inRun()) { game.runTime += s; runLog.event('dev', 'skipTime', s); } },
    triggerMapEvent() { if (inRun()) { game.mechanic.trigger(); runLog.event('dev', 'mapEvent'); } },
    difficulties: (Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => ({ id, label: DIFFICULTIES[id].label })),
    setDifficulty(id) { game.difficulty = id as DifficultyId; },
    setPassive(v) { if (inRun()) { game.horde.setPassive(v); runLog.event('dev', 'passive', v ? 1 : 0); } },
    giveXp(xp) { if (inRun()) { game.addXp(xp); runLog.event('dev', 'xp', xp); } },
    levelUp() {
      if (!inRun()) return;
      const p = game.progression;
      game.addXp(Math.max(1, p.next - p.xp));
      runLog.event('dev', 'level');
    },
    weapons: Object.keys(WEAPON_FACTORIES),
    giveWeapon(id) { if (inRun() && game.equip(id as WeaponId)) runLog.event('dev', 'weapon', id); },
    heal() { if (inRun()) { game.health.reset(); runLog.event('dev', 'heal'); } },
    die() {
      if (!inRun()) return;
      game.health.invuln = 0;
      game.health.damage(game.health.hp);
      runLog.event('dev', 'die');
    },
    toggleCombatMusic() {
      if (music.boss) music.endBoss();
      else if (inRun()) music.startBoss('test');
      return music.boss ? 'boss' : 'run';
    },
    inRun,
    setTimeScale(k) { game.devTimeScale = k; },
    status() {
      let alive = 0;
      for (const z of game.horde.zombies) if (!z.dead) alive++;
      return `${game.phase} | seed ${d.seed()} | ${alive} zombies (+${game.director.rate.toFixed(1)}/s) | ${DIFFICULTIES[game.difficulty].label} | niv ${game.progression.level} | ${Math.round(game.health.hp)} PV${game.cheats.god ? ' | GOD' : ''}`;
    },
  });
}
