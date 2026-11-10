import * as THREE from 'three';
import { MINIMAP as M } from '../config/hud';
import { PUMP_TIERS } from '../config/pumps';
import { PLANET, PLANET_RADIUS } from '../config/world';
import type { Pump } from '../game/pumps';
import { heightAt } from '../world/terrain';
import { toMapCoords } from '../world/mapProjection';

const CSS = `
.mm { position: fixed; right: 18px; bottom: 18px; z-index: 10; pointer-events: none; user-select: none; display: none;
  border-radius: 50%; border: 4px solid #1a120c; box-shadow: 0 5px 0 rgba(26,18,12,.55), inset 0 0 0 2px rgba(255,244,220,.35); }
.mm.on { display: block; }
`;

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/**
 * Mini-carte : disque vu du dessus, centré sur le Buveur et tourné comme la caméra (le haut du disque
 * = devant la caméra). Le relief en teintes (creux sombres, collines claires, montagnes grises), les
 * pompes en points de leur couleur (grises une fois vidées), le Buveur en flèche au centre. Les pompes
 * pleines les plus proches hors du disque sont des flèches sur le bord. Toute la planète est connue
 * (pas de brouillard, choix de l'utilisateur le 2026-11-10).
 */
export function createMinimap() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const size = M.size;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'mm';
  canvas.width = canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = `${size}px`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  // Relief : petite image recalculée quelques fois par seconde, agrandie avec lissage
  const N = M.terrainResolution;
  const terrain = document.createElement('canvas');
  terrain.width = terrain.height = N;
  const tctx = terrain.getContext('2d')!;
  const img = tctx.createImageData(N, N);
  const low = new THREE.Color(M.colors.low), high = new THREE.Color(M.colors.high), rock = new THREE.Color(M.colors.rock), c = new THREE.Color();
  const relief = PLANET.relief.hills + PLANET.relief.bumps;
  let terrainAge = Infinity;

  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const d = new THREE.Vector3(), axis = new THREE.Vector3(), q = new THREE.Quaternion();
  const px = size * dpr, R = px / 2;
  const scale = R / M.range; // pixels par mètre

  /** Point de la planète en (x à droite, y devant) m autour du joueur, sur la sphère unité. */
  function dirAt(x: number, y: number, out: THREE.Vector3) {
    const dist = Math.hypot(x, y);
    if (dist < 1e-6) return out.copy(up);
    axis.copy(right).multiplyScalar(x).addScaledVector(fwd, y).cross(up).normalize().negate();
    return out.copy(up).applyQuaternion(q.setFromAxisAngle(axis, dist / PLANET_RADIUS));
  }

  const toMap = (p: THREE.Vector3) => toMapCoords(up, fwd, right, p);

  function drawTerrain() {
    const data = img.data;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = ((i + 0.5) / N * 2 - 1) * M.range, y = (1 - (j + 0.5) / N * 2) * M.range;
        const h = heightAt(dirAt(x, y, d));
        const t = THREE.MathUtils.clamp((h + relief) / (2 * relief), 0, 1);
        c.copy(low).lerp(high, t);
        if (h > M.rockFrom) c.lerp(rock, THREE.MathUtils.clamp((h - M.rockFrom) / M.rockBlend, 0, 1));
        const k = (j * N + i) * 4;
        data[k] = c.r * 255; data[k + 1] = c.g * 255; data[k + 2] = c.b * 255; data[k + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
  }

  /** Flèche (pointe vers `angle`, 0 = haut) centrée en (x, y). */
  function arrow(x: number, y: number, angle: number, s: number, fill: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, s * 0.7); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.75, s * 0.7); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
    ctx.restore();
  }

  return {
    setVisible(v: boolean) { canvas.classList.toggle('on', v); },
    /** Chaque image : position du joueur, sa direction, l'avant de la caméra, les pompes. */
    update(dt: number, playerPos: THREE.Vector3, facing: THREE.Vector3, camFwd: THREE.Vector3, pumps: readonly Pump[]) {
      if (!canvas.classList.contains('on')) return;
      up.copy(playerPos).normalize();
      fwd.copy(camFwd).addScaledVector(up, -camFwd.dot(up)).normalize();
      right.crossVectors(fwd, up).normalize();

      terrainAge += dt;
      if (terrainAge >= 1 / M.terrainHz) { terrainAge = 0; drawTerrain(); }
      ctx.clearRect(0, 0, px, px);
      ctx.save();
      ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(terrain, 0, 0, px, px);

      // Pompes : dans le disque, un point ; pleines et hors du disque, les plus proches en flèche au bord
      const outside: { x: number; y: number; dist: number; color: string }[] = [];
      for (const p of pumps) {
        const m = toMap(p.pos);
        const color = hex(p.used ? M.colors.usedPump : PUMP_TIERS[p.tier].color);
        if (m.dist <= M.range * 0.92) {
          ctx.beginPath();
          ctx.arc(R + m.x * scale, R - m.y * scale, M.pumpDot * dpr, 0, Math.PI * 2);
          ctx.fillStyle = color; ctx.fill();
          ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
        } else if (!p.used) outside.push({ ...m, color });
      }
      outside.sort((a, b) => a.dist - b.dist);
      for (const o of outside.slice(0, M.edgeArrows)) {
        const a = Math.atan2(o.x, o.y);
        const r = R - M.pumpDot * 1.6 * dpr;
        arrow(R + Math.sin(a) * r, R - Math.cos(a) * r, a, M.pumpDot * 1.3 * dpr, o.color);
      }

      // Le Buveur au centre, tourné dans sa direction de marche
      const f = toMap(d.copy(playerPos).addScaledVector(facing, 5));
      arrow(R, R, Math.atan2(f.x, f.y), M.playerArrow * dpr, hex(M.colors.player));
      ctx.restore();
    },
  };
}
