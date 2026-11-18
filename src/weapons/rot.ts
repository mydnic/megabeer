import * as THREE from 'three';
import { SYNERGY_FX, ROT as RT, ROT_UPGRADES, ROT_RING } from '../config/arsenal';
import { WEAPON_INFO } from '../config/weapons';
import type { Zombie } from '../enemies/zombie';
import type { StatLine } from '../game/playerStats';
import type { Weapon, WeaponContext, WeaponMods, Zone } from './weapon';

/**
 * Rot sonique (GDD section 6, n° 22) : une onde circulaire autour du joueur, qui se charge avec l'XP ramassée depuis
 * le dernier rot. Plus le joueur fonce dans les capsules, plus le prochain rot fait mal et porte loin. Il part dès
 * que le délai est passé et qu'un zombie est à portée. Sa portée est toujours affichée autour du joueur (une zone qui
 * grandit avec la charge et s'allume à mesure que le délai passe). La Taille (Pinte XXL...) l'agrandit.
 */
export function createRot(ctx: WeaponContext): Weapon {
  const MODS0: WeaponMods = { level: 1, damage: 1, rate: 1, size: 1, charge: 1 };
  const mods: WeaponMods = { ...MODS0 };
  let timer: number = RT.firstDelay;
  /** XP ramassée au moment du dernier rot. */
  let lastXp = 0;
  const d = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
  const around: Zombie[] = [];
  const zone: Zone = { pos: new THREE.Vector3(), radius: RT.radius, age: 1, life: Infinity, active: false, strength: 1 };
  const zones = [zone];

  const charge = () => Math.max(0, ctx.xpGathered() - lastXp) * mods.charge;
  const damage = () => Math.min(RT.maxDamage, RT.damage + RT.perXp * charge()) * mods.damage;
  const radius = () => Math.min(RT.maxRadius, RT.radius + RT.radiusPerXp * charge()) * mods.size * ctx.stats.size;

  const weapon: Weapon = {
    id: 'rot',
    name: WEAPON_INFO.rot.name,
    upgrades: ROT_UPGRADES,
    mods,
    projectiles: [],
    zones,
    update(dt: number) {
      timer -= dt;
      const p = ctx.playerPos();
      const cd = RT.cooldown / (ctx.stats.fireRate * mods.rate);
      zone.active = true;
      zone.pos.copy(p);
      zone.radius = radius();
      zone.strength = timer > 0 ? ROT_RING.dim + (1 - ROT_RING.dim) * (1 - Math.min(1, timer / cd)) : 1;
      if (timer > 0) return;
      // Rot de corne (avec la Corne de brume) : le rot sort en cône devant le joueur, bien plus loin
      const cone = ctx.synergy('rotDeCorne');
      const r = radius() * (cone ? SYNERGY_FX.rotDeCorne.range : 1);
      up.copy(p).normalize();
      fwd.copy(ctx.playerFacing()).addScaledVector(up, -ctx.playerFacing().dot(up)).normalize();
      const cos = Math.cos(SYNERGY_FX.rotDeCorne.halfAngle);
      const hit = ctx.zombiesNear(p, r, around).filter((z) => {
        if (!z.targetable || z.pos.distanceTo(p) > r) return false;
        if (!cone) return true;
        d.subVectors(z.pos, p).addScaledVector(up, -d.subVectors(z.pos, p).dot(up));
        return d.lengthSq() < 0.25 || d.normalize().dot(fwd) >= cos;
      });
      if (!hit.length) return;
      timer = cd;
      const dmg = damage();
      if (cone) ctx.explode(weapon, p.clone().addScaledVector(fwd, r * 0.4), r * 0.45);
      else ctx.explode(weapon, p, r);
      for (const z of hit) {
        d.subVectors(z.pos, p).addScaledVector(up, -d.subVectors(z.pos, p).dot(up)).normalize().multiplyScalar(6);
        ctx.hitZombie(weapon, z, dmg, false, z.pos, d, RT.knock);
        // Rot du siècle (évolution) : l'onde étourdit
        if (mods.evolved) z.frozen = Math.max(z.frozen, RT.stun * ctx.stats.duration);
      }
      lastXp = ctx.xpGathered();
    },
    updateProjectiles() { /* pas de projectile */ },
    reset() {
      timer = RT.firstDelay;
      lastXp = 0;
      zone.active = false;
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
