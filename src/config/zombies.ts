// Zombies (GDD section 11). Modèles CC0 Quaternius, passés en cel-shading comme le Buveur.

/** Les 4 variantes de zombie de base : fichier glTF et taille en jeu (mètres). */
export const ZOMBIE_MODELS = {
  basic: { file: 'Zombie_Basic.gltf', height: 1.85 },
  chubby: { file: 'Zombie_Chubby.gltf', height: 1.9 },
  arm: { file: 'Zombie_Arm.gltf', height: 1.85 },
  ribcage: { file: 'Zombie_Ribcage.gltf', height: 1.7 },
} as const;

export type ZombieModel = keyof typeof ZOMBIE_MODELS;

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
