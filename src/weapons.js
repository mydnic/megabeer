import * as THREE from 'three';
import { player } from './player.js';
import { nearestEnemy } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { spawnPuddle } from './puddles.js';
import { toonMaterial, woodMaterial } from './textures.js';

export const BEER_TYPES = [
  { name: 'Blonde', color: 0xf2c14e, dmgMult: 1.0 },
  { name: 'Kriek', color: 0xb0304f, dmgMult: 1.15 },
  { name: 'Brune', color: 0x4a2c14, dmgMult: 1.3 },
  { name: 'Triple', color: 0xffcc33, dmgMult: 1.6 },
];

function pickBeerType(gameTime) {
  const tier = Math.min(BEER_TYPES.length - 1, Math.floor(gameTime / 40));
  return BEER_TYPES[Math.floor(Math.random() * (tier + 1))];
}

const bottleGeo = new THREE.CapsuleGeometry(0.2, 0.35, 2, 6);
const kegGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 12);
const kegMat = woodMaterial(1, 1);
const coasterGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16);
const coasterMat = toonMaterial({ color: 0xd2a679 });

function angleTo(target) {
  return Math.atan2(target.x - player.x, target.z - player.z);
}

export const WEAPON_DEFS = {
  beer: {
    label: 'Lancer de bière',
    cooldown: 1.0, range: 16,
    fire(target, gameTime) {
      const base = angleTo(target);
      for (let i = 0; i < player.projCount; i++) {
        const spread = (i - (player.projCount - 1) / 2) * 0.18;
        const bt = pickBeerType(gameTime);
        fireProjectile(base + spread, {
          geometry: bottleGeo,
          material: toonMaterial({ color: bt.color }),
          dmg: player.dmg * bt.dmgMult,
          speed: player.projSpeed, r: 0.3, pierce: 1,
        });
      }
    },
  },
  coaster: {
    label: 'Dessous de verre',
    cooldown: 1.6, range: 16,
    fire(target) {
      fireProjectile(angleTo(target), {
        geometry: coasterGeo,
        material: coasterMat,
        dmg: player.dmg * 0.65,
        speed: player.projSpeed * 1.3, r: 0.35, pierce: 3,
        spin: 22, spinAxis: 'y', originY: 0.9,
      });
    },
  },
  keg: {
    label: 'Fût qui roule',
    cooldown: 3.5, range: Infinity,
    fire(target) {
      fireProjectile(angleTo(target), {
        geometry: kegGeo,
        material: kegMat,
        dmg: player.dmg * 1.8,
        speed: player.projSpeed * 0.55, r: 0.75, pierce: 99,
        spin: 14, spinAxis: 'x', originY: 0.7, life: 2.6,
      });
    },
  },
  puddle: {
    label: 'Flaque de bière',
    cooldown: 4.0, range: Infinity,
    fire(target) {
      spawnPuddle(target.x, target.z, player.dmg * 0.5, 3.2, 3.0);
    },
  },
};

export function updateWeapons(dt, gameTime) {
  for (const id of player.unlockedWeapons) {
    player.weaponTimers[id] = (player.weaponTimers[id] ?? 0) - dt;
    if (player.weaponTimers[id] <= 0) {
      const def = WEAPON_DEFS[id];
      const target = nearestEnemy();
      if (target) {
        const dx = target.x - player.x, dz = target.z - player.z;
        if (dx * dx + dz * dz <= def.range * def.range) {
          def.fire(target, gameTime);
          player.weaponTimers[id] = def.cooldown / player.atkSpeed;
        }
      }
    }
  }
}
