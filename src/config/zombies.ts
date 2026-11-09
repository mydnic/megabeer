// Zombies (GDD section 11). Modèles CC0 Quaternius, passés en cel-shading comme le Buveur.

/**
 * Les modèles 3D des ennemis (un par type d'ennemi, voir enemies.ts) : fichier glTF, taille en jeu
 * (mètres), et au besoin clips propres (sinon ceux de ZOMBIE_VISUAL.clips) et vitesse (m/s) pour
 * laquelle l'animation de déplacement joue à vitesse normale.
 */
export const ZOMBIE_MODELS = {
  basic: { file: 'Zombie_Basic.gltf', height: 1.5 },
  chubby: { file: 'Zombie_Chubby.gltf', height: 1.55 },
  // Les moines : le Moine de Čestmír Dammer (kelgar.org), préparé par tools/blender/monk.py
  // Sa marche d'origine est lente (0,56 m/s à cette taille) : jouée deux fois plus vite, la bure cache le glissement
  moine: { file: 'moine.glb', height: 2.0, walkAnimAt: 1.2 },
  // Le Pèlerin gonflé : bure rouge vin et tonneau enfilé autour du ventre (monk.py --variant pelerin). Il court.
  moine_pelerin: { file: 'moine_pelerin.glb', height: 2.0, clips: { walk: ['Run'] }, walkAnimAt: 1.8 },
  // Le Frère tonnelier : bure ardoise, il pousse devant lui un gros tonneau qui roule sans fin (monk.py --variant tonnelier)
  moine_tonnelier: { file: 'moine_tonnelier.glb', height: 2.0, walkAnimAt: 1.2 },
  // Le Moine porte-reliques : Rogue encapuchonné KayKit en bure crème, un coffret doré à la main (tools/blender/kaykit.py)
  porte_reliques: { file: 'porte_reliques.glb', height: 1.5, walkAnimAt: 1.6 },
  // Le Fantôme du cloître : fantôme du kit Kenney cimetière (pièces animées, sans squelette), translucide, il flotte
  fantome: {
    file: 'character-ghost.glb', height: 1.2, walkAnimAt: 2.5,
    clips: { idle: ['idle'], walk: ['walk'], attack: ['attack-melee-right'], hit: ['emote-no'], death: ['die'] },
    /** Au-dessus du sol (m), et ondulation (m, par seconde). */
    hover: 0.25, bob: 0.1, bobSpeed: 2.2,
    /** Opacité normale, et quand il est intouchable. */
    translucent: { opacity: 0.8, intangible: 0.15 },
  },
  // Le Novice : il court (et bondit pour frapper, il n'a pas d'attaque)
  ribcage: { file: 'Zombie_Ribcage.gltf', height: 1.4, clips: { walk: ['Run'] }, walkAnimAt: 3.7 },
} as const;

export type ZombieModel = keyof typeof ZOMBIE_MODELS;

/** Déplacement des zombies (le joueur va à 9 m/s). */
export const ZOMBIE_MOVE = {
  /** Variation de vitesse par zombie (+-), la vitesse elle-même est propre à chaque ennemi (enemies.ts). */
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
  /** Vitesse de marche (m/s) pour laquelle l'animation Walk joue à vitesse normale (pas de patinage), zombies Quaternius de 1,5 m. */
  walkAnimAt: 1.8,
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

/** Ressenti quand un zombie est touché, puis meurt. */
export const ZOMBIE_HURT = {
  /** Flash blanc (s) et intensité. */
  flashTime: 0.12,
  flashIntensity: 1.6,
  /** Recul : vitesse (m/s) et amortissement (s). */
  knockSpeed: 4.5,
  knockDecay: 0.14,
  /** Réaction au coup (animation HitReact) : durée pendant laquelle il n'avance ni ne frappe (s). */
  stagger: 0.35,
  /** Mort : temps couché au sol (s, après la fin de l'animation), puis enfoncement dans le sol (s, m). */
  corpseTime: 0.8,
  sinkTime: 1.0,
  sinkDepth: 1.2,
  /** Recul plus fort sur le coup fatal (multiplicateur). */
  deathKnock: 1.6,
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
  /** Place réservée au départ sur la carte graphique par modèle (elle double quand elle est pleine). */
  initialPerModel: 600,
  /** Images par seconde des animations pré-calculées pour la carte graphique. */
  bakeFps: 60,
  /** Clips du glTF utilisés pour chaque état (premier trouvé dans la liste). */
  clips: {
    idle: ['Idle'],
    walk: ['Walk'],
    // Le zombie à côtes n'a pas d'attaque : il bondit (Jump) à la place
    attack: ['Idle_Attack', 'Punch', 'Jump'],
    hit: ['HitReact'],
    death: ['Death'],
  },
  /** Cadence maxi de l'animation de marche (fois la normale) : une course rapide ne la fait pas s'emballer. */
  maxWalkRate: 3,
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
