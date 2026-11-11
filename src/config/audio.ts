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
  /**
   * Cartes de level-up : survol, et choix = « tchin » (deux verres qui trinquent : deux tintements
   * rapprochés, le second plus aigu ; délai en s).
   */
  cards: {
    hover: 'card_hover', hoverVolume: 0.5,
    pick: [
      { sample: 'impactGlass_light', volume: 0.75, rate: 1.25, delay: 0 },
      { sample: 'impactGlass_light', volume: 0.6, rate: 1.45, delay: 0.07 },
    ],
  },
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
  /** Frère cellérier tué : il éclate, ses moinillons en sortent. */
  split: { sample: 'impactSoft_heavy', volume: 0.8, pitch: 0.7, hearDist: 35 },
  /** Prieur : tintement de cloche d'encensoir au début du geste, craquement de terre quand les squelettes sortent. */
  summon: { castSample: 'impactBell_heavy', castVolume: 0.35, castPitch: 1.6, earthSample: 'impactMining', earthVolume: 0.7, earthPitch: 0.6, hearDist: 35 },
  /**
   * Pompe à bière : la bière qui coule dans le verre pendant le remplissage (échantillon `pour`, un
   * seul versement complet), repris là où en est la pinte, coupé en fondu de `fade` s quand le joueur
   * sort de la zone ou que le jeu se fige ;
   * sans fichier, rien ne se joue. `full` : la pinte est pleine.
   */
  pump: { pour: 'pour', pourVolume: 0.5, fade: 0.15, full: 'impactGlass_light', fullVolume: 0.6, fullRate: 1.1 },
  /** Coffre : ouverture (bois qui claque), refus faute de capsules (petit choc sourd). */
  /**
   * Révélation de la rareté : une note de verre par rareté (Commun 1, Légendaire 5), de plus en plus
   * aiguë, espacées de `gap` s ; dès Dingue, une cloche grave en plus.
   */
  reveal: { sample: 'impactGlass_light', volume: 0.55, rate: 1.0, step: 0.2, gap: 0.12, bell: 'impactBell_heavy', bellVolume: 0.5, bellRate: 0.7, bellFrom: 3 },
  /**
   * Objets à effet : explosion du Cendrier (souffle sourd, entendu jusqu'à `hearDist` m), bouclier de
   * mousse qui revient et qui éclate (bulles), début de la Happy hour (cloche).
   */
  items: {
    ash: { sample: 'impactSoft_heavy', volume: 0.55, rate: 0.7, hearDist: 30 },
    foamUp: { sample: 'bubble', volume: 0.45, rate: 1.1 },
    foamPop: { sample: 'bubble', volume: 0.8, rate: 0.7 },
    happyHour: { sample: 'impactBell_heavy', volume: 0.45, rate: 1.4 },
    /** Gel d'un ennemi (Glaçons, Sifflet) : verre fin très aigu ; au plus un tous les `minGap` s. */
    freeze: { sample: 'impactGlass_light', volume: 0.35, rate: 1.8, minGap: 0.08 },
    whistle: { sample: 'impactMetal_light', volume: 0.5, rate: 2.2 },
    shockwave: { sample: 'impactSoft_heavy', volume: 0.5, rate: 0.6 },
    dodge: { volume: 0.35 },
    revive: { sample: 'impactBell_heavy', volume: 0.7, rate: 0.8 },
    freeChest: { sample: 'impactWood_heavy', volume: 0.5, rate: 1.2 },
  },
  /** Roulette de l'ouverture : un tic par changement de couleur, de plus en plus aigu. */
  revealTick: { sample: 'impactPlate_light', volume: 0.35, rate: 1.3, rise: 0.9 },
  chest: { open: 'impactWood_heavy', openVolume: 0.7, openRate: 1.1, deny: 'impactPlate_light', denyVolume: 0.5, denyRate: 0.8 },
  /** Coffre piégé : le bois éclate et un souffle sourd. */
  trap: { wood: 'impactWood_heavy', woodVolume: 0.9, woodRate: 0.8, boom: 'impactSoft_heavy', boomVolume: 0.9, boomRate: 0.55 },
  /** Dernier service : trois coups de cloche, de plus en plus aigus, espacés de `gap` s. */
  lastCall: { sample: 'impactBell_heavy', volume: 0.8, rate: 0.9, step: 0.12, gap: 0.22, count: 3 },
  /** Tournée du bar ramassée : verre qui tinte, puis une bulle ; fin d'une tournée : petit tintement grave. */
  tournee: { sample: 'impactGlass_light', volume: 0.7, rate: 1.3, bubble: 'bubble', bubbleVolume: 0.6, end: 'impactGlass_light', endVolume: 0.35, endRate: 0.7 },
  /** Poubelle cassée : tôle qui claque (atténuée avec la distance, m) ; snack mangé : croquant. */
  bin: { sample: 'impactMetal_heavy', volume: 0.55, rate: 1.1, hearDist: 30 },
  snack: { sample: 'impactPunch_medium', volume: 0.5, rate: 1.6 },
  /** Capsule (Pièce) ramassée : petit tintement métallique aigu. */
  coin: { sample: 'impactMetal_light', volume: 0.45, rate: 1.9, minGap: 0.05 },
  /** Fondu de l'ambiance quand une partie commence ou finit (constante de temps, s). */
  ambienceFade: 0.6,
  /** Ambiances synthétisées : vent permanent, oiseaux le jour, chouette la nuit. */
  wind: { volume: 0.22 },
  birds: { volume: 0.05, everyMin: 0.8, everyMax: 3.5 },
  owl: { volume: 0.14, everyMin: 14, everyMax: 32 },
} as const;
