import * as THREE from 'three';
import { player } from './player.js';
import { nearestEnemy } from './enemies.js';
import { fireProjectile } from './projectiles.js';
import { spawnPuddle } from './puddles.js';
import { toonMaterial, woodMaterial } from './textures.js';
import { decorModels, cloneDecorModel } from './decorModels.js';
import { WEAPON_TYPES, BEER_TYPES } from './config/weapons.js';

function pickBeerType(gameTime) {
  const tier = Math.min(BEER_TYPES.length - 1, Math.floor(gameTime / 40));
  return BEER_TYPES[Math.floor(Math.random() * (tier + 1))];
}

// Procedural fallback geometry, used only for the brief window before
// decorModels.js finishes loading the real bottle/keg models (so the starter
// weapon still fires instead of going silent at the very start of a run).
const bottleGeoFallback = new THREE.CapsuleGeometry(0.2, 0.35, 2, 6);
const kegGeoFallback = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 12);
const kegMatFallback = woodMaterial(1, 1);
const coasterGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16);
const coasterMat = toonMaterial({ color: 0xd2a679 });
const stoutMatFallback = toonMaterial({ color: 0x2b1810 });
// One material per beer type, built once and reused — a fresh toonMaterial() per
// shot (previously created on every single beer throw) never got disposed.
const beerMatsFallback = new Map(BEER_TYPES.map(bt => [bt, toonMaterial({ color: bt.color })]));

function angleTo(target) {
  return Math.atan2(target.x - player.x, target.z - player.z);
}

// Real "Bottle" (Quaternius) model once loaded, tinted per beer type; falls back
// to the old capsule so the weapon never goes silent while assets are loading.
function bottleProjectile(angle, dmg, speed, pierce, bt) {
  if (decorModels.ready) {
    const { mesh } = cloneDecorModel('beerBottle', 0.55, bt.color);
    fireProjectile(angle, { mesh, dmg, speed, r: 0.3, pierce, spin: 6, spinAxis: 'x' });
  } else {
    fireProjectile(angle, { geometry: bottleGeoFallback, material: beerMatsFallback.get(bt), dmg, speed, r: 0.3, pierce });
  }
}

// Same idea for the keg — real "Barrel" (Quaternius) model, rolling spin already
// matches a barrel far better than the old plain cylinder ever could.
function kegProjectile(angle, dmg, speed, pierce, life) {
  if (decorModels.ready) {
    const { mesh } = cloneDecorModel('kegBarrel', 1.1);
    fireProjectile(angle, { mesh, dmg, speed, r: 0.75, pierce, spin: 14, spinAxis: 'x', originY: 0.7, life });
  } else {
    fireProjectile(angle, {
      geometry: kegGeoFallback, material: kegMatFallback, dmg, speed, r: 0.75, pierce,
      spin: 14, spinAxis: 'x', originY: 0.7, life,
    });
  }
}

// Per-weapon firing behavior. Reads balance numbers (cooldown/range/dmgMult/pierce/...)
// from WEAPON_TYPES config; only mesh/geometry choice lives here.
const WEAPON_FIRE = {
  beer(cfg, target, gameTime) {
    const base = angleTo(target);
    for (let i = 0; i < player.projCount; i++) {
      const spread = (i - (player.projCount - 1) / 2) * 0.18;
      const bt = pickBeerType(gameTime);
      bottleProjectile(
        base + spread,
        player.dmg * cfg.dmgMult * bt.dmgMult,
        player.projSpeed * cfg.projectile.speedMult,
        cfg.projectile.pierce,
        bt
      );
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
    kegProjectile(
      angleTo(target),
      player.dmg * cfg.dmgMult,
      player.projSpeed * cfg.projectile.speedMult,
      cfg.projectile.pierce,
      cfg.projectile.life
    );
  },
  puddle(cfg, target) {
    spawnPuddle(target.x, target.z, player.dmg * cfg.dmgMult, cfg.aoe.radius, cfg.aoe.duration);
  },
  stout(cfg, target) {
    if (decorModels.ready) {
      const { mesh } = cloneDecorModel('beerBottle', 0.6, 0x2b1810);
      fireProjectile(angleTo(target), {
        mesh, dmg: player.dmg * cfg.dmgMult, speed: player.projSpeed * cfg.projectile.speedMult,
        r: 0.3, pierce: cfg.projectile.pierce, spin: 6, spinAxis: 'x',
      });
    } else {
      fireProjectile(angleTo(target), {
        geometry: bottleGeoFallback, material: stoutMatFallback,
        dmg: player.dmg * cfg.dmgMult, speed: player.projSpeed * cfg.projectile.speedMult,
        r: 0.3, pierce: cfg.projectile.pierce,
      });
    }
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
