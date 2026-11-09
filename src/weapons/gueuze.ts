import * as THREE from 'three';
import { GUEUZE as G, WEAPON_INFO } from '../config/weapons';
import { GUEUZE_UPGRADES } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Une gueuze : en vol, puis posée au sol (vitesse nulle) le temps de son retard. */
type Grenade = Projectile & { fuse: number; landed: boolean };

/**
 * La Gueuze (GDD section 6, n° 8) : une grenade à retardement. Lancée en cloche sur le plus gros
 * groupe de zombies à portée. Si elle touche un zombie en vol, elle explose à l'impact ; sinon elle se pose au
 * sol et tourne sur elle-même en
 * moussant le temps de son retard, puis explose : dégâts et recul à tous les zombies dans le rayon.
 * Elle ne blesse jamais le joueur.
 */
export function createGueuze(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, radius: 1, projectiles: 0, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Grenade[] = [];
  let timer: number = G.firstDelay;
  const up = new THREE.Vector3(), hand = new THREE.Vector3(), dlt = new THREE.Vector3(), vel = new THREE.Vector3(), push = new THREE.Vector3();

  /**
   * Centres des groupes, du plus gros au plus petit : pour chaque zombie à portée, ses voisins dans
   * le rayon d'explosion ; le centre visé est la moyenne du groupe (les zombies les plus proches
   * d'abord, pour départager et limiter le calcul).
   */
  function groups(n: number) {
    const from = ctx.playerPos();
    const radius = G.radius * mods.radius;
    const near = ctx.zombies().filter((z) => z.targetable && z.pos.distanceTo(from) < G.range)
      .sort((a, b) => a.pos.distanceToSquared(from) - b.pos.distanceToSquared(from)).slice(0, G.candidates);
    const scored = near.map((z) => {
      const members = near.filter((o) => o.pos.distanceTo(z.pos) < radius);
      const center = new THREE.Vector3();
      for (const m of members) center.add(m.pos);
      return { center: center.divideScalar(members.length), count: members.length, members };
    }).sort((a, b) => b.count - a.count);
    // Groupes différents pour les gueuzes en plus : pas deux fois le même zombie au centre
    const out: THREE.Vector3[] = [];
    const used = new Set<Zombie>();
    for (const g of scored) {
      if (out.length >= n) break;
      if (g.members.some((m) => used.has(m))) continue;
      g.members.forEach((m) => used.add(m));
      out.push(g.center);
    }
    return out;
  }

  /** Lance une gueuze de la main vers un point au sol, en cloche. */
  function launch(to: THREE.Vector3) {
    let b = projectiles.find((x) => !x.active);
    if (!b) {
      b = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(),
        spinRate: 0, gravity: 0, age: 0, size: 1, active: false, fuse: 0, landed: false,
      };
      projectiles.push(b);
    }
    ctx.rig.handPos(hand);
    up.copy(hand).normalize();
    dlt.subVectors(to, hand);
    const h = dlt.dot(up);
    dlt.addScaledVector(up, -h);
    const t = Math.max(0.15, dlt.length() / G.speed);
    b.pos.copy(hand);
    b.vel.copy(dlt).divideScalar(t).addScaledVector(up, h / t + 0.5 * G.gravity * t);
    b.gravity = G.gravity;
    b.spinRate = G.spinRate;
    b.up0.copy(up);
    b.spinAxis.crossVectors(b.vel, up).normalize();
    if (b.spinAxis.lengthSq() < 1e-6) b.spinAxis.set(1, 0, 0);
    b.age = 0;
    b.size = 1;
    b.fuse = 0;
    b.landed = false;
    b.active = true;
  }

  /** La bouteille est-elle dans le corps d'un zombie (cylindre debout sur ses pieds) ? */
  function touchesZombie(p: THREE.Vector3) {
    for (const z of ctx.zombies()) {
      if (!z.targetable || z.pos.distanceToSquared(p) > 9) continue;
      dlt.subVectors(p, z.pos);
      up.copy(z.pos).normalize();
      const h = dlt.dot(up);
      if (h < 0 || h > G.zombieHeight) continue;
      dlt.addScaledVector(up, -h);
      if (dlt.length() < G.zombieRadius + G.hitRadius) return true;
    }
    return false;
  }

  /** Explosion : dégâts et recul (vers l'extérieur) à tous les zombies dans le rayon. */
  function explode(b: Grenade) {
    const radius = G.radius * mods.radius;
    ctx.explode(weapon, b.pos, radius);
    for (const z of ctx.zombies()) {
      if (!z.targetable || z.pos.distanceTo(b.pos) > radius) continue;
      const crit = Math.random() < G.critChance + mods.critChance;
      const dmg = G.damage * mods.damage * (crit ? G.critMult + mods.critMult : 1);
      push.subVectors(z.pos, b.pos);
      ctx.hitZombie(weapon, z, dmg, crit, z.pos, vel.copy(push).setLength(1), G.knock);
    }
  }

  const weapon: Weapon = {
    id: 'gueuze',
    name: WEAPON_INFO.gueuze.name,
    upgrades: GUEUZE_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const n = 1 + ctx.stats.extraProjectiles + mods.projectiles;
      const targets = groups(n);
      if (!targets.length) return;
      timer = G.cooldown / (ctx.stats.attackSpeed * mods.rate);
      ctx.rig.gesture(1);
      // Visée à hauteur de poitrine : sur un zombie, elle entre dans son corps au lieu de frôler ses pieds
      for (const to of targets) launch(to.addScaledVector(up.copy(to).normalize(), G.aimHeight));
    },
    updateProjectiles(dt: number) {
      for (const b of projectiles) {
        if (!b.active) continue;
        b.age += dt;
        if (!b.landed) {
          // En vol : elle passe au-dessus des zombies et se pose au sol
          up.copy(b.pos).normalize();
          b.vel.addScaledVector(up, -b.gravity * dt);
          b.pos.addScaledVector(b.vel, dt);
          // Elle touche un zombie en vol : explosion à l'impact, sans retard
          if (touchesZombie(b.pos)) { b.active = false; explode(b); continue; }
          const g = ctx.groundAt(b.pos);
          if (b.pos.length() <= g + G.restHeight) {
            b.pos.setLength(g + G.restHeight);
            b.landed = true;
            // Couchée au sol dans le sens où elle arrivait, elle tourne sur elle-même en moussant
            up.copy(b.pos).normalize();
            b.up0.copy(b.vel).addScaledVector(up, -b.vel.dot(up));
            if (b.up0.lengthSq() < 1e-6) b.up0.set(1, 0, 0).addScaledVector(up, -up.x);
            b.up0.normalize();
            b.spinAxis.copy(up);
            b.spinRate = G.fizzSpin;
            b.vel.set(0, 0, 0);
            b.age = 0;
          }
          if (b.age > G.life) b.active = false;
          continue;
        }
        b.fuse += dt;
        if (b.fuse >= G.fuse) { b.active = false; explode(b); }
      }
    },
    reset() {
      timer = G.firstDelay;
      for (const b of projectiles) b.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: G.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / G.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Gueuzes', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: "Rayon d'explosion", value: G.radius * m.radius, unit: 'meters', bonus: m.radius - 1, bonusKind: 'percent' },
        { label: 'Portée', value: G.range, unit: 'meters', bonus: 0, bonusKind: 'percent' },
        { label: 'Retard', value: G.fuse, unit: 'number', bonus: 0, bonusKind: 'percent' },
        { label: 'Chances de critique', value: G.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: G.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
