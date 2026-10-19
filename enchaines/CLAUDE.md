# LES ENCHAÎNÉS — jeu de grimpette coopératif (2 joueurs reliés par une chaîne)

Inspiré de *Chained Together*. 8 mondes. Médiéval : « La Tour de Loult » (publié) + « Les Remparts » (en test, mécanismes du château) ; 1 parcours en test pour chacun des 7 autres mondes.
En ligne sur **loultparty.fr/enchaines/** (service `enchaines-mm`, port **8807**, route Caddy `/enchaines-ws*`).
UI et textes en **français**. Ne jamais déployer les `.md` (le serveur poker sert tout `/opt/poker-loult/`).

## Lancer / tester
- Dev : launch.json `enchaines` (`node server.js`, `PORT=8807`, `ENCH_DEV=1` sert aussi les fichiers, `ENCH_PT_KEY=dev-test`) → http://localhost:8807/
- `?local` = partie à deux sur un clavier ; `?debug` ou F3 = collisions (vert escaladable, rouge frappe, orange friable) + états ; `?pt=CLÉ` = mode test.
- `npm test` = 32 tests : `core/sim.test.js` (physique, sauvetage, « tirer » la chaîne, zone 6), `core/mech.test.js` (vent, tremplin, plaques + herse, levier, contrepoids,
  liane, barres, roue), `core/coop.test.js` (scénarios à deux sur les VRAIS parcours : 3 contrepoids + herse), `server.test.js` (salon, entrées, fin + classement, reconnexion).
- `COURSE=<id> node tools/route.mjs` = un robot vérifie chaque étape du parcours, seul, avec la vraie physique (lianes, barres, leviers, courants
  ascendants, rafales, surplombs gérés). `NOHIT=1` sans obstacles qui frappent, `FORCE=1` teste aussi les étapes `coop`, un numéro = détail.
  **À relancer après toute modif d'un parcours ou des constantes `P`.** Ids : tour, canopee, torii, mine, iles, horloge, col, toit.
- Navigateur : `__ch.play('id')` lance un parcours en local, `__ch.tp(i)` téléporte au point de passage i, `S.debugCam = {pos, look}` caméra libre.
  Le pane met les modules en cache : `fetch(url, {cache:'reload'})` avant `location.reload()`. L'audio exige un vrai clic (computer left_click).

## Architecture
```
core/sim.js        PHYSIQUE PURE déterministe (120 pas/s), partagée serveur/client : grimpeurs (sol, air, rebord, paroi, hisse, liane),
                   chaîne (nœuds PBD + poulie sur le chemin TENDU), mécanismes (voir kit.js), points de passage, anti-chute (mode test).
core/kit.js        Kit de construction : plat/block/cp/hint/rope/wind/cam/bridge/bars + liste des drapeaux de mécanismes. Aucune logique.
core/courses/*.js  UN FICHIER PAR PARCOURS (données seules) ; core/worlds.js = registre (WORLDS, COURSES, published).
server.js          Salons de 2 (+ spectateurs), autorité, file d'entrées, instantanés 30/s, reprise par jeton, classement PAR PARCOURS
                   (DATA_DIR/best.json, message `board {course}`), parcours non publiés réservés aux clients authentifiés en test.
client/main.js     Écrans (choix du parcours, médailles et records locaux), commandes, boucle, en ligne (prédiction + rejeu), crochets du mode test.
client/scene.js    Rendu général : ciel/nuages/crêtes (teintables), rôdeurs + IK, chaîne, effets, caméra par zones (side/three/behind/far/tunnel).
client/levelview.js Vue du parcours : matériaux du monde, toile de fond (gorge, vallée, caverne, ciel ouvert, machinerie), décor par monde,
                   rendu des mécanismes (lianes, plaques, leviers, herses, contrepoids, roue, engrenages, vent, cascades), particules.
client/themes.js   Identité de chaque monde (ciel, soleil, brume, roche, matériaux abstraits -> textures, particules).
client/mechs.js    Herses / portes / pilons, ponts-levis, treuils de contrepoids : modèles (Kenney, assets/castle), chaînes, et SONS déduits
                   de l'état de la sim image par image (verrou, alerte, chaîne, treuil, chute, impact, claquement final).
client/sfx.js      Sons ENREGISTRÉS spatialisés (assets/sfx) : one() ponctuel, voice() boucle en fondu ; auditeur = caméra ; muet au-delà de 45 m.
client/portal.js   Portail de fin (arche + voile à la couleur du monde suivant) ; main.js : bouton « Franchir le portail » -> parcours suivant
                   (nextCourse dans worlds.js ; en ligne, message 'next' de l'hôte).
client/music.js    Musique + ambiance par monde, fondus de 2,5 s, chemins configurables (TRACKS). client/audio.js = bruitages synthétisés.
playtest/playtest.js MODULE DE TEST PRIVÉ (jamais servi en fichier) : panneau F9, tous les parcours, points de passage, IA du partenaire,
                   Tab = échanger les grimpeurs, T téléporter le partenaire, J le faire sauter, K le figer arc-bouté, anti-chute, ralenti, infos.
```
## Speedrun solo (menu « Speedrun solo »)
- Un grimpeur sans chaîne (`W.alone` : second saut en l'air, une plaque suffit, contrepoids adaptés) ; chrono au premier mouvement ; Suppr = recommencer.
- Le client enregistre chaque pas d'entrée (`G.run`, séries identiques, entrées arrondies comme en ligne) ; à l'arrivée, POST `/enchaines-ws/solo` :
  le serveur REJOUE la partie dans un worker (`core/replay.js`, ~1 s pour 5 min) et ne classe que si le sommet est atteint (`best.json`, clé `solo:<id>`,
  un temps par pseudo). Temps de passage par point de passage comparés au record de l'appareil (`ch-best-solo`). Records : case « Speedrun solo ».
- `ALONE=1 COURSE=<id> node tools/route.mjs` : le robot joue en solo (étapes coop comprises, avec second saut). Échecs restants = mécanismes que le
  robot ne sait pas actionner (plaques, ballons, fleurs-ressorts, dalles), couverts par les tests de chaque monde.
- Tout ce qui change la physique hors entrées (téléportation, anti-chute du mode test) rend la montée invalide pour le serveur : normal.

## Ajouter un parcours
1. `core/courses/<id>.js` avec `course({ id, world, name, short, diff, published: false, medals, backdrop })`, zones, `cp` (le dernier `finish: true`).
2. L'importer dans `core/worlds.js`. 3. `COURSE=<id> node tools/route.mjs` jusqu'à 0 échec ; scénario dans `core/coop.test.js` pour chaque étape `coop`.
4. Tester en mode test, puis `published: true` quand le propriétaire valide, et redéployer.

## Mode playtest privé
- Activation : le serveur doit avoir `ENCH_PT_KEY` (dev : `dev-test` ; prod : `/etc/enchaines.env`, créé par `tools/deploy.sh`, lien affiché à la fin du
  déploiement). Ouvrir `…/enchaines/?pt=CLÉ` : le client envoie la clé, le serveur (comparaison à temps constant) renvoie le module ; sinon refus.
- Le module n'est pas dans les fichiers servis (dev : dossier `playtest/` bloqué par le serveur ; prod : `/var/lib/enchaines/playtest.js`).
- Désactivation : vider `ENCH_PT_KEY` dans `/etc/enchaines.env` puis `systemctl restart enchaines-mm` (le serveur refuse tout) ; pour le retirer,
  supprimer aussi `/var/lib/enchaines/playtest.js`, le dossier `playtest/` et la ligne correspondante de `tools/deploy.sh`.
- Ne pas retirer avant que le propriétaire ait confirmé que tous les parcours sont bons.

## Herses, portes, pilons, ponts-levis (kit.herse / kit.drawbridge)
- herse(x, base, z, h, d, {mode: cycle|trigger|switch, look: iron|wood|stone, open, warn, fall: 'slam' | speed, hold, rise, ph, zone, lift, crush, start}) :
  phases W.hs (OPEN, WARN, FALL, SHUT, RISE), ouverture W.dr. Ne descend JAMAIS sur un grimpeur (s'arrête au-dessus de sa tête) ; crush = pilon qui
  rejette sur le côté. iron = grid : la chaîne passe entre les barreaux. Vue de côté, une herse se voit de profil : mettre un cam('three', yaw ~0.7).
- drawbridge(hx, top, z, len, d, {side, open: [leviers/plaques], stay, up}) : tronçons alignés qui suivent l'angle W.db[id].a (marches qui se
  redressent en mur) ; stay = se relève seul (le levier revient).
- Mode test (F9) : section Mécanismes (aller, ouvrir, fermer, déclencher, remonter, abaisser, réinitialiser) + état dans les infos.

## Physique : choix et pièges
- Chaîne : la force passe par une contrainte de poulie sur la longueur du chemin TENDU (bouts + maillons posés sur un bord) ; une chaîne qui pend a du mou
  (bug corrigé : la longueur des maillons valait toujours la longueur de chaîne, ce qui freinait les sauts).
- Contrepoids : bras de levier `k` (un grimpeur sur le plateau `k: 2` soulève l'autre) ; la corniche à atteindre est un MUR (pas une plateforme en
  surplomb : on se cogne la tête dessous). Course `d` ≤ 2,2 m sinon la chaîne retient celui qui monte.
- Barres : on traverse la barre qu'on vient de lâcher (`thru`) ; placer les barres ~2 m au-dessus du point de départ.
- Sur Windows, ne pas éditer ces fichiers avec un script Python qui contient `\n` ou `\'` (casse les chaînes JS) : Edit, sed, ou node.

## Mode libre (jusqu'à 4 grimpeurs, SANS chaîne) et tacle
- Salon créé avec `mode: 'free'` (menu « Libre · jusqu'à 4 » ; l'hôte peut le changer au salon avec `cfg {mode}`) : `createWorld({ free: true, players: n })` met `W.free = W.alone = true`
  (règles solo : une plaque suffit, second saut en l'air, pas de courte échelle) ; `W.ch = []`, pas de chaîne. Chaque grimpeur a SON point de passage (`p.cp`), SA réapparition
  (`respawnPlayer` : chute dans le vide ou R maintenu 0,5 s) ; `stepFree` dans sim.js. Premier arrivé = `W.rank[0]` (`p.done`, `p.finishT`) ; la partie finit quand tous ont fini, ou 2 min après le premier.
- Serveur (server.js) : `r.cfg.mode`, `MAXP = {coop: 2, free: 4}`, sièges contigus au départ, entrées/instantanés en tableaux de N ; message `end {free:1, rank}`. Pas de record enregistré, pas de chat vocal.
- Client : `G.free`, `G.seatIn[]` (entrées des autres, pour la prédiction), caméra qui suit SON grimpeur (le meneur pour un spectateur), classement en direct `#fstand`, étiquettes/jauge créées à la demande (`ensureHudEls`).
- Test : `node --test core/free.test.js` (sim) et `server.test.js` (salon à 3 en mode libre). Parcours : bots WebSocket + 1 navigateur (voir l'historique du dépôt).
- Glissade = TACLE : `P.SLIDE_*` (plus longue, boostée, virage presque figé, `SLIDE_REC` de récupération), capsule basse (`P.HS`) pendant la glissade (on passe sous les obstacles de moins de ~1 m),
  reptation (`p.crawl`) si on ne peut pas se relever sous un plafond bas, `tackleHit` fauche les grimpeurs DEBOUT au sol sur la trajectoire (un saut l'évite), recharge `TACKLE_CD`.
- Inertie en l'air : au-dessus de `AIR_MAX`, diriger FAIT TOURNER la vitesse (`AIR_TURN`, la norme est conservée). Second saut : n'est pas consommé quand le sol est tout proche (le saut tapé juste avant l'atterrissage part du sol).
- Visuels (client/scene.js, purement cosmétiques) : poussière (`dust`, couleur du sol), pose de tacle, salto au second saut (`startFlip`), accroché à un bord : buste droit, pieds qui pendent et se balancent, coup d'œil vers le bas.
- Caméra : AUCUNE collision avec le décor (elle traverse les murs) ; zone `turn` dans la Tour (coin de la 7e plateforme) qui pivote la vue à droite.

## Reste à faire / non vérifié
- Parcours non publiés (7) : à jouer par le propriétaire en mode test, puis `published: true`.
- Durées : les parcours font 20 à 38 étapes (≈ 4 à 10 min estimées), en dessous des 8-15 min visées : à allonger après retours de jeu.
- Musiques/ambiances choisies sans écoute ; bruitages encore synthétisés ; commandes tactiles absentes ; IA du partenaire basique (suit, saute, tient).
