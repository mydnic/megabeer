import * as THREE from 'three';
import { player } from './player.js';
import { nearestEnemy } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { spawnPuddle } from './puddles.js';
import { toonMaterial, woodMaterial } from './textures.js';
import { WEAPON_TYPES, BEER_TYPES } from './config/weapons.js';

function pickBeerType(gameTime) {
  const tier = Math.min(BEER_TYPES.length - 1, Math.floor(gameTime / 40));
  return BEER_TYPES[Math.floor(Math.random() * (tier + 1))];
}

const bottleGeo = new THREE.CapsuleGeometry(0.2, 0.35, 2, 6);
const kegGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 12);
const kegMat = woodMaterial(1, 1);
const coasterGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16);
const coasterMat = toonMaterial({ color: 0xd2a679 });
const stoutMat = toonMaterial({ color: 0x2b1810 });

function angleTo(target) {
  return Math.atan2(target.x - player.x, target.z - player.z);
}

// Per-weapon firing behavior. Reads balance numbers (cooldown/range/dmgMult/pierce/...)
// from WEAPON_TYPES config; only mesh/geometry choice lives here.
const WEAPON_FIRE = {
  beer(cfg, target, gameTime) {
    const base = angleTo(target);
    for (let i = 0; i < player.projCount; i++) {
      const spread = (i - (player.projCount - 1) / 2) * 0.18;
      const bt = pickBeerType(gameTime);
      fireProjectile(base + spread, {
        geometry: bottleGeo,
        material: toonMaterial({ color: bt.color }),
        dmg: player.dmg * cfg.dmgMult * bt.dmgMult,
        speed: player.projSpeed * cfg.projectile.speedMult,
        r: 0.3, pierce: cfg.projectile.pierce,
      });
    }
  },
  coaster(cfg, target) {
    fireProjectile(angleTo(target), {
      geometry: coasterGeo,
      material: coasterMat,
      dmg: player.dmg * cfg.dmgMult,
      speed: player.projSpeed * cfg.projectile.speedMult,
      r: 0.35, pierce: cfg.projectile.pierce,
      spin: cfg.projectile.spin, spinAxis: cfg.projectile.spinAxis, originY: 0.9,
    });
  },
  keg(cfg, target) {
    fireProjectile(angleTo(target), {
      geometry: kegGeo,
      material: kegMat,
      dmg: player.dmg * cfg.dmgMult,
      speed: player.projSpeed * cfg.projectile.speedMult,
      r: 0.75, pierce: cfg.projectile.pierce,
      spin: cfg.projectile.spin, spinAxis: cfg.projectile.spinAxis,
      originY: 0.7, life: cfg.projectile.life,
    });
  },
  puddle(cfg, target) {
    spawnPuddle(target.x, target.z, player.dmg * cfg.dmgMult, cfg.aoe.radius, cfg.aoe.duration);
  },
  stout(cfg, target) {
    fireProjectile(angleTo(target), {
      geometry: bottleGeo,
      material: stoutMat,
      dmg: player.dmg * cfg.dmgMult,
      speed: player.projSpeed * cfg.projectile.speedMult,
      r: 0.3, pierce: cfg.projectile.pierce,
    });
  },
  vomit(cfg, target) {
    spawnPuddle(target.x, target.z, player.dmg * cfg.dmgMult, cfg.aoe.radius, cfg.aoe.duration, 0x7a9e3a);
  },
};

export function updateWeapons(dt, gameTime) {
  for (const id of player.unlockedWeapons) {
    player.weaponTimers[id] = (player.weaponTimers[id] ?? 0) - dt;
    if (player.weaponTimers[id] <= 0) {
      const cfg = WEAPON_TYPES[id];
      const target = nearestEnemy();
      if (target) {
        const dx = target.x - player.x, dz = target.z - player.z;
        if (dx * dx + dz * dz <= cfg.range * cfg.range) {
          WEAPON_FIRE[id](cfg, target, gameTime);
          player.weaponTimers[id] = cfg.cooldown / player.atkSpeed;
        }
      }
    }
  }
}
