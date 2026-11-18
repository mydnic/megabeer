// Véhicules écrase-zombies (GDD section 9, issue #8) : trouvés sur le terrain, on monte dedans au contact. Pendant la
// conduite plus aucune arme ne tire, on écrase les ennemis ; le véhicule a ses PV et une durée, puis on en sort
// invulnérable un instant. Conduite de vraie voiture (choix de l'utilisateur le 2026-11-18) : avancer accélère, reculer
// freine puis passe en marche arrière, gauche/droite braque (d'autant plus que la voiture roule vite), l'arrière
// glisse un peu dans les virages.

/** Conduite : vitesses (m/s), accélération et freinage (m/s²), traînée (par s), braquage (rad/s à pleine vitesse de
 * braquage, atteinte à `steerFullAt` m/s), adhérence (par s : plus bas, plus de glisse), rayon de collision (m). */
export type CarDef = { maxSpeed: number; reverseSpeed: number; accel: number; brake: number; drag: number; steerRate: number; steerFullAt: number; grip: number; radius: number;
  /** Chenilles (le tank) : il tourne sur place, même à l'arrêt. */
  pivot?: boolean };

/** Canon (le tank) : un obus toutes les `every` s sur l'ennemi le plus proche à moins de `range` m, à `speed` m/s ; il
 * explose à l'arrivée (`damage` x la montée des PV des ennemis, rayon `radius` m, recul `knock`). */
export type CannonDef = { every: number; range: number; speed: number; damage: number; radius: number; knock: number };

/** Écrasement : un ennemi touché à moins de `radius` m, voiture à plus de `minSpeed` m/s, prend `damage` + `perSpeed` x
 * la vitesse (x la montée des PV des ennemis), est projeté (`knock` : x le recul d'un coup normal), et ne reprend pas de coup avant `again` s. Les boss
 * prennent `bossMul` des dégâts. */
export type CrushDef = { radius: number; minSpeed: number; damage: number; perSpeed: number; knock: number; again: number; bossMul: number };

export type VehicleDef = {
  name: string;
  /** Modèle (src/assets/models/vehicules/<file>), sa rotation pour regarder vers l'avant (degrés, repère three.js) et sa longueur (m). */
  file: string; rotation: readonly [number, number, number]; length: number;
  /** Rareté (index dans RARITIES) : couleur de sa colonne de lumière, et tirage plus rare. */
  rarity: number;
  /** Durée de conduite (s) et PV du véhicule. */
  duration: number; hp: number;
  car: CarDef;
  crush: CrushDef;
  cannon?: CannonDef;
};

export const VEHICLES = {
  delorean: {
    name: 'DeLorean', file: 'delorean.glb', rotation: [0, 0, 0], length: 4.2, rarity: 1, duration: 15, hp: 80,
    car: { maxSpeed: 22, reverseSpeed: 7, accel: 15, brake: 32, drag: 0.35, steerRate: 2.4, steerFullAt: 5, grip: 5, radius: 1.2 },
    crush: { radius: 1.9, minSpeed: 3, damage: 25, perSpeed: 3, knock: 2.5, again: 0.5, bossMul: 0.4 },
  },
  /** Bus scolaire : lent à lancer et à tourner, mais long et large, il écrase en masse et encaisse. */
  bus: {
    name: 'Bus scolaire', file: 'bus.glb', rotation: [-90, 0, 0], length: 8, rarity: 2, duration: 20, hp: 180,
    car: { maxSpeed: 16, reverseSpeed: 5, accel: 8, brake: 22, drag: 0.3, steerRate: 1.5, steerFullAt: 6, grip: 7, radius: 2.0 },
    crush: { radius: 3.2, minSpeed: 2.5, damage: 30, perSpeed: 3, knock: 3, again: 0.5, bossMul: 0.4 },
  },
  /** Tank : lent, il tourne sur place, presque indestructible, et son canon tire des obus explosifs. */
  tank: {
    name: 'Tank', file: 'tank.glb', rotation: [0, 90, 0], length: 6, rarity: 4, duration: 25, hp: 400,
    car: { maxSpeed: 10, reverseSpeed: 6, accel: 7, brake: 20, drag: 0.8, steerRate: 1.7, steerFullAt: 1, grip: 12, radius: 2.0, pivot: true },
    crush: { radius: 2.8, minSpeed: 1.5, damage: 40, perSpeed: 4, knock: 2, again: 0.5, bossMul: 0.4 },
    cannon: { every: 1.4, range: 24, speed: 34, damage: 55, radius: 3.6, knock: 2.5 },
  },
} as const satisfies Record<string, VehicleDef>;

export type VehicleId = keyof typeof VEHICLES;

/**
 * Placement (choix de l'utilisateur le 2026-11-18 : pas à côté du joueur, il faut le trouver) : un seul véhicule par run,
 * garé au hasard dès le début, à plus de `minFromSpawn` m du point d'arrivée et `minFromOthers` m des coffres et des
 * pompes, sur un sol libre et assez plat (`flatRadius` m, écart de hauteur `maxBump` m) ; il attend toute la run. Une
 * fois utilisé, il n'y en a plus. On monte dedans à moins de `enterRange` m. En sortant : `exitInvuln` s
 * d'invulnérabilité. `hitAgain` : délai entre deux coups encaissés par le véhicule (s). `minDist`/`maxDist` : distance au
 * joueur d'un véhicule garé à côté (panneau DEV).
 */
export const VEHICLE_SPAWN = {
  minFromSpawn: 60, minFromOthers: 6, minDist: 5, maxDist: 7, flatRadius: 2.4, maxBump: 0.7, tries: 400,
  enterRange: 2.6, exitInvuln: 2, hitAgain: 0.35,
  /** Véhicules qui peuvent être tirés (au poids de leur rareté : la DeLorean le plus souvent, le tank rarement). */
  pool: ['delorean', 'bus', 'tank'] as readonly VehicleId[],
} as const;

/** Rendu : colonne de lumière au-dessus du véhicule garé (hauteur m), vitesse de rotation des roues (tours par m). */
export const VEHICLE_LOOK = { beamHeight: 9, beamRadius: 1.1, wheelTurnsPerMeter: 0.5,
  /** Inclinaison sur le relief : le sol est relu à cette part de la demi-longueur et de la demi-largeur, et suivi à ce
   * rythme en conduite (par s : plus haut, plus sec). */
  groundProbe: 0.8, tiltRate: 12,
  /** Tank : vitesse de la tourelle (rad/s), animation des chenilles (vitesse du clip pour 1 m/s), obus (rayon m, couleur). */
  turretRate: 5, tracksPerSpeed: 0.18, shell: { radius: 0.18, color: 0x3a3a30 } } as const;
