import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RENDER } from '../config/visual';
import { LAYER_CHARACTER, LAYER_SKY } from './materials';
import { CharacterOutlinePass } from './characterOutline';
import { patchVat } from './vat';

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

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
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
    patchVat((this.dof as unknown as { _materialDepth: THREE.Material })._materialDepth, 'dof-depth');
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

  setSize(w: number, h: number) {
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

    this.renderer.shadowMap.needsUpdate = true;
    this.composer.render();
  }
}
