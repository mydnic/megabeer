import * as THREE from 'three';
import { VFX as V, type ExplosionLook } from '../config/fx';
import { LAYER_SKY } from '../render/materials';
import type { Sprites, SpriteSpec } from './sprites';

/**
 * Recettes d'effets visuels, composées de particules (`fx/sprites.ts`) et de colonnes de lumière :
 * éclat d'impact, coup critique, ennemi qui part en fumée, explosion (éclair, braises, fumée),
 * poussière, étincelles qui montent, traînée de projectile. Tous les réglages sont dans `config/fx.ts`.
 */
export function createVfx(scene: THREE.Scene, sprites: Sprites) {
  const up = new THREE.Vector3(), dir = new THREE.Vector3(), vel = new THREE.Vector3(), at = new THREE.Vector3();
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  /** Réglage de la traînée, réutilisé à chaque appel (lancée des centaines de fois par image). */
  const trailSpec: SpriteSpec = { kind: 'glow', color: 0, size: 0, endSize: 0, life: V.trail.life, intensity: V.trail.intensity };
  /**
   * Nombre de particules à lancer pour une recette qui en veut `n` : tout tant que l'écran est calme, de moins
   * en moins quand la réserve se remplit (horde qui meurt en chaîne), pour que l'action reste lisible.
   */
  /** Écran déjà plein de lumières : les lueurs d'appoint (halos) ne s'ajoutent plus, pour ne pas blanchir l'image. */
  const calm = () => sprites.load(false) < V.crowd * 0.5;
  const budget = (n: number, smoke: boolean) => Math.max(1, Math.round(n * Math.max(0, 1 - sprites.load(smoke) / V.crowd)));

  /** Direction au hasard, ramenée vers le ciel de `lift` (0 : toutes directions, 1 : surtout vers le haut). */
  function scatter(lift: number) {
    dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(up, lift).normalize();
    return dir;
  }
  /** Direction au hasard dans le plan du sol. */
  function ground() {
    dir.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    return dir.addScaledVector(up, -dir.dot(up)).normalize();
  }

  // --- Colonnes de lumière (niveau gagné, coffre, pompe) : un cylindre lumineux qui jaillit et s'efface
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0);
  type Beam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; age: number; life: number; radius: number; height: number };
  const beams: Beam[] = [];
  const Y = new THREE.Vector3(0, 1, 0);
  function beamMesh(): Beam {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 1 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      // Plein au pied, il s'efface vers le haut ; bords doux ; filets de lumière qui montent
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          float face = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0001, 1.0), 1.4);
          float streak = 0.65 + 0.35 * sin(vUv.x * 50.0 + sin(vUv.x * 13.0) * 4.0) * sin(vUv.y * 9.0 - uTime * 9.0);
          float fall = clamp(1.0 - vUv.y, 0.0, 1.0);
          float a = pow(fall, 1.7) * clamp(face, 0.0, 1.0) * streak * uAlpha;
          gl_FragColor = vec4(uColor * (1.0 + fall), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(beamGeo, mat);
    mesh.layers.set(LAYER_SKY);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, mat, age: 0, life: 1, radius: 1, height: 1 };
  }

  const api = {
    /** Colonne de lumière de couleur `color` au pied `pos`, avec ses étincelles qui montent. */
    beam(pos: THREE.Vector3, color: number, radius: number = V.beam.radius, height: number = V.beam.height, life: number = V.beam.life) {
      const b = beams.find((x) => !x.mesh.visible) ?? (beams.length < V.beam.max ? (beams.push(beamMesh()), beams[beams.length - 1]) : beams[0]);
      up.copy(pos).normalize();
      b.mesh.position.copy(pos);
      b.mesh.quaternion.setFromUnitVectors(Y, up);
      (b.mat.uniforms.uColor.value as THREE.Color).set(color);
      b.age = 0; b.life = life; b.radius = radius; b.height = height;
      b.mesh.visible = true;
      api.sparkle(pos, color, V.beam.sparkles, radius, height * 0.45);
      sprites.emit(at.copy(pos).addScaledVector(up, 0.4), { kind: 'glow', color, size: radius * 3, endSize: radius * 4.5, life: life * 0.6, intensity: 0.45 });
    },

    /** Petit éclat blanc-doré là où un coup porte. */
    hit(pos: THREE.Vector3) {
      const H = V.hit;
      sprites.emit(pos, { kind: 'star', color: H.color, size: H.size, endSize: H.size * 1.5, life: H.life, intensity: H.intensity, rot: Math.random() * Math.PI });
    },

    /** Coup critique : grosse étoile orange, anneau, étincelles qui giclent. */
    crit(pos: THREE.Vector3) {
      const C = V.crit;
      up.copy(pos).normalize();
      sprites.emit(pos, { kind: 'star', color: C.color, size: C.size, endSize: C.size * 1.4, life: C.life, intensity: C.intensity, rot: Math.random() * Math.PI, spin: 3 });
      sprites.emit(pos, { kind: 'ring', color: C.color, size: C.size * 0.9, endSize: C.size * 1.5, life: C.life * 1.2, intensity: 1.4 });
      for (let i = 0; i < C.sparks; i++) {
        sprites.emit(pos, { kind: 'glow', color: C.color, size: 0.3, endSize: 0, life: rand(0.25, 0.45), vel: vel.copy(scatter(0.6)).multiplyScalar(rand(4, 8)), gravity: 0.8, intensity: 2.2 });
      }
    },

    /** Ennemi tué : il part en bouffées de fumée claire, avec un petit éclair. */
    kill(pos: THREE.Vector3) {
      const K = V.kill;
      up.copy(pos).normalize();
      at.copy(pos).addScaledVector(up, K.height);
      if (calm()) sprites.emit(at, { kind: 'glow', color: K.flash, size: 1.5, endSize: 2.2, life: 0.14, intensity: 0.5 });
      for (let i = budget(K.puffs, true); i > 0; i--) {
        sprites.emit(at, {
          kind: 'smoke', color: K.smoke, size: rand(0.3, 0.45), endSize: rand(0.55, 0.8), life: rand(0.25, 0.42),
          vel: vel.copy(scatter(0.5)).multiplyScalar(rand(1.5, 3.5)), drag: 3.5, gravity: -0.08, rot: Math.random() * 6.28, spin: rand(-2, 2),
        });
      }
    },

    /** Explosion de rayon `radius` : éclair, halo, anneau, braises qui retombent, fumée qui roule. */
    explosion(pos: THREE.Vector3, radius: number, L: ExplosionLook) {
      up.copy(pos).normalize();
      sprites.emit(pos, { kind: 'star', color: L.flash, size: radius * 1.3, endSize: radius * 2.1, life: 0.16, intensity: calm() ? 1.3 : 0.6, rot: Math.random() * Math.PI });
      if (calm()) sprites.emit(pos, { kind: 'glow', color: L.ember, size: radius * 1.4, endSize: radius * 2.4, life: 0.3, intensity: 0.5 });
      sprites.emit(pos, { kind: 'ring', color: L.flash, size: radius * 1.2, endSize: radius * 2.6, life: 0.36, intensity: 0.6 });
      for (let i = budget(L.embers, false); i > 0; i--) {
        sprites.emit(pos, {
          kind: 'glow', color: L.ember, size: rand(0.22, 0.42), endSize: 0, life: rand(0.5, 1.0),
          vel: vel.copy(scatter(0.9)).multiplyScalar(rand(0.8, 2.2) * radius + 3), gravity: 0.75, drag: 0.6, intensity: 2.4,
        });
      }
      for (let i = budget(L.puffs, true); i > 0; i--) {
        sprites.emit(at.copy(pos).addScaledVector(scatter(0.2), radius * 0.25), {
          kind: 'smoke', color: i % 3 === 0 ? L.smokeDark : L.smoke, size: radius * rand(0.2, 0.3), endSize: radius * rand(0.38, 0.55), life: rand(0.45, 0.8),
          vel: vel.copy(scatter(0.45)).multiplyScalar(radius * rand(1.2, 2.6)), drag: 3, gravity: -0.1, rot: Math.random() * 6.28, spin: rand(-1.5, 1.5),
        });
      }
    },

    /** Poussière au ras du sol : `count` bouffées qui s'écartent du point d'impact. */
    dust(pos: THREE.Vector3, count: number, size = 0.5, speed = 3) {
      up.copy(pos).normalize();
      at.copy(pos).addScaledVector(up, size * 0.4);
      for (let i = budget(count, true); i > 0; i--) {
        sprites.emit(at, {
          kind: 'smoke', color: V.dust.color, size: size * rand(0.6, 1), endSize: size * rand(1.2, 1.8), life: rand(0.35, 0.65),
          vel: vel.copy(ground()).multiplyScalar(speed * rand(0.5, 1)).addScaledVector(up, rand(0.3, 1.2)), drag: 3.5, rot: Math.random() * 6.28,
        });
      }
    },

    /** Étincelles en étoile qui s'élèvent autour de `pos` (dans un rayon `spread`, jusqu'à `rise` m/s). */
    sparkle(pos: THREE.Vector3, color: number, count: number, spread = 0.6, rise = 2) {
      up.copy(pos).normalize();
      for (let i = 0; i < count; i++) {
        at.copy(pos).addScaledVector(ground(), Math.random() * spread).addScaledVector(up, rand(0.1, 1.4));
        sprites.emit(at, {
          kind: 'star', color, size: rand(0.25, 0.6), endSize: 0.05, life: rand(0.45, 1.0),
          vel: vel.copy(up).multiplyScalar(rand(0.4, 1) * rise).addScaledVector(ground(), rand(0, 0.8)), drag: 1.2, intensity: 1.7, rot: Math.random() * 3, spin: rand(-4, 4),
        });
      }
    },

    /** Éclat rond (lueur, étoile et anneau) : bouclier qui éclate, onde, gel. */
    pop(pos: THREE.Vector3, color: number, size: number) {
      sprites.emit(pos, { kind: 'star', color, size: size * 1.6, endSize: size * 2.2, life: 0.2, intensity: 2.2, rot: Math.random() * Math.PI });
      sprites.emit(pos, { kind: 'ring', color, size, endSize: size * 2.6, life: 0.4, intensity: 1.3 });
    },

    /** Traînée d'un projectile en vol : une petite lueur qui reste derrière lui. */
    trail(pos: THREE.Vector3, color: number, size: number = V.trail.size) {
      // Des centaines de projectiles : les traînées s'effacent d'elles-mêmes au-delà d'une part de la réserve
      if (sprites.load(false) > V.trail.maxLoad) return;
      trailSpec.color = color; trailSpec.size = size;
      sprites.emit(pos, trailSpec);
    },

    /** Scintillement des objets à ramasser : de temps en temps, une étoile s'allume sur l'un d'eux. */
    twinkle(items: readonly { pos: THREE.Vector3 }[], color: number, dt: number, rate: number) {
      if (!items.length || Math.random() > rate * dt * Math.min(1, items.length / 12)) return;
      const d = items[Math.floor(Math.random() * items.length)];
      up.copy(d.pos).normalize();
      sprites.emit(at.copy(d.pos).addScaledVector(up, 0.25), { kind: 'star', color, size: 0.2, endSize: 0.9, life: 0.4, intensity: 1.5, spin: 5 });
    },

    update(dt: number) {
      for (const b of beams) {
        if (!b.mesh.visible) continue;
        b.age += dt;
        const k = b.age / b.life;
        if (k >= 1) { b.mesh.visible = false; continue; }
        // Jaillit d'un coup, s'élargit un peu, puis se resserre en s'effaçant
        const rise = 1 - (1 - Math.min(1, k * 5)) ** 3;
        const r = b.radius * (0.6 + 0.6 * rise) * (1 - k * k * 0.7);
        b.mesh.scale.set(r, b.height * rise, r);
        b.mat.uniforms.uAlpha.value = (1 - k) ** 1.4 * V.beam.opacity;
        b.mat.uniforms.uTime.value = b.age;
      }
    },
    clear() { for (const b of beams) b.mesh.visible = false; },
  };
  return api;
}

export type Vfx = ReturnType<typeof createVfx>;
