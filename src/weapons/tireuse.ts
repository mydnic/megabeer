import * as THREE from 'three';
import { SYNERGY_FX, TIREUSE as T, TIREUSE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import { createSpray } from './spray';
import type { Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Tireuse (GDD section 6, n° 15) : un jet continu de bière en cône vers le zombie le plus proche à portée. À chaque
 * battement, chaque zombie dans le cône prend un petit coup et recule un peu. Le jet se voit (gouttes en traînée).
 */
export function createTireuse(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, knock: 1, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const spray = createSpray();
  let tick = 0;
  const up = new THREE.Vector3(), dir = new THREE.Vector3(), d = new THREE.Vector3(), vel = new THREE.Vector3();
  const around: Zombie[] = [];
  /** Zombies qui brûlent (synergie Jet brûlant) : dégâts par seconde, temps restant. */
  const burning = new Map<Zombie, { dps: number; left: number }>();
  let burnTick = 0;
  const still = new THREE.Vector3();

  const range = () => T.range * mods.size;

  /** Direction du zombie le plus proche à portée (dans le plan du sol), ou faux s'il n'y en a pas. */
  function aim(p: THREE.Vector3) {
    let best = Infinity;
    for (const z of ctx.zombiesNear(p, range(), around)) {
      if (!z.targetable) continue;
      const dist = z.pos.distanceTo(p);
      if (dist < best) { best = dist; dir.subVectors(z.pos, p); }
    }
    if (best === Infinity) return false;
    dir.addScaledVector(up, -dir.dot(up)).normalize();
    return true;
  }

  const weapon: Weapon = {
    id: 'tireuse',
    name: WEAPON_INFO.tireuse.name,
    upgrades: TIREUSE_UPGRADES,
    mods,
    projectiles: spray.drops,
    update(dt: number) {
      tick += dt;
      const every = T.tick / (ctx.stats.fireRate * mods.rate);
      if (tick < every) return;
      tick = 0;
      const p = ctx.playerPos();
      up.copy(p).normalize();
      if (!aim(p)) return;
      spray.emit(p, dir, T.drops, T.halfAngle * 0.8, T.dropSpeed * mods.size, T.dropLife);
      const cos = Math.cos(T.halfAngle), r = range();
      for (const z of ctx.zombiesNear(p, r, around)) {
        if (!z.targetable) continue;
        d.subVectors(z.pos, p);
        d.addScaledVector(up, -d.dot(up));
        const dist = d.length();
        if (dist > r || (dist > 0.5 && d.divideScalar(dist).dot(dir) < cos)) continue;
        const crit = Math.random() < T.critChance + mods.critChance + ctx.stats.critChance;
        vel.copy(dir).multiplyScalar(5);
        ctx.hitZombie(weapon, z, T.damage * mods.damage * (crit ? T.critMult + mods.critMult : 1), crit, z.pos, vel, T.knock * mods.knock);
        // Jet brûlant (avec l'IPA) : le zombie arrosé brûle
        if (ctx.synergy('jetBrulant')) burning.set(z, { dps: T.damage * mods.damage * SYNERGY_FX.jetBrulant.dps, left: SYNERGY_FX.jetBrulant.time });
      }
    },
    updateProjectiles(dt: number) {
      spray.update(dt);
      burnTick += dt;
      if (burnTick < 0.5 || !burning.size) return;
      for (const [z, f] of burning) {
        f.left -= burnTick;
        if (z.dead || f.left <= 0) { burning.delete(z); continue; }
        ctx.hitZombie(weapon, z, f.dps * burnTick, false, z.pos, still, 0);
      }
      burnTick = 0;
    },
    reset() {
      burning.clear();
      tick = 0;
      spray.reset();
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts par giclée', value: T.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: 'Giclées par seconde', value: s.attackSpeed * m.rate / T.tick, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Portée du jet', value: T.range * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Recul', value: T.knock * m.knock, unit: 'mult', bonus: m.knock - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: T.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
