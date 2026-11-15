import * as THREE from 'three';
import { PLATEAU as P, PLATEAU_UPGRADES } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { StatLine } from '../game/playerStats';
import type { Zombie } from '../enemies/zombie';
import type { Projectile, Weapon, WeaponContext, WeaponMods } from './weapon';

/** Un plateau : temps restant avant d'être de nouveau prêt à bloquer (0 : prêt). */
type Tray = Projectile & { recharge: number };

/**
 * Plateau de serveur (GDD section 6, n° 16) : des plateaux tournent lentement autour du joueur. Chacun bloque un coup
 * (zombie au contact, bouteille, piège) puis disparaît le temps de se recharger. Pure défense : il ne frappe pas.
 */
export function createPlateau(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, rate: 1, projectiles: 0 };
  const mods: WeaponMods = { ...MODS0 };
  const projectiles: Tray[] = [];
  let angle = 0, clock = 0;
  const up = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), d = new THREE.Vector3();
  const around: Zombie[] = [];

  const count = () => P.count + mods.projectiles + ctx.stats.extraProjectiles;
  function tray(i: number): Tray {
    let t = projectiles[i];
    if (!t) {
      t = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), up0: new THREE.Vector3(), spinAxis: new THREE.Vector3(), spinRate: 0, gravity: 0, age: 0, size: 1, active: false, recharge: 0 };
      projectiles[i] = t;
    }
    return t;
  }

  const weapon: Weapon = {
    id: 'plateau',
    name: WEAPON_INFO.plateau.name,
    upgrades: PLATEAU_UPGRADES,
    mods,
    projectiles,
    update() { /* les plateaux tournent dans updateProjectiles */ },
    updateProjectiles(dt: number) {
      clock += dt;
      angle = (angle + Math.PI * 2 * P.turnsPerSecond * dt) % (Math.PI * 2);
      const p = ctx.playerPos(), n = count();
      up.copy(p).normalize();
      e1.set(1, 0, 0).addScaledVector(up, -up.x);
      if (e1.lengthSq() < 1e-4) e1.set(0, 0, 1).addScaledVector(up, -up.z);
      e1.normalize();
      e2.crossVectors(up, e1);
      for (let i = 0; i < Math.max(n, projectiles.length); i++) {
        const t = tray(i);
        if (i >= n) { t.active = false; continue; }
        t.recharge = Math.max(0, t.recharge - dt);
        t.active = t.recharge === 0;
        const a = angle + (i / n) * Math.PI * 2;
        d.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
        t.pos.copy(p).addScaledVector(d, P.radius).addScaledVector(up, P.height);
        // Debout, face vers l'extérieur, comme un bouclier tenu à bout de bras
        t.up0.copy(d);
        t.spinAxis.copy(d);
        t.spinRate = 0.4;
        t.age = clock;
      }
    },
    absorbHit() {
      const t = projectiles.find((x, i) => i < count() && x.recharge === 0);
      if (!t) return false;
      t.recharge = P.recharge / (ctx.stats.fireRate * mods.rate);
      t.active = false;
      // Service en salle (évolution) : le coup est renvoyé à tous les zombies autour
      const r = mods.evolved ? P.reflectRadius : 0.8;
      ctx.explode(weapon, t.pos, r);
      if (mods.evolved) {
        const p = ctx.playerPos();
        for (const z of ctx.zombiesNear(p, r, around)) {
          if (!z.targetable || z.pos.distanceTo(p) > r) continue;
          ctx.hitZombie(weapon, z, P.reflectDamage, false, z.pos, d.subVectors(z.pos, p).normalize().multiplyScalar(8), 3);
        }
      }
      return true;
    },
    reset() {
      angle = 0;
      clock = 0;
      for (const t of projectiles) { t.active = false; t.recharge = 0; }
      Object.assign(mods, MODS0);
    },
    stats(): StatLine[] {
      const s = ctx.stats, m = mods;
      return [
        { label: 'Plateaux', value: P.count + s.extraProjectiles + m.projectiles, unit: 'count', bonus: m.projectiles, bonusKind: 'plus' },
        { label: 'Recharge', value: P.recharge / (s.attackSpeed * m.rate), unit: 'seconds', bonus: m.rate - 1, bonusKind: 'percent' },
      ];
    },
  };
  return weapon;
}
