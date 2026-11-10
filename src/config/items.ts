// Objets passifs (GDD section 7) : ils ne sortent que des coffres. Chaque objet a une rareté qui
// multiplie son effet (RARITIES : x1 à x4), sauf `fixed`. Un objet donne des stats (`stats`, plusieurs
// possibles), un effet spécial (`effect` et sa `value`), ou les deux. Les copies d'un même objet
// s'additionnent. Le texte de la carte (`text`) remplace {clé} par la valeur à la rareté tirée :
// {clé} en nombre, {clé%} en pourcentage ; `v` est la valeur de l'effet.

/** Stats du joueur qu'un objet peut monter (champs de PlayerStats, sauf maxHp : les PV max). */
export type ItemStatId =
  | 'damage' | 'attackSpeed' | 'maxHp' | 'moveSpeed' | 'pickupRange' | 'xpGain' | 'luck' | 'extraProjectiles'
  | 'critChance' | 'critDamage' | 'size' | 'duration' | 'regen' | 'armor' | 'dodge' | 'knockback' | 'lifeSteal'
  | 'coinGain' | 'pumpSpeed' | 'chestDiscount' | 'jumpHeight';

/** Effets spéciaux (un déclencheur et un effet), réglés dans ITEM_EFFECTS. */
export type EffectId =
  | 'explodeOnKill' | 'foamShield' | 'happyHour' | 'healOnXp' | 'slowOnHit' | 'freezeChance' | 'closeDamage'
  | 'eliteDamage' | 'crowdBoost' | 'extraShotChance' | 'lowHpDamage' | 'damageSpread' | 'levelUpWave'
  | 'standRegen' | 'whistle' | 'revive' | 'freeChest' | 'freeChestChance' | 'doubleJump';

export type ItemDef = {
  name: string;
  /** Texte de la carte : {clé} et {clé%} remplacés par les valeurs à la rareté tirée (`v` : l'effet). */
  text: string;
  /** Stats montées (valeurs en Commun). */
  stats?: Partial<Record<ItemStatId, number>>;
  /** Effet spécial et sa valeur en Commun (sens dans ITEM_EFFECTS). */
  effect?: EffectId;
  value?: number;
  /** N'existe qu'à partir de `minRarity`, sans multiplicateur de rareté. */
  fixed?: boolean;
  /** Rareté minimum pour qu'il sorte (index dans RARITIES). */
  minRarity?: number;
};

/**
 * Réglages des effets spéciaux. La valeur de l'objet (multipliée par la rareté, copies additionnées) :
 * - explodeOnKill (Cendrier) : chance qu'un ennemi tué explose (plafond `maxChance`), dans `radius` m
 *   (stat Taille), `damage` qui suit les PV des ennemis au fil de la run et la stat Dégâts.
 * - foamShield (Mousse épaisse) : recharges du bouclier par seconde (0,05 = 1 toutes les 20 s).
 * - happyHour : durée (s, stat Durée) de la cadence multipliée par `rate`, toutes les `every` s.
 * - healOnXp (Cacahuètes) : PV soignés par goutte d'XP ramassée.
 * - slowOnHit (Seau à glace) : ralentissement des ennemis touchés (plafond `max`), pendant `time` s.
 * - freezeChance (Glaçons) : chance qu'un ennemi touché gèle (immobile, ne frappe pas) `time` s.
 * - closeDamage (Gants de videur) : dégâts en plus sur les ennemis à moins de `range` m.
 * - eliteDamage (Lunettes de comptoir) : dégâts en plus sur les élites (PV de base >= `minHp`).
 * - crowdBoost (Écharpe de supporter) : vitesse en plus, et `armor` en plus, quand au moins `count`
 *   ennemis sont à moins de `radius` m.
 * - extraShotChance (Cochonnet) : chance qu'une volée lance un projectile de plus.
 * - lowHpDamage (Last order) : dégâts en plus sous `below` des PV max.
 * - damageSpread (Ardoise du bar) : les dégâts reçus tombent sur `v` s au lieu d'un coup.
 * - levelUpWave (Juke-box) : chaque niveau gagné repousse les ennemis dans `radius` m (stat Taille),
 *   recul multiplié par `v`.
 * - standRegen (Casquette à bière) : PV par seconde quand le joueur ne bouge pas.
 * - whistle (Sifflet d'arbitre) : toutes les `every` s, étourdit `v` s les ennemis à moins de `radius` m.
 * - revive (Seconde tournée) : une fois par exemplaire, revient à la mort avec `v` des PV max,
 *   invulnérable `invuln` s, et repousse les ennemis dans `radius` m.
 * - freeChest (Bonnet du Père Noël) : toutes les `every` s (divisé par `v`), un coffre gratuit apparaît
 *   à `dist` m du joueur.
 * - freeChestChance (Bon de réduction) : chance qu'un coffre soit gratuit (plafond `max`).
 * - doubleJump (Ressort de canapé) : sauts en l'air en plus.
 */
export const ITEM_EFFECTS = {
  explodeOnKill: { radius: 3.5, damage: 30, maxChance: 0.5 },
  happyHour: { every: 60, rate: 2 },
  slowOnHit: { time: 2, max: 0.6 },
  freezeChance: { time: 1, max: 0.5 },
  closeDamage: { range: 3.5 },
  eliteDamage: { minHp: 20 },
  crowdBoost: { count: 15, radius: 7, armor: 2 },
  extraShotChance: { max: 1 },
  lowHpDamage: { below: 0.3 },
  levelUpWave: { radius: 9, knock: 4 },
  standRegen: { still: 0.3 },
  whistle: { every: 15, radius: 7 },
  revive: { invuln: 2, radius: 8, knock: 5 },
  freeChest: { every: 90, dist: 6 },
  freeChestChance: { max: 0.5 },
} as const;

/**
 * Plafonds des stats d'objets (au-delà, la stat ne monte plus) et dégâts mini d'un coup reçu avec de
 * l'armure (PV).
 */
export const ITEM_STAT_CAPS = { dodge: 0.6, chestDiscount: 0.8, lifeSteal: 0.2, minHitDamage: 1 } as const;

const E = ITEM_EFFECTS;

export const ITEMS = {
  // --- Objets d'évolution (GDD 7)
  tourneeRapide: { name: 'Tournée rapide', stats: { attackSpeed: 0.08 }, text: "+{attackSpeed%} vitesse d'attaque" },
  biereForte: { name: 'Bière plus forte', stats: { damage: 0.08 }, text: '+{damage%} dégâts' },
  pinteXXL: { name: 'Pinte XXL', stats: { size: 0.1 }, text: '+{size%} taille des explosions et des ondes' },
  kebab: { name: 'Kebab de 4h', stats: { duration: 0.1 }, text: '+{duration%} durée des effets' },
  culSec: { name: 'Cul sec', stats: { critChance: 0.04 }, text: '+{critChance%} chances de critique' },
  briquet: { name: 'Briquet', stats: { critDamage: 0.15 }, text: '+{critDamage%} dégâts critiques' },
  sansAlcool: { name: 'Bière sans alcool', stats: { regen: 0.5 }, text: '+{regen} PV par seconde' },
  ventreABiere: { name: 'Ventre à bière', stats: { maxHp: 15 }, text: '+{maxHp} PV max' },
  bonnet: { name: 'Bonnet du Père Noël', effect: 'freeChest', value: 1, text: `Un coffre gratuit apparaît toutes les {every} s` },
  trefle: { name: 'Trèfle de comptoir', stats: { luck: 5 }, text: '+{luck} chance' },
  // +20 % de la portée de base (5 m)
  aimantCapsules: { name: 'Aimant à capsules', stats: { pickupRange: 1 }, text: "+{pickupRange} m portée d'attraction" },
  godasses: { name: 'Godasses de bar', stats: { moveSpeed: 0.06 }, text: '+{moveSpeed%} vitesse' },
  seauAGlace: { name: 'Seau à glace', effect: 'slowOnHit', value: 0.1, text: `Les ennemis touchés sont ralentis de {v%} (${E.slowOnHit.time} s)` },
  deuxMains: { name: 'Deux mains', stats: { extraProjectiles: 1 }, fixed: true, minRarity: 2, text: '+{extraProjectiles} projectile' },
  pression: { name: 'Pression du fût', stats: { knockback: 0.15 }, text: '+{knockback%} recul des ennemis touchés' },
  gueuleDeBois: { name: 'Gueule de bois', stats: { armor: 1 }, text: '+{armor} armure (PV en moins par coup reçu)' },
  ticketTournee: { name: 'Ticket de tournée', stats: { xpGain: 0.1 }, text: "+{xpGain%} gain d'XP" },
  gantsVideur: { name: 'Gants de videur', effect: 'closeDamage', value: 0.15, text: `+{v%} dégâts aux ennemis à moins de ${E.closeDamage.range} m` },
  lunettes: { name: 'Lunettes de comptoir', effect: 'eliteDamage', value: 0.15, text: '+{v%} dégâts aux gros ennemis' },
  echarpe: { name: 'Écharpe de supporter', effect: 'crowdBoost', value: 0.1, text: `+{v%} vitesse et +${E.crowdBoost.armor} armure entouré de ${E.crowdBoost.count} ennemis` },
  cochonnet: { name: 'Cochonnet', effect: 'extraShotChance', value: 0.1, text: '{v%} de chances de tirer un projectile de plus' },
  cacahuetes: { name: 'Sachet de cacahuètes', effect: 'healOnXp', value: 0.2, text: "Chaque goutte d'XP soigne {v} PV" },
  cendrier: { name: 'Cendrier', effect: 'explodeOnKill', value: 0.05, text: '{v%} des ennemis tués explosent' },
  demarche: { name: 'Démarche de pochtron', stats: { dodge: 0.04 }, text: '+{dodge%} esquive' },
  // --- Autres objets
  ressort: { name: 'Ressort de canapé', effect: 'doubleJump', value: 1, fixed: true, minRarity: 2, text: 'Double saut' },
  secondeTournee: { name: 'Seconde tournée', effect: 'revive', value: 0.5, fixed: true, minRarity: 4, text: 'Revivre une fois avec {v%} des PV' },
  carteFidelite: { name: 'Carte de fidélité', stats: { chestDiscount: 0.08 }, text: 'Coffres {chestDiscount%} moins chers' },
  happyHour: { name: 'Happy hour', effect: 'happyHour', value: 8, text: `Toutes les ${E.happyHour.every} s : attaque x${E.happyHour.rate} pendant {v} s` },
  glacons: { name: 'Glaçons', effect: 'freezeChance', value: 0.03, text: `{v%} de chances de geler un ennemi touché ${E.freezeChance.time} s` },
  lastOrder: { name: 'Last order', effect: 'lowHpDamage', value: 0.2, text: `+{v%} dégâts sous ${E.lowHpDamage.below * 100} % PV` },
  ardoise: { name: 'Ardoise du bar', effect: 'damageSpread', value: 3, text: 'Les dégâts reçus sont étalés sur {v} s' },
  mousseEpaisse: { name: 'Mousse épaisse', effect: 'foamShield', value: 0.05, text: 'Un bouclier absorbe 1 coup toutes les {every} s' },
  jukeBox: { name: 'Juke-box', effect: 'levelUpWave', value: 1, text: 'Chaque niveau gagné repousse les ennemis' },
  bretelles: { name: 'Bretelles', stats: { maxHp: 10, moveSpeed: 0.03 }, text: '+{maxHp} PV max et +{moveSpeed%} vitesse' },
  casquette: { name: 'Casquette à bière', effect: 'standRegen', value: 2, text: '+{v} PV par seconde sans bouger' },
  tongs: { name: 'Tongs', stats: { moveSpeed: 0.1, jumpHeight: -0.1 }, text: '+{moveSpeed%} vitesse, saut moins haut' },
  sifflet: { name: "Sifflet d'arbitre", effect: 'whistle', value: 1, text: `Toutes les ${E.whistle.every} s, étourdit les ennemis proches {v} s` },
  paille: { name: 'Paille', stats: { lifeSteal: 0.015 }, text: '+{lifeSteal%} vol de vie' },
  piqueAssiette: { name: 'Pique-assiette', stats: { lifeSteal: 0.01, damage: 0.04 }, text: '+{lifeSteal%} vol de vie et +{damage%} dégâts' },
  porteMonnaie: { name: 'Porte-monnaie', stats: { coinGain: 0.1 }, text: '+{coinGain%} capsules' },
  tabouret: { name: 'Tabouret réservé', stats: { pumpSpeed: 0.2 }, text: 'Pompes à bière {pumpSpeed%} plus rapides' },
  bonReduction: { name: 'Bon de réduction', effect: 'freeChestChance', value: 0.05, text: '{v%} de chances qu\'un coffre soit gratuit' },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
