import * as THREE from 'three';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { CHARACTER_LOOK } from '../config/visual';
import { LIGHTING } from '../config/lighting';
import { LAYER_CHARACTER } from './materials';
import { patchVat } from './vat';

const O = CHARACTER_LOOK.outline;

/**
 * Contour des personnages, au trait net et d'épaisseur fixe à l'écran :
 * 1. profondeur du décor (pour que le décor devant un perso masque son contour), puis normales des
 *    persos marquées par alpha 0 ;
 * 2. bords au pixel près, uniquement sur les pixels de perso (silhouette et plis) ;
 * 3. composition : silhouette épaissie en disque, plis en trait fin, par-dessus l'image.
 */
export class CharacterOutlinePass extends Pass {
  private normalRT: THREE.WebGLRenderTarget;
  private edgeRT: THREE.WebGLRenderTarget;
  private depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  private normalChar = new THREE.MeshNormalMaterial();
  private edgeQuad: FullScreenQuad;
  private compQuad: FullScreenQuad;
  private edgeMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private savedClear = new THREE.Color();

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    super();
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalRT.depthTexture = new THREE.DepthTexture(1, 1);
    this.normalRT.depthTexture.type = THREE.FloatType;
    this.edgeRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.normalChar.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor.a = 1.0;', 'gl_FragColor.a = 0.0;');
    };
    this.normalChar.customProgramCacheKey = () => 'normal-character';
    patchVat(this.normalChar, 'outline-normal');

    this.edgeMat = new THREE.ShaderMaterial({
      uniforms: {
        tNormal: { value: this.normalRT.texture },
        tDepth: { value: this.normalRT.depthTexture },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uDepthTh: { value: O.depthThreshold },
        uNormalTh: { value: O.creaseThreshold },
        uScale: { value: new THREE.Vector2(O.fullUntil, O.minScale) },
        uFog: { value: new THREE.Vector2(LIGHTING.fog.near, LIGHTING.fog.far) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tNormal, tDepth;
        uniform vec2 uTexel, uScale, uFog;
        uniform float uNear, uFar, uDepthTh, uNormalTh;
        varying vec2 vUv;
        float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
        void main() {
          vec4 c4 = texture2D(tNormal, vUv);
          if (c4.a > 0.5) { gl_FragColor = vec4(0.0); return; } // pas un pixel de perso
          vec3 nc = c4.xyz * 2.0 - 1.0;
          float dc = viewDepth(vUv);
          vec2 offs[4];
          offs[0] = vec2(uTexel.x, 0.0); offs[1] = vec2(-uTexel.x, 0.0); offs[2] = vec2(0.0, uTexel.y); offs[3] = vec2(0.0, -uTexel.y);
          float sil = 0.0, crease = 0.0;
          for (int i = 0; i < 4; i++) {
            vec4 n4 = texture2D(tNormal, vUv + offs[i]);
            float dn = viewDepth(vUv + offs[i]);
            // Silhouette : le voisin est du décor, ou une partie du perso nettement derrière
            if (n4.a > 0.5 || (dn - dc) / max(dc, 0.001) > uDepthTh) sil = 1.0;
            else crease = max(crease, step(uNormalTh, 1.0 - dot(nc, n4.xyz * 2.0 - 1.0)));
          }
          // b : opacité du trait (s'efface dans la brume) ; a : épaisseur relative selon la distance
          float k = clamp(uScale.x / max(dc, 0.01), uScale.y, 1.0);
          float fade = 1.0 - smoothstep(uFog.x, uFog.y, dc);
          gl_FragColor = vec4(sil, crease * k, fade, k);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.edgeQuad = new FullScreenQuad(this.edgeMat);

    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tEdge: { value: this.edgeRT.texture },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: O.radius },
        uLine: { value: new THREE.Color(O.color) },
        uCrease: { value: O.creaseOpacity },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse, tEdge;
        uniform vec2 uTexel;
        uniform float uRadius, uCrease;
        uniform vec3 uLine;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec4 e = texture2D(tEdge, vUv);
          // Silhouette épaissie : disque (2 anneaux de 12 points) autour des bords de silhouette.
          // Chaque bord a sa propre épaisseur (selon la distance de son objet) et sa propre opacité.
          float sil = e.r * e.b;
          for (int ring = 1; ring <= 2; ring++) {
            float r = uRadius * float(ring) * 0.5;
            for (int k = 0; k < 12; k++) {
              float a = (float(k) + 0.5 * float(ring)) * 0.5235988;
              vec4 s = texture2D(tEdge, vUv + vec2(cos(a), sin(a)) * r * uTexel);
              sil = max(sil, s.r * s.b * step(r, s.a * uRadius + 0.5));
            }
          }
          float edge = max(sil, e.g * e.b * uCrease);
          gl_FragColor = vec4(mix(base.rgb, uLine, edge), base.a);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.compQuad = new FullScreenQuad(this.compMat);
  }

  setSize(w: number, h: number) {
    this.normalRT.setSize(w, h);
    this.edgeRT.setSize(w, h);
    this.edgeMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.compMat.uniforms.uTexel.value.set(1 / w, 1 / h);
    // Épaisseur max (objets proches) ; chaque bord la réduit selon sa distance (passe de bords)
    this.compMat.uniforms.uRadius.value = O.radius * Math.max(1, h / 1080);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const scene = this.scene, cam = this.camera;
    const mask = cam.layers.mask, fog = scene.fog, bg = scene.background, override = scene.overrideMaterial;
    const autoClear = renderer.autoClear, clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.savedClear);
    scene.fog = null;
    scene.background = null;

    // 1. Profondeur du décor, puis normales des persos (alpha 0)
    renderer.setRenderTarget(this.normalRT);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.autoClear = false;
    cam.layers.set(0);
    scene.overrideMaterial = this.depthOnly;
    renderer.render(scene, cam);
    cam.layers.set(LAYER_CHARACTER);
    scene.overrideMaterial = this.normalChar;
    renderer.render(scene, cam);

    cam.layers.mask = mask;
    scene.overrideMaterial = override;
    scene.fog = fog;
    scene.background = bg;
    renderer.autoClear = autoClear;
    renderer.setClearColor(this.savedClear, clearAlpha);

    // 2. Bords
    renderer.setRenderTarget(this.edgeRT);
    this.edgeQuad.render(renderer);

    // 3. Composition
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compQuad.render(renderer);
  }

  dispose() {
    this.normalRT.dispose();
    this.edgeRT.dispose();
    this.edgeMat.dispose();
    this.compMat.dispose();
    this.edgeQuad.dispose();
    this.compQuad.dispose();
  }
}
