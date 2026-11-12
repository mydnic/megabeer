import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZOMBIE_MODELS, ZOMBIE_VISUAL } from '../../src/config/zombies';

/**
 * Les modèles des ennemis générés par nos scripts Blender (src/assets/models/*.glb) : un export raté
 * peut sortir des animations figées, et l'ennemi glisse alors en T-pose dans le jeu.
 */
type Gltf = {
  animations: { name: string; channels: { sampler: number; target: { path: string } }[]; samplers: { output: number }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string }[];
  bufferViews: { byteOffset?: number }[];
};

function readGlb(file: string) {
  const b = readFileSync(join('src/assets/models', file));
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8')) as Gltf;
  const bin = b.subarray(20 + jsonLen + 8);
  return { json, bin };
}

/** Le plus grand écart d'un quaternion d'os par rapport à sa première image, sur toute l'animation. */
function rotationRange(glb: ReturnType<typeof readGlb>, clip: string) {
  const anim = glb.json.animations.find((a) => a.name === clip);
  if (!anim) return -1;
  let range = 0;
  for (const c of anim.channels) {
    if (c.target.path !== 'rotation') continue;
    const acc = glb.json.accessors[anim.samplers[c.sampler].output];
    const off = (glb.json.bufferViews[acc.bufferView].byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const f = (i: number) => glb.bin.readFloatLE(off + i * 4);
    for (let k = 1; k < acc.count; k++) {
      for (let j = 0; j < 4; j++) range = Math.max(range, Math.abs(f(k * 4 + j) - f(j)));
    }
  }
  return range;
}

const generated = Object.entries(ZOMBIE_MODELS).filter(([, m]) => m.file.endsWith('.glb') && !m.file.startsWith('character-') && !('separate' in m));
/** Modèles dessinés à part (boss) : ils ont leurs propres animations. */
const separate = Object.entries(ZOMBIE_MODELS).filter(([, m]) => 'separate' in m);

describe('Les modèles des ennemis', () => {
  it.each(generated)("%s bouge vraiment quand il attend, marche et frappe", (_, model) => {
    const glb = readGlb(model.file);
    const clips = { ...ZOMBIE_VISUAL.clips, ...('clips' in model ? model.clips : {}) };
    for (const state of ['idle', 'walk', 'attack'] as const) {
      const name = (clips[state] as readonly string[]).find((n) => glb.json.animations.some((a) => a.name === n));
      expect(name, `${model.file} : pas d'animation ${state}`).toBeDefined();
      expect(rotationRange(glb, name!), `${model.file} : ${name} est figée`).toBeGreaterThan(0.01);
    }
  });
  it.each(separate)('%s (boss) a toutes ses animations, et elles bougent', (_, model) => {
    const glb = readGlb(model.file);
    for (const name of ['idle', 'walk', 'strike', 'hit', 'roar', 'death']) {
      expect(glb.json.animations.some((a) => a.name === name), `${model.file} : pas d'animation ${name}`).toBe(true);
      expect(rotationRange(glb, name), `${model.file} : ${name} est figée`).toBeGreaterThan(0.01);
    }
  });
});
