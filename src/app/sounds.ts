import { CANETTE_IMPACT, FUT_SOUND, GUEUZE_BLAST, STOUT_IMPACT } from '../config/weapons';
import type * as THREE from 'three';
import { BELL_SOUND } from '../config/abbey';
import { AUDIO } from '../config/audio';
import { revealSchedule } from '../ui/chestReveal';
import { PUMPS } from '../config/pumps';
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

  // Coffres : le couvercle claque à l'ouverture ; choc sourd quand il manque des capsules
  // Ouverture façon lootbox : tic à chaque couleur de la roulette, puis au moment où le couvercle
  // saute, le claquement et une note de verre par rareté (cloche grave dès Dingue)
  game.events.on('chestRevealing', (e) => {
    const R = AUDIO.reveal, T = AUDIO.revealTick, { ticks, burst } = revealSchedule(e);
    ticks.forEach((k, i) => setTimeout(() => audio.play(T.sample, T.volume, T.rate + T.rise * (i / ticks.length), 0, 'ui'), k.t * 1000));
    setTimeout(() => {
      audio.play(AUDIO.chest.open, AUDIO.chest.openVolume, AUDIO.chest.openRate * jitter(0.04), 0, 'ui');
      for (let i = 0; i <= e.rarity; i++) setTimeout(() => audio.play(R.sample, R.volume, R.rate + R.step * i, 0, 'ui'), (i + 1) * R.gap * 1000);
      if (e.rarity >= R.bellFrom) setTimeout(() => audio.play(R.bell, R.bellVolume, R.bellRate, 0, 'ui'), (e.rarity + 1) * R.gap * 1000);
    }, burst * 1000);
  });
  game.events.on('chestTrapped', () => {
    const T = AUDIO.trap;
    audio.play(T.wood, T.woodVolume, T.woodRate * jitter(0.05));
    audio.play(T.boom, T.boomVolume, T.boomRate * jitter(0.05));
  });
  // Boss : il sort de terre en grondant ; son maillet frappe le sol comme une cloche ; il rugit en phase 2
  const BS = AUDIO.boss;
  game.events.on('bossSpawned', () => audio.play(BS.spawn, BS.spawnVolume, BS.spawnRate));
  game.events.on('bossWave', ({ at }) => {
    const k = Math.max(0.35, near(at, BS.hearDist));
    audio.play(BS.bell, BS.bellVolume * k, BS.bellRate * jitter(0.04));
    audio.play(BS.thud, BS.thudVolume * k, BS.thudRate * jitter(0.05));
  });
  game.events.on('bossPhase', () => audio.play(BS.roar, BS.roarVolume, BS.roarRate));
  game.events.on('bossKilled', () => audio.play(BS.death, BS.deathVolume, BS.deathRate));
  // L'Abbé répand son vin ; la porte du patron s'ouvre ; victoire
  game.events.on('winePoured', () => audio.play(BS.pour, BS.pourVolume, BS.pourRate * jitter(0.06)));
  game.events.on('doorOpened', () => { audio.play(BS.door, BS.doorVolume, BS.doorRate); audio.play(BS.bell, BS.bellVolume, BS.bellRate * 0.8); });
  game.events.on('doorBusy', () => audio.play(AUDIO.chest.deny, AUDIO.chest.denyVolume, AUDIO.chest.denyRate, 0, 'ui'));
  game.events.on('victory', () => { for (let i = 0; i < 4; i++) setTimeout(() => audio.play(BS.bell, BS.bellVolume, 0.8 + i * 0.15, 0, 'ui'), i * 260); });
  // Élites
  // Fermeture : le glas, puis chaque Mort qui sort de terre et chaque coup de faux
  const CL = AUDIO.closing;
  game.events.on('closingStarted', () => { for (let i = 0; i < CL.count; i++) setTimeout(() => audio.play(CL.toll, CL.tollVolume, CL.tollRate, 0, 'ui'), i * CL.gap * 1000); });
  game.events.on('reaperSpawned', ({ reaper }) => { const k = Math.max(0.3, near(reaper.pos, CL.hearDist)); audio.play(CL.spawn, CL.spawnVolume * k, CL.spawnRate * jitter(0.05)); });
  game.events.on('reaperSwing', ({ reaper }) => { const k = near(reaper.pos, CL.hearDist); if (k > 0) audio.whoosh(CL.swingVolume * k); });
  game.events.on('eliteSpawned', ({ zombie }) => {
    const E = AUDIO.elite, k = near(zombie.pos, E.hearDist);
    if (k > 0) audio.play(E.spawn, E.spawnVolume * k, E.spawnRate * jitter(0.05));
  });
  game.events.on('eliteKilled', ({ chest }) => { if (chest) audio.play(AUDIO.elite.chest, AUDIO.elite.chestVolume, AUDIO.elite.chestRate, 0, 'ui'); });
  // Tournées du bar
  game.events.on('tourneeTaken', () => {
    const T = AUDIO.tournee;
    audio.play(T.sample, T.volume, T.rate * jitter(0.05), 0, 'ui');
    setTimeout(() => audio.play(T.bubble, T.bubbleVolume, jitter(0.08), 0, 'ui'), 90);
  });
  game.events.on('tourneeEnded', () => audio.play(AUDIO.tournee.end, AUDIO.tournee.endVolume, AUDIO.tournee.endRate, 0, 'ui'));
  // Dernier service : la cloche sonne trois fois
  game.events.on('lastCallRung', () => {
    const C = AUDIO.lastCall;
    for (let i = 0; i < C.count; i++) setTimeout(() => audio.play(C.sample, C.volume, C.rate + C.step * i, 0, 'ui'), i * C.gap * 1000);
  });
  // Poubelle cassée : tôle qui claque ; snack mangé : croquant
  game.events.on('binBroken', ({ bin }) => {
    const B = AUDIO.bin, k = near(bin.pos, B.hearDist);
    if (k > 0) audio.play(B.sample, B.volume * k, B.rate * jitter(0.08));
  });
  game.events.on('snackEaten', () => audio.play(AUDIO.snack.sample, AUDIO.snack.volume, AUDIO.snack.rate * jitter(0.06), 0, 'ui'));
  game.events.on('chestDenied', () => audio.play(AUDIO.chest.deny, AUDIO.chest.denyVolume, AUDIO.chest.denyRate, 0, 'ui'));
  // Capsule ramassée : tintement de métal aigu
  let lastCoin = -1;
  game.events.on('coinsCollected', () => {
    const C = AUDIO.coin, now = performance.now() / 1000;
    if (now - lastCoin < C.minGap) return;
    lastCoin = now;
    audio.play(C.sample, C.volume, C.rate * jitter(0.06), 0, 'ui');
  });
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
  // Objets à effet
  const I = AUDIO.items;
  game.events.on('itemExploded', ({ at }) => {
    const k = near(at, I.ash.hearDist);
    if (k > 0) audio.play(I.ash.sample, I.ash.volume * k, I.ash.rate * jitter(0.1));
  });
  game.events.on('foamShieldUp', () => audio.play(I.foamUp.sample, I.foamUp.volume, I.foamUp.rate * jitter(0.05)));
  game.events.on('foamShieldPopped', () => audio.play(I.foamPop.sample, I.foamPop.volume, I.foamPop.rate * jitter(0.05)));
  game.events.on('happyHourStarted', () => audio.play(I.happyHour.sample, I.happyHour.volume, I.happyHour.rate, 0, 'ui'));
  let lastFreeze = 0;
  game.events.on('zombieFrozen', ({ zombie }) => {
    const now = performance.now() / 1000, k = near(zombie.pos);
    if (k <= 0 || now - lastFreeze < I.freeze.minGap) return;
    lastFreeze = now;
    audio.play(I.freeze.sample, I.freeze.volume * k, I.freeze.rate * jitter(0.1));
  });
  game.events.on('whistleBlown', () => audio.play(I.whistle.sample, I.whistle.volume, I.whistle.rate));
  game.events.on('shockwave', () => audio.play(I.shockwave.sample, I.shockwave.volume, I.shockwave.rate * jitter(0.05)));
  game.events.on('playerDodged', () => audio.whoosh(I.dodge.volume));
  game.events.on('revived', () => audio.play(I.revive.sample, I.revive.volume, I.revive.rate, 0, 'ui'));
  game.events.on('freeChestSpawned', () => audio.play(I.freeChest.sample, I.freeChest.volume, I.freeChest.rate));
  // La Gueuze explose : verre qui éclate et souffle sourd
  game.events.on('weaponExploded', ({ pos }) => {
    const S = GUEUZE_BLAST.sound, k = near(pos, S.hearDist);
    if (k <= 0) return;
    audio.play(S.glass, S.glassVolume * k, jitter(0.08));
    audio.play(S.boom, S.boomVolume * k, S.boomPitch * jitter(0.08));
  });
  // Pompe à bière : la bière coule tant que le joueur remplit la pinte ; un tintement quand elle est pleine
  let stopPour: ((fade?: number) => void) | null = null;
  game.events.on('tick', () => {
    const pouring = game.pumps.filling && !game.frozen;
    if (pouring && !stopPour) {
      // Repris où en est la pinte : le son suit le niveau de bière
      const offset = (game.pumps.focus?.fill ?? 0) * PUMPS.fillTime;
      stopPour = audio.play(AUDIO.pump.pour, AUDIO.pump.pourVolume, 1, 0, 'fx', offset);
    } else if (!pouring && stopPour) {
      stopPour(AUDIO.pump.fade);
      stopPour = null;
    }
  });
  game.events.on('pumpFilled', () => audio.play(AUDIO.pump.full, AUDIO.pump.fullVolume, AUDIO.pump.fullRate, 0, 'ui'));
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
  // Carte choisie : « tchin », deux verres qui trinquent
  game.events.on('cardPicked', () => {
    for (const c of AUDIO.cards.pick) window.setTimeout(() => audio.play(c.sample, c.volume, c.rate * jitter(0.03), 0, 'ui'), c.delay * 1000);
  });
}

/** Musique : celle de la map pendant la run, en retrait pendant l'écran de mort, celle du menu à l'accueil. */
export function wireMusic(game: Game, audio: AudioEngine, music: ReturnType<typeof createMusic>, map: string) {
  const volume = (k: number, tc: number) => {
    if (audio.ctx && audio.music) audio.music.gain.setTargetAtTime(AUDIO.music.volume * k, audio.ctx.currentTime, tc);
  };
  game.events.on('runStarted', () => music.startRun(map));
  game.events.on('died', () => volume(DEATH_BANNER.musicDuck, 0.6));
  game.events.on('home', () => { volume(1, 0.4); music.endRun(); });
  // Boss : sa musique tant qu'il est debout
  game.events.on('bossSpawned', ({ boss }) => music.startBoss(boss.music));
  game.events.on('bossKilled', () => music.endBoss());
  game.events.on('died', () => { if (music.boss) music.endBoss(); });
}
