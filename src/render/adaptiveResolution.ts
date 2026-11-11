import type * as THREE from 'three';
import { RENDER } from '../config/visual';

/**
 * Résolution adaptative : quand l'image ralentit et que c'est la carte graphique qui ne suit pas (le
 * calcul du jeu, lui, tient dans l'image), la résolution de rendu baisse d'un cran ; elle remonte
 * quand ça va mieux. L'interface (HTML) reste nette, seule la scène 3D est concernée. Sur une machine
 * qui tient la cadence, il ne se passe jamais rien.
 *
 * `apply(scale)` est appelé à chaque changement : à l'appelant de redimensionner ses cibles de rendu.
 */
export function createAdaptiveResolution(renderer: THREE.WebGLRenderer, apply: () => void) {
  const A = RENDER.adaptive;
  const base = renderer.getPixelRatio();
  let scale = 1;
  let frames = 0, time = 0, cpu = 0, wait = 0, calm = 0;

  function set(next: number) {
    scale = next;
    renderer.setPixelRatio(base * scale);
    apply();
    wait = A.cooldown;
  }

  return {
    /** Part de la résolution de base utilisée en ce moment (1 : pleine résolution). */
    get scale() { return scale; },
    /**
     * Chaque image : durée réelle de l'image (s) et temps de calcul du jeu dans cette image (ms).
     * Les grosses images isolées (changement d'onglet, chargement) ne comptent pas.
     */
    update(realDt: number, cpuMs: number) {
      if (!A.enabled || realDt > 0.25) return;
      frames++; time += realDt; cpu += cpuMs;
      if (time < A.window) return;
      const frameMs = (time / frames) * 1000, cpuAvg = cpu / frames;
      frames = 0; time = 0; cpu = 0;
      if (wait > 0) { wait -= A.window; return; }
      const fps = 1000 / frameMs;
      // Trop lent, et le calcul du jeu n'explique pas la durée de l'image : la carte graphique sature
      if (fps < A.lowFps && cpuAvg < frameMs * A.cpuShare && scale > A.minScale) {
        calm = 0;
        set(Math.max(A.minScale, scale - A.step));
      } else if (fps >= A.highFps && scale < 1) {
        // Ça tient depuis un moment : on retente un cran plus net
        if (++calm >= A.calmWindows) { calm = 0; set(Math.min(1, scale + A.step)); }
      } else calm = 0;
    },
    /** Revient à la pleine résolution (retour à l'accueil). */
    reset() { if (scale !== 1) set(1); calm = 0; },
  };
}
