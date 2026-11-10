import * as THREE from 'three';
import { LIGHTING } from '../config/lighting';
import { RENDER } from '../config/visual';
import { LAYER_CHARACTER, LAYER_SKY } from '../render/materials';

const L = LIGHTING;
const col = (hex: number) => new THREE.Color(hex);

/**
 * Ciel, astres et lumières. Le soleil et la lune ont des directions fixes : la moitié de la planète
 * est de jour, l'autre de nuit. Ce qui dépend du joueur : l'intensité (jour, nuit, crépuscule),
 * la verticale de l'ambiance et la zone couverte par les ombres.
 */
export function createSky(scene: THREE.Scene) {
  const sunDir0 = new THREE.Vector3(...L.sunDir).normalize();
  const sunDir = sunDir0.clone();
  const moonDir = sunDir.clone().negate();
  const orbitAxis = new THREE.Vector3(...L.orbit.axis).normalize();
  const orbitQ = new THREE.Quaternion();
  let orbitAngle = 0;

  // --- Lumières
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  scene.add(hemi);
  const makeDir = (color: number) => {
    const l = new THREE.DirectionalLight(color, 0);
    l.castShadow = true;
    const S = RENDER.shadow;
    l.shadow.mapSize.set(S.mapSize, S.mapSize);
    const c = l.shadow.camera;
    c.layers.enable(LAYER_CHARACTER); // les persos (couche à part) projettent leur ombre
    c.left = -S.extent; c.right = S.extent; c.top = S.extent; c.bottom = -S.extent;
    c.near = 1; c.far = 300;
    l.shadow.bias = S.bias;
    l.shadow.normalBias = S.normalBias;
    l.shadow.radius = S.softness; // bords d'ombre doux
    scene.add(l, l.target);
    return l;
  };
  const sun = makeDir(L.day.sunColor);
  const moon = makeDir(L.night.moonColor);

  // --- Dôme de ciel (suit la caméra, dégradé calculé par rapport à la verticale locale)
  const uniforms = {
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uSunDir: { value: sunDir.clone() },
    uDay: { value: 1 },
    uDusk: { value: 0 },
    uZenithDay: { value: col(L.day.zenith) }, uHorizonDay: { value: col(L.day.horizon) },
    uZenithNight: { value: col(L.night.zenith) }, uHorizonNight: { value: col(L.night.horizon) },
    uGlow: { value: col(L.dusk.glow) },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uUp, uSunDir, uZenithDay, uHorizonDay, uZenithNight, uHorizonNight, uGlow;
        uniform float uDay, uDusk;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = dot(d, uUp);
          float t = smoothstep(-0.15, 0.55, h);
          vec3 day = mix(uHorizonDay, uZenithDay, t);
          vec3 night = mix(uHorizonNight, uZenithNight, t);
          vec3 c = mix(night, day, uDay);
          float glow = pow(max(0.0, 1.0 - abs(h)), 5.0) * pow(max(0.0, dot(d, uSunDir)) * 0.5 + 0.5, 3.0);
          c = mix(c, uGlow, glow * uDusk);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.layers.set(LAYER_SKY);
  scene.add(dome);

  // --- Astres et étoiles (groupe centré sur la caméra, directions fixes)
  const skyGroup = new THREE.Group();
  skyGroup.layers.set(LAYER_SKY);
  // Couleurs au-delà de 1 : le soleil et la lune brillent assez pour déclencher le halo
  const body = (dir: THREE.Vector3, rgb: [number, number, number], size: number) => {
    const mat = new THREE.MeshBasicMaterial({ fog: false });
    mat.color.setRGB(...rgb);
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), mat);
    m.position.copy(dir).multiplyScalar(440);
    m.layers.set(LAYER_SKY);
    skyGroup.add(m);
  };
  body(sunDir0, [6, 5, 3.4], 22);
  body(sunDir0.clone().negate(), [1.6, 1.75, 2.1], 14);

  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  {
    const pts: number[] = [], d = new THREE.Vector3();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1800; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      d.set(s * Math.cos(a), u, s * Math.sin(a)).multiplyScalar(450);
      pts.push(d.x, d.y, d.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(g, starMat);
    stars.layers.set(LAYER_SKY);
    stars.frustumCulled = false;
    skyGroup.add(stars);
  }
  scene.add(skyGroup);

  const fog = new THREE.Fog(0x000000, L.fog.near, L.fog.far);
  scene.fog = fog;
  scene.background = null;

  const up = new THREE.Vector3();
  let dayFactor = 1;
  // Repère fixe de chaque lumière (mêmes axes que lookAt de la caméra d'ombre) pour caler son centre
  // sur la grille des texels : sans ça, les bords d'ombre grouillent dès que le joueur bouge.
  const texel = (2 * RENDER.shadow.extent) / RENDER.shadow.mapSize;
  const bases = [0, 1].map(() => ({ x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() }));
  const setBasis = (b: (typeof bases)[number], dir: THREE.Vector3) => {
    b.z.copy(dir);
    b.x.set(0, 1, 0).cross(b.z).normalize();
    b.y.copy(b.z).cross(b.x);
  };
  const snapped = new THREE.Vector3();
  const dayHemiSky = col(L.day.hemiSky), nightHemiSky = col(L.night.hemiSky);
  const dayHemiGround = col(L.day.hemiGround), nightHemiGround = col(L.night.hemiGround);
  const horizonDay = col(L.day.horizon), horizonNight = col(L.night.horizon), glow = col(L.dusk.glow);

  function update(dt: number, playerPos: THREE.Vector3, camera: THREE.Camera) {
    // Orbite des astres : tout le ciel (soleil, lune, étoiles) tourne autour de l'axe
    orbitAngle = (orbitAngle + (dt / L.orbit.periodSeconds) * Math.PI * 2) % (Math.PI * 2);
    orbitQ.setFromAxisAngle(orbitAxis, orbitAngle);
    sunDir.copy(sunDir0).applyQuaternion(orbitQ);
    moonDir.copy(sunDir).negate();
    skyGroup.quaternion.copy(orbitQ);
    uniforms.uSunDir.value.copy(sunDir);
    setBasis(bases[0], sunDir);
    setBasis(bases[1], moonDir);
    up.copy(playerPos).normalize();
    const s = up.dot(sunDir); // 1 midi, 0 crépuscule, -1 minuit
    const day = THREE.MathUtils.smoothstep(s, -0.15, 0.25);
    dayFactor = day;
    const dusk = Math.max(0, 1 - Math.abs(s - 0.02) / 0.3);

    sun.intensity = L.sunIntensity * day;
    moon.intensity = L.moonIntensity * (1 - day);
    [sun, moon].forEach((l, i) => {
      const b = bases[i];
      const sx = Math.round(playerPos.dot(b.x) / texel) * texel;
      const sy = Math.round(playerPos.dot(b.y) / texel) * texel;
      snapped.copy(b.x).multiplyScalar(sx).addScaledVector(b.y, sy).addScaledVector(b.z, playerPos.dot(b.z));
      l.target.position.copy(snapped);
      l.position.copy(snapped).addScaledVector(b.z, 150);
    });
    // Seul l'astre qui éclaire vraiment recalcule sa carte d'ombre (deux cartes 4096 coûteraient double)
    // (la carte doit quand même exister : rendue au moins une fois, sinon le shader échantillonne du vide)
    sun.shadow.autoUpdate = day > 0.02 || sun.shadow.map === null;
    moon.shadow.autoUpdate = day < 0.98 || moon.shadow.map === null;
    hemi.position.copy(up);
    hemi.color.copy(nightHemiSky).lerp(dayHemiSky, day);
    hemi.groundColor.copy(nightHemiGround).lerp(dayHemiGround, day);
    hemi.intensity = THREE.MathUtils.lerp(L.night.hemiIntensity, L.day.hemiIntensity, day);

    uniforms.uUp.value.copy(up);
    uniforms.uDay.value = day;
    uniforms.uDusk.value = dusk;
    dome.position.copy(camera.position);
    skyGroup.position.copy(camera.position);
    fog.color.copy(horizonNight).lerp(horizonDay, day).lerp(glow, dusk * 0.3);
    starMat.opacity = 1 - day;
  }

  return {
    update,
    sunDir,
    /** 1 en plein jour, 0 en pleine nuit (sous le joueur). */
    get day() { return dayFactor; },
  };
}
