// Sons du Buveur et ambiances (aucune dépendance three.js). Volumes de 0 à 1.

export const AUDIO = {
  master: 0.8,
  sfx: 0.9,
  ambience: 0.55,
  /** Sons d'interface (cartes, level-up). */
  ui: 1,
  /**
   * Volumes réglés par le joueur dans Options (0 à 1), par-dessus les volumes ci-dessus : musique,
   * effets (sons du jeu et ambiances), interface. Valeurs par défaut au premier lancement.
   */
  userVolume: { music: 1, fx: 1, ui: 1 },
  /**
   * Musique (Zombie Survival, Modal Journey : maison, Suno ; les autres CC0, RandomMind, opengameart.org).
   * Menu (accueil) : `menu` en boucle. Run : un morceau tiré au hasard dans src/assets/music/<map>/
   * (déposer un mp3 dans le dossier suffit), joué en boucle toute la run.
   * Boss ou élite spécial : un morceau au hasard dans src/assets/music/boss/<id du boss>/, sinon dans
   * boss/default/ (Boss songs : maison, Suno). Un dossier par boss, il suffit d'y déposer un mp3.
   */
  music: {
    volume: 0.35,
    fade: 4,
    /** Menu avant de lancer le niveau, en boucle. */
    menu: 'main-menu.mp3',
  },
  /** Pas : volume, variation de hauteur (+-), et hauteur selon le sol. */
  footsteps: {
    volume: 0.18,
    pitchJitter: 0.08,
    /** Sol -> son Kenney et hauteur de lecture. */
    surfaces: {
      grass: { sample: 'footstep_grass', rate: 1.0 },
      dirt: { sample: 'footstep_grass', rate: 0.82 },
      stone: { sample: 'footstep_concrete', rate: 1.0 },
      snow: { sample: 'footstep_snow', rate: 1.0 },
    },
  },
  jump: { volume: 0.35 },
  /**
   * Ramassage des gouttes d'XP (bulles CC0, OpenGameArt). Les ramassages rapprochés montent en
   * hauteur (petit effet de série) ; un écart minimum évite la bouillie quand on en avale des dizaines.
   */
  /** Cartes de level-up (générés avec ElevenLabs, validés à l'écoute) : survol et choix. */
  cards: { hover: 'card_hover', hoverVolume: 0.5, pick: 'card_pick', pickVolume: 0.7 },
  /** Level-up : gorgée et "aaah" satisfait (ElevenLabs), à l'ouverture de l'écran des cartes. */
  levelUp: { sample: 'levelup', volume: 0.7 },
  pickup: { sample: 'bubble', volume: 0.4, minGap: 0.045, pitchStep: 0.05, pitchMax: 1.7, comboReset: 0.5 },
  land: { volume: 0.55, perSpeed: 0.05, max: 1 },
  /** Tintement de la pinte au saut et à la réception. */
  clink: { volume: 0.12, chance: 0.6 },
  /** Bouteilles lancées par les moines : souffle au lancer, verre brisé à l'impact (atténué avec la distance, m). */
  enemyShot: { throwVolume: 0.12, breakVolume: 0.5, hearDist: 30 },
  /** Pèlerin gonflé qui explose : tonneau qui éclate et gerbe de vin. */
  kamikaze: { woodVolume: 0.7, splashVolume: 0.6, hearDist: 35 },
  /** Frère tonnelier : coup sourd sur le tonneau quand il prend son élan. */
  charger: { aimVolume: 0.45, hearDist: 30 },
  /** Ambiances synthétisées : vent permanent, oiseaux le jour, chouette la nuit. */
  wind: { volume: 0.22 },
  birds: { volume: 0.05, everyMin: 0.8, everyMax: 3.5 },
  owl: { volume: 0.14, everyMin: 14, everyMax: 32 },
} as const;
