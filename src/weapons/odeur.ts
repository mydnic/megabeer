import * as THREE from 'three';
import { SYNERGY_FX, ODEUR as O, ODEUR_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Weapon, WeaponContext, WeaponMods, Zone } from './weapon';

/**
 * Odeur d'alcool (GDD section 6, n° 24) : une aura permanente autour du joueur. Chaque zombie dedans prend des dégâts
 * faibles à chaque battement et devient confus : il titube de travers, plus lentement. Aucun recul.
 */
export function createOdeur(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, size: 1, confuse: 1, rate: 1 };
  const mods: WeaponMods = { ...MODS0 };
  // L'aura : une seule zone, toujours là, qui suit le joueur
  const aura: Zone = { pos: new THREE.Vector3(), radius: O.radius, age: 1, life: Infinity, active: false };
  const zones = [aura];
  let tick = 0;
  const around: Zombie[] = [];
  const still = new THREE.Vector3();

  const weapon: Weapon = {
    id: 'odeur',
    name: WEAPON_INFO.odeur.name,
    upgrades: ODEUR_UPGRADES,
    mods,
    projectiles: [],
    zones,
    update() { /* l'aura vit dans updateProjectiles */ },
    updateProjectiles(dt: number) {
      aura.active = true;
      aura.pos.copy(ctx.playerPos());
      aura.radius = O.radius * mods.size * ctx.stats.size;
      tick += dt;
      if (tick < O.tick / (ctx.stats.fireRate * mods.rate)) return;
      tick = 0;
      for (const z of ctx.zombiesNear(aura.pos, aura.radius, around)) {
        if (!z.targetable || z.pos.distanceTo(aura.pos) > aura.radius) continue;
        z.confused = Math.max(z.confused, O.confuse * mods.confuse * ctx.stats.duration);
        // Haleine de feu (avec l'IPA) : l'aura brûle
        ctx.hitZombie(weapon, z, O.damage * mods.damage * (ctx.synergy('haleineFeu') ? SYNERGY_FX.haleine.damage : 1), false, z.pos, still, 0);
      }
    },
    reset() {
      tick = 0;
      aura.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts par battement', value: O.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: 'Battements par seconde', value: s.attackSpeed * m.rate / O.tick, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: "Rayon de l'aura", value: O.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Confusion', value: O.confuse * m.confuse, unit: 'seconds', bonus: m.confuse - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
