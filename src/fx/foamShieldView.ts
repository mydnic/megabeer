import * as THREE from 'three';
import { FOAM_SHIELD_LOOK as L } from '../config/fx';
import { LAYER_SKY } from '../render/materials';

/**
 * Bouclier de la Mousse épaisse : une bulle de mousse translucide autour du Buveur par bouclier prêt
 * (une par exemplaire, emboîtées, chacune un peu plus large). Seul leur bord se voit (le Buveur reste
 * net dedans) ; elles respirent doucement. Une bulle apparaît en gonflant et disparaît d'un coup
 * quand elle absorbe un coup (c'est la plus large qui part).
 */
export function createFoamShieldView(scene: THREE.Scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(L.color) }, uOpacity: { value: L.opacity }, uRim: { value: L.rim } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uRim; varying vec3 vN; varying vec3 vV;
      void main() { float rim = pow(max(0.0, 1.0 - abs(dot(normalize(vN), normalize(vV)))), uRim); gl_FragColor = vec4(uColor, rim * uOpacity); }`,
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  const geo = new THREE.SphereGeometry(1, 32, 20);
  const layers = Array.from({ length: L.maxLayers }, () => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.layers.set(LAYER_SKY);
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, grow: 0 };
  });
  let t = 0;
  const up = new THREE.Vector3();

  return {
    /** Chaque image : nombre de bulles prêtes, position (pieds) du Buveur. */
    sync(dt: number, ready: number, feet: THREE.Vector3) {
      t += dt;
      up.copy(feet).normalize();
      layers.forEach((l, i) => {
        l.grow = i < ready ? Math.min(1, l.grow + dt / L.growTime) : 0;
        l.mesh.visible = l.grow > 0;
        if (!l.mesh.visible) return;
        l.mesh.position.copy(feet).addScaledVector(up, L.height);
        // Gonfle avec un petit rebond, puis respire (chaque bulle un peu décalée)
        const pop = 1 + Math.sin(l.grow * Math.PI) * 0.15;
        const breathe = 1 + Math.sin(t * L.breathe + i * 1.3) * L.breatheAmount;
        l.mesh.scale.setScalar((L.radius + i * L.layerGap) * l.grow * pop * breathe);
      });
    },
  };
}
