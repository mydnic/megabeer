import * as THREE from 'three';
import { BELLS } from '../config/abbey';
import { ARRIVAL, DEATH_BANNER } from '../config/player';
import { DEATH } from '../config/buveur';
import { HIT_FEEDBACK } from '../config/zombies';
import type { AudioEngine } from '../audio/audio';
import type { Game } from '../game/game';
import type { BuveurVisual } from '../player/buveurVisual';
import type { CameraRig } from '../player/cameraRig';
import type { PintProp } from '../player/pintProp';
import type { Pipeline } from '../render/pipeline';
import { KAMIKAZE_LOOK } from '../config/enemies';
import type { createShards } from '../fx/shards';
import type { createDamageNumbers } from '../ui/damageNumbers';
import { jitter } from './sounds';

type Deps = {
  buveur: BuveurVisual;
  rig: CameraRig;
  pint: PintProp;
  pipeline: Pipeline;
  audio: AudioEngine;
  shards: ReturnType<typeof createShards>;
  /** Explosion d'un kamikaze : gouttes de vin et éclats de tonneau. */
  wine: ReturnType<typeof createShards>;
  wood: ReturnType<typeof createShards>;
  /** Coup amorti par le halo d'un porte-reliques : étincelles dorées. */
  sparks: ReturnType<typeof createShards>;
  damageNumbers: ReturnType<typeof createDamageNumbers>;
};

/**
 * Retours visuels, branchés sur les événements du noyau : gerbes de bière et éclats de verre aux
 * impacts, chiffres de dégâts, flash et tremblement quand le Buveur est touché, caméra de l'arrivée,
 * séquence de mort (pinte qui s'échappe, plongée de la caméra, image qui se désature).
 */
export function wireEffects(game: Game, d: Deps) {
  const { buveur, rig, pint, pipeline, shards, wine, wood, sparks, damageNumbers } = d;
  const up = new THREE.Vector3(), numPos = new THREE.Vector3(), soft = new THREE.Vector3();

  game.events.on('zombieHit', ({ zombie, impact, dir, damage, crit, shielded }) => {
    buveur.splashAt(impact, 14);
    shards.burst(impact, dir);
    if (shielded) sparks.burst(impact, dir);
    up.copy(zombie.pos).normalize();
    damageNumbers.spawn(numPos.copy(zombie.pos).addScaledVector(up, 2.0), damage, crit);
  });
  game.events.on('projectileHitGround', ({ pos, vel }) => {
    buveur.splashAt(pos, 10);
    shards.burst(pos, soft.copy(vel).normalize().multiplyScalar(0.3));
  });
  // Bouteille d'un moine qui éclate au sol
  game.events.on('enemyShotLanded', ({ shot }) => {
    up.copy(shot.to).normalize();
    shards.burst(numPos.copy(shot.to).addScaledVector(up, 0.25), soft.copy(shot.vel).normalize().multiplyScalar(0.3));
  });
  // Pèlerin gonflé qui explose : gerbe de vin et éclats du tonneau, la caméra tremble s'il est près
  const still = new THREE.Vector3();
  game.events.on('enemyExploded', ({ at }) => {
    const L = KAMIKAZE_LOOK;
    up.copy(at).normalize();
    numPos.copy(at).addScaledVector(up, L.burstHeight);
    wine.burst(numPos, still);
    wood.burst(numPos, still);
    const k = 1 - at.distanceTo(game.player.pos) / L.shakeDist;
    if (k > 0) rig.shake(L.shake * k, L.shakeAmplitude, L.shakeDecay);
  });
  game.events.on('playerHurt', ({ blocked }) => {
    if (blocked) return;
    buveur.hurt(HIT_FEEDBACK.flashColor, HIT_FEEDBACK.flashTime);
    rig.shake(HIT_FEEDBACK.shake, HIT_FEEDBACK.shakeAmplitude, HIT_FEEDBACK.shakeDecay);
  });

  // Arrivée : caméra déjà posée sur le point d'atterrissage, le Buveur tombe dedans ; impact
  game.events.on('runStarted', ({ landing }) => {
    rig.setFocus(null);
    rig.setAnchor(landing);
    rig.snap();
  });
  game.events.on('landed', ({ pos }) => {
    rig.setAnchor(null);
    rig.shake(ARRIVAL.shake.amount, ARRIVAL.shake.amplitude, ARRIVAL.shake.decay);
    buveur.splashAt(pos, ARRIVAL.splash);
  });

  // Débarquement des cloches : la terre tremble
  game.events.on('bellsLanding', () => rig.shake(BELLS.shake.amount, BELLS.shake.amplitude, BELLS.shake.decay));

  // Mort : la pinte s'échappe, la caméra plonge sur le corps
  let pintFirstImpact = true;
  pint.onImpact = (p, speed) => {
    if (pintFirstImpact) buveur.splashAt(p, DEATH.pint.splashCount);
    pintFirstImpact = false;
    d.audio.play(speed > 3 ? 'impactGlass_medium' : 'impactGlass_light', Math.min(0.6, 0.15 + speed * 0.06), jitter(0.08));
  };
  game.events.on('died', () => {
    const player = game.player;
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
    buveur.die(pos, quat);
    // Pinte lancée vers le haut, un peu devant et sur sa droite, en tournant
    const u = player.upDir.clone(), fwd = player.facing.clone();
    const right = new THREE.Vector3().crossVectors(u, fwd).negate().normalize();
    const P = DEATH.pint;
    const vel = u.multiplyScalar(P.throwUp).addScaledVector(fwd, P.throwForward).addScaledVector(right, P.throwSide).add(player.velocity);
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(P.spin);
    pint.setColors(buveur.color('verre'), buveur.color('biere'), buveur.color('mousse'));
    pintFirstImpact = true;
    pint.launch(pos, quat, vel, spin);
    rig.setFocus(DEATH.camera);
  });

  game.events.on('home', () => {
    buveur.revive();
    pint.hide();
    shards.clear();
    wine.clear();
    sparks.clear();
    wood.clear();
    damageNumbers.clear();
    rig.setAnchor(null);
    pipeline.fade.amount = 0;
  });

  return {
    /** Image qui se désature et s'assombrit après la mort. */
    update() {
      if (game.deadTime < 0) return;
      const B = DEATH_BANNER;
      pipeline.fade.amount = Math.min(1, game.deadTime / B.colorFade);
      pipeline.fade.saturation = B.saturation;
      pipeline.fade.vignette = B.vignette;
    },
  };
}
