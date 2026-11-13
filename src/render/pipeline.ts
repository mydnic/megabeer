import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RENDER } from '../config/visual';
import { LAYER_CHARACTER, LAYER_SKY } from './materials';
import { CharacterOutlinePass } from './characterOutline';
import { patchVat } from './vat';
import { LIGHT_RENDER } from './quality';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: new THREE.Vector3() },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uVignette: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSat, uContrast, uVignette;
    uniform vec3 uLift, uGain;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      // Contraste autour du gris moyen, en espace linéaire (avant le tone mapping)
      c = max(c, 0.0);
      c = pow(c / 0.18, vec3(uContrast)) * 0.18;
      c = c * uGain + uLift;
      vec2 q = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.2, 0.8, dot(q, q) * 2.0);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/**
 * Chaîne de rendu : scène (MSAA) -> occlusion ambiante -> contour des persos -> halo -> profondeur de champ ->
 * étalonnage -> tone mapping ACES + sRGB.
 * Les passes AO et profondeur de champ utilisent une caméra qui ne voit pas le ciel.
 */
export class Pipeline {
  private composer: EffectComposer;
  private worldCam: THREE.PerspectiveCamera;
  private ao: GTAOPass;
  private bloom: UnrealBloomPass;
  private dof: BokehPass;
  private grade: ShaderPass;
  private outline: CharacterOutlinePass;
  /** Distance de mise au point (le perso), mise à jour chaque frame. */
  focusDistance = 16;
  /**
   * Retombée de l'image (mort) : 0 = normal, 1 = désaturée et assombrie aux valeurs données.
   */
  fade = { amount: 0, saturation: 1, vignette: 0 };

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = RENDER.exposure;
    // Les ombres ne sont calculées qu'une fois par frame, pas à chaque passe
    renderer.shadowMap.autoUpdate = false;
    camera.layers.enable(LAYER_SKY);
    camera.layers.enable(LAYER_CHARACTER);
    this.worldCam = camera.clone();
    this.worldCam.layers.set(0);
    this.worldCam.layers.enable(LAYER_CHARACTER);

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));

    this.ao = new GTAOPass(scene, this.worldCam, 1, 1);
    this.ao.updateGtaoMaterial({
      radius: RENDER.ao.radius, distanceExponent: RENDER.ao.distanceExponent,
      thickness: RENDER.ao.thickness, scale: RENDER.ao.scale, samples: RENDER.ao.samples,
    });
    this.ao.blendIntensity = RENDER.ao.intensity;
    // Les foules animées par la carte graphique doivent garder leur pose dans les passes à matériau imposé
    patchVat(this.ao.normalMaterial, 'gtao-normal');
    this.composer.addPass(this.ao);

    // Contour des personnages (après l'AO, avant le halo et la profondeur de champ)
    this.outline = new CharacterOutlinePass(scene, camera);
    this.composer.addPass(this.outline);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), RENDER.bloom.strength, RENDER.bloom.radius, RENDER.bloom.threshold);
    this.composer.addPass(this.bloom);

    this.dof = new BokehPass(scene, this.worldCam, { focus: 16, aperture: RENDER.dof.aperture, maxblur: RENDER.dof.maxBlur });
    this.shareDepth();
    this.composer.addPass(this.dof);

    this.grade = new ShaderPass(GradeShader);
    const g = RENDER.grade, u = this.grade.uniforms;
    u.uSat.value = g.saturation;
    u.uContrast.value = g.contrast;
    u.uLift.value.set(...g.lift);
    u.uGain.value.set(...g.gain);
    u.uVignette.value = g.vignette;
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());
  }

  /**
   * La profondeur de champ redessinait toute la scène (décor et horde) rien que pour sa profondeur. Elle lit
   * maintenant celle que l'occlusion ambiante vient de calculer avec la même caméra : une passe plein écran la
   * recopie dans son format (profondeur empaquetée), soit un cinquième de géométrie en moins à chaque image.
   */
  private shareDepth() {
    const pack = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: this.ao.depthTexture } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `#include <packing>
uniform sampler2D tDepth; varying vec2 vUv; void main() { gl_FragColor = packDepthToRGBA(texture2D(tDepth, vUv).x); }`,
      depthTest: false, depthWrite: false,
    });
    const quad = new FullScreenQuad(pack);
    const dof = this.dof as unknown as {
      _renderTargetDepth: THREE.WebGLRenderTarget; _fsQuad: FullScreenQuad; uniforms: Record<string, THREE.IUniform>; renderToScreen: boolean;
      camera: THREE.PerspectiveCamera; render: (r: THREE.WebGLRenderer, w: THREE.WebGLRenderTarget, rd: THREE.WebGLRenderTarget) => void;
    };
    dof.render = (renderer, writeBuffer, readBuffer) => {
      pack.uniforms.tDepth.value = this.ao.depthTexture;
      renderer.setRenderTarget(dof._renderTargetDepth);
      quad.render(renderer);
      dof.uniforms.tColor.value = readBuffer.texture;
      dof.uniforms.nearClip.value = dof.camera.near;
      dof.uniforms.farClip.value = dof.camera.far;
      renderer.setRenderTarget(dof.renderToScreen ? null : writeBuffer);
      if (!dof.renderToScreen) renderer.clear();
      dof._fsQuad.render(renderer);
    };
  }

  setSize(w: number, h: number) {
    if (LIGHT_RENDER) return; // rendu direct : pas de cibles intermédiaires
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render() {
    // Caméra « monde » synchronisée avec la caméra de jeu
    const c = this.worldCam, cam = this.camera;
    c.position.copy(cam.position);
    c.quaternion.copy(cam.quaternion);
    c.up.copy(cam.up);
    c.fov = cam.fov; c.aspect = cam.aspect; c.near = cam.near; c.far = cam.far;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    const dofU = this.dof.uniforms as Record<string, THREE.IUniform>;
    dofU.focus.value = this.focusDistance;
    // Moins de flou quand on dézoome : le lointain reste lisible
    const D = RENDER.dof;
    dofU.aperture.value = D.aperture * THREE.MathUtils.clamp(D.fullUntil / Math.max(this.focusDistance, 0.01), D.minScale, 1);

    const g = RENDER.grade, u = this.grade.uniforms, f = this.fade;
    u.uSat.value = THREE.MathUtils.lerp(g.saturation, f.saturation, f.amount);
    u.uVignette.value = THREE.MathUtils.lerp(g.vignette, Math.max(g.vignette, f.vignette), f.amount);

    this.renderer.shadowMap.needsUpdate = true;
    // Rendu léger (téléphone) : la scène va droit à l'écran (tone mapping et sRGB appliqués par le renderer), sans
    // aucune passe plein écran. Les images intermédiaires à virgule flottante donnaient un écran blanc sur mobile.
    if (LIGHT_RENDER) { this.renderer.setRenderTarget(null); this.renderer.render(this.scene, cam); return; }
    this.composer.render();
  }
}
