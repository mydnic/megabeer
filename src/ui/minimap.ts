import * as THREE from 'three';
import { MINIMAP as M } from '../config/hud';
import { PUMP_TIERS } from '../config/pumps';
import { PLANET, PLANET_RADIUS } from '../config/world';
import type { Pump } from '../game/pumps';
import type { Chest } from '../game/chests';
import type { CallBell } from '../game/lastCall';
import type { Zombie } from '../enemies/zombie';
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
 * pompes encore pleines en points de leur couleur, le Buveur en flèche au centre. Seul ce qui tient
 * dans le disque est montré : ni pompes vidées, ni flèches vers le lointain. Toute la planète est connue
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

  // Relief : petite image recalculée quelques fois par seconde dans un repère fixe (le « nord » du
  // point où elle a été faite), puis tournée et décalée à chaque image : elle suit la caméra sans à-coups
  const N = M.terrainResolution;
  const terrain = document.createElement('canvas');
  terrain.width = terrain.height = N;
  const tctx = terrain.getContext('2d')!;
  const img = tctx.createImageData(N, N);
  const low = new THREE.Color(M.colors.low), high = new THREE.Color(M.colors.high), rock = new THREE.Color(M.colors.rock), c = new THREE.Color();
  const relief = PLANET.relief.hills + PLANET.relief.bumps;
  let terrainAge = Infinity;

  const up = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  // Repère de l'image du relief : sa verticale (centre), son haut (nord) et sa droite
  const tUp = new THREE.Vector3(), tFwd = new THREE.Vector3(), tRight = new THREE.Vector3();
  const WY = new THREE.Vector3(0, 1, 0), WX = new THREE.Vector3(1, 0, 0);
  const span = M.range * M.terrainMargin; // demi-côté de l'image du relief (m)
  const d = new THREE.Vector3(), axis = new THREE.Vector3(), q = new THREE.Quaternion();
  const px = size * dpr, R = px / 2;
  const scale = R / M.range; // pixels par mètre

  /** Point de la planète en (x à droite, y vers le nord) m autour du centre de l'image, sur la sphère unité. */
  function dirAt(x: number, y: number, out: THREE.Vector3) {
    const dist = Math.hypot(x, y);
    if (dist < 1e-6) return out.copy(tUp);
    axis.copy(tRight).multiplyScalar(x).addScaledVector(tFwd, y).cross(tUp).normalize().negate();
    return out.copy(tUp).applyQuaternion(q.setFromAxisAngle(axis, dist / PLANET_RADIUS));
  }

  const toMap = (p: THREE.Vector3) => toMapCoords(up, fwd, right, p);

  function drawTerrain() {
    // Nouveau repère : centré sur le joueur, haut vers le nord du monde
    tUp.copy(up);
    const ref = Math.abs(tUp.dot(WY)) > 0.95 ? WX : WY;
    tFwd.copy(ref).addScaledVector(tUp, -ref.dot(tUp)).normalize();
    tRight.crossVectors(tFwd, tUp).normalize();
    const data = img.data;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = ((i + 0.5) / N * 2 - 1) * span, y = (1 - (j + 0.5) / N * 2) * span;
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
    update(dt: number, playerPos: THREE.Vector3, facing: THREE.Vector3, camFwd: THREE.Vector3, pumps: readonly Pump[], chests: readonly Chest[], bells: readonly CallBell[] = [], zombies: readonly Zombie[] = [], door: THREE.Vector3 | null = null) {
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
      // Le relief, ramené dans le repère de la caméra : décalé de là où il a été fait, tourné vers son nord
      const o = toMap(tUp), n = d.copy(tFwd).addScaledVector(up, -tFwd.dot(up));
      ctx.save();
      ctx.translate(R + o.x * scale, R - o.y * scale);
      ctx.rotate(Math.atan2(n.dot(right), n.dot(fwd)));
      ctx.drawImage(terrain, -span * scale, -span * scale, 2 * span * scale, 2 * span * scale);
      ctx.restore();

      // Coffres encore fermés dans le disque : petits carrés bruns
      const cs = M.chestSize * dpr;
      for (const c of chests) {
        if (c.opened) continue;
        const m = toMap(c.pos);
        if (m.dist > M.range * 0.95) continue;
        ctx.fillStyle = hex(M.colors.chest);
        ctx.fillRect(R + m.x * scale - cs / 2, R - m.y * scale - cs / 2, cs, cs);
        ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = '#1a120c';
        ctx.strokeRect(R + m.x * scale - cs / 2, R - m.y * scale - cs / 2, cs, cs);
      }

      // Pompes encore pleines dans le disque, en point de leur couleur ; rien d'autre (vidées ou trop loin)
      for (const p of pumps) {
        if (p.used) continue;
        const m = toMap(p.pos);
        if (m.dist > M.range * 0.92) continue;
        ctx.beginPath();
        ctx.arc(R + m.x * scale, R - m.y * scale, M.pumpDot * dpr, 0, Math.PI * 2);
        ctx.fillStyle = hex(PUMP_TIERS[p.tier].color); ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
      }

      // Cloches du Dernier service pas encore sonnées : toujours là, posées au bord du disque quand elles sont loin
      for (const b of bells) {
        if (b.rung) continue;
        const m = toMap(b.pos);
        const k = m.dist > M.range * 0.9 ? (M.range * 0.9) / m.dist : 1;
        ctx.beginPath();
        ctx.arc(R + m.x * k * scale, R - m.y * k * scale, M.bellDot * dpr, 0, Math.PI * 2);
        ctx.fillStyle = hex(M.colors.bell); ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
      }

      // Élites vivants dans le disque : points rouges
      for (const z of zombies) {
        if (!(z.elite || z.def.boss) || z.dead) continue;
        const m = toMap(z.pos);
        if (m.dist > M.range * 0.92) continue;
        ctx.beginPath();
        ctx.arc(R + m.x * scale, R - m.y * scale, M.eliteDot * dpr * (z.def.boss ? 1.8 : 1), 0, Math.PI * 2);
        ctx.fillStyle = hex(M.colors.elite); ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
      }

      // Porte du patron (fermée) : toujours là ; loin, posée au bord du disque avec une flèche qui pointe vers elle
      if (door) {
        const m = toMap(door);
        const edge = M.range * 0.78;
        const far = m.dist > edge;
        const k = far ? edge / m.dist : 1;
        const x = R + m.x * k * scale, y = R - m.y * k * scale, s = M.doorSize * dpr;
        if (far) {
          const a = Math.atan2(m.x, m.y);
          arrow(R + Math.sin(a) * R * 0.9, R - Math.cos(a) * R * 0.9, a, M.doorArrow * dpr, hex(M.colors.door));
        }
        // Arche : rectangle arrondi en haut, ouverture sombre
        ctx.beginPath();
        ctx.moveTo(x - s / 2, y + s / 2); ctx.lineTo(x - s / 2, y - s / 6);
        ctx.arc(x, y - s / 6, s / 2, Math.PI, 0); ctx.lineTo(x + s / 2, y + s / 2); ctx.closePath();
        ctx.fillStyle = hex(M.colors.door); ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = '#1a120c'; ctx.stroke();
        ctx.fillStyle = '#1a120c';
        ctx.fillRect(x - s / 6, y, s / 3, s / 2);
      }

      // Le Buveur au centre, tourné dans sa direction de marche
      const f = toMap(d.copy(playerPos).addScaledVector(facing, 5));
      arrow(R, R, Math.atan2(f.x, f.y), M.playerArrow * dpr, hex(M.colors.player));
      ctx.restore();
    },
  };
}
