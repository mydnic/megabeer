# Reprise du travail

**À lire en premier par toute session (Claude ou autre agent) qui reprend le projet.** Ce fichier dit
où on en est, ce qui vient ensuite, et ce qu'on a appris avec l'utilisateur. Il est tenu à jour à
chaque étape terminée (voir « Fin d'étape » en bas).

## Démarrer une session

1. `git pull` (d'autres sessions poussent sur ce dépôt).
2. Lire ce fichier, puis `CLAUDE.md` (règles du code), puis la section 21 de `docs/GDD.md` (journal
   des décisions) pour le détail de chaque choix.
3. `corepack yarn test` : tout doit passer avant de toucher au code.
4. Reprendre à la ligne « Prochaine étape » ci-dessous. Si l'utilisateur dit « reprends », c'est ça.

## Où on en est (mis à jour le 2026-11-09)

**Feature en cours : 7, spawn et montée en difficulté sur 10 min, avec le roster de l'Abbaye.**
Les features 1 à 6 sont finies et validées.

Fait et validé dans la feature 7 :
- Arrivée des ennemis en flux continu qui s'accélère avec le temps, sans limite de nombre
  (`src/game/spawnDirector.ts`, `src/config/spawn.ts`). Difficultés Sobre / Pompette / Bourré.
- Cloches de l'Abbaye : toutes les 2:00 pile, sans alerte, débarquement de 30 s d'un seul type
  d'ennemi tout autour du joueur (`src/game/mechanics/abbeyBells.ts`).
- Roster de l'Abbaye, un ennemi par minute :

| Min | Ennemi | Brique | Corps | État |
|---|---|---|---|---|
| 0 | Zombie | Marcheur | Quaternius Zombie Basic | validé |
| 1 | Novice zombie | Coureur | Quaternius Zombie Ribcage | validé |
| 2 | Moine lanceur | Tireur (bouteilles en cloche, impact marqué au sol) | Moine kelgar (`monk.py`) | validé |
| 3 | Pèlerin gonflé | Kamikaze (explose en gerbe de vin) | Moine, bure rouge, tonneau autour du ventre | validé |
| 4 | Frère tonnelier | Marcheur lourd, pousse un tonneau qui roule | Moine, bure ardoise | validé |
| 5 | Fantôme du cloître | Fantôme (traverse le décor, intouchable 1 s sur 3) | Fantôme Kenney cimetière | validé |
| 6 | Moine porte-reliques | Protecteur (voisins à -50 % de dégâts) | Rogue encapuchonné KayKit (`kaykit.py`) | validé |
| 7 | Gargouille | Marcheur (contact, coup de tête) | Dragon Animated Monsters en pierre (`monsters.py`) | validé |
| 8 | Prieur | Invocateur (3 squelettes KayKit sortent de terre toutes les 8 s) | Eye Summoner (Polygonal Mind) sur le squelette UAL (`summoner.py`) | validé |
| 9 | Frère cellérier | Tank + diviseur (60 PV ; tué, 3 moinillons sortent de son corps) | Quaternius Zombie Chubby (moinillons : le même en petit) | validé |

**Refonte visuelle (2026-11-10), à valider en jeu par l'utilisateur** : icônes, animations d'interface et effets
en jeu refaits en autonomie (détail dans le journal du GDD, ligne « Refonte visuelle »). Pour revenir en arrière :
tag git `avant-refonte-visuelle`. Réglages des effets : `VFX` dans `config/fx.ts`. En dev, `__game.vfx`,
`__game.sprites` et `__game.rings` permettent de lancer un effet depuis la console.

**Performances de fin de partie (2026-11-11)** : noyau et rendu optimisés (détail dans le journal du GDD, ligne
« Performances de fin de partie »). Banc de mesure : `node tools/bench/run.mjs` (référence : 2 à 3 ms par image selon les passages
pour 800 ennemis ; si ça remonte nettement, une régression est entrée). F3 en jeu : temps par partie de l'image.

**Prochaine étape :**
1. **La Stout est terminée et validée** (2026-11-09) : l'arme, la carte « nouvelle arme » au level-up et
   la synergie Black and Tan avec son affichage partout. Son évolution (Imperial Stout) attend l'objet
   « Bière plus forte » (feature objets). **Choisir avec l'utilisateur l'arme suivante** (roster GDD
   section 6) ou une autre feature (section 20).
   Visée de toutes les armes (demande de l'utilisateur) : `weapons/targeting.ts`, dégâts réservés par
   cible (`zombie.incoming`), hasard parmi les 3 plus proches encore vivants (`TARGETING.spread`).
   **La Gueuze** (n° 8) est **validée** (2026-11-09), visée comprise. Elle explose à l'impact si elle touche un zombie en vol. L'utilisateur
   dit « geuze » ou « kriek » indifféremment : c'est la même arme, nom affiché « Gueuze ». Fichiers : `weapons/gueuze.ts`,
   réglages `GUEUZE`, modèle `props.py --variant gueuze`, icône, explosion `GUEUZE_BURST` / `GUEUZE_BLAST`,
   événement `weaponExploded`, cartes `GUEUZE_UPGRADES`). DEV : « Donner l'arme » gueuze.
   **Le Fût qui roule** (n° 12) est **validé** (2026-11-09) : l'arme
   (`weapons/fut.ts`, réglages `FUT`, modèle `props.py --variant fut`, icône, sons `FUT_SOUND`, cartes
   `FUT_UPGRADES`), DEV : « Donner l'arme » fut. Ensuite : ses synergies (aucune avec la Canette ni la Stout
   au GDD ; Pétanque et Flaque de bière plus tard).
   Ce qui sert pour toute nouvelle arme :
   - armes à bouteille : brique `weapons/bottleWeapon.ts`, une arme = un réglage dans `WEAPONS`,
     son nom et sa présentation dans `WEAPON_INFO`, ses cartes dans `config/upgrades.ts`, son modèle
     (`tools/blender/props.py` découpe les objets KayKit / Kenney en matériaux nommés), son icône
     (`ui/icons.ts`), sa vue (une `createBottleView` par arme dans `main.ts`), ses tests ;
   - level-up (règle de l'utilisateur) : une carte par arme, une seule amélioration par arme, nouvelle
     arme garantie sous 3 armes (`game/levelUpCards.ts`) ;
   - synergies : une ligne dans `SYNERGIES` (`config/weapons.ts`) avec nom, effet, détails et couleur ;
     l'affichage (carte, bandeau, HUD, pause) suit tout seul (`game/synergies.ts`).
   Fait aussi le 2026-11-09 : la Blonde est devenue la **Canette** (canette de bière en métal, icône
   façon Jupiler 33cl), icône de la Stout façon Duvel marquée « Stout ». La Pils tiède est retirée du
   roster : l'arme n° 10 est à inventer avec l'utilisateur.
2. **En cours : l'exploration** (choisie le 2026-11-10 avant de caler la run : sans raison de bouger,
   l'équilibrage serait faussé). Ordre proposé : pompe à bière, puis Pièces et poubelles, puis fûts et
   premiers objets passifs, puis mini-carte. **Pompe à bière : checkpoint 1 fait, à faire valider**
   (placement, remplissage, choix de 3 bonus de stat avec rareté et LUCK, modèle, faisceau, jauge à l'écran,
   dôme de zone, icône tireuse). Sphère de zone ronde de 6 m, fût de 3,2 m, plein (collision en boîte mesurée sur le modèle,
   `PUMPS.body`, posée dans le collider du décor par `DecorCollider.setExtra` pour la durée de la run).
   **Mini-carte faite** (2026-11-10, à valider en jeu) : disque local sans brouillard, `ui/minimap.ts`.
   **En cours : Pièces et coffres** (choix de l'utilisateur). Coffre KayKit Dungeon (couvercle séparé, source
   `Desktop/MODELS/decor/kaykit_dungeon`), ouverture par touche d'action E / bouton X, prix croissant, 1 objet parmi 3.
   Fait : Pièces (capsules rouges, 30 % des kills à la place de l'XP, compteur HUD). Les tests tirent la capsule par
   `createTestGame(seed, { coins: 'never' | 'always' | 'real' })` (« never » par défaut).
   Fait aussi : 100 coffres (sol plat, collision, touche d'action E / bouton X, prix 5 +3 par coffre, rareté
   à l'ouverture, 1 objet parmi 3), premier lot de 8 objets à stat (`config/items.ts`), DEV « +50 capsules ».
   **Validé par l'utilisateur le 2026-11-10** (capsules à 30 %). Fait ensuite : ouverture façon lootbox dans le HUD
   (événement `chestRevealing`, `ui/chestReveal.ts`, cadence partagée avec les sons par `revealSchedule`), validé.
   Mini-carte : le relief suit la rotation de la caméra sans à-coups (corrigé). Puis : nouveau coffre dessiné
   (`chestSvg`), cartes qui sortent du coffre ouvert posé dessous, une icône par objet (validé), objets affichés
   dans le HUD sous les armes (`ui/itemHud.ts`) (tout validé par l'utilisateur le 2026-11-10). Puis : premier lot d'objets à effet
   (Cendrier, Mousse épaisse, Happy hour, Sachet de cacahuètes ; `game/itemEffects.ts`, DEV « Donner l'objet ») validé ;
   puis tous les autres objets faits en autonomie (42 sur 48, voir GDD : interprétations et 6 objets en attente de leur
   système), à valider en jeu. **Dernier service fait le 2026-11-11, à valider en jeu** (checkpoint 1 de « ramasser
   tout ce qui traîne ») : 4 grandes cloches sur la planète (faisceau doré, points sur la mini-carte, au bord quand elles
   sont loin), sonnées à E / X, et une clochette rare lâchée par les ennemis (`bellDropChance`, la Chance l'augmente) :
   toute l'XP et les capsules glissent le long du sol jusqu'au Buveur (`pullAll` de `pickups/xpDrops.ts`). Réglages
   `config/lastCall.ts`, DEV « Clochette devant ». Tests : `createTestGame(seed, { bellDrops: 'always' })`. **Checkpoint
   suivant : les Tournées du bar** (bonus temporaires de 15 s lâchés par les ennemis, vitesse, bouclier... à thème de bar ;
   proposer la liste à l'utilisateur, il ne veut pas une copie de Megabonk). Ensuite seulement : caler la run de 10 min.
   **Poubelles et coffre piégé faits et validés par l'utilisateur le 2026-11-11** : 150 poubelles
   (modèle « Trashcan » de Poly by Google fourni par l'utilisateur, `props.py --variant poubelle`), cassées au contact
   ou par une arme (projectile, impact au sol, explosion) ; butin XP / capsules / rarement un cornet de frites (+20 PV,
   premier snack, `props.py --variant frites`). Coffre piégé (8 %) : couvercle qui tressaute et coffre qui rougit,
   payé il explose (15 PV) et libère 8 zombies, capsules perdues. Réglages `config/bins.ts`, `CHEST_TRAP`. DEV :
   « Poubelle devant », « Coffre piégé devant ». Tests : `createTestGame(seed, { bins: true, traps: 'always' })`
   (sans poubelles ni pièges par défaut). Son de la bière qui coule : « Beer service 2 » de BigSoundBank (CC0, choisi par l'utilisateur),
   joué d'un bloc pendant le remplissage, repris au niveau de la pinte, coupé en fondu hors de la zone. Reste : sons du
   remplissage et de la pompe pleine, collision du fût (on le traverse), nombre de pompes (passé à 20, demande de l'utilisateur)
   (6 sur une planète d'environ 1 080 m de tour : la plus proche peut être à 190 m).
3. **Ensuite : caler la run de 10 min** (fin de feature 7), à partir des journaux de run de
   l'utilisateur (`logs/runs/`). Ses premières parties (2026-11-09) n'ont pas été enregistrées : le
   serveur de dev était arrêté (le journal part vers `/__runlog` du serveur ; la page déjà chargée
   continue de tourner sans lui). Toujours vérifier que `corepack yarn dev` tourne avant qu'il joue.
   Ses retours de ces parties : rien n'incite à explorer (on tourne en rond dans la même zone),
   peut-être trop d'XP, la 2e cloche lui a semblé plus petite (mesuré : chaque cloche fait sortir
   environ 240 ennemis, mais d'un seul type tiré au hasard ; lanceurs ou pèlerins pressent moins).
   Corrigé : carrés noirs (bulles des sonnés hors de `LAYER_SKY`), ambiance coupée sur l'accueil,
   son de choix de carte (« tchin »). À faire : XP et cloches selon ses journaux.
   Piège : ne pas accélérer le temps (`setTimeScale`) jusqu'à 10 min, la page sature et plante.

Idées notées pour plus tard (GDD section 14) : nœud « Dégâts collatéraux » du skill tree (les
attaques de zone des ennemis blesseraient aussi les autres ennemis).

Mécaniques essayées puis retirées, réutilisables plus tard (elles sont dans l'historique git) :
- Brique **Chargeur** (élan, ligne au sol, charge en ligne droite) : commit `f45b79d`, pour le Cariste.
- Brique **Sauteur** (bond en cloche sur une zone marquée, esquivable par le saut) : commit `f67a252`,
  pour la Majorette.

## Ce qu'on a appris avec l'utilisateur

**Méthode**
- Une feature à la fois, découpée en étapes validées une par une en jeu. On ne passe à la suite que
  sur « Validé ».
- Chaque fonctionnalité arrive avec ses tests fonctionnels (`tests/features/`, style « user story »)
  écrits avant le code. Tout bug trouvé devient d'abord un test qui échoue.
- **Commit et push après chaque modification**, sans demander ni l'annoncer (demande de
  l'utilisateur du 2026-11-09). `git pull` avant de pousser. Jamais de `--force`. Aucune attribution
  IA dans les messages de commit.
- Toujours vérifier en jeu dans le navigateur (le panneau Browser de l'app, `.claude/launch.json`)
  avant de dire que c'est fini.
- Réponses en français, franches, conclusion d'abord. Pas de caractères absents d'un clavier français
  (pas de tiret cadratin, pas de guillemets à l'américaine).

**Goûts et décisions de design**
- **Faire simple.** Deux fois, une mécanique ajoutée « en plus » a été retirée : le tonnelier devait
  juste pousser son tonneau (pas de charge), la gargouille juste frapper au contact (pas de bond).
  S'en tenir au texte du roster ; si un comportement plus riche semble mieux, le proposer d'abord.
- **Le look se demande** : pour chaque nouvel ennemi, proposer 2 ou 3 options de look
  (AskUserQuestion, recommandation en premier) avant de modéliser.
- **Pas plus de 3 ennemis sur le même corps de base** (le Moine kelgar en porte déjà 3 : lanceur,
  pèlerin, tonnelier). Habiller un autre modèle si besoin.
- **Buffs entre ennemis : jamais de zone au sol.** Celui qui donne le buff a une étoile qui scintille
  au-dessus de la tête ; ceux qui le reçoivent ont un liseré de lumière subtil sur le corps (jamais
  la texture repeinte en couleur).
- **Les marques au sol sont réservées aux dangers pour le joueur** (impact de bouteille, explosion),
  en rouge, et elles épousent le relief.
- « Avec le cel-shading, tout passe » : le mélange de styles d'assets est accepté.
- Les sons synthétisés ou criards sont détestés : utiliser les échantillons Kenney.
- Il n'y a jamais trop d'ennemis : pas de plafond, la mort par invasion est le but du jeu.
- Licences : projet perso, on ne s'en occupe pas.

## Modèles 3D

Bibliothèque d'assets de l'utilisateur, hors dépôt : `C:\Users\mydnic\Desktop\MODELS`, triée, avec
son inventaire `INVENTAIRE.md` (packs, animations, triangles, styles). L'utilisateur y ajoute des
packs ; demander avant tout téléchargement.

Les GLB des ennemis sont générés par des scripts Blender (ne jamais les éditer à la main) :

```
B="C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
L=C:/Users/mydnic/Desktop/MODELS
# Moines (lanceur, pelerin, tonnelier), source MONK.blend
"$B" -b --factory-startup --disable-autoexec -P tools/blender/monk.py -- --src $L/personnages/kelgar_monk/MONK.blend --variant lanceur --out src/assets/models/moine.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/monk.py -- --src $L/personnages/kelgar_monk/MONK.blend --variant pelerin --barrel $L/decor/quaternius_fantasy_props/glTF/Barrel.gltf --out src/assets/models/moine_pelerin.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/monk.py -- --src $L/personnages/kelgar_monk/MONK.blend --variant tonnelier --barrel $L/decor/quaternius_fantasy_props/glTF/Barrel.gltf --out src/assets/models/moine_tonnelier.glb
# Personnages KayKit (porte_reliques, squelette du Prieur)
"$B" -b --factory-startup --disable-autoexec -P tools/blender/kaykit.py -- --lib $L --variant porte_reliques --out src/assets/models/porte_reliques.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/kaykit.py -- --lib $L --variant squelette --out src/assets/models/squelette.glb
# Personnage statique habillé du squelette UAL (prieur)
"$B" -b --factory-startup --disable-autoexec -P tools/blender/summoner.py -- --lib $L --variant prieur --out src/assets/models/prieur.glb [--render DOSSIER]
# Objets du décor découpés en matériaux nommés (bouteille de la Stout, Canette)
"$B" -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib $L --variant canette --out src/assets/models/canette.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib $L --variant fut --out src/assets/models/fut.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib $L --variant gueuze --out src/assets/models/bouteille_gueuze.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib $L --variant pompe --out src/assets/models/pompe.glb
"$B" -b --factory-startup --disable-autoexec -P tools/blender/props.py -- --lib $L --variant stout --out src/assets/models/bouteille_stout.glb
# Monstres Animated Monsters (gargouille)
"$B" -b --factory-startup --disable-autoexec -P tools/blender/monsters.py -- --lib $L --variant gargouille --out src/assets/models/gargouille.glb
```

Pour contrôler un modèle avant de le brancher : le rendre sous plusieurs poses dans Blender (vues
3/4, profil, marche, attaque), et regarder les images.

Ajouter un ennemi = une fiche dans `src/config/enemies.ts` (`ENEMIES`, et `ROSTERS` pour sa minute
d'arrivée), son modèle dans `src/config/zombies.ts` (`ZOMBIE_MODELS`, avec le fichier ajouté au glob
de `src/enemies/zombieLibrary.ts`), sa brique éventuelle dans `src/enemies/horde.ts` et `game.ts`,
sa vue dans `src/enemies/`, ses tests dans `tests/features/`.

## Pièges déjà rencontrés

- **Mesurer les performances dans le panneau Browser** : s'il est masqué, les images ne tournent presque plus et
  les mesures n'ont aucun sens. L'afficher d'abord (`show_pane preview`). Et un `import('/src/config/...')` depuis
  la console peut renvoyer une autre copie du module que celle du jeu (après un rechargement à chaud) : modifier
  la config ainsi ne change rien, passer par les objets de `window.__game`.
- **Deux lumières qui projettent des ombres** (soleil et lune) : chacune redessine toute la scène. Celle qui est
  éteinte ne recalcule plus ses ombres (`shadow.autoUpdate`, dans `world/sky.ts`).

- **Écran tout noir après un effet** : même cause que le flash noir ci-dessous (un NaN étalé par le bloom), retrouvée
  le 2026-11-10 dans la colonne de lumière (`pow(1.0 - vUv.y, k)` : l'uv interpolé dépasse 1 d'un arrondi). Dans
  tout nouveau shader, borner ce qui entre dans `pow()` avec `clamp(..., 0.0, 1.0)`.
- **Effets additifs qui blanchissent l'écran** : plusieurs explosions au même endroit s'additionnent. Garder les
  `intensity` basses et laisser `VFX.crowd` alléger les recettes quand la réserve de particules se remplit.

- **Flash noir d'une image sur tout l'écran** : un seul pixel NaN dans l'image HDR, que le halo (bloom)
  étale partout. Cause trouvée le 2026-11-10 : `pow(1.0 - abs(dot(...)), k)` dans le liseré de la foule
  (`render/vat.ts`), le dôme des pompes et le ciel ; face pile vers la caméra, |dot| dépasse 1 d'un
  arrondi et pow() d'un négatif vaut NaN (même multiplié par 0). Toujours `pow(max(0.0, ...), k)`.
  Pour traquer : lire le plus petit niveau du bloom (`renderTargetsVertical`) à chaque image et y
  chercher un non-fini, puis cacher des objets (`layers.mask = 0`) par moitiés.
- **`yarn` tout court plante** sur cette machine (il cherche un `.yarn/releases/yarn-1.22.22.cjs`
  absent) : toujours passer par `corepack yarn ...`.
- Un ancien serveur de dev peut rester ouvert sur 5173 après une session : le nouveau part alors sur
  5174, et l'utilisateur risque de regarder le mauvais onglet. Fermer l'ancien.
- **Animations figées à l'export (T-pose en jeu)** alors qu'elles bougent dans les rendus Blender :
  l'import glTF du mannequin UAL pose une piste NLA par animation ; il faut les retirer avant
  d'exporter (`summoner.py`). `tests/features/models.test.ts` ouvre chaque GLB généré et échoue si
  Idle, Walk ou l'attaque ne font bouger aucun os.
- Modèles d'avatars (Polygonal Mind...) : ils ont des **shape keys**, qui figent les sommets ; les
  supprimer avant de les modifier. Les poids automatiques de Blender accrochent les accessoires
  (coiffe, encensoirs) aux mains : sur un modèle fait de blocs, mieux vaut l'os le plus proche.
- Animations des packs : vérifier le geste avant de le brancher (`Dragon_Attack` du pack Animated
  Monsters est une toupie qui fait faire un tour complet au corps). `monsters.py` sait couper un
  clip (`crops`) pour que le coup tombe vers `ZOMBIE_ATTACK.hitAt` (45 % du clip).

- `heightAt(d)` (`src/world/terrain.ts`) attend une **direction unitaire** : lui passer une position
  donne une hauteur fausse (fantômes enterrés, mur de test en l'air). Toujours `p.clone().normalize()`.
- **Le serveur de dev Vite rate parfois des changements** (fichier renommé, script Python qui écrit
  les fichiers) : modules périmés, jeu figé à 0:00, erreurs `does not provide an export`. Le
  redémarrer (preview_stop puis preview_start), puis recharger la page.
- Blender 5 : les actions importées depuis un autre fichier restent liées à leur squelette d'origine.
  Les rattacher par des pistes NLA et exporter en `NLA_TRACKS` (voir `kaykit.py`).
- Les sprites lumineux (étoiles) doivent être sur la couche `LAYER_SKY`, sinon la passe d'occlusion
  ambiante dessine leur carré en sombre.
- La foule exige **un seul maillage et une seule texture par modèle** : les scripts rangent toutes
  les textures (ou couleurs unies) dans un atlas.
- Écrire les scripts Python de modification avec un vrai fichier encodé en UTF-8, pas avec un
  heredoc du terminal (les accents s'y abîment et les remplacements échouent).

Pour piloter le jeu depuis la console du navigateur : `window.__game` (`game`, `rig`, `THREE`,
`setTimeScale`...). Partie : cliquer « Jouer », attendre `game.phase === 'run'` et
`!game.arriving` ; panneau DEV : `input[data-k=auto]` (vagues), `select[data-k=model]` (ennemi),
bouton « Effacer tout » ; `game.spawnZombie(id, direction, facing)`, `game.cheats.god`.

## Fin d'étape

À chaque étape terminée (ou avant d'arrêter une session) :
1. Mettre à jour « Où on en est » et « Prochaine étape » ci-dessus, et le journal du GDD (section 21).
2. `corepack yarn test` et `corepack yarn build` passent.
3. Commit, `git pull`, puis `git push`.
