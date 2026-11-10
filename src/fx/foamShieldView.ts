import * as THREE from 'three';
import { FOAM_SHIELD_LOOK as L } from '../config/fx';
import { LAYER_SKY } from '../render/materials';

/**
 * Bouclier de la Mousse épaisse : une bulle de mousse translucide autour du Buveur tant que le
 * bouclier est prêt. Seul son bord se voit (le Buveur reste net dedans) ; elle respire doucement.
 * Elle apparaît en gonflant et disparaît d'un coup quand elle absorbe un coup.
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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.radius, 32, 20), mat);
  mesh.layers.set(LAYER_SKY);
  mesh.visible = false;
  scene.add(mesh);
  let grow = 0, t = 0;
  const up = new THREE.Vector3();

  return {
    /** Chaque image : bouclier prêt ou non, position (pieds) du Buveur. */
    sync(dt: number, ready: boolean, feet: THREE.Vector3) {
      t += dt;
      grow = ready ? Math.min(1, grow + dt / L.growTime) : 0;
      mesh.visible = grow > 0;
      if (!mesh.visible) return;
      up.copy(feet).normalize();
      mesh.position.copy(feet).addScaledVector(up, L.height);
      // Gonfle avec un petit rebond, puis respire
      const pop = 1 + Math.sin(Math.min(1, grow) * Math.PI) * 0.15;
      mesh.scale.setScalar(grow * pop * (1 + Math.sin(t * L.breathe) * L.breatheAmount));
    },
  };
}
