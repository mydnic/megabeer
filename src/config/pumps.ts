// Pompes à bière (GDD section 10, « Exploration de la map ») : rester à côté remplit la pinte ;
// pleine, le jeu se fige et propose 1 bonus de stat parmi 3. Valeurs de départ, à caler en jouant.

export const PUMPS = {
  /** Pompes posées sur la planète à chaque run, distance mini au point de départ et entre elles (m, au sol). */
  count: 20,
  minFromSpawn: 25,
  minSpacing: 25,
  /** Essais de placement (positions tirées au hasard, écartées si trop près ou dans le décor). */
  placementTries: 400,
  /** Rayon où le Buveur remplit la pinte (m, au sol), temps pour la remplir (s), vidange quand il s'éloigne (part par s). */
  radius: 3,
  fillTime: 6,
  drainPerSecond: 0.08,
  /** La jauge reste affichée tant que le joueur est à moins de ce multiple du rayon (pinte pas encore vide). */
  gaugeRange: 2.5,
  /** Nombre de bonus proposés quand elle est pleine. */
  choices: 3,
} as const;

/**
 * Qualité d'une pompe : nom affiché, chance ajoutée au tirage de la rareté de ses cartes (en plus de
 * la LUCK du joueur), poids de tirage, couleur (cerclages, faisceau, zone).
 */
export const PUMP_TIERS = {
  bronze: { name: 'bronze', luck: 0, weight: 60, color: 0xc0793a },
  argent: { name: 'argent', luck: 10, weight: 30, color: 0xd8dde4 },
  or: { name: 'or', luck: 20, weight: 10, color: 0xffc93a },
} as const;
export type PumpTier = keyof typeof PUMP_TIERS;

/** Stats que la pompe peut augmenter (game/playerStats.ts). */
export type StatId = 'damage' | 'attackSpeed' | 'maxHp' | 'moveSpeed' | 'pickupRange' | 'xpGain' | 'luck' | 'extraProjectiles';

/**
 * Bonus de stat d'une pompe : `value` en Commun, multiplié par la rareté de la carte (RARITIES, comme
 * les cartes d'arme), sauf `fixed`. `kind` règle l'affichage : percent -> « +8 % », flat -> « +15 »,
 * meters -> « +0,5 m ». `minRarity` : rareté minimum pour qu'il soit proposé (index dans RARITIES).
 */
export type StatBonusDef = { id: StatId; label: string; value: number; kind: 'percent' | 'flat' | 'meters'; fixed?: boolean; minRarity?: number };

export const STAT_BONUSES: readonly StatBonusDef[] = [
  { id: 'damage', label: 'dégâts', value: 0.08, kind: 'percent' },
  { id: 'attackSpeed', label: "vitesse d'attaque", value: 0.08, kind: 'percent' },
  { id: 'maxHp', label: 'PV max', value: 15, kind: 'flat' },
  { id: 'moveSpeed', label: 'vitesse de déplacement', value: 0.05, kind: 'percent' },
  { id: 'pickupRange', label: "portée d'attraction", value: 0.5, kind: 'meters' },
  { id: 'xpGain', label: "gain d'XP", value: 0.08, kind: 'percent' },
  { id: 'luck', label: 'chance', value: 2, kind: 'flat' },
  { id: 'extraProjectiles', label: 'projectile en plus', value: 1, kind: 'flat', fixed: true, minRarity: 2 },
];

/** Apparence d'une pompe (world/pumpsView.ts) : fût sur chevalet KayKit, faisceau, pinte-jauge au-dessus. */
export const PUMP_LOOK = {
  /** Hauteur du fût sur son chevalet (m). */
  height: 1.3,
  wood: 0x8a5230,
  /** Cerclages d'une pompe déjà vidée (ternes). */
  usedHoops: 0x5a5550,
  /** Faisceau de lumière : rayon et hauteur (m), opacité. */
  beamRadius: 0.35,
  beamHeight: 40,
  beamOpacity: 0.22,
  /**
   * Zone de remplissage : dôme très discret du rayon PUMPS.radius, dont seuls les bords luisent
   * (liseré), aplati en hauteur ; plus visible quand le joueur est dedans.
   */
  zoneFlatten: 0.6,
  zoneOpacity: 0.12,
  zoneOpacityInside: 0.24,
  zoneRim: 2.2,
  /** Pinte-jauge : hauteur au-dessus du sol (m), taille du verre (m), épaisseur de mousse (m), couleurs. */
  pintAbove: 1.75,
  pintRadius: 0.16,
  pintHeight: 0.42,
  foam: 0.06,
  beer: 0xe0a020,
  foamColor: 0xfff4dc,
} as const;
