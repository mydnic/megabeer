// Test technique jetable (GDD section 20, étape 0a) :
// planète sphérique, gravité vers le centre, déplacement, saut, caméra en repère local, relief.
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { createHorde } from './horde';

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
const CFG = {
  baseSpeed: 9,        // unités/s (vitesse du proto)
  lapSeconds: 120,     // GDD : environ 2 min pour faire le tour
  gravity: 32,
  jumpSpeed: 11,
  playerRadius: 0.5,
  maxSlope: Math.tan(THREE.MathUtils.degToRad(60)), // au-delà, la pente bloque
  camDist: 16, camDistMin: 6, camDistMax: 45,
  camPitch: 0.5, camPitchMin: 0.05, camPitchMax: 1.4,
  mouseSens: 0.0025,
  terrainDetail: 200,  // subdivisions de l'icosphère (arêtes d'environ 1 unité)
  decorCount: 1800,
};
// Rayon déduit du temps de tour : circonférence = vitesse x temps
const R = (CFG.baseSpeed * CFG.lapSeconds) / (2 * Math.PI);

// ---------------------------------------------------------------------------
// Relief : bruit 3D évalué sur la direction (pas de coutures, pas de pôles)
// ---------------------------------------------------------------------------
const noise = new ImprovedNoise();
function heightAt(d: THREE.Vector3): number {
  const n1 = noise.noise(d.x * 2.1 + 11, d.y * 2.1, d.z * 2.1);
  const n2 = noise.noise(d.x * 6.3, d.y * 6.3 + 23, d.z * 6.3);
  const n3 = noise.noise(d.x * 17 + 5, d.y * 17, d.z * 17 - 7);
  // Collines larges + bosses moyennes + détail
  const base = n1 * 9 + n2 * 3.5 + n3 * 0.8;
  // Chaînes de montagnes (bruit "ridged" : crêtes marquées)
  // Valeur absolue adoucie : crête arrondie, que le maillage peut suivre sans dents de scie
  const rn = noise.noise(d.x * 2.6 + 41, d.y * 2.6, d.z * 2.6 - 13);
  const m = 1 - Math.sqrt(rn * rn + 0.004);
  const mask = THREE.MathUtils.smoothstep(noise.noise(d.x * 1.3 - 7, d.y * 1.3 + 3, d.z * 1.3), -0.05, 0.35);
  const mount = Math.pow(m, 4) * 46 * mask;
  return base + mount;
}
const groundRadius = (d: THREE.Vector3) => R + heightAt(d);

// ---------------------------------------------------------------------------
// Scène
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x1b2747);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 50, 190);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);

// Lumières : un soleil d'un côté, une lune de l'autre, directions FIXES dans le monde.
// Chaque astre éclaire sa moitié de planète : côté jour et côté nuit, deux ambiances.
// Seule la caméra d'ombre suit le joueur (sa direction ne change pas).
const SUN_DIR = new THREE.Vector3(1, 0.35, 0.2).normalize();
const MOON_DIR = SUN_DIR.clone().negate();
const AMB = {
  day: { sky: new THREE.Color(0x7fb2e8), hemiSky: new THREE.Color(0xbcd6ff), hemiGround: new THREE.Color(0x4a3a24), hemi: 1.1 },
  night: { sky: new THREE.Color(0x0b1430), hemiSky: new THREE.Color(0x3a4f8a), hemiGround: new THREE.Color(0x10121c), hemi: 0.7 },
  dusk: new THREE.Color(0xd9774a),
};
const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemi);
function makeDirLight(color: number) {
  const l = new THREE.DirectionalLight(color, 0);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  const c = l.shadow.camera;
  c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 260;
  l.shadow.bias = -0.0005;
  scene.add(l, l.target);
  return l;
}
const sun = makeDirLight(0xfff0d8);
const moon = makeDirLight(0x9db8ff);

// Astres visibles dans le ciel
function skyBody(dir: THREE.Vector3, color: number, size: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), new THREE.MeshBasicMaterial({ color, fog: false }));
  m.position.copy(dir).multiplyScalar(700);
  scene.add(m);
}
skyBody(SUN_DIR, 0xffe9a8, 40);
skyBody(MOON_DIR, 0xdfe7ff, 22);

// Étoiles, visibles seulement la nuit
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true });
{
  const rng = mulberry32(99), pts: number[] = [], d = new THREE.Vector3();
  for (let i = 0; i < 1500; i++) { randomDir(rng, d).multiplyScalar(800); pts.push(d.x, d.y, d.z); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, starMat));
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------
function buildTerrain(): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, CFG.terrainDetail);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const grass = new THREE.Color(0x4f7a3a), grassDark = new THREE.Color(0x35552a);
  const rock = new THREE.Color(0x7a7066), snow = new THREE.Color(0xdfe6ee), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = heightAt(v);
    v.multiplyScalar(R + h);
    pos.setXYZ(i, v.x, v.y, v.z);
    if (h > 24) c.copy(snow);
    else if (h > 12) c.copy(rock).lerp(grass, Math.max(0, (15 - h) / 3));
    else c.copy(grassDark).lerp(grass, THREE.MathUtils.clamp((h + 8) / 16, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}
const terrain = buildTerrain();
scene.add(terrain);

// ---------------------------------------------------------------------------
// Décor instancié (arbres, rochers) + obstacles pour les collisions
// ---------------------------------------------------------------------------
type Obstacle = { pos: THREE.Vector3; radius: number; top: number };
const obstacles: Obstacle[] = [];

function randomDir(rng: () => number, out: THREE.Vector3) {
  const u = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), u, s * Math.sin(t));
}
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function buildDecor() {
  const rng = mulberry32(1234);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2, 6).translate(0, 1, 0);
  const crownGeo = new THREE.ConeGeometry(1.4, 3.6, 7).translate(0, 3.6, 0);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5a3d26, flatShading: true }), CFG.decorCount);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0x2d5a34, flatShading: true }), CFG.decorCount);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x8a8580, flatShading: true }), CFG.decorCount);
  let nt = 0, nr = 0;
  const d = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
  const Y = new THREE.Vector3(0, 1, 0), spin = new THREE.Quaternion();
  for (let i = 0; i < CFG.decorCount; i++) {
    randomDir(rng, d);
    const h = heightAt(d);
    if (h > 13) continue; // pas d'arbres sur les sommets
    p.copy(d).multiplyScalar(R + h - 0.2);
    q.setFromUnitVectors(Y, d);
    spin.setFromAxisAngle(Y, rng() * Math.PI * 2);
    q.multiply(spin);
    if (rng() < 0.7) {
      const k = 0.8 + rng() * 0.6;
      s.set(k, k, k);
      m.compose(p, q, s);
      trunks.setMatrixAt(nt, m); crowns.setMatrixAt(nt, m); nt++;
      obstacles.push({ pos: p.clone(), radius: 0.45 * k, top: 6 * k });
    } else {
      const k = 0.6 + rng() * 1.4;
      s.set(k, k * 0.7, k);
      m.compose(p, q, s);
      rocks.setMatrixAt(nr, m); nr++;
      obstacles.push({ pos: p.clone(), radius: 0.9 * k, top: 0.9 * k });
    }
  }
  trunks.count = crowns.count = nt; rocks.count = nr;
  for (const im of [trunks, crowns, rocks]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
}
buildDecor();

// Repères pour vérifier le tour : pilier rouge au départ, bleu aux antipodes
function pillar(dir: THREE.Vector3, color: number) {
  const d = dir.clone().normalize();
  const g = new THREE.CylinderGeometry(0.6, 0.6, 30, 8).translate(0, 15, 0);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color }));
  mesh.position.copy(d).multiplyScalar(groundRadius(d) - 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  scene.add(mesh);
}

// ---------------------------------------------------------------------------
// Joueur
// ---------------------------------------------------------------------------
const startDir = new THREE.Vector3(0.3, 1, 0.2).normalize();
// Avancer légèrement le départ si on tombe sur un sommet
while (heightAt(startDir) > 8) startDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.02);
pillar(startDir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.1), 0xff4040);
pillar(startDir.clone().negate(), 0x4080ff);

const player = {
  pos: startDir.clone().multiplyScalar(groundRadius(startDir)),
  vr: 0,                        // vitesse radiale (saut / chute)
  onGround: true,
  facing: new THREE.Vector3(),  // direction du modèle (tangente)
};
// camFwd : direction "avant" de la caméra, tangente au sol, transportée à chaque frame
const camFwd = new THREE.Vector3(1, 0, 0);
camFwd.addScaledVector(startDir, -camFwd.dot(startDir)).normalize();
player.facing.copy(camFwd);
let camPitch = CFG.camPitch, camDist = CFG.camDist;

const playerMesh = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 10), new THREE.MeshLambertMaterial({ color: 0xf2b134 }));
  body.position.y = 0.9; body.castShadow = true;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  nose.position.set(0, 1.25, 0.45);
  playerMesh.add(body, nose);
}
scene.add(playerMesh);

// Horde (étape 0b). Nombre initial via ?n=500 dans l'URL, touches 1 à 5 pour changer.
const horde = createHorde(scene, heightAt, R);
horde.setCount(Number(new URLSearchParams(location.search).get('n') ?? 500), player.pos);
const HORDE_SIZES: Record<string, number> = { Digit1: 0, Digit2: 250, Digit3: 500, Digit4: 1000, Digit5: 2000 };
let hordeMs = 0;

// ---------------------------------------------------------------------------
// Entrées
// ---------------------------------------------------------------------------
const keys = new Set<string>();
let deadzone = 0.15;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyK') deadzone = Math.max(0, +(deadzone - 0.05).toFixed(2));
  if (e.code === 'KeyL') deadzone = Math.min(0.9, +(deadzone + 0.05).toFixed(2));
  if (e.code === 'KeyT') startLapTest();
  if (e.code === 'KeyG') speedMul = speedMul === 1 ? 4 : 1;
  if (e.code in HORDE_SIZES) horde.setCount(HORDE_SIZES[e.code], player.pos);
});
addEventListener('keyup', (e) => keys.delete(e.code));
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
let mouseDX = 0, mouseDY = 0;
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  mouseDX += e.movementX; mouseDY += e.movementY;
});
addEventListener('wheel', (e) => {
  camDist = THREE.MathUtils.clamp(camDist * (e.deltaY > 0 ? 1.1 : 0.9), CFG.camDistMin, CFG.camDistMax);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function readInput() {
  let x = 0, y = 0, jump = false, lookX = 0, lookY = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('Space')) jump = true;
  const gp = navigator.getGamepads?.()[0];
  if (gp) {
    // Zone morte réglable, avec remise à l'échelle pour garder une réponse progressive
    const dz = (a: number) => (Math.abs(a) < deadzone ? 0 : Math.sign(a) * (Math.abs(a) - deadzone) / (1 - deadzone));
    x += dz(gp.axes[0]); y -= dz(gp.axes[1]);
    lookX += dz(gp.axes[2] ?? 0); lookY += dz(gp.axes[3] ?? 0);
    if (gp.buttons[0]?.pressed) jump = true;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, jump, lookX, lookY };
}

// ---------------------------------------------------------------------------
// Test du tour
// ---------------------------------------------------------------------------
let speedMul = 1;
const lap = { active: false, angle: 0, time: 0, lastDir: new THREE.Vector3(), result: '' };
function startLapTest() {
  lap.active = !lap.active; lap.angle = 0; lap.time = 0; lap.result = '';
  lap.lastDir.copy(player.pos).normalize();
}

// ---------------------------------------------------------------------------
// Boucle (pas de temps fixe pour la physique)
// ---------------------------------------------------------------------------
const STEP = 1 / 120;
let acc = 0, last = performance.now();
const up = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), tmp = new THREE.Vector3();
let fpsT = 0, fpsN = 0, fps = 0;

// Gradient du relief dans le plan tangent (en unités de hauteur par unité de distance)
const grad = new THREE.Vector3(), gTmp = new THREE.Vector3();
function slopeGradient(u: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, out: THREE.Vector3) {
  const e = 0.6, h0 = heightAt(u);
  const hx = heightAt(gTmp.copy(u).addScaledVector(ax, e / R).normalize());
  const hy = heightAt(gTmp.copy(u).addScaledVector(ay, e / R).normalize());
  return out.copy(ax).multiplyScalar((hx - h0) / e).addScaledVector(ay, (hy - h0) / e);
}

function physics(dt: number, inp: ReturnType<typeof readInput>) {
  up.copy(player.pos).normalize();

  // Transport parallèle du repère caméra sur le nouveau plan tangent
  camFwd.addScaledVector(up, -camFwd.dot(up)).normalize();
  right.crossVectors(camFwd, up).normalize();

  // Direction de déplacement relative à la caméra
  let ix = inp.x, iy = inp.y;
  if (lap.active) { ix = 0; iy = 1; }
  move.set(0, 0, 0).addScaledVector(camFwd, iy).addScaledVector(right, ix);
  const speed = CFG.baseSpeed * speedMul;
  if (move.lengthSq() > 1e-6) {
    tmp.copy(move).normalize();
    player.facing.lerp(tmp, Math.min(1, dt * 12)).normalize();
  }
  player.facing.addScaledVector(up, -player.facing.dot(up)).normalize();

  // Pentes trop raides : on retire la composante qui monte, le joueur longe la paroi
  if (move.lengthSq() > 1e-6) {
    slopeGradient(up, camFwd, right, grad);
    const steep = grad.length();
    if (steep > CFG.maxSlope) {
      grad.divideScalar(steep);
      const uphill = move.dot(grad);
      if (uphill > 0) move.addScaledVector(grad, -uphill);
    }
  }

  // Déplacement tangent puis reprojection sur la sphère au même rayon
  const r = player.pos.length();
  player.pos.addScaledVector(move, speed * dt);
  player.pos.setLength(r);

  // Collisions avec le décor (poussée dans le plan tangent)
  for (const o of obstacles) {
    tmp.subVectors(player.pos, o.pos);
    const minD = o.radius + CFG.playerRadius;
    if (tmp.lengthSq() > (minD + o.top) * (minD + o.top)) continue;
    const vertical = tmp.dot(up);
    if (vertical > o.top) continue; // au-dessus de l'obstacle
    tmp.addScaledVector(up, -vertical);
    const d = tmp.length();
    if (d < minD && d > 1e-5) player.pos.addScaledVector(tmp, (minD - d) / d);
  }

  // Gravité et sol
  const dir = tmp.copy(player.pos).normalize();
  const ground = groundRadius(dir);
  let rad = player.pos.length();
  if (player.onGround && inp.jump) { player.vr = CFG.jumpSpeed; player.onGround = false; }
  player.vr -= CFG.gravity * dt;
  rad += player.vr * dt;
  // Collé au sol en descente douce (pas de petits envols dans les pentes)
  if (rad <= ground || (player.onGround && player.vr <= 0 && rad - ground < 0.6)) {
    rad = ground; player.vr = 0; player.onGround = true;
  } else player.onGround = false;
  player.pos.copy(dir).multiplyScalar(rad);

  // Mesure du tour
  if (lap.active) {
    lap.time += dt;
    const nd = up.copy(player.pos).normalize();
    lap.angle += lap.lastDir.angleTo(nd);
    lap.lastDir.copy(nd);
    if (lap.angle >= Math.PI * 2) {
      lap.result = `Tour complet en ${lap.time.toFixed(1)} s (vitesse x${speedMul})`;
      lap.active = false;
    }
  }
}

function updateCamera(dt: number, inp: ReturnType<typeof readInput>) {
  up.copy(player.pos).normalize();
  // Rotation de la caméra autour de la verticale locale
  const yaw = -mouseDX * CFG.mouseSens - inp.lookX * 2.5 * dt;
  camFwd.applyAxisAngle(up, yaw);
  camPitch = THREE.MathUtils.clamp(camPitch + mouseDY * CFG.mouseSens + inp.lookY * 1.8 * dt, CFG.camPitchMin, CFG.camPitchMax);
  mouseDX = mouseDY = 0;

  const target = tmp.copy(player.pos).addScaledVector(up, 1.4);
  const camPos = new THREE.Vector3().copy(target)
    .addScaledVector(camFwd, -Math.cos(camPitch) * camDist)
    .addScaledVector(up, Math.sin(camPitch) * camDist);
  // La caméra ne passe jamais sous le relief
  const cd = camPos.clone().normalize();
  const minR = groundRadius(cd) + 1.2;
  if (camPos.length() < minR) camPos.setLength(minR);

  camera.position.copy(camPos);
  camera.up.copy(up);
  camera.lookAt(target);

  // Le modèle du joueur : vertical = normale de la sphère, avant = facing
  right.crossVectors(up, player.facing).normalize();
  playerMesh.position.copy(player.pos);
  playerMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, player.facing));

  updateLighting();
}

// Jour / nuit selon la position du joueur sur la planète (directions des astres fixes)
const skyTmp = new THREE.Color();
function updateLighting() {
  const u = up.copy(player.pos).normalize();
  const s = u.dot(SUN_DIR); // 1 = midi, 0 = crépuscule, -1 = minuit
  const day = THREE.MathUtils.smoothstep(s, -0.15, 0.25);
  const dusk = Math.max(0, 1 - Math.abs(s) / 0.3); // bande autour du terminateur
  sun.intensity = 2.6 * day;
  moon.intensity = 0.9 * (1 - day);
  for (const [l, dir] of [[sun, SUN_DIR], [moon, MOON_DIR]] as const) {
    l.target.position.copy(player.pos);
    l.position.copy(player.pos).addScaledVector(dir, 120);
  }
  // L'ambiance du ciel suit la verticale locale (sinon elle reste fixée au "haut" du monde)
  hemi.position.copy(u);
  hemi.color.copy(AMB.night.hemiSky).lerp(AMB.day.hemiSky, day);
  hemi.groundColor.copy(AMB.night.hemiGround).lerp(AMB.day.hemiGround, day);
  hemi.intensity = THREE.MathUtils.lerp(AMB.night.hemi, AMB.day.hemi, day);
  skyTmp.copy(AMB.night.sky).lerp(AMB.day.sky, day).lerp(AMB.dusk, dusk * 0.45);
  (scene.background as THREE.Color).copy(skyTmp);
  (scene.fog as THREE.Fog).color.copy(skyTmp);
  starMat.opacity = 1 - day;
}

const hud = document.getElementById('hud')!;
function updateHud(dt: number) {
  fpsT += dt; fpsN++;
  if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsT = 0; fpsN = 0; }
  const d = up.copy(player.pos).normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(d.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(d.z, d.x));
  const lines = [
    `FPS ${fps.toFixed(0)}   triangles ${renderer.info.render.triangles.toLocaleString('fr')}`,
    `Horde ${horde.count} zombies (touches 1 à 5 : 0 / 250 / 500 / 1000 / 2000)   calcul ${hordeMs.toFixed(2)} ms par frame`,
    `Rayon planète ${R.toFixed(1)}   circonférence ${(2 * Math.PI * R).toFixed(0)}`,
    `Lat ${lat.toFixed(1)}  Lon ${lon.toFixed(1)}  altitude sol ${heightAt(d).toFixed(1)}`,
    `Au sol ${player.onGround ? 'oui' : 'non'}   vitesse x${speedMul}   pente ${THREE.MathUtils.radToDeg(Math.atan(grad.length())).toFixed(0)} degrés`,
  ];
  const gp = navigator.getGamepads?.()[0];
  if (gp) {
    lines.push(`Manette : ${gp.id.slice(0, 40)} (${gp.mapping || 'mapping non standard'})`);
    lines.push(`Zone morte ${deadzone.toFixed(2)} (K / L)   axes ${gp.axes.map((a) => a.toFixed(2)).join(' ')}`);
    const trig = [6, 7].map((i) => gp.buttons[i]?.value.toFixed(2) ?? '-').join(' ');
    lines.push(`Gâchettes ${trig}`);
  }
  if (lap.active) lines.push(`Test du tour : ${(THREE.MathUtils.radToDeg(lap.angle)).toFixed(0)} / 360 degrés, ${lap.time.toFixed(1)} s`);
  if (lap.result) lines.push(lap.result);
  hud.textContent = lines.join('\n');
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const inp = readInput();
  acc += dt;
  while (acc >= STEP) { physics(STEP, inp); acc -= STEP; }
  const t0 = performance.now();
  horde.update(dt, now / 1000, player.pos);
  hordeMs = hordeMs * 0.95 + (performance.now() - t0) * 0.05;
  updateCamera(dt, inp);
  renderer.render(scene, camera);
  updateHud(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Accès debug depuis la console (tests automatisés)
Object.assign(window, { __spike: { player, camFwd, lap, startLapTest, heightAt, grad, R } });
