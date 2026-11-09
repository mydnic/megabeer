import * as THREE from 'three';
import { PROTECTOR_LOOK as L } from '../config/enemies';
import { LAYER_SKY } from '../render/materials';
import type { Zombie } from './zombie';

/**
 * Étoile de lumière (texture faite au vol, pas de fichier) : un cœur doux, quatre longs rayons
 * fins et quatre rayons courts en diagonale.
 */
function starTexture() {
  const size = 128, c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.globalCompositeOperation = 'lighter';
  // Cœur
  const core = g.createRadialGradient(c, c, 0, c, c, size * 0.22);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);
  // Rayons : losanges très allongés, qui s'effacent vers la pointe
  const ray = (angle: number, length: number, width: number) => {
    g.save();
    g.translate(c, c);
    g.rotate(angle);
    const grad = g.createLinearGradient(0, 0, length, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, -width);
    g.lineTo(length, 0);
    g.lineTo(0, width);
    g.closePath();
    g.fill();
    g.restore();
  };
  for (let i = 0; i < 4; i++) ray((i * Math.PI) / 2, c * 0.98, 3.5);
  for (let i = 0; i < 4; i++) ray((i * Math.PI) / 2 + Math.PI / 4, c * 0.5, 2.5);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Rendu de la brique Protecteur (règle des buffs entre ennemis, voir PROTECTOR_LOOK) : une étoile
 * dorée qui scintille au-dessus de la tête de chaque protecteur (elle tourne lentement, ses éclats
 * vacillent sans rythme régulier, une seconde étoile plus petite tourne en sens inverse). La lueur
 * du corps des ennemis protégés est faite par hordeView.
 */
export function createProtectorView(scene: THREE.Scene) {
  const map = starTexture();
  type Star = { big: THREE.Sprite; small: THREE.Sprite };
  const stars: Star[] = [];
  const up = new THREE.Vector3();
  const clock = new THREE.Clock();
  const sprite = () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: L.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.renderOrder = 3;
    // Couche du ciel : visible, mais hors des passes d'occlusion ambiante et de profondeur de champ
    // (qui dessineraient le carré du sprite en sombre)
    s.layers.set(LAYER_SKY);
    scene.add(s);
    return s;
  };
  /** Scintillement : somme de sinus de fréquences sans rapport simple (pas de battement régulier). */
  const twinkle = (t: number, seed: number) =>
    0.55 * Math.sin(t * 7.3 + seed) + 0.3 * Math.sin(t * 13.1 + seed * 2.7) + 0.15 * Math.sin(t * 23.7 + seed * 5.1);

  return {
    sync(zombies: readonly Zombie[]) {
      const t = clock.getElapsedTime();
      let n = 0;
      for (const z of zombies) {
        if (!z.def.protector || z.dead) continue;
        let s = stars[n];
        if (!s) stars.push((s = { big: sprite(), small: sprite() }));
        const seed = z.speedMul * 40;
        const k = twinkle(t, seed);
        up.copy(z.pos).normalize();
        for (const sp of [s.big, s.small]) {
          sp.visible = true;
          sp.position.copy(z.pos).addScaledVector(up, L.haloHeight - z.sink);
        }
        s.big.scale.setScalar(L.haloSize * (1 + L.twinkleSize * k));
        s.big.material.rotation = t * L.spin + seed;
        s.big.material.opacity = 0.85 + 0.15 * k;
        s.small.scale.setScalar(L.haloSize * 0.55 * (1 - L.twinkleSize * k));
        s.small.material.rotation = -t * L.spin * 1.7 + seed + Math.PI / 4;
        s.small.material.opacity = 0.6 - 0.3 * k;
        n++;
      }
      for (let i = n; i < stars.length; i++) stars[i].big.visible = stars[i].small.visible = false;
    },
  };
}
