# Megabeer

Survivors-like 3D low-poly dans le navigateur, entre potes. Un buveur (pinte à la main) survit sur
de petites planètes sphériques, en repoussant des zombies avec des armes à base de bière. Textes du
jeu en français.

**Le document de référence est [docs/GDD.md](docs/GDD.md)** : vision, règles, roster, et surtout la
section 20 (développement agile feature par feature) et la section 21 (journal des décisions). Le
lire avant toute nouvelle feature.

Le jeu a été **refait de zéro** (three.js + TypeScript). L'ancien proto JS (scène plate, chunks,
`mapgen.js`, TUNAS...) n'existe plus dans `src/` ; le GDD le cite seulement comme historique.

## Méthode de travail

- **Feature par feature** : une feature n'est commencée que quand la précédente est 100 % finie et
  validée par l'utilisateur, découpée en checkpoints validés un par un en jeu.
- **Commiter après chaque modification**, sans demander ni l'annoncer : on revient en arrière avec
  git si besoin. Ne **jamais push** sans demande explicite.
- **`git pull` en début de session** : d'autres personnes poussent sur ce repo.
- **Aucune attribution IA dans les commits** (pas de Co-Authored-By Claude, pas de trailer).
- Bugs et idées : GitHub Issues (`github.com/mydnic/megabeer`), pas de TODO dans le code.

## Stack et commandes

Vite + TypeScript + three.js (+ `three-mesh-bvh` pour les collisions du décor), yarn 4. Déploiement
Cloudflare (wrangler).

```
yarn dev        # http://localhost:5173
yarn build      # tsc --noEmit puis vite build : à lancer après chaque changement
yarn test       # tests fonctionnels (vitest, Node, sans navigateur) : à lancer après chaque changement
yarn deploy     # build + wrangler deploy (seulement sur demande)
```

**Tests fonctionnels** (`tests/features/*.test.ts`) : des user stories ("une bouteille s'écrase
sur le premier zombie", "le level-up fige le jeu et propose 3 cartes") qui pilotent le noyau `Game`
comme un joueur via `tests/support/testGame.ts` (vraie planète d'une seed fixe, sans décor ni
rendu). Ils testent le comportement, pas l'implémentation : un refactor ne doit pas les casser.
Valeurs attendues lues dans `src/config/`, jamais recopiées. Toute nouvelle feature arrive avec
ses tests ; tout bug trouvé en jeu devient un test qui échoue avant d'être corrigé.

Ensuite vérifier en jeu dans le navigateur. En dev,
`window.__game` expose les objets principaux (joueur, caméra, ciel, décor, musique...) pour piloter
et inspecter depuis la console ; F3 affiche le debug. Le **panneau DEV** (coin haut droit, `src/dev/devPanel.ts`,
importé seulement en dev donc absent du build) fait apparaître des ennemis, donne de l'XP, godmode,
vitesse du temps, musique de boss... : c'est là qu'on ajoute les outils de test, **jamais de
touches cachées** dans le jeu. En run, Échap met en pause (et libère le curseur pour cliquer dans
le panneau). Les actions du panneau sont notées dans le journal de run (`dev`).

## Règle : toutes les valeurs de jeu dans `src/config/`

Chaque nombre qu'un designer voudrait régler vit dans `src/config/*.ts` (objets `as const`), jamais
en dur dans les systèmes. `world.ts` (planète, physique, caméra), `visual.ts` (rendu, cel-shading,
contours), `lighting.ts` (jour/nuit, brouillard), `decor.ts` (modèles, placement, lumières),
`buveur.ts` (animation, IK des pieds, éclaboussures), `audio.ts` (volumes, sons, musique).

## Architecture (`src/`) : principes SOLID, deux couches

**Le noyau (`src/game/` et la simulation des autres dossiers) ne connaît ni le navigateur, ni
three.js côté rendu, ni l'interface, ni les sons** : il tourne tel quel dans les tests. Tout ce qui
s'affiche ou s'entend s'abonne à ses événements typés (`game.events.on('zombieHit', ...)`) et
recopie son état à chaque image. Ne jamais remettre de logique de jeu dans `main.ts` ni dans `app/`.

- `game/` : `game.ts` (**le jeu** : phases accueil / run / mort, arrivée, combat, XP, level-up,
  pause ; `step(dt, input)` ; événements `GameEvents`), `playerStats.ts`, `loadout.ts` (armes
  équipées, 4 max), `levelUpCards.ts` (tirage sur les armes équipées), `spawnDirector.ts` (arrivée des zombies et
  montée en difficulté, courbe dans `config/spawn.ts`), `mechanics/` (mécanique propre à chaque map, interface
  `MapMechanic` et registre : Abbaye = les cloches), `emitter.ts`.
- `weapons/` : `weapon.ts` (**interface `Weapon`** et `WeaponContext`), `registry.ts`, une arme
  par fichier (`blonde.ts`, simulation et projectiles), son rendu à part (`bottleView.ts`).
  **Ajouter une arme** = un fichier qui implémente `Weapon`, une entrée dans le registre, sa config
  et ses cartes, son icône (`ui/icons.ts`), son rendu, et ses tests. Rien d'autre à toucher.
- `enemies/` : les ennemis sont des fiches (`config/enemies.ts` : `ENEMIES` et le roster de chaque map),
  `zombie.ts` et `horde.ts` (simulation, briques Tireur, Kamikaze, Fantôme et Protecteur ; les armes visent
  `z.targetable`), `hordeView.ts` et `zombieLibrary.ts`
  (rendu, modèles et animations pré-calculées ; accepte aussi les personnages Kenney à pièces animées
  sans squelette, et les modèles translucides), `enemyShotsView.ts` et `kamikazeView.ts` (marques au sol `fx/groundMarks.ts`, qui
  épousent le relief, réservées aux dangers pour le joueur), `protectorView.ts` (étoile qui scintille au-dessus
  du protecteur ; liseré de lumière sur les protégés via l'attribut `aGlow` de la foule : règle de tous les
  buffs entre ennemis). `fx/shards.ts` : gerbes de morceaux (verre, vin, bois). `pickups/` : `xpDrops.ts` + `xpDropsView.ts`.
- `app/` : l'application navigateur branchée sur le noyau, une responsabilité par fichier :
  `planet.ts` (seed, relief, décor, chargement), `screens.ts` (accueil, HUD, pause, level-up,
  mort), `effects.ts` (impacts, caméra, séquence de mort), `sounds.ts` (sons et musique),
  `runLogging.ts` (journal de run), `devTools.ts` (panneau DEV).
- `main.ts` : **assemblage seulement** (création des objets, boucle : `game.step` puis les vues).
  Physique du joueur à pas fixe 120 Hz dans le noyau, rendu interpolé (`player.renderPos`).
- `world/` : `terrain.ts` (planète sphérique, `heightAt(dir)` est la source de vérité du sol,
  sites des abbayes aplanis), `sky.ts` (soleil et lune en orbite, période 600 s, ombres),
  `clouds.ts`, `decor/` (chargement des GLB, placement, instancing, collisions par grille + BVH,
  abbaye pliée sur la sphère, lanternes).
- `player/` : `controller.ts` (déplacement sur la sphère, saut, collisions décor),
  `cameraRig.ts` (caméra orbitale qui glisse vers le perso au lieu de traverser le sol),
  `buveurVisual.ts` (animations, squash/stretch, événements sonores), `footIK.ts`, `beerSplash.ts`.
- `render/` : `pipeline.ts` (RenderPass, GTAO, contours, bloom, profondeur de champ, étalonnage,
  ACES), `characterOutline.ts`, `materials.ts`.
- `audio/` : `audio.ts` (Web Audio, bus sfx/ambiance/musique, échantillons Kenney),
  `ambience.ts` (vent, oiseaux, chouette synthétisés), `music.ts` (menu, puis un morceau
  au hasard de `music/<map>/` par run ; `startBoss(id)` / `endBoss()` jouent un morceau de
  `music/boss/<id>/`, sinon `boss/default/` : à brancher sur l'apparition et la mort des boss). Pour
  ajouter une musique, l'utilisateur dépose un mp3 dans le bon dossier, sans toucher au code.
- `core/input.ts` : clavier, souris, manette (ignorée quand la fenêtre n'a pas le focus).

## Direction artistique (validée, ne pas re-proposer les styles rejetés)

Décor éclairé façon "Escape from Duckov" : lumière dorée, ombres douces, GTAO, bloom, DOF léger,
étalonnage chaud. **Personnages et objets du décor en cel-shading** (`characterMaterial`, couche
`LAYER_CHARACTER`) avec contours écran ; le sol reste lisse. Rejetés : tout en cel-shading,
BD/aquarelle, Valheim, style anime, herbe dense.

## Modèles maison (Blender)

`tools/blender/buveur.py` (le Buveur, rig et clips), `tools/blender/abbaye.py` et `tools/blender/monk.py`
(prépare le Moine de `MONK.blend` pour la foule : textures en un atlas, un seul matériau, animations
renommées comme les zombies ; `--variant` : lanceur, pelerin (bure rouge, tonneau sans fond autour du ventre) ou tonnelier (bure ardoise, gros tonneau qui roule devant lui, mains dessus), tonneau donné par `--barrel` ; source dans `Desktop/MODELS/personnages/kelgar_monk`) génèrent les GLB
de `src/assets/models/`, comme `tools/blender/kaykit.py` (personnages KayKit : pièces retirées, recolorés, objet
en main, animations du Rig_Medium ; sources lues dans `Desktop/MODELS`). `tools/blender/monsters.py` (monstres Quaternius
à couleurs unies, rangées dans une palette). Outils communs dans `crowd_utils.py`.
Pas plus de 3 ennemis sur le même corps de base. Ne pas éditer les GLB à la main : modifier le script et relancer.

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P tools/blender/buveur.py -- --out src/assets/models/buveur.glb [--render DOSSIER]
```

`--render` produit des vues de contrôle (face, dos, course, saut). Les collisions du décor suivent
la géométrie réelle des modèles : les hitbox doivent coller aux modèles 3D.

## Assets

`src/assets/` : packs CC0 Kenney (graveyard, castle, impact sounds, UI audio, personnages) et
Quaternius (zombies, nourriture, props, véhicules), modèles maison, musique (`music/` : morceaux
Suno faits par l'utilisateur et 2 morceaux CC0 de RandomMind). Pour en récupérer d'autres : skill
`asset-fetch` (`.claude/skills/asset-fetch/SKILL.md`). Demander avant tout téléchargement.
