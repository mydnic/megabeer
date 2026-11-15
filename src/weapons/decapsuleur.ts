import * as THREE from 'three';
import { DECAPSULEUR as D, DECAPSULEUR_UPGRADES } from '../config/arsenal';
import { TARGETING, WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import { anyInRange, pickTarget } from './targeting';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Un décapsuleur en vol : de retour vers le joueur ou non, zombies frappés dans la phase en cours. */
type Opener = Projectile & { back: boolean; hits: Zombie[] };

/**
 * Décapsuleur (GDD section 6, n° 14) : un boomerang. Lancé vers un zombie, il file en tournant à plat, ralenti par
 * un rappel constant vers le joueur, puis revient se faire rattraper. Il frappe chaque zombie traversé une fois à
 * l'aller et une fois au retour. Les décapsuleurs en plus partent en éventail autour de la cible.
 */
export function createDecapsuleur(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, speed: 1, projectiles: 0, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Opener[] = [];
  let timer: number = D.firstDelay;
  const up = new THREE.Vector3(), dir = new THREE.Vector3(), toward = new THREE.Vector3(), tmp = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const around: Zombie[] = [];

  function launch(from: THREE.Vector3, heading: THREE.Vector3) {
    let o = projectiles.find((x) => !x.active);
    if (!o) {
      o = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false, back: false, hits: [] };
      projectiles.push(o);
    }
    o.pos.copy(from);
    o.vel.copy(heading).multiplyScalar(D.speed * mods.speed);
    up.copy(from).normalize();
    o.up0.copy(heading); // couché à plat, il tourne autour de la verticale
    o.spinAxis.copy(up);
    o.spinRate = D.spinRate;
    o.age = 0;
    o.size = mods.size;
    o.back = false;
    o.hits.length = 0;
    o.active = true;
  }

  function strike(o: Opener) {
    for (const z of ctx.zombiesNear(o.pos, D.hitRadius + D.zombieRadius + 1, around)) {
      if (!z.targetable || o.hits.includes(z)) continue;
      // Distance au corps du zombie, dans le plan du sol
      tmp.subVectors(z.pos, o.pos);
      tmp.addScaledVector(up, -tmp.dot(up));
      if (tmp.length() > D.hitRadius * mods.size + D.zombieRadius) continue;
      o.hits.push(z);
      const crit = Math.random() < D.critChance + mods.critChance + ctx.stats.critChance;
      const dmg = D.damage * mods.damage * (crit ? D.critMult + mods.critMult : 1);
      ctx.hitZombie(weapon, z, dmg, crit, o.pos, o.vel, D.knock);
    }
  }

  const weapon: Weapon = {
    id: 'decapsuleur',
    name: WEAPON_INFO.decapsuleur.name,
    upgrades: DECAPSULEUR_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const p = ctx.playerPos();
      if (!anyInRange(ctx.zombies(), p, D.range)) return;
      const target = pickTarget(ctx.zombies(), p, D.range, TARGETING.spread);
      if (!target) return;
      timer = D.cooldown / (ctx.stats.fireRate * mods.rate);
      ctx.rig.gesture(1.4);
      ctx.rig.handPos(hand);
      up.copy(p).normalize();
      dir.subVectors(target.pos, p);
      dir.addScaledVector(up, -dir.dot(up)).normalize();
      const n = 1 + ctx.stats.volleyBonus() + mods.projectiles;
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * D.spread;
        launch(hand, tmp.copy(dir).applyAxisAngle(up, a));
      }
    },
    updateProjectiles(dt: number) {
      const p = ctx.playerPos();
      for (const o of projectiles) {
        if (!o.active) continue;
        o.age += dt;
        up.copy(o.pos).normalize();
        // Rappel vers le joueur, dans le plan du sol
        toward.subVectors(p, o.pos);
        toward.addScaledVector(up, -toward.dot(up));
        const dist = toward.length();
        toward.divideScalar(dist || 1);
        o.vel.addScaledVector(toward, D.pull * mods.speed * dt);
        o.vel.addScaledVector(up, -o.vel.dot(up));
        // Demi-tour : il revient vers le joueur, chaque zombie peut reprendre un coup
        if (!o.back && o.vel.dot(toward) > 0) { o.back = true; o.hits.length = 0; }
        o.pos.addScaledVector(o.vel, dt);
        // Vole à hauteur constante au-dessus du sol
        o.pos.setLength(ctx.groundAt(o.pos) + D.height);
        strike(o);
        if ((o.back && dist < D.catchDist) || o.age > D.life) o.active = false;
      }
    },
    reset() {
      timer = D.firstDelay;
      for (const o of projectiles) o.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: D.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / D.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Décapsuleurs', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Portée du lancer', value: (D.speed * D.speed) / (2 * D.pull) * m.speed, unit: 'meters', bonus: m.speed - 1, bonusKind: 'percent' },
        { label: 'Taille', value: m.size, unit: 'percent', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: D.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: D.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
