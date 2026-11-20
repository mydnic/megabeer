import { CANETTE_IMPACT, FUT_SOUND, GUEUZE_BLAST } from '../config/weapons';
import { RADIO, RADIO_LOOK } from '../config/radio';
import { createVehicleEngine } from '../audio/vehicleEngine';
import { VEHICLES } from '../config/vehicles';
import { WEAPON_FX } from '../config/weaponFx';
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
  // Moteur du véhicule conduit : il démarre en montant, suit la vitesse, se coupe en descendant
  const motor = createVehicleEngine(audio);
  game.events.on('vehicleEntered', ({ kind }) => motor.start(kind));
  game.events.on('vehicleExited', () => motor.stop());
  game.events.on('tick', () => {
    const v = game.vehicles.driving;
    if (v) motor.update(Math.abs(game.player.carSpeed) / VEHICLES[v.kind].car.maxSpeed);
  });
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
  // L'Abbé répand son vin ; la porte du patron s'ouvre ; l'Abbé tombe (carillon)
  game.events.on('winePoured', () => audio.play(BS.pour, BS.pourVolume, BS.pourRate * jitter(0.06)));
  game.events.on('doorOpened', () => { audio.play(BS.door, BS.doorVolume, BS.doorRate); audio.play(BS.bell, BS.bellVolume, BS.bellRate * 0.8); });
  game.events.on('bossKilled', ({ boss }) => { if (boss.kind === 'abbe') for (let i = 0; i < 4; i++) setTimeout(() => audio.play(BS.bell, BS.bellVolume, 0.8 + i * 0.15, 0, 'ui'), i * 260); });
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
  // Liasse de TUNAS ramassée : froissement
  let lastTuna = -1;
  game.events.on('tunasCollected', ({ amount }) => {
    const T = AUDIO.tunas, now = performance.now() / 1000;
    if (now - lastTuna < T.minGap) return;
    lastTuna = now;
    audio.play(T.sample, T.volume, (amount > 1 ? T.bigRate : T.rate) * jitter(0.06), 0, 'ui');
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
  // Son au coup propre à chaque arme (config/weaponFx.ts), espacé pour celles qui touchent beaucoup de zombies d'un coup
  const lastHit = new Map<string, number>();
  game.events.on('zombieHit', ({ weapon }) => {
    const H = weapon && WEAPON_FX[weapon.id].hitSound;
    if (!H) return;
    const now = performance.now() / 1000;
    if (H.gap && now - (lastHit.get(weapon.id) ?? -1) < H.gap) return;
    lastHit.set(weapon.id, now);
    audio.play(H.sample, H.volume, H.pitch * jitter(0.08));
  });
  // Le Fût qui roule éclate au bout de sa course
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
  game.events.on('vehicleEntered', () => audio.play(I.vehicleIn.sample, I.vehicleIn.volume, I.vehicleIn.rate));
  let lastCrush = 0;
  game.events.on('vehicleCrushed', () => {
    const now = performance.now() / 1000;
    if (now - lastCrush < I.vehicleCrush.minGap) return;
    lastCrush = now;
    audio.play(I.vehicleCrush.sample, I.vehicleCrush.volume, I.vehicleCrush.rate * jitter(0.1));
  });
  game.events.on('vehicleHit', () => audio.play(I.vehicleHit.sample, I.vehicleHit.volume, I.vehicleHit.rate * jitter(0.08)));
  game.events.on('allyJoined', () => audio.play(I.allyJoin.sample, I.allyJoin.volume, I.allyJoin.rate, 0, 'ui'));
  game.events.on('allyPower', ({ kind }) => { const S = I.allyPower[kind]; audio.play(S.sample, S.volume, S.rate * jitter(0.06)); });
  game.events.on('tntExploded', () => audio.play(I.tntBoom.sample, I.tntBoom.volume, I.tntBoom.rate * jitter(0.08)));
  game.events.on('saberStrike', ({ hit }) => audio.play(I.saberStrike.sample, hit ? I.saberStrike.hitVolume : I.saberStrike.volume, I.saberStrike.rate * jitter(0.05)));
  game.events.on('logenCharge', () => audio.play(I.logenCharge.sample, I.logenCharge.volume, I.logenCharge.rate * jitter(0.05)));
  game.events.on('xenoLeap', () => audio.play(I.xenoLeap.sample, I.xenoLeap.volume, I.xenoLeap.rate * jitter(0.05)));
  game.events.on('xenoLand', () => audio.play(I.xenoLand.sample, I.xenoLand.volume, I.xenoLand.rate * jitter(0.05)));
  game.events.on('xenoTail', () => audio.play(I.xenoTail.sample, I.xenoTail.volume, I.xenoTail.rate * jitter(0.05)));
  game.events.on('logenSpin', () => audio.play(I.logenSpin.sample, I.logenSpin.volume, I.logenSpin.rate * jitter(0.05)));
  game.events.on('saberThrown', () => audio.play(I.saberThrow.sample, I.saberThrow.volume, I.saberThrow.rate * jitter(0.05)));
  game.events.on('saberCaught', () => audio.play(I.saberCatch.sample, I.saberCatch.volume, I.saberCatch.rate * jitter(0.05)));
  game.events.on('senzuEaten', () => audio.play(I.senzu.sample, I.senzu.volume, I.senzu.rate, 0, 'ui'));
  game.events.on('saiyanTierReached', () => audio.play(I.saiyanReady.sample, I.saiyanReady.volume, I.saiyanReady.rate));
  // Aura du Super Saiyan : le son tourne en boucle jusqu'à la fin de la transformation (ou de la run)
  let auraSound: ((fade?: number) => void) | null = null;
  const stopAura = () => { auraSound?.(I.saiyanTransform.fade); auraSound = null; };
  game.events.on('saiyanTransformed', () => {
    stopAura();
    auraSound = audio.play(I.saiyanTransform.sample, I.saiyanTransform.volume, I.saiyanTransform.rate, 0, 'fx', 0, true);
    audio.whoosh(0.8);
  });
  game.events.on('died', stopAura);
  game.events.on('home', stopAura);
  game.events.on('runEnded', stopAura);
  game.events.on('saiyanLightning', () => audio.play(I.saiyanLightning.sample, I.saiyanLightning.volume, I.saiyanLightning.rate * jitter(0.1)));
  game.events.on('saiyanEnded', () => { stopAura(); audio.play(I.saiyanEnd.sample, I.saiyanEnd.volume, I.saiyanEnd.rate); });
  game.events.on('tankFired', () => audio.play(I.tankFire.sample, I.tankFire.volume, I.tankFire.rate * jitter(0.06)));
  game.events.on('tankShellExploded', () => audio.play(I.tankBoom.sample, I.tankBoom.volume, I.tankBoom.rate * jitter(0.08)));
  game.events.on('vehicleExited', () => audio.play(I.vehicleOut.sample, I.vehicleOut.volume, I.vehicleOut.rate));
  game.events.on('enemyShotBlocked', () => audio.play(I.shotBlocked.sample, I.shotBlocked.volume, I.shotBlocked.rate * jitter(0.06)));
  game.events.on('revived', () => audio.play(I.revive.sample, I.revive.volume, I.revive.rate, 0, 'ui'));
  game.events.on('freeChestSpawned', () => audio.play(I.freeChest.sample, I.freeChest.volume, I.freeChest.rate));
  // La Gueuze explose : verre qui éclate et souffle sourd
  game.events.on('weaponExploded', ({ weapon, pos }) => {
    const S = GUEUZE_BLAST.sound, k = near(pos, S.hearDist);
    if (k <= 0) return;
    // Son propre à l'arme (config/weaponFx.ts), sinon celui de la Gueuze
    const own = WEAPON_FX[weapon.id].blast?.sound;
    if (own) { audio.play(own.sample, own.volume * k, own.pitch * jitter(0.08)); return; }
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
  // Radio planquée : le flux radio.mydnic.be, plus fort près du poste ; la musique du jeu se tait pendant ce temps.
  // Simple lecteur audio, hors Web Audio : un flux d'un autre site sans en-têtes CORS y serait muet.
  let radioEl: HTMLAudioElement | null = null;
  const stopRadio = () => {
    if (!radioEl) return;
    radioEl.pause();
    radioEl.src = '';
    radioEl = null;
    music.setMuted(false);
  };
  game.events.on('radioOn', () => {
    stopRadio();
    radioEl = new Audio(RADIO.stream);
    radioEl.volume = 0;
    void radioEl.play().catch(() => {});
    music.setMuted(true);
  });
  game.events.on('radioBroken', stopRadio);
  game.events.on('died', stopRadio);
  game.events.on('home', stopRadio);
  game.events.on('runEnded', stopRadio);
  game.events.on('tick', () => {
    const r = game.radio.pos;
    if (!radioEl || !r) return;
    const d = r.distanceTo(game.player.pos), Lk = RADIO_LOOK;
    const k = 1 - Math.min(1, Math.max(0, (d - Lk.fullAt) / (Lk.silentAt - Lk.fullAt)));
    radioEl.volume = Math.min(1, Lk.volume * k * audio.userVolume('music'));
  });
  const I = AUDIO.items;
  game.events.on('radioHit', () => audio.play(I.radioHit.sample, I.radioHit.volume, I.radioHit.rate * jitter(0.1)));
  game.events.on('radioBroken', () => audio.play(I.radioBroken.sample, I.radioBroken.volume, I.radioBroken.rate));
  game.events.on('runStarted', () => music.startRun(map));
  game.events.on('died', () => volume(DEATH_BANNER.musicDuck, 0.6));
  game.events.on('home', () => { volume(1, 0.4); music.endRun(); });
  // Boss : sa musique tant qu'il est debout
  // Plusieurs boss debout : la musique du premier arrivé, jusqu'à la chute du dernier
  game.events.on('bossSpawned', ({ boss }) => { if (!music.boss) music.startBoss(boss.music); });
  game.events.on('bossKilled', () => { if (!game.bosses.length) music.endBoss(); });
  game.events.on('died', () => { if (music.boss) music.endBoss(); });
}
