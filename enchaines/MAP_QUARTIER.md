# Le Quartier du Dragon — refonte jouable de la Cour du Dragon (mode crazy)

Arène `quartier` (`core/courses/quartier.js`), construite avec le pack « Courtyard » (`assets/exports/combat_fight_arena_psx.glb`, najjar320, licence `assets/LICENSE.txt`).
L'ancienne arène `cour` est **conservée telle quelle** (`core/courses/cour.js`, `published: false`, encore sélectionnable au salon) ; le Quartier est l'arène crazy par défaut : tout est réversible, le fichier GLB n'est **pas modifié**.

Plan généré à partir des collisions réelles : `node tools/plan.mjs quartier tools/plan-quartier.png 12` → `tools/plan-quartier.png`
(gris = hauteur du dessus des volumes, plus clair = plus bas ; rouge = toits hors d'atteinte ; jaune = rebords saisissables ; orange = caisses et murets ; cyan = apparitions ; magenta = points d'accroche des cordes).

---

## A. Audit de l'existant

### Le modèle
- **12 nœuds**, chacun un maillage d'un seul tenant avec **son propre atlas** (texture « baked » unique, filtrage au plus proche, matériaux double face, PBR sans métal) : `Street` (rue 40 × 17 m), `Arena_Floor` (cour pavée 14 × 11 m, losange central), `Building_B1` … `B9`, `Stairs` (perron 4,66 × 2 m, 6 marches de 33 cm).
- ~9 000 sommets au total (PSX), textures 512² à 2048² PNG ; aucune animation, aucune hiérarchie (pivots = centre au sol de chaque bâtiment, rotation et échelle neutres).
- Toile de fond séparée (`mountains_sky_backdrop.glb`) : **un seul plan** de 240 × 80 m à z = −65 (nord). Les autres directions montrent le ciel et les crêtes du jeu.
- Les atlas contiennent des **échantillons réutilisables** : façades, tuiles (vertes / sombres), planches de bois, grosses pierres, pavé de rue (brique de 40 px, rangées de 32 px, 52 px/m).

### Mesures (repère local de chaque nœud ; coupes horizontales, surfaces planes et cartes de hauteur)
| Pièce | Murs (x × z) | Égout → faîte | Type de toit | Débord | Éléments |
|---|---|---|---|---|---|
| B1 pavillon | 14 × 11 (baie de 4,66 × 2 m au centre de la façade) | 8,95 → 10,45 | 2 pans, faîtage ∥ x | 0,55 | 2 balcons filants (plancher 3,05–3,21 / 6,05–6,21, garde-corps 3,89 / 6,89, 0,64 m de profondeur) |
| B2 aile est | 13 × 8 | 6,9 → 8,15 + appentis 4,0 → 6,5 (45°) | 2 pans ∥ x | 0,5 | auvent à garde-corps (3,9–4,83) presque sous le débord |
| B3 aile ouest | 13 × 8 | 6,9 → 8,15 + appentis 4,0 → 6,5 | 2 pans ∥ **z** (B3 n'est pas le miroir de B2) | 0,5 | idem |
| B4 maison basse | 9,7 × 10,7 (socle 0,42) | 3,0 → 4,98 | pyramide | 0,75 | — |
| B5 maison à porche | 9,7 × 10,7 (socle) | 5,85 → 7,07 | 2 pans ∥ z | 0,8 | porche (3,05–3,96, 0,8 m) |
| B6 grand pavillon | 12,7 × 8,7 | 9,85 → 11,07 | 2 pans ∥ x | 0,85 | — |
| B7 tour | 14 × 9 | 12,0 → 14,84 | pyramide | 0,5 | auvent de façade 5,95–6,95 |
| B8 maisonnette | 3 × 9 en deux niveaux | avant 3,85 → 4,52 ; arrière 5,85 → 6,67 | 2 pans ∥ z | 0,31 | — |
| B9 | 9,7 × 8,7 (socle) | 6,85 → 8,02 | 2 pans ∥ x | 0,85 | — |

### Problèmes de jouabilité constatés
- **Ruelles de 1,8 à 2 m** entre les pavillons, cour de 14 × 11 m : 373 m² de sol praticable en tout. Caméra à l'épaule (5,6 m de recul) constamment collée aux murs.
- Collisions d'origine : une boîte par pavillon montant jusqu'au faîte (toits **plats et murs pleins** jusqu'en haut, rien à saisir), enceinte invisible au sud (vide visible).
- Côté sud **ouvert** sur le vide (le pack est conçu pour une caméra de jeu de combat fixe).
- **Bug réel trouvé et corrigé** pendant l'audit : le nœud « Street » contient « tree » → le code qui fait ployer les arbres balançait **toute l'arène** de ±2° (« la map tangue comme un bateau ») et la décalait de ses collisions (objets qui semblaient traverser le sol / ne pas toucher les murs). Mesuré dans le navigateur : rotation 0° après correctif.

### Contraintes du moteur (lues dans `core/sim.js`)
- Collisions = **boîtes orientées** (lacet seulement), pas de pentes ni de maillages. Une marche ≤ 14 cm se franchit en marchant (le bas de la capsule glisse dessus).
- Capsule : rayon 0,32 m, hauteur 1,75 m. Saut : apex 1,6 m (touche maintenue). En crazy, le second appui près d'un mur est un **saut mural** (qui éloigne du mur), sinon un double saut.
- Accroche : bord du DESSUS d'une boîte non `nograb`, à 0,8–2,4 m au-dessus des pieds, en poussant vers la face, rien juste au-dessus ni juste derrière le bord. Puis : longer (1,9 m/s), passer les coins, se hisser (Espace), sauter du mur, lâcher. Endurance qui baisse en pendant. → **portée réelle depuis le sol : ~4,0 m**.
- Lianes (`ropes`, état `ROPE`) : cordes pendantes déjà gérées par la physique (parcours d'ascension), utilisables telles quelles en crazy si on en pose.
- Physique autoritaire serveur à 120 Hz, mêmes données côté client (prédiction) : toute collision est dans `core`, partagée.

---

## B. Choix de level design

- **On déplace, on n'étire pas.** Chaque bâtiment garde ses proportions, ses façades et ses textures d'origine ; seules leurs places changent. Pas d'agrandissement uniforme.
- **Enceinte 45 × 52,7 m** (2 372 m²), sol praticable relié au sol : ~1 200 m² (×3,2), plus les toits.
- **Rangée nord** (B9, B8, B7, B6) adossée à l'enceinte : silhouette du fond conservée, B7 reste le repère dominant **hors d'atteinte**.
- **Rangée du milieu** : B1 au centre avec son perron et la cour pavée devant (composition d'origine), B4 à l'ouest, B5 à l'est, décalés en z (pas de symétrie parfaite).
- **Ailes** B3 et B2 contre les côtés, appentis tournés vers la place ; **B2 et B5 décalés vers le nord** pour que les rues ouest et est ne soient pas dans l'axe (sinon une ligne de tir de 45 m traversait toute la carte).
- **Kiosque** : la maisonnette B8 réemployée une seconde fois, tournée d'un quart de tour, au milieu de la place — elle coupe la grande ligne nord-sud du perron à la porte, et offre deux niveaux de toit (3,9 et 5,9 m).
- **Rues** : rue arrière 6,6–8 m (combat mobile, coupée par des caisses et un muret), ruelles nord-sud de 5,4–5,5 m (contournement), rue ouest 8,9 m, rue est 4,3 m (plus serrée), place de 19 m, deux placettes au sud devant les façades de B3 et B2, placette de la porte.
- **Couverture** construite avec les matériaux du pack : murets de pierre à chaperon de tuiles (1,1 m, on les enjambe), caisses de planches (1,2 m = appui, 2,4 m = couverture pleine et appui de grimpe).
- **Limites** : mur d'enceinte de 4,6 m (pierre + chaperon de tuiles) et **porte du quartier** au sud (battants de bois fermés). La limite continue au-dessus du mur (on ne saute pas dehors depuis un toit), c'est le seul volume invisible, et il est toujours sur la ligne d'un mur visible. Au-delà : **d'autres toits du même pack** (14 nœuds réemployés, tournés, sans collision) pour que la ville semble continuer jusqu'aux montagnes.
- **Toits accessibles** (en marches de 10 cm qui suivent la vraie pente) : B4 (3,0–4,98, le plus facile), B1 (8,95–10,45, par les balcons — central mais exposé de partout), B5 (par le porche), B2/B3 (par les caisses d'appui puis l'appentis), B8 nord (deux niveaux) → B9 (7–8 m), auvent de B7 (perchoir à 6,95 m), kiosque.
- **Hors d'atteinte volontairement** : B6 et B7 (11–15 m) — sinon positions dominantes incontestables.

### Itinéraires (tous joués par un robot avec la vraie physique, voir D)
1. Rue → égout de B4 (depuis le pied du mur, on pend sous le débord) → toit → faîte.
2. Place → balcon 1 de B1 (bord du plancher) → perché sur le garde-corps → balcon 2 → égout du toit (sous le débord) → faîte à 10,45 m.
3. Rue arrière → petit toit de B8 → toit haut → saut sur la pente de B9 ; ou petit toit → bout de l'auvent de B7 → perchoir.
4. Place → caisse d'appui → appentis de B3 (45°) → toit de l'aile.
5. Place → égout bas du kiosque ; caisses côté nord → toit haut du kiosque.

---

## C. Ce qui est construit

| Fichier | Rôle |
|---|---|
| `core/courses/cour-kit.js` | **Pièces mesurées** du pack : murs, socles, balcons, auvents, toits (2 pans, pyramide, appentis) générés en dalles de 10 cm à n'importe quelle position et rotation. `roofHeight` = forme visuelle du toit (sert aux tests). |
| `core/courses/quartier.js` | L'arène : enceinte, disposition (`LAYOUT`), couverture (`PROPS`), apparitions, **points d'accroche des cordes** (`ANCHORS`), description du décor pour le client (`ENV`). |
| `core/sim.js` | 3 ajouts, sans effet sur les boîtes existantes : `eave` (rebord d'un toit ou d'un balcon qui déborde du mur : saisi depuis le pied du mur, on pend contre le mur), `edge` (rebord certifié : toit raide dont la pente commence juste derrière), `lip` (on saisit le bord du plancher d'un balcon, on se hisse par-dessus le garde-corps). |
| `client/quarter.js` | Rendu : nœuds du GLB clonés (géométrie, matériaux et textures **partagés**, rien dupliqué en mémoire), sol pavé (échantillon de la rue, répété sans raccord), enceinte, porte, murets, caisses (échantillons des atlas, pixels nets comme le pack), toits extérieurs. |
| `client/levelview.js` | Branche `quarter.js` quand l'arène a `env` ; sinon modèle tel quel (ancienne Cour). |
| `tools/plan.mjs` | Plan vu du dessus depuis les collisions. |
| `core/quartier.test.js` | Tests (ci-dessous). |

### Cordes (préparation seulement)
**Aucun système de corde de grappin n'existe.** `ANCHORS` décrit 6 points d'accroche réels (égouts avant/arrière du pavillon, linteau de la porte, égout du porche de B5, garde-corps de l'auvent de B2, auvent de B7) : position, type d'appui, longueur utile, axe de balancement prévu, rayon libre exigé. Ils ne sont **pas dessinés** en jeu. Le test vérifie qu'ils reposent sur du solide et que l'arc de balancement (0–60°, du côté prévu) ne touche aucun volume. Les lianes existantes (`K.rope`) pourraient servir de premier prototype de corde pendante.

---

## D. Tests (`node --test core/quartier.test.js`, inclus dans `npm test`)
- **Collisions ↔ maillage réel** : le test lit le GLB, pose les nœuds comme le client, rasterise le dessus du maillage (cases de 25 cm) et le compare au dessus des collisions. Résultat : **0 à 2,2 % de cases hors tolérance par bâtiment** (10 cm ; 36 cm pour l'escalier à ressauts ; 42 cm pour les toits hors d'atteinte), uniquement sur des arêtes (pignons, garde-corps de 12 cm).
- **Parcours** 1 à 5 ci-dessus, joués avec la vraie physique (touche de saut tenue comme un joueur), y compris pendre sous un débord, longer un balcon et passer le coin d'un toit.
- **Refus** : B6, B7, B9 (depuis le sol), enceinte, appentis sans appui (4,0 m : hors de portée d'un saut) ne se saisissent pas ; un balcon ne se saisit pas par en dessous (la tête cogne son plancher : il faut prendre de l'élan depuis ~1,5 m).
- **Circulation** : remplissage du sol depuis une apparition — toutes les apparitions reliées, pas de recoin fermé, pas de trou dans le sol.
- **Hors-map** : 4 joueurs aux entrées aléatoires lancés depuis les toits les plus hauts vers l'extérieur, 6 manches : personne ne sort de l'enceinte.
- **Apparitions** : au sol, hors des objets, à plus de 7 m les unes des autres.
- **Coût** : 254 boîtes ; 0,32 ms par pas de simulation pour 4 joueurs (≈ 3,8 % d'un cœur à 120 Hz, contre 0,7 % pour l'ancienne Cour).

### Non vérifié à ce stade
- **En vrai, en ligne, avec la caméra à l'épaule** : seuls des rendus fixes (caméra libre) ont été capturés ; pas de partie réelle à plusieurs.
- Lisibilité de la caméra dans les rues (≥ 4,3 m partout, mais non mesurée en jeu), sensation de vitesse, équilibre des toits (B1 central).
- Rendu des pignons et faces arrière du kiosque (B8 était caché entre deux bâtiments à l'origine) et des faces des toits extérieurs vues de près.
- Animation d'accroche quand on pend **sous** un débord (le corps est contre le mur, les mains au bord : non regardé en jeu).

## E / F. Suite proposée
1. Partie test réelle à 2–4 (propriétaire) → retours sur les distances, la caméra, les toits.
2. Ajuster les positions (une ligne par bâtiment dans `LAYOUT`) et rejouer `node tools/plan.mjs` + `npm test`.
3. Cordes : choisir le modèle (corde pendante façon liane, ou grappin), puis brancher `ANCHORS`.
4. Hors de portée de cet environnement : retoucher la géométrie elle-même (raccourcir un débord, ouvrir une porte, ajouter un escalier extérieur modélisé) demande Blender ; ici tout est fait sans toucher au GLB.
