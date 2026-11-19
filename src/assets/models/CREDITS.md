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

- `liasse.glb` : « Cash Stack » par J-Toastie (fichier fourni par l'utilisateur, nom d'origine
  `Cash Stack by J-Toastie - aLp0P2nXJ2.glb`, Poly Pizza). Licence à confirmer sur la page source (probablement CC-BY,
  crédit obligatoire). Les liasses de TUNAS au sol (`pickups/tunaDropsView.ts`, recolorées par `TUNA_DROPS.colors`).

- `tabouret.glb` : « Stool » par CMHT Oculus (fichier fourni par l'utilisateur, nom d'origine
  `Stool by CMHT Oculus - dVl5cuOdnMV.glb`, Poly Pizza). Licence à confirmer sur la page source (probablement CC-BY,
  crédit obligatoire). L'arme Tabouret de bar du Videur.
- `pere_noel.glb` : « Surprised Santa » par Matt Connors (fichier fourni par l'utilisateur, nom d'origine
  `Surprised Santa by Matt Connors - 3Q7goR4wcNE.glb`, Poly Pizza / Poly by Google). Licence à confirmer sur la page
  source (probablement CC-BY, crédit obligatoire). Monté sur le squelette du Buveur par `tools/blender/pere_noel.py`.
- `cop.glb` : « Mall Cop » animé (personnage Mixamo, archive `mall-cop-animated.zip` fournie par l'utilisateur, format
  de téléchargement Sketchfab ; source `source/mall_cop_sf.glb`). Auteur et licence à confirmer sur la page source.
  Monté par `tools/blender/cop.py` sur le squelette de la Universal Animation Library de Quaternius (CC0), dont il prend
  les animations (repos, trot, saut, mort, coup de poing).
- `marie.glb` : le Futur Marié, assemblé par `tools/blender/modular.py` à partir du pack « Ultimate Modular Men »
  de Quaternius (CC0) : pièces, squelette et clips du pack, couleurs, ventre et écharpe modifiés.
- `barman.glb` : le Barman robot à tête de télé, modèle fourni par l'utilisateur (fichier
  `6047602-20260925122643977-um84.glb`, sans squelette ; origine et licence à confirmer), monté par `tools/blender/robot.py`
  sur le squelette de la Universal Animation Library de Quaternius (CC0), dont il prend les clips.
- `serveuse.glb` : « Debbie the Roller Waitress » par SAB64 (https://sketchfab.com/shayebouffard5), source
  https://sketchfab.com/3d-models/debbie-the-roller-waitress-b12d84e31b86423fb7b447649ced51c7, licence CC-BY 4.0
  (crédit obligatoire). Modifié : plateau de nourriture et pièces cachées retirés, maillage allégé, monté par
  `tools/blender/serveuse.py` sur le squelette de la Universal Animation Library de Quaternius (CC0), clips ajoutés.
- `pilier.glb` : le Pilier de bar, tiré du modèle « free pack cartoon base mesh » (Sketchfab, fourni par l'utilisateur,
  sculpt nu sans squelette ; auteur et licence à confirmer), retouché, habillé et monté par `tools/blender/pilier.py` sur
  le squelette de la Universal Animation Library de Quaternius (CC0), clips en partie faits main.

- `vehicules/delorean.glb` : « DeLorean DMC-12 » par David Sirera, `vehicules/bus.glb` : « School Bus » par Kyle Li,
  `vehicules/tank.glb` : « Tank » par Quaternius ; fournis par l'utilisateur (fichiers Poly Pizza), non modifiés
  (orientation et taille réglées dans `src/config/vehicles.ts`).

- `gandalf.glb` : « Wizard » (archive Wizard.zip fournie par l'utilisateur, auteur à confirmer), préparé par
  `tools/blender/gandalf.py`.
- `sabre.glb` : « Light saber » par April Lewer (fichier Poly Pizza fourni par l'utilisateur), redressé par
  `tools/blender/sabre.py`.
- `cheveux_ssj.glb` et `cheveux_ssj3.glb` : les coiffures de Goku tirées de « dbxv2_goku_damaged2_ssj.glb » et
  « goku_super_saiyan_3.glb », fournis par l'utilisateur (`tools/blender/cheveux.py` : coiffure seule, recalée sur le
  visage, texture en gris). Icône du Sang Saiyan : `src/assets/icons/sang_saiyan.png`, image « super-saiyan-hair-source »
  du dépôt GitHub lemsizzle/thechessacademy, choisie par l'utilisateur.

Les autres GLB de ce dossier sont générés par les scripts de `tools/blender/` (voir CLAUDE.md).
