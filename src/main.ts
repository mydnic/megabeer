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
import { DEATH_BANNER, HOME_CAMERA, PLAYER_STATS } from './config/player';
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
import { buildTerrain, heightAt } from './world/terrain';
import { createDecor } from './world/decor';
import { AudioEngine } from './audio/audio';
import { createAmbience } from './audio/ambience';
import { createMusic } from './audio/music';
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

// --- Monde
const terrain = buildTerrain();
scene.add(terrain);
const sky = createSky(scene);

const clouds = createClouds(scene);

// --- Joueur
// Décor de l'Abbaye (modèles, collisions, lanternes) ; le joueur part du parvis, face à la porte
const decor = await createDecor(scene);
const player = new PlayerController(decor.spawn.dir);
player.decor = decor.collider;
player.facing.copy(decor.spawn.facing);
player.camFwd.copy(decor.spawn.facing);
player.interpolate(1);
const buveur = new BuveurVisual(scene);

// --- Zombies (provisoire : 4 zombies sur le parvis, en attendant le spawn des vagues)
const horde = createHorde(scene, await loadZombieLibrary(), player, decor.collider);
function spawnStartZombies() {
  const up = decor.spawn.dir.clone().normalize();
  const fwd = decor.spawn.facing.clone();
  const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
  const models = ['basic', 'chubby', 'arm', 'ribcage'] as const;
  models.forEach((m, i) => {
    const p = up.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(fwd, 7 + (i % 2) * 1.5).addScaledVector(right, (i - 1.5) * 1.6);
    horde.spawn(m, p, fwd.clone().negate());
  });
}

// --- Sons (démarrent au premier clic ou à la première touche)
const audio = new AudioEngine();
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

// --- Coup de zombie : recul, flash, tremblement
const health = new Health();
const healthHud = createHealthHud(health);
horde.onHit = (_z, dir) => {
  // Invulnérable juste après un coup : ni dégâts ni recul (pas d'enchaînement de coups)
  if (!health.damage(ZOMBIE_ATTACK.damage)) return;
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
const playerStats = { attackSpeed: PLAYER_STATS.attackSpeed as number, extraProjectiles: PLAYER_STATS.extraProjectiles as number };
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
  onHitZombie: (z, p, v, damage) => {
    // Direction du coup dans le plan du sol (le zombie recule dans le sens de la bouteille)
    const up = hitUp.copy(z.pos).normalize();
    hitDir.copy(v).addScaledVector(up, -v.dot(up)).normalize();
    if (z.damage(damage, hitDir)) runKills++;
    buveur.splashAt(p, 14);
    shards.burst(p, hitDir);
    damageNumbers.spawn(hitPos.copy(z.pos).addScaledVector(up, 2.0), damage);
  },
});
const hitDir = new THREE.Vector3(), hitUp = new THREE.Vector3(), hitPos = new THREE.Vector3();
const shards = createGlassShards(scene, (p) => player.supportAt(p, p.length()));
const damageNumbers = createDamageNumbers(camera);
let runKills = 0;

const deathBanner = createDeathBanner(() => goHome());
let deadSince = -1; // temps réel écoulé depuis la mort (-1 : vivant)
let runTime = 0;    // durée de la run en cours (s de jeu)
/** Accueil (le monde tourne en fond), run en cours, ou mort (bandeau puis bilan). */
let phase: 'home' | 'run' | 'dead' = 'home';
const home = createHomeScreen(() => startRun());

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
  playerStats.extraProjectiles = PLAYER_STATS.extraProjectiles;
  rig.setFocus(HOME_CAMERA);
  pipeline.fade.amount = 0;
  healthHud.setVisible(false);
  deathBanner.update(-1, 0);
  if (audio.ctx && audio.music) audio.music.gain.setTargetAtTime(AUDIO.music.volume, audio.ctx.currentTime, 0.4);
  home.show();
}

// Le jeu s'ouvre sur l'accueil
rig.setFocus(HOME_CAMERA);
healthHud.setVisible(false);
home.show();

/** Nouvelle run depuis l'accueil. */
function startRun() {
  if (phase !== 'home') return;
  phase = 'run';
  runTime = 0;
  runKills = 0;
  home.hide();
  healthHud.setVisible(true);
  player.reset(decor.spawn.dir, decor.spawn.facing);
  rig.setFocus(null);
  spawnStartZombies();
  renderer.domElement.requestPointerLock?.()?.catch?.(() => {});
}
function onDeath() {
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
  const dt = realDt * timeScale() * devTimeScale;
  const input = readInput();
  // Accueil et mort : le joueur ne contrôle pas le Buveur (la caméra reste libre en jeu)
  const moveInput = phase === 'run' ? input : NO_MOVE;
  // Accueil : la caméra tourne lentement autour du Buveur
  if (phase === 'home') player.camFwd.applyAxisAngle(player.upDir, HOME_CAMERA.orbitSpeed * realDt);
  player.feed(moveInput);
  acc += dt;
  while (acc >= STEP) { player.step(STEP, moveInput); acc -= STEP; }
  player.interpolate(acc / STEP);

  const up = player.upDir;
  buveur.update(dt, player);
  horde.update(dt);
  health.update(dt);
  healthHud.update(realDt);
  if (phase === 'run' && health.dead) onDeath();
  if (phase === 'run') { runTime += dt; blonde.update(dt); }
  blonde.updateBottles(dt);
  shards.update(dt);
  damageNumbers.update(realDt);
  if (phase === 'dead') deathBanner.update(deadSince, runTime, runKills);
  // Espace ou bouton A : Jouer sur l'accueil, Continuer sur le bilan de mort
  if (input.jumpPressed) {
    if (phase === 'home') startRun();
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
  music.update();
  // Mise au point de la profondeur de champ sur le perso
  pipeline.focusDistance = camera.position.distanceTo(focusPoint.copy(player.renderPos).addScaledVector(player.upDir, 1.1));
  pipeline.render();

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
  Object.assign(window, { __game: { player, rig, camera, buveur, sky, heightAt, THREE, pipeline, renderer, decor, scene, music, horde, health, blonde, bottles, playerStats, setTimeScale: (k: number) => { devTimeScale = k; } } });
  const models = ['basic', 'chubby', 'arm', 'ribcage'] as const;
  const spawnRing = (n: number, rMin: number, rMax: number) => {
    const up = player.pos.clone().normalize();
    const a = new THREE.Vector3().crossVectors(up, player.facing).normalize(), b = player.facing.clone();
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const p = player.pos.clone().addScaledVector(a, Math.cos(t) * r).addScaledVector(b, Math.sin(t) * r);
      horde.spawn(models[i % 4], p, player.pos.clone().sub(p));
    }
  };
  Object.assign(window, { __spawnRing: spawnRing });
  // Dev : B bascule la musique de combat, en attendant les vagues d'ennemis
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyB' && !e.repeat) music.setMode(music.mode === 'combat' ? 'explore' : 'combat');
    // Dev : H fait apparaître 100 zombies en cercle autour du joueur (test de la horde)
    if (e.code === 'KeyH' && !e.repeat) spawnRing(100, 18, 30);
  });
}
