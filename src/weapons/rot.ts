import * as THREE from 'three';
import { ROT as RT, ROT_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Rot sonique (GDD section 6, n° 22) : une onde circulaire autour du joueur, qui se charge avec l'XP ramassée depuis
 * le dernier rot. Plus le joueur fonce dans les capsules, plus le prochain rot fait mal et porte loin. Il part dès
 * que le délai est passé et qu'un zombie est à portée.
 */
export function createRot(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, charge: 1 };
  const mods: WeaponMods = { ...MODS0 };
  let timer: number = RT.firstDelay;
  /** XP ramassée au moment du dernier rot. */
  let lastXp = 0;
  const d = new THREE.Vector3(), up = new THREE.Vector3();
  const around: Zombie[] = [];

  const charge = () => Math.max(0, ctx.xpGathered() - lastXp) * mods.charge;
  const damage = () => Math.min(RT.maxDamage, RT.damage + RT.perXp * charge()) * mods.damage;
  const radius = () => Math.min(RT.maxRadius, RT.radius + RT.radiusPerXp * charge()) * mods.size;

  const weapon: Weapon = {
    id: 'rot',
    name: WEAPON_INFO.rot.name,
    upgrades: ROT_UPGRADES,
    mods,
    projectiles: [],
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos(), r = radius();
      const hit = ctx.zombiesNear(p, r, around).filter((z) => z.targetable && z.pos.distanceTo(p) <= r);
      if (!hit.length) return;
      timer = RT.cooldown / (ctx.stats.fireRate * mods.rate);
      const dmg = damage();
      ctx.explode(weapon, p, r);
      up.copy(p).normalize();
      for (const z of hit) {
        d.subVectors(z.pos, p).addScaledVector(up, -d.subVectors(z.pos, p).dot(up)).normalize().multiplyScalar(6);
        ctx.hitZombie(weapon, z, dmg, false, z.pos, d, RT.knock);
      }
      lastXp = ctx.xpGathered();
    },
    updateProjectiles() { /* pas de projectile */ },
    reset() {
      timer = RT.firstDelay;
      lastXp = 0;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts du prochain rot', value: damage(), unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: 'Rayon du prochain rot', value: radius(), unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / RT.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Charge par capsule', value: RT.perXp * m.charge, unit: 'number', bonus: m.charge - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
