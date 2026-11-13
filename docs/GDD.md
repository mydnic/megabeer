# MEGABEER - Game Design Document V1

Document de référence de la V1. Il remplace le proto actuel comme source de vérité : le code sera refait à partir d'ici.

## 0. Cadre et conventions

### Décisions cadres (validées)

- **Solo uniquement.** Pas de coop, pas de réseau, pas de serveur de jeu.
- **Un seul dev.** Le projet est une idée entre potes, mais le développement est fait par une seule personne (avec Claude).
- **V1 = TOUT.** Rien n'est repoussé hors V1. Par contre on développe et on valide **feature par feature** (voir section 20), le jeu doit rester jouable après chaque étape.
- **Web uniquement**, jouable dans un navigateur desktop, clavier/souris et manette.
- **Licences et références** (LOTR, Dragon Ball, etc.) : on garde les noms, on renommera si quelqu'un se manifeste.
- **UI et textes en français.**

### Étiquettes utilisées dans ce document

- **[EXISTE]** : présent dans le proto actuel (sera refait, mais le comportement est acquis).
- **[ISSUE #n]** : décidé dans une issue GitHub.
- **[PROPOSITION]** : proposé dans ce document, à valider ou modifier.
- **[A TRANCHER]** : question ouverte, plusieurs options listées.

Tous les chiffres marqués [PROPOSITION] sont des points de départ d'équilibrage, pas des valeurs testées.

---

## 1. Vision

### Pitch

Un pochtron doit survivre à la nuit dans une abbaye maudite envahie de zombies. Ses armes : de la bière, sous toutes ses formes. Bouteilles lancées, fûts qui roulent, flaques, dessous de verre tranchants. Plus il tue, plus il monte en puissance, jusqu'à devenir une machine de guerre absurde.

### Genre

Survivors-like en 3D (le personnage attaque automatiquement, le joueur gère le déplacement, le positionnement et les choix de build), avec du relief et une mobilité active (saut).

### Piliers

1. **Montée en puissance jubilatoire.** Début fragile, fin de run absurde : des centaines de zombies qui explosent à l'écran.
2. **Humour de comptoir.** Tout l'univers est de la bière, de l'apéro et des références de potes. Rien ne se prend au sérieux.
3. **Builds qui comptent.** Les choix de level-up et de loot créent des synergies réelles, pas juste des +10%.
4. **Une run = une session courte.** On relance tout de suite.

---

## 2. Boucles de jeu

### Boucle de run (minute par minute)

1. Se déplacer, esquiver, se positionner (les armes tirent seules).
2. Tuer des zombies, ramasser l'XP (capsules) et les TUNAS.
3. Monter de niveau : choisir 1 carte parmi 3 (nouvelle arme ou amélioration d'arme).
4. Trouver et ouvrir des fûts de bière sur la carte : choisir 1 objet parmi 3.
5. Ramasser des snacks pour se soigner, des véhicules pour tout écraser.
6. Affronter les boss, survivre jusqu'à la fin de la nuit.

### Boucle méta (entre les runs)

1. Fin de run : bilan (temps, kills, TUNAS gagnés, succès débloqués).
2. Dépenser les TUNAS dans la boutique (débloquer armes, persos, maps, etc.).
3. Relancer une run avec plus d'options.

Objectif d'économie [EXISTE] : environ **100 runs pour tout débloquer**.

---

## 3. Contrôles et caméra

### Contrôles [EXISTE]

| Action | Clavier/souris | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches | Stick gauche |
| Orienter la caméra | Souris (pointer lock) | Stick droit |
| Sauter | Espace | A / Croix |
| Naviguer dans les menus | Souris | Croix directionnelle + A |

[PROPOSITION] Ajouts :
- **Pause** : Echap / Start, avec écran de pause (reprendre, options, abandonner la run).
- **Interaction** (ouvrir un fût, monter dans un véhicule) : automatique au contact, pas de touche dédiée. Plus fluide pour un survivors-like.
- **Remappage des touches** dans les options.

### Caméra [DÉCIDÉ]

Troisième personne, orbitale autour du joueur (souris / stick droit), comme le proto, avec :
- un angle minimum plus plongeant pour la lisibilité de la horde ;
- un zoom réglable à la molette.

Sur la planète, la caméra est calculée dans le repère local du joueur (le "haut" est la direction opposée au centre de la planète), pour ne jamais se dérégler quel que soit l'endroit du globe.

### Touche de transformation [DÉCIDÉ]

Une touche dédiée déclenche la transformation Super Saiyan (section 10). Touche exacte à définir (proposition : E / bouton Y).

---

## 4. Le joueur

### Statistiques [DÉCIDÉ, liste définitive : 16 stats]

Toutes les stats ont une valeur de base fixée par le personnage, puis sont modifiées par les armes, les objets passifs, le skill tree et les bonus temporaires (Saiyan, etc.). Rien d'autre ne peut être modifié : toute arme ou tout objet s'exprime avec ces stats.

| Stat | Effet |
|---|---|
| PV max | Points de vie |
| Régénération | PV rendus par seconde |
| Vol de vie | % des dégâts infligés rendus en PV. 0 de base pour tous les persos |
| Armure | Réduit chaque coup reçu d'une valeur fixe (efficace contre la masse, faible contre les boss) |
| Esquive | % de chance d'annuler un coup |
| Vitesse | Vitesse de déplacement |
| Dégâts | Multiplicateur global de dégâts |
| Vitesse d'attaque | Multiplicateur global de la cadence des armes |
| Critique | % de chance de coup critique |
| Dégâts critiques | Multiplicateur du coup critique (x2 de base) |
| Nombre de projectiles | Projectiles en plus pour les armes à projectiles |
| Taille | Taille des zones, explosions et projectiles |
| Durée | Durée des effets (flaques, orbites, nuages...) |
| Ramassage | Rayon d'aimant (XP, Pièces, TUNAS, snacks) |
| Gain d'XP | Multiplicateur d'XP ramassée (affichée "Descente" dans le jeu) |
| LUCK | Chance de tirer des raretés élevées |

Retirés volontairement :
- **Vitesse des projectiles** (stat globale du proto) : devient un réglage propre à chaque arme.
- Pas de stat de saut ni de chance de fût : ça passe par des objets ou le skill tree.

[PROPOSITION] **Plafond du vol de vie** : avec des hordes de 500 ennemis, un vol de vie sans limite rend immortel. Le soin venant du vol de vie est plafonné à 5% des PV max par seconde (valeur en config).

### Saut [EXISTE]

- Gravité et saut physiques, le joueur suit le relief du terrain.
- [DÉCIDÉ le 2026-11-07] **Sauter ne protège pas** : un coup qui arrive en l'air fait ses dégâts (sinon on sauterait tout le temps). L'esquive par le saut du proto est abandonnée.
- Après un coup reçu : 0,5 s d'invulnérabilité.

[PROPOSITION] Garder le saut comme esquive mais le rendre plus lisible (ombre au sol, petit effet de poussière). Ajouter des objets qui jouent avec : double saut, onde de choc à l'atterrissage.

### Mort

PV à 0 : fin de run (défaite), bilan, TUNAS gagnés conservés [EXISTE].

[PROPOSITION] Objet rare "Seconde tournée" : revivre une fois avec 50% PV.

---

## 5. Personnages

### Règles [DÉCIDÉ]

- Chaque perso a des stats de base, **un passif unique** et **une arme de départ**.
- L'arme de départ n'est **pas exclusive** : débloquer le perso ajoute son arme au pool commun, et les autres persos peuvent la tirer au level-up. Change le proto, où l'arme de départ était exclusive.
- Toutes les armes de départ font partie du roster de la section 6. Pas d'arme hors roster.
- Les écarts de stats sont exprimés par rapport au Buveur. Les chiffres vivent dans la config et se calent en test.

### Roster V1 [DÉCIDÉ] : 9 persos

| Perso | Arme de départ | Passif | Stats | Déblocage |
|---|---|---|---|---|
| Le Buveur | Canette | +1% dégâts par niveau de joueur | Équilibré (référence) | Dès le départ |
| Père Noël | Bière de Noël | Un petit fût apparaît près de lui toutes les 2 min | +PV, -vitesse | TUNAS |
| Le Crado | Flaque de vomi | Le poison s'empile 2 fois plus vite | -PV, +vitesse, +ramassage | TUNAS |
| Le Barman | Tireuse | Le level-up propose 4 cartes au lieu de 3 | -dégâts | TUNAS |
| Le Moine brasseur | Triple | +1 PV/s de régénération, soins des snacks doublés | +PV, -dégâts | Succès : finir une run sur la map Abbaye |
| Le Supporter | Corne de brume | +2% dégâts par ennemi proche, plafonné à +30% | +vitesse, -armure | TUNAS |
| La Serveuse | Plateau de serveur | +10% esquive de base, chaque esquive donne un sprint court | -PV, +vitesse d'attaque | TUNAS |
| Le Videur | Tabouret de bar | +3 armure de base, insensible au recul | ++PV, --vitesse | Succès : tuer un boss |
| Le Cop | Rot sonique | **Contrôle d'alcoolémie** : un ennemi qui le touche est étourdi 0,5 s (au plus une fois toutes les 3 s par ennemi) | +++PV, --vitesse | TUNAS |

**Le Cop** : un flic avec un gros cul et un pantalon trop court, on voit sa raie, il se déplace lentement.

**Videur vs Cop** (deux persos lents et costauds) :
- **Videur = armure.** Il encaisse en réduisant chaque coup et ne recule jamais : il tient sa position dans la mêlée.
- **Cop = PV.** Énorme réserve de PV mais pas d'armure. Il est mou et étourdit ce qui le touche.

**A surveiller en test** : le Barman (4 cartes) et le Videur (insensible au recul) risquent d'être plus forts que les autres.

### Persos du proto (historique)

| Perso | PV | Vitesse | Dégâts | Ramassage | Arme de départ |
|---|---|---|---|---|---|
| Le Buveur | 100 | 9 | 10 | 5 | Lancer de bière (type aléatoire) |
| Père Noël | 115 | 8 | 10 | 5 | Bière Stout |
| Le Crado | 85 | 9,6 | 9 | 6 | Flaque de vomi |

---

## 6. Armes

### Règles générales

- Les armes **tirent automatiquement** [EXISTE]. **Visée façon survivors** [DÉCIDÉ le 2026-11-09] : pas toujours le plus proche (en fin de partie, tous les tirs partiraient sur le même ennemi, mort avant que les suivants arrivent). Chaque projectile en vol réserve ses dégâts sur sa cible ; un ennemi qui a déjà assez de dégâts en route pour mourir n'est plus visé tant qu'il reste d'autres cibles ; parmi les 3 plus proches encore vivants, le tir en choisit un au hasard (`weapons/targeting.ts`, `TARGETING`).
- **4 armes maximum** équipées en même temps [ISSUE #11].
- Les armes s'obtiennent **uniquement par les cartes de level-up**, jamais par le loot au sol [ISSUE #11] [ISSUE #3].
- Une arme doit d'abord être **débloquée en boutique TUNAS** pour pouvoir apparaître en carte de level-up [EXISTE].
- L'arme de départ du perso compte dans les 4.
- Une fois 4 armes équipées : plus de cartes "nouvelle arme", uniquement des améliorations d'armes équipées et des objets passifs. Pas de mécanique de remplacement [ISSUE #11].

### Améliorations d'armes [ISSUE #11]

- Une amélioration booste **uniquement l'arme choisie** (pas une stat globale).
- Chaque arme a ses propres multiplicateurs : dégâts, cadence, nombre de projectiles, perçage, taille, durée, etc.
- Les cartes d'amélioration ont une **rareté** (section 8) : même arme, boost plus fort au tier supérieur.
- Dégâts finaux d'un coup = dégâts de base de l'arme x multiplicateur propre à l'arme x stat Dégâts globale du joueur x autres bonus.

[DÉCIDÉ] **Niveaux infinis.** Une arme n'a pas de niveau max : chaque carte d'amélioration ajoute un niveau, à l'infini. Le niveau est affiché sur l'icône de l'arme.
- Chaque carte booste une caractéristique de l'arme (dégâts, vitesse d'attaque, projectiles, taille, durée, perçage...), avec une ampleur fixée par sa rareté.
- **Seuil d'évolution : niveau 8.** Arme au niveau 8 ou plus + objet d'évolution possédé = une carte spéciale "Évolution" apparaît. L'arme évoluée continue ensuite de monter à l'infini.
- Comme les armes montent sans fin, le level-up a toujours quelque chose à proposer : plus besoin de carte de secours.
- [A TRANCHER à l'équilibrage] Boosts constants ou décroissants avec le niveau. Le Last call (mode infini) doit faire monter les ennemis au même rythme, sinon il devient trivial.

### Évolutions [DÉCIDÉ]

Chaque arme a **une évolution** : arme au niveau 8 ou plus + un objet passif précis possédé = l'arme se transforme en version évoluée (plus puissante, comportement enrichi). Le couple arme / objet de chaque évolution est défini dans la revue du contenu.

### Synergies entre armes [DÉCIDÉ]

Avoir **l'arme X et l'arme Y équipées en même temps**, quel que soit leur niveau, débloque un bonus de synergie (liste plus bas). [DÉCIDÉ le 2026-11-09] **La synergie se voit dans l'interface** : la carte « Nouvelle arme » qui en compléterait une porte un badge « Synergie : nom » avec son effet ; quand elle s'active, un bandeau « Synergie : nom ! » s'affiche ; dans le HUD, les emplacements des armes liées ont un liseré de la couleur de la synergie et un petit maillon ; dans le menu pause, une pastille sur la carte de chaque arme liée et une carte par synergie active (armes reliées, effet détaillé). Une synergie ajoute un effet sans rien remplacer, alors qu'une évolution (arme + objet) transforme l'arme. Avec 4 emplacements maximum, les synergies rendent le choix des armes stratégique.

### Roster V1 [DÉCIDÉ]

24 armes. Les chiffres (dégâts, cooldown, portée...) sont calés en test et vivent dans la config. La colonne "Brique" indique le comportement générique réutilisé.

Les armes de départ des persos font partie du roster (déblocage pour les autres persos à confirmer dans la revue des persos).

| # | Arme | Brique | Rôle | Évolution (+ objet requis) |
|---|---|---|---|---|
| 1 | Canette | Projectile simple | Base polyvalente : canette de bière en métal (ex-Blonde, renommée le 2026-11-09) | **Tournée générale** : canettes dans toutes les directions (+ Tournée rapide) |
| 2 | Stout | Projectile lourd + recul | Gros dégâts, repousse | **Imperial Stout** : onde de choc à l'impact (+ Bière plus forte) |
| 3 | Flaque de vomi | Lancer en cloche + zone + poison cumulable | Dégâts, vise le plus gros groupe | **Gastro** : les flaques se propagent d'elles-mêmes (+ Kebab de 4h) |
| 4 | Kriek | Projectile + éclaboussure | Zone à l'impact, ralentit | **Kriek Cerise Bombe** : grosses explosions collantes (+ Pinte XXL) |
| 5 | Triple | Projectile qui rebondit | Chaîne sur 3 ennemis | **Quadruple** : 8 rebonds, +dégâts à chaque rebond (+ Cul sec) |
| 6 | IPA | Projectile + brûlure | Dégâts sur la durée | **Double IPA** : la brûlure se propage aux voisins (+ Briquet) |
| 7 | Weizen | Nuage persistant | Zone en l'air | **Mousse infinie** : le nuage suit le joueur (+ Bière sans alcool) |
| 8 | Gueuze | Grenade à retardement | Explosion en zone sur la cible | **Gueuze Lambic** : explosions en chaîne (+ Ventre à bière) |
| 9 | Bière de Noël | Orbite | Défense rapprochée | **Couronne de Noël** : orbite double, sens inverse (+ Bonnet du Père Noël) |
| 10 | *À inventer* | | | La Pils tiède a été retirée le 2026-11-09 (« on va en inventer une autre mieux ») ; son évolution passera par le Trèfle de comptoir |
| 11 | Dessous de verre | Projectile perçant | Traverse les lignes | **Sous-bock tranchant** : revient vers le joueur (+ Aimant à capsules) |
| 12 | Fût qui roule | Projectile roulant perçant | Écrase en ligne | **Rouleau compresseur** : fût géant, rebondit sur le décor (+ Godasses de bar) |
| 13 | Flaque de bière | Traînée au sol derrière le joueur + glissade | Contrôle : les ennemis glissent et tombent | **Inondation** : traînée large, les ennemis tombés restent étourdis plus longtemps (+ Seau à glace) |
| 14 | Décapsuleur | Boomerang | Aller-retour, 2 coups | **Ouvre-tout** : 3 boomerangs en éventail (+ Deux mains) |
| 15 | Tireuse | Cône continu | Mêlée à moyenne portée | **Tireuse pression max** : jet long qui repousse (+ Pression du fût) |
| 16 | Plateau de serveur | Orbite bloquante | Bloque les coups | **Service en salle** : les blocages renvoient les dégâts (+ Gueule de bois) |
| 17 | Bouchons de champagne | Éventail de projectiles | Rafale large | **Magnum** : rafale à 360 degrés (+ Ticket de tournée) |
| 18 | Tabouret de bar | Mêlée circulaire | Nettoie autour du joueur | **Bagarre générale** : coup tournant permanent (+ Gants de videur) |
| 19 | Fléchettes | Projectile ciblé + critique | Vise l'ennemi le plus fort | **Triple 20** : 3 fléchettes, critiques garantis sur les élites (+ Lunettes de comptoir) |
| 20 | Corne de brume | Cône directionnel, gros recul, dégâts faibles | Utilitaire : ouvre un couloir dans la horde | **Hymne du stade** : onde à 360 degrés qui étourdit (+ Écharpe de supporter) |
| 21 | Boules de pétanque | Lancer en cloche + roulé | Rebondit au sol | **Le Carreau** : chaque boule éjecte l'ennemi touché dans les autres (+ Cochonnet) |
| 22 | Rot sonique | Onde circulaire qui se charge | Burst de dégâts autour du joueur | **Rot du siècle** : onde énorme qui étourdit (+ Sachet de cacahuètes) |
| 23 | Bac de bière | Lancer + fragmentation | Le bac éclate à l'impact en bouteilles qui partent dans toutes les directions | **Palette de bières** : les bouteilles éclatent à leur tour en éclats de verre (+ Cendrier) |
| 24 | Odeur d'alcool | Aura fixe permanente autour du joueur | Dégâts continus faibles, uniquement aux ennemis proches, les rend confus (ils titubent) | **Haleine de fin de soirée** : aura plus large, les ennemis confus se frappent entre eux (+ Démarche de pochtron) |

### Distinction des armes proches [DÉCIDÉ]

**Flaque de vomi vs Flaque de bière**
- **Vomi = dégâts.** Lancée en cloche sur le plus gros groupe d'ennemis. Poison **cumulable** : un ennemi qui reste dedans prend de plus en plus de dégâts.
- **Bière = contrôle.** Pas lancée : le joueur laisse une **traînée** derrière lui en se déplaçant. Les ennemis qui marchent dessus **glissent, tombent et restent étourdis** un instant. Dégâts faibles.
- Jeu différent : le vomi se vise tout seul, la bière se joue en dessinant des chemins (tourner autour de la horde).

**Corne de brume vs Rot sonique**
- **Corne = utilitaire.** Cône dans la direction de déplacement du joueur, **gros recul, presque pas de dégâts**. Sert à ouvrir un couloir pour s'échapper.
- **Rot = burst de dégâts.** Onde circulaire autour du joueur, **qui se charge** : plus le joueur ramasse d'XP depuis le dernier rot, plus le prochain est puissant. Recul faible.
- Jeu différent : la corne se joue en fuite, le rot récompense de foncer dans les capsules.

**Odeur d'alcool vs Tabouret de bar vs Rot sonique** (les trois frappent autour du joueur)
- **Odeur = aura permanente.** Toujours active, dégâts faibles mais continus, aucun recul, rend les ennemis confus. Pousse à rester au contact de la horde.
- **Tabouret = coup périodique.** Gros coup circulaire à intervalle régulier, avec recul. Nettoie puis laisse respirer.
- **Rot = burst chargé.** Rare mais énorme, dépend de l'XP ramassée.

### Liste des synergies V1 [DÉCIDÉ]

| Combo | Effet |
|---|---|
| Fût qui roule + Flaque de bière | Le fût accélère et va plus loin sur la traînée de bière |
| IPA + Flaque de bière ou de vomi | Les flaques prennent feu |
| Kriek + Triple | Chaque rebond éclabousse |
| Bouchons de champagne + Gueuze | Les bouchons explosent à l'impact |
| Tireuse + IPA | Jet brûlant |
| Plateau + Tabouret | Chaque coup bloqué déclenche un coup de tabouret |
| Dessous de verre + Décapsuleur | Tous les projectiles reviennent vers le joueur |
| Bière de Noël + n° 10 (à inventer) | À redéfinir avec la nouvelle arme (l'ancienne : l'orbite fait pleuvoir des bouteilles) |
| Vomi + Weizen | Nuage toxique (le poison cumulable s'applique en l'air) |
| Fléchettes + Triple | Les fléchettes rebondissent |
| Canette + Stout | "Black and Tan" (combo, décidé le 2026-11-09) : un zombie touché par une Stout est sonné 2 s (bulles de mousse qui tournent au-dessus de sa tête, il continue d'avancer) ; pendant ce temps, les canettes lui font double dégâts (chiffre affiché en gros). L'ancienne version (chaque tir lance aussi une Stout) est écartée : simple bonus de dégâts, invisible |
| Pétanque + Fût qui roule | Les boules suivent le fût et ricochent dessus |
| Corne de brume + Rot sonique | Le rot sort par la corne : onde en cône à très longue portée, avec les dégâts du rot |
| Odeur d'alcool + IPA | L'alcool est inflammable : l'aura brûle les ennemis |
| Bac de bière + Triple | Les bouteilles du bac rebondissent d'ennemi en ennemi |

### Armes du proto (historique, remplacées par le roster V1)

| Arme | Comportement | Cooldown | Portée | Dégâts (x stat Dégâts) | Particularités | Obtention |
|---|---|---|---|---|---|---|
| Lancer de bière | Bouteille lancée vers l'ennemi le plus proche | 1,0 s | 16 | x1,0 | Perce 1. Type de bière aléatoire par tir (Blonde x1,0, Kriek x1,15, Brune x1,3, Triple x1,6), les types forts se débloquent toutes les 40 s | Départ Buveur |
| Bière Stout | Bouteille lente et lourde | 1,3 s | 16 | x1,8 | Perce 1, vitesse x0,85 | Départ Père Noël |
| Flaque de vomi | Zone au sol sous l'ennemi ciblé | 4,0 s | illimitée | x0,5 par tick | Rayon 3, dure 3,5 s, tick 0,4 s | Départ Crado |
| Dessous de verre | Shuriken tournoyant | 1,6 s | 16 | x0,65 | Perce 3, vitesse x1,3 | Boutique 120 TUNAS |
| Fût qui roule | Fût roulant en ligne droite | 3,5 s | illimitée | x1,8 | Perce tout, lent, dure 2,6 s | Boutique 50 TUNAS |
| Flaque de bière | Zone au sol sous l'ennemi ciblé | 4,0 s | illimitée | x0,5 par tick | Rayon 3,2, dure 3 s, tick 0,4 s | Boutique 80 TUNAS |

---

## 7. Objets passifs

### Règles [DÉCIDÉ]

- Les objets passifs s'obtiennent **uniquement par les fûts** (et les récompenses de boss). Les cartes de level-up ne proposent que des armes. Change le proto et l'issue #11.
- [DÉCIDÉ 2026-11-12, remplace l'ancienne règle] Chaque objet a **une seule rareté et un effet fixe**, jamais plusieurs niveaux. Un coffre propose 3 objets différents **de sa rareté**. Il faut donc une dizaine d'objets par rareté. La rareté et la valeur de chaque objet sont dans `src/config/items.ts` (les valeurs des tableaux ci-dessous sont celles d'avant, en Commun : un objet classé plus haut a reçu à peu près sa valeur Commun x1,5 en Peu commun, x2 en Rare, x3 en Dingue, x4 en Légendaire, sauf effets réglés à la main).
- Cette règle ne vaut que pour les objets : les cartes d'amélioration d'arme et de pompe gardent leur rareté tirée, qui multiplie leur valeur.
- Les objets se cumulent : prendre deux fois le même objet empile l'effet. **Pas de limite** au nombre d'objets.
- **Petites valeurs qu'on empile** : un objet Commun pèse peu (par exemple +8% dégâts), c'est l'accumulation qui fait la puissance. A l'inverse du proto, où un seul objet donnait +30%. Toutes les valeurs vivent dans la config et s'ajustent en test.
- Chaque effet s'exprime avec les 16 stats (section 4) ou avec un couple déclencheur + effet.

### Objets d'évolution : utiles même sans l'arme [DÉCIDÉ]

Un objet d'évolution a **son propre effet passif**, qui marche que l'on possède l'arme ou non. Le lien avec l'arme est un bonus : si l'arme liée est au niveau 8 ou plus, posséder l'objet fait apparaître la carte "Évolution".

Exemple : le Seau à glace ralentit de 10% les ennemis touchés, quelle que soit l'arme qui les touche. Sans la Flaque de bière, c'est juste un objet de contrôle. Avec elle, il ouvre en plus l'évolution Inondation.

Conséquence : trouver un objet d'évolution n'est jamais une carte morte, et il peut orienter le choix des armes au level-up suivant.

### Liste V1 [DÉCIDÉ] : 48 objets

#### Objets d'évolution (24)

| Objet | Effet (Commun) | Fait évoluer |
|---|---|---|
| Tournée rapide | +8% vitesse d'attaque | Canette |
| Bière plus forte | +8% dégâts | Stout |
| Kebab de 4h | +10% durée | Flaque de vomi |
| Pinte XXL | +10% taille | Kriek |
| Cul sec | +4% critique | Triple |
| Briquet | +15% dégâts critiques | IPA |
| Bière sans alcool | +0,5 PV/s régénération | Weizen |
| Ventre à bière | +15 PV max | Gueuze |
| Bonnet du Père Noël | Toutes les 90 s, un petit fût apparaît près du joueur | Bière de Noël |
| Trèfle de comptoir | +5 LUCK | n° 10 (à inventer) |
| Aimant à capsules | +20% ramassage | Dessous de verre |
| Godasses de bar | +6% vitesse | Fût qui roule |
| Seau à glace | Les ennemis touchés sont ralentis de 10% | Flaque de bière |
| Deux mains | +1 projectile (fixe, Rare minimum) | Décapsuleur |
| Pression du fût | Les coups repoussent un peu plus | Tireuse |
| Gueule de bois | +1 armure | Plateau de serveur |
| Ticket de tournée | +10% gain d'XP | Bouchons de champagne |
| Gants de videur | +15% dégâts aux ennemis très proches | Tabouret de bar |
| Lunettes de comptoir | +15% dégâts aux élites et boss | Fléchettes |
| Écharpe de supporter | +vitesse et +armure quand 15 ennemis ou plus entourent le joueur | Corne de brume |
| Cochonnet | 10% de chance qu'un tir lance un projectile en plus | Boules de pétanque |
| Sachet de cacahuètes | Chaque capsule d'XP ramassée soigne 0,2 PV | Rot sonique |
| Cendrier | Les ennemis tués ont 5% de chance d'exploser | Bac de bière |
| Démarche de pochtron | +4% esquive (le joueur titube, les ennemis ratent) | Odeur d'alcool |

#### Autres objets (24)

| Objet | Effet (Commun) | Notes |
|---|---|---|
| Ressort de canapé | Double saut | Fixe, Rare |
| Seconde tournée | Revivre une fois avec 50% PV | Fixe, Légendaire |
| Trilogie LOTR | +250% / +350% durée des zones | Fixe, Rare (Theatrical Cut) / Légendaire (Extended Edition), issue #5 |
| Sang Saiyan | Active la jauge de colère (section 10) | Fixe, Légendaire uniquement, un seul exemplaire par run |
| Tirelire | +10% TUNAS ramassés pendant la run | Intégrée dans la formule d'économie (section 14) |
| Carte de fidélité | Fûts 8% moins chers | |
| Happy hour | Toutes les 60 s : vitesse d'attaque x2 pendant 8 s | |
| Glaçons | 3% de chance de geler un ennemi 1 s | |
| Last order | +20% dégâts sous 30% PV | |
| Ardoise du bar | Les dégâts reçus sont étalés sur 3 s | Lisse les gros coups |
| Pourboire | Chaque kill a 1% de chance de lâcher un snack | |
| Mousse épaisse | Un bouclier absorbe 1 coup toutes les 20 s | |
| Juke-box | Toutes les 10 s, une onde de musique blesse et repousse les ennemis proches | Changé le 2026-11-10 : l'onde au level-up partait pendant le choix des cartes, invisible |
| Bière renversée | Prendre un coup crée une flaque de bière sous le joueur | Synergie naturelle avec la Flaque de bière |
| Bretelles | +10 PV max et +3% vitesse | |
| Plateau de fromages | +25% de soin des snacks | |
| Casquette à bière | +2 PV/s quand le joueur ne bouge pas | Risque / récompense |
| Tongs | +10% vitesse, saut moins haut | Double tranchant |
| Sifflet d'arbitre | Toutes les 15 s, étourdit les ennemis proches 1 s | |
| Paille | +1,5% vol de vie | |
| Pique-assiette | +1% vol de vie et +4% dégâts | |
| Porte-monnaie | +10% Pièces | |
| Tabouret réservé | Les pompes à bière se remplissent 20% plus vite | |
| Bon de réduction | 5% de chance qu'un fût soit gratuit | |

### Objets du proto (historique, remplacés par la liste V1)

| Objet | Effet dans le proto | Devenir |
|---|---|---|
| Bière plus forte | +30% dégâts | Gardé, +8% en Commun |
| Tournée rapide | +20% cadence | Gardé, +8% vitesse d'attaque en Commun |
| Godasses de bar | +15% vitesse de déplacement | Gardé, +6% en Commun |
| Deux mains | +1 projectile par tir | Gardé, fixe Rare minimum |
| Bonne descente | +25 PV max et soin complet | Remplacé par Ventre à bière et Bretelles |
| Aimant à capsules | +50% portée de ramassage | Gardé, +20% en Commun |
| Bras de catapulte | +25% vitesse des projectiles | Retiré (la vitesse des projectiles est propre à chaque arme) |

---

## 8. Rareté et LUCK [ISSUE #4]

### Les 5 tiers

| Tier | Nom affiché | Couleur |
|---|---|---|
| 1 | Commun | Blanc |
| 2 | Peu commun | Vert |
| 3 | Rare | Bleu |
| 4 | Dingue (Epic) | Violet |
| 5 | Légendaire | Doré |

### S'applique à

- Objets des fûts.
- Cartes de level-up : objets passifs, améliorations d'armes et déblocages d'armes.
- Potentiellement aux fûts eux-mêmes et aux véhicules (durée, modèle).

### Principe

Même objet, effet plus fort au tier supérieur. Certains objets n'existent qu'à partir d'un tier minimum (exemple : Trilogie LOTR, Rare et Légendaire seulement).

[PROPOSITION] Multiplicateur d'effet par tier (appliqué à la valeur de base de l'objet) : Commun x1, Peu commun x1,5, Rare x2, Dingue x3, Légendaire x4. Les objets spéciaux définissent leurs valeurs à la main (comme LOTR).

[PROPOSITION] Probabilités de base (LUCK = 0) : Commun 60%, Peu commun 25%, Rare 10%, Dingue 4%, Légendaire 1%. Chaque point de LUCK déplace du poids des tiers bas vers les tiers hauts (formule exacte à définir à l'implémentation, avec un plafond).

---

## 9. XP et level-up

### Présentation : le degré d'alcool [DÉCIDÉ]

Mécaniquement c'est de l'XP classique, mais tout est présenté comme de l'alcool :
- Les zombies lâchent des **gouttes de bière** (les points d'XP) : rondes, dorées, elles flottent en lévitation au-dessus du sol [DÉCIDÉ le 2026-11-07, remplacent les capsules du proto ; « capsule » reste le nom dans les anciens passages de ce document].
- La barre d'XP s'appelle **Alcoolémie** : elle se remplit avec les gouttes.
- Le niveau s'appelle le **degré** : barre pleine = un degré de plus (affiché "56°"). Le joueur dit "je suis arrivé au 56e degré".
- La stat "Gain d'XP" s'affiche **Descente** dans le jeu ("avoir une bonne descente"). Dans le code et ce document, on garde les termes XP et niveau.

### Existant [EXISTE]

- Les zombies lâchent des orbes d'XP (capsules) à leur mort, attirés par l'aimant (portée de ramassage).
- XP du niveau suivant : 10 au départ, puis x1,25 + 5 à chaque niveau.
- Level-up : le jeu se met en pause, 3 cartes au choix.
- Plusieurs level-ups d'un coup : les écrans s'enchaînent, aucun n'est perdu (bug #1 corrigé, à conserver).

### Pool de cartes [DÉCIDÉ]

Les cartes de level-up ne proposent **que des armes** [DÉCIDÉ le 2026-11-09, comme dans les jeux du genre] :
- **Une carte par arme, jamais deux pour la même** : une arme équipée ne propose qu'une seule amélioration (tirée au hasard, avec sa rareté).
- **Moins de 3 armes équipées** : une des cartes est toujours une **nouvelle arme**, tirée au hasard parmi les armes débloquées pas encore équipées. Remplir l'arsenal vite est voulu.
- **3 armes** : une nouvelle arme peut encore sortir (une place libre), sans être garantie. **4 armes** : uniquement des améliorations.
- Moins de choix possibles que de cartes = moins de cartes (avec 1 arme équipée et 1 seule autre arme débloquée : 2 cartes).
- La carte « Nouvelle arme » a son propre cadre (orange) et présente l'arme ; les améliorations ont une rareté (section 8).
- Tant que la boutique TUNAS n'existe pas, toutes les armes du jeu comptent comme débloquées.

### Relancer / Bannir / Passer [DÉCIDÉ]

Sous les 3 cartes, trois boutons :
- **Relancer** : tirer 3 nouvelles cartes.
- **Bannir** : retirer une carte du tirage pour le reste de la run.
- **Passer** : ne rien prendre, **sans aucune compensation** [DÉCIDÉ]. C'est une option de fin de partie pour les builds ciblés : garder une seule arme (ou peu d'armes) quand on ne peut plus relancer.

**Non disponibles au départ** : chaque option se débloque avec des TUNAS en boutique, et le nombre d'utilisations par run s'améliore aussi en boutique ou dans le skill tree (section 14).

---

## 10. Objets de terrain et systèmes spéciaux

### Fûts de bière (remplacent les coffres) [ISSUE #3]

- Apparaissent **aléatoirement sur la carte**.
- [DÉCIDÉ] **Payants en Pièces** (monnaie de run, voir plus bas). Le prix augmente à chaque fût ouvert pendant la run.
- Ouverture : le joueur paie, la **couleur de la mousse** révèle la rareté (VFX), pause, **choix de 1 objet passif parmi 3 de cette rareté**.
- Rare : **fût piégé**, qui explose et libère des zombies au lieu de donner des objets.
- Contenu : **uniquement objets passifs** (les armes restent réservées aux level-ups).
- Le tirage des 3 objets est pondéré par la rareté et la LUCK.

Les boss lâchent un fût **gratuit** de rareté élevée.

[DÉCIDÉ, remplace "fûts gratuits"] Les fûts sont payants : sans coût, rien ne pousse à explorer la map pour gagner des Pièces. Le prix des fûts et le gain de Pièces sont le réglage central de l'équilibrage des objets.

### Pièces : la monnaie de run [DÉCIDÉ]

- Monnaie **perdue à la fin de la run** (les TUNAS restent la monnaie permanente).
- Sources : kills (petite chance, **à la place** de la goutte d'XP : décision de l'utilisateur le 2026-11-10), poubelles, machine à sous, certains bonus.
- Présentées comme des **capsules de bière** (choix de l'utilisateur) : modèle « Bottlecap » de Poly by Google fourni par l'utilisateur (crédit dans src/assets/models/CREDITS.md), toute rouge (pas de jaune : demande de l'utilisateur), rayon 0,2 m (un peu plus petite, demande de l'utilisateur), penchée et qui tourne (la première version toute dorée se confondait avec l'XP, retour de l'utilisateur). Compteur à côté des kills, icône de capsule de trois quarts.
- Dépenses : fûts, machine à sous du PMU.
- Attirées par le Ramassage comme les capsules.

### Exploration de la map [DÉCIDÉ]

Survivre en tournant autour de la horde ne suffit pas : la planète est remplie de choses à trouver et à activer.

| Élément | Effet | Disponible |
|---|---|---|
| **Fût** | Payé en Pièces, prix croissant. Choix de 1 objet parmi 3 de la rareté révélée. Rare : fût piégé | Dès le départ |
| **Pompe à bière** | Rester à côté remplit la pinte (elle redescend si on s'éloigne). Pleine : choix de **1 bonus de stat direct parmi 3** (pas un objet). Versions bronze, argent, or | Dès le départ |
| **Poubelle** | Se casse d'un coup : XP, Pièces ou, rarement, un snack | Dès le départ |
| **Porte du patron** | Cachée sur la planète. L'activer lance le boss final (voir section 12) | Dès le départ |
| **Livraison du brasseur** | De temps en temps, un fût gratuit tombe du ciel quelque part sur la planète. Il faut aller le chercher | Skill tree |
| **Table de bras de fer** | L'activer invoque un **élite nommé** (section 11), un mini-boss optionnel. Vaincu : fût gratuit de haute rareté, Pièces, et succès | Skill tree |
| **Cloche du bar** (« Dernier service ») | 4 grandes cloches sur la planète, sonnées à la touche d'action (une fois chacune) : toute l'XP et toutes les capsules de la planète arrivent (pas les snacks). Les ennemis lâchent aussi, rarement, une clochette qui fait la même chose (la Chance augmente le drop) | Dès le départ (décision de l'utilisateur le 2026-11-11) |
| **Shot du diable** | Donne un objet Dingue, en échange d'une malédiction pour la run (par exemple +5% d'ennemis) | Skill tree |
| **Machine à sous du PMU** | Dépenser des Pièces pour une récompense aléatoire | Skill tree |
| **Sosie bourré** | PNJ rare qui copie un des objets du joueur | Skill tree |

**Visibilité sur une planète** : ce qui est derrière l'horizon est caché. Deux outils :
- un **faisceau de lumière** au-dessus des fûts, pompes, livraisons et de la porte du patron, visible de loin ;
- une **mini-carte** (disque en bas à droite) : sans brouillard, toute la planète est connue (décision de l'utilisateur le 2026-11-10).

Inspirations : Megabonk (coffres payants, piliers, vases, statue aimant, autel du boss, mini-boss) et PokéBonk (autels à charger, autel maudit, copie d'objet, machine à sous, ravitaillement, faisceaux, carte à brouillard). Aucune reprise telle quelle.

### Apéro / snacks de soin [ISSUE #6]

- Pickups instantanés au sol, soignent au contact.
- Lâchés aléatoirement par les ennemis tués (chance configurable, même principe que les TUNAS).
- Attirés par l'aimant de ramassage.

| Snack | Soin proposé [PROPOSITION] |
|---|---|
| Chips | 10 PV |
| Fromage d'abbaye | 20 PV |
| Croque-monsieur | 35 PV |
| Plateau apéro | 100% PV (très rare) |

Assets disponibles : pack food Quaternius déjà dans le repo, Kenney Food Kit cité dans l'issue.

### Véhicule écrase-zombies [ISSUE #8]

- Objet rare trouvé **sur le terrain** (pas dans les fûts).
- Marcher dessus = monter dedans.
- Pendant la conduite : **plus aucune arme ne tire**, vitesse augmentée, **les ennemis sont écrasés au contact** (dégâts + effet sang).
- Le véhicule a **sa propre jauge de vie** : il peut être détruit avant la fin du timer.
- **Durée limitée**, dépend de la rareté du spawn.
- Types demandés : **citadine, bus scolaire, tank**.

[PROPOSITION] Rareté et véhicules :

| Véhicule | Rareté | Durée | Vitesse | PV du véhicule | Particularité |
|---|---|---|---|---|---|
| Citadine | Peu commun | 15 s | x1,6 | faible | Agile |
| Bus scolaire | Rare | 20 s | x1,3 | élevé | Large, écrase en masse |
| Tank | Légendaire | 25 s | x1,1 | très élevé | Tire aussi des obus |

[DÉCIDÉ] À la sortie (fin du timer ou destruction) : **2 s d'invulnérabilité**, **visible par un effet sur le perso** (clignotement / halo).

Assets : 6 véhicules Quaternius dans le repo (Pickup, Truck, Sports, plus versions blindées). Pas de bus ni de tank dedans, à trouver.

### Mode Super Saiyan [DÉCIDÉ, remplace l'issue #7]

**Activation**
- Il faut d'abord trouver l'objet **"Sang Saiyan"** (dans un fût).
- Il active le passif **"Jauge de colère"**.

**La jauge**
- Elle se remplit **en tuant des ennemis ET en prenant des dégâts**.
- Elle a 6 paliers. Chaque palier demande **exponentiellement plus de points** que le précédent.
- Les derniers paliers ne sont atteignables que quand la run devient chaotique (grosses armes, ennemis qui meurent par vagues).

**La transformation**
- À tout moment, le joueur appuie sur la **touche de transformation** : il se transforme au **plus haut palier atteint** par la jauge.
- La transformation dure **1 minute**, puis la jauge **retombe à 0**.
- Choix tactique : se transformer tout de suite à un palier bas, ou attendre pour viser plus haut.

**Paliers et visuels**

| # | Palier | Visuel |
|---|---|---|
| 1 | Kaioken | Aura rouge |
| 2 | SSJ | Aura jaune, cheveux jaunes |
| 3 | SSJ2 | Aura jaune + électricité |
| 4 | SSJ3 | Aura jaune, longs cheveux jaunes |
| 5 | SSJ4 | Aura rouge, cheveux noirs |
| 6 | Ultra Instinct | Aura grise / blanche, particules qui flottent |

Les cheveux sont un **modèle de perruque** posé sur la tête du perso (assumé, look à l'arrache voulu).

**Remplissage de la jauge** [DÉCIDÉ, valeurs en config]
- 1 point par kill, 5 par élite, 50 par boss.
- 2 points par PV perdu : les dégâts subis remplissent plus vite, pour récompenser le risque.
- Seuils exponentiels (x3 à chaque palier) : 100, 300, 900, 2 700, 8 100, 24 300 points.
- Ces chiffres se calent sur des objectifs de ressenti, à mesurer en vraie partie : palier 1 environ 1 min après avoir trouvé l'objet, palier 3 atteignable dans une run normale, palier 6 seulement en fin de run chaotique ou en Last call.

**Bonus pendant la minute de transformation** [DÉCIDÉ, valeurs en config]

| # | Palier | Bonus |
|---|---|---|
| 1 | Kaioken | +25% dégâts, +15% vitesse, mais perd 1 PV/s. Ce coût ne peut pas tuer : les PV restent bloqués à 1 minimum |
| 2 | SSJ | +50% dégâts, +20% vitesse d'attaque, +20% vitesse |
| 3 | SSJ2 | +75% dégâts, +30% vitesse d'attaque, un éclair frappe un ennemi proche toutes les 0,5 s |
| 4 | SSJ3 | +100% dégâts, +40% vitesse d'attaque, +50% taille |
| 5 | SSJ4 | +150% dégâts, +50% vitesse d'attaque, +2 projectiles, +10% vol de vie |
| 6 | Ultra Instinct | +200% dégâts, +50% vitesse, esquive toutes les attaques sauf celles des boss |

Chaque palier ajoute un effet visible en plus des chiffres. A surveiller en test : Ultra Instinct pendant le boss final peut rendre la fin triviale (d'où l'exception des boss).

[DÉCIDÉ] L'objet Sang Saiyan est Légendaire uniquement, un seul exemplaire par run. La jauge ne se remplit pas pendant la transformation, sinon on enchaîne les transformations sans pause.

---

## 11. Ennemis

### Ennemis du proto (historique) [EXISTE]

Les ennemis marchent tous droit vers le joueur, se repoussent entre eux, et sont bloqués par le décor. Barre de vie au-dessus de la tête, flash rouge quand touchés.

| Ennemi | PV | Vitesse | Dégâts contact | XP | Apparaît à |
|---|---|---|---|---|---|
| Zombie | 9 | 2,8 | 8 | 2 | 0 s |
| Zombie rapide | 14 | 4,6 | 6 | 3 | 1:00 |
| Zombie errant | 16 | 2,4 | 9 | 3 | 2:00 |
| Zombie manchot | 20 | 3,6 | 5 | 4 | 3:00 |
| Zombie corpulent | 55 | 1,8 | 15 | 5 | 4:00 |
| Zombie décharné | 10 | 5,2 | 12 | 5 | 5:00 |
| Zombie ventru | 80 | 1,3 | 18 | 7 | 6:00 |
| Zombie tank | 150 | 1,5 | 24 | 12 | 7:00 |

Note : avec la fin de run actuelle à 5:00, les 3 derniers zombies n'apparaissent jamais. Incohérence du proto, à régler avec la durée de run (section 12).

Scaling actuel : PV des ennemis x(1 + temps/90 s). Spawn : intervalle de 1,1 s qui descend jusqu'à 0,15 s, par paquets de 1 + 1 par minute écoulée, à 40 unités du joueur.

### Principe [DÉCIDÉ]

- Comme les armes, chaque ennemi est construit avec des **briques de comportement** génériques, réglées dans la config.
- Chaque map a **son propre roster de 10 ennemis** : un nouveau type arrive chaque minute (0:00 à 9:00), les anciens restent.
- Tous les ennemis marchent vers le joueur. Les briques ajoutent une façon d'attaquer qui force à bouger.

### Briques de comportement [DÉCIDÉ]

| Brique | Comportement |
|---|---|
| Marcheur | Avance vers le joueur, dégâts au contact |
| Coureur | Rapide, fragile |
| Tank | Lent, beaucoup de PV |
| Tireur | Attaque à distance, projectile lent et esquivable (ou cône court) |
| Kamikaze | Explose au contact ou à sa mort |
| Chargeur | S'arrête, marque une ligne au sol, puis fonce |
| Sauteur | Bondit sur une zone marquée au sol, esquivable avec le saut |
| Diviseur | Se sépare en petits ennemis à sa mort |
| Invocateur | Fait apparaître d'autres ennemis |
| Protecteur | Réduit les dégâts reçus par ses voisins |
| Buffeur | Accélère ses voisins |
| Poseur de zone | Laisse des flaques au sol (ralentissement, poison...) |
| Accrocheur | Attire le joueur vers lui |
| Pousseur | Repousse le joueur vers la horde |
| Fantôme | Traverse le décor, intouchable par moments |

### Roster Abbaye [DÉCIDÉ]

| Min | Ennemi | Brique | Attaque |
|---|---|---|---|
| 0 | Zombie | Marcheur | Contact |
| 1 | Novice zombie | Coureur | Contact, fragile |
| 2 | Moine lanceur | Tireur | Bouteilles vides lancées en cloche, impact marqué au sol |
| 3 | Pèlerin gonflé | Kamikaze | Explose en gerbe de vin |
| 4 | Frère tonnelier | Marcheur lourd | Pousse devant lui un gros tonneau qui roule, comme Sisyphe son rocher |
| 5 | Fantôme du cloître | Fantôme | Traverse les murs, intouchable 1 s sur 3 |
| 6 | Moine porte-reliques | Protecteur | Ses voisins prennent 50% de dégâts en moins |
| 7 | Gargouille | Marcheur | Contact (bond retiré le 2026-11-09, voir section 21) |
| 8 | Prieur | Invocateur | Fait sortir 3 squelettes de terre autour de lui toutes les 8 s |
| 9 | Frère cellérier | Tank + diviseur | Se divise en 3 moinillons à sa mort |

### Roster Brasserie industrielle [DÉCIDÉ]

| Min | Ennemi | Brique | Attaque |
|---|---|---|---|
| 0 | Ouvrier zombie | Marcheur | Contact |
| 1 | Livreur zombie | Coureur | Contact |
| 2 | Contremaître | Buffeur | Accélère les zombies autour de lui |
| 3 | Zombie houblonné | Poseur de zone | Traînée de moût collant qui ralentit |
| 4 | Cariste | Chargeur | Fonce sur un transpalette |
| 5 | Soudeur | Tireur | Jet de flammes court en cône |
| 6 | Zombie de cuve | Diviseur | Éclate en flaques qui deviennent des petits zombies |
| 7 | Zombie au tuyau | Accrocheur | Lance un tuyau qui attire le joueur |
| 8 | Chimiste du labo | Tireur | Fioles qui empoisonnent |
| 9 | Fût blindé | Tank + protecteur | Insensible aux projectiles de face, il faut le contourner |

### Roster Fête de village [DÉCIDÉ]

| Min | Ennemi | Brique | Attaque |
|---|---|---|---|
| 0 | Fêtard zombie | Marcheur | Contact |
| 1 | Gamin en trottinette | Coureur | Très rapide, fragile |
| 2 | Lanceur de chamboule-tout | Tireur | Balles en rafale |
| 3 | Clown ballon | Kamikaze | S'envole et retombe sur le joueur en explosant |
| 4 | Majorette | Sauteur | Enchaîne les bonds |
| 5 | Tubiste de la fanfare | Pousseur | Onde sonore qui repousse vers la horde |
| 6 | Mascotte géante | Tank | Énormément de PV |
| 7 | Cracheur de feu | Tireur | Souffle de feu en cône |
| 8 | Vendeuse de barbe à papa | Poseur de zone | Zones collantes qui immobilisent un instant |
| 9 | Joueur de grosse caisse | Buffeur | Chaque coup de caisse accélère les ennemis proches |

### Élites [DÉCIDÉ]

Deux catégories bien distinctes.

**Élites classiques** : un ennemi normal de la map, simplement **2 fois plus grand et 2 fois plus fort**, avec un contour de couleur. Apparaissent tout seuls dans la horde. **Lâchent un coffre gratuit** (décision de l'utilisateur le 2026-11-11, à la place d'une poignée de Pièces). Fait : un toutes les 45 s dès 1:00, PV et dégâts x2, taille x2, liseré rouge, point rouge sur la mini-carte (`config/elites.ts`).

**Élites nommés** : personnages uniques avec une mécanique signature. Ils **n'apparaissent jamais tout seuls** : le joueur les **invoque** en activant une **Table de bras de fer** sur la planète (section 10). C'est un mini-boss optionnel, un choix risque / récompense.
- L'élite invoqué est tiré au hasard dans un **pool commun à toutes les maps**. Les plus durs n'entrent dans le pool qu'à partir d'un certain moment de la run.
- À l'invocation : bannière avec son nom et note de musique.
- Récompense : beaucoup de Pièces, un fût gratuit de haute rareté, et un succès par élite nommé tué pour la première fois.
- Chaque élite est une entrée de config (briques + mécanique propre) : on en ajoute au fil du temps sans toucher au moteur.

| Élite nommé | Dans le pool dès | Mécanique signature |
|---|---|---|
| Friezer | 2:00 | Flotte dans sa soucoupe, tire un rayon fin marqué au sol avant le tir, très gros dégâts. À 50% PV, se transforme : plus petit et plus rapide |
| Radditz | 2:00 | Fonce et attrape le joueur, immobilisé jusqu'à se libérer en martelant les touches, puis tire une double rafale |
| Gollum | 3:00 | Invisible (légère distorsion), vole des Pièces et s'enfuit. Le tuer rend le double |
| Saroumane | 4:00 | Reste à distance, éclairs sur zones marquées, invoque des Uruk-hai rapides |
| Nazgûl | 5:00 | Traverse la planète à cheval en ligne droite, son cri ralentit le joueur 2 s |
| Cell | 6:00 | Absorbe les zombies proches pour grossir et gagner des PV : plus on attend, plus il est fort |
| Boubou | 7:00 | Explose en morceaux à sa mort, qui se reforment s'ils ne sont pas tous tués en 5 s |
| Balrog | 8:00 | Énorme, fouet de feu en arc de cercle, laisse une traînée de feu |

Chaque élite nommé demande une réaction différente : esquiver les zones (Friezer, Saroumane), poursuivre (Gollum, Nazgûl), tuer vite (Cell, Boubou), éviter le contact (Radditz). Le pool est ouvert aux références entre potes.

### La Mort de la fermeture [DÉCIDÉ]

Commune à toutes les maps. **Remplace les videurs** (choix de l'utilisateur le 2026-11-12 : « il vient tuer le joueur, c'est approprié »). À 10:00 (section 12), une Mort sort de terre à 30 m du joueur, puis une de plus toutes les 40 s (8 au plus), de plus en plus rapides (6 m/s, +0,8 par minute, 11 au plus ; le Buveur va à 9). Intouchables (les armes ne les visent pas), elles flottent et traversent le décor ; un coup de faux tue. Elles ne lâchent rien. Modèle : « Stylized Death » de Gizart (Fab), voir journal.

### Vagues spéciales

En plus du débarquement de l'Abbaye (section 13), [PROPOSITION] événements ponctuels : horde en cercle qui se resserre autour du joueur, rush de coureurs.

**Coût de production** : 30 ennemis à modéliser et animer. Le code est léger grâce aux briques, le gros du travail est graphique.

### Boss [DÉCIDÉ]

Deux boss par map :
- un **boss de mi-run**, qui arrive tout seul à 5:00 ;
- un **boss final**, le "patron" de la map, invoqué par le joueur avec la **Porte du patron** (section 12).

| Map | Boss de 5:00 | Boss final (le patron) |
|---|---|---|
| **Abbaye** | **Frère Sonneur** : frappe une cloche géante qui envoie des ondes en anneaux, à sauter. Entre deux sonneries, fait rouler la cloche vers le joueur | **L'Abbé** : invoque des moines, répand du vin de messe au sol. Phase 2 : boit le vin et devient géant |
| **Brasserie** | **La Cuve vivante** : immobile, déverse des vagues de bière et crache des zombies de cuve. Il faut détruire ses vannes pour la rendre vulnérable | **Le Maître brasseur** : jets de vapeur, déclenche les tapis roulants. Phase 2 : boit sa production et devient enragé |
| **Fête de village** | **Le Manège fou** : chevaux de bois en rotation autour de lui, zone tournante à éviter. Tourne plus vite à mesure qu'il perd ses PV | **Le Maire** : son discours envoie des ondes de choc. Phase 2 : feu d'artifice final, des fusées pleuvent partout |

Règles communes :
- Barre de vie en haut de l'écran.
- 2 phases, attaques toujours annoncées (marquage au sol ou animation).
- Fût Légendaire gratuit à la mort.
- Pas d'arène fermée : sur une planète, on garde la liberté de fuir en tournant autour du globe.
- Puissance du boss final fixe : s'il est invoqué trop tôt, c'est le problème du joueur.

---|---|---|
| L'Abbé zombie | Mi-run | Invoque des moines zombies, zones de vin de messe au sol |
| Le Videur | Fin de run | Charges, onde de choc, phase enragée |

Chaque boss : barre de vie en haut de l'écran, arène qui se referme (optionnel), fût garanti à la mort.

---

## 12. Structure d'une run

### Existant [EXISTE]

Run de 5 minutes. À 5:00 : victoire ("Tu as survécu à la nuit"). Mort avant : défaite.

### Durée et fin de run [DÉCIDÉ]

- Run de **10 minutes**.
- **Boss 1 à 5:00**, qui arrive tout seul.
- **Boss final : déclenché par le joueur** en activant la **Porte du patron**, cachée sur la planète. Il peut l'activer **quand il veut** : s'il l'active trop tôt et n'est pas assez fort, c'est son problème.
- **Fermeture à 10:00, dans tous les cas** : que la porte soit activée ou non, des videurs zombies arrivent de plus en plus nombreux jusqu'à ce que le joueur meure. Il faut donc tuer le boss final avant d'être submergé. Le boss reste activable pendant la fermeture.
- Tuer le boss final ne termine pas la run [DÉCIDÉ 2026-11-12] : comme tous les boss et élites, il lâche un coffre (légendaire) et disparaît, sans écran. La run continue jusqu'à ce que la Mort de la fermeture attrape le joueur. Le "Last call" n'est donc pas un mode à part : c'est simplement la suite de la run.

### [PROPOSITION] Rythme d'une run de 10 min

| Moment | Événement |
|---|---|
| 0:00 | Zombies de base, le joueur s'équipe |
| 0:00 à 9:00 | Un nouveau type d'ennemi propre à la map chaque minute (section 11) |
| 5:00 | Boss 1 |
| à tout moment | Boss final, quand le joueur active la Porte du patron |
| 10:00 | Fermeture : les videurs zombies affluent, dans tous les cas |
| après | La run continue jusqu'à la mort (la fermeture s'emballe) |

### Difficulté [DÉCIDÉ]

Niveaux **Sobre / Pompette / Bourré**. [DÉCIDÉ 2026-11-13, la victoire n'existant plus] **Tuer l'Abbé** dans une difficulté débloque la suivante ; on la choisit sur l'accueil.

| Difficulté | PV des ennemis | Nombre d'ennemis | Dégâts des ennemis | TUNAS |
|---|---|---|---|---|
| Sobre | x1 | x1 | x1 | x1 |
| Pompette | x1,5 | x1,25 | x1,1 | x1,5 |
| Bourré | x2,5 | x1,5 | x1,25 | x2,5 |

Valeurs de départ, en config, calées en jouant.

---

## 13. Maps

### Existant [EXISTE]

- **Abbaye** : terrain procédural infini, de nuit, avec du vrai relief (montagnes marchables), découpé en zones (forêt, ruines, cimetière, terrain ouvert). Murs, piliers, arches, tombes, cryptes, pins, rochers, tonneaux, avec collisions.
- 2 maps "???" verrouillées dans l'écran de sélection, sans contenu.

### Les maps sont des planètes [DÉCIDÉ]

- Chaque map est une **vraie sphère** : la gravité tire vers le centre, on peut marcher tout droit et revenir à son point de départ. Pas de bord, pas de mur invisible.
- Taille : environ **2 minutes** pour faire le tour en courant tout droit à la vitesse de base (rayon à caler en test).
- Relief, zones (forêt, ruines, cimetière...) et décor générés de façon procédurale sur la sphère à chaque run.
- Points d'intérêt (fûts, véhicules, sanctuaires) répartis sur le globe.
- [DÉCIDÉ] **Les pentes trop raides bloquent** (au-delà de 60 degrés, réglable en config) : une montagne escarpée se contourne. Le joueur longe la paroi au lieu de s'arrêter net. Vérifié dans le test technique de la planète.
- [DÉCIDÉ] Éclairage : **un soleil d'un côté, une lune de l'autre**, directions fixes. Côté jour et côté nuit sur la même planète, avec un crépuscule entre les deux. Vérifié dans le test technique.

**Risque technique n°1 du projet.** Tout ce qui était en 2D dans le proto devient du calcul sur sphère : déplacement, gravité, caméra, spawn autour du joueur, collisions, pose du décor, génération du relief (bruit 3D au lieu de 2D). Validé par une scène de test dédiée avant tout le reste (section 20).

Point à surveiller : sur une petite planète, l'horizon est proche et cache la horde qui arrive. Le rayon et l'angle de caméra doivent garder une bonne visibilité.

### [PROPOSITION] Maps V1

Chaque map est une planète à thème.

| Map | Ambiance | Particularité |
|---|---|---|
| Abbaye | Cloître en ruine, nuit | Map de départ |
| Brasserie industrielle | Cuves, tapis roulants, vapeur | Zones de bière au sol qui soignent ou blessent |
| Fête de village | Chapiteaux, manèges, lampions | Zombies en masse, beaucoup de snacks |

Points d'intérêt : voir "Exploration de la map" (section 10).

### Spécificité de chaque map [DÉCIDÉ]

Chaque map a une mécanique propre, pas seulement un décor :

| Map | Spécificité | Ce que ça change |
|---|---|---|
| **Abbaye** | **Les cloches** : toutes les 2 min, les cloches sonnent et un **débarquement** fait apparaître 100 ennemis d'un coup autour du joueur | Rythme en vagues : se préparer avant chaque sonnerie |
| **Brasserie industrielle** | **Les cuves qui débordent** : des cuves éclatent au hasard et inondent une zone de bière pendant 30 s. Dans la bière, on glisse et on va plus vite, les zombies aussi | Terrain qui change en permanence : fuir par l'inondation ou s'y faire piéger |
| **Fête de village** | **Le feu d'artifice** : des fusées retombent régulièrement au hasard, marquées au sol avant l'impact. Elles blessent tout le monde, joueur compris, et tuent beaucoup de zombies | Attirer la horde sous les zones marquées sans y rester |

Chaque map a aussi **son propre roster d'ennemis** (section 11).

---

## 14. Méta-progression

### TUNAS [DÉCIDÉ, remplace le proto]

Monnaie persistante, sauvegardée dans le navigateur.

**Sources de revenus**
- Kills (chance de drop, comme le proto).
- Succès (montant fixe par succès).
- Boss (grosse somme à chaque boss tué).
- Bonus de fin de run (selon le temps survécu, la difficulté, la victoire).
- Multiplicateur de difficulté (Sobre / Pompette / Bourré) appliqué aux gains.

**Dépenses**
- Armes : débloquer leur apparition dans les level-ups.
- Objets passifs : débloquer leur apparition dans les fûts.
- Persos et maps.
- Options de cartes : débloquer Relancer / Bannir / Passer et leur nombre d'utilisations.
- **Skill tree** de boosts permanents.

**Objectif de rythme** : environ **100 runs** pour tout débloquer (boutique + skill tree complet), soit environ 15 à 20 h de jeu avec des runs de 10 min.

**Règle d'équilibrage** : la règle "une seule source de revenus" du proto saute. À la place, **une seule formule** additionne toutes les sources : TUNAS moyens par run = kills + boss + bonus de fin (le tout x difficulté), et les TUNAS des succès sont un montant fixe qui se soustrait du coût total. Coût total (boutique + skill tree) / TUNAS moyens par run = environ 100. Les moyennes doivent être **mesurées** sur de vraies parties (statistiques de fin de run enregistrées), pas estimées comme dans le proto.

### Pool de départ et déblocages [DÉCIDÉ]

Au début, le **pool est petit** : peu d'armes au level-up, peu d'objets dans les fûts. Le joueur l'agrandit avec des TUNAS, **en plus** du skill tree. Deux progressions parallèles : le pool donne de la **variété**, le skill tree donne de la **puissance**.

Règles [DÉCIDÉ] :
- Une arme et son objet d'évolution s'achètent **séparément**. Une arme débloquée sans son objet est jouable mais ne peut pas évoluer : il faut acheter l'objet en plus.
- Débloquer un perso ajoute **son arme de départ** au pool, pour tous les persos.
- Les autres objets s'achètent un par un en boutique.
- Les objets forts se débloquent **par succès** et non en boutique : Sang Saiyan, Seconde tournée, Trilogie LOTR.
- Pool de départ : 6 armes (Canette, Stout, Dessous de verre, n° 10 à inventer, Fût qui roule, Gueuze), leurs 6 objets d'évolution, et 6 objets simples (Bretelles, Last order, Glaçons, Mousse épaisse, Pourboire, Plateau de fromages).
- Le coût des armes et objets entre dans la formule des 100 runs.

### Skill tree [DÉCIDÉ]

Arbre de boosts permanents débloqués avec des TUNAS, conçu pour qu'on puisse **"bruteforcer" le jeu** à force de runs : un joueur moyen finit par gagner grâce à ses boosts accumulés.

**Forme [DÉCIDÉ]** : des **branches simples avec des rangs**, comme le miroir de Hades (pas d'arbre à embranchements). Chaque bonus a plusieurs rangs, chaque rang coûte 1,5 fois le précédent.

| Branche | Bonus (par rang, nombre de rangs) |
|---|---|
| **Survie** | PV max +5 (x5), Régénération +0,2/s (x5), Armure +1 (x3), Vol de vie +0,5% (x3) |
| **Puissance** | Dégâts +3% (x5), Vitesse d'attaque +3% (x5), Critique +2% (x5), Dégâts critiques +10% (x3), Taille +4% (x3), Durée +5% (x3), +1 projectile (x1, cher), **Dégâts collatéraux** (x1, très cher : les attaques de zone des ennemis blessent aussi les autres ennemis, voir plus bas) |
| **Mobilité** | Vitesse +3% (x5), Ramassage +10% (x5), Saut plus haut (x2) |
| **Chance** | LUCK +2 (x5), Descente +4% (x5), Pièces +5% (x5), Fûts -3% de prix (x3) |
| **Contrôle** | Relancer +1 utilisation (x5), Bannir +1 (x5), Passer +1 (x3). Chaque ligne n'est disponible qu'une fois l'option débloquée en boutique. Pas de carte supplémentaire au level-up : la 4e carte est la signature du Barman |
| **Exploration** | Débloque Livraison du brasseur, Table de bras de fer, Cloche du bar, Shot du diable, Machine à sous du PMU, Sosie bourré (1 noeud chacun). Puis : livraisons plus fréquentes (x3), pompes plus rapides (x3), +1 Table de bras de fer par planète (x2), meilleures chances à la machine à sous (x3) |

**Dégâts collatéraux [IDÉE du 2026-11-09, à chiffrer]** : sans ce noeud, les attaques de zone des ennemis ne touchent que le joueur. Acheté, elles blessent aussi les ennemis pris dedans : explosion du Pèlerin gonflé (et des futurs kamikazes), bouteilles des moines lanceurs. Ça transforme la horde en arme : attirer les kamikazes au milieu des autres devient une tactique. À trancher le moment venu : quelles attaques comptent exactement, et si les dégâts sur les ennemis sont réduits.

Risque : un arbre rempli peut rendre le Sobre trop facile. C'est le rôle de la difficulté Bourré de compenser.

### Budget de coûts [DÉCIDÉ]

Les coûts sont exprimés **en runs** : "2 R" = les TUNAS d'une run moyenne x2. La run moyenne sera **mesurée** (statistiques de fin de run), puis la config convertit en TUNAS. Total visé : environ **100 R**.

| Poste | Détail | Coût |
|---|---|---|
| Armes | 18 à débloquer, 1 R chacune | 18 R |
| Objets d'évolution | 18 à débloquer, 0,5 R chacun | 9 R |
| Autres objets | 15 à débloquer, 0,5 R chacun | 7,5 R |
| Persos | 6 achetables (2 par succès), 2 R chacun | 12 R |
| Maps | 2, 3 R chacune | 6 R |
| Relancer / Bannir / Passer | Déblocage, 1 R chacun | 3 R |
| Skill tree | Tout l'arbre | environ 45 R |

### Succès [ISSUE #9]

- Persistants (sauvegarde navigateur).
- Chaque succès donne des TUNAS.
- Écran dédié dans le menu principal, à côté de la boutique.

[PROPOSITION] Exemples :

| Succès | Condition |
|---|---|
| Premier verre | Terminer une run |
| Tenir l'alcool | Survivre 5 min |
| Tournée générale | Tuer 1 000 zombies en une run |
| Collectionneur | Débloquer toutes les armes |
| Kamehameha | Atteindre SSJ4 |
| Ultra sobre | Atteindre Ultra Instinct |
| Permis à points | Écraser 100 zombies en véhicule |
| Gros bras | Avoir 4 armes évoluées en même temps |
| Chaque perso | Gagner une run avec chaque personnage |

### Sauvegarde

Sauvegarde locale navigateur [EXISTE]. [PROPOSITION] Ajouter export/import de la sauvegarde (fichier) pour ne pas la perdre en vidant le navigateur.

---

## 15. Feedback et "juice"

Aujourd'hui : flash rouge sur l'ennemi touché, sons d'impact, de mort et de ramassage [EXISTE]. C'est le poste qui a le meilleur rapport effort/impact pour que le jeu soit agréable.

[PROPOSITION] V1 :
- Chiffres de dégâts flottants (désactivables), critiques en gros.
- Particules : verre brisé, mousse, éclaboussures de bière, morceaux de zombie.
- Légère secousse d'écran sur les gros coups et les explosions.
- Effet de recul sur les ennemis touchés.
- Ralenti très bref à la mort d'un boss.
- Bord d'écran rouge quand les PV sont bas.
- Son de level-up et de rareté différent selon le tier (le Légendaire doit se sentir).
- Animation d'ouverture du fût avec la couleur de rareté qui jaillit.

---

## 16. Interface

### Existant [EXISTE]

- Menu principal (Jouer, Boutique), affichage des TUNAS.
- Écran de sélection perso + map.
- HUD : temps, kills, PV, niveau, barre d'XP, TUNAS (dans la V1 : degré et barre d'alcoolémie, Pièces en plus).
- Écran de level-up (3 cartes), écran de fin (victoire/défaite, bilan, retour au menu).
- Navigation manette dans les menus.
- Panneau de debug en développement (godmode, figer le temps, faire apparaître un ennemi).

### Accueil dans l'espace [DÉCIDÉ le 2026-11-07]

L'écran d'accueil se passe **dans l'espace** : on voit de loin la ou les planètes (une par map). On y **choisit son perso et sa map**, puis la caméra **plonge sur la planète choisie** jusqu'au perso pour lancer la run. À la fin d'une run, retour dans l'espace.

Aujourd'hui : accueil provisoire, écran séparé du jeu (logo, Jouer, Options, sur fond uni ; le monde n'est pas rendu), qui sera remplacé. La run commence avec Jouer : le Buveur arrive à un endroit **tiré au hasard sur la planète** (terrain praticable, loin du décor), pas forcément devant l'abbaye [DÉCIDÉ le 2026-11-08]. **Chaque run est une nouvelle planète** : une seed tirée au hasard fixe le relief, les abbayes et tout le décor (petite barre de chargement d'environ 2 s entre Jouer et l'arrivée) ; la seed est notée dans le journal de run, pour pouvoir rejouer une planète.

### Menu qui se dévoile [DÉCIDÉ]

Au premier lancement, le menu n'a **qu'un bouton : Jouer**. Les autres (Boutique, Skill tree, Persos, Maps, Succès...) **apparaissent au fur et à mesure** que le joueur débloque des choses, comme dans Vampire Survivors. Le jeu se découvre en jouant, sans tutoriel.

### [PROPOSITION] V1

- Écran de pause : stats actuelles du joueur, armes et objets équipés avec leurs niveaux.
- HUD : icônes des armes et objets équipés, jauge Super Saiyan, jauge et timer de véhicule, barre de boss, flèche vers le fût le plus proche.
- Cartes de level-up colorées selon la rareté, avec le niveau actuel de l'arme.
- Écran des succès.
- Bestiaire / encyclopédie des objets découverts (optionnel).
- Options : volume musique / effets, sensibilité caméra, qualité graphique, chiffres de dégâts on/off, remappage.
- [DÉCIDÉ] Option **zone morte de la manette** réglable (sticks et gâchettes séparément), pour les manettes usées qui envoient un signal au repos. Demandé après un test avec une gâchette défectueuse.
- Écran d'erreur clair si le navigateur ne supporte pas le rendu 3D (leçon de l'issue #13 : aujourd'hui le menu devient inerte sans message).

---

## 17. Audio

Existant [EXISTE] : effets sonores Kenney (impacts, UI), aucune musique.

[PROPOSITION] V1 :
- Musique : thème de menu, thème de run qui s'intensifie, thème de boss.
- Effets dédiés : ouverture de fût, montée de palier Saiyan, moteur de véhicule, écrasement, boss.
- Limiter le nombre de sons simultanés identiques (sinon cacophonie avec des centaines de kills).

[DÉCIDÉ] Musique issue de **banques libres de droits** (licence de chaque morceau notée dans le repo).

---

## 18. Direction artistique

C'est le chantier principal de la refonte : le proto est moche surtout parce qu'il n'a pas de direction artistique (joueur = capsule avec un cône, mélange de packs d'assets aux styles différents).

[PROPOSITION] Principes :
- **Low-poly stylisé et cohérent**, une seule famille d'assets (ou des assets retouchés pour coller ensemble).
- **Palette limitée** par map : ambiance de nuit bleutée pour l'abbaye, accents chauds (ambre de la bière, or des TUNAS, couleurs de rareté) pour tout ce qui compte en jeu.
- **Lisibilité d'abord** : le joueur, les projectiles, les dangers et les pickups doivent se distinguer immédiatement du décor et de la horde.
- Personnages joueurs caricaturaux et reconnaissables à leur silhouette.
- Un vrai rendu stylisé (contours, éclairage soigné, brouillard) plutôt qu'un simple shader toon plaqué sur tout.

[DÉCIDÉ] **Cel-shading avec contours épais** (look cartoon) : aplats de couleur, ombres en paliers, contours noirs autour des persos, ennemis et objets. Validé sur une scène de test avant de produire le reste.

[DÉCIDÉ] Source des modèles 3D : **packs gratuits retravaillés** (Kenney, Quaternius...) et/ou **modèles faits par IA**, tous ramenés dans la même direction artistique.

---

## 19. Technique

### Moteur [DÉCIDÉ] : three.js + TypeScript, refait de zéro

Comparatif conservé pour mémoire. Contraintes : web, solo, un seul dev qui code largement avec Claude, des centaines d'ennemis à l'écran.

| Option | Pour | Contre |
|---|---|---|
| **three.js + TypeScript** (refonte propre) | Tout en code (idéal pour développer avec Claude), léger, rapide à charger, on garde l'expérience du proto (terrain, collisions) | Pas d'éditeur visuel, tout l'outillage est à écrire |
| Babylon.js | Moteur web plus complet (physique, éditeur de shaders, outils de debug intégrés) | Moins de recul dans ce projet, plus lourd |
| Godot 4 (export web) | Vrai éditeur, scènes, animations, très bon pour la 3D stylisée | Export web plus lourd à charger, limites connues de l'export web à vérifier, travail partagé entre éditeur et code |
| PlayCanvas | Éditeur web collaboratif, pensé pour le navigateur | Moins d'intérêt en solo, éditeur en ligne |

Recommandation : **three.js + TypeScript**, refait de zéro avec une architecture pensée pour la masse d'ennemis. L'intérêt d'un éditeur visuel est faible pour un dev solo qui code avec Claude, et le web est la cible principale.

### [PROPOSITION] Architecture

- TypeScript, Vite, build et déploiement Cloudflare (existant).
- **Contenu piloté par fichiers de config** [DÉCIDÉ] : armes, objets, synergies, évolutions, ennemis, boss, persos, maps, skill tree, succès, économie. Ajouter ou modifier une arme ou un objet = éditer une entrée de config, **sans toucher au code** tant que l'arme réutilise des comportements existants.
  - Les armes sont assemblées à partir de **comportements génériques paramétrables** (projectile, perçage, rebond, zone au sol, orbite, explosion, cône, mêlée, effet sur la durée...). Une nouvelle arme combine ces briques en config. Un comportement vraiment nouveau = une nouvelle brique de code, réutilisable ensuite par toutes les armes.
  - Les objets passifs décrivent leurs effets de la même façon (modification de stat, déclencheur + effet).
  - Synergies et évolutions sont déclarées en config (armes requises, objet requis, effet débloqué).
  - Config typée en TypeScript : une faute de frappe ou un champ manquant est détecté avant même de lancer le jeu.
- Architecture entités/composants simple pour gérer des milliers d'objets.
- **Rendu en masse** : instancing des ennemis, des projectiles et des pickups. Animation des zombies sans un modèle animé par zombie (par exemple animations précalculées en texture), sinon le jeu ne tiendra pas les hordes.
- Grille spatiale pour les collisions (aujourd'hui chaque ennemi est comparé à tous les autres, ça ne passera pas à l'échelle).
- Pools d'objets (pas de création/destruction à chaque tir).
- Boucle de jeu à pas fixe, séparée du rendu.
- Tests automatisés sur la logique pure (formules, tirages de rareté, économie).
- Menu et interface découplés du moteur 3D, avec écran d'erreur si le rendu ne démarre pas (issue #13).

### [PROPOSITION] Objectifs de performance

- 60 images/s sur un PC portable correct avec 500 ennemis à l'écran.
- Chargement initial raisonnable (quelques secondes).

**Mesures du test technique (2026-11-06, navigateur intégré de l'app, PC de l'utilisateur)** :
- Planète de 980 000 triangles, ombres du soleil et de la lune : 240 images/s (plafond de l'affichage).
- Horde instanciée, marche animée dans le shader, poursuite sur la sphère, séparation par grille : 500 zombies = 0,13 ms de calcul par frame, 1 000 = 0,6 ms, 2 000 = 1,3 ms, toujours à 240 images/s.
- Limites de la mesure : zombies faits de 6 boîtes (environ 70 triangles, les vrais modèles en auront bien plus), pas encore d'armes, de projectiles ni de particules, pas de collision des zombies avec le décor. Le plafond à 240 images/s cache la marge réelle de la carte graphique.
- Conclusion : l'approche (instancing + animation dans le shader + grille spatiale) tient largement l'objectif de 500 ennemis. Elle est retenue pour la V1.

---

## 20. Plan de développement : agile, feature par feature [DÉCIDÉ]

### Méthode

- **Pas de jeu "moche" peaufiné à la fin.** On développe une feature à la fois, et elle est livrée **100% finie** : modèle, animations, effets visuels, sons, interface, config, premier réglage.
- On passe à la feature suivante **seulement quand le résultat est validé en version finale** par l'utilisateur.
- Le contenu se fait **un élément à la fois** : une arme, puis la suivante. Pareil pour les objets, ennemis, persos, maps.
- Les modèles 3D viennent de **packs gratuits retravaillés** (Kenney, Quaternius...) et/ou de **modèles faits par IA**, tous passés dans la même direction artistique (section 18).

### Définition de "fini" (pour chaque feature)

1. Fonctionne dans le jeu réel, sur la planète, sans bug connu.
2. Visuel final : modèle, animations, cel-shading et contours conformes à la direction artistique.
3. Effets visuels et sons finaux (le "juice" fait partie de la feature, pas d'une étape à la fin).
4. Interface finale si la feature en a (HUD, carte, écran).
5. Toutes les valeurs dans la config, avec un premier réglage testé en jeu.
6. Validé par l'utilisateur en jouant.

### Journal de run [DÉCIDÉ le 2026-11-07]

En développement, **chaque run est enregistrée en détail dans un fichier** (`logs/runs/`, hors dépôt git) : apparitions, coups donnés et reçus par arme et par ennemi, morts, XP, level-ups et cartes proposées / choisies, PV, fps, avec un instantané chaque seconde. Le but : analyser l'équilibrage à partir de vraies parties, pas seulement au ressenti du joueur.

### Exceptions assumées

- **Tests techniques jetables** : pour les deux gros risques (planète sphérique, 500 ennemis à 60 images/s), on fait d'abord un test brut pour vérifier que c'est possible. Ce n'est pas une feature livrée : le code validé est ensuite repris proprement.
- **Équilibrage global de l'économie** : le calage des 100 runs ne peut se faire qu'une fois tout le contenu en place. Chaque feature a son réglage, l'économie globale est recalée à la fin.

### Ordre des features

La première feature (le premier perso sur la première map, avec le décor) fixe la **direction artistique, le style et le gameplay**. Ensuite, il ne reste qu'à ajouter du contenu dans ce cadre : armes, ennemis, mécaniques.

Les dépendances fixent l'ordre : une feature n'arrive que quand celles dont elle dépend sont finies.

| # | Feature | Validé quand |
|---|---|---|
| 0a | Test technique : planète sphérique (gravité, déplacement, caméra en repère local, relief) | On fait le tour de la planète, caméra stable partout |
| 0b | Test technique : 500 ennemis animés sur la sphère | 60 images/s tenues |
| 1 | **Le Buveur sur la planète Abbaye, avec son décor, en version finale** : modèle, déplacement, saut, caméra, contrôles clavier et manette, relief, décor, éclairage, cel-shading et contours | Le style et la sensation de jeu sont validés : ils deviennent la référence pour tout le reste |
| 2 | Zombie de base : modèle, animations, poursuite, dégâts au contact | Il fait peur et se lit bien |
| 3 | PV, mort et écran de fin | On peut mourir proprement |
| 4 | Blonde (première arme) | Tuer des zombies est satisfaisant |
| 5 | Capsules, alcoolémie, degrés, level-up (cartes, rareté, LUCK) | La boucle de base est fun |
| 6 | HUD de run | Tout ce qui compte se lit d'un coup d'oeil |
| 7 | Spawn et montée en difficulté sur 10 min | Une run de 10 min tient en tension |
| 10+ | Armes, une par une (avec leur évolution et leurs synergies dès que les deux armes existent) | Chaque arme validée |
| ... | Pièces et fûts, puis objets un par un | Chaque objet validé |
| ... | Ennemis de l'Abbaye, un par un, puis élites | Chaque ennemi validé |
| ... | Boss de 5:00, Porte du patron, boss final, fermeture, Last call | Run complète avec victoire |
| ... | Exploration : pompes, poubelles, puis les autres éléments | Chaque élément validé |
| ... | Méta : TUNAS, menu qui se dévoile, boutique, skill tree, succès, sauvegarde | Progression sur plusieurs runs |
| ... | Persos un par un, Sang Saiyan, véhicule, snacks | Chaque élément validé |
| ... | Brasserie, puis Fête de village (planète, spécificité, ennemis, boss) | Chaque map validée |
| fin | Équilibrage global de l'économie | Environ 100 runs pour tout débloquer |

L'ordre après l'étape 7 est indicatif : il se rediscute à chaque feature validée.

---

## 21. Journal des décisions et questions restantes

### Tranché le 2026-11-06

| Sujet | Décision |
|---|---|
| Moteur | three.js + TypeScript, refait de zéro |
| Style graphique | Cel-shading avec contours épais |
| Maps | Planètes sphériques réelles, tour en environ 2 min |
| Durée de run | 10 min, boss à 5:00, boss final via la Porte du patron, fermeture à 10:00 dans tous les cas, la run ne finit qu'à la mort (l'Abbé tué lâche un coffre, pas d'écran de victoire) |
| Difficulté | Sobre / Pompette / Bourré, débloquées en gagnant |
| Caméra | Orbitale + zoom molette, repère local à la planète |
| Arme du Buveur | Blonde simple, chaque bière est une arme séparée |
| Évolutions d'armes | Oui, une par arme |
| Emplacements d'armes | 4 maximum |
| Synergies | Arme X + arme Y équipées (niveau indifférent) = bonus débloqué |
| Stats du joueur | Liste définitive de 16 stats, dont le vol de vie (section 4) |
| Niveaux d'armes | Infinis, évolution possible dès le niveau 8 |
| Roster d'armes | 24 armes, 24 évolutions, 15 synergies (section 6) |
| Contenu | Tout en fichiers de config, armes construites par briques de comportement |
| Level-up | Armes uniquement (nouvelle arme ou amélioration) |
| Objets passifs | Uniquement par les fûts (et boss), pas de limite, 48 objets (section 7) |
| Objets d'évolution | Ont leur propre effet, utiles même sans l'arme liée |
| Valeurs des objets | Petites valeurs cumulables, multipliées par la rareté, ajustées en config |
| Sang Saiyan | Légendaire uniquement, un seul exemplaire, la jauge ne se remplit pas pendant la transformation |
| Tirelire | Gardée, +10% TUNAS, intégrée à la formule d'économie |
| Relancer / Bannir / Passer | Oui, débloqués avec des TUNAS, absents au départ. Passer ne donne aucune compensation |
| Boss | 2 par map : mi-run à 5:00, patron final via la Porte du patron, 2 phases, pas d'arène |
| Fûts | Payants en Pièces (monnaie de run), prix croissant. Remplace "gratuits" |
| Véhicule | 2 s d'invulnérabilité visible à la sortie |
| Super Saiyan | Objet Sang Saiyan, jauge de colère (kills + dégâts subis), transformation manuelle 1 min au plus haut palier atteint, puis jauge à 0 |
| TUNAS | 4 sources (kills, succès, boss, bonus de fin), 4 usages (armes, persos et maps, options de cartes, skill tree) |
| Progression | Skill tree permanent en branches à rangs (6 branches), environ 100 runs pour tout débloquer |
| Coûts | Exprimés en runs moyennes (R), budget total environ 100 R, converti en TUNAS après mesure |
| Difficulté | Pompette x1,5 PV / x1,25 nombre / x1,1 dégâts / x1,5 TUNAS ; Bourré x2,5 / x1,5 / x1,25 / x2,5 |
| Pool d'armes et d'objets | Petit au départ, agrandi avec des TUNAS en plus du skill tree. Arme et objet d'évolution achetés séparément |
| Persos | 9 persos (section 5), arme de départ non exclusive, ajoutée au pool au déblocage du perso |
| Objets forts | Sang Saiyan, Seconde tournée, Trilogie LOTR débloqués par succès |
| Carte supplémentaire | Réservée au passif du Barman, absente du skill tree |
| XP | Présentée comme l'alcoolémie, le niveau est le degré |
| Exploration | Fûts, pompes à bière, poubelles, porte du patron dès le départ. 6 autres éléments débloqués dans le skill tree (section 10) |
| Boss final | Déclenché par le joueur via la Porte du patron, quand il veut. Fermeture à 10:00 dans tous les cas |
| Maps | Une spécificité de gameplay par map, un roster d'ennemis par map |
| Ennemis | Briques de comportement, 10 types par map (un nouveau par minute), élites classiques (x2 taille et force), videurs communs |
| Élites nommés | Invoqués par la Table de bras de fer, pool commun de 8 au départ, extensible en config |
| Menu | Un seul bouton Jouer au départ, les autres apparaissent avec les déblocages |
| Musique | Banques libres de droits |
| Modèles 3D | Packs gratuits retravaillés et/ou modèles faits par IA |
| Méthode de dev | Agile : une feature à la fois, livrée 100% finie et validée avant la suivante (section 20) |

### Tranché le 2026-11-08 (feature 7)

| Sujet | Décision |
|---|---|
| Arrivée des ennemis | Flot continu à un rythme qui accélère avec la run (config `SPAWN_CURVE` : arrivées par seconde et PV), qu'on les tue ou non : il n'y a jamais trop d'ennemis, on meurt submergé. Seule limite : un plafond technique de 700 debout pour tenir les fps. Corrigé le 2026-11-08 : une première version maintenait une horde cible et cessait d'envoyer des zombies quand elle était pleine |
| Où ils arrivent | Anneau à 30-38 m (hors de portée de l'arme), plutôt devant le joueur quand il court ; ils sortent de terre (environ 1 s, immobiles) au lieu d'apparaître d'un coup |
| Zombies distancés | Ils restent derrière et continuent de poursuivre le joueur. Le recyclage (au-delà de 60 m, ils ressortaient de terre devant) a été retiré le 2026-11-10 à la demande de l'utilisateur : on se sentait encerclé sans fin, comme une vague des cloches qui ne s'arrête jamais |
| Montée en difficulté | Valeurs de départ : 6 zombies à l'atterrissage, puis 0,8 arrivée/s à 0:00, 3/s à 5:00, 6/s à 10:00 ; PV x2,3 à 5:00, x4,5 à 10:00. Après 10:00 ça continue de monter, en attendant les videurs. À caler avec le journal de run |
| Difficultés | Multiplicateurs Sobre / Pompette / Bourré en config et branchés (PV, nombre, dégâts). Seule Sobre est jouable, le choix est dans le panneau DEV |
| Cloches de l'Abbaye | Toutes les 2 min pile (2:00, 4:00...), sans alerte : le grand coup de cloche sonne et le débarquement démarre au même instant, suivi de 2 coups de volée. Pendant 30 s, un seul type d'ennemi (parmi ceux déjà arrivés) sort de terre en continu et en masse tout autour du joueur, à 18-26 m (8 par seconde, soit 240, x difficulté). Cloche synthétisée, pas de changement de musique. Corrigé le 2026-11-08 : la première version sonnait 3 coups d'alerte de 1:55 à 1:58, pris pour un déclenchement en avance |
| Mécaniques de map | Une interface `MapMechanic` et un registre par map (`src/game/mechanics/`) : la Brasserie et la Fête de village s'y ajoutent sans toucher au noyau |
| Équilibrage | Reporté : impossible avec un seul type d'ennemi tué en un coup. Il se fera une fois les ennemis de l'Abbaye, les élites, les boss et les armes en place |
| Modèles des ennemis | Chaque modèle est un ennemi distinct du roster de l'Abbaye : Zombie = Quaternius Basic (0:00), Novice = Quaternius Ribcage (1:00, il court), Moine lanceur = Moine kelgar (2:00), Pèlerin gonflé = à trancher (3:00). Tailles validées le 2026-11-09 : zombies Quaternius ramenés à 1,4-1,55 m (ils paraissaient trop grands), moine à 2 m. Squelettes du Prieur : KayKit Skeletons (animation Spawn_Ground), gargouille : Dragon des Animated Monsters, voir `Desktop/MODELS/INVENTAIRE.md` |
| Fiches ennemis | Un registre `ENEMIES` (PV, vitesse, dégâts, XP, modèle) et un roster par map `ROSTERS` (minute d'arrivée, poids de tirage), dans `src/config/enemies.ts`. Le débarquement des cloches tire son type parmi ceux déjà arrivés |
| Look des moines | Validé le 2026-11-09 (« avec le cel-shading tout passe »). Le zombie Quaternius habillé en moine par script est rejeté (silhouette de zombie, pas de moine). Les moines utilisent le Moine de Čestmír Dammer (kelgar.org) : frère tonsuré en bure, cordelière, sandales, 3 900 triangles, préparé par `tools/blender/monk.py` (atlas unique, animations Idle, Walk, Run, Punch, HitReact, Death). Les 7 moines se distingueront par taille, couleur et objets. Bibliothèque d'assets triée hors repo : `Desktop/MODELS/INVENTAIRE.md` |
| Look du Pèlerin gonflé | Le Moine en bure rouge vin, un tonneau sans fond enfilé autour du ventre comme s'il l'avait transpercé (tonneau du Fantasy Props MegaKit, `monk.py --variant pelerin`). Il court. Validé le 2026-11-09 |
| Brique Kamikaze | Il fonce (3,6 m/s) ; à 2,2 m du joueur il s'arrête, allume la mèche (0,9 s) et gonfle, la zone (3,2 m) marquée au sol comme les bouteilles ; puis il explose (22 PV) et disparaît sans lâcher de bière. Il ne frappe jamais au contact. Tué, il explose aussitôt sur place (bière lâchée) : le tuer de loin est sûr, à bout portant ça fait mal. L'explosion ne blesse pas les autres ennemis, sauf avec le noeud Dégâts collatéraux du skill tree (section 14). Pèlerin gonflé au roster de l'Abbaye à 3:00 |
| Frère tonnelier | Le Moine en bure gris ardoise qui pousse devant lui un gros tonneau couché, qui roule sans fin, même quand il est collé au joueur (comme Sisyphe son rocher). C'est uniquement son modèle (`monk.py --variant tonnelier` : un os fait rouler le tonneau dans chaque animation, les mains sont posées dessus). Pas de charge, pas de marque au sol : c'est un marcheur lent et solide (22 PV, 2,2 m/s, 10 PV au contact). Au roster de l'Abbaye à 4:00 |
| Brique Chargeur | Essayée sur le Frère tonnelier puis retirée le 2026-11-09 (l'utilisateur voulait juste un moine qui pousse son tonneau). L'implémentation (élan, ligne marquée au sol qui épouse le relief, charge en ligne droite, sonné, délai) reste dans le commit f45b79d, à reprendre pour le premier vrai chargeur (le Cariste) |
| Fantôme du cloître | Le petit fantôme du kit Kenney cimetière (choisi par l'utilisateur plutôt qu'un moine fantôme), translucide, qui flotte au ras du sol en ondulant. 12 PV, 3 m/s, 8 PV au contact. Au roster de l'Abbaye à 5:00 |
| Brique Fantôme | Il traverse le décor (murs, tombes) et reste au niveau du relief. Intouchable 1 s toutes les 3 s, à un moment propre à chacun : les armes ne le visent pas, les coups le traversent, et il devient presque transparent. Il peut frapper même intouchable |
| Moine porte-reliques | Règle : pas plus de 3 ennemis sur le même corps (le Moine sert déjà au lanceur, au pèlerin et au tonnelier). Le porte-reliques est le Rogue encapuchonné du KayKit Adventurers sans son masque, en bure crème, 1,85 m, qui tient à deux mains devant lui un coffret doré plein d'or (coffre en or du KayKit Dungeon recoloré), préparé par `tools/blender/kaykit.py`. 18 PV, 2,6 m/s, 6 PV au contact. Au roster de l'Abbaye à 6:00 |
| Brique Protecteur | Les ennemis à moins de 6 m d'un protecteur prennent 50 % de dégâts en moins. Il ne se protège pas lui-même, plusieurs halos ne se cumulent pas, et mort il ne protège plus. Une étoile dorée scintille au-dessus de sa tête (rayons, rotation lente, éclats irréguliers), le corps des protégés a un liseré doré subtil sur ses contours, et les coups amortis lâchent des étincelles dorées |
| Buffs entre ennemis | Règle (2026-11-09) : jamais de zone au sol pour un buff entre ennemis, c'est illisible dès qu'il y en a plusieurs. Celui qui donne le buff a une étoile qui scintille au-dessus de sa tête (pas un simple rond qui pulse) ; ceux qui le reçoivent ont un liseré de lumière subtil sur les contours du corps (jamais la texture repeinte). Les marques au sol restent réservées aux dangers pour le joueur |
| Gargouille | Le Dragon du pack Animated Monsters (Quaternius) en pierre grise aux yeux rougeoyants, préparé par `tools/blender/monsters.py` (couleurs unies rangées dans une palette). 20 PV, 2,8 m/s, 8 PV au contact. Au roster de l'Abbaye à 7:00 |
| Brique Sauteur | Essayée sur la Gargouille puis retirée le 2026-11-09 : l'utilisateur la veut simple, elle s'approche et frappe au corps à corps. L'implémentation (se ramasse, zone marquée au sol, bond en cloche, esquive par le saut, sonnée, délai, éclats de pierre) reste dans le commit f67a252, à reprendre pour un vrai sauteur (la Majorette) |
| Mécaniques des ennemis | Règle (2026-11-09) : par défaut, un nouvel ennemi s'approche et frappe au corps à corps, sans animation ni mécanique d'activation (bond, charge, zone marquée...). Ce qui le distingue : son look, sa taille, ses stats. Une mécanique n'est ajoutée que si l'utilisateur la demande. Chaque ennemi est quand même validé ensemble en jeu, un par un |
| Prieur | L'Eye Summoner de Polygonal Mind (100 Avatars, robe noire, coiffe à cornes avec un oeil, encensoirs), choisi par l'utilisateur le 2026-11-09. Sans squelette d'origine : `tools/blender/summoner.py` l'habille du squelette du mannequin UAL ajusté à son corps (poids à l'os le plus proche), avec la marche solennelle et le geste d'invocation (Spell_Simple). 28 PV, 2,4 m/s, 8 PV au contact, 2,2 m. Au roster de l'Abbaye à 8:00 |
| Brique Invocateur | Gardée pour le Prieur (« certains ennemis auront des mécaniques, mais très peu, on validera ensemble à chaque fois »). À moins de 14 m du joueur, 3 s après son arrivée puis toutes les 8 s : il s'arrête, fait son geste 0,9 s (il le finit même sous les coups ; mort avant, rien ne sort), puis 3 squelettes sortent de terre en cercle à 2 m de lui (encensoir qui tinte, terre qui craque, mottes de terre). Squelettes : Skeleton Minion KayKit (`kaykit.py --variant squelette`), 5 PV, 3,4 m/s, 5 PV au contact, 1 de bière, hors roster |
| Frère cellérier | Le Zombie Chubby de Quaternius tel quel (gros ventre, déjà animé), choisi par l'utilisateur le 2026-11-09, à 2,1 m. Tank : 60 PV (le plus du roster), 1,8 m/s, 14 PV au contact, 10 de bière. Au roster de l'Abbaye à 9:00 |
| Brique Diviseur | Tué par le joueur, le Frère cellérier éclate en gerbe de vin et 3 moinillons sortent de son corps en cercle (1,2 m) : le même modèle à 0,9 m, 6 PV, 3,8 m/s, 4 PV au contact, 1 de bière, hors roster. Ils ne se divisent pas à leur tour |
| Stout | Feature des armes commencée le 2026-11-09 par la Stout (n° 2). Bouteille trapue étiquetée du KayKit Dungeon (choisie par l'utilisateur), découpée par `tools/blender/props.py` en verre noir, étiquette crème, bouchon de liège. Brique commune « bouteille lancée » (`weapons/bottleWeapon.ts`) partagée avec la Blonde. Réglages de départ : 1,3 s entre deux lancers, 30 dégâts (Blonde 16), 13 m/s (Blonde 17), portée 16 m, recul x3, traverse 1 zombie. Cartes : dégâts, cadence, recul, zombie traversé (Rare et plus), portée, critiques, taille. Impact : gerbe de bière brune et choc sourd. Découpage : 1) l'arme (DEV : Donner l'arme), 2) la carte « nouvelle arme » au level-up, 3) la synergie Black and Tan |
| Canette | Le 2026-11-09, la Blonde devient la **Canette** : une canette de bière en métal (canette de soda du Kenney Food Kit, découpée par `tools/blender/props.py` en métal argenté et corps rouge), même comportement et mêmes chiffres. À l'impact : bière blonde et tintement de fer-blanc, plus d'éclats de verre. Icône de canette. Identifiant `canette` dans le code |
| Pils tiède | Retirée du roster le 2026-11-09 à la demande de l'utilisateur (« on va en inventer une autre mieux ») : l'arme n° 10 est à inventer, avec son évolution par le Trèfle de comptoir et sa synergie avec la Bière de Noël |
| Fût qui roule | Commencé le 2026-11-09 (choix de l'utilisateur). Grand tonneau du KayKit Dungeon (choisi par l'utilisateur), découpé par `tools/blender/props.py --variant fut` en bois et cerclages. Brique à part (`weapons/fut.ts`) : toutes les 3,5 s, il part vers le zombie le plus proche (choix de l'utilisateur) et roule tout droit sur le relief, 9 m/s pendant 2,6 s (environ 23 m), en écrasant chaque zombie de sa ligne une fois (28 dégâts, recul x3), sans s'arrêter ; il éclate en bois et en bière au bout de sa course ou contre le décor (rebondir sera l'évolution Rouleau compresseur). Cartes : dégâts, cadence, taille du fût, distance, recul, fût en plus (Rare et plus, en éventail), critiques |
| Gueuze | Commencée le 2026-11-09 (choix de l'utilisateur). Bouteille fine du Fantasy Props MegaKit en verre rose rouge framboise, bouchon de liège (choix de l'utilisateur), découpée par `tools/blender/props.py --variant gueuze`. Brique à part (`weapons/gueuze.ts`) : toutes les 3 s, lancée en cloche sur le plus gros groupe de zombies à portée (16 m, choix de l'utilisateur), si elle touche un zombie en vol, elle explose aussitôt à l'impact (demande de l'utilisateur) ; sinon elle se pose au sol et tourne sur elle-même en moussant 0,8 s, puis explose : 34 dégâts à tous les zombies dans 3,2 m, recul vers l'extérieur, gerbe de bière framboise, éclats de verre, la caméra tremble si c'est près. Elle ne blesse jamais le joueur ; pas de marque au sol (réservées aux dangers pour le joueur). Cartes : dégâts, cadence, rayon, gueuze en plus (Rare et plus, sur un autre groupe), critiques |
| Pompe à bière | Commencée le 2026-11-10, premier élément d'exploration (retour de l'utilisateur : rien n'incite à explorer, on tourne en rond). Modèle : le fût sur chevalet du KayKit Dungeon (choix de l'utilisateur), cerclages en bronze, argent ou or (`props.py --variant pompe`). 20 pompes par run (demande de l'utilisateur : au moins 20 sur une planète de cette taille), placées au hasard, à plus de 25 m du départ et 25 m entre elles, hors du décor ; qualité tirée au hasard (bronze 60, argent 30, or 10). Rester à moins de 6 m remplit la pinte en 6 s, elle redescend de 8 % par seconde quand on s'éloigne. Pleine : le jeu se fige et propose 1 bonus de stat parmi 3 (même écran que le level-up, titre « Pompe en or ! ») ; une seule fois par pompe. Chaque carte a sa rareté (5 tiers, comme les cartes d'arme, valeur x1 à x4), tirée avec la LUCK du joueur plus la chance de la pompe (bronze +0, argent +10, or +20) (demande de l'utilisateur le 2026-11-10). Jauge à l'écran : une pinte qui se remplit au-dessus de la barre d'alcoolémie, « Reviens près de la pompe ! » quand on sort de la zone ; sphère ronde très discrète de la couleur de la pompe, de 6 m de rayon, qui montre la zone ; fût grand comme une statue (3,2 m) (retour de l'utilisateur le 2026-11-10), plein : le joueur et les zombies butent dessus ; son de la bière qui coule (« Beer service 2 » de BigSoundBank, CC0, un versement complet qui suit le niveau de la pinte et se coupe quand on sort de la zone). Icône des cartes : une tireuse de profil qui remplit une pinte. Bonus : dégâts, vitesse d'attaque, PV max (soigne d'autant), vitesse de déplacement, portée d'attraction (ex-ramassage), gain d'XP, chance, projectile en plus (Rare et plus). Nouvelles stats du joueur : Dégâts (toutes les armes), Vitesse. Faisceau de lumière de la couleur de la pompe, visible de loin ; pinte en verre au-dessus du fût qui se remplit de bière. Code : `game/pumps.ts`, `config/pumps.ts`, `world/pumpsView.ts` |
| Mini-carte | Faite le 2026-11-10 (choix de l'utilisateur : disque local plutôt que globe 3D ou grande carte). Disque en bas à droite, vue du dessus centrée sur le Buveur sur 80 m, tournée comme la caméra ; relief en teintes (creux sombres, collines claires, montagnes grises), pompes encore pleines en points de leur couleur, le Buveur en flèche au centre. **Pas de brouillard** (l'utilisateur : « pas besoin »). Seul ce qui tient dans le disque est montré : pompes vidées retirées, pas de flèches vers les pompes lointaines (demande de l'utilisateur). Code : `ui/minimap.ts`, `world/mapProjection.ts`, réglages `MINIMAP` |
| Pièces et coffres | Commencé le 2026-11-10 (choix de l'utilisateur après la mini-carte). Les fûts payants deviennent des **coffres** (« sinon juste un coffre » : le coffre du KayKit Dungeon, couvercle séparé), ouverts avec une **touche d'action** (E / bouton X). Checkpoint 1 fait : Pièces = capsules dorées, 30 % des ennemis tués lâchent une capsule à la place de leur XP (8 % au départ, trop peu selon l'utilisateur), aspirées par la Portée d'attraction, compteur à côté des kills, tintement au ramassage. Code : `config/coins.ts`, `pickups/coinDropsView.ts`. Checkpoint 2 fait : **100 coffres** posés au hasard (« une bonne centaine », demande de l'utilisateur), sur sol plat, loin du départ et des pompes, pleins (on bute dessus) ; près d'un coffre, « E / X : Ouvrir le coffre » et son prix (5 capsules, +3 par coffre ouvert) ; payé, le couvercle s'ouvre, la rareté est tirée avec la LUCK, le jeu se fige sur **1 objet parmi 3** de cette rareté. Premier lot d'objets : ceux du GDD qui touchent une stat déjà en jeu (Bière plus forte, Tournée rapide, Ventre à bière, Godasses de bar, Aimant à capsules, Ticket de tournée, Trèfle de comptoir, Deux mains). Coffres fermés en carrés bruns sur la mini-carte. Code : `game/chests.ts`, `config/chests.ts`, `config/items.ts`, `world/chestsView.ts`, `ui/chestPrompt.ts`, modèle `props.py --variant coffre`. Validé par l'utilisateur le 2026-11-10. Ensuite (choix de l'utilisateur) : **ouverture façon lootbox** dans le HUD (demande de l'utilisateur : « genre gatcha, lootbox opening, addictif » ; une première version en colonne de lumière 3D a été refusée, « pas besoin ») : le jeu se fige 2,2 s (+0,35 s par rareté), le coffre tombe au centre et tremble de plus en plus fort pendant qu'une roulette de couleurs de rareté tourne et ralentit (un tic par couleur), elle s'arrête sur la vraie rareté, le couvercle saute dans un éclair de sa couleur, gerbe d'étincelles, nom de la rareté qui rebondit, notes de verre qui montent, cloche et écran qui tremble dès Dingue ; puis l'écran de choix (`ui/chestReveal.ts`, réglages `CHEST_OPENING`). Retours de l'utilisateur sur l'ouverture (« l'icône du coffre est pas très belle », « les cartes sortent du coffre ») : coffre redessiné en trois quarts (`chestSvg` dans `ui/icons.ts`, planches, ferrures rivetées, serrure dorée, gemme de la couleur de la rareté, état ouvert avec l'intérieur du couvercle), le même dans l'animation et sur l'écran de choix ; l'écran de choix d'un coffre pose le coffre ouvert sous les cartes, qui jaillissent de sa bouche l'une après l'autre en tournoyant (`LEVEL_UP_SCREEN.fromChest`) ; une icône par objet (`itemIcon`). L'animation se ferme sur `chestOpened` (et non sur sa propre minuterie) pour ne pas laisser de trou si les images ralentissent. Objets dans le HUD (demande de l'utilisateur) : rangée sous les armes (`ui/itemHud.ts`, `ITEM_HUD`), une case par objet, cadre de la couleur de sa meilleure rareté, « x2 » quand il est pris plusieurs fois, petit saut à l'arrivée. Objets à effet spécial, premier lot (choix de l'utilisateur le 2026-11-10, lot « Mixte ») : Cendrier (5 % des ennemis tués explosent en cendres et braises, blessent leurs voisins, jamais le joueur, en chaîne possible), Mousse épaisse (bulle de mousse autour du Buveur qui absorbe un coup entier, revient toutes les 20 s), Happy hour (toutes les 60 s, vitesse d'attaque x2 pendant 8 s, bandeau et cloche), Sachet de cacahuètes (0,2 PV par goutte d'XP). Noyau : `game/itemEffects.ts`, réglages `ITEM_EFFECTS` ; les armes lisent `stats.fireRate` (cadence et effets passagers). DEV : « Donner l'objet » à la rareté choisie. Puis tous les autres objets (demande de l'utilisateur le 2026-11-10 : « fais tous les autres objets ») : 42 objets en jeu sur 48. Modèle générique (`config/items.ts`) : un objet donne des stats (plusieurs possibles) et/ou un effet, texte de carte dans la config ; 13 stats nouvelles dans `PlayerStats` (critique, dégâts critiques, taille, durée, régénération, armure, esquive, recul, vol de vie, capsules, remplissage des pompes, prix des coffres, saut) ; effets dans `game/itemEffects.ts` (gel, ralenti, sifflet, juke-box, seconde tournée, coffre gratuit du Bonnet, double saut, ardoise, écharpe...). Interprétations : « élites » = ennemis à 20 PV de base ou plus (pas encore d'élites ni de boss) ; « petit fût » du Bonnet = coffre gratuit posé près du joueur ; Kebab (durée) et Pinte XXL (taille) touchent les effets qui existent (gel, ralenti, sifflet, happy hour, sonné ; explosions de la Gueuze et du Cendrier, ondes). En attente de leur système : Trilogie LOTR (zones), Sang Saiyan (jauge de colère), Tirelire (TUNAS), Pourboire et Plateau de fromages (snacks), Bière renversée (Flaque de bière). Retours de l'utilisateur ensuite : Mousse épaisse = une bulle par exemplaire, chacune avec sa recharge (emboîtées à l'écran) ; Juke-box = onde de musique toutes les 10 s (dégâts + recul) au lieu de l'onde au level-up. Pas encore : les effets d'évolution des objets, coffre piégé |
| Brique Tireur | Fiche `thrower` réutilisable par tout ennemi : il s'arrête à portée (15 m), lance en cloche vers l'endroit où est le joueur au lâcher (vol 1,3 s), impact marqué au sol par un anneau rouge qui se remplit, éclatement de 1,6 m (10 PV). Au contact il frappe comme les autres. Moine lanceur : 14 PV, 2,4 m/s, 4 de bière, arrive à 2:00 |
| Refonte visuelle | Demandée par l'utilisateur le 2026-11-10 (« revoir toutes les icônes et les améliorer », « pareil pour les animations et les effets visuels de tout ce qui existe »), faite en autonomie, à valider en jeu. Point de retour : tag git `avant-refonte-visuelle`. **Icônes** : toutes redessinées dans un seul style à volumes (dégradés partagés, ombres, reflets, contour épais) : 42 objets, 4 armes, pompe, coffre, capsule, crâne des kills, coeur des PV (`ui/iconKit.ts`, `ui/itemIcons.ts`, `ui/icons.ts`). **Interface** : écran de choix (rayons qui tournent, présentoir d'icône avec halo, cartes qui flottent, reflet, étoiles sur Dingue et Légendaire, la carte prise s'envole pendant que le jeu reprend), ouverture de coffre (ondes de choc, étoiles, coffre qui bondit, halo rond à la place du faisceau en trapèze), HUD (coeur qui bat, barres de PV et d'alcoolémie animées, cases d'armes et d'objets, compteurs), bandeaux, accueil (bulles qui montent, logo qui brille), pause, mort, chiffres de dégâts (rebond, inclinaison). **Effets en jeu** : particules dessinées par shader (`fx/sprites.ts`) et recettes (`fx/vfx.ts`) : éclat à chaque coup, étoile et étincelles sur un critique, ennemi tué qui part en fumée, explosions (éclair, anneau, braises, fumée de dessin animé) pour la Gueuze, le Pèlerin, le Cendrier et les bouteilles des moines, poussière à l'atterrissage et au fût, colonne de lumière au niveau gagné, au coffre, à la pompe et à l'Happy hour, traînée des projectiles, gouttes d'XP en forme de goutte qui scintillent, ondes au sol à front lumineux, bulle de mousse irisée. Les effets s'allègent seuls quand la horde meurt en chaîne (`VFX.crowd`). Tous les réglages : `VFX` et `SPRITE_FX` dans `config/fx.ts` |
| Fin de run, checkpoint 1 | 2026-11-12. Ordre choisi par l'utilisateur : Porte du patron + Abbé + victoire, puis fermeture à 10:00, puis Last call. L'Abbé : sculpté maison, attaque simple (flaques de vin de messe marquées puis brûlantes, 7 PV toutes les 0,5 s dedans), phase 2 il boit et devient géant (x1,6), 4 000 PV fixes. Porte du patron en pièces du Castle Kit, faisceau rouge, absente de la mini-carte, une seule fois, pas pendant un autre boss. Le tuer : écran de victoire |
| Fin de run, retours du premier test | 2026-11-12, demandes de l'utilisateur : porte 2,5 fois plus grande, **toujours sur la mini-carte** (au bord du disque avec une flèche quand elle est loin), mêmes faces des deux côtés (deux demi-épaisseurs dos à dos, bannières sur les deux faces). L'Abbé trop facile à esquiver : 2 fois plus grand (10 m, 16 m en phase 2), flaques 2 fois plus larges (rayon 4,6 m, posées à moins de 8 m du joueur). Choix des cartes à la manette : croix directionnelle pour choisir, X (ou A) pour valider. Second test : mains de l'Abbé retournées (il tenait crosse et calice pouce en bas), porte posée sur un sol presque plat (pas sur un flanc de montagne). **Checkpoint 1 validé par l'utilisateur** |
| Frère Sonneur, sans cloche qui roule | 2026-11-12 : la cloche géante qui roule a été faite puis **retirée à la demande de l'utilisateur** (« bizarre », « pas nécessaire »). Il tient une cloche à la main et la frappe au maillet ; seule l'attaque de zone reste. Version retirée, pour mémoire : la cloche géante du GDD. Cycle : se placer derrière la cloche, la sonner 2 fois (onde à sauter depuis la cloche), la pousser (elle roule 20 m vers le joueur, 25 PV au contact), retourner la chercher. Le coup de maillet direct sur le joueur est retiré (le maillet frappe la cloche) |
| Frère Sonneur, checkpoint 1 | 2026-11-12. Look : l'utilisateur a choisi un « ogre maison » (modèle Blender par script), puis a demandé de le refaire en vrai modèle (« c'est cheap ») : sculpture par remaillage. En jeu : arrive à 5:00 (1 500 PV, x difficulté), onde en anneau à sauter à chaque coup de maillet (18 PV), coup direct sous le maillet (30 PV), phase 2 sous 50 %, coffre légendaire à sa mort. La cloche géante qui roule viendra au checkpoint 2 |
| Élites classiques | 2026-11-11, demande de l'utilisateur (« des mobs en version 2X plus fort qui drop un coffre gratuit ») : un ennemi du roster déjà arrivé, taille, PV et dégâts x2, liseré rouge (aGlow négatif dans le shader de la foule), un toutes les 45 s dès 1:00, coffre gratuit là où il tombe. Valeurs de départ |
| Tournées du bar | 2026-11-11, les 8 retenues par l'utilisateur sur ma proposition : Tournée générale (grosse onde de dégâts autour, immédiate), Pression max (dégâts x2, 15 s), Seau à glace (gèle les ennemis proches 5 s), Double pinte (XP x2, 20 s), Péket (vitesse +60 %, 12 s), Casque à bière (invulnérable 8 s, les ennemis rebondissent), Frites-mayo (+40 PV et régénération 10 s), Sous-bock porte-bonheur (Chance +10, 30 s). Lâchées par 0,6 % des ennemis tués (la Chance l'augmente), restent 30 s au sol, aspirées par le Ramassage ; reprendre une tournée active relance sa durée sans cumuler. Icônes au sol et pastilles à compte à rebours sous le chrono. Valeurs de départ, à caler |
| Dernier service | 2026-11-11 : l'utilisateur demande un moyen de ramasser tout ce qui traîne (« sans ça on sait pas faire une vraie run »), avec des objets sur la carte et des bonus lâchés par les ennemis, mais **pas une copie de Megabonk** : concept maison choisi, la Cloche du bar du GDD (« Dernière tournée ! »), avancée au départ. Cloche en laiton sous potence et clochette modélisées (`tools/blender/cloche.py`). Les gouttes glissent le long du sol jusqu'au Buveur. Checkpoint suivant : les « Tournées du bar », bonus temporaires (15 s) lâchés par les ennemis, à thème de bar (liste à valider avec l'utilisateur) |
| Poubelles et coffre piégé | 2026-11-11, choix de l'utilisateur : la poubelle se casse au contact **et** par les armes ; un premier snack (cornet de frites, +20 PV) en attendant la feature snacks ; coffre piégé **avec un indice visible** (couvercle qui tressaute, coffre qui rougit), payé il explose et libère des zombies, capsules perdues ; modèle de poubelle « Trashcan » de Poly by Google fourni par l'utilisateur (les `trash_A/B` KayKit sont des tas de déchets). 150 poubelles, butin XP 55 % / capsules 40 % / snack 5 %, piège 8 % : valeurs de départ, à caler en jouant |
| Performances de fin de partie | Demandé par l'utilisateur le 2026-11-11 (« en end game, avec des armes haut niveau et full projectiles + full ennemis ça doit pas lagger »). Mesuré sur un banc (`tools/bench`, 800 ennemis, 4 armes au maximum, environ 230 projectiles) et en jeu. **Noyau** : 7,8 à 8,5 ms par image -> 2 à 3 ms selon les passages (index spatial des zombies : les projectiles et les effets ne parcourent plus toute la horde ; écartement par demi-voisinage ; sol sondé une image sur deux ; corps immobiles laissés en place ; recherche de décor sans allocation). **Rendu** : la profondeur de champ réutilise la profondeur de l'occlusion ambiante (une passe de scène en moins), un seul astre calcule ses ombres à la fois, les ennemis hors champ ne sont pas dessinés, les projectiles sont dessinés en instances (2 700 appels de dessin -> environ 600), les corps au sol sont plafonnés à 120 (au-delà, les plus anciens disparaissent : `ZOMBIE_HURT.maxCorpses`). Triangles par image avec 800 ennemis : 78 millions -> 18 millions. Sur la machine de l'utilisateur : 55 -> 91 images par seconde avec 800 ennemis, 78 -> 124 avec 400. **Filet de sécurité** : résolution adaptative (la scène baisse jusqu'à 60 % si la carte graphique sature, l'interface reste nette ; `RENDER.adaptive`). F3 affiche le temps par partie de l'image. Non fait : modèles d'ennemis simplifiés au loin (LOD) |
| Fin de run, checkpoint 2 : la fermeture | 2026-11-12. L'utilisateur veut la Mort (« Stylized Death » de Gizart, Fab, gratuit, licence standard) à la place des videurs. Le modèle est livré pour Unreal : exporté en FBX par l'éditeur Unreal 5.8 de l'utilisateur (projet où il l'a ajouté), préparé par `tools/blender/mort.py` (translations des os retirées : celles du mannequin Unreal). D'abord gardé hors du dépôt (public, licence Fab), mais la prod est construite par Cloudflare depuis GitHub et n'avait que le repli : l'utilisateur a choisi de versionner `src/assets/models/mort.glb`, à retirer en cas de plainte. Sans lui, le Grim Reaper de Falibu (fixe, fourni par l'utilisateur) le remplace. La page Fab indique « Autoriser l'utilisation avec IA : Non » : signalé à l'utilisateur, qui a choisi de l'utiliser. Gameplay décidé par moi en l'absence de l'utilisateur, à valider : façon Faucheuse des survivors (voir section 11). Bouton Start de la manette = pause |
| Fin de run, checkpoint 3 : pas de victoire | 2026-11-12, choix de l'utilisateur : l'Abbé tué lâche un coffre légendaire gratuit et disparaît, comme les autres boss ; pas d'écran de victoire, la run continue jusqu'à la Mort (fin « mort », seule fin avec « abandon »). L'écran de victoire est supprimé. Le Last call prévu (mode infini après la victoire) n'a plus lieu d'être. Carillon et bandeau « Un coffre légendaire t'attend » à sa mort |
| Cartes de stat : tout à toutes les raretés | 2026-11-12, choix de l'utilisateur : sur les cartes d'amélioration d'arme et de pompe, toutes les stats peuvent sortir à toutes les raretés. Les stats entières (projectile en plus, zombie traversé) suivent la rareté, arrondies à l'inférieur : +1 en Commun et Peu commun, +2 en Rare, +3 en Dingue, +4 en Légendaire (`rarityValue`). La Stout gagne la carte projectile en plus. Les cartes montrent la stat avant et après (« Projectiles 1 -> 2 »). La règle « une rareté et un effet fixes » ne concerne que les objets |
| TUNAS, checkpoint 2 de la méta | 2026-11-12, choix de l'utilisateur : les TUNAS tombent au sol en **liasses de billets** (modèle « Cash Stack » de J-Toastie fourni par l'utilisateur, recoloré) et se ramassent comme les capsules (Portée d'attraction, Dernier service). Une liasse par ennemi tué à 1,5 % (en plus de l'XP ou de la capsule), une grosse pile pour un élite (5) et un boss (Frère Sonneur 15, Abbé 25), bonus de fin de 3 par minute survécue à la mort seulement ; **à l'abandon, le joueur garde ce qu'il a ramassé** (sans le bonus). Multiplicateur de difficulté (x1, x1,5, x2,5). Visée : environ 100 TUNAS par run moyenne de 10 min, à recaler sur de vraies runs. Affichés dans le HUD, sur le bilan de mort et sur l'accueil ; sauvegardés dans le profil (solde et total gagné). Le Dernier service les ramène aussi |
| Boutique, checkpoint 3 de la méta | 2026-11-12, choix de l'utilisateur : **la boutique vend les persos, les armes et les objets ; le skill tree tout le reste** (dont Relancer / Bannir / Passer). Un seul écran Boutique sur l'accueil, trois rayons. Départ : le Buveur, les 4 armes faites (pool de départ du GDD), 3 objets par rareté (15) ; les 27 autres objets à acheter, prix par rareté 30 / 40 / 60 / 80 / 120 TUNAS (environ 15 runs pour tout). Armes à vendre : 100 TUNAS (les prochaines), persos à déclarer dans `SHOP_CHARACTERS`. Un coffre ne propose que des objets débloqués, le level-up que des armes débloquées. Relancer / Bannir / Passer sont codés dans le noyau (testés) et attendent le skill tree pour leurs utilisations et leurs boutons |
| Skill tree, checkpoint 4 de la méta | 2026-11-13, choix de l'utilisateur : une simple grille par catégories, chaque catégorie une ligne de paliers à acheter dans l'ordre. Contenu de départ proposé par moi (à ajuster) : Force (+5 % dégâts), Cadence (+4 % vitesse d'attaque), Carrure (+10 PV max), Jambes (+3 % vitesse), Aimant (+0,5 m de portée d'attraction), 5 paliers chacun ; Cartes : Relancer, Bannir, Passer, +1 Relancer, +1 Bannir. Prix par palier 40 / 80 / 130 / 200 / 300 TUNAS, arbre complet 4 500 TUNAS (environ 45 runs, comme prévu). Onglet « Skill tree » de l'écran Boutique. Relancer / Bannir / Passer : boutons sous les cartes de level-up (souris, touches R B P, manette : bas puis A), Bannir passe en mode « choisis la carte » |
| Difficultés débloquées par l'Abbé | 2026-11-13 : plus de victoire, donc tuer l'Abbé dans une difficulté ouvre la suivante (Sobre, Pompette, Bourré), gardé dans le profil ; choix sur l'accueil au-dessus de Jouer. DEV : « +100 TUNAS » (bloc Monde, marche aussi sur l'accueil) |
| Objets : une rareté et un effet fixes | 2026-11-12, choix de l'utilisateur : un objet n'a jamais plusieurs niveaux de rareté, il a une rareté et un effet fixe ; un coffre propose 3 objets différents de sa rareté ; une dizaine d'objets par rareté. Répartition des 42 objets faite par moi, à corriger par l'utilisateur : 9 Commun, 9 Peu commun, 9 Rare (dont Deux mains +1 projectile), 8 Dingue, 7 Légendaire (Seconde tournée, Cendrier, Mousse épaisse, Happy hour, Juke-box, Bonnet, Bon de réduction). Les 6 objets du GDD pas encore faits (Trilogie LOTR, Sang Saiyan, Tirelire, Pourboire, Bière renversée, Plateau de fromages) compléteront les raretés hautes |
| Plus tard | Les nouveaux types d'ennemis par minute, les élites, les boss et les videurs arrivent avec leurs features |

### Encore ouvert

Aucune question de design ouverte au 2026-11-06. Les valeurs chiffrées sont des points de départ en config, calées en jouant. Prochaine étape : test technique de la planète sphérique (section 20).
