import * as THREE from 'three';
import { CORNE as C, CORNE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import { createSpray } from './spray';
import type { Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Corne de brume (GDD section 6, n° 20) : un coup de corne dans la direction où court le joueur, quand un zombie est
 * dans le cône. Presque pas de dégâts mais un très gros recul : elle ouvre un couloir dans la horde pour fuir.
 */
export function createCorne(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, knock: 1 };
  const mods: WeaponMods = { ...MODS0 };
  const spray = createSpray();
  let timer: number = C.firstDelay;
  const up = new THREE.Vector3(), dir = new THREE.Vector3(), d = new THREE.Vector3(), vel = new THREE.Vector3();
  const around: Zombie[] = [];
  const range = () => C.range * mods.size;

  const weapon: Weapon = {
    id: 'corne',
    name: WEAPON_INFO.corne.name,
    upgrades: CORNE_UPGRADES,
    mods,
    projectiles: spray.drops,
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos();
      up.copy(p).normalize();
      dir.copy(ctx.playerFacing()).addScaledVector(up, -ctx.playerFacing().dot(up)).normalize();
      const cos = Math.cos(C.halfAngle), r = range();
      const inCone: Zombie[] = [];
      for (const z of ctx.zombiesNear(p, r, around)) {
        if (!z.targetable) continue;
        d.subVectors(z.pos, p);
        d.addScaledVector(up, -d.dot(up));
        const dist = d.length();
        if (dist > r || (dist > 0.5 && d.divideScalar(dist).dot(dir) < cos)) continue;
        inCone.push(z);
      }
      if (!inCone.length) return;
      timer = C.cooldown / (ctx.stats.fireRate * mods.rate);
      spray.emit(p, dir, C.drops, C.halfAngle, C.dropSpeed * mods.size, C.dropLife, 0.6);
      ctx.explode(weapon, p.clone().addScaledVector(dir, r * 0.35), r * 0.45);
      for (const z of inCone) {
        // Repoussé droit devant le joueur, loin
        vel.subVectors(z.pos, p).addScaledVector(up, -vel.subVectors(z.pos, p).dot(up)).normalize().multiplyScalar(C.knockSpeed);
        ctx.hitZombie(weapon, z, C.damage * mods.damage, false, z.pos, vel, C.knock * mods.knock);
      }
    },
    updateProjectiles(dt: number) { spray.update(dt); },
    reset() {
      timer = C.firstDelay;
      spray.reset();
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / C.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Portée', value: C.range * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Recul', value: C.knock * m.knock, unit: 'mult', bonus: m.knock - 1, bonusKind: 'percent' },
        { label: 'Dégâts', value: C.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
