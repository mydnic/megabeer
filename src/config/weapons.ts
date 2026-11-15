// Armes (GDD section 6). Chaque arme est une entrée de config ; les chiffres se calent en jouant.

import type { WeaponId } from '../weapons/weapon';

export const WEAPONS = {
  /** Canette : canette de bière lancée vers le zombie le plus proche (arme de départ du Buveur). */
  canette: {
    /** Temps entre deux lancers (s). */
    cooldown: 2.0,
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
    cooldown: 2.6,
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
  // Synergies du GDD (section 6), branchées dans chaque arme concernée (ctx.synergy) ; ajoutées le 2026-11-15
  futFlaque: {
    name: 'Glissade', weapons: ['fut', 'flaqueBiere'], pitch: 'Le fût file plus vite et plus loin sur la bière', color: '#e8a826',
    details: "Sur une flaque de bière, le fût roule deux fois plus vite et sa course s'allonge.",
  },
  flammes: {
    name: 'Ça flambe', weapons: ['ipa', 'flaqueBiere'], pitch: "L'IPA met le feu aux flaques de bière", color: '#ff7a2a',
    details: 'Un zombie dans une flaque de bière prend feu, comme touché par une IPA.',
  },
  flammesVomi: {
    name: 'Gastro flambée', weapons: ['ipa', 'vomi'], pitch: "L'IPA met le feu aux flaques de vomi", color: '#ff9a3a',
    details: 'Un zombie dans une flaque de vomi prend feu, comme touché par une IPA.',
  },
  cerisesEnChaine: {
    name: 'Cerises en chaîne', weapons: ['kriek', 'triple'], pitch: 'Chaque rebond de la Triple éclabousse', color: '#e2203a',
    details: 'À chaque rebond, la Triple éclabousse de kriek : dégâts autour et zombies ralentis.',
  },
  bouchonsExplosifs: {
    name: 'Bouchons explosifs', weapons: ['bouchons', 'gueuze'], pitch: "Les bouchons explosent à l'impact", color: '#ff9ab8',
    details: "Chaque bouchon qui touche un zombie explose : dégâts autour de l'impact.",
  },
  jetBrulant: {
    name: 'Jet brûlant', weapons: ['tireuse', 'ipa'], pitch: 'Le jet de la Tireuse met le feu', color: '#ff8a2a',
    details: 'Chaque zombie arrosé par la Tireuse brûle quelques secondes.',
  },
  serviceMuscle: {
    name: 'Service musclé', weapons: ['plateau', 'tabouret'], pitch: 'Chaque coup bloqué déclenche un coup de tabouret', color: '#c8ccd4',
    details: 'Quand un plateau bloque un coup, le tabouret fait aussitôt un tour complet.',
  },
  retourAuBar: {
    name: 'Retour au bar', weapons: ['sousBock', 'decapsuleur'], pitch: 'Les sous-bocks reviennent vers toi', color: '#f3ead6',
    details: 'Les sous-bocks font demi-tour à mi-course et frappent au retour, comme le décapsuleur.',
  },
  noelAuComptoir: {
    name: 'Noël au comptoir', weapons: ['biereNoel', 'des421'], pitch: 'Un 421 double la couronne de Noël', color: '#2f8a3e',
    details: 'À chaque jackpot du 421, la Bière de Noël fait tourner deux fois plus de bouteilles pendant quelques secondes.',
  },
  nuageToxique: {
    name: 'Nuage toxique', weapons: ['vomi', 'weizen'], pitch: 'Le nuage de Weizen empoisonne et se cumule', color: '#9ab83a',
    details: 'Dans un nuage de Weizen, chaque battement fait plus mal que le précédent (poison cumulable).',
  },
  troisVingt: {
    name: 'Ricochets', weapons: ['flechettes', 'triple'], pitch: 'Les fléchettes rebondissent', color: '#e2203a',
    details: "Chaque fléchette rebondit sur deux autres zombies après l'impact.",
  },
  carreauFut: {
    name: 'Carreau sur le fût', weapons: ['petanque', 'fut'], pitch: 'Les boules ricochent plus et cognent plus fort', color: '#b8bcc4',
    details: 'Les boules de pétanque rebondissent deux fois de plus et font plus de dégâts.',
  },
  rotDeCorne: {
    name: 'Rot de corne', weapons: ['corne', 'rot'], pitch: 'Le rot sort par la corne : un cône très long', color: '#b8f070',
    details: 'Le rot part en cône devant toi, bien plus loin, avec ses dégâts de rot.',
  },
  haleineFeu: {
    name: 'Haleine de feu', weapons: ['odeur', 'ipa'], pitch: "L'alcool est inflammable : l'aura brûle", color: '#ff7a2a',
    details: "L'aura de l'Odeur d'alcool fait deux fois plus de dégâts.",
  },
  palettePinball: {
    name: 'Flipper', weapons: ['bac', 'triple'], pitch: 'Les bouteilles du bac rebondissent', color: '#ffc060',
    details: "Les bouteilles qui s'échappent du bac rebondissent sur deux zombies.",
  },
} as const satisfies Record<string, SynergyDef>;

/**
 * Une synergie : ses armes (toutes équipées = active), son nom et sa présentation. Black and Tan a en plus une marque
 * (`marker` sonne le zombie `duration` s) et une arme qui en profite (`boosted` fait `mult` fois ses dégâts) ; les autres
 * sont lues par leurs armes (ctx.synergy).
 */
export type SynergyDef = {
  name: string; weapons: readonly WeaponId[]; pitch: string; color: string; details: string;
  marker?: WeaponId; boosted?: WeaponId; duration?: number; mult?: number;
};

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

/**
 * Tabouret de bar (GDD section 6, n° 18), arme du Videur : mêlée circulaire. Dès qu'un zombie est à portée, le
 * tabouret fait un tour complet autour du joueur et frappe une fois chaque zombie traversé, avec un gros recul.
 */
export const TABOURET = {
  /** Temps entre deux tours (s), délai avant le premier (s). */
  cooldown: 2.2,
  firstDelay: 0.8,
  damage: 22,
  critChance: 0.05,
  critMult: 2,
  /** Portée du coup (m, multipliée par la Taille), corps d'un zombie (m) ; un zombie collé au joueur est pris d'office. */
  radius: 2.6,
  zombieRadius: 0.45,
  innerRadius: 0.6,
  /** Le tour part si un zombie est à moins de la portée plus cette marge (m). */
  triggerMargin: 0.5,
  /** Durée d'un tour complet (s). */
  swingTime: 0.9,
  /** Recul : fois le recul normal, et vitesse donnée vers l'extérieur du cercle (m/s). */
  knock: 4,
  knockSpeed: 9,
  /** Affichage : hauteur du tabouret (m), part de la portée où il passe, inclinaison vers l'extérieur (rad). */
  height: 1.0,
  holdAt: 0.72,
  tilt: 1.15,
  /** Vitesse du geste du bras (le perso accompagne le tour). */
  gestureRate: 1.6,
} as const;

/** Apparence du tabouret (« Stool » de CMHT Oculus) : mis à cette hauteur (m) le long de son axe. */
export const TABOURET_LOOK = {
  file: 'tabouret.glb',
  length: 0.8,
  colors: { Stool: 0x8a5230 } as Record<string, number>,
} as const;

/** Sons du tabouret : le souffle du tour, le coup sur un zombie. */
export const TABOURET_SOUND = {
  swing: { sample: 'impactSoft_medium', volume: 0.35, pitch: 0.55 },
  hit: { sample: 'impactWood_heavy', volume: 0.5, pitch: 1.0 },
  hitGap: 0.05,
} as const;

/** Nom de chaque arme, et sa présentation sur la carte « Nouvelle arme » du level-up. */
export const WEAPON_INFO = {
  canette: { name: 'Canette', pitch: 'Canette lancée sur le zombie le plus proche' },
  stout: { name: 'Stout', pitch: 'Lourde et lente : gros dégâts, gros recul, traverse un zombie' },
  fut: { name: 'Fût qui roule', pitch: 'Un tonneau roule tout droit et écrase toute la ligne' },
  gueuze: { name: 'Gueuze', pitch: 'Lancée sur le plus gros groupe, elle mousse puis explose' },
  tabouret: { name: 'Tabouret de bar', pitch: 'Un grand tour autour de toi : tout ce qui approche prend un coup et vole' },
  biereNoel: { name: 'Bière de Noël', pitch: 'Des bouteilles tournent autour de toi et cognent tout ce qui approche' },
  decapsuleur: { name: "Décapsuleur", pitch: "Un boomerang : il part, revient, et frappe à l'aller comme au retour" },
  flaqueBiere: { name: "Flaque de bière", pitch: "Tu laisses une traînée de bière : les zombies glissent, tombent et restent sonnés" },
  kriek: { name: "Kriek", pitch: "Bière à la cerise : elle éclabousse à l'impact et ralentit les zombies autour" },
  triple: { name: "Triple", pitch: "Elle rebondit d'un zombie à l'autre : trois coups pour une bouteille" },
  ipa: { name: "IPA", pitch: "Amère et brûlante : le zombie touché prend feu quelques secondes" },
  sousBock: { name: "Dessous de verre", pitch: "Lancé à plat comme un frisbee : il file droit et traverse plusieurs zombies" },
  flechettes: { name: "Fléchettes", pitch: "Tir tendu et précis sur le zombie le plus solide, souvent critique" },
  bouchons: { name: "Bouchons de champagne", pitch: "Une rafale de bouchons part en éventail : large, rapide, festif" },
  petanque: { name: "Boules de pétanque", pitch: "Lancées en cloche, elles rebondissent et roulent dans la horde" },
  bac: { name: "Bac de bière", pitch: "Le bac éclate à l'impact : ses bouteilles partent dans toutes les directions" },
  vomi: { name: "Flaque de vomi", pitch: "Lancée sur le plus gros groupe : une flaque de poison qui fait de plus en plus mal" },
  weizen: { name: "Weizen", pitch: "Un nuage de mousse se pose sur un groupe et y reste : tout ce qui est dedans trinque" },
  tireuse: { name: "Tireuse", pitch: "Un jet de bière continu en cône sur le zombie le plus proche" },
  corne: { name: "Corne de brume", pitch: "Un coup de corne devant toi : peu de dégâts, mais la horde vole et le couloir s'ouvre" },
  rot: { name: "Rot sonique", pitch: "Une onde autour de toi qui se charge avec les capsules ramassées : fonce, puis rote" },
  odeur: { name: "Odeur d'alcool", pitch: "Une aura autour de toi : les zombies trop près titubent et prennent des petits dégâts" },
  plateau: { name: "Plateau de serveur", pitch: "Des plateaux tournent autour de toi et bloquent chacun un coup, puis se rechargent" },
  des421: { name: "Le 421", pitch: "Trois dés de comptoir : chaque 6 aiguise tes critiques, et 4-2-1 fait tout sauter" },
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
