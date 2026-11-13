import * as THREE from 'three';
import { TABOURET as T, WEAPON_INFO } from '../config/weapons';
import { TABOURET_UPGRADES } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Un tabouret pendant son tour : son décalage sur le cercle (rad) et les zombies déjà frappés ce tour-ci. */
type Stool = Projectile & { offset: number; hits: Zombie[] };

/**
 * Le Tabouret de bar (GDD section 6, n° 18), arme du Videur : mêlée circulaire. Dès qu'un zombie est à portée,
 * le tabouret fait un tour complet autour du joueur en `T.swingTime` s ; chaque zombie qu'il traverse est frappé
 * une fois par tour, avec un gros recul. Les tabourets en plus se répartissent sur le cercle (chacun frappe).
 *
 * Pour l'affichage, chaque tabouret est un projectile : posé sur le cercle, penché vers l'extérieur (`up0`), il
 * tourne autour de la verticale du joueur (`spinAxis`) au rythme du tour, pour toujours présenter la même face.
 */
export function createTabouret(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, knock: 1, projectiles: 0, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Stool[] = [];
  let timer: number = T.firstDelay;
  /** Tour en cours : temps écoulé (s), -1 si aucun ; repère du tour (verticale, rayon de départ, côté). */
  let swing = -1;
  const up = new THREE.Vector3(), radial0 = new THREE.Vector3(), side0 = new THREE.Vector3();
  const d = new THREE.Vector3(), vel = new THREE.Vector3(), tmp = new THREE.Vector3();
  const around: Zombie[] = [];

  /** Rayon du coup (m) : la Taille l'allonge. */
  const reach = () => T.radius * mods.size;
  /** Angle de chaque tabouret sur le cercle au temps `t` du tour (rad). */
  const angleAt = (t: number, offset: number) => offset + (Math.min(t, T.swingTime) / T.swingTime) * Math.PI * 2;

  function stool(i: number): Stool {
    let s = projectiles[i];
    if (!s) {
      s = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(),
        spinRate: 0, gravity: 0, age: 0, size: 1, active: false, offset: 0, hits: [],
      };
      projectiles[i] = s;
    }
    return s;
  }

  /** Place chaque tabouret actif sur le cercle autour du joueur (position et orientation pour l'affichage). */
  function place() {
    const p = ctx.playerPos();
    up.copy(p).normalize();
    for (const s of projectiles) {
      if (!s.active) continue;
      const a = angleAt(swing, s.offset);
      d.copy(radial0).multiplyScalar(Math.cos(a)).addScaledVector(side0, Math.sin(a));
      s.pos.copy(p).addScaledVector(d, reach() * T.holdAt).addScaledVector(up, T.height);
      s.vel.crossVectors(up, d).multiplyScalar((Math.PI * 2 * reach()) / T.swingTime);
    }
  }

  function startSwing() {
    const p = ctx.playerPos();
    up.copy(p).normalize();
    // Repère du tour : un rayon quelconque dans le plan du sol (le tour est complet, le départ ne compte pas)
    radial0.set(1, 0, 0).addScaledVector(up, -up.x);
    if (radial0.lengthSq() < 1e-6) radial0.set(0, 1, 0).addScaledVector(up, -up.y);
    radial0.normalize();
    side0.crossVectors(up, radial0).normalize();
    const n = 1 + ctx.stats.volleyBonus() + mods.projectiles;
    for (let i = 0; i < projectiles.length; i++) projectiles[i].active = false;
    for (let k = 0; k < n; k++) {
      const s = stool(k);
      s.offset = (k / n) * Math.PI * 2;
      s.hits.length = 0;
      s.age = 0;
      s.size = mods.size;
      s.active = true;
      // Penché vers l'extérieur, au départ de son tour ; il tournera ensuite avec le tour
      d.copy(radial0).multiplyScalar(Math.cos(s.offset)).addScaledVector(side0, Math.sin(s.offset));
      s.up0.copy(up).multiplyScalar(Math.cos(T.tilt)).addScaledVector(d, Math.sin(T.tilt)).normalize();
      s.spinAxis.copy(up);
      s.spinRate = 1 / T.swingTime;
    }
    swing = 0;
    ctx.rig.gesture(T.gestureRate);
  }

  /** Frappe les zombies que chaque tabouret a traversés entre deux images (une fois chacun par tour). */
  function sweep(prev: number, now: number) {
    const p = ctx.playerPos();
    const r = reach() + T.zombieRadius;
    for (const z of ctx.zombiesNear(p, r, around)) {
      if (!z.targetable) continue;
      d.subVectors(z.pos, p);
      d.addScaledVector(up, -d.dot(up));
      const dist = d.length();
      if (dist > r) continue;
      // Angle du zombie dans le repère du tour, ramené entre 0 et 2 pi
      let phi = Math.atan2(d.dot(side0), d.dot(radial0));
      if (phi < 0) phi += Math.PI * 2;
      for (const s of projectiles) {
        if (!s.active || s.hits.includes(z)) continue;
        const a0 = angleAt(prev, s.offset), a1 = angleAt(now, s.offset);
        // Le zombie est-il dans l'arc balayé (modulo un tour) ? Un zombie collé au joueur est pris tout de suite
        let x = phi - a0;
        x -= Math.floor(x / (Math.PI * 2)) * Math.PI * 2;
        if (x > a1 - a0 && dist > T.innerRadius) continue;
        s.hits.push(z);
        const crit = Math.random() < T.critChance + mods.critChance + ctx.stats.critChance;
        const dmg = T.damage * mods.damage * (crit ? T.critMult + mods.critMult : 1);
        // Recul vers l'extérieur du cercle
        vel.copy(d).normalize().multiplyScalar(T.knockSpeed);
        ctx.hitZombie(weapon, z, dmg, crit, tmp.copy(z.pos).addScaledVector(up, T.height), vel, T.knock * mods.knock);
      }
    }
  }

  const weapon: Weapon = {
    id: 'tabouret',
    name: WEAPON_INFO.tabouret.name,
    upgrades: TABOURET_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      if (swing >= 0) return;
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos();
      const r = reach() + T.zombieRadius + T.triggerMargin;
      if (!ctx.zombiesNear(p, r, around).some((z) => z.targetable && z.pos.distanceTo(p) < r)) return;
      timer = T.cooldown / (ctx.stats.fireRate * mods.rate);
      startSwing();
      place();
    },
    updateProjectiles(dt: number) {
      if (swing < 0) return;
      const prev = swing;
      swing += dt;
      for (const s of projectiles) if (s.active) s.age = swing;
      place();
      sweep(prev, swing);
      if (swing >= T.swingTime) {
        swing = -1;
        for (const s of projectiles) s.active = false;
      }
    },
    reset() {
      timer = T.firstDelay;
      swing = -1;
      for (const s of projectiles) s.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: T.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / T.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Tabourets', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Portée du coup', value: T.radius * m.size, unit: 'meters', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Recul', value: T.knock * m.knock, unit: 'mult', bonus: m.knock - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: T.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: T.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
