# Modèles téléchargés de src/assets/models

- `capsule.glb` : « Bottlecap » par Poly by Google (fichier fourni par l'utilisateur, nom d'origine
  `Bottlecap by Poly by Google - 7HsR9BPZpi6.glb`). Les modèles Poly by Google étaient publiés sous
  licence CC-BY : crédit obligatoire. Licence exacte à confirmer sur la page source.

- `poubelle.glb` : « Trashcan » par Poly by Google (fichier fourni par l'utilisateur, nom d'origine
  `Trashcan by Poly by Google - fw6F3liNvHQ.glb`), découpé en couvercle et corps par `tools/blender/props.py`.
  Même licence que la capsule (CC-BY, crédit obligatoire, à confirmer sur la page source).
- `frites.glb` : cornet de frites du Kenney Food Kit (CC0), découpé par `tools/blender/props.py`.

- `mort_repli.glb` : « Grim Reaper v1.0 » par Falibu (fichier fourni par l'utilisateur, nom d'origine
  `Grim Reaper v1.0 by Falibu - 3Ook4jHoAjW.glb`). Licence à confirmer sur la page source (probablement CC-BY,
  crédit obligatoire). Sert de repli si `mort.glb` est retiré.

- `mort.glb` : « Stylized Death » par Gizart (Fab, licence standard), exporté d'Unreal et préparé par
  `tools/blender/mort.py`. Versionné à la demande de l'utilisateur alors que le dépôt est public : à retirer en cas de
  plainte (le jeu bascule alors seul sur `mort_repli.glb`).

Les autres GLB de ce dossier sont générés par les scripts de `tools/blender/` (voir CLAUDE.md).
