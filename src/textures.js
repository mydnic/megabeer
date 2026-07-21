import * as THREE from 'three';

function makeCanvasTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function withRepeat(tex, x, y) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(x, y);
  return t;
}

// Ground fallback (used beyond the generated-chunk radius, see mapgen.js's
// VIEW_RADIUS) — kept close to terrain.js's TERRAIN_COLOR so its edge blends
// into fog instead of popping against the real terrain mesh.
const stoneTex = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = '#514f40';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = Math.random() * 3 + 0.5;
    const shade = 55 + Math.random() * 45;
    ctx.fillStyle = `rgba(${shade},${shade - 4},${shade - 14},0.5)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(28,28,20,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= s; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
  }
});

const woodTex = makeCanvasTexture((ctx, s) => {
  ctx.fillStyle = '#5a3d22';
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 6) {
    const shade = 60 + Math.random() * 30;
    ctx.strokeStyle = `rgba(${shade + 30},${shade},${shade - 20},0.5)`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 3);
    ctx.bezierCurveTo(s * 0.3, y + Math.random() * 5 - 2, s * 0.7, y + Math.random() * 5 - 2, s, y + Math.random() * 3);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(30,18,8,0.4)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * s, Math.random() * s, 4, 7, Math.random() * Math.PI, 0, 7);
    ctx.fill();
  }
});

function makeGradientMap(steps = 4) {
  const c = document.createElement('canvas');
  c.width = steps; c.height = 1;
  const ctx = c.getContext('2d');
  for (let i = 0; i < steps; i++) {
    const v = Math.floor(255 * (i + 1) / steps);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.Texture(c);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export const gradientMap = makeGradientMap(4);

export function toonMaterial(opts = {}) {
  return new THREE.MeshToonMaterial({ gradientMap, ...opts });
}

export function stoneMaterial(repeatX = 1, repeatY = 1) {
  return toonMaterial({ map: withRepeat(stoneTex, repeatX, repeatY) });
}

export function woodMaterial(repeatX = 1, repeatY = 1) {
  return toonMaterial({ map: withRepeat(woodTex, repeatX, repeatY) });
}
