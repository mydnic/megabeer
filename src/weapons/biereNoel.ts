import * as THREE from 'three';
import { BIERE_NOEL as B, BIERE_NOEL_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Une bouteille en orbite : les zombies frappés récemment, et quand (temps de l'arme, s). */
type Orbiter = Projectile & { hit: Map<Zombie, number> };

/**
 * Bière de Noël (GDD section 6, n° 9) : des bouteilles tournent en permanence autour du joueur, à hauteur de
 * torse, et frappent chaque zombie qu'elles traversent (un même zombie au plus une fois toutes les `B.rehit` s par
 * bouteille). Les bouteilles en plus se répartissent sur le cercle ; la Taille élargit l'orbite.
 */
export function createBiereNoel(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, projectiles: 0, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Orbiter[] = [];
  let angle = 0, clock = 0;
  const up = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), d = new THREE.Vector3();
  const tmp = new THREE.Vector3(), vel = new THREE.Vector3();
  const around: Zombie[] = [];

  const radius = () => B.radius * mods.size;
  const count = () => B.count + mods.projectiles + ctx.stats.extraProjectiles;

  function orbiter(i: number): Orbiter {
    let o = projectiles[i];
    if (!o) {
      o = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false, hit: new Map() };
      projectiles[i] = o;
    }
    return o;
  }

  /** Repère du plan du sol sous le joueur (stable d'une image à l'autre). */
  function frame() {
    up.copy(ctx.playerPos()).normalize();
    e1.set(1, 0, 0).addScaledVector(up, -up.x);
    if (e1.lengthSq() < 1e-4) e1.set(0, 0, 1).addScaledVector(up, -up.z);
    e1.normalize();
    e2.crossVectors(up, e1);
  }

  const weapon: Weapon = {
    id: 'biereNoel',
    name: WEAPON_INFO.biereNoel.name,
    upgrades: BIERE_NOEL_UPGRADES,
    mods,
    projectiles,
    update() { /* l'orbite tourne dans updateProjectiles, même quand le joueur ne peut pas agir */ },
    updateProjectiles(dt: number) {
      clock += dt;
      const n = count();
      const turn = Math.PI * 2 * B.turnsPerSecond * ctx.stats.fireRate * mods.rate;
      angle = (angle + turn * dt) % (Math.PI * 2);
      frame();
      const p = ctx.playerPos(), r = radius();
      for (let i = 0; i < Math.max(n, projectiles.length); i++) {
        const o = orbiter(i);
        o.active = i < n;
        if (!o.active) continue;
        const a = angle + (i / n) * Math.PI * 2;
        d.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
        o.pos.copy(p).addScaledVector(d, r).addScaledVector(up, B.height);
        o.vel.crossVectors(up, d).multiplyScalar(turn * r);
        // Couchée dans le sens de la course, elle tourne sur elle-même
        o.up0.copy(o.vel).normalize();
        o.spinAxis.copy(d);
        o.spinRate = 2;
        o.age = clock;
        o.size = mods.size;
        // Coups : zombies traversés par la bouteille
        for (const z of ctx.zombiesNear(o.pos, B.hitRadius + B.zombieRadius + 1, around)) {
          if (!z.targetable) continue;
          tmp.subVectors(z.pos, o.pos);
          tmp.addScaledVector(up, -tmp.dot(up));
          if (tmp.length() > B.hitRadius * mods.size + B.zombieRadius) continue;
          const last = o.hit.get(z);
          if (last !== undefined && clock - last < B.rehit) continue;
          o.hit.set(z, clock);
          const crit = Math.random() < B.critChance + mods.critChance + ctx.stats.critChance;
          const dmg = B.damage * mods.damage * (crit ? B.critMult + mods.critMult : 1);
          vel.copy(d).multiplyScalar(6);
          ctx.hitZombie(weapon, z, dmg, crit, o.pos, vel, B.knock);
        }
        // Oublie les vieux coups (pas de fuite de mémoire sur une longue run)
        if (o.hit.size > 64) for (const [z, t] of o.hit) if (clock - t > B.rehit || z.dead) o.hit.delete(z);
      }
    },
    reset() {
      angle = 0;
      clock = 0;
      for (const o of projectiles) { o.active = false; o.hit.clear(); }
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: B.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: 'Tours par seconde', value: B.turnsPerSecond * s.attackSpeed * m.rate, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Bouteilles', value: B.count + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: "Rayon de l'orbite", value: B.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: B.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: B.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
