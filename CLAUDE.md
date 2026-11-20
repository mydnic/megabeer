# Megabeer

Survivors-like 3D low-poly dans le navigateur, entre potes. Un buveur (pinte à la main) survit sur
de petites planètes sphériques, en repoussant des zombies avec des armes à base de bière. Textes du
jeu en français.

**Reprise : lire d'abord [docs/REPRISE.md](docs/REPRISE.md)** : où en est le travail, la prochaine
étape, ce qu'on a appris avec l'utilisateur, les commandes des modèles, les pièges connus. Quand
l'utilisateur dit « reprends », c'est la « Prochaine étape » de ce fichier. Le tenir à jour à chaque
étape terminée, puis commit et push.

**Le document de référence est [docs/GDD.md](docs/GDD.md)** : vision, règles, roster, et surtout la
section 20 (développement agile feature par feature) et la section 21 (journal des décisions). Le
lire avant toute nouvelle feature.

Le jeu a été **refait de zéro** (three.js + TypeScript). L'ancien proto JS (scène plate, chunks,
`mapgen.js`, TUNAS...) n'existe plus dans `src/` ; le GDD le cite seulement comme historique.

## Méthode de travail

- **Feature par feature** : une feature n'est commencée que quand la précédente est 100 % finie et
  validée par l'utilisateur, découpée en checkpoints validés un par un en jeu.
- **Commit et push après chaque modification**, sans demander ni l'annoncer (demandé par
  l'utilisateur le 2026-11-09 : une autre session doit pouvoir reprendre au même endroit). `git pull`
  avant de pousser, jamais de `--force`. On revient en arrière avec git si besoin.
- **`git pull` en début de session** : d'autres personnes poussent sur ce repo.
- **Aucune attribution IA dans les commits** (pas de Co-Authored-By Claude, pas de trailer).
- Bugs et idées : GitHub Issues (`github.com/mydnic/megabeer`), pas de TODO dans le code.

## Stack et commandes

Vite + TypeScript + three.js (+ `three-mesh-bvh` pour les collisions du décor), yarn 4. Déploiement
Cloudflare (wrangler) : **Workers Builds construit et déploie chaque push sur `main`** (prod : megabeer.mydnic.be).

**Comptes et sauvegarde** : `worker/index.ts` (le Worker : sert le jeu, et sous `/api` la connexion Discord ou par email
(lien magique, Cloudflare Email Service : binding `EMAIL`, expéditeur `MAIL_FROM` ; simulé en local), les sessions, la sauvegarde et le classement), base D1 `megabeer` (schéma dans `migrations/`, à appliquer avec `wrangler d1 migrations apply megabeer
--local` en dev, `--remote` en prod). Secret `DISCORD_CLIENT_SECRET` : `wrangler secret put` en prod, `.dev.vars` en local
(non versionné). Côté jeu : `meta/profile.ts` (la progression, pure, testée), `app/progress.ts` (invité dans le navigateur,
ou en ligne ; la progression invitée rejoint le compte à la première connexion), `ui/accountPanel.ts` (le compte sur
l'accueil, avec les TUNAS). TUNAS (monnaie permanente) : `config/tunas.ts` (chance de drop, élites, boss, bonus de fin à
la mort, multiplicateur de difficulté dans `DIFFICULTIES`), liasses au sol `game.tunaDrops` et `pickups/tunaDropsView.ts`. Boutique : `config/shop.ts` (ce qui est donné au départ,
prix, persos à vendre), `meta/shop.ts` (catalogue, achat, `runUnlocks` appliqué à `game.unlocks` au début de chaque run),
`ui/shopScreen.ts`. Skill tree : `config/skills.ts` (lignes de paliers achetés dans l'ordre, prix), `meta/skills.ts`  ; bouton Skills de
l'accueil (même mise en page que la boutique). Ses bonus de stat s'appliquent au début de chaque run (`game.unlocks.bonuses`). Relancer / Bannir /
Passer : `game.rerollCards`, `banishCard`, `skipCards`, boutons sous les cartes de level-up (ligne Cartes du skill tree).
Succès : `config/achievements.ts` (liste, conditions, TUNAS), `game/achievements.ts` (suivi pendant la run, événement
`achievementUnlocked`, liste dans `runEnded`), gardés dans le profil ; bouton Succès de l'accueil. Un succès peut débloquer des articles réservés (`unlocks`, qui ne
s'achètent pas en boutique : `achievementFor` dans `meta/shop.ts`). `yarn dev` fait tourner le Worker et une D1 locale (plugin Cloudflare de Vite).

```
yarn dev        # http://localhost:5173
yarn build      # tsc --noEmit puis vite build : à lancer après chaque changement
yarn test       # tests fonctionnels (vitest, Node, sans navigateur) : à lancer après chaque changement
yarn deploy     # build + wrangler deploy (seulement sur demande)
node tools/bench/run.mjs          # banc de mesure du noyau en fin de partie (ms par image) ; --prof : profil CPU
node tools/runs/prod.mjs          # parties jouées en prod (base D1) ; --stats : par arme ; --dump ID : journal complet
```

**Performances** : la fin de partie (des centaines d'ennemis et de projectiles) ne doit pas ralentir. Avant et
après tout changement dans la horde, les armes ou les effets, lancer le banc (`node tools/bench/run.mjs`, puis
`node tools/bench/top.mjs` après `--prof` pour voir les fonctions les plus chères). En jeu, F3 affiche le temps
par partie de l'image (noyau, interface, vues, effets, monde, rendu). Règles : ne jamais parcourir toute la
horde pour chaque projectile ou chaque coup (passer par `horde.near` / `ctx.zombiesNear`), pas d'allocation
dans les boucles par image, un seul dessin instancié par type d'objet.

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
  équipées, 4 max), `levelUpCards.ts` (tirage sur les armes équipées), `pumps.ts`, `chests.ts` (coffres, dont les
  piégés), `bins.ts` (poubelles cassées au contact ou par les armes, grille pour les projectiles), `lastCall.ts` (Dernier
  service : cloches qui ramènent toute l'XP et les capsules), `boss.ts` (interface commune des boss), `frereSonneur.ts` et
  `abbe.ts` (contrôleurs des boss : leur corps est un zombie de la horde, `def.boss`), `vador.ts` (Dark Vador, issue #19 : coup de sabre marqué au sol avant de partir) et `graveBosses.ts` (boss optionnels : chacun attend devant le portail d'un cimetière, `GraveSite` donnés par le décor avec le départ, on le défie à la touche d'action, autant de boss à la fois qu'on veut : `game.bosses`, une barre de vie chacun ; réglages `GRAVE_BOSSES` et `VADOR` dans `config/bosses.ts`), `patronDoor.ts` (Porte du patron), `closing.ts` (fermeture à 10:00 : les Morts, intouchables, qui tuent d'un coup de faux), `vehicles.ts` (véhicules
  écrase-zombies, issue #8 : un garé à la fois, montée au contact ; la conduite de voiture est dans `player/controller.ts`
  (`drive`, `carSpeed`), l'écrasement, les PV du véhicule et la sortie dans `game.ts` ; réglages `config/vehicles.ts`, rendu
  `world/vehiclesView.ts`, jauges `ui/vehicleHud.ts`, modèles fournis dans `assets/models/vehicules/`), `allies.ts` (alliés des abbayes, issue #18 : un par abbaye (4 abbayes, 4 alliés), touché il suit le joueur 1 min comme un compagnon (il marche vers lui et s'arrête à distance, sans place fixe) et use de son
  pouvoir : Gandalf pétrifie, Krilin soigne et lance des Kienzan, Yoda repousse et sonne, Steve pose de la TNT ; ce qu'ils
  lancent ou posent vit dans `Allies` (`discs`, `tnts`) ; réglages `config/allies.ts`, rendu `world/alliesView.ts`), `radio.ts` (radio planquée, issue #16 : allumée à la touche d'action, elle devient le leurre de la horde, `horde.setDecoy`,
  et encaisse ses coups ; flux `RADIO.stream` joué par `app/sounds.ts`, musique du jeu coupée ; rendu `world/radioView.ts`),
  `saiyan.ts` (jauge de colère et transformation Super Saiyan, issue #7 : objet Sang Saiyan, touche F ou Y, paliers et
  bonus dans `config/saiyan.ts`, jauge `ui/saiyanHud.ts`), `tournees.ts` (Tournées du bar : bonus de quelques
  secondes lâchés par les ennemis, minuteries et multiplicateurs), `spawnDirector.ts` (arrivée des zombies et
  montée en difficulté, courbe dans `config/spawn.ts`), `mechanics/` (mécanique propre à chaque map, interface
  `MapMechanic` et registre : Abbaye = les cloches), `emitter.ts`.
- `weapons/` : `weapon.ts` (**interface `Weapon`** et `WeaponContext`), `registry.ts`, une arme
  par fichier : les 24 armes du roster V1. Évolutions : `config/evolutions.ts` (niveau 8 + objet = carte Évolution,
  bonus de réglages et `mods.evolved` lu par l'arme). Synergies : `SYNERGIES` (`config/weapons.ts`) lues par les armes
  avec `ctx.synergy(id)` (chiffres `SYNERGY_FX`) ; `ctx.zonesOf` et `ctx.trigger` pour celles qui relient deux armes. Les projectiles lancés partagent la brique
  `bottleWeapon.ts` (visée proche, solide ou groupe, volées, perçage, recul, et en option : rebonds, éclaboussure qui
  ralentit, brûlure, éventail, rebonds au sol, fragmentation, flaque de poison, vol à plat ou pointe en avant) ; les
  autres ont leur fichier (orbite `biereNoel.ts`, boomerang `decapsuleur.ts`, traînée `flaqueBiere.ts`, nuage
  `weizen.ts`, jet `tireuse.ts`, corne `corne.ts`, rot `rot.ts`, aura `odeur.ts`, plateaux qui bloquent `plateau.ts`,
  `spray.ts` : gouttes de jet pour l'affichage). Réglages des armes ajoutées après les cinq premières :
  `config/arsenal.ts`. Rendu : `bottleView.ts` (projectiles), `fx/zoneView.ts` (zones au sol : flaques, nuages, aura).
  **Ajouter une arme** = un fichier qui implémente `Weapon`, une entrée dans le registre, sa config et ses cartes
  (`config/arsenal.ts`), sa ligne dans `config/weaponFx.ts` (modèle, zone, impact, effet au sol, explosion, son),
  `WEAPON_INFO`, son icône (`ui/icons.ts`), son modèle (petits objets : `tools/blender/armes.py`), et ses tests.
  **Icônes** : un seul style (couleur, volume, contour épais) fourni par `ui/iconKit.ts` (dégradés partagés,
  formes `P` `C` `E` `R`, pinte, capsule, étincelle) ; armes, pompe, coffre et capsule dans `ui/icons.ts`, une
  icône par objet de coffre dans `ui/itemIcons.ts`, une par tournée du bar dans `ui/tourneeIcons.ts` (`iconDataUrl` : la
  même icône en texture 3D). Toute nouvelle icône passe par ce kit.
- `enemies/` : les ennemis sont des fiches (`config/enemies.ts` : `ENEMIES` et le roster de chaque map),
  `zombie.ts` et `horde.ts` (simulation, index spatial des zombies `horde.near`, briques Tireur, Kamikaze, Fantôme, Protecteur, Invocateur et Diviseur ; les armes visent
  `z.targetable`), `hordeView.ts` et `zombieLibrary.ts`
  (rendu, modèles et animations pré-calculées ; accepte aussi les personnages Kenney à pièces animées
  sans squelette, et les modèles translucides), `enemyShotsView.ts` et `kamikazeView.ts` (marques au sol `fx/groundMarks.ts`, qui
  épousent le relief, réservées aux dangers pour le joueur), `protectorView.ts` (étoile qui scintille au-dessus
  du protecteur ; liseré de lumière sur les protégés via l'attribut `aGlow` de la foule : règle de tous les
  buffs entre ennemis). `fx/shards.ts` : gerbes de morceaux (verre, vin, bois). `fx/sprites.ts` : particules face à la caméra dessinées
  par shader (lueur, étoile, anneau, fumée à deux tons) ; `fx/vfx.ts` : les recettes qui les composent (éclat
  d'impact, critique, ennemi tué, explosion, poussière, colonne de lumière, traînée), réglées dans `VFX`
  (`config/fx.ts`) et branchées sur les événements dans `app/effects.ts`. Elles s'allègent seules quand l'écran
  est chargé (`VFX.crowd`). `fx/ringWaveView.ts` : ondes au sol. `pickups/` : `xpDrops.ts` (gouttes d'XP, capsules et snacks partagent ce vol) + `xpDropsView.ts`, `coinDropsView.ts`,
  `snackDropsView.ts`, `bellDropsView.ts`. Cloches : `world/lastCallView.ts`. Poubelles : `world/binsView.ts` (couvercle qui s'envole, corps qui se couche).
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
- `render/` : `pipeline.ts` (RenderPass, GTAO, contours, bloom, profondeur de champ qui réutilise la profondeur
  du GTAO, étalonnage, ACES), `characterOutline.ts`, `materials.ts`, `quality.ts` (rendu léger sur écran tactile ou
  avec `?rendu=leger`, ou choisi dans Options > Graphismes : la scène va droit à l'écran, sans aucune passe d'effets ni contours (les cibles flottantes
  donnaient un écran blanc sur téléphone), terrain moins fin, réglages `RENDER.light` ; ombres coupées par défaut en rendu léger,
  elles faisaient perdre le contexte WebGL à une puce PowerVR, réglables dans les Options),
  `adaptiveResolution.ts` (la résolution de
  la scène baisse seule quand la carte graphique sature, réglages `RENDER.adaptive`).
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

`tools/blender/buveur.py` (le Buveur, rig et clips ; `--variant videur` : le Videur, sculpté avec `figure_kit.py`, mêmes os et mêmes clips, sortie `videur.glb`), `tools/blender/abbaye.py` et `tools/blender/monk.py`
(prépare le Moine de `MONK.blend` pour la foule : textures en un atlas, un seul matériau, animations
renommées comme les zombies ; `--variant` : lanceur, pelerin (bure rouge, tonneau sans fond autour du ventre) ou tonnelier (bure ardoise, gros tonneau qui roule devant lui, mains dessus), tonneau donné par `--barrel` ; source dans `Desktop/MODELS/personnages/kelgar_monk`) génèrent les GLB
de `src/assets/models/`, comme `tools/blender/kaykit.py` (personnages KayKit : pièces retirées, recolorés, objet
en main, animations du Rig_Medium ; sources lues dans `Desktop/MODELS`). `tools/blender/cloche.py` (cloche du Dernier service, avec ou sans potence), `tools/blender/pere_noel.py` (le Père Noël : modèle « Surprised Santa » en pièces rigides, recentré, bras rabaissés, chaque pièce attachée au squelette du Buveur dont les articulations sont replacées : il reprend toutes ses animations), `tools/blender/panneau.py` (panneau MORTEHAN façon Hollywood : une lettre par objet, posées une à une sur une hauteur face à l'abbaye du départ, `SIGN` dans `config/decor.ts`), `tools/blender/sonneur.py` (le Frère Sonneur, boss : modèle sculpté par remaillage, rig et clips, maillet dans la main droite, une cloche à main dans la gauche) et `tools/blender/abbe.py` (l'Abbé, boss final), `tools/blender/cop.py` (le Cop : modèle Mixamo monté sur le squelette de la Universal Animation Library de Quaternius, dont il prend les clips : `--ual`), `tools/blender/modular.py` (persos tirés du pack Ultimate Modular Men de Quaternius : une variante par perso, `--variant marie` : le Futur Marié, `--variant barman` : le Barman), `tools/blender/robot.py` (le Barman robot : modèle sans squelette remis en pose T et monté sur le squelette de la Universal Animation Library), `tools/blender/serveuse.py` (la Serveuse : modèle MikuMikuDance CC-BY monté sur le squelette de la Universal Animation Library, course de patineuse faite main), `tools/blender/pilier.py` (le Pilier de bar : sculpt cartoon nu, habillé par découpe en pièces et coques, monté sur la Universal Animation Library), `tools/blender/gandalf.py` (Gandalf, allié : le .blend « Wizard » fourni, texture recâblée, décor retiré, clips `idle` et `run` faits sur son squelette, `staff`), `tools/blender/allies.py` (les autres alliés montés sur la Universal Animation Library, clips `idle`, `run`, `power` : `--variant krilin`, `yoda`, `steve` (refait en six blocs avec la texture fournie) ; `--variant tnt` : le bloc de TNT de Steve), `tools/blender/sabre.py` (le sabre laser fourni, redressé pour le rendu des armes, matière `lame` lumineuse : `glow` des looks d'armes), `tools/blender/cheveux.py` (coiffures du Super Saiyan tirées de deux modèles de Goku fournis, recalées sur le visage, posées sur l'os de la tête du perso par `fx/hairView.ts`), `tools/blender/vador.py` (Dark Vador, boss de l'issue #19 : OBJ fourni sans texture, coloré par pièce, monté sur la Universal Animation Library, cape sur le dos, sabre laser du jeu en main, matières `glow_*` lumineuses), `tools/blender/mort.py` (la Mort de la fermeture, modèle Fab exporté d'Unreal ; GLB versionné malgré la licence Fab, à retirer en cas de plainte : le repli Falibu prend alors le relais), outils communs dans `tools/blender/figure_kit.py`. `tools/blender/monsters.py` (monstres Quaternius
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
