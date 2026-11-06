import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import type { ArtStyle } from '../config/artStyles';
import { LAYER_CHARACTER, LAYER_NO_OUTLINE } from './toon';

export const OUTLINE = {
  depthThreshold: 0.035,
  normalThreshold: 0.35,
} as const;

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * Rendu en plusieurs passes :
 * 1. la scène normale dans une texture (couleur, MSAA) ;
 * 2. les normales et la profondeur des objets à contourer (personnages marqués par alpha 0) ;
 * 3. bords au pixel près (ruptures de profondeur et de normale, pixels de personnage) ;
 * 4. composition : traits du décor, trait épais des personnages (bord dilaté en disque), étalonnage ;
 * 5. FXAA à l'écran, qui lisse aussi les contours.
 */
export class Pipeline {
  private colorRT: THREE.WebGLRenderTarget;
  private normalRT: THREE.WebGLRenderTarget;
  private edgeRT: THREE.WebGLRenderTarget;
  private compRT: THREE.WebGLRenderTarget;
  private normalMat = new THREE.MeshNormalMaterial();
  /** Normales des personnages, avec alpha 0 : marque « personnage » lue par la passe de bords. */
  private normalCharMat = new THREE.MeshNormalMaterial();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private edgeScene = new THREE.Scene();
  private compScene = new THREE.Scene();
  private fxaaScene = new THREE.Scene();
  private edgeMat: THREE.ShaderMaterial;
  private mat: THREE.ShaderMaterial;
  private fxaa: THREE.ShaderMaterial;
  private baseThickness = 1.6;
  private charScale = 1;
  private height = 1080;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalRT.depthTexture = new THREE.DepthTexture(1, 1);
    this.normalRT.depthTexture.type = THREE.FloatType;
    this.edgeRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.compRT = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.normalCharMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('gl_FragColor.a = 1.0;', 'gl_FragColor.a = 0.0;');
    };
    this.normalCharMat.customProgramCacheKey = () => 'normal-character';
    camera.layers.enable(LAYER_CHARACTER);
    // Les ombres ne sont calculées qu'une fois par frame, pas à chaque passe
    renderer.shadowMap.autoUpdate = false;

    // --- Passe de bords. r : rupture de profondeur (dessinée côté objet le plus proche),
    // g : pli (rupture de normale), b : pixel de personnage.
    // Le décor est analysé avec l'écart « épaisseur », les persos au pixel près (épaissis ensuite).
    this.edgeMat = new THREE.ShaderMaterial({
      uniforms: {
        tNormal: { value: this.normalRT.texture },
        tDepth: { value: this.normalRT.depthTexture },
        uTexel: { value: new THREE.Vector2() },
        uNear: { value: camera.near },
        uFar: { value: camera.far },
        uThickness: { value: 1.6 },
        uDepthTh: { value: OUTLINE.depthThreshold },
        uNormalTh: { value: OUTLINE.normalThreshold },
        uFade: { value: new THREE.Vector2(90, 200) },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tNormal, tDepth;
        uniform vec2 uTexel, uFade;
        uniform float uNear, uFar, uThickness, uDepthTh, uNormalTh;
        varying vec2 vUv;
        float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
        void main() {
          vec4 nc4 = texture2D(tNormal, vUv);
          vec3 nc = nc4.xyz * 2.0 - 1.0;
          float ch = 1.0 - nc4.a;
          float dc = viewDepth(vUv);
          vec2 o = uTexel * mix(uThickness, 1.0, ch);
          vec2 offs[4];
          offs[0] = vec2(o.x, 0.0); offs[1] = vec2(-o.x, 0.0); offs[2] = vec2(0.0, o.y); offs[3] = vec2(0.0, -o.y);
          float dEdge = 0.0, nEdge = 0.0;
          for (int i = 0; i < 4; i++) {
            // Seul le pixel le plus proche dessine la ligne (évite les doubles contours)
            dEdge = max(dEdge, (viewDepth(vUv + offs[i]) - dc) / max(dc, 0.001));
            vec4 n4 = texture2D(tNormal, vUv + offs[i]);
            // Pas de pli entre un perso et le décor : la profondeur s'en charge
            if (abs(n4.a - nc4.a) < 0.5) nEdge = max(nEdge, 1.0 - dot(nc, n4.xyz * 2.0 - 1.0));
          }
          float keep = (1.0 - step(uFar * 0.99, dc)) * mix(1.0 - smoothstep(uFade.x, uFade.y, dc), 1.0, ch);
          gl_FragColor = vec4(step(uDepthTh, dEdge) * keep, step(uNormalTh, nEdge) * keep, ch, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.edgeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.edgeMat));

    // --- Composition : contours, étalonnage, vignette
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorRT.texture },
        tEdge: { value: this.edgeRT.texture },
        uTexel: { value: new THREE.Vector2() },
        uCharRadius: { value: 0 },
        uLine: { value: new THREE.Color() },
        uLineTint: { value: 0 },
        uLineDarken: { value: 0.3 },
        uSat: { value: 1 },
        uContrast: { value: 1 },
        uGain: { value: new THREE.Vector3(1, 1, 1) },
        uVignette: { value: 0 },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor, tEdge;
        uniform vec2 uTexel;
        uniform float uCharRadius, uLineTint, uLineDarken, uSat, uContrast, uVignette;
        uniform vec3 uLine, uGain;
        varying vec2 vUv;

        // Silhouette de perso épaissie : disque de rayon uCharRadius autour de chaque bord de silhouette
        float charSilhouette() {
          if (uCharRadius <= 0.0) return 0.0;
          float m = 0.0;
          for (int ring = 1; ring <= 2; ring++) {
            float r = uCharRadius * float(ring) * 0.5;
            for (int k = 0; k < 12; k++) {
              float a = (float(k) + 0.5 * float(ring)) * 0.5235988;
              vec4 e = texture2D(tEdge, vUv + vec2(cos(a), sin(a)) * r * uTexel);
              m = max(m, e.r * e.b);
            }
          }
          return m;
        }

        void main() {
          vec3 base = texture2D(tColor, vUv).rgb;
          vec4 e = texture2D(tEdge, vUv);
          float envEdge = max(e.r, e.g) * (1.0 - e.b);
          float charEdge = max(max(e.r, e.g) * e.b, charSilhouette());

          // Étalonnage
          vec3 c = base;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, uSat);
          c = (c - 0.18) * uContrast + 0.18;
          c *= uGain;

          // Décor : couleur fixe ou teintée par l'objet. Personnages : trait sombre plein.
          c = mix(c, mix(uLine, base * uLineDarken, uLineTint), envEdge * 0.9);
          c = mix(c, uLine, charEdge * 0.95);

          vec2 q = vUv - 0.5;
          c *= 1.0 - uVignette * smoothstep(0.25, 0.75, dot(q, q) * 2.0);

          // Encodage sRGB à la main : la cible intermédiaire est lue telle quelle par le FXAA puis l'écran
          gl_FragColor = sRGBTransferOETF(vec4(clamp(c, 0.0, 1.0), 1.0));
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.compScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));

    this.fxaa = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
      vertexShader: FXAAShader.vertexShader,
      fragmentShader: FXAAShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.fxaa.uniforms.tDiffuse.value = this.compRT.texture;
    this.fxaaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.fxaa));
  }

  /** Applique les réglages de contour et d'étalonnage d'un style. */
  applyStyle(s: ArtStyle) {
    const u = this.mat.uniforms;
    this.baseThickness = s.outline.thickness;
    this.charScale = s.character.outlineScale;
    u.uLine.value.set(s.outline.color);
    u.uLineTint.value = s.outline.tint;
    u.uLineDarken.value = s.outline.darken;
    this.edgeMat.uniforms.uFade.value.set(s.outline.fadeStart, s.outline.fadeEnd);
    u.uSat.value = s.grade.saturation;
    u.uContrast.value = s.grade.contrast;
    u.uGain.value.set(...s.grade.gain);
    u.uVignette.value = s.grade.vignette;
    this.updateThickness();
  }

  private updateThickness() {
    const k = Math.max(1, this.height / 1080);
    this.edgeMat.uniforms.uThickness.value = this.baseThickness * k;
    // Rayon du trait épais des persos (pixels) ; 0 quand ils ont le même trait que le décor
    this.mat.uniforms.uCharRadius.value = this.charScale > 1 ? (this.baseThickness * this.charScale * k) / 2 : 0;
  }

  setSize(w: number, h: number) {
    const pr = this.renderer.getPixelRatio();
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    for (const rt of [this.colorRT, this.normalRT, this.edgeRT, this.compRT]) rt.setSize(W, H);
    this.edgeMat.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.mat.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.fxaa.uniforms.resolution.value.set(1 / W, 1 / H);
    this.height = H;
    this.updateThickness();
  }

  render() {
    const r = this.renderer;
    // Passe 1 : couleur complète (ciel compris)
    this.camera.layers.enable(LAYER_NO_OUTLINE);
    this.camera.layers.enable(LAYER_CHARACTER);
    r.shadowMap.needsUpdate = true;
    r.setRenderTarget(this.colorRT);
    r.render(this.scene, this.camera);
    // Passe 2 : normales + profondeur, sans le ciel ; décor puis personnages (marqués)
    this.camera.layers.set(0);
    const fog = this.scene.fog;
    this.scene.fog = null;
    this.scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.normalRT);
    r.setClearColor(0x8080ff, 1);
    r.clear();
    r.render(this.scene, this.camera);
    this.camera.layers.set(LAYER_CHARACTER);
    this.scene.overrideMaterial = this.normalCharMat;
    const autoClear = r.autoClear;
    r.autoClear = false;
    r.render(this.scene, this.camera);
    r.autoClear = autoClear;
    this.scene.overrideMaterial = null;
    this.scene.fog = fog;
    this.camera.layers.set(0);
    this.camera.layers.enable(LAYER_NO_OUTLINE);
    this.camera.layers.enable(LAYER_CHARACTER);
    // Passe 3 : bords au pixel près
    r.setRenderTarget(this.edgeRT);
    r.render(this.edgeScene, this.quadCam);
    // Passe 4 : composition
    r.setRenderTarget(this.compRT);
    r.render(this.compScene, this.quadCam);
    // Passe 5 : FXAA à l'écran
    r.setRenderTarget(null);
    r.render(this.fxaaScene, this.quadCam);
  }
}
