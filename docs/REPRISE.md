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

**Prochaine étape :**
1. **Feature en cours : les armes, en commençant par la Stout** (choisie le 2026-11-09). Le roster de
   l'Abbaye est complet et validé ; la tension sur 10 min (fin de feature 7) attend d'avoir des armes.
   Checkpoints de la Stout, validés un par un en jeu :
   - a) **l'arme elle-même : faite** (modèle 3D, icônes validés ; à rejouer avec la carte) (DEV : choisir « stout » puis « Donner l'arme »).
     Brique commune `weapons/bottleWeapon.ts` (Canette et Stout = deux réglages de `config/weapons.ts`),
     recul (`knock`) et perçage (`pierce`), bouteille `tools/blender/props.py --variant stout`, icône,
     gerbe `STOUT_SPLASH`, son `STOUT_IMPACT`, cartes `STOUT_UPGRADES`.
   - b) **la carte « nouvelle arme » : faite, à faire valider.** Nouvelle règle de tirage (GDD section 9,
     « Pool de cartes ») : une carte par arme, une seule amélioration par arme, nouvelle arme garantie
     sous 3 armes (`LEVEL_UP_SCREEN.newWeaponBelow`). `game/levelUpCards.ts` (cartes `upgrade` et
     `weapon`), noms et présentations des armes dans `WEAPON_INFO` (`config/weapons.ts`).
   - c) la synergie Black and Tan (Canette + Stout : chaque tir lance aussi une Stout).
   L'évolution (Imperial Stout) attend l'objet « Bière plus forte » (feature objets).
   Fait aussi le 2026-11-09 : la Blonde est devenue la **Canette** (canette de bière en métal,
   `props.py --variant canette`, impact sans verre avec tintement de fer-blanc, identifiant `canette`).
   Icônes refaites : Canette, Stout façon Duvel. La Pils tiède est retirée du roster : l'arme n° 10
   est à inventer avec l'utilisateur.
2. Pistes : discuter avec l'utilisateur de la suite (section 20 du GDD : armes une par une, objets,
   élites, boss...). L'équilibrage de la difficulté est reporté : il faut d'abord les armes.

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
