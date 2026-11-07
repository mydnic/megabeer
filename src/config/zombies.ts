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

/** Le coup au contact (les dégâts arriveront avec les PV, feature 3). */
export const ZOMBIE_ATTACK = {
  /** Moment du coup dans l'animation d'attaque (fraction du clip : le bras arrive sur la cible). */
  hitAt: 0.45,
  /** Distance maxi pour que le coup porte (m) : un joueur qui s'écarte à temps l'esquive. */
  reach: 2.0,
  /** Recul du Buveur : vitesse au sol (m/s), petit saut (m/s), amortissement (s). */
  knockSpeed: 8,
  knockLift: 3.5,
  knockDecay: 0.18,
} as const;

/** Ressenti du coup reçu. */
export const HIT_FEEDBACK = {
  /** Flash rouge du Buveur : durée (s) et couleur. */
  flashTime: 0.18,
  flashColor: 0xff2a10,
  /** Tremblement de caméra (0 à 1, s'additionne) et amplitude maxi (m). */
  shake: 0.55,
  shakeAmplitude: 0.35,
  shakeDecay: 2.5,
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
  /** Marge au-delà de la portée avant d'arrêter d'enchaîner les coups (m). */
  attackExit: 0.6,
  /** Temps minimum dans un état avant de passer de la marche à l'arrêt ou l'inverse (s). */
  minStateTime: 0.3,
  /** Distance à laquelle il remarque le joueur et se tourne vers lui (m). */
  noticeRange: 14,
  /** Variation de vitesse d'animation par zombie (+-), pour qu'ils ne bougent pas en rythme. */
  animJitter: 0.12,
} as const;
