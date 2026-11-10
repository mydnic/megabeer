import * as THREE from 'three';

/**
 * Animation de squelette calculée par la carte graphique, pour des foules instanciées.
 *
 * Les matrices des os de chaque image de chaque animation sont pré-calculées dans une texture
 * (une ligne par image, 3 texels par os : les 3 lignes de la matrice 4x3). Chaque instance porte
 * l'attribut `aAnim` = (ligne A, ligne B, mélange A->B, 0) : le shader lit les matrices des os de
 * ses 4 influences et déforme le sommet.
 *
 * Le dernier composant de `aAnim` vaut 0 pour les foules. Pour tout autre objet, l'attribut est
 * absent et WebGL renvoie sa valeur générique dont le dernier composant vaut 1 : le même matériau
 * (contours, occlusion ambiante, profondeur de champ) sert donc aux foules et au reste de la scène.
 */
export const vatUniforms = {
  vatTex: { value: null as THREE.DataTexture | null },
};

const PARS = /* glsl */ `
uniform highp sampler2D vatTex;
attribute vec4 aAnim;
attribute vec4 aSkinIndex;
attribute vec4 aSkinWeight;
mat4 vatBone(float row, float bone) {
  int x = int(bone) * 3, y = int(row);
  vec4 r0 = texelFetch(vatTex, ivec2(x, y), 0);
  vec4 r1 = texelFetch(vatTex, ivec2(x + 1, y), 0);
  vec4 r2 = texelFetch(vatTex, ivec2(x + 2, y), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 vatSkin(float row) {
  return aSkinWeight.x * vatBone(row, aSkinIndex.x) + aSkinWeight.y * vatBone(row, aSkinIndex.y)
       + aSkinWeight.z * vatBone(row, aSkinIndex.z) + aSkinWeight.w * vatBone(row, aSkinIndex.w);
}
`;

/**
 * Ajoute l'animation de foule à un matériau (les objets sans `aAnim` ne sont pas touchés).
 * `flash` : le matériau éclaire l'instance en blanc selon -aAnim.w (zombie touché).
 * `fade` : chaque instance multiplie son opacité par l'attribut `aFade` (matériau transparent).
 * `glow` : chaque instance a un liseré de lumière de cette couleur sur ses contours, d'intensité
 * l'attribut `aGlow` (ennemi qui reçoit un buff) ; `rim` règle sa finesse (plus grand : plus fin).
 */
export function patchVat(material: THREE.Material, key: string, flash = 0, fade = false, glow?: THREE.Color, rim = 2.5) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.vatTex = vatUniforms.vatTex;
    let vs = shader.vertexShader.replace('#include <common>', '#include <common>\n' + PARS);
    vs = vs.replace('void main() {', `void main() {
  bool vatOn = aAnim.w < 0.5;
  mat4 vatM = mat4(1.0);
  if (vatOn) vatM = aAnim.z > 0.001 ? mat4(vatSkin(aAnim.x) * (1.0 - aAnim.z) + vatSkin(aAnim.y) * aAnim.z) : vatSkin(aAnim.x);`);
    vs = vs.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  if (vatOn) objectNormal = mat3(vatM) * objectNormal;');
    vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  if (vatOn) transformed = (vatM * vec4(transformed, 1.0)).xyz;');
    if (flash > 0) {
      vs = vs.replace('#include <common>', '#include <common>\nvarying float vVatFlash;');
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vVatFlash = vatOn ? -aAnim.w : 0.0;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vVatFlash;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(vVatFlash * ${flash.toFixed(3)});`);
    }
    if (glow) {
      const c = `vec3(${glow.r.toFixed(3)}, ${glow.g.toFixed(3)}, ${glow.b.toFixed(3)})`;
      vs = vs.replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vVatGlow;');
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vVatGlow = aGlow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vVatGlow;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  // Liseré : plus fort là où la surface fuit le regard (bords de la silhouette). max() : face pile vers
  // la caméra, l'arrondi donne |dot| > 1 et pow() d'un négatif vaut NaN, que le halo étale sur tout l'écran
  float vatRim = pow(max(0.0, 1.0 - abs(dot(normalize(vViewPosition), normal))), ${rim.toFixed(2)});
  totalEmissiveRadiance += ${c} * vVatGlow * vatRim;`);
    }
    if (fade) {
      vs = vs.replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vVatFade;');
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vVatFade = aFade;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vVatFade;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.a *= vVatFade;');
    }
    shader.vertexShader = vs;
  };
  const prevKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => prevKey() + '|vat-' + key;
  material.needsUpdate = true;
}
