import * as THREE from 'three';

const RAMP_SIZE = 32;

function makeRamp() {
  const t = new THREE.DataTexture(new Uint8Array(RAMP_SIZE * 4), RAMP_SIZE, 1, THREE.RGBAFormat);
  t.generateMipmaps = false;
  return t;
}
/** Rampes d'ombrage du cel-shading (modifiables à chaud) : décor, et personnages à part. */
export const TOON_GRADIENT = makeRamp();
export const CHAR_GRADIENT = makeRamp();

/** steps : paliers de 0 à 255 (ombre -> lumière). smooth : interpolés au lieu de paliers nets. */
export function setToonRamp(steps: number[], smooth: boolean, tex: THREE.DataTexture = TOON_GRADIENT) {
  const data = tex.image.data as Uint8Array;
  const n = steps.length;
  for (let i = 0; i < RAMP_SIZE; i++) {
    const t = i / (RAMP_SIZE - 1);
    let v: number;
    if (smooth) {
      const f = t * (n - 1), k = Math.min(n - 2, Math.floor(f));
      v = steps[k] + (steps[k + 1] - steps[k]) * (f - k);
    } else {
      v = steps[Math.min(n - 1, Math.floor(t * n))];
    }
    data.set([v, v, v, 255], i * 4);
  }
  tex.minFilter = tex.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  tex.needsUpdate = true;
}
setToonRamp([90, 175, 255], false);
setToonRamp([90, 175, 255], false, CHAR_GRADIENT);

/** Liseré de lumière sur la silhouette (personnages), réglé par le style. */
export const RIM = {
  uRimColor: { value: new THREE.Color(0xffffff) },
  uRimStrength: { value: 0 },
  uRimThreshold: { value: 0.6 },
};

/** character : rampe des personnages + liseré de lumière. */
export function toonMaterial(params: THREE.MeshToonMaterialParameters = {}, opts: { character?: boolean } = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ gradientMap: opts.character ? CHAR_GRADIENT : TOON_GRADIENT, ...params });
  if (opts.character) {
    m.defines = { ...m.defines, USE_RIM: '' };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, RIM);
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uRimColor;\nuniform float uRimStrength, uRimThreshold;\nvoid main() {')
        .replace('#include <opaque_fragment>', `
          {
            float fr = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            outgoingLight += uRimColor * uRimStrength * smoothstep(uRimThreshold, uRimThreshold + 0.05, fr);
          }
          #include <opaque_fragment>`);
    };
  }
  return m;
}

/** Objets qui ne doivent pas recevoir de contour (ciel, étoiles, astres, nuages). */
export const LAYER_NO_OUTLINE = 1;
/** Personnages : marqués dans la passe de normales pour recevoir un contour plus épais. */
export const LAYER_CHARACTER = 2;
