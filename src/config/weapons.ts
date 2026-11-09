// Armes (GDD section 6). Chaque arme est une entrée de config ; les chiffres se calent en jouant.

export const WEAPONS = {
  /** Canette : canette de bière lancée vers le zombie le plus proche (arme de départ du Buveur). */
  canette: {
    /** Temps entre deux lancers (s). */
    cooldown: 1.0,
    damage: 16,
    /** Coup critique : chance de base (0 à 1) et multiplicateur de dégâts de base (GDD : x2). */
    critChance: 0.05,
    critMult: 2,
    /** Portée de détection de la cible (m). */
    range: 18,
    /** Vitesse horizontale de la bouteille (m/s) et gravité propre (m/s², plus faible que le joueur : cloche douce). */
    speed: 17,
    gravity: 14,
    /** Rotation de la bouteille en vol (tours par seconde). */
    spinRate: 2.2,
    /** Rayon de contact de la bouteille (m), multiplié par la Taille comme le modèle. */
    radius: 0.15,
    /** Corps d'un zombie pour les impacts : hauteur et rayon (m). La bouteille s'écrase sur le premier touché. */
    zombieHeight: 1.8,
    zombieRadius: 0.4,
    /** Geste : durée à vitesse normale (s) et accélération maxi quand la cadence monte. */
    gestureDuration: 0.6,
    maxGestureRate: 4,
    /** Écart entre les bouteilles d'une même volée (s), resserré quand la cadence monte. */
    volleyGap: 0.07,
    /** Délai entre le début du geste et le lâcher (s), aligné sur l'animation « throw ». */
    releaseDelay: 0.22,
    /** Hauteur visée sur le zombie (m au-dessus de ses pieds). */
    aimHeight: 1.1,
    /** Durée de vie maxi d'une bouteille (s). */
    life: 3,
    /** Recul donné au zombie touché (multiplie le recul normal d'un coup). */
    knock: 1,
    /** Zombies traversés avant de s'écraser (0 : s'écrase sur le premier). */
    pierce: 0,
  },
  /** Stout : bouteille noire, lourde et lente ; gros dégâts, gros recul, traverse un zombie (GDD section 6, n° 2). */
  stout: {
    cooldown: 1.3,
    damage: 30,
    critChance: 0.05,
    critMult: 2,
    range: 16,
    speed: 13,
    gravity: 13,
    spinRate: 1.3,
    radius: 0.2,
    zombieHeight: 1.8,
    zombieRadius: 0.4,
    gestureDuration: 0.6,
    maxGestureRate: 4,
    volleyGap: 0.09,
    releaseDelay: 0.22,
    aimHeight: 1.1,
    life: 3,
    knock: 3,
    pierce: 1,
  },
} as const;

export type BottleWeaponId = keyof typeof WEAPONS;

/**
 * Visée de toutes les armes (weapons/targeting.ts) : chaque tir choisit au hasard parmi les `spread`
 * zombies les plus proches qui n'ont pas déjà assez de dégâts en route pour mourir.
 */
export const TARGETING = { spread: 3 } as const;

/**
 * Fût qui roule (GDD section 6, n° 12) : un grand tonneau roule tout droit sur le sol vers le zombie
 * le plus proche et écrase tous ceux de sa ligne (une fois chacun), puis éclate au bout de sa course
 * ou contre le décor (rebondir dessus sera son évolution, Rouleau compresseur).
 */
export const FUT = {
  /** Temps entre deux fûts (s), et délai avant le premier (s). */
  cooldown: 3.5,
  firstDelay: 1,
  damage: 28,
  critChance: 0.05,
  critMult: 2,
  /** Portée de détection de la cible (m) : le fût roule ensuite jusqu'au bout de sa course. */
  range: 18,
  /** Vitesse au sol (m/s) et durée de la course (s). */
  speed: 9,
  life: 2.6,
  /** Rayon du tonneau couché (m, multiplié par la Taille) : hauteur de son axe au-dessus du sol. */
  radius: 0.45,
  /** Longueur du tonneau (m, multipliée par la Taille). */
  length: 1.1,
  /** Corps d'un zombie pour l'écrasement (m) et recul donné (fois le recul normal). */
  zombieRadius: 0.4,
  knock: 3,
  /** Départ : distance devant le joueur (m), écart entre les fûts d'une même volée (rad). */
  spawnAhead: 1.2,
  spread: 0.35,
} as const;

/**
 * Gueuze (GDD section 6, n° 8) : grenade à retardement lancée en cloche sur le plus gros groupe de
 * zombies ; posée au sol, elle tourne en moussant le temps de son retard, puis explose en zone.
 */
export const GUEUZE = {
  /** Temps entre deux lancers (s), délai avant le premier (s). */
  cooldown: 3,
  firstDelay: 1.5,
  damage: 34,
  critChance: 0.05,
  critMult: 2,
  /** Portée (m) et nombre de zombies les plus proches examinés pour trouver le plus gros groupe. */
  range: 16,
  candidates: 60,
  /** Vol : vitesse horizontale (m/s), gravité propre (m/s²), rotation en vol (tours/s), durée maxi (s). */
  speed: 12,
  gravity: 16,
  spinRate: 1.5,
  life: 4,
  /** Posée : hauteur de son axe au-dessus du sol (m), rotation en moussant (tours/s), retard avant l'explosion (s). */
  restHeight: 0.12,
  fizzSpin: 2.5,
  fuse: 0.8,
  /** En vol, elle explose à l'impact si elle entre dans un zombie : son corps (hauteur, rayon, m) et le rayon de la bouteille (m). */
  zombieHeight: 1.8,
  zombieRadius: 0.4,
  hitRadius: 0.15,
  /** Hauteur visée au-dessus du centre du groupe (m) : à hauteur de poitrine. */
  aimHeight: 0.9,
  /** Rayon de l'explosion (m) et recul (fois le recul normal, vers l'extérieur). */
  radius: 3.2,
  knock: 2,
} as const;

/** Apparence de la Gueuze (bouteille fine du Fantasy Props MegaKit, découpée par tools/blender/props.py). */
export const GUEUZE_LOOK = {
  file: 'bouteille_gueuze.glb',
  length: 0.45,
  /** Verre rose rouge framboise, bouchon de liège. */
  colors: { Verre: 0xc8264f, Bouchon: 0xb08a5a } as Record<string, number>,
} as const;

/** Explosion de la Gueuze : gerbe de bière framboise, tremblement de caméra si c'est près, sons. */
export const GUEUZE_BLAST = {
  /** Secousse de caméra (nulle à `shakeDist` m). */
  shake: 0.3,
  shakeAmplitude: 0.22,
  shakeDecay: 2.6,
  shakeDist: 14,
  sound: { glass: 'impactGlass_heavy', glassVolume: 0.55, boom: 'impactSoft_heavy', boomVolume: 0.7, boomPitch: 0.6, hearDist: 35 },
} as const;

/** Apparence du fût (grand tonneau KayKit Dungeon, découpé par tools/blender/props.py). */
export const FUT_LOOK = {
  file: 'fut.glb',
  /** Le modèle est mis à cette longueur (m) le long de son axe, comme FUT.length. */
  length: 1.1,
  colors: { Bois: 0x8a5230, Cerclage: 0x6f7378 } as Record<string, number>,
} as const;

/** Sons du fût : lancer, écrasement d'un zombie, éclatement. */
export const FUT_SOUND = {
  launch: { sample: 'impactWood_heavy', volume: 0.35, pitch: 0.7 },
  crush: { sample: 'impactPunch_heavy', volume: 0.45, pitch: 0.75 },
  burst: { sample: 'impactWood_heavy', volume: 0.6, pitch: 0.9 },
} as const;

/** Apparence de la bouteille de Stout (KayKit Dungeon, découpée par tools/blender/props.py). */
export const STOUT_LOOK = {
  file: 'bouteille_stout.glb',
  length: 0.4,
  /** Verre noir, étiquette crème, bouchon de liège. */
  colors: { Verre: 0x1c130d, Etiquette: 0xeadcbc, Bouchon: 0xb08a5a } as Record<string, number>,
} as const;

/** Impact de la Stout : gerbe de bière brune et choc sourd en plus du verre. */
export const STOUT_IMPACT = {
  sample: 'impactPunch_heavy',
  volume: 0.55,
  pitch: 0.8,
} as const;

/**
 * Synergies (GDD section 6) : actives quand toutes les armes de `weapons` sont équipées.
 * Black and Tan : un zombie touché par la Stout (`marker`) est sonné `duration` s ; pendant ce temps,
 * la Canette (`boosted`) lui fait `mult` fois ses dégâts. Sonné ne l'arrête pas : c'est une marque.
 */
export const SYNERGIES = {
  blackAndTan: {
    name: 'Black and Tan', weapons: ['canette', 'stout'], marker: 'stout', boosted: 'canette', duration: 2, mult: 2,
    /** Interface : explication courte (bandeau, carte) et couleur (badge de carte, liseré des emplacements du HUD). */
    pitch: 'La Stout sonne, la Canette frappe double', color: '#e8c76a',
    /** Effet détaillé (menu pause). */
    details: 'Un zombie touché par une Stout est sonné 2 s : les canettes lui font double dégâts.',
  },
} as const satisfies Record<string, { name: string; weapons: readonly BottleWeaponId[]; marker: BottleWeaponId; boosted: BottleWeaponId; duration: number; mult: number; pitch: string; color: string; details: string }>;

/** Signe au-dessus d'un zombie sonné (Black and Tan) : bulles de mousse qui tournent autour de la tête. */
export const DAZED_LOOK = {
  /** Nombre de bulles, rayon du cercle (m), hauteur au-dessus de la tête (m), taille d'une bulle (m), tours par seconde. */
  count: 3,
  radius: 0.45,
  aboveHead: 0.3,
  size: 0.34,
  spin: 1.2,
  /** Mousse crème cerclée de brun stout. */
  fill: '#f2e3c4',
  stroke: '#3a2416',
} as const;

/** Nom de chaque arme, et sa présentation sur la carte « Nouvelle arme » du level-up. */
export const WEAPON_INFO = {
  canette: { name: 'Canette', pitch: 'Canette lancée sur le zombie le plus proche' },
  stout: { name: 'Stout', pitch: 'Lourde et lente : gros dégâts, gros recul, traverse un zombie' },
  fut: { name: 'Fût qui roule', pitch: 'Un tonneau roule tout droit et écrase toute la ligne' },
  gueuze: { name: 'Gueuze', pitch: 'Lancée sur le plus gros groupe, elle mousse puis explose' },
} as const satisfies Record<string, { name: string; pitch: string }>;

/** Apparence de la Canette (canette de soda Kenney, découpée par tools/blender/props.py). */
export const CANETTE_LOOK = {
  file: 'canette.glb',
  /** Hauteur de la canette en jeu (m, un peu exagérée pour se lire en vol). */
  length: 0.3,
  /** Couleurs : métal argenté, corps rouge comme l'icône. */
  colors: { Metal: 0xc8ccd2, Corps: 0xc8102e } as Record<string, number>,
} as const;

/** Impact de la Canette : un tintement de fer-blanc (pas de verre). */
export const CANETTE_IMPACT = {
  sample: 'impactTin_medium',
  volume: 0.4,
  pitch: 1.1,
} as const;
