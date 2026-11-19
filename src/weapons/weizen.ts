import * as THREE from 'three';
import { SYNERGY_FX, WEIZEN as W, WEIZEN_UPGRADES } from '../config/arsenal';
import { TARGETING, WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import { pickTarget } from './targeting';
import type { Weapon, WeaponContext, WeaponMods, Zone } from './weapon';

/**
 * Weizen (GDD section 6, n° 7) : un nuage de mousse se pose à hauteur de tête sur un zombie et y reste quelques
 * secondes ; chaque zombie dedans prend un coup à chaque battement. Les nuages en plus visent d'autres zombies.
 */
export function createWeizen(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, duration: 1, projectiles: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const zones: Zone[] = [];
  let timer: number = W.firstDelay, tick = 0;
  const around: Zombie[] = [];
  const picked = new Set<Zombie>();
  const still = new THREE.Vector3();
  /** Cumul de poison de chaque zombie (synergie Nuage toxique). */
  const stacks = new Map<Zombie, number>();
  /** Le nuage qui suit le joueur (évolution). */
  const follow: Zone = { pos: new THREE.Vector3(), radius: W.radius, age: 1, life: Infinity, active: false };

  function cloud(at: THREE.Vector3) {
    let z = zones.find((x) => !x.active);
    if (!z) { z = { pos: new THREE.Vector3(), radius: 1, age: 0, life: 1, active: false }; zones.push(z); }
    z.pos.copy(at);
    z.radius = W.radius * mods.size * ctx.stats.size;
    z.life = W.life * mods.duration * ctx.stats.duration;
    z.age = 0;
    z.active = true;
  }

  const weapon: Weapon = {
    id: 'weizen',
    name: WEAPON_INFO.weizen.name,
    upgrades: WEIZEN_UPGRADES,
    mods,
    projectiles: [],
    zones,
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos();
      const n = 1 + ctx.stats.volleyBonus() + mods.projectiles;
      picked.clear();
      let any = false;
      for (let k = 0; k < n; k++) {
        const z = pickTarget(ctx.zombies(), p, W.range, TARGETING.spread, picked);
        if (!z) break;
        picked.add(z);
        cloud(z.pos);
        any = true;
      }
      if (any) timer = W.cooldown / (ctx.stats.fireRate * mods.rate);
    },
    updateProjectiles(dt: number) {
      // Mousse infinie (évolution) : un nuage permanent suit le joueur
      if (mods.evolved) {
        follow.active = true;
        follow.pos.copy(ctx.playerPos());
        follow.radius = W.radius * mods.size * ctx.stats.size;
        if (!zones.includes(follow)) zones.push(follow);
      }
      tick += dt;
      const beat = tick >= W.tick;
      for (const zone of zones) {
        if (!zone.active) continue;
        zone.age += dt;
        if (zone.age >= zone.life) { zone.active = false; continue; }
        if (!beat) continue;
        for (const z of ctx.zombiesNear(zone.pos, zone.radius, around)) {
          if (!z.targetable || z.pos.distanceTo(zone.pos) > zone.radius) continue;
          // Nuage toxique (avec le Vomi) : chaque battement fait plus mal que le précédent
          let k = 1;
          if (ctx.synergy('nuageToxique')) { k = Math.min(SYNERGY_FX.nuage.maxStacks, (stacks.get(z) ?? 0) + 1); stacks.set(z, k); }
          ctx.hitZombie(weapon, z, W.damage * mods.damage * k, false, z.pos, still, 0);
        }
      }
      if (beat) { tick = 0; if (stacks.size > 256) for (const z of stacks.keys()) if (z.dead) stacks.delete(z); }
    },
    reset() {
      stacks.clear();
      timer = W.firstDelay;
      tick = 0;
      for (const z of zones) z.active = false;
      zones.splice(zones.indexOf(follow) >>> 0, zones.includes(follow) ? 1 : 0);
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts par battement', value: W.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / W.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Nuages', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Rayon du nuage', value: W.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Durée du nuage', value: W.life * m.duration, unit: 'seconds', bonus: m.duration - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
