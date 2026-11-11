import * as THREE from 'three';
import { TOURNEE_DROPS as D, TOURNEES } from '../config/tournees';
import { TOURNEE_IDS } from '../game/tournees';
import { LAYER_SKY } from '../render/materials';
import { iconDataUrl } from '../ui/iconKit';
import { TOURNEE_ICONS } from '../ui/tourneeIcons';
import type { XpDrop } from './xpDrops';

/** Halo rond dessiné une fois (dégradé blanc vers transparent), teinté par tournée. */
function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Rendu des tournées du bar au sol : leur icône (le même dessin que dans le HUD) face à la caméra, sur un
 * halo de leur couleur qui pulse ; elles clignotent avant de disparaître. Peu nombreuses : un sprite par
 * tournée au sol, tirés d'une réserve.
 */
export function createTourneeDropsView(scene: THREE.Scene) {
  const loader = new THREE.TextureLoader();
  const icons = TOURNEE_IDS.map((id) => {
    const tex = loader.load(iconDataUrl(TOURNEE_ICONS[id], 128));
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  });
  const halo = haloTexture();
  const halos = TOURNEE_IDS.map((id) => new THREE.SpriteMaterial({
    map: halo, color: TOURNEES[id].color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  type Slot = { icon: THREE.Sprite; glow: THREE.Sprite };
  const pool: Slot[] = [];
  const sprite = (m: THREE.SpriteMaterial, order: number) => {
    const s = new THREE.Sprite(m);
    s.layers.set(LAYER_SKY);
    s.renderOrder = order;
    s.visible = false;
    scene.add(s);
    return s;
  };
  let time = 0;

  return {
    /** Recopie les tournées au sol ; `dt` : temps de jeu (0 : figé). */
    sync(drops: readonly XpDrop[], dt: number) {
      time += dt;
      const n = Math.min(drops.length, D.max);
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        const slot = pool[i] ?? (pool[i] = { glow: sprite(halos[0], 5), icon: sprite(icons[0], 6) });
        slot.icon.material = icons[d.value];
        slot.glow.material = halos[d.value];
        // Elle sort en grossissant, pulse doucement ; dans ses dernières secondes, elle clignote
        const grow = Math.min(1, d.age * 5);
        const pulse = 1 + Math.sin(time * 5 + d.phase) * 0.08;
        const end = D.life - d.age;
        const shown = end > D.blink || d.flying || Math.sin(time * (end < 2 ? 30 : 16)) > -0.2;
        slot.icon.visible = slot.glow.visible = shown;
        slot.icon.position.copy(d.pos);
        slot.glow.position.copy(d.pos);
        slot.icon.scale.setScalar(D.radius * 2.3 * grow * pulse);
        slot.glow.scale.setScalar(D.radius * 3.2 * grow * (2 - pulse));
      }
      for (let i = n; i < pool.length; i++) pool[i].icon.visible = pool[i].glow.visible = false;
    },
  };
}
