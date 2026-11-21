// Naruto : un ninja qui traverse la planète en courant, bras en arrière, bien plus vite que le joueur. Il change de
// direction au hasard et souffle de temps en temps. Le toucher le fait disparaître dans un nuage de fumée : il laisse
// un coffre légendaire gratuit. Un seul par run, présent dès le début, loin du point d'arrivée.

export const NARUTO = {
  /** Taille (m) et modèle (src/assets/models/<file>, fait par `tools/blender/allies.py --variant naruto`). */
  height: 1.65, file: 'naruto.glb',
  /** Placement : à plus de `minFromSpawn` m de l'arrivée ; essais. */
  minFromSpawn: 40, tries: 200,
  /** Vitesse de course (m/s ; le joueur court à BASE_SPEED, 9 m/s). */
  speed: 17,
  /** Il court entre `run[0]` et `run[1]` s, puis souffle entre `rest[0]` et `rest[1]` s (sur place : le moment de l'attraper). */
  run: [5, 9], rest: [1.2, 2.2],
  /** En course, il change de cap toutes les `turnEvery[0]` à `turnEvery[1]` s, de `turnMax` degrés au plus ; il vire à `turnRate` rad/s. */
  turnEvery: [0.8, 2], turnMax: 70, turnRate: 4,
  /** Il regarde `lookAhead` m devant lui : un mur ou un arbre, et il repart ailleurs. */
  lookAhead: 2.5,
  /** On l'attrape en arrivant à moins de `catchRange` m de lui (à pied ou en véhicule). */
  catchRange: 1.6,
  /** Coffre gratuit laissé à sa place (rang dans RARITIES, 4 : Légendaire). */
  chestRarity: 4,
} as const;

/**
 * Rendu : cadence de la course (x, à pleine vitesse) ; nuage de fumée ninja quand on l'attrape (bouffées, couleurs,
 * taille m, durée s, hauteur du centre m, vitesse d'écart m/s, couleur de l'éclair).
 */
export const NARUTO_LOOK = {
  runRate: 1.6,
  smoke: { puffs: 22, color: 0xf2f0ea, dark: 0xb8b4ac, size: 0.9, life: [0.6, 1.1], height: 0.9, spread: 3.2, flash: 0xfff4d0 },
} as const;
