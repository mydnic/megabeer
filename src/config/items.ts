// Objets passifs (GDD section 7) : ils ne sortent que des coffres. Chaque objet a UNE rareté (`rarity`, index dans
// RARITIES) et un effet fixe (choix de l'utilisateur le 2026-11-12) : un coffre propose 3 objets différents de sa rareté.
// Une dizaine d'objets par rareté. Un objet donne des stats (`stats`, plusieurs possibles), un effet spécial (`effect`
// et sa `value`), ou les deux. Les copies d'un même objet s'additionnent. Le texte de la carte (`text`) remplace {clé}
// par la valeur : {clé} en nombre, {clé%} en pourcentage ; `v` est la valeur de l'effet.

/** Stats du joueur qu'un objet peut monter (champs de PlayerStats, sauf maxHp : les PV max). */
export type ItemStatId =
  | 'damage' | 'attackSpeed' | 'maxHp' | 'moveSpeed' | 'pickupRange' | 'xpGain' | 'luck' | 'extraProjectiles'
  | 'critChance' | 'critDamage' | 'size' | 'duration' | 'regen' | 'armor' | 'dodge' | 'knockback' | 'lifeSteal'
  | 'coinGain' | 'pumpSpeed' | 'chestDiscount' | 'jumpHeight';

/** Effets spéciaux (un déclencheur et un effet), réglés dans ITEM_EFFECTS. */
export type EffectId =
  | 'explodeOnKill' | 'foamShield' | 'happyHour' | 'healOnXp' | 'slowOnHit' | 'freezeChance' | 'closeDamage'
  | 'eliteDamage' | 'crowdBoost' | 'extraShotChance' | 'lowHpDamage' | 'damageSpread' | 'musicWave'
  | 'standRegen' | 'whistle' | 'revive' | 'freeChest' | 'freeChestChance' | 'doubleJump';

export type ItemDef = {
  name: string;
  /** Sa rareté (index dans RARITIES : 0 Commun, 1 Peu commun, 2 Rare, 3 Dingue, 4 Légendaire). */
  rarity: number;
  /** Texte de la carte : {clé} et {clé%} remplacés par les valeurs (`v` : l'effet). */
  text: string;
  /** Stats montées. */
  stats?: Partial<Record<ItemStatId, number>>;
  /** Effet spécial et sa valeur (sens dans ITEM_EFFECTS). */
  effect?: EffectId;
  value?: number;
};

/**
 * Réglages des effets spéciaux. La valeur de l'objet (copies additionnées) :
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
 * - musicWave (Juke-box) : toutes les `every` s, une onde part du joueur et touche les ennemis à moins
 *   de `radius` m (stat Taille) : `v` dégâts (qui suivent les PV des ennemis au fil de la run et la stat
 *   Dégâts) et un recul `knock` (stat Recul).
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
  musicWave: { every: 10, radius: 7, knock: 3 },
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
  tourneeRapide: { name: 'Tournée rapide', rarity: 0, stats: { attackSpeed: 0.08 }, text: "+{attackSpeed%} vitesse d'attaque" },
  biereForte: { name: 'Bière plus forte', rarity: 0, stats: { damage: 0.08 }, text: '+{damage%} dégâts' },
  pinteXXL: { name: 'Pinte XXL', rarity: 0, stats: { size: 0.1 }, text: '+{size%} taille des explosions et des ondes' },
  kebab: { name: 'Kebab de 4h', rarity: 0, stats: { duration: 0.1 }, text: '+{duration%} durée des effets' },
  culSec: { name: 'Cul sec', rarity: 0, stats: { critChance: 0.04 }, text: '+{critChance%} chances de critique' },
  briquet: { name: 'Briquet', rarity: 0, stats: { critDamage: 0.15 }, text: '+{critDamage%} dégâts critiques' },
  sansAlcool: { name: 'Bière sans alcool', rarity: 0, stats: { regen: 0.5 }, text: '+{regen} PV par seconde' },
  ventreABiere: { name: 'Ventre à bière', rarity: 0, stats: { maxHp: 15 }, text: '+{maxHp} PV max' },
  bonnet: { name: 'Bonnet du Père Noël', rarity: 4, effect: 'freeChest', value: 2, text: `Un coffre gratuit apparaît toutes les {every} s` },
  trefle: { name: 'Trèfle de comptoir', rarity: 1, stats: { luck: 8 }, text: '+{luck} chance' },
  // +20 % de la portée de base (5 m)
  aimantCapsules: { name: 'Aimant à capsules', rarity: 1, stats: { pickupRange: 1.5 }, text: "+{pickupRange} m portée d'attraction" },
  godasses: { name: 'Godasses de bar', rarity: 0, stats: { moveSpeed: 0.06 }, text: '+{moveSpeed%} vitesse' },
  seauAGlace: { name: 'Seau à glace', rarity: 2, effect: 'slowOnHit', value: 0.2, text: `Les ennemis touchés sont ralentis de {v%} (${E.slowOnHit.time} s)` },
  deuxMains: { name: 'Deux mains', rarity: 2, stats: { extraProjectiles: 1 }, text: '+{extraProjectiles} projectile' },
  pression: { name: 'Pression du fût', rarity: 1, stats: { knockback: 0.22 }, text: '+{knockback%} recul des ennemis touchés' },
  gueuleDeBois: { name: 'Gueule de bois', rarity: 3, stats: { armor: 3 }, text: '+{armor} armure (PV en moins par coup reçu)' },
  ticketTournee: { name: 'Ticket de tournée', rarity: 1, stats: { xpGain: 0.15 }, text: "+{xpGain%} gain d'XP" },
  gantsVideur: { name: 'Gants de videur', rarity: 2, effect: 'closeDamage', value: 0.3, text: `+{v%} dégâts aux ennemis à moins de ${E.closeDamage.range} m` },
  lunettes: { name: 'Lunettes de comptoir', rarity: 2, effect: 'eliteDamage', value: 0.3, text: '+{v%} dégâts aux gros ennemis' },
  echarpe: { name: 'Écharpe de supporter', rarity: 3, effect: 'crowdBoost', value: 0.3, text: `+{v%} vitesse et +${E.crowdBoost.armor} armure entouré de ${E.crowdBoost.count} ennemis` },
  cochonnet: { name: 'Cochonnet', rarity: 3, effect: 'extraShotChance', value: 0.3, text: '{v%} de chances de tirer un projectile de plus' },
  cacahuetes: { name: 'Sachet de cacahuètes', rarity: 2, effect: 'healOnXp', value: 0.4, text: "Chaque goutte d'XP soigne {v} PV" },
  cendrier: { name: 'Cendrier', rarity: 4, effect: 'explodeOnKill', value: 0.2, text: '{v%} des ennemis tués explosent' },
  demarche: { name: 'Démarche de pochtron', rarity: 1, stats: { dodge: 0.06 }, text: '+{dodge%} esquive' },
  // --- Autres objets
  ressort: { name: 'Ressort de canapé', rarity: 2, effect: 'doubleJump', value: 1, text: 'Double saut' },
  secondeTournee: { name: 'Seconde tournée', rarity: 4, effect: 'revive', value: 0.5, text: 'Revivre une fois avec {v%} des PV' },
  carteFidelite: { name: 'Carte de fidélité', rarity: 2, stats: { chestDiscount: 0.16 }, text: 'Coffres {chestDiscount%} moins chers' },
  happyHour: { name: 'Happy hour', rarity: 4, effect: 'happyHour', value: 16, text: `Toutes les ${E.happyHour.every} s : attaque x${E.happyHour.rate} pendant {v} s` },
  glacons: { name: 'Glaçons', rarity: 2, effect: 'freezeChance', value: 0.06, text: `{v%} de chances de geler un ennemi touché ${E.freezeChance.time} s` },
  lastOrder: { name: 'Last order', rarity: 3, effect: 'lowHpDamage', value: 0.6, text: `+{v%} dégâts sous ${E.lowHpDamage.below * 100} % PV` },
  ardoise: { name: 'Ardoise du bar', rarity: 3, effect: 'damageSpread', value: 6, text: 'Les dégâts reçus sont étalés sur {v} s' },
  mousseEpaisse: { name: 'Mousse épaisse', rarity: 4, effect: 'foamShield', value: 0.1, text: 'Un bouclier absorbe 1 coup toutes les {every} s' },
  jukeBox: { name: 'Juke-box', rarity: 4, effect: 'musicWave', value: 32, text: `Toutes les ${E.musicWave.every} s, une onde fait {v} dégâts et repousse` },
  bretelles: { name: 'Bretelles', rarity: 1, stats: { maxHp: 15, moveSpeed: 0.045 }, text: '+{maxHp} PV max et +{moveSpeed%} vitesse' },
  casquette: { name: 'Casquette à bière', rarity: 3, effect: 'standRegen', value: 6, text: '+{v} PV par seconde sans bouger' },
  tongs: { name: 'Tongs', rarity: 1, stats: { moveSpeed: 0.15, jumpHeight: -0.1 }, text: '+{moveSpeed%} vitesse, saut moins haut' },
  sifflet: { name: "Sifflet d'arbitre", rarity: 3, effect: 'whistle', value: 2, text: `Toutes les ${E.whistle.every} s, étourdit les ennemis proches {v} s` },
  paille: { name: 'Paille', rarity: 2, stats: { lifeSteal: 0.03 }, text: '+{lifeSteal%} vol de vie' },
  piqueAssiette: { name: 'Pique-assiette', rarity: 3, stats: { lifeSteal: 0.03, damage: 0.12 }, text: '+{lifeSteal%} vol de vie et +{damage%} dégâts' },
  porteMonnaie: { name: 'Porte-monnaie', rarity: 1, stats: { coinGain: 0.15 }, text: '+{coinGain%} capsules' },
  tabouret: { name: 'Tabouret réservé', rarity: 1, stats: { pumpSpeed: 0.3 }, text: 'Pompes à bière {pumpSpeed%} plus rapides' },
  bonReduction: { name: 'Bon de réduction', rarity: 4, effect: 'freeChestChance', value: 0.2, text: '{v%} de chances qu\'un coffre soit gratuit' },
} as const satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
