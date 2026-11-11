// Tournées du bar : bonus que les ennemis lâchent rarement (la Chance augmente le drop). Ramassée, une
// tournée agit tout de suite (Tournée générale, Seau à glace, Frites-mayo) ou pendant quelques secondes.
// Liste choisie par l'utilisateur le 2026-11-11 (pas une copie de Megabonk). Valeurs de départ, à caler.

export type TourneeId = 'generale' | 'pression' | 'seau' | 'doublePinte' | 'peket' | 'casque' | 'fritesMayo' | 'sousBock';

export type TourneeDef = {
  name: string;
  /** Ce qu'elle fait (bandeau au ramassage). */
  text: string;
  /** Poids au tirage (plus haut : plus fréquente). */
  weight: number;
  /** Durée (s) ; 0 : effet immédiat. */
  duration: number;
  /** Couleur (halo au sol, HUD, effets). */
  color: number;
};

export const TOURNEES: Record<TourneeId, TourneeDef> = {
  generale: { name: 'Tournée générale', text: 'Le patron paie sa tournée : tout ce qui est autour prend cher', weight: 1, duration: 0, color: 0xffc93a },
  pression: { name: 'Pression max', text: 'Dégâts des armes x2 pendant 15 s', weight: 1.2, duration: 15, color: 0xff7a2a },
  seau: { name: 'Seau à glace', text: 'Tous les ennemis proches gelés', weight: 1.2, duration: 0, color: 0xa8e4ff },
  doublePinte: { name: 'Double pinte', text: 'XP x2 pendant 20 s', weight: 1.2, duration: 20, color: 0xffd45a },
  peket: { name: 'Péket', text: 'Vitesse +60 % pendant 12 s', weight: 1.2, duration: 12, color: 0x5ab4ff },
  casque: { name: 'Casque à bière', text: 'Invulnérable 8 s, les ennemis rebondissent', weight: 0.8, duration: 8, color: 0xe2362e },
  fritesMayo: { name: 'Frites-mayo', text: '+40 PV et régénération 10 s', weight: 1, duration: 10, color: 0xf2c94c },
  sousBock: { name: 'Sous-bock porte-bonheur', text: 'Chance +10 pendant 30 s', weight: 0.8, duration: 30, color: 0x6ad46a },
};

/** Réglages des effets. */
export const TOURNEE_FX = {
  /** Tournée générale : dégâts (comme une arme, suivent les PV des ennemis au fil de la run) dans `radius` m. */
  generale: { damage: 40, radius: 30, knock: 2 },
  pression: { damageMul: 2 },
  /** Seau à glace : ennemis gelés dans `radius` m, pendant `freeze` s. */
  seau: { radius: 15, freeze: 5 },
  doublePinte: { xpMul: 2 },
  peket: { speedMul: 1.6 },
  /** Casque à bière : recul des ennemis qui touchent le Buveur. */
  casque: { knock: 6 },
  /** Frites-mayo : soin immédiat, puis PV par seconde. */
  fritesMayo: { heal: 40, regen: 3 },
  sousBock: { luck: 10 },
} as const;

/** Tirage : chance qu'un ennemi tué lâche une tournée (en plus de son XP), et ce qu'ajoute chaque point de Chance. */
export const TOURNEE_DROPS = {
  dropChance: 0.006,
  dropLuck: 0.12,
  /** Vol au sol : comme les gouttes d'XP (aspirées par le Ramassage). */
  radius: 0.7,
  hover: 0.9,
  bob: 0.15,
  bobSpeed: 2.6,
  startSpeed: 6,
  attract: 45,
  maxSpeed: 30,
  collectDist: 0.8,
  /** Restent au sol `life` s, clignotent les `blink` dernières. */
  life: 30,
  blink: 5,
  max: 30,
} as const;
