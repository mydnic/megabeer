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
    uniforms: { uColor: { value: new THREE.Color(L.color) }, uOpacity: { value: L.opacity }, uRim: { value: L.rim }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    // Bulle de savon : bord laiteux aux reflets irisés qui glissent, reflet de lumière en haut à gauche, fines rides
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uRim; uniform float uTime; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float rim = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), uRim);
        vec3 irid = 0.5 + 0.5 * cos(6.2831 * (rim * 1.3 + n.y * 0.35 + uTime * 0.12 + vec3(0.0, 0.33, 0.67)));
        vec3 col = mix(uColor, irid, 0.38 * rim);
        float spec = pow(clamp(dot(n, normalize(vec3(-0.45, 0.65, 0.6))), 0.0, 1.0), 60.0);
        float ripple = 0.5 + 0.5 * sin(n.y * 22.0 + uTime * 2.5 + n.x * 6.0);
        float a = rim * uOpacity * (0.82 + 0.18 * ripple) + spec * 0.85;
        gl_FragColor = vec4(col + spec, clamp(a, 0.0, 1.0));
      }`,
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
      mat.uniforms.uTime.value = t;
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
