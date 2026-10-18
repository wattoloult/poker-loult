# LES ENCHAÎNÉS — Loult Party

Parcours d'obstacles 3D (three.js vendorisé dans `lib/`, zéro install). Servi par le serveur du poker :
`node server/server.js` puis http://localhost:8770/enchaines/ (ajouter `?debug` : touches 1-5 = téléport aux checkpoints).

| Fichier | Rôle |
|---|---|
| `sim.js` | Simulation PURE (UMD, pas fixe 1/120 s) : mouvement, glissade, rebords, escalade, wall-jump, lianes, rouleaux, checkpoints, cap de caméra scripté |
| `level.js` | Le parcours (données) |
| `game.js` / `index.html` | Rendu three.js, textures procédurales, caméra, entrées, HUD |
| `test_sim.js`, `test_level.js` | Tests de la sim et de la faisabilité du vrai parcours (`node enchaines/test_sim.js`) |

## Retours playtest traités
- **Caméra** : verrouillée au pointeur ou libre (`Tab`) ; elle ne tourne jamais seule, sauf une zone scriptée (`camZones`) qui fait un virage de 90° définitif au coin du parcours. Mouvement relatif à la caméra.
- **Voies alternatives** : mur de lierre agrippable (`E`/Shift/clic droit), liane, passerelle haute, face extérieure agrippable de la cheminée → raccourcis de speedrun.
- **Obstacles** : rouleaux à pics horizontaux (axe x/z) ou verticaux (axe y), qui tournent et se déplacent (haut/bas, côté).
- **Glissade** (`C`/Ctrl, saut long en glissant, ramper sous un plafond bas) distincte du **wall-jump** (saut contre un mur lisse, enchaînable à la Transformice) et de l'**escalade**.
- **Edge-climb** généreux : se hisse seul si le rebord est entre 0,5 m et 2,3 m au-dessus des pieds, en montant ou en descendant.
- **Inertie aérienne** : vitesse conservée, virage progressif mais toujours rattrapable ; pas de blocage de contrôle long après un wall-jump.
- **Plateformes** : textures procédurales (pierre, brique, bois, mousse, lierre, métal), formes variées (dalles chanfreinées, ponts-poutres à contreforts, piliers à anneaux).
