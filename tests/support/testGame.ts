import * as THREE from 'three';
import { Game, type GameEvents } from '../../src/game/game';
import { PLANET_RADIUS, PLAYER_PHYSICS } from '../../src/config/world';
import { ZOMBIE_MODELS, type ZombieModel } from '../../src/config/zombies';
import type { InputState } from '../../src/core/input';
import type { ZombieTimings } from '../../src/enemies/zombie';
import { DecorCollider } from '../../src/world/decor/collider';
import { computeGridShape } from '../../src/world/decor/gridShape';
import { randomSpawn } from '../../src/world/decor/layout';
import { heightAt, setTerrainSeed } from '../../src/world/terrain';
import { NO_INPUT } from '../../src/game/game';

/** Durées d'animation des zombies dans les tests (les vraies viennent des modèles 3D). */
const clip = (duration: number) => ({ start: 0, frames: 1, duration });
export const TEST_ZOMBIE_TIMINGS: ZombieTimings = {
  scale: 1,
  clips: { idle: clip(2), walk: clip(1), attack: clip(1.2), hit: clip(0.4), death: clip(1.5), cast: clip(0.5) },
};

/** Images par seconde de la simulation dans les tests. */
export const FPS = 60;

/**
 * Un jeu prêt à tester : vraie planète (relief d'une seed fixe), sans décor ni rendu. Les helpers
 * pilotent le jeu comme un joueur et notent tous les événements annoncés.
 */
/**
 * `coins` : un ennemi tué lâche-t-il une capsule au lieu de son XP ? « never » par défaut (les tests
 * d'XP restent exacts), « always », ou « real » (la vraie chance de la config).
 */
export function createTestGame(seed = 1, opts: { coins?: 'never' | 'always' | 'real'; random?: () => number } = {}) {
  setTerrainSeed(seed);
  const collider = new DecorCollider([], PLAYER_PHYSICS.stepHeight, PLAYER_PHYSICS.headClearance);
  const kinds = Object.fromEntries((Object.keys(ZOMBIE_MODELS) as ZombieModel[]).map((m) => [m, TEST_ZOMBIE_TIMINGS])) as Record<ZombieModel, ZombieTimings>;
  const coins = opts.coins ?? 'never';
  const game = new Game({ zombieKinds: kinds, collider, rollCoin: coins === 'real' ? undefined : () => coins === 'always', random: opts.random });

  /** Tous les événements reçus, dans l'ordre. */
  const log: { type: keyof GameEvents; payload: unknown }[] = [];
  const types: (keyof GameEvents)[] = ['runStarted', 'landed', 'zombieSpawned', 'playerHurt', 'zombieHit', 'projectileHitGround', 'xpCollected', 'levelGained', 'levelUpOffered', 'cardPicked', 'paused', 'resumed', 'died', 'runEnded', 'home', 'bellToll', 'bellsLanding', 'bellsSurgeEnded', 'enemyThrow', 'enemyShotLanded', 'kamikazeArmed', 'enemyExploded', 'summonCast', 'summoned', 'enemySplit', 'synergyActivated', 'weaponExploded', 'pumpFilled', 'statGained', 'coinsCollected', 'chestRevealing', 'chestOpened', 'chestDenied', 'itemGained', 'itemExploded', 'foamShieldUp', 'foamShieldPopped', 'happyHourStarted', 'happyHourEnded'];
  for (const t of types) game.events.on(t, (payload) => log.push({ type: t, payload }));

  const api = {
    game,
    log,
    /** Événements reçus d'un type donné. */
    events<K extends keyof GameEvents>(type: K) {
      return log.filter((e) => e.type === type).map((e) => e.payload as GameEvents[K]);
    },
    /** Avance de `seconds` secondes réelles, image par image, avec une entrée (par défaut : rien). */
    play(seconds: number, input: Partial<InputState> = {}) {
      const frames = Math.round(seconds * FPS);
      for (let i = 0; i < frames; i++) game.step(1 / FPS, { ...NO_INPUT, ...input });
    },
    /** Avance jusqu'à ce que la condition soit vraie (au plus `maxSeconds`) ; renvoie vrai si atteinte. */
    playUntil(cond: () => boolean, maxSeconds = 30, input: Partial<InputState> = {}) {
      for (let i = 0; i < maxSeconds * FPS; i++) {
        if (cond()) return true;
        game.step(1 / FPS, { ...NO_INPUT, ...input });
      }
      return cond();
    },
    /** Lance une run sur un point praticable de la planète et attend l'atterrissage. */
    startRunAndLand() {
      const spawn = randomSpawn(() => true)!;
      game.startRun(spawn);
      api.playUntil(() => !game.arriving, 10);
      return spawn;
    },
    /** Point au sol à `dist` m devant le joueur (décalé de `side` m sur sa droite). */
    inFront(dist: number, side = 0) {
      const p = game.player;
      const up = p.pos.clone().normalize();
      const right = new THREE.Vector3().crossVectors(p.facing, up).normalize();
      return up.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(p.facing, dist).addScaledVector(right, side);
    },
    /**
     * Un mur droit en travers, à `dist` m devant le joueur : `width` m de large, 3 m de haut
     * (il bloque les corps, comme le décor de la planète).
     */
    wall(dist: number, width: number) {
      const p = game.player;
      const up = p.pos.clone().normalize();
      const right = new THREE.Vector3().crossVectors(up, p.facing).normalize();
      const at = api.inFront(dist);
      at.setLength(PLANET_RADIUS + heightAt(at.clone().normalize()));
      const geo = new THREE.BoxGeometry(width, 3, 0.6).translate(0, 1.5, 0);
      const world = new THREE.Matrix4().makeBasis(right, up, p.facing.clone()).setPosition(at);
      collider.reset([{
        pos: at, inv: world.clone().invert(), rot: new THREE.Quaternion().setFromRotationMatrix(world),
        shape: computeGridShape(geo, 0.25),
      }]);
    },
    /** Retire tous les zombies (pour isoler un scénario). */
    clearZombies() { game.horde.clear(); },
    /** Arène calme : plus aucune arrivée de zombies, et ceux déjà là sont retirés. */
    noSpawns() { game.director.enabled = false; game.horde.clear(); },
  };
  return api;
}
