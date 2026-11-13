import * as THREE from 'three';
import { LOADING } from '../config/hud';
import { createDecor } from '../world/decor';
import { buildTerrain, buildTerrainSteps, setTerrainSeed } from '../world/terrain';
import { LIGHT_RENDER, TERRAIN_DETAIL } from '../render/quality';

/**
 * La planète affichée : une seed, son relief et son décor. Une nouvelle planète à chaque run ; la
 * première (générée au lancement) sert telle quelle. La génération se fait par petits morceaux pour
 * que la barre de chargement avance.
 */
export async function createPlanet(scene: THREE.Scene) {
  const newSeed = () => Math.floor(Math.random() * 0x7fffffff);
  let seed = newSeed();
  setTerrainSeed(seed);
  let terrain = buildTerrain(TERRAIN_DETAIL);
  // Rendu léger (téléphone) : le terrain reçoit les ombres sans en projeter (une passe d'ombre bien plus légère)
  terrain.castShadow = !LIGHT_RENDER;
  scene.add(terrain);
  const decor = await createDecor(scene);
  decor.generate(seed);
  let fresh = true;

  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  /** Fait tourner un générateur d'étapes, quelques ms par image ; son avancement (0 à 1) est ramené dans [from, to]. */
  async function run<T>(steps: Generator<number, T>, from: number, to: number, progress: (k: number) => void): Promise<T> {
    let t0 = performance.now();
    for (;;) {
      const r = steps.next();
      if (r.done) return r.value;
      if (performance.now() - t0 > LOADING.frameBudgetMs) {
        progress(from + (to - from) * r.value);
        await nextFrame();
        t0 = performance.now();
      }
    }
  }

  return {
    decor,
    get seed() { return seed; },
    /** La planète n'a pas encore servi (la prochaine run peut la prendre sans chargement). */
    get fresh() { return fresh; },
    /** La planète en cours sert à une run : la suivante devra en générer une nouvelle. */
    use() { fresh = false; },
    /** Génère une nouvelle planète, en rendant la main à l'écran entre deux morceaux. */
    async regenerate(progress: (k: number) => void) {
      seed = newSeed();
      progress(0);
      await nextFrame();
      setTerrainSeed(seed);
      const t = await run(buildTerrainSteps(TERRAIN_DETAIL), 0.02, 0.72, progress);
      scene.remove(terrain);
      terrain.geometry.dispose();
      (terrain.material as THREE.Material).dispose();
      terrain = t;
      terrain.castShadow = !LIGHT_RENDER;
      scene.add(terrain);
      await run(decor.generateSteps(seed), 0.72, 1, progress);
      progress(1);
      await nextFrame();
      fresh = true;
    },
  };
}
export type Planet = Awaited<ReturnType<typeof createPlanet>>;
