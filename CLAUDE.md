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
yarn deploy     # build + wrangler deploy (seulement sur demande)
```

Pas de tests automatisés : vérifier par `yarn build`, puis en jeu dans le navigateur. En dev,
`window.__game` expose les objets principaux (joueur, caméra, ciel, décor, musique...) pour piloter
et inspecter depuis la console ; F3 affiche le debug. Le **panneau DEV** (coin haut droit, `src/dev/devPanel.ts`,
importé seulement en dev donc absent du build) fait apparaître des ennemis, donne de l'XP, godmode,
vitesse du temps, musique de combat... : c'est là qu'on ajoute les outils de test, **jamais de
touches cachées** dans le jeu. En run, Échap met en pause (et libère le curseur pour cliquer dans
le panneau). Les actions du panneau sont notées dans le journal de run (`dev`).

## Règle : toutes les valeurs de jeu dans `src/config/`

Chaque nombre qu'un designer voudrait régler vit dans `src/config/*.ts` (objets `as const`), jamais
en dur dans les systèmes. `world.ts` (planète, physique, caméra), `visual.ts` (rendu, cel-shading,
contours), `lighting.ts` (jour/nuit, brouillard), `decor.ts` (modèles, placement, lumières),
`buveur.ts` (animation, IK des pieds, éclaboussures), `audio.ts` (volumes, sons, musique).

## Architecture (`src/`)

- `main.ts` : assemble tout, boucle avec **physique à pas fixe 120 Hz** et rendu interpolé
  (`player.renderPos`).
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
  `ambience.ts` (vent, oiseaux, chouette synthétisés), `music.ts` (modes exploration et combat,
  morceaux tirés au hasard avec fondu ; `setMode('combat')` à brancher sur les vagues et boss).
- `core/input.ts` : clavier, souris, manette (ignorée quand la fenêtre n'a pas le focus).

## Direction artistique (validée, ne pas re-proposer les styles rejetés)

Décor éclairé façon "Escape from Duckov" : lumière dorée, ombres douces, GTAO, bloom, DOF léger,
étalonnage chaud. **Personnages et objets du décor en cel-shading** (`characterMaterial`, couche
`LAYER_CHARACTER`) avec contours écran ; le sol reste lisse. Rejetés : tout en cel-shading,
BD/aquarelle, Valheim, style anime, herbe dense.

## Modèles maison (Blender)

`tools/blender/buveur.py` (le Buveur, rig et clips) et `tools/blender/abbaye.py` génèrent les GLB
de `src/assets/models/`. Ne pas éditer les GLB à la main : modifier le script et relancer.

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
