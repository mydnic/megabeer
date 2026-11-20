import { ITEMS, type ItemId } from '../config/items';
import { ALLIES, type AllyId } from '../config/allies';
import { GRAVE_BOSSES } from '../config/bosses';
import { SAIYAN } from '../config/saiyan';
import { VEHICLES, type VehicleId } from '../config/vehicles';
import * as THREE from 'three';
import { DIFFICULTIES, type DifficultyId } from '../config/spawn';
import { WEAPON_FACTORIES } from '../weapons/registry';
import type { WeaponId } from '../weapons/weapon';
import { ENEMIES, type EnemyId } from '../config/enemies';
import type { createMusic } from '../audio/music';
import type { createRunLog } from './runLog';
import type { Game } from '../game/game';
import { TOURNEE_IDS } from '../game/tournees';
import type { TourneeId } from '../config/tournees';
import { CLOSING } from '../config/closing';
import { DOOM_MOUNTAIN } from '../config/doom';
import { PLANET_RADIUS } from '../config/world';

/**
 * Panneau DEV (yarn dev seulement, importé dynamiquement : absent du build). Toutes ses actions
 * passent par le noyau et sont notées dans le journal de run (run "trichée").
 */
export async function wireDevTools(game: Game, d: {
  music: ReturnType<typeof createMusic>;
  runLog: ReturnType<typeof createRunLog>;
  seed: () => number;
  addTunas: (n: number) => void;
  setDifficulty: (d: DifficultyId) => void;
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
    setDifficulty(id) { game.difficulty = id as DifficultyId; d.setDifficulty(id as DifficultyId); },
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
    items: Object.keys(ITEMS),
    giveItem(id) { if (inRun()) { game.gainItem(id as ItemId); runLog.event('dev', 'item', id); } },
    heal() { if (inRun()) { game.health.reset(); runLog.event('dev', 'heal'); } },
    giveCoins(n) { if (inRun()) { game.coins += n; runLog.event('dev', 'coins', n); } },
    giveTunas(n) { d.addTunas(n); runLog.event('dev', 'tunas', n); },
    placeBin() {
      if (!inRun()) return;
      const p = game.player;
      game.bins.add(p.pos.clone().addScaledVector(p.facing, 4));
      runLog.event('dev', 'bin');
    },
    tournees: TOURNEE_IDS,
    dropTournee(id) {
      if (!inRun()) return;
      const p = game.player;
      game.tournees.drops.drop(p.pos.clone().addScaledVector(p.facing, 7), TOURNEE_IDS.indexOf(id as TourneeId));
      runLog.event('dev', 'tournee', id);
    },
    spawnElite(model) {
      if (!inRun()) return;
      const p = game.player;
      const id = (model === 'mix' ? models[Math.floor(Math.random() * models.length)] : model) as EnemyId;
      const at = p.pos.clone().addScaledVector(p.facing, 9);
      game.spawnElite(id, at, p.pos.clone().sub(at))?.emerge();
      runLog.event('dev', 'elite', id);
    },
    spawnBoss() { if (inRun() && game.spawnBoss()) runLog.event('dev', 'boss'); },
    spawnAbbe() {
      if (!inRun()) return;
      const p = game.player;
      const at = p.pos.clone().addScaledVector(p.facing, 14);
      if (game.spawnAbbe(at, p.pos.clone().sub(at))) runLog.event('dev', 'abbe');
    },
    closingNow() {
      if (!inRun()) return;
      game.runTime = Math.max(game.runTime, CLOSING.at);
      runLog.event('dev', 'closing');
    },
    goToDoom() {
      if (!inRun()) return;
      // Au pied de la montagne, face au cratère
      const c = game.doom.dir;
      const side = new THREE.Vector3().crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const at = c.clone().applyAxisAngle(side, (DOOM_MOUNTAIN.baseRadius + 6) / PLANET_RADIUS);
      const facing = c.clone().sub(at.clone().multiplyScalar(c.dot(at))).normalize();
      game.player.reset(at, facing);
      runLog.event('dev', 'doom');
    },
    goToDoor() {
      const d = game.door;
      if (!inRun() || !d.pos) return;
      game.player.reset(d.pos.clone().addScaledVector(d.facing, 6).normalize(), d.facing.clone().negate());
      runLog.event('dev', 'door');
    },
    vehicles: Object.keys(VEHICLES),
    placeVehicle(id) {
      if (!inRun() || game.vehicles.driving) return;
      if (game.vehicles.spawnNear(game.player.pos, id as VehicleId, 5, 7)) runLog.event('dev', 'vehicle', id);
    },
    allies: Object.keys(ALLIES),
    placeAlly(id) {
      if (!inRun()) return;
      const p = game.player, up = p.pos.clone().normalize();
      game.allies.list.splice(0, game.allies.list.length, ...game.allies.list.filter((a) => a.kind !== id));
      game.allies.placeAt(id as AllyId, up.multiplyScalar(p.pos.length()).addScaledVector(p.facing, 4));
      runLog.event('dev', 'ally', id);
    },
    graveBosses: GRAVE_BOSSES.kinds,
    placeGraveBoss(kind) {
      const k = kind as (typeof GRAVE_BOSSES.kinds)[number];
      if (!inRun() || game.bossUp(k)) return;
      const p = game.player, up = p.pos.clone().normalize();
      const b = game.graveBosses.placeAt(k, up.multiplyScalar(p.pos.length()).addScaledVector(p.facing, 7));
      b.facing.copy(p.facing).negate();
      runLog.event('dev', 'graveBoss', k);
    },
    placeRadio() {
      if (!inRun()) return;
      const p = game.player, up = p.pos.clone().normalize(), right = new THREE.Vector3().crossVectors(p.facing, up).normalize();
      for (const d of [2, 3, 4, 5]) if (game.radio.placeAt(up.clone().multiplyScalar(p.pos.length()).addScaledVector(p.facing, d).addScaledVector(right, 1))) { runLog.event('dev', 'radio'); return; }
    },
    fillSaiyan(tier) {
      if (!inRun() || game.saiyan.active) return;
      if (!game.saiyan.enabled) game.gainItem('sangSaiyan');
      game.saiyan.points = SAIYAN.thresholds[Math.max(1, Math.min(6, tier)) - 1];
      runLog.event('dev', 'saiyan', tier);
    },
    dropBell() {
      if (!inRun()) return;
      const p = game.player;
      game.bellDrops.drop(p.pos.clone().addScaledVector(p.facing, 7), 1);
      runLog.event('dev', 'bell');
    },
    placeTrap() {
      if (!inRun()) return;
      // Un coffre du Bonnet, rendu payant et piégé
      const c = game.chests.addFree(game.player.pos, game.player.facing, 5);
      if (!c) return;
      c.free = false;
      c.trapped = true;
      runLog.event('dev', 'trap');
    },
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
