import * as THREE from 'three';
import { FUT as F, TARGETING, WEAPON_INFO } from '../config/weapons';
import { pickTarget } from './targeting';
import { FUT_UPGRADES } from '../config/upgrades';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/**
 * Un fût en route : direction (du centre de la planète) et cap au sol, axe de roulement (couché en
 * travers de la route), zombies déjà écrasés (une fois chacun).
 */
type Barrel = Projectile & { dir: THREE.Vector3; fwd: THREE.Vector3; axis: THREE.Vector3; hits: Zombie[] };

/**
 * Le Fût qui roule (GDD section 6, n° 12) : un grand tonneau part du Buveur vers le zombie le plus
 * proche et roule tout droit sur le sol, posé sur le relief, en écrasant tous les zombies de sa ligne
 * sans s'arrêter (une fois chacun). Il éclate au bout de sa course, ou contre le décor.
 *
 * Pour l'affichage, le fût est un projectile comme une bouteille : son axe (`up0`) est couché en
 * travers de la route et il tourne autour (`spinAxis`) à la vitesse qui le fait rouler sans glisser.
 */
export function createFut(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, duration: 1, knock: 1, projectiles: 0, critChance: 0, critMult: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Barrel[] = [];
  let timer: number = F.firstDelay;
  const up = new THREE.Vector3(), d = new THREE.Vector3(), vel = new THREE.Vector3(), lead = new THREE.Vector3();


  /** Pose le fût sur le sol : son axe à un rayon au-dessus du sol (ou du dessus du décor). */
  function place(b: Barrel) {
    const r = F.radius * b.size;
    // Sonde au niveau où étaient ses appuis (groundAt attend un point près du sol, pas une direction)
    const feet = b.pos.length() - r;
    b.pos.copy(b.dir).multiplyScalar(feet);
    b.pos.setLength(ctx.groundAt(b.pos) + r);
  }

  /** Lance un fût dans la direction tangente `fwd`, depuis devant le joueur. */
  function launch(fwd: THREE.Vector3) {
    let b = projectiles.find((x) => !x.active);
    if (!b) {
      b = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(),
        spinRate: 0, gravity: 0, age: 0, size: 1, active: false,
        dir: new THREE.Vector3(), fwd: new THREE.Vector3(), axis: new THREE.Vector3(), hits: [],
      };
      projectiles.push(b);
    }
    const p = ctx.playerPos();
    b.size = mods.size;
    b.dir.copy(p).normalize();
    b.fwd.copy(fwd);
    // Départ un peu devant le joueur, sur le grand cercle de la route
    b.axis.crossVectors(b.dir, b.fwd).normalize();
    const start = F.spawnAhead / p.length();
    b.dir.applyAxisAngle(b.axis, start);
    b.fwd.applyAxisAngle(b.axis, start);
    b.pos.copy(b.dir).multiplyScalar(p.length() + F.radius * b.size);
    place(b);
    b.up0.copy(b.axis);
    b.spinAxis.copy(b.axis);
    b.spinRate = F.speed / (2 * Math.PI * F.radius * b.size);
    b.vel.copy(b.fwd).multiplyScalar(F.speed);
    b.age = 0;
    b.hits.length = 0;
    b.active = true;
  }

  /** Écrase les zombies dans l'empreinte du fût couché (sa longueur en travers, son diamètre le long de la route). */
  function crush(b: Barrel) {
    const halfLen = (F.length * b.size) / 2 + F.zombieRadius;
    const halfDepth = F.radius * b.size + F.zombieRadius;
    up.copy(b.dir);
    for (const z of ctx.zombies()) {
      if (!z.targetable || b.hits.includes(z) || z.pos.distanceToSquared(b.pos) > 16 * b.size * b.size) continue;
      d.subVectors(z.pos, b.pos);
      d.addScaledVector(up, -d.dot(up));
      if (Math.abs(d.dot(b.axis)) > halfLen || Math.abs(d.dot(b.fwd)) > halfDepth) continue;
      b.hits.push(z);
      const crit = Math.random() < F.critChance + mods.critChance;
      const dmg = F.damage * mods.damage * (crit ? F.critMult + mods.critMult : 1);
      ctx.hitZombie(weapon, z, dmg, crit, b.pos, vel.copy(b.fwd).multiplyScalar(F.speed), F.knock * mods.knock);
    }
  }

  const weapon: Weapon = {
    id: 'fut',
    name: WEAPON_INFO.fut.name,
    upgrades: FUT_UPGRADES,
    mods,
    projectiles,
    update(dt: number) {
      timer -= dt;
      if (timer > 0) return;
      const target = pickTarget(ctx.zombies(), ctx.playerPos(), F.range, TARGETING.spread);
      if (!target) return;
      timer = F.cooldown / (ctx.stats.fireRate * mods.rate);
      ctx.rig.gesture(1);
      // Cap vers la cible, dans le plan du sol ; les fûts en plus partent en éventail autour
      up.copy(ctx.playerPos()).normalize();
      const aim = d.subVectors(target.pos, ctx.playerPos());
      aim.addScaledVector(up, -aim.dot(up)).normalize();
      const n = 1 + ctx.stats.extraProjectiles + mods.projectiles;
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * F.spread;
        launch(lead.copy(aim).applyAxisAngle(up, a));
      }
    },
    updateProjectiles(dt: number) {
      for (const b of projectiles) {
        if (!b.active) continue;
        b.age += dt;
        // Avance sur le grand cercle de sa route, puis se repose sur le sol
        const step = (F.speed * dt) / b.pos.length();
        b.dir.applyAxisAngle(b.axis, step);
        b.fwd.applyAxisAngle(b.axis, step);
        place(b);
        b.vel.copy(b.fwd).multiplyScalar(F.speed);
        crush(b);
        // Contre le décor, ou au bout de sa course : il éclate
        lead.copy(b.pos).addScaledVector(b.fwd, F.radius * b.size);
        if (ctx.blocked(lead, 0) || b.age > F.life * mods.duration) {
          b.active = false;
          ctx.hitGround(weapon, b.pos, b.vel);
        }
      }
    },
    reset() {
      timer = F.firstDelay;
      for (const b of projectiles) b.active = false;
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Dégâts', value: F.damage * m.damage, unit: 'number', bonus: m.damage - 1, bonusKind: 'percent' },
        { label: "Vitesse d'attaque", value: s.attackSpeed * m.rate / F.cooldown, unit: 'perSecond', bonus: m.rate - 1, bonusKind: 'percent' },
        { label: 'Fûts', value: 1 + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Distance', value: F.speed * F.life * m.duration, unit: 'meters', bonus: m.duration - 1, bonusKind: 'percent' },
        { label: 'Taille', value: m.size, unit: 'percent', bonus: m.size - 1, bonusKind: 'percent' },
        { label: 'Recul', value: F.knock * m.knock, unit: 'mult', bonus: m.knock - 1, bonusKind: 'percent' },
        { label: 'Chances de critique', value: F.critChance + m.critChance, unit: 'percent', bonus: m.critChance, bonusKind: 'percent' },
        { label: 'Multiplicateur critique', value: F.critMult + m.critMult, unit: 'mult', bonus: m.critMult, bonusKind: 'plus' },
      ];
    },
  };
  return weapon;
}
