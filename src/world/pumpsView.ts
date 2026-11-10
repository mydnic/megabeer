import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PUMP_LOOK as L, PUMPS, PUMP_TIERS } from '../config/pumps';
import { characterMaterial, LAYER_CHARACTER, LAYER_SKY } from '../render/materials';
import type { Pump } from '../game/pumps';

const urls = import.meta.glob('../assets/models/pompe.glb', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Ce qui représente une pompe : le fût, son faisceau, sa zone, la pinte-jauge au-dessus. */
type PumpMesh = { root: THREE.Group; hoops: THREE.MeshToonMaterial; beam: THREE.Mesh; zone: THREE.Mesh; zoneMat: THREE.ShaderMaterial; pint: THREE.Group; beer: THREE.Mesh; foam: THREE.Mesh };

/** Sphère de la zone : transparent au centre, seuls ses bords (là où on le voit de biais) luisent. */
function zoneMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: L.zoneOpacity }, uRim: { value: L.zoneRim } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uRim; varying vec3 vN; varying vec3 vV;
      void main() { float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uRim); gl_FragColor = vec4(uColor, rim * uOpacity); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
}

/**
 * Rendu des pompes à bière : le fût sur chevalet du KayKit (cerclages en bronze, argent ou or), un
 * faisceau de lumière de la couleur de la pompe, visible de loin, et au-dessus une pinte en verre
 * qui se remplit de bière avec la jauge. Vidée, la pompe perd son faisceau et sa pinte, ses
 * cerclages deviennent ternes. Faisceau et pinte sur la couche du ciel (hors occlusion ambiante).
 */
export async function createPumpsView(scene: THREE.Scene) {
  const url = Object.values(urls)[0];
  const gltf = await new GLTFLoader().loadAsync(url);
  const template = gltf.scene;
  // Posé sur ses pieds, à la hauteur voulue
  const box = new THREE.Box3().setFromObject(template);
  const scale = L.height / (box.max.y - box.min.y);
  template.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);

  const wood = characterMaterial({ color: L.wood });
  const zoneGeo = new THREE.SphereGeometry(PUMPS.radius, 48, 32);
  const beamGeo = new THREE.CylinderGeometry(L.beamRadius, L.beamRadius, L.beamHeight, 16, 1, true).translate(0, L.beamHeight / 2, 0);
  const glassGeo = new THREE.CylinderGeometry(L.pintRadius, L.pintRadius * 0.85, L.pintHeight, 16, 1, true).translate(0, L.pintHeight / 2, 0);
  const beerGeo = new THREE.CylinderGeometry(L.pintRadius * 0.92, L.pintRadius * 0.8, 1, 16).translate(0, 0.5, 0);
  const foamGeo = new THREE.CylinderGeometry(L.pintRadius * 0.95, L.pintRadius * 0.95, L.foam, 16);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const beerMat = new THREE.MeshBasicMaterial({ color: L.beer });
  const foamMat = new THREE.MeshBasicMaterial({ color: L.foamColor });
  const meshes: PumpMesh[] = [];
  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3();
  const sky = (o: THREE.Object3D) => { o.layers.set(LAYER_SKY); return o; };

  function build(): PumpMesh {
    const root = new THREE.Group();
    const keg = template.clone(true);
    const hoops = characterMaterial({ color: 0xffffff });
    keg.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = (m.material as THREE.Material).name.startsWith('Cerclage') ? hoops : wood;
      m.castShadow = true;
      m.layers.set(LAYER_CHARACTER);
    });
    const holder = new THREE.Group();
    holder.add(keg);
    holder.scale.setScalar(scale);
    root.add(holder);
    const beam = sky(new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      transparent: true, opacity: L.beamOpacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }))) as THREE.Mesh;
    root.add(beam);
    const zoneMat = zoneMaterial();
    const zone = sky(new THREE.Mesh(zoneGeo, zoneMat)) as THREE.Mesh;
    root.add(zone);
    // Pinte-jauge : verre, bière qui monte, mousse au-dessus
    const pint = new THREE.Group();
    pint.position.y = L.pintAbove;
    const beer = sky(new THREE.Mesh(beerGeo, beerMat)) as THREE.Mesh;
    const foam = sky(new THREE.Mesh(foamGeo, foamMat)) as THREE.Mesh;
    pint.add(sky(new THREE.Mesh(glassGeo, glassMat)), beer, foam);
    root.add(pint);
    scene.add(root);
    return { root, hoops, beam, zone, zoneMat, pint, beer, foam };
  }

  const clock = new THREE.Clock();
  return {
    /** Recopie l'état des pompes (position, qualité, remplissage, vidée) ; `inside` : celle où se tient le joueur. */
    sync(pumps: readonly Pump[], inside: Pump | null) {
      const t = clock.getElapsedTime();
      pumps.forEach((p, i) => {
        const m = meshes[i] ?? (meshes[i] = build());
        m.root.visible = true;
        up.copy(p.pos).normalize();
        m.root.position.copy(p.pos);
        m.root.quaternion.setFromUnitVectors(Y, up);
        const T = PUMP_TIERS[p.tier];
        m.hoops.color.setHex(p.used ? L.usedHoops : T.color);
        m.beam.visible = !p.used;
        (m.beam.material as THREE.MeshBasicMaterial).color.setHex(T.color);
        m.pint.visible = !p.used;
        m.zone.visible = !p.used;
        m.zoneMat.uniforms.uColor.value.setHex(T.color);
        m.zoneMat.uniforms.uOpacity.value = p === inside ? L.zoneOpacityInside : L.zoneOpacity;
        // La pinte tourne doucement ; la bière monte avec la jauge, la mousse la suit
        m.pint.rotation.y = t * 0.8;
        const h = Math.max(0.001, p.fill) * (L.pintHeight - L.foam);
        m.beer.scale.y = h;
        m.foam.position.y = h + L.foam / 2;
        m.foam.visible = p.fill > 0.02;
      });
      for (let i = pumps.length; i < meshes.length; i++) meshes[i].root.visible = false;
    },
  };
}
