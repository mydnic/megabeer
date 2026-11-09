import * as THREE from 'three';
import { PROTECTOR_LOOK as L } from '../config/enemies';
import type { Zombie } from './zombie';

/** Tache de lumière ronde, douce sur les bords (texture faite au vol, pas de fichier). */
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Rendu de la brique Protecteur (règle des buffs entre ennemis, voir PROTECTOR_LOOK) : une lueur
 * dorée qui palpite au-dessus de la tête de chaque protecteur. La lueur du corps des ennemis
 * protégés est faite par hordeView.
 */
export function createProtectorView(scene: THREE.Scene) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(), color: L.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sprites: THREE.Sprite[] = [];
  const up = new THREE.Vector3();
  const clock = new THREE.Clock();

  return {
    sync(zombies: readonly Zombie[]) {
      const t = clock.getElapsedTime();
      let n = 0;
      for (const z of zombies) {
        if (!z.def.protector || z.dead) continue;
        let s = sprites[n];
        if (!s) {
          s = new THREE.Sprite(material);
          s.renderOrder = 3;
          scene.add(s);
          sprites.push(s);
        }
        s.visible = true;
        up.copy(z.pos).normalize();
        s.position.copy(z.pos).addScaledVector(up, L.haloHeight - z.sink);
        // Battement propre à chacun
        s.scale.setScalar(L.haloSize * (1 + L.haloPulseAmount * Math.sin(t * L.haloPulse * Math.PI * 2 + z.speedMul * 40)));
        n++;
      }
      for (let i = n; i < sprites.length; i++) sprites[i].visible = false;
    },
  };
}
