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
import { GUEUZE_BLAST } from '../config/weapons';
import type { createShards } from '../fx/shards';
import type { createDamageNumbers } from '../ui/damageNumbers';
import { jitter } from './sounds';
import { RING_WAVE } from '../config/fx';
import type { createRingWaveView } from '../fx/ringWaveView';
import { VFX } from '../config/fx';
import { RARITIES } from '../config/upgrades';
import { PUMP_TIERS } from '../config/pumps';
import { TOURNEE_FX, TOURNEES } from '../config/tournees';
import { ELITES } from '../config/elites';
import type { Vfx } from '../fx/vfx';
import type { Sprites } from '../fx/sprites';

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
  /** Squelette du Prieur qui sort de terre : mottes de terre. */
  earth: ReturnType<typeof createShards>;
  /** Stout qui éclate sur un zombie : gerbe de bière brune. */
  stoutSplash: ReturnType<typeof createShards>;
  /** Gueuze qui explose : gerbe de bière framboise. */
  gueuzeBurst: ReturnType<typeof createShards>;
  /** Cendrier : cendres et braises ; Mousse épaisse : la bulle qui éclate. */
  ash: ReturnType<typeof createShards>;
  embers: ReturnType<typeof createShards>;
  foam: ReturnType<typeof createShards>;
  /** Glaçons : éclats de glace ; Bonnet : étincelles dorées ; ondes au sol. */
  ice: ReturnType<typeof createShards>;
  gift: ReturnType<typeof createShards>;
  /** Poubelle cassée : éclats de tôle. */
  tin: ReturnType<typeof createShards>;
  rings: ReturnType<typeof createRingWaveView>;
  /** Particules lumineuses et recettes d'effets (éclats, explosions, colonnes de lumière). */
  sprites: Sprites;
  vfx: Vfx;
  damageNumbers: ReturnType<typeof createDamageNumbers>;
};

/**
 * Retours visuels, branchés sur les événements du noyau : gerbes de bière et éclats de verre aux
 * impacts, chiffres de dégâts, flash et tremblement quand le Buveur est touché, caméra de l'arrivée,
 * séquence de mort (pinte qui s'échappe, plongée de la caméra, image qui se désature).
 */
export function wireEffects(game: Game, d: Deps) {
  const { buveur, rig, pint, pipeline, shards, wine, wood, sparks, earth, stoutSplash, gueuzeBurst, damageNumbers } = d;
  const up = new THREE.Vector3(), numPos = new THREE.Vector3(), soft = new THREE.Vector3();
  const { vfx } = d, VC = VFX.colors;
  /** Point à `h` m au-dessus des pieds du joueur. */
  const chest = (h = 1) => numPos.copy(game.player.pos).addScaledVector(up.copy(game.player.pos).normalize(), h);

  game.events.on('zombieHit', ({ weapon, zombie, impact, dir, damage, crit, shielded, combo, killed }) => {
    // La Stout éclate en bière brune ; la Canette gicle en bière blonde, sans verre (elle est en métal) ;
    // le fût écrase sans se briser (il éclate à la fin de sa course) ; la Gueuze a sa propre explosion
    if (weapon?.id === 'stout') stoutSplash.burst(impact, dir);
    else if (weapon?.id !== 'fut' && weapon?.id !== 'gueuze') buveur.splashAt(impact, 14);
    if (weapon?.id !== 'canette' && weapon?.id !== 'fut' && weapon?.id !== 'gueuze') shards.burst(impact, dir);
    if (shielded) sparks.burst(impact, dir);
    // Éclat lumineux du coup ; critique ou combo : grosse étoile ; ennemi tué : il part en fumée
    if (crit || combo) vfx.crit(impact); else vfx.hit(impact);
    if (killed) vfx.kill(zombie.pos);
    up.copy(zombie.pos).normalize();
    // Un coup combo (synergie) s'affiche en gros, comme un critique
    damageNumbers.spawn(numPos.copy(zombie.pos).addScaledVector(up, 2.0), damage, crit || combo);
  });
  game.events.on('projectileHitGround', ({ weapon, pos, vel }) => {
    // Le fût qui éclate : éclats de bois et une grosse giclée de bière
    if (weapon.id === 'fut') { wood.burst(pos, soft.copy(vel).normalize().multiplyScalar(0.3)); buveur.splashAt(pos, 30); vfx.dust(pos, 9, 0.8, 5); vfx.pop(pos, VFX.hit.color, 1.6); return; }
    buveur.splashAt(pos, 10);
    vfx.dust(pos, 3, 0.35, 2);
    if (weapon.id !== 'canette') shards.burst(pos, soft.copy(vel).normalize().multiplyScalar(0.3));
  });
  // Bouteille d'un moine qui éclate au sol
  game.events.on('enemyShotLanded', ({ shot }) => {
    up.copy(shot.to).normalize();
    shards.burst(numPos.copy(shot.to).addScaledVector(up, 0.25), soft.copy(shot.vel).normalize().multiplyScalar(0.3));
    vfx.explosion(numPos, 1.1, VFX.glass);
  });
  // Pèlerin gonflé qui explose : gerbe de vin et éclats du tonneau, la caméra tremble s'il est près
  const still = new THREE.Vector3();
  game.events.on('enemyExploded', ({ at, radius }) => {
    const L = KAMIKAZE_LOOK;
    up.copy(at).normalize();
    numPos.copy(at).addScaledVector(up, L.burstHeight);
    wine.burst(numPos, still);
    wood.burst(numPos, still);
    vfx.explosion(numPos, radius, VFX.wine);
    d.rings.spawn(at, radius, VFX.wine.ember);
    const k = 1 - at.distanceTo(game.player.pos) / L.shakeDist;
    if (k > 0) rig.shake(L.shake * k, L.shakeAmplitude, L.shakeDecay);
  });
  // Frère cellérier tué : il éclate en gerbe de vin, ses moinillons en sortent
  game.events.on('enemySplit', ({ zombie }) => {
    up.copy(zombie.pos).normalize();
    wine.burst(numPos.copy(zombie.pos).addScaledVector(up, KAMIKAZE_LOOK.burstHeight), still);
    vfx.explosion(numPos, 1.4, VFX.wine);
  });
  // Gueuze qui explose : gerbe de bière framboise, éclats de verre, la caméra tremble si c'est près
  game.events.on('weaponExploded', ({ pos, radius }) => {
    up.copy(pos).normalize();
    numPos.copy(pos).addScaledVector(up, 0.3);
    gueuzeBurst.burst(numPos, still);
    shards.burst(numPos, still);
    vfx.explosion(numPos, radius, VFX.gueuze);
    d.rings.spawn(pos, radius, VFX.gueuze.ember);
    const B = GUEUZE_BLAST, k = 1 - pos.distanceTo(game.player.pos) / B.shakeDist;
    if (k > 0) rig.shake(B.shake * k, B.shakeAmplitude, B.shakeDecay);
  });
  // Cendrier : l'ennemi tué part en cendres et en braises
  game.events.on('itemExploded', ({ at, radius }) => {
    up.copy(at).normalize();
    numPos.copy(at).addScaledVector(up, 0.9);
    d.ash.burst(numPos, still);
    d.embers.burst(numPos, still);
    vfx.explosion(numPos, radius, VFX.ash);
    d.rings.spawn(at, radius, VFX.ash.ember);
  });
  // Mousse épaisse : la bulle éclate en gouttes de mousse, petit recul de caméra
  game.events.on('foamShieldPopped', () => {
    up.copy(game.player.pos).normalize();
    d.foam.burst(numPos.copy(game.player.pos).addScaledVector(up, 1.0), still);
    vfx.pop(numPos, VC.foam, 2.6);
    rig.shake(HIT_FEEDBACK.shake * 0.5, HIT_FEEDBACK.shakeAmplitude, HIT_FEEDBACK.shakeDecay);
  });
  // Glaçons, Sifflet : la glace éclate autour de l'ennemi gelé
  game.events.on('zombieFrozen', ({ zombie }) => {
    up.copy(zombie.pos).normalize();
    d.ice.burst(numPos.copy(zombie.pos).addScaledVector(up, 1.2), still);
    vfx.pop(numPos, VC.ice, 1.5);
  });
  // Poubelle cassée : tôle et poussière, petit éclat
  game.events.on('binBroken', ({ bin }) => {
    up.copy(bin.pos).normalize();
    d.tin.burst(numPos.copy(bin.pos).addScaledVector(up, 0.6), still);
    vfx.dust(bin.pos, 6, 0.5, 3);
    vfx.pop(numPos, VC.bin, 1.4);
  });
  // Dernier service : colonne de lumière sur la cloche (ou le Buveur) et onde dorée autour du Buveur
  game.events.on('lastCallRung', ({ at }) => {
    vfx.beam(at, VC.level, 1.6, 16, 1.6);
    d.rings.spawn(game.player.pos, 9, VC.level);
    vfx.pop(chest(1.4), VC.level, 3);
    vfx.sparkle(game.player.pos, VC.level, 12, 1.2, 4);
  });
  // Élite : il sort de terre dans un éclat rouge ; tué, son coffre tombe dans une pluie d'étincelles
  game.events.on('eliteSpawned', ({ zombie }) => {
    vfx.sparkle(zombie.pos, ELITES.color, 10, 1.2, 3);
    d.rings.spawn(zombie.pos, 3, ELITES.color);
  });
  game.events.on('eliteKilled', ({ zombie, chest: c }) => {
    up.copy(zombie.pos).normalize();
    vfx.pop(numPos.copy(zombie.pos).addScaledVector(up, 1.5), ELITES.color, 4);
    if (!c) return;
    up.copy(c.pos).normalize();
    d.gift.burst(numPos.copy(c.pos).addScaledVector(up, 1), still);
    vfx.beam(c.pos, VC.level, 1.3, 11, 1.4);
  });
  // Tournée du bar ramassée : éclat et colonne de sa couleur ; la Tournée générale part en onde de bière
  game.events.on('tourneeTaken', ({ id }) => {
    const color = TOURNEES[id].color;
    vfx.pop(chest(1.3), color, 3);
    vfx.beam(game.player.pos, color, 1.2, 10, 1.2);
    vfx.sparkle(game.player.pos, color, 10, 1, 3);
    if (id === 'generale') { d.rings.spawn(game.player.pos, TOURNEE_FX.generale.radius, color); rig.shake(HIT_FEEDBACK.shake, HIT_FEEDBACK.shakeAmplitude, HIT_FEEDBACK.shakeDecay); }
    if (id === 'seau') d.rings.spawn(game.player.pos, TOURNEE_FX.seau.radius, color);
  });
  // Snack mangé : petites étoiles dorées
  game.events.on('snackEaten', () => { vfx.sparkle(game.player.pos, VC.snack, 6, 0.6, 2.5); vfx.pop(chest(1.2), VC.snack, 1.6); });
  // Coffre piégé : il saute dans une explosion rouge, la terre gicle sous les ennemis qui sortent
  game.events.on('chestTrapped', ({ at, radius, zombies }) => {
    up.copy(at).normalize();
    numPos.copy(at).addScaledVector(up, 0.7);
    d.wood.burst(numPos, still);
    d.embers.burst(numPos, still);
    vfx.explosion(numPos, radius, VFX.trap);
    d.rings.spawn(at, radius, VFX.trap.ember);
    for (const z of zombies) { earth.burst(numPos.copy(z.pos).setLength(z.pos.length() + 0.1), still); vfx.dust(z.pos, 4, 0.5, 2.5); }
    const B = GUEUZE_BLAST;
    rig.shake(B.shake * 1.2, B.shakeAmplitude, B.shakeDecay);
  });
  // Ondes au sol
  game.events.on('whistleBlown', ({ at, radius }) => { d.rings.spawn(at, radius, RING_WAVE.colors.whistle); vfx.pop(chest(1.4), RING_WAVE.colors.whistle, 2); });
  game.events.on('shockwave', ({ at, radius }) => {
    d.rings.spawn(at, radius, RING_WAVE.colors.shockwave);
    vfx.pop(chest(1), RING_WAVE.colors.shockwave, 2.4);
    vfx.sparkle(at, RING_WAVE.colors.shockwave, 10, radius * 0.5, 3);
  });
  game.events.on('revived', () => {
    d.rings.spawn(game.player.pos, 4, RING_WAVE.colors.revive);
    vfx.beam(game.player.pos, VC.level, 1.6, 14, 1.6);
    vfx.pop(chest(1), RING_WAVE.colors.revive, 4);
    rig.shake(HIT_FEEDBACK.shake, HIT_FEEDBACK.shakeAmplitude, HIT_FEEDBACK.shakeDecay);
  });
  // Bonnet : le coffre gratuit arrive dans une pluie d'étincelles
  game.events.on('freeChestSpawned', ({ chest }) => {
    up.copy(chest.pos).normalize();
    d.gift.burst(numPos.copy(chest.pos).addScaledVector(up, 1), still);
    vfx.beam(chest.pos, VC.level);
    vfx.dust(chest.pos, 8, 0.6, 4);
  });
  // Squelettes du Prieur : la terre gicle à leurs pieds quand ils sortent
  game.events.on('summoned', ({ skeletons }) => {
    for (const s of skeletons) {
      earth.burst(numPos.copy(s.pos).setLength(s.pos.length() + 0.1), still);
      vfx.dust(s.pos, 4, 0.5, 2.5);
      vfx.sparkle(s.pos, VC.summon, 4, 0.5, 2.5);
    }
  });
  game.events.on('playerHurt', ({ blocked }) => {
    if (blocked) return;
    buveur.hurt(HIT_FEEDBACK.flashColor, HIT_FEEDBACK.flashTime);
    vfx.pop(chest(1.1), VC.hurt, 1.8);
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
    vfx.dust(pos, 16, 1, 8);
    vfx.pop(pos, VFX.hit.color, 3);
    d.rings.spawn(pos, 6, VFX.dust.color);
  });

  // Niveau gagné, coffre ouvert, pompe vidée, Happy hour : une colonne de lumière jaillit (à la reprise du jeu)
  game.events.on('levelGained', () => vfx.beam(game.player.pos, VC.level));
  game.events.on('chestOpened', ({ chest: c, rarity }) => vfx.beam(c.pos, new THREE.Color(RARITIES[rarity].color).getHex(), 1.3, 11, 1.4));
  game.events.on('pumpFilled', ({ pump }) => vfx.beam(pump.pos, PUMP_TIERS[pump.tier].color, 1.3, 11, 1.4));
  game.events.on('happyHourStarted', () => vfx.beam(game.player.pos, VC.happy, 1.4, 10, 1.3));
  game.events.on('foamShieldUp', () => vfx.sparkle(game.player.pos, VC.foam, 8, 1, 2));
  game.events.on('playerDodged', () => vfx.pop(chest(1.1), 0xffffff, 1.4));
  // XP et capsules ramassées : de petites étoiles montent du Buveur (pas plus d'une toutes les `pickupGap` s)
  let lastPickup = 0;
  const pickup = (color: number) => {
    if (game.runTime - lastPickup < VFX.pickupGap && game.runTime >= lastPickup) return;
    lastPickup = game.runTime;
    vfx.sparkle(game.player.pos, color, 1, 0.5, 2.5);
  };
  game.events.on('xpCollected', () => pickup(VC.xp));
  game.events.on('coinsCollected', () => { pickup(VC.coin); vfx.pop(chest(1.2), VC.coin, 0.9); });

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
    earth.clear();
    stoutSplash.clear();
    gueuzeBurst.clear();
    wood.clear();
    damageNumbers.clear();
    d.sprites.clear();
    vfx.clear();
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
