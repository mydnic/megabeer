import * as THREE from 'three';
import { DOOM_MOUNTAIN as DM } from '../config/doom';
import { PLANET_RADIUS } from '../config/world';
import { LAYER_SKY } from '../render/materials';
import { doomSite, heightAt } from './terrain';

/**
 * La Montagne du Destin vue de près et de loin : l'anneau de lave lumineux au fond du cratère (posé sur le relief), et
 * une colonne rouge au-dessus du cratère, visible de loin. Refait quand la planète change (une montagne par planète).
 */
export function createDoomView(scene: THREE.Scene) {
  const SEG = 96, RINGS = 4;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(SEG * (RINGS + 1) * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx: number[] = [];
  for (let r = 0; r < RINGS; r++) {
    for (let i = 0; i < SEG; i++) {
      const a = r * SEG + i, b = r * SEG + ((i + 1) % SEG), c = a + SEG, d = b + SEG;
      idx.push(a, c, b, b, c, d);
    }
  }
  geo.setIndex(idx);
  const lava = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(DM.lavaColor).multiplyScalar(DM.lavaGlow), toneMapped: false, side: THREE.DoubleSide }));
  lava.layers.set(LAYER_SKY);
  lava.frustumCulled = false;
  scene.add(lava);

  const B = DM.beam;
  const beamGeo = new THREE.CylinderGeometry(B.radius * 0.5, B.radius, B.height, 24, 1, true).translate(0, B.height / 2, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: B.color, transparent: true, opacity: B.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.layers.set(LAYER_SKY);
  scene.add(beam);

  const built = new THREE.Vector3();
  let t = 0;
  const up = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3();

  function build() {
    built.copy(doomSite.dir);
    const c = doomSite.dir;
    t1.crossVectors(c, Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    t2.crossVectors(c, t1);
    for (let r = 0; r <= RINGS; r++) {
      const s = DM.lava.inner + ((DM.lava.outer - DM.lava.inner) * r) / RINGS;
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        dir.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
        p.copy(c).applyAxisAngle(up.crossVectors(c, dir).normalize(), s / PLANET_RADIUS);
        p.multiplyScalar(PLANET_RADIUS + heightAt(p) + 0.06);
        pos.set([p.x, p.y, p.z], (r * SEG + i) * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeBoundingSphere();
    // Au-dessus de la crête : la colonne se voit de loin sans voiler l'arène
    beam.position.copy(c).multiplyScalar(PLANET_RADIUS + heightAt(c) + DM.depth + B.above);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c);
  }

  return {
    sync(dt: number) {
      if (!built.equals(doomSite.dir)) build();
      t += dt;
      // La lave pulse doucement
      (lava.material as THREE.MeshBasicMaterial).color.set(DM.lavaColor).multiplyScalar(DM.lavaGlow * (0.85 + 0.15 * Math.sin(t * 2.2)));
      (beam.material as THREE.MeshBasicMaterial).opacity = B.opacity * (0.85 + 0.15 * Math.sin(t * 1.3));
    },
  };
}
