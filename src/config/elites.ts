// Élites classiques (GDD section 11) : un ennemi normal de la map, 2 fois plus grand et 2 fois plus fort, avec un
// liseré de couleur. Ils arrivent seuls dans la horde ; tués, ils laissent un coffre gratuit (demande de
// l'utilisateur le 2026-11-11, à la place de la poignée de Pièces du GDD). Valeurs de départ, à caler.

export const ELITES = {
  /** Premier élite (s de run), puis un toutes les `every` s. */
  from: 60,
  every: 45,
  /** Taille, PV et dégâts multipliés. */
  sizeMul: 2,
  hpMul: 2,
  damageMul: 2,
  /** Liseré de lumière sur leur silhouette : couleur et intensité. */
  color: 0xff3b2a,
  glow: 0.55,
} as const;
