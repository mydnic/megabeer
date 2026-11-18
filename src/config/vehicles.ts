// Véhicules écrase-zombies (GDD section 9, issue #8) : trouvés sur le terrain, on monte dedans au contact. Pendant la
// conduite plus aucune arme ne tire, on écrase les ennemis ; le véhicule a ses PV et une durée, puis on en sort
// invulnérable un instant. Conduite de vraie voiture (choix de l'utilisateur le 2026-11-18) : avancer accélère, reculer
// freine puis passe en marche arrière, gauche/droite braque (d'autant plus que la voiture roule vite), l'arrière
// glisse un peu dans les virages.

/** Conduite : vitesses (m/s), accélération et freinage (m/s²), traînée (par s), braquage (rad/s à pleine vitesse de
 * braquage, atteinte à `steerFullAt` m/s), adhérence (par s : plus bas, plus de glisse), rayon de collision (m). */
export type CarDef = { maxSpeed: number; reverseSpeed: number; accel: number; brake: number; drag: number; steerRate: number; steerFullAt: number; grip: number; radius: number };

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
};

export const VEHICLES = {
  delorean: {
    name: 'DeLorean', file: 'delorean.glb', rotation: [0, 0, 0], length: 4.2, rarity: 1, duration: 15, hp: 80,
    car: { maxSpeed: 22, reverseSpeed: 7, accel: 15, brake: 32, drag: 0.35, steerRate: 2.4, steerFullAt: 5, grip: 5, radius: 1.2 },
    crush: { radius: 1.9, minSpeed: 3, damage: 25, perSpeed: 3, knock: 2.5, again: 0.5, bossMul: 0.4 },
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
  /** Véhicules qui peuvent être tirés (le bus et le tank arrivent au checkpoint suivant). */
  pool: ['delorean'] as readonly VehicleId[],
} as const;

/** Rendu : colonne de lumière au-dessus du véhicule garé (hauteur m), vitesse de rotation des roues (tours par m). */
export const VEHICLE_LOOK = { beamHeight: 9, beamRadius: 1.1, wheelTurnsPerMeter: 0.5 } as const;
