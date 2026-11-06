import * as THREE from 'three';
import { BEER_SPLASH as B } from '../config/buveur';
import { characterMaterial } from '../render/materials';
import { groundRadius } from '../world/terrain';

type Drop = { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number; size: number; foam: boolean };

/**
 * Petit gimmick autour de la pinte : quelques flocons de mousse (et de rares gouttes de bière) qui
 * sautent du verre et disparaissent vite. Tout est instancié (1 draw call).
 */
export class BeerSplash {
  private drops: Drop[] = [];
  private mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private beer = new THREE.Color(B.beerColor);
  private foam = new THREE.Color(B.foamColor);

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), characterMaterial({ color: 0xffffff }), B.maxDrops);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(B.maxDrops * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /**
   * Émet `count` flocons depuis `origin`. `base` : vitesse héritée ; `up` : verticale locale ;
   * `upSpeed` / `spread` : vitesse verticale et dispersion latérale (m/s).
   */
  emit(origin: THREE.Vector3, base: THREE.Vector3, up: THREE.Vector3, count: number, upSpeed: [number, number], spread: number) {
    for (let i = 0; i < count; i++) {
      if (this.drops.length >= B.maxDrops) this.drops.shift();
      const vel = base.clone().addScaledVector(up, upSpeed[0] + Math.random() * (upSpeed[1] - upSpeed[0]));
      this.tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
      this.tmp.addScaledVector(up, -this.tmp.dot(up)).normalize().multiplyScalar(spread * (0.3 + Math.random() * 0.7));
      vel.add(this.tmp);
      const foam = Math.random() < B.foamRatio;
      const life = B.dropLife * (0.6 + Math.random() * 0.8);
      this.drops.push({
        pos: origin.clone(), vel, life, maxLife: life,
        size: (foam ? B.foamSize : B.dropSize) * (0.6 + Math.random() * 0.8), foam,
      });
    }
  }

  update(dt: number) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      const up = this.tmp.copy(d.pos).normalize();
      d.vel.addScaledVector(up, -B.gravity * dt).multiplyScalar(1 - B.drag * dt);
      d.pos.addScaledVector(d.vel, dt);
      if (d.life <= 0 || d.pos.length() <= groundRadius(up)) this.drops.splice(i, 1);
    }
    let n = 0;
    for (const d of this.drops) {
      // Gonfle vite à l'apparition, puis rétrécit jusqu'à disparaître
      const t = 1 - d.life / d.maxLife;
      const r = d.size * Math.min(1, t / 0.15) * Math.min(1, d.life / (d.maxLife * 0.5));
      this.q.identity();
      this.m.compose(d.pos, this.q, this.s.set(r, r, r));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, d.foam ? this.foam : this.beer);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
