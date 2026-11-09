import * as THREE from 'three';
import { GLASS_SHARDS, type ShardLook } from '../config/fx';
import { PLAYER_PHYSICS } from '../config/world';

/**
 * Gerbes de petits morceaux projetés (éclats de verre par défaut, gouttes de vin, éclats de bois...),
 * qui rebondissent sur le sol de la planète puis rapetissent et disparaissent. Un seul dessin pour tous.
 */
export function createShards(scene: THREE.Scene, groundAt: (p: THREE.Vector3) => number, G: ShardLook = GLASS_SHARDS) {
  const geo = G.shape === 'drop' ? new THREE.IcosahedronGeometry(1, 0) : new THREE.TetrahedronGeometry(1, 0).scale(1, 0.35, 0.7);
  const mat = new THREE.MeshToonMaterial({ color: G.color, emissive: G.color, emissiveIntensity: G.glow });
  const mesh = new THREE.InstancedMesh(geo, mat, G.max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);

  type Shard = { pos: THREE.Vector3; vel: THREE.Vector3; rot: THREE.Quaternion; spin: THREE.Vector3; size: number; life: number; max: number };
  const shards: Shard[] = [];
  const up = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4(), s = new THREE.Vector3();

  return {
    /** Gerbe au point d'impact ; `dir` = direction du coup (les morceaux partent surtout vers l'avant). */
    burst(pos: THREE.Vector3, dir: THREE.Vector3) {
      up.copy(pos).normalize();
      for (let i = 0; i < G.perBurst; i++) {
        if (shards.length >= G.max) shards.shift();
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(G.speed * (0.4 + Math.random() * 0.8));
        v.addScaledVector(dir, G.forward).addScaledVector(up, G.upward * Math.random());
        shards.push({
          pos: pos.clone(), vel: v, rot: new THREE.Quaternion().random(),
          spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(G.spin),
          size: G.size * (0.5 + Math.random()), life: 0, max: G.life * (0.7 + Math.random() * 0.6),
        });
      }
    },
    update(dt: number) {
      for (let i = shards.length - 1; i >= 0; i--) {
        const p = shards[i];
        p.life += dt;
        if (p.life > p.max) { shards.splice(i, 1); continue; }
        up.copy(p.pos).normalize();
        p.vel.addScaledVector(up, -PLAYER_PHYSICS.gravity * dt);
        p.pos.addScaledVector(p.vel, dt);
        const g = groundAt(p.pos) + p.size * 0.3;
        if (p.pos.length() < g) {
          p.pos.setLength(g);
          const vr = p.vel.dot(up);
          if (vr < 0) p.vel.addScaledVector(up, -vr * 1.35);
          p.vel.multiplyScalar(0.55);
          p.spin.multiplyScalar(0.5);
        }
        const w = p.spin.length();
        if (w > 1e-3) p.rot.premultiply(q.setFromAxisAngle(tmp.copy(p.spin).divideScalar(w), w * dt));
      }
      shards.forEach((p, i) => {
        // Rapetisse sur la fin de sa vie
        const k = p.size * Math.min(1, (p.max - p.life) / (p.max * 0.35));
        mesh.setMatrixAt(i, m.compose(p.pos, p.rot, s.setScalar(k)));
      });
      mesh.count = shards.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { shards.length = 0; mesh.count = 0; },
  };
}
