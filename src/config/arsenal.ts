// Armes du roster V1 ajoutées après les cinq premières (GDD section 6) : une entrée de réglages par arme, son
// apparence et ses cartes d'amélioration. Les cinq premières vivent dans config/weapons.ts et config/upgrades.ts.

import type { UpgradeDef } from './upgrades';
import type { BottleConfig } from '../weapons/bottleWeapon';

const DMG: UpgradeDef = { id: 'damage', label: 'dégâts', value: 0.15, kind: 'percent' };
const CRIT: UpgradeDef = { id: 'critChance', label: 'chances de critique', value: 0.04, kind: 'points' };
const CRITM: UpgradeDef = { id: 'critMult', label: 'multiplicateur critique', value: 0.15, kind: 'mult' };

/**
 * Bière de Noël (n° 9) : des bouteilles tournent sans arrêt autour du joueur et frappent les zombies qu'elles
 * traversent (chaque zombie au plus une fois toutes les `rehit` s par bouteille). Défense rapprochée.
 */
export const BIERE_NOEL = {
  damage: 9,
  critChance: 0.05,
  critMult: 2,
  /** Rayon de l'orbite (m, multiplié par la Taille), hauteur des bouteilles (m), tours par seconde (x Vitesse d'attaque). */
  radius: 2.3,
  height: 1.0,
  turnsPerSecond: 0.55,
  /** Rayon de contact d'une bouteille et corps d'un zombie (m). */
  hitRadius: 0.35,
  zombieRadius: 0.4,
  /** Un même zombie n'est frappé qu'une fois toutes les `rehit` s par bouteille. */
  rehit: 0.6,
  /** Recul (fois le recul normal). */
  knock: 1.2,
  /** Nombre de bouteilles au départ. */
  count: 2,
} as const;

export const BIERE_NOEL_LOOK = {
  file: 'bouteille_stout.glb',
  length: 0.55,
  /** Verre vert sapin, étiquette rouge, capsule dorée. */
  colors: { Verre: 0x1f5a2c, Etiquette: 0xc8102e, Bouchon: 0xe8b33a } as Record<string, number>,
} as const;

export const BIERE_NOEL_SOUND = { sample: 'impactGlass_light', volume: 0.35, pitch: 1.2, gap: 0.06 } as const;

export const BIERE_NOEL_UPGRADES: readonly UpgradeDef[] = [
  DMG,
  { id: 'rate', label: 'vitesse de rotation', value: 0.12, kind: 'percent' },
  { id: 'projectiles', label: 'bouteille en plus', value: 1, kind: 'flat', whole: true },
  { id: 'size', label: "rayon de l'orbite", value: 0.10, kind: 'percent' },
  CRIT, CRITM,
];


/**
 * Décapsuleur (n° 14) : boomerang lancé vers un zombie ; il file, ralentit, revient vers le joueur et frappe chaque
 * zombie traversé une fois à l'aller et une fois au retour. Les décapsuleurs en plus partent en éventail.
 */
export const DECAPSULEUR = {
  cooldown: 2.4,
  firstDelay: 0.6,
  damage: 16,
  critChance: 0.05,
  critMult: 2,
  /** Portée de détection de la cible (m), vitesse au lancer (m/s), rappel vers le joueur (m/s²). */
  range: 14,
  speed: 17,
  pull: 16,
  /** Hauteur de vol au-dessus du sol (m), contact du décapsuleur et corps d'un zombie (m). */
  height: 1.1,
  hitRadius: 0.4,
  zombieRadius: 0.4,
  /** Rattrapé à cette distance du joueur au retour (m) ; durée de vie maxi (s). */
  catchDist: 0.9,
  life: 4,
  /** Écart entre deux décapsuleurs d'une volée (rad), tours par seconde sur lui-même. */
  spread: 0.4,
  spinRate: 4,
  knock: 1,
} as const;

export const DECAPSULEUR_LOOK = {
  file: 'decapsuleur.glb',
  length: 0.42,
  colors: { Metal: 0xd4d8de, Manche: 0xc8102e } as Record<string, number>,
} as const;

export const DECAPSULEUR_SOUND = { sample: 'impactMetal_light', volume: 0.4, pitch: 1.1, gap: 0.04 } as const;

export const DECAPSULEUR_UPGRADES: readonly UpgradeDef[] = [
  DMG,
  { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' },
  { id: 'projectiles', label: 'décapsuleur en plus', value: 1, kind: 'flat', whole: true },
  { id: 'speed', label: 'portée du lancer', value: 0.10, kind: 'percent' },
  { id: 'size', label: 'taille', value: 0.10, kind: 'percent' },
  CRIT, CRITM,
];

/**
 * Flaque de bière (n° 13) : le joueur laisse derrière lui une traînée de flaques en se déplaçant (une tous les
 * `dropEvery` m). Un zombie qui marche dedans glisse et tombe : étourdi `stun` s et quelques dégâts, puis il ne peut
 * pas reglisser avant `slipCooldown` s. Contrôle plus que dégâts.
 */
export const FLAQUE_BIERE = {
  damage: 5,
  critChance: 0,
  critMult: 2,
  /** Distance parcourue entre deux flaques (m, divisée par la Vitesse d'attaque), rayon (m, x Taille), durée (s). */
  dropEvery: 1.5,
  radius: 1.15,
  life: 3.5,
  /** Étourdi au sol (s), et délai avant de pouvoir reglisser (s). */
  stun: 1.1,
  slipCooldown: 2.6,
  /** Corps d'un zombie (m) : il glisse dès que ses pieds touchent la flaque. */
  zombieRadius: 0.25,
} as const;

export const FLAQUE_BIERE_ZONE = { color: 0xe8a826, rim: 0xb86e12, opacity: 0.8, lift: 0.06, fadeIn: 0.15, fadeOut: 0.8 } as const;
export const FLAQUE_BIERE_SOUND = { sample: 'impactSoft_medium', volume: 0.35, pitch: 1.3, gap: 0.08 } as const;

export const FLAQUE_BIERE_UPGRADES: readonly UpgradeDef[] = [
  DMG,
  { id: 'rate', label: 'flaques plus serrées', value: 0.10, kind: 'percent' },
  { id: 'size', label: 'taille des flaques', value: 0.10, kind: 'percent' },
  { id: 'duration', label: 'durée des flaques', value: 0.15, kind: 'percent' },
  { id: 'stun', label: "durée de l'étourdissement", value: 0.15, kind: 'percent' },
];

// ------------------------------------------------------------------------------------------------ armes à bouteilles
// Même brique que la Canette (weapons/bottleWeapon.ts) : réglages de base communs, puis ce qui change.


const THROWN = {
  cooldown: 1.5, damage: 12, critChance: 0.05, critMult: 2, range: 17, speed: 17, gravity: 14, spinRate: 2.2,
  radius: 0.16, zombieHeight: 1.8, zombieRadius: 0.4, gestureDuration: 0.6, maxGestureRate: 4, volleyGap: 0.07,
  releaseDelay: 0.22, aimHeight: 1.1, life: 3, knock: 1, pierce: 0,
} as const;
const PROJ: UpgradeDef = { id: 'projectiles', label: 'projectile en plus', value: 1, kind: 'flat', whole: true };
const RANGE: UpgradeDef = { id: 'range', label: 'portée', value: 0.10, kind: 'percent' };
const RATEU: UpgradeDef = { id: 'rate', label: "vitesse d'attaque", value: 0.10, kind: 'percent' };

/** Kriek (n° 4) : bouteille de bière à la cerise qui éclabousse à l'impact : dégâts autour et zombies ralentis. */
export const KRIEK: BottleConfig = { ...THROWN, cooldown: 1.7, damage: 11, splashRadius: 2.1, splashDamage: 0.6, slow: 0.4, slowTime: 1.6 };
export const KRIEK_LOOK = { file: 'bouteille_gueuze.glb', length: 0.42, colors: { Verre: 0x5a0a18, Bouchon: 0xe2203a } as Record<string, number> } as const;
export const KRIEK_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, PROJ, { id: 'size', label: "taille de l'éclaboussure", value: 0.12, kind: 'percent' }, RANGE, CRIT, CRITM];

/** Triple (n° 5) : bouteille qui rebondit d'un zombie à l'autre (3 zombies d'une chaîne). */
export const TRIPLE: BottleConfig = { ...THROWN, cooldown: 1.6, damage: 13, speed: 19, gravity: 11, bounces: 2, bounceRange: 6.5, bounceGain: 1 };
export const TRIPLE_LOOK = { file: 'bouteille_stout.glb', length: 0.42, colors: { Verre: 0xa86a14, Etiquette: 0xf2e3b0, Bouchon: 0xe8b33a } as Record<string, number> } as const;
export const TRIPLE_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, PROJ, { id: 'bounces', label: 'rebond en plus', value: 1, kind: 'flat', whole: true }, RANGE, CRIT, CRITM];

/** IPA (n° 6) : bouteille amère qui met le feu : le zombie touché brûle quelques secondes. */
export const IPA: BottleConfig = { ...THROWN, cooldown: 1.4, damage: 10, burn: 0.45, burnTime: 3 };
export const IPA_LOOK = { file: 'bouteille_gueuze.glb', length: 0.42, colors: { Verre: 0x2e6b2a, Bouchon: 0xf08a1a } as Record<string, number> } as const;
export const IPA_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, PROJ, { id: 'burn', label: 'dégâts de brûlure', value: 0.20, kind: 'percent' }, RANGE, CRIT, CRITM];

/** Dessous de verre (n° 11) : lancé à plat comme un frisbee, il file droit et traverse plusieurs zombies. */
export const SOUS_BOCK: BottleConfig = { ...THROWN, cooldown: 1.5, damage: 10, speed: 21, gravity: 1.5, spinRate: 6, pierce: 3, life: 1.3, aimHeight: 1.0, spin: 'flat' };
export const SOUS_BOCK_LOOK = { file: 'sousbock.glb', length: 0.4, fit: 'max', colors: { Carton: 0xf3ead6, Impression: 0xc8102e } as Record<string, number> } as const;
export const SOUS_BOCK_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, PROJ, { id: 'pierce', label: 'zombie traversé en plus', value: 1, kind: 'flat', whole: true }, { id: 'speed', label: 'vitesse des projectiles', value: 0.10, kind: 'percent' }, CRIT, CRITM];

/** Fléchettes (n° 19) : tir tendu et précis sur le zombie le plus solide à portée, souvent critique. */
export const FLECHETTES: BottleConfig = { ...THROWN, cooldown: 1.3, damage: 17, critChance: 0.15, critMult: 2.5, speed: 30, gravity: 2, range: 20, aim: 'strong', spin: 'forward', spinRate: 3 };
export const FLECHETTES_LOOK = { file: 'flechette.glb', length: 0.38, colors: { Metal: 0xd8dce2, Corps: 0x24242a, Ailettes: 0xe2203a } as Record<string, number> } as const;
export const FLECHETTES_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, PROJ, RANGE, { id: 'critChance', label: 'chances de critique', value: 0.06, kind: 'points' }, { id: 'critMult', label: 'multiplicateur critique', value: 0.25, kind: 'mult' }];

export const BOTTLE_SOUNDS = {
  kriek: { sample: 'impactGlass_medium', volume: 0.4, pitch: 1.15, gap: 0.04 },
  triple: { sample: 'impactGlass_light', volume: 0.4, pitch: 0.95, gap: 0.04 },
  ipa: { sample: 'impactGlass_medium', volume: 0.35, pitch: 1.0, gap: 0.04 },
  sousBock: { sample: 'impactPlank_medium', volume: 0.35, pitch: 1.4, gap: 0.04 },
  flechettes: { sample: 'impactMetal_light', volume: 0.4, pitch: 1.5, gap: 0.03 },
} as const;

/** Bouchons de champagne (n° 17) : une rafale de bouchons part d'un coup en éventail vers un zombie. */
export const BOUCHONS: BottleConfig = { ...THROWN, cooldown: 1.9, damage: 7, count: 5, fan: 0.17, speed: 25, gravity: 6, life: 1.2, radius: 0.13, spin: 'forward', spinRate: 4 };
export const BOUCHONS_LOOK = { file: 'bouchon.glb', length: 0.2, colors: { Liege: 0xc89a5a, Capsule: 0xe8c040 } as Record<string, number> } as const;
export const BOUCHONS_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'bouchon en plus', value: 1, kind: 'flat', whole: true }, { id: 'speed', label: 'vitesse des bouchons', value: 0.10, kind: 'percent' }, CRIT, CRITM];

/** Boules de pétanque (n° 21) : lancées en cloche, elles rebondissent au sol et roulent dans la horde. */
export const PETANQUE: BottleConfig = { ...THROWN, cooldown: 1.9, damage: 14, speed: 13, gravity: 16, groundBounces: 3, restitution: 0.45, pierce: 6, knock: 2, life: 3.5, radius: 0.18 };
export const PETANQUE_LOOK = { file: 'boule.glb', length: 0.32, fit: 'max', colors: { Metal: 0xb8bcc4, Stries: 0x4a4e56 } as Record<string, number> } as const;
export const PETANQUE_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'boule en plus', value: 1, kind: 'flat', whole: true }, { id: 'pierce', label: 'zombie renversé en plus', value: 2, kind: 'flat', whole: true }, { id: 'knock', label: 'recul', value: 0.15, kind: 'percent' }, CRIT, CRITM];

/** Bac de bière (n° 23) : le bac éclate à l'impact en bouteilles qui partent dans toutes les directions. */
export const BAC: BottleConfig = { ...THROWN, cooldown: 2.6, damage: 20, speed: 12, gravity: 14, radius: 0.25, fragments: 8, fragmentDamage: 0.5, fragmentSpeed: 9 };
export const BAC_LOOK = { file: 'bac.glb', length: 0.6, fit: 'max', colors: { Bac: 0xe8a018, Verre: 0x4a2a10, Capsule: 0xe8c040 } as Record<string, number> } as const;
export const BAC_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'bac en plus', value: 1, kind: 'flat', whole: true }, { id: 'fragments', label: 'bouteilles en plus dans le bac', value: 2, kind: 'flat', whole: true }, RANGE, CRIT, CRITM];

/** Flaque de vomi (n° 3) : lancée en cloche sur le plus gros groupe, elle laisse une flaque de poison qui se cumule. */
export const VOMI: BottleConfig = { ...THROWN, cooldown: 2.8, damage: 6, speed: 12, gravity: 14, aim: 'crowd', radius: 0.2, pool: { radius: 2.2, life: 4, dps: 0.6, maxStacks: 6 } };
export const VOMI_LOOK = { file: 'boule.glb', length: 0.34, fit: 'max', colors: { Metal: 0x9ab83a, Stries: 0x6a8a1a } as Record<string, number> } as const;
export const VOMI_ZONE = { color: 0x9ab83a, rim: 0x5e7a1e, opacity: 0.78, lift: 0.07, fadeIn: 0.2, fadeOut: 0.8 } as const;
export const VOMI_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'flaque en plus', value: 1, kind: 'flat', whole: true }, { id: 'size', label: 'taille des flaques', value: 0.12, kind: 'percent' }, { id: 'duration', label: 'durée des flaques', value: 0.15, kind: 'percent' }];

export const MORE_SOUNDS = {
  bouchons: { sample: 'impactPlank_medium', volume: 0.3, pitch: 1.8, gap: 0.03 },
  petanque: { sample: 'impactMetal_heavy', volume: 0.4, pitch: 1.2, gap: 0.05 },
  bac: { sample: 'impactGlass_heavy', volume: 0.45, pitch: 1.0, gap: 0.04 },
  vomi: { sample: 'impactSoft_heavy', volume: 0.35, pitch: 1.3, gap: 0.08 },
} as const;

// ------------------------------------------------------------------------------------------------ armes de zone

/** Weizen (n° 7) : un nuage de mousse se pose en l'air sur un groupe et y reste ; tout zombie dedans prend des coups. */
export const WEIZEN = { cooldown: 3.2, firstDelay: 1, damage: 5, tick: 0.5, radius: 2.6, life: 5, range: 15, height: 1.3 } as const;
export const WEIZEN_ZONE = { color: 0xfff6dc, rim: 0xead7a2, opacity: 0.32, lift: 2.3, fadeIn: 0.3, fadeOut: 1 } as const;
export const WEIZEN_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'nuage en plus', value: 1, kind: 'flat', whole: true }, { id: 'size', label: 'taille du nuage', value: 0.12, kind: 'percent' }, { id: 'duration', label: 'durée du nuage', value: 0.15, kind: 'percent' }];

/** Tireuse (n° 15) : un jet continu de bière en cône vers le zombie le plus proche, à moyenne portée. */
export const TIREUSE = { damage: 4, tick: 0.2, range: 4.6, halfAngle: 0.55, knock: 0.5, critChance: 0.05, critMult: 2, drops: 3, dropSpeed: 13, dropLife: 0.34 } as const;
export const TIREUSE_UPGRADES: readonly UpgradeDef[] = [DMG, { id: 'rate', label: 'débit du jet', value: 0.10, kind: 'percent' }, { id: 'size', label: 'portée du jet', value: 0.10, kind: 'percent' }, { id: 'knock', label: 'recul', value: 0.20, kind: 'percent' }, CRIT, CRITM];

/** Corne de brume (n° 20) : un coup de corne en cône devant le joueur, gros recul, presque pas de dégâts : ouvre un couloir. */
export const CORNE = { cooldown: 3.4, firstDelay: 1, damage: 3, range: 7.5, halfAngle: 0.65, knock: 6, knockSpeed: 16, drops: 11, dropSpeed: 18, dropLife: 0.4 } as const;
export const CORNE_UPGRADES: readonly UpgradeDef[] = [RATEU, { id: 'size', label: 'portée de la corne', value: 0.12, kind: 'percent' }, { id: 'knock', label: 'recul', value: 0.20, kind: 'percent' }, DMG];

/**
 * Rot sonique (n° 22) : une onde autour du joueur, qui se charge avec l'XP ramassée depuis le dernier rot : plus on
 * fonce dans les capsules, plus le prochain rot est fort et large.
 */
export const ROT = { cooldown: 5, firstDelay: 2, damage: 10, perXp: 0.5, maxDamage: 260, radius: 3.4, radiusPerXp: 0.025, maxRadius: 8, knock: 1.5 } as const;
export const ROT_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'size', label: "taille de l'onde", value: 0.10, kind: 'percent' }, { id: 'charge', label: 'charge par capsule', value: 0.20, kind: 'percent' }];

/** Odeur d'alcool (n° 24) : une aura permanente autour du joueur ; dégâts faibles et continus, les zombies titubent. */
export const ODEUR = { damage: 3, tick: 0.5, radius: 2.6, confuse: 1.6 } as const;
export const ODEUR_ZONE = { color: 0xd6e07a, rim: 0xa8b83a, opacity: 0.32, lift: 0.08, fadeIn: 0.01, fadeOut: 0.01 } as const;
export const ODEUR_UPGRADES: readonly UpgradeDef[] = [DMG, { id: 'size', label: "rayon de l'aura", value: 0.10, kind: 'percent' }, { id: 'confuse', label: 'durée de la confusion', value: 0.15, kind: 'percent' }, { id: 'rate', label: "cadence de l'aura", value: 0.10, kind: 'percent' }];

/** Plateau de serveur (n° 16) : des plateaux tournent autour du joueur et bloquent chacun un coup, puis se rechargent. */
export const PLATEAU = { count: 1, radius: 1.35, height: 1.1, turnsPerSecond: 0.35, recharge: 7 } as const;
export const PLATEAU_LOOK = { file: 'plateau.glb', length: 0.62, fit: 'max', colors: { Plateau: 0xc8ccd4, Rebord: 0x8a8e98 } as Record<string, number> } as const;
export const PLATEAU_UPGRADES: readonly UpgradeDef[] = [{ id: 'projectiles', label: 'plateau en plus', value: 1, kind: 'flat', whole: true }, { id: 'rate', label: 'recharge plus rapide', value: 0.12, kind: 'percent' }];

export const ZONE_SOUNDS = {
  weizen: { sample: 'impactSoft_medium', volume: 0.25, pitch: 1.4, gap: 0.12 },
  tireuse: { sample: 'impactSoft_medium', volume: 0.25, pitch: 1.6, gap: 0.1 },
  corne: { sample: 'impactSoft_heavy', volume: 0.35, pitch: 0.7, gap: 0.08 },
  rot: { sample: 'impactPunch_heavy', volume: 0.3, pitch: 0.8, gap: 0.05 },
  odeur: { sample: 'impactSoft_medium', volume: 0.15, pitch: 1.2, gap: 0.2 },
} as const;

/**
 * Le 421 (n° 10, inventé le 2026-11-15, d'après le jeu de dés de comptoir) : trois dés lancés sur les zombies ; chaque
 * dé frappe selon sa face, chaque 6 ajoute un peu de critique pour la run, et 4-2-1 dans la même volée fait jackpot :
 * le 4 explose. Évolution avec le Trèfle de comptoir.
 */
export const DES_421: BottleConfig = {
  ...THROWN, count: 3, cooldown: 2.0, damage: 9, speed: 15, gravity: 14, spinRate: 3, radius: 0.14,
  dice: { critPerSix: 0.004, critCap: 0.15, jackpotDamage: 6, jackpotRadius: 3.2 },
};
export const DES_421_LOOK = { file: 'de.glb', length: 0.26, fit: 'max', colors: { Ivoire: 0xf6f0e2, Points: 0x141010 } as Record<string, number> } as const;
export const DES_421_UPGRADES: readonly UpgradeDef[] = [DMG, RATEU, { id: 'projectiles', label: 'dé en plus', value: 1, kind: 'flat', whole: true }, { id: 'size', label: 'taille du jackpot', value: 0.12, kind: 'percent' }, CRIT, CRITM];
