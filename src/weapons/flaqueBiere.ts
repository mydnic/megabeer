import * as THREE from 'three';
import { FLAQUE_BIERE as F, FLAQUE_BIERE_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Weapon, WeaponContext, WeaponMods, Zone } from './weapon';

/**
 * Flaque de bière (GDD section 6, n° 13) : le joueur laisse une traînée de flaques derrière lui quand il se déplace.
 * Un zombie qui pose le pied dans une flaque glisse et tombe : étourdi (il ne bouge ni ne frappe) et quelques dégâts.
 * Il ne peut pas reglisser tout de suite, pour qu'on ne le bloque pas indéfiniment. Se joue en dessinant des chemins.
 */
export function createFlaqueBiere(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, duration: 1, stun: 1 };
  const mods: WeaponMods = { ...MODS0 };
  const zones: Zone[] = [];
  /** Zombies qui ont glissé, et quand (temps de l'arme, s). */
  const slipped = new Map<Zombie, number>();
  const last = new THREE.Vector3();
  let travelled = 0, clock = 0, started = false;
  const around: Zombie[] = [];
  const dir = new THREE.Vector3(), vel = new THREE.Vector3();

  function drop(at: THREE.Vector3) {
    let z = zones.find((x) => !x.active);
    if (!z) { z = { pos: new THREE.Vector3(), radius: 1, age: 0, life: 1, active: false }; zones.push(z); }
    z.pos.copy(at);
    z.radius = F.radius * mods.size * ctx.stats.size;
    z.life = F.life * mods.duration * ctx.stats.duration * ctx.stats.zoneDuration;
    z.age = 0;
    z.active = true;
  }

  const weapon: Weapon = {
    id: 'flaqueBiere',
    name: WEAPON_INFO.flaqueBiere.name,
    upgrades: FLAQUE_BIERE_UPGRADES,
    mods,
    projectiles: [],
    zones,
    update() {
      // Une flaque tous les quelques mètres parcourus
      const p = ctx.playerPos();
      if (!started) { last.copy(p); started = true; drop(p); return; }
      travelled += p.distanceTo(last);
      last.copy(p);
      if (travelled < F.dropEvery / (ctx.stats.fireRate * mods.rate)) return;
      travelled = 0;
      drop(p);
    },
    updateProjectiles(dt: number) {
      clock += dt;
      for (const zone of zones) {
        if (!zone.active) continue;
        zone.age += dt;
        if (zone.age >= zone.life) { zone.active = false; continue; }
        for (const z of ctx.zombiesNear(zone.pos, zone.radius + F.zombieRadius, around)) {
          if (!z.targetable || z.frozen > 0) continue;
          if (z.pos.distanceTo(zone.pos) > zone.radius + F.zombieRadius) continue;
          const t = slipped.get(z);
          if (t !== undefined && clock - t < F.slipCooldown) continue;
          slipped.set(z, clock);
          // Il glisse : étourdi, et il continue un peu sur sa lancée
          z.frozen = Math.max(z.frozen, F.stun * mods.stun * ctx.stats.duration);
          dir.copy(z.facing);
          vel.copy(dir).multiplyScalar(2);
          ctx.hitZombie(weapon, z, F.damage * mods.damage, false, z.pos, vel, 0.3);
        }
      }
      if (slipped.size > 128) for (const [z, t] of slipped) if (clock - t > F.slipCooldown || z.dead) slipped.delete(z);
    },
    reset() {
      for (const z of zones) z.active = false;
      slipped.clear();
      travelled = 0;
      clock = 0;
      started = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: F.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: 'Une flaque tous les', value: F.dropEvery / (s.attackSpeed * m.rate), unit: 'meters', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Rayon des flaques', value: F.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Durée des flaques', value: F.life * m.duration, unit: 'seconds', bonus: m.duration - 1, bonusKind: 'percent' },
        { label: 'Étourdissement', value: F.stun * m.stun, unit: 'seconds', bonus: m.stun - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
