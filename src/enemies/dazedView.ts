import * as THREE from 'three';
import { DAZED_LOOK as L } from '../config/weapons';
import { ZOMBIE_MODELS } from '../config/zombies';
import type { Zombie } from './zombie';

/** Bulle de mousse (texture faite au vol) : disque crème cerclé de brun stout, petit reflet. */
function bubbleTexture() {
  const size = 64, c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.beginPath();
  g.arc(c, c, c - 6, 0, Math.PI * 2);
  g.fillStyle = L.fill;
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = L.stroke;
  g.stroke();
  g.beginPath();
  g.arc(c - 9, c - 9, 7, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fill();
  return new THREE.CanvasTexture(canvas);
}

/**
 * Zombies sonnés par la synergie Black and Tan : des bulles de mousse tournent autour de leur tête
 * (comme les étoiles d'un personnage assommé) tant que l'effet dure.
 */
export function createDazedView(scene: THREE.Scene) {
  const material = new THREE.SpriteMaterial({ map: bubbleTexture(), transparent: true, depthWrite: false });
  const sprites: THREE.Sprite[] = [];
  const up = new THREE.Vector3(), side = new THREE.Vector3(), front = new THREE.Vector3(), head = new THREE.Vector3();
  const clock = new THREE.Clock();
  return {
    sync(zombies: readonly Zombie[]) {
      const t = clock.getElapsedTime();
      let n = 0;
      for (const z of zombies) {
        if (z.dazed <= 0 || z.dead) continue;
        up.copy(z.pos).normalize();
        side.crossVectors(up, z.facing).normalize();
        front.crossVectors(side, up);
        head.copy(z.pos).addScaledVector(up, ZOMBIE_MODELS[z.model].height + L.aboveHead);
        for (let k = 0; k < L.count; k++) {
          let s = sprites[n];
          if (!s) {
            s = new THREE.Sprite(material);
            s.renderOrder = 3;
            scene.add(s);
            sprites.push(s);
          }
          const a = t * L.spin * Math.PI * 2 + (k / L.count) * Math.PI * 2 + z.speedMul * 10;
          s.position.copy(head).addScaledVector(side, Math.cos(a) * L.radius).addScaledVector(front, Math.sin(a) * L.radius);
          s.scale.setScalar(L.size);
          s.visible = true;
          n++;
        }
      }
      for (let i = n; i < sprites.length; i++) sprites[i].visible = false;
    },
  };
}
