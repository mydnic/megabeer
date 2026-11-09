import { CANETTE_IMPACT, FUT_SOUND, STOUT_IMPACT } from '../config/weapons';
import type * as THREE from 'three';
import { BELL_SOUND } from '../config/abbey';
import { AUDIO } from '../config/audio';
import { DEATH_BANNER } from '../config/player';
import type { AudioEngine } from '../audio/audio';
import type { createMusic } from '../audio/music';
import type { Game } from '../game/game';
import type { BuveurVisual } from '../player/buveurVisual';

/** Petite variation de hauteur autour de 1 (évite la répétition). */
export const jitter = (j: number) => 1 + (Math.random() * 2 - 1) * j;

/**
 * Sons du jeu, branchés sur les événements du noyau et de l'animation du Buveur : pas, saut,
 * réception, ramassage d'XP, level-up, choix de carte, cloches.
 */
export function wireSounds(game: Game, audio: AudioEngine, buveur: BuveurVisual) {
  // Pas, saut, réception : déclenchés par l'animation (le pied touche le sol)
  buveur.onSound = (e) => {
    const F = AUDIO.footsteps;
    if (e.type === 'step') {
      const s = F.surfaces[e.surface];
      audio.play(s.sample, F.volume, s.rate * jitter(F.pitchJitter), e.side * 0.15);
    } else if (e.type === 'jump') {
      audio.whoosh(AUDIO.jump.volume);
    } else if (e.type === 'land') {
      const k = Math.min(AUDIO.land.max, 0.4 + e.speed * AUDIO.land.perSpeed);
      audio.play('impactSoft_medium', AUDIO.land.volume * k, jitter(0.06));
      const s = F.surfaces[e.surface];
      audio.play(s.sample, F.volume, s.rate * 0.9);
      if (Math.random() < AUDIO.clink.chance) audio.play('impactGlass_light', AUDIO.clink.volume, jitter(0.1));
    }
  };

  // Ramassage : une bulle, de plus en plus aiguë quand on en avale plusieurs à la suite
  let lastPickup = -1, combo = 0;
  game.events.on('xpCollected', () => {
    const P = AUDIO.pickup, now = performance.now() / 1000;
    if (now - lastPickup < P.minGap) return;
    combo = now - lastPickup > P.comboReset ? 0 : combo + 1;
    lastPickup = now;
    audio.play(P.sample, P.volume, Math.min(P.pitchMax, 1 + combo * P.pitchStep) * jitter(0.04));
  });

  // Level-up : le "aaah" au premier écran d'une série, puis le son de la carte choisie
  game.events.on('levelUpOffered', ({ first }) => {
    if (first) audio.play(AUDIO.levelUp.sample, AUDIO.levelUp.volume, 1, 0, 'ui');
  });
  // Bouteilles des moines : plus fort quand ça tombe près du joueur
  const near = (p: THREE.Vector3, dist: number = AUDIO.enemyShot.hearDist) => Math.max(0, 1 - p.distanceTo(game.player.pos) / dist);
  game.events.on('enemyThrow', ({ shot }) => { const k = near(shot.from); if (k > 0) audio.whoosh(AUDIO.enemyShot.throwVolume * k); });
  game.events.on('enemyShotLanded', ({ shot, hit }) => {
    const k = hit ? 1 : near(shot.to);
    if (k > 0) audio.play('impactGlass_heavy', AUDIO.enemyShot.breakVolume * k, jitter(0.08));
  });
  // Pèlerin gonflé : le tonneau éclate dans une gerbe de vin
  game.events.on('enemyExploded', ({ at, hit }) => {
    const K = AUDIO.kamikaze;
    const k = hit ? 1 : near(at, K.hearDist);
    if (k <= 0) return;
    audio.play('impactWood_heavy', K.woodVolume * k, jitter(0.08));
    audio.play('impactSoft_heavy', K.splashVolume * k, 0.8 * jitter(0.08));
  });
  // La Stout qui éclate sur un zombie : un choc sourd en plus du verre
  game.events.on('zombieHit', ({ weapon }) => {
    if (weapon?.id === 'stout') audio.play(STOUT_IMPACT.sample, STOUT_IMPACT.volume, STOUT_IMPACT.pitch * jitter(0.06));
  });
  // Le Fût qui roule : il part dans un grondement de bois, écrase chaque zombie, éclate au bout de sa course
  game.events.on('zombieHit', ({ weapon }) => {
    if (weapon?.id === 'fut') audio.play(FUT_SOUND.crush.sample, FUT_SOUND.crush.volume, FUT_SOUND.crush.pitch * jitter(0.08));
  });
  game.events.on('projectileHitGround', ({ weapon }) => {
    if (weapon.id === 'fut') audio.play(FUT_SOUND.burst.sample, FUT_SOUND.burst.volume, FUT_SOUND.burst.pitch * jitter(0.08));
  });
  // La Canette : tintement de fer-blanc sur un zombie ou par terre
  const tin = () => audio.play(CANETTE_IMPACT.sample, CANETTE_IMPACT.volume, CANETTE_IMPACT.pitch * jitter(0.1));
  game.events.on('zombieHit', ({ weapon }) => { if (weapon?.id === 'canette') tin(); });
  game.events.on('projectileHitGround', ({ weapon }) => { if (weapon.id === 'canette') tin(); });
  // Frère cellérier tué : il éclate (ses moinillons en sortent)
  game.events.on('enemySplit', ({ zombie }) => {
    const S = AUDIO.split, k = near(zombie.pos, S.hearDist);
    if (k > 0) audio.play(S.sample, S.volume * k, S.pitch * jitter(0.08));
  });
  // Prieur : l'encensoir tinte quand il commence son geste, la terre craque quand les squelettes sortent
  game.events.on('summonCast', ({ zombie }) => {
    const S = AUDIO.summon, k = near(zombie.pos, S.hearDist);
    if (k > 0) audio.play(S.castSample, S.castVolume * k, S.castPitch * jitter(0.05));
  });
  game.events.on('summoned', ({ zombie }) => {
    const S = AUDIO.summon, k = near(zombie.pos, S.hearDist);
    if (k > 0) audio.play(S.earthSample, S.earthVolume * k, S.earthPitch * jitter(0.08));
  });
  // Cloches de l'Abbaye : coups d'alerte, puis un coup plus grave au débarquement
  game.events.on('bellToll', () => audio.bell(BELL_SOUND.tollVolume, BELL_SOUND.pitch, BELL_SOUND.reverb));
  game.events.on('bellsLanding', () => audio.bell(BELL_SOUND.landingVolume, BELL_SOUND.pitch * BELL_SOUND.landingPitch, BELL_SOUND.reverb));
  game.events.on('cardPicked', () => audio.play(AUDIO.cards.pick, AUDIO.cards.pickVolume, jitter(0.03), 0, 'ui'));
}

/** Musique : celle de la map pendant la run, en retrait pendant l'écran de mort, celle du menu à l'accueil. */
export function wireMusic(game: Game, audio: AudioEngine, music: ReturnType<typeof createMusic>, map: string) {
  const volume = (k: number, tc: number) => {
    if (audio.ctx && audio.music) audio.music.gain.setTargetAtTime(AUDIO.music.volume * k, audio.ctx.currentTime, tc);
  };
  game.events.on('runStarted', () => music.startRun(map));
  game.events.on('died', () => volume(DEATH_BANNER.musicDuck, 0.6));
  game.events.on('home', () => { volume(1, 0.4); music.endRun(); });
}
