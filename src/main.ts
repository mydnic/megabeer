import * as THREE from 'three';
import { CAMERA, PLANET_RADIUS } from './config/world';
import { loadZombieLibrary } from './enemies/zombie';
import { createHorde } from './enemies/horde';
import { HIT_FEEDBACK, ZOMBIE_ATTACK } from './config/zombies';
import { Health } from './player/health';
import { PintProp } from './player/pintProp';
import { createDeathBanner } from './ui/deathBanner';
import { createHomeScreen } from './ui/homeScreen';
import { createBottles } from './weapons/bottles';
import { createBlonde } from './weapons/blonde';
import { createGlassShards } from './fx/glassShards';
import { createDamageNumbers } from './ui/damageNumbers';
import { createRunLog } from './dev/runLog';
import { XP_DROPS } from './config/xp';
import { Progression } from './player/progression';
import { createXpDrops } from './pickups/xpDrops';
import { createAlcoholHud } from './ui/alcoholHud';
import { createLevelUpScreen } from './ui/levelUpScreen';
import { applyCard, rollCards } from './game/levelUpCards';
import { LEVEL_UP_SCREEN, RARITIES } from './config/upgrades';
import { WEAPONS } from './config/weapons';
import { ZOMBIE_STATS } from './config/zombies';
import { ARRIVAL, DEATH_BANNER, PLAYER_STATS } from './config/player';
import { DEATH } from './config/buveur';
import type { InputState } from './core/input';
import { createHealthHud } from './ui/healthHud';
import { initInput, readInput } from './core/input';
import { BuveurVisual } from './player/buveurVisual';
import { CameraRig } from './player/cameraRig';
import { PlayerController } from './player/controller';
import { Pipeline } from './render/pipeline';
import { createSky } from './world/sky';
import { createClouds } from './world/clouds';
import { buildTerrain, buildTerrainSteps, heightAt, setTerrainSeed } from './world/terrain';
import { LOADING } from './config/hud';
import { createLoadingScreen } from './ui/loadingScreen';
import { createDecor } from './world/decor';
import { AudioEngine } from './audio/audio';
import { createAmbience } from './audio/ambience';
import { createMusic } from './audio/music';
import { loadSettings, saveSettings } from './core/settings';
import { createOptionsPanel } from './ui/optionsPanel';
import { createPauseMenu, type PauseStats, type StatGroup } from './ui/pauseMenu';
import { WEAPON_HUD } from './config/hud';
import { createRunHud } from './ui/runHud';
import { createWeaponHud, type WeaponSlot } from './ui/weaponHud';
import { blondeIcon } from './ui/icons';
import { AUDIO } from './config/audio';

// --- Rendu
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false; // compte toutes les passes de la frame
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, 0.1, 1200);
const pipeline = new Pipeline(renderer, scene, camera);
pipeline.setSize(innerWidth, innerHeight);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  pipeline.setSize(innerWidth, innerHeight);
});

// --- Monde : une nouvelle planète à chaque run (relief, abbayes et décor tirés d'une seed)
const newSeed = () => Math.floor(Math.random() * 0x7fffffff);
let mapSeed = newSeed();
setTerrainSeed(mapSeed);
let terrain = buildTerrain();
scene.add(terrain);
const sky = createSky(scene);

const clouds = createClouds(scene);

// Décor de l'Abbaye (modèles, collisions, lanternes)
const decor = await createDecor(scene);
decor.generate(mapSeed);
/** La planète générée n'a pas encore servi (la première run la prend telle quelle). */
let mapFresh = true;
const loading = createLoadingScreen();
/**
 * Génère une nouvelle planète par petits morceaux : quelques dizaines de ms de calcul par image,
 * puis la main est rendue à l'écran pour que la barre de chargement avance vraiment.
 */
async function newPlanet(progress: (k: number) => void) {
  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  /** Fait tourner un générateur d'étapes ; son avancement (0 à 1) est ramené dans [from, to]. */
  async function run<T>(steps: Generator<number, T>, from: number, to: number): Promise<T> {
    let t0 = performance.now();
    for (;;) {
      const r = steps.next();
      if (r.done) return r.value;
      if (performance.now() - t0 > LOADING.frameBudgetMs) {
        progress(from + (to - from) * r.value);
        await nextFrame();
        t0 = performance.now();
      }
    }
  }
  mapSeed = newSeed();
  progress(0); await nextFrame();
  setTerrainSeed(mapSeed);
  const t = await run(buildTerrainSteps(), 0.02, 0.72);
  scene.remove(terrain);
  terrain.geometry.dispose();
  (terrain.material as THREE.Material).dispose();
  terrain = t;
  scene.add(terrain);
  await run(decor.generateSteps(mapSeed), 0.72, 1);
  progress(1); await nextFrame();
}

// --- Joueur
const player = new PlayerController(decor.spawn.dir);
player.decor = decor.collider;
player.facing.copy(decor.spawn.facing);
player.camFwd.copy(decor.spawn.facing);
player.interpolate(1);
const buveur = new BuveurVisual(scene);

// --- Zombies (provisoire : 4 zombies devant le joueur au départ, en attendant le spawn des vagues)
const horde = createHorde(scene, await loadZombieLibrary(), player, decor.collider);
function spawnStartZombies() {
  const up = player.pos.clone().normalize();
  const fwd = player.facing.clone();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const models = ['basic', 'chubby', 'arm', 'ribcage'] as const;
  models.forEach((m, i) => {
    const p = up.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(fwd, 7 + (i % 2) * 1.5).addScaledVector(right, (i - 1.5) * 1.6);
    horde.spawn(m, p, fwd.clone().negate());
  });
}

// --- Sons (démarrent au premier clic ou à la première touche)
const audio = new AudioEngine();
const settings = loadSettings();
for (const ch of ['music', 'fx', 'ui'] as const) audio.setUserVolume(ch, settings.volume[ch]);
const options = createOptionsPanel(settings, (ch, v) => audio.setUserVolume(ch, v), () => saveSettings(settings));
const ambience = createAmbience(audio);
const music = createMusic(audio);
const jitter = (j: number) => 1 + (Math.random() * 2 - 1) * j;
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
buveur.load().catch((e) => console.error(e));

// --- Journal de run (dev) : tout est noté pour analyser l'équilibrage
const runLog = createRunLog();
{
  const rawSpawn = horde.spawn;
  horde.spawn = (model, dir, facing) => { const z = rawSpawn(model, dir, facing); if (z) runLog.spawn(model); return z; };
}

// --- Coup de zombie : recul, flash, tremblement
const health = new Health();
const healthHud = createHealthHud(health);
/** Triches du panneau de dev (toujours faux dans le build final). */
const cheats = { god: false };
horde.onHit = (z, dir) => {
  if (cheats.god) return;
  // Invulnérable juste après un coup : ni dégâts ni recul (pas d'enchaînement de coups)
  const took = health.damage(ZOMBIE_ATTACK.damage);
  runLog.hurt(z.model, ZOMBIE_ATTACK.damage, health.hp, !took);
  if (!took) return;
  healthHud.hit();
  player.knock(dir, ZOMBIE_ATTACK.knockSpeed, ZOMBIE_ATTACK.knockLift, ZOMBIE_ATTACK.knockDecay);
  buveur.hurt(HIT_FEEDBACK.flashColor, HIT_FEEDBACK.flashTime);
  rig.shake(HIT_FEEDBACK.shake, HIT_FEEDBACK.shakeAmplitude, HIT_FEEDBACK.shakeDecay);
};
const rig = new CameraRig(camera);
initInput(renderer.domElement);

// --- Mort : la pinte s'échappe, ralenti, caméra qui plonge sur le corps, zombies autour
const pint = new PintProp(scene, { verre: new THREE.Color(), biere: new THREE.Color(), mousse: new THREE.Color() }, (p, r) => player.supportAt(p, r));
let pintFirstImpact = true;
pint.onImpact = (p, speed) => {
  if (pintFirstImpact) buveur.splashAt(p, DEATH.pint.splashCount);
  pintFirstImpact = false;
  audio.play(speed > 3 ? 'impactGlass_medium' : 'impactGlass_light', Math.min(0.6, 0.15 + speed * 0.06), jitter(0.08));
};
// --- Stats du joueur modifiables en run (objets, level-up) : départ = valeurs du Buveur
const playerStats = {
  attackSpeed: PLAYER_STATS.attackSpeed as number,
  extraProjectiles: PLAYER_STATS.extraProjectiles as number,
  pickupRange: XP_DROPS.pickupRange as number,
  xpGain: 1,
  luck: 0,
};
// --- XP : gouttes de bière, alcoolémie, degré
const progression = new Progression();
const alcoholHud = createAlcoholHud(progression);
const xpDrops = createXpDrops(scene, (p) => player.supportAt(p, p.length()));
const chest = new THREE.Vector3();
/** Son de ramassage : une bulle, de plus en plus aiguë quand on en avale plusieurs à la suite. */
let lastPickup = -1, pickupCombo = 0;
function playPickup() {
  const P = AUDIO.pickup, now = performance.now() / 1000;
  if (now - lastPickup < P.minGap) return;
  pickupCombo = now - lastPickup > P.comboReset ? 0 : pickupCombo + 1;
  lastPickup = now;
  audio.play(P.sample, P.volume, Math.min(P.pitchMax, 1 + pickupCombo * P.pitchStep) * jitter(0.04));
}
// --- Level-up : pause et 3 cartes (améliorations de la Blonde, avec rareté)
const levelUp = createLevelUpScreen((card) => {
  audio.play(AUDIO.cards.pick, AUDIO.cards.pickVolume, jitter(0.03), 0, 'ui');
  applyCard(card, blonde.mods);
  progression.pending--;
  runLog.event('cardPicked', card.upgrade.id, RARITIES[card.tier].id, blonde.mods.level);
  if (progression.pending > 0) openLevelUp();
  else renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
}, () => audio.play(AUDIO.cards.hover, AUDIO.cards.hoverVolume, jitter(0.05), 0, 'ui'));
function openLevelUp() {
  const cards = rollCards(LEVEL_UP_SCREEN.cards, playerStats.luck);
  runLog.event('cardsOffered', ...cards.map((c) => `:${RARITIES[c.tier].id}`));
  levelUp.show(progression.level - progression.pending + 1, cards);
}
// --- Arme de départ : la Blonde
const bottles = await createBottles(scene);
const blonde = createBlonde({
  bottles,
  zombies: () => horde.zombies,
  playerPos: () => player.pos,
  gesture: (rate) => buveur.throwGesture(rate),
  handPos: (out) => buveur.leftHandPos(out),
  stats: () => playerStats,
  groundAt: (p) => player.supportAt(p, p.length()),
  onGround: (p, v) => {
    buveur.splashAt(p, 10);
    shards.burst(p, hitDir.copy(v).normalize().multiplyScalar(0.3));
  },
  onHitZombie: (z, p, v, damage, crit) => {
    // Direction du coup dans le plan du sol (le zombie recule dans le sens de la bouteille)
    const up = hitUp.copy(z.pos).normalize();
    hitDir.copy(v).addScaledVector(up, -v.dot(up)).normalize();
    const killed = z.damage(damage, hitDir);
    runLog.hit('blonde', z.model, damage, z.hp, crit);
    if (killed) { runKills++; runLog.kill('blonde', z.model); xpDrops.drop(z.pos, XP_DROPS.perZombie); }
    buveur.splashAt(p, 14);
    shards.burst(p, hitDir);
    damageNumbers.spawn(hitPos.copy(z.pos).addScaledVector(up, 2.0), damage, crit);
  },
});
const hitDir = new THREE.Vector3(), hitUp = new THREE.Vector3(), hitPos = new THREE.Vector3();
const shards = createGlassShards(scene, (p) => player.supportAt(p, p.length()));
const damageNumbers = createDamageNumbers(camera);
let runKills = 0;
const runHud = createRunHud();
runHud.setVisible(false);
const weaponHud = createWeaponHud();
weaponHud.setVisible(false);
/** Armes équipées, dans l'ordre d'obtention (la Blonde est l'arme de départ). */
const equipped: WeaponSlot[] = [{ id: 'blonde', icon: blondeIcon('wpn-icon'), level: 1 }];

const deathBanner = createDeathBanner(() => goHome());
let deadSince = -1; // temps réel écoulé depuis la mort (-1 : vivant)
let runTime = 0;    // durée de la run en cours (s de jeu)
/** Accueil (le monde tourne en fond), run en cours, ou mort (bandeau puis bilan). */
let phase: 'home' | 'run' | 'dead' = 'home';
const home = createHomeScreen(() => startRun(), () => options.show(() => home.focus()));

// --- Pause (Échap en run, ou perte du curseur verrouillé) : monde figé
const pause = createPauseMenu({
  resume: () => resumeRun(),
  options: () => options.show(() => pause.focus()),
  quit: () => {
    runLog.end('abandon', { survived: runTime, kills: runKills });
    goHome();
  },
  stats: () => statGroups(),
});
/** Stats affichées dans la pause : valeur effective et bonus gagné pendant la run. */
function statGroups(): PauseStats {
  const f = (n: number, dec = 1) => n.toLocaleString('fr', { maximumFractionDigits: dec });
  const pct = (k: number) => (Math.abs(k) < 0.005 ? '' : `${k > 0 ? '+' : ''}${Math.round(k * 100)} %`);
  const plus = (n: number, dec = 2) => (n ? `+${f(n, dec)}` : '');
  const s = playerStats, m = blonde.mods, W = WEAPONS.blonde;
  const player: StatGroup = { title: 'Le Buveur', rows: [
    ['PV', `${Math.ceil(health.hp)} / ${health.max}`, ''],
    ["Vitesse d'attaque", `x${f(s.attackSpeed, 2)}`, pct(s.attackSpeed - 1)],
    ['Projectiles en plus', String(s.extraProjectiles), plus(s.extraProjectiles)],
    ['Ramassage', `${f(s.pickupRange)} m`, pct(s.pickupRange / XP_DROPS.pickupRange - 1)],
    ["Gain d'XP", `x${f(s.xpGain, 2)}`, pct(s.xpGain - 1)],
    ['Chance', String(s.luck), plus(s.luck)],
  ] };
  const blondeStats: StatGroup = { title: 'Blonde', icon: blondeIcon(''), level: m.level, rows: [
    ['Dégâts', f(W.damage * m.damage), pct(m.damage - 1)],
    ["Vitesse d'attaque", `${f(s.attackSpeed * m.rate / W.cooldown, 2)} / s`, pct(m.rate - 1)],
    ['Projectiles', String(1 + s.extraProjectiles + m.projectiles), plus(m.projectiles)],
    ['Vitesse des projectiles', `${f(W.speed * m.speed)} m/s`, pct(m.speed - 1)],
    ['Portée', `${f(W.range * m.range)} m`, pct(m.range - 1)],
    ['Chances de critique', `${f((W.critChance + m.critChance) * 100)} %`, pct(m.critChance)],
    ['Multiplicateur critique', `x${f(W.critMult + m.critMult, 2)}`, plus(m.critMult)],
    ['Taille', `${f(m.size * 100, 0)} %`, pct(m.size - 1)],
  ] };
  const byId: Record<string, StatGroup> = { blonde: blondeStats };
  const weapons = Array.from({ length: WEAPON_HUD.slots }, (_, i) => (equipped[i] ? byId[equipped[i].id] ?? null : null));
  return { player, weapons };
}
let pausedAt = 0;
function pauseRun() {
  if (phase !== 'run' || pause.open || levelUp.open) return;
  pause.show();
  pausedAt = performance.now();
}
function resumeRun() {
  if (!pause.open) return;
  options.close();
  pause.hide();
  renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
}
// Échap libère le curseur verrouillé (le navigateur ne transmet alors pas la touche) : on met en pause
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) pauseRun(); });
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (!pause.open) pauseRun();
  // Ignore l'Échap qui vient d'ouvrir la pause via la perte du curseur
  else if (performance.now() - pausedAt > 300) resumeRun();
});

/** Retour à l'accueil : le monde revient à l'état de départ, sans zombies, sans recharger la page. */
function goHome() {
  phase = 'home';
  deadSince = -1;
  health.reset();
  player.reset(decor.spawn.dir, decor.spawn.facing);
  buveur.revive();
  pint.hide();
  horde.clear();
  horde.setPassive(false);
  blonde.reset();
  shards.clear();
  damageNumbers.clear();
  playerStats.attackSpeed = PLAYER_STATS.attackSpeed;
  playerStats.pickupRange = XP_DROPS.pickupRange;
  playerStats.xpGain = 1;
  progression.reset();
  levelUp.hide();
  pause.hide();
  options.close();
  playerStats.luck = 0;
  xpDrops.clear();
  alcoholHud.setVisible(false);
  playerStats.extraProjectiles = PLAYER_STATS.extraProjectiles;
  pipeline.fade.amount = 0;
  arriving = false;
  rig.setAnchor(null);
  healthHud.setVisible(false);
  runHud.setVisible(false);
  weaponHud.setVisible(false);
  deathBanner.update(-1, 0);
  if (audio.ctx && audio.music) audio.music.gain.setTargetAtTime(AUDIO.music.volume, audio.ctx.currentTime, 0.4);
  music.endRun();
  home.show();
}

// Le jeu s'ouvre sur l'accueil (le monde n'est pas rendu tant qu'on y est)
healthHud.setVisible(false);
alcoholHud.setVisible(false);
home.show();

/** Le Buveur tombe du ciel au début de la run : ni contrôle, ni tirs, ni chrono tant qu'il n'a pas atterri. */
let arriving = false;
/** Atterrissage : impact (tremblement, gerbe de bière), la caméra reprend le joueur, les zombies arrivent. */
function land() {
  arriving = false;
  rig.setAnchor(null);
  const A = ARRIVAL;
  rig.shake(A.shake.amount, A.shake.amplitude, A.shake.decay);
  buveur.splashAt(player.pos, A.splash);
  runLog.event('landed');
  spawnStartZombies();
}

/** Nouvelle run depuis l'accueil : nouvelle planète (sauf la toute première, déjà prête), puis départ. */
let starting = false;
async function startRun() {
  if (phase !== 'home' || starting) return;
  if (!mapFresh) {
    starting = true;
    home.hide();
    loading.show();
    await newPlanet(loading.progress);
    loading.hide();
    starting = false;
  }
  mapFresh = false;
  phase = 'run';
  runTime = 0;
  runKills = 0;
  home.hide();
  healthHud.setVisible(true);
  alcoholHud.setVisible(true);
  runHud.setVisible(true);
  weaponHud.setVisible(true);
  // Le Buveur arrive à un endroit tiré au hasard sur la planète
  const start = decor.randomSpawn();
  player.reset(start.dir, start.facing);
  // Arrivée : la caméra est déjà posée sur le point d'atterrissage, le Buveur tombe du ciel dedans
  rig.setFocus(null);
  rig.setAnchor(player.pos);
  rig.snap();
  player.drop(ARRIVAL.height, ARRIVAL.speed);
  arriving = true;
  runLog.start({
    character: 'buveur', map: 'abbaye', seed: mapSeed, difficulty: 'sobre',
    stats: { ...playerStats, maxHp: health.max }, weapons: { blonde: WEAPONS.blonde }, zombie: ZOMBIE_STATS,
  });
  music.startRun('abbaye');
  renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
}
function onDeath() {
  runLog.end('mort', { survived: runTime, kills: runKills });
  phase = 'dead';
  deadSince = 0;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
  buveur.die(pos, quat);
  // Pinte lancée vers le haut, un peu devant et sur sa droite, en tournant
  const up = player.upDir.clone(), fwd = player.facing.clone();
  const right = new THREE.Vector3().crossVectors(up, fwd).negate().normalize();
  const P = DEATH.pint;
  const vel = up.multiplyScalar(P.throwUp).addScaledVector(fwd, P.throwForward).addScaledVector(right, P.throwSide).add(player.velocity);
  const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(P.spin);
  pint.setColors(buveur.color('verre'), buveur.color('biere'), buveur.color('mousse'));
  pintFirstImpact = true;
  pint.launch(pos, quat, vel, spin);
  horde.setPassive(true);
  rig.setFocus(DEATH.camera);
  // Musique en retrait pendant l'écran de mort
  if (audio.ctx && audio.music) audio.music.gain.setTargetAtTime(AUDIO.music.volume * DEATH_BANNER.musicDuck, audio.ctx.currentTime, 0.6);
}
/** Vitesse du temps : ralenti juste après la mort, puis retour progressif. */
function timeScale() {
  if (deadSince < 0) return 1;
  const S = DEATH.slowMo;
  if (deadSince < S.hold) return S.scale;
  return THREE.MathUtils.lerp(S.scale, 1, Math.min(1, (deadSince - S.hold) / S.ramp));
}
/** Ralenti de développement (window.__game.setTimeScale), 1 en jeu. */
let devTimeScale = 1;
const NO_MOVE: InputState = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, mouseDX: 0, mouseDY: 0, zoom: 0, jump: false, jumpPressed: false };

// --- Debug (F3)
const debugEl = document.getElementById('debug')!;
let debugOn = import.meta.env.DEV;
addEventListener('keydown', (e) => { if (e.code === 'F3') { debugOn = !debugOn; e.preventDefault(); } });
let fpsAcc = 0, fpsN = 0, fps = 0;

// --- Boucle : physique à pas fixe, rendu à chaque frame
const STEP = 1 / 120;
let acc = 0, last = performance.now();
const focusPoint = new THREE.Vector3();

function frame(now: number) {
  const realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  renderer.info.reset();
  if (deadSince >= 0) deadSince += realDt;
  // Écran de level-up ou menu pause ouvert : le monde est figé (la caméra et l'interface continuent)
  const paused = levelUp.open || pause.open;
  const dt = paused ? 0 : realDt * timeScale() * devTimeScale;
  const input = readInput();
  // Accueil et mort : le joueur ne contrôle pas le Buveur (la caméra reste libre en jeu)
  const moveInput = phase === 'run' && !paused && !arriving ? input : NO_MOVE;
  levelUp.input(input.moveX, input.jumpPressed);
  if (phase === 'run' && !paused && progression.pending > 0) {
    audio.play(AUDIO.levelUp.sample, AUDIO.levelUp.volume, 1, 0, 'ui');
    openLevelUp();
  }
  player.feed(moveInput);
  acc += dt;
  while (acc >= STEP) { player.step(STEP, moveInput); acc -= STEP; }
  player.interpolate(acc / STEP);
  if (arriving && player.onGround) land();

  const up = player.upDir;
  buveur.update(dt, player);
  horde.update(dt);
  health.update(dt);
  healthHud.update(realDt);
  if (phase === 'run' && health.dead) onDeath();
  if (phase === 'run' && !arriving) {
    runTime += dt;
    blonde.update(dt);
    runLog.tick(dt, () => {
      let alive = 0, near5 = 0, near10 = 0;
      for (const z of horde.zombies) {
        if (z.dead) continue;
        alive++;
        const d = z.pos.distanceTo(player.pos);
        if (d < 5) near5++;
        if (d < 10) near10++;
      }
      return { hp: health.hp, level: progression.level, xp: Math.round(progression.xp), alive, near5, near10, kills: runKills, fps: Math.round(fps), atkSpd: playerStats.attackSpeed, proj: playerStats.extraProjectiles };
    });
  }
  blonde.updateBottles(dt);
  shards.update(dt);
  chest.copy(player.renderPos).addScaledVector(player.upDir, 1.0);
  xpDrops.update(dt, chest, phase === 'run' ? playerStats.pickupRange : 0, (v) => {
    const xp = v * playerStats.xpGain;
    playPickup();
    runLog.xp(xp);
    const gained = progression.add(xp);
    for (let i = 0; i < gained; i++) runLog.levelUp(progression.level - gained + 1 + i);
  });
  alcoholHud.update();
  runHud.update(runTime, runKills);
  equipped[0].level = blonde.mods.level;
  weaponHud.update(equipped);
  damageNumbers.update(realDt);
  if (phase === 'dead') deathBanner.update(deadSince, runTime, runKills);
  // Espace ou bouton A : Jouer sur l'accueil, Continuer sur le bilan de mort
  if (input.jumpPressed) {
    if (phase === 'home') { if (!options.open) startRun(); }
    else if (paused) { /* géré par l'écran de level-up */ }
    else if (phase === 'dead' && deathBanner.ready) goHome();
  }
  if (deadSince >= 0) {
    const B = DEATH_BANNER;
    pipeline.fade.amount = Math.min(1, deadSince / B.colorFade);
    pipeline.fade.saturation = B.saturation;
    pipeline.fade.vignette = B.vignette;
  }
  pint.update(dt);

  rig.update(realDt, input, player);
  sky.update(dt, player.renderPos, camera);
  clouds.update(dt);
  decor.update(dt, player.renderPos, 1 - sky.day);
  ambience.update(sky.day);
  // Mise au point de la profondeur de champ sur le perso
  pipeline.focusDistance = camera.position.distanceTo(focusPoint.copy(player.renderPos).addScaledVector(player.upDir, 1.1));
  // Accueil : écran séparé, le monde n'est pas rendu
  if (phase !== 'home') pipeline.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  debugEl.style.display = debugOn ? 'block' : 'none';
  if (debugOn) {
    debugEl.textContent = [
      `FPS ${fps.toFixed(0)}   triangles ${renderer.info.render.triangles.toLocaleString('fr')}`,
      `Altitude ${heightAt(up).toFixed(1)}   au sol ${player.onGround ? 'oui' : 'non'}`,
      'ZQSD bouger, Espace sauter, souris caméra (clic), molette zoom, F3 masquer',
    ].join('\n');
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  Object.assign(window, { __game: { player, rig, camera, buveur, sky, heightAt, THREE, pipeline, renderer, decor, scene, music, horde, health, blonde, bottles, playerStats, progression, setTimeScale: (k: number) => { devTimeScale = k; } } });
  // Panneau admin : chaque action est notée dans le journal de run (run "trichée")
  const { createDevPanel } = await import('./dev/devPanel');
  const models = ['basic', 'chubby', 'arm', 'ribcage'] as const;
  const gainXp = (xp: number) => {
    const gained = progression.add(xp);
    for (let i = 0; i < gained; i++) runLog.levelUp(progression.level - gained + 1 + i);
  };
  createDevPanel({
    models,
    cheats,
    spawn(model, n, rMin, rMax) {
      if (phase !== 'run') return;
      const up = player.pos.clone().normalize();
      const a = new THREE.Vector3().crossVectors(up, player.facing).normalize(), b = player.facing.clone();
      for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
        const p = player.pos.clone().addScaledVector(a, Math.cos(t) * r).addScaledVector(b, Math.sin(t) * r);
        horde.spawn(model === 'mix' ? models[i % models.length] : model as typeof models[number], p, player.pos.clone().sub(p));
      }
      runLog.event('dev', 'spawn', model, n);
    },
    killAll(withXp) {
      if (phase !== 'run') return;
      for (const z of horde.zombies) {
        if (z.dead) continue;
        hitDir.copy(z.pos).sub(player.pos).normalize();
        z.damage(z.hp + 1, hitDir);
        runKills++;
        if (withXp) xpDrops.drop(z.pos, XP_DROPS.perZombie);
      }
      runLog.event('dev', 'killAll');
    },
    clearZombies() { if (phase === 'run') { horde.clear(); runLog.event('dev', 'clear'); } },
    setPassive(v) { if (phase === 'run') { horde.setPassive(v); runLog.event('dev', 'passive', v ? 1 : 0); } },
    giveXp(xp) { if (phase === 'run') { gainXp(xp); runLog.event('dev', 'xp', xp); } },
    levelUp() { if (phase === 'run') { gainXp(Math.max(1, progression.next - progression.xp)); runLog.event('dev', 'level'); } },
    heal() { if (phase === 'run') { health.reset(); runLog.event('dev', 'heal'); } },
    die() { if (phase === 'run') { health.invuln = 0; health.damage(health.hp); runLog.event('dev', 'die'); } },
    toggleCombatMusic() {
      if (music.boss) music.endBoss();
      else if (phase === 'run') music.startBoss('test');
      return music.boss ? 'boss' : 'run';
    },
    inRun: () => phase === 'run',
    setTimeScale(k) { devTimeScale = k; },
    status() {
      let alive = 0;
      for (const z of horde.zombies) if (!z.dead) alive++;
      return `${phase} | seed ${mapSeed} | ${alive} zombies | niv ${progression.level} | ${Math.round(health.hp)} PV${cheats.god ? ' | GOD' : ''}`;
    },
  });
}
