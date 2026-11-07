// Zombies (GDD section 11). Modèles CC0 Quaternius, passés en cel-shading comme le Buveur.

/** Les 4 variantes de zombie de base : fichier glTF et taille en jeu (mètres). */
export const ZOMBIE_MODELS = {
  basic: { file: 'Zombie_Basic.gltf', height: 1.85 },
  chubby: { file: 'Zombie_Chubby.gltf', height: 1.9 },
  arm: { file: 'Zombie_Arm.gltf', height: 1.85 },
  ribcage: { file: 'Zombie_Ribcage.gltf', height: 1.7 },
} as const;

export type ZombieModel = keyof typeof ZOMBIE_MODELS;

/** Déplacement des zombies (le joueur va à 9 m/s). */
export const ZOMBIE_MOVE = {
  /** Vitesse de marche (m/s), variée par zombie de +- speedJitter. */
  speed: 2.8,
  speedJitter: 0.15,
  /** Rayon du corps (collisions décor, écartement entre zombies). */
  radius: 0.4,
  /** Rayon du joueur pour la poussée corps contre corps. */
  playerRadius: 0.45,
  /** Bloqué si l'avancée réelle est sous ce ratio de l'avancée voulue. */
  stuckRatio: 0.3,
  /** Contournement : durée (s) et part de déviation sur le côté. */
  detourTime: 0.8,
  detourBlend: 0.75,
  /** Vitesse de marche (m/s) pour laquelle l'animation Walk joue à vitesse normale (pas de patinage). */
  walkAnimAt: 2.2,
} as const;

export const ZOMBIE_VISUAL = {
  /** Clips du glTF utilisés pour chaque état (premier trouvé dans la liste). */
  clips: {
    idle: ['Idle'],
    walk: ['Walk'],
    // Le zombie à côtes n'a pas d'attaque : il bondit (Jump) à la place
    attack: ['Idle_Attack', 'Punch', 'Jump'],
    hit: ['HitReact'],
  },
  /** Fondu entre deux animations (s). */
  fade: 0.25,
  /** Vitesse de rotation vers sa cible (rad/s). */
  turnRate: 5,
  /** Distance au joueur à laquelle il frappe (m). */
  attackRange: 1.7,
  /** Distance à laquelle il remarque le joueur et se tourne vers lui (m). */
  noticeRange: 14,
  /** Variation de vitesse d'animation par zombie (+-), pour qu'ils ne bougent pas en rythme. */
  animJitter: 0.12,
} as const;
