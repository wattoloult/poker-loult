# POKER LOULT

Jeu de poker **Texas Hold'em No-Limit, tournoi, multijoueur EN LIGNE, 6 joueurs max**, thème Pokémon/Loult (Métamorph, Ronflex croupier). Faux argent.

> ⚠️ Le nom est **POKER LOULT** partout (UI, code, textes).
> UI en **français**. Serveur = **source de vérité** (le client n'a aucune autorité).
> Zéro dépendance npm (serveur HTTP+WS écrit à la main, client vanilla JS/CSS/HTML).

---

## Lancer / tester

```bash
node server/server.js          # serveur HTTP+WS sur http://localhost:8770
```
Puis ouvrir **http://localhost:8770/** (le serveur sert avec `Cache-Control: no-cache` → pas besoin de vider le cache après une modif client).

Une room publique **permanente** existe dès le démarrage (code `LOULT`, "Table de Loult") : pas besoin de cliquer "Créer une room" pour jouer entre amis, elle apparaît direct dans le lobby.

```bash
node server/test-engine.js            # 54 tests du moteur
node server/test-room.js              # 15 tests du contrôleur de salle (horloge virtuelle)
node server/smoke-ws.js               # 7 checks du transport WS (serveur doit tourner)
node server/test_conservation.js      # jetons constants sur une longue partie à 6
node server/test_avatar_pool.js       # choix hôte Pokémon/Personnalités, avatars uniques
node server/test_ready_flow.js        # auto-lancement "tout le monde prêt"
node server/test_action_seq.js        # seq d'action globale (pas de collision entre mains)
node server/test_headsup_allin_blind. js  # SB tapis sur la blinde en head's-up ne bloque plus la main
node server/test_elimination_reveal.js    # cartes du perdant révélées, pas de fantôme main suivante
node test_eval.js                     # 29 tests de l'évaluateur
node test_eval_differential.js        # 50k mains : les 2 évaluateurs (rank5/evalMade) toujours d'accord
node test_chen_score.js               # formule de Chen (force main de départ) vs exemples fournis
node test_outs.js                     # 5 tests des outs (tirages)
node test_equity_live.js              # 3 tests du recalcul temps réel du % de win
node test_allin_stale.js              # plus de fausse bannière ALL IN sur un joueur éliminé
node test_showdown_reveal.js          # cartes exposées au snapshot à l'abattage normal
```
Tout doit être vert après toute modif du moteur/salle/snapshot. `server/test-room.js` peut être flaky sur le tapis final (RNG bots) — relancer avant de conclure à une régression.

**Dev notes (Windows)** :
- Tuer le serveur : `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Select ProcessId,CommandLine"` puis `Stop-Process -Id <pid> -Force`.
- Tester **2 humains sur 1 machine** : le token est en `localStorage` (partagé entre onglets même origine) → fenêtre normale + navigation privée, ou 2 navigateurs différents.
- Le volet navigateur intégré (Browser pane) est fiable pour le lobby/menus mais **flaky pour le direct multi-joueurs temps réel** (WS + bots qui jouent en continu) — pour vérifier une logique précise, injecter un snapshot synthétique via `javascript_tool` (`renderGame(fakeSnap)`) plutôt que d'attendre une vraie main.
- **Toute modif de `server/*.js` exige un redémarrage du serveur** (état des tables en mémoire, perdu au redémarrage). Modifs `play.js`/`.css`/`.html`/`poker-eval.js`/`sfx.js` = juste recharger la page.

---

## Architecture (couches, du pur au réseau)

```
poker-eval.js            Logique PURE des mains (UMD : Node + navigateur). Aucun DOM/réseau.
                          Inclut chenScore() (force main de départ, formule de Chen).
server/poker-engine.js   MOTEUR AUTORITAIRE : machine à états d'une table de tournoi.
                          Aucun timer réel — reçoit `now` (ms). Valide CHAQUE action.
server/room.js           Contrôleur de salle : enveloppe le moteur, possède les VRAIS timers
                          (action/niveau/pauses inter-mains), bots (IA serveur), boucle des
                          mains, join/reconnexion, système "prêt" (ready). `scheduler`
                          INJECTABLE (setTimeout/clearTimeout/now) → testable, horloge virtuelle.
server/server.js         HTTP statique + WebSocket ZÉRO DÉPENDANCE (handshake sha1+GUID,
                          framing masqué à la main). Registre MULTI-ROOMS + room permanente +
                          purge auto des rooms abandonnées/terminées.
play.html/.css/.js       CLIENT MINCE : reçoit l'état, dessine, envoie des intentions. Aucune
                          logique de jeu (sauf calculs d'AFFICHAGE côté client — force de main,
                          Chen Score, ordre de révélation — jamais le départage réel du pot).
                          Charge poker-eval.js (window.PokerEval) + sfx.js.
sfx.js                   SFX synthétisés Web Audio (deal/flip/chip/check/win/tick/slap/tension)
                          + layer fichiers réels optionnel (sfx/*.mp3|wav remplacent la synthèse
                          quand présents, voir FILE_SRC).
```

### Moteur (`poker-engine.js`) — points clés
- API : `createTable(config, shuffle)`, `addPlayer`, `startHand(t, now)`, `legalActions(t, seat)`,
  `applyAction(t, seat, {type, amount}, now)`, `timeoutCurrent(t, now)`, `snapshot(t, viewerSeat)`.
- Actions : `fold | check | call | raise | allin` (allin = raccourci → raise total ou call tapis).
  Pour `raise`, `amount` = mise TOTALE visée sur la street.
- Règles correctes : min-raise auto, **relance incomplète all-in qui NE rouvre PAS l'enchère**
  (`actedSinceRaise`), option BB préflop, heads-up (bouton=SB parle 1er préflop, dernier post-flop),
  **side pots** (`buildPots`, affichés côté client s'il y en a plus d'un), égalités → partage (jeton
  restant = 1er gagnant à gauche du bouton), élimination (stack 0 → `status='eliminated'`), victoire
  tournoi (`phase='tournamentOver'`).
- `startActing(t, seat, now)` : point d'entrée du 1er joueur à parler sur une street. Si ce joueur
  ne peut plus agir (ex: SB tapis en la postant, en head's-up), saute au suivant qui le peut, ou
  déroule direct le board jusqu'au showdown si PERSONNE ne peut agir — sinon la main restait bloquée
  à vie (bug réel corrigé, voir `test_headsup_allin_blind.js`).
- `finishHand()` : met `status='eliminated'` sur stack 0, mais **NE TOUCHE PAS `inHand`** (sinon le
  snapshot fait disparaître les cartes du perdant au lieu de les révéler à l'abattage). `inHand` des
  non-actifs est remis à `false` au **début de la main suivante** dans `startHand()`, pas avant
  (sinon un éliminé reste compté "dans le coup" et peut se voir attribuer un pot par erreur — bug
  réel corrigé, voir `test_elimination_reveal.js`).
- **snapshot rédigé par siège** : `hole` du viewer visible ; autres = `[null,null]` en jeu,
  révélées au showdown si `!folded || showing` (cf. SHOW) ; `[]` si pas dans la main. `board` public.
  Contient aussi `lastAction {seat,type,seq}` (seq **GLOBAL À LA TABLE**, jamais remis à zéro à
  chaque main — sinon collision possible avec la dernière valeur connue du client, action ignorée
  en silence) et `lastAggressor` (dernier à avoir misé/relancé, pour l'ordre de révélation côté
  client). `pot`=0 hors `phase==='playing'` (le détail des pots reste dans `pots`).

### Config par défaut (`poker-engine.js` `DEFAULT_CONFIG`)
- `startStack: 10000` (FIXE pour tous — PAS d'option de tapis).
- `levels` (14 paliers, **GLOBAL au temps**, pas par main) : 400/800 → 600/1200 → … → 40000/80000.
- `levelDuration: 120` s (2 min/niveau, différé à la MAIN SUIVANTE, jamais en milieu de main).
- `actionTime` : la valeur brute par défaut du moteur est `10`, mais **les deux points de création
  de room côté serveur (`server.js`, room permanente et `createRoom`) passent explicitement `15`** —
  c'est la vraie valeur en jeu, pas la constante du moteur.
- `maxPlayers: 6`.
- ⚠️ `server/test-engine.js` utilise `TEST_LEVELS` indépendants, pour rester stable si la
  progression de prod change — ne PAS synchroniser les deux.

### Salle (`room.js`)
- `createRoom(config, scheduler)`, `start`, `join` (takeover d'un bot), `handleAction`, `startGame`
  (comble avec `room.botCount` bots puis démarre), `removePlayer`, `isActive`, `setReady(room,
  token, bool)`, `subscribe(room, seatFn, fn)`, `roomSnapshot`. `hostStart` existe mais est **DU
  CODE MORT** (jamais appelé par le vrai flux — le vrai chemin de création est `createRoom` côté
  `server.js`, pas `hostStart`).
- **Système "prêt"** (`room.ready` Map token→bool) : chaque joueur assis se déclare prêt via
  `setReady`. Dès que TOUS les humains assis le sont (2 minimum), `maybeAutoStart` lance la partie
  automatiquement — pas besoin d'un hôte qui clique "Lancer la partie". Marche aussi pour relancer
  après un tournoi fini (pas d'hôte requis). `room.ready` est vidé à chaque `start()` (repart à zéro
  pour la revanche suivante). Le départ d'un joueur non-prêt peut suffire à compléter la condition
  pour ceux qui restent (`removePlayer` re-vérifie).
- Le bouton "Lancer la partie" (hôte-only, `startGame` côté message serveur) reste utilisable EN
  PLUS du système prêt — utile pour un hôte solo qui veut démarrer avec des bots sans attendre un
  2e humain prêt (le système prêt exige 2 humains minimum).
- Bots serveur : `botDecide` (force de main via bestHand + variance + bluff 6%). Délai 1.4–3 s
  ("tempo humain", pas instantané).
- Pauses inter-mains **calibrées sur ce qu'il y a réellement à montrer** : 2.5 s après un gain par
  fold (rien à révéler), 5 s après un abattage SANS tapis (board déjà complet, rien de neuf à
  retourner), 9 s après un abattage APRÈS un tapis (le client déroule les cartes restantes à 1s
  chacune + il faut le temps de cliquer SHOW). Détecté via `hand.equity` (calculée uniquement dans
  le cas "tapis général", signal gratuit et fiable).

### Serveur multi-rooms (`server.js`)
- `rooms` Map(code→{ctrl, meta}), `playerRoom` Map(token→code) pour reconnexion, `lobbyConns` Set,
  `allConns` Set (pour le chat).
- **Room permanente** (`DEFAULT_ROOM_CODE='LOULT'`, `meta.permanent=true`) créée une fois au
  démarrage (`ensureDefaultRoom`), jamais supprimée automatiquement, `hostToken:null` (personne
  n'est hôte → passe forcément par le système "prêt" pour démarrer/relancer).
- **Purge automatique des rooms mortes** (2 mécanismes distincts, tous deux réels bugs corrigés en
  jeu réel) :
  - `scheduleAbandonedCleanup` (`ABANDONED_ROOM_MS=2min`) : room EN JEU dont TOUS les humains sont
    déconnectés → supprimée si personne ne revient. Sans ça, un client qui ferme l'onglet sans
    cliquer "Quitter" bloquait le code + la liste publique pour toujours.
  - `watchRoomLifecycle` (`OVER_ROOM_MS=3min`) : room dont le TOURNOI EST FINI (`tournamentOver`)
    → supprimée après ce délai, INDÉPENDAMMENT de la connexion. Sans ça, un onglet resté ouvert sur
    l'écran de victoire (ou en arrière-plan sur mobile) ne se déconnecte jamais vraiment → la room
    reste affichée "en cours"/"terminée" indéfiniment dans le lobby public.
  - Les deux mécanismes **ignorent la room permanente**.
- Messages client→serveur : `listRooms`, `createRoom {name,isPrivate,password,bots,avatarKind,pseudo}`,
  `joinRoom {code,password,pseudo}`, `leaveRoom`, `setBots {bots}`, `startGame`, `newGame`,
  `toggleReady {ready}`, `action {action}`, `show {card}`, `emote {emote,target}`, `chat {i}`.
- Serveur→client : `hello {token}`, `rooms {rooms}`, `joined {code,you}`, `state {snap}` (snap.room
  contient code/name/isPrivate/locked/status/host/bots/humans/readyCount/youReady ; snap.seats[].ready),
  `error {msg}`, `left`, `emote {seat,emote,target}`, `chat {seat,text}`.
- Rooms privées non listées (join par code). Mot de passe optionnel.
- Reconnexion : au connect, si `playerRoom[token]` pointe une room active → re-enter auto.

### Client (`play.js`)
- Écrans : `landing` (accueil, logo, JOUER, lien "Jamais joué au poker ?") → `lobby` (liste rooms,
  créer, rejoindre par code) → `create` (nom, public/privé, mot de passe, bots 0-5, avatars
  Pokémon/Personnalités) → `waiting` (code à partager, joueurs, bouton PRÊT + hôte règle bots +
  Lancer) → `game`. `showScreen(name)`. `body.is-host` gate les contrôles hôte.
- **Panneau de règles** (`#rules-modal`, 3 onglets Le but / Les coups / Les mains) — accessible du
  bouton "?" en jeu ET du lien sur l'accueil. Ne se ferme pas tout seul entre deux mains.
- `renderGame(snap)` : sièges, board, pot (+ side pots si >1), contrôles, main faite/force.
- **Disposition sièges** : `SEAT_SLOTS = {2:[0,4],3:[0,3,4],4:[0,2,3,4],5:[0,2,3,4,5],6:[0..5]}`,
  viewer TOUJOURS en bas. Bulles de chat des sièges du HAUT (`pos-3`/`pos-4`) affichées sur le CÔTÉ
  (pas au-dessus, invisible sinon hors du plateau).
- **2 timers** : anneau conic-gradient autour du siège actif + bandeau NIVEAU/SB-BB/mm:ss. Sync
  `timeOffset = snap.now - Date.now()`.
- **Système de force des mains** (`updateMyHandInfo`) — affiché SOUS tes propres cartes uniquement
  (jamais pour un adversaire, garde-fou explicite qui masque `.hand-label` sur tous les autres
  sièges à chaque appel — bug réel corrigé : sans ça, un changement de siège d'une partie à l'autre
  laissait une ANCIENNE main affichée sur le DOM du siège désormais occupé par quelqu'un d'autre) :
  - **Préflop** (`board.length===0` sur ce qui est VISUELLEMENT révélé) : boîte "MAIN DE DÉPART" +
    cartes + **Chen Score** (`EV.chenScore`, formule EXACTE fournie par le user, PAS la formule
    "classique" avec bonus connecteur — omis volontairement).
  - **Post-flop** : catégorie en toutes lettres + **rang 1-10** (`cat interne 0-9 + 1`) + détail
    textuel (`handDetail` : "Roi et 4" pour une double paire, "Quinte hauteur 5" pour la roue A-2-3-
    4-5, "Rois par les 4" pour un full) + **Force** (plus haut rang réellement impliqué dans la main
    — distingue Paire de 4 de Paire d'As au sein d'une même catégorie ; PUREMENT un affichage, le
    départage RÉEL du pot reste `EV.cmp` côté moteur, jamais touché).
  - ⚠️ **Évalué sur `revealedBoardLen` (cartes VISUELLEMENT révélées), jamais sur `s.board` brut** :
    au tapis général le serveur envoie le board complet (5 cartes) d'un coup mais le client les
    révèle une par une animées — évaluer sur les données brutes affichait le résultat final
    (ex: "Paire de Rois") AVANT que la carte décisive soit visible à l'écran (bug réel corrigé,
    spoiler direct). Même compteur que celui déjà utilisé pour le badge % de victoire.
- **Révélation du board carte par carte** (`renderCommunity`) : ~1s d'écart entre chaque carte.
  **Ralenti sur la carte décisive** (`detectDecisiveRiver`) : si la river change qui MÈNE la main
  (comparé aux 4 premières cartes, via `EV.bestHand`, pas l'équité probabiliste), +1.6s de pause,
  plateau assombri (`#board.suspense`), son grave descendant (`SFX.tension`, synthétisé), croupier
  annonce "Sur la river…". Purement cosmétique, ne touche à aucune règle.
- **Révélation des mains à l'abattage** dans l'ORDRE RÉEL du poker (`showdownOrder`) : le dernier
  agresseur (`s.lastAggressor`) retourne en premier, puis sens horaire (pas simultané pour tout le
  monde). `winnerRevealAt` est étendu pour couvrir ce délai en plus de la révélation du board, sinon
  le bandeau WINNER pouvait apparaître avant que tout le monde ait montré ses cartes.
- **Équité / % de win recalculée EN TEMPS RÉEL** : `equityAt()`/`repaintEquity()` recalculent le
  badge `.eq-badge` à chaque carte du board VISUELLEMENT révélée. Énumération EXACTE quand il reste
  peu de cartes (flop/turn/river), Monte-Carlo léger au préflop.
- **OUTS** : `#outs-box` posé dans le prochain emplacement vide du board.
- **Fold/muck** : cartes jetées vers le board + grisées ; tag rouge "✕ FOLD". Check → tag bleu
  "✓ CHECK". **Annonce du croupier après un call/relance** ("X a misé Y" / "Tu as misé Y"), sauf
  grosse relance ≥2× la blinde qui garde son "Wow !" dédié — les deux ne se marchent pas dessus
  (`betAnnouncedUntil` étend le délai avant que "Au tour de X" ne remplace la bulle).
- **SHOW par carte** : 2 boutons indépendants, un par carte.
- **Suspense d'élimination** : un joueur éliminé PENDANT la main en cours ne s'affiche grisé/
  "Éliminé" qu'une fois la révélation du board VISUELLEMENT terminée (`revealedEliminated`), sinon
  le badge spoile le résultat avant même l'abattage.
- **Avatars** : deux pools au choix de l'hôte à la création de la room (`avatarKind`) —
  - `pokemon` (par défaut) : 151 sprites PokeAPI (`avatars/p1.png`..`p151.png`), aléatoire mais
    unique par table.
  - `people` : **204 portraits RÉELS de personnalités publiques** téléchargés depuis Wikipedia/
    Wikimedia Commons (`avatars/people/*.jpg` + `manifest.json`), scripts `scripts/fetch_people.py`
    (source des noms) — PAS de génération d'images, uniquement des photos déjà publiées. Liste
    volontairement variée (scientifiques, écrivains, chefs d'État historiques et actuels, artistes,
    athlètes…). ⚠️ **Aucune personnalité associée à des crimes graves n'y figure, exclu par choix
    délibéré, pas un oubli** — ne pas en rajouter sans y repenser.
  - `avatarImgSrc(p)` choisit le bon chemin selon `p.avatarKind`. Rendu CSS différent (`object-fit:
    cover` pour les vraies photos vs `contain`+pixelated pour les sprites Pokémon).
- **Pod joueur** (de haut en bas) : rang 1er/2e/3e + point de statut → avatar → cartes DEVANT →
  combinaison/force → tapis formaté (`fmtK`).
- **Distribution animée** (`dealAnimation`) : ~3s au total, étalée carte par carte.
- **Emotes** (17, menu `#emote-menu`, `TARGETED_EMOTES` = pistolet/baffe nécessitent une cible) :
  cigare, café, pistolet (tire sur un joueur, rotation dynamique vers la cible), baffe (main qui
  traverse jusqu'à la cible, marque "BLUFF ?" rouge), gossip (main qui papote, pas de cible), + 12
  réactions Watto (emote_w-*.png). Sprite sheets sources dans `assets/_sources/` (jamais chargées
  par le jeu), frames découpées dans `assets/*_frames.png` par les scripts `scripts/slice_*.py`.
  ⚠️ **Chaque nouvelle emote DOIT être ajoutée à `VALID_EMOTES` dans `server.js`**, sinon le serveur
  la rejette en silence (bug réel vécu avec l'emote gossip — animation prête côté client, serveur
  bloquait l'envoi sans message d'erreur).
- **Musique** : `titlescreen.mp3` (écran de titre) / `songmenu.mp3` (lobby/création/attente),
  bascule automatique selon l'écran (`MENU_MUSIC`), démarre à la toute première interaction sur la
  page (clic/touche/clavier, pas seulement le bouton JOUER — l'autoplay est bloqué avant tout geste
  utilisateur). `titlescreen.mp3` saute directement à 3s (silence de tête sur l'enregistrement).
  Fichiers réencodés mono 64-96kbps (24,7 Mo → 8,8 Mo à eux deux) ; originaux dans
  `sfx/_originaux/` si besoin de reprendre depuis la source.
- **Pas de barre de défilement visible nulle part** (écrans/panneaux/menus) : contenu scrollable
  à la molette/tactile, juste sans le rail natif du navigateur (`*{scrollbar-width:none}` +
  `*::-webkit-scrollbar{width:0}`).

---

## Assets

- `assets/` — images utilisées par le jeu (logo, plateau, cartes, jetons, croupier, avatars people,
  emote_*_frames.png…). `assets/_sources/` = planches SOURCES non découpées, jamais chargées par le
  client (ne PAS les remettre à la racine d'`assets/`, elles gonflent le poids pour rien).
- `avatars/` — 151 sprites Pokémon (`p1.png`..`p151.png`) + `avatars/people/` (204 portraits réels +
  `manifest.json`).
- `cards/` — 52 cartes découpées (`hA`, `s10`, `c2`, `dK`… = suit+rang).
- `sfx/` — tous les fichiers audio réels. `sfx/_originaux/` = versions non réencodées de la musique,
  gardées au cas où.
- `scripts/` — outils Python de découpe de sprite sheets (`slice_*.py`, `scipy.ndimage` pour la
  détection par composantes connexes) + `fetch_people.py` (téléchargement des portraits
  Wikipedia). Chemins internes en `../assets/...` (les scripts s'exécutent depuis `scripts/`).
- ⚠️ **Copyright** : sprites Pokémon = OK pour un projet fan/personnel, PAS pour commercialisation.
  Portraits "Personnalités" = photos publiées sur Wikipedia/Commons, pas générées.

---

## Style / conventions

- **Design** : violet/or casino + Ditto ("Métamorph") comme mascotte du logo. Police d'affichage
  **Bebas Neue** (titres), corps de texte **Nunito** (Google Fonts, remplace l'ancien Trebuchet
  système — c'était le détail qui faisait "gabarit générique"). Panneaux : dégradé + grain de feutre
  CSS (pas d'asset), liseré or fin, filigrane de symbole de carte géant très discret en coin
  (casse la silhouette "rectangle plat centré").
- Tout dimensionné en unités de conteneur (`cqw`) sur le plateau de jeu → scale avec la table
  (`#board container-type:size`). Barre du bas responsive sous 560px (boutons réduits, menus
  contraints à la largeur d'écran — sinon ils débordent sur mobile).
- Ambiance "poker feutré" : cadres pseudos `.plate` sombres + liseré bronze/or (pas de néon vif).
- `fitBoard()` : plateau 16:9, prend toute la hauteur, `#bottombar` en `position:fixed` par-dessus.

---

## Déploiement / partage

- Serveur Node zéro-dépendance, tourne en local (`node server/server.js`, port 8770 par défaut).
- Pour jouer à distance sans VPS : tunnel **Cloudflare** (`cloudflared tunnel --url
  http://localhost:8770`), PAS ngrok — ngrok gratuit affiche un écran d'avertissement qui **révèle
  l'IP réelle de la machine d'origine** aux visiteurs (vérifié en conditions réelles, IP résidentielle
  confirmée via un lookup). Cloudflare ne montre aucun écran et ne révèle jamais l'IP d'origine.
  Le lien change à chaque redémarrage du tunnel (pas de compte Cloudflare configuré) — pour un lien
  fixe, il faudrait un tunnel nommé sur un compte Cloudflare.
- Objectif à terme : intégration sur **loult.fr** (site d'un ami), probablement via une fenêtre
  popup plus petite plutôt qu'en pleine page — voir `EMBED.md` si présent pour l'exemple
  d'intégration.

---

## Tests / vérif (toujours laisser un check runnable)

Voir la liste complète en haut de ce fichier ("Lancer / tester"). Après une modif du moteur/salle,
relancer au minimum `test-engine.js` + `test-room.js` + `test_conservation.js` (jetons) +
`test_eval_differential.js` (si ça touche à l'évaluation des mains). Chaque bug réel trouvé en jeu
a son test dédié qui reproduit le scénario exact — s'en inspirer pour tout nouveau bug plutôt que
de patcher sans preuve que ça ne reviendra pas.

---

## Feuille de route (prochains gros morceaux, par ordre d'impact perçu)

1. **Persistance** (le plus gros manque) : comptes + jetons sauvegardés + serveur qui tourne 24/7.
   Aujourd'hui tout est EN MÉMOIRE → un redémarrage serveur efface toutes les parties en cours.
2. **Déploiement permanent** (VPS ou hébergement, lien fixe) pour ne plus dépendre d'un tunnel qui
   change à chaque redémarrage et d'une machine perso qui doit rester allumée.
3. **Annonceur vocal** : nécessite des fichiers audio (voix) fournis par le user, ou la synthèse
   vocale du navigateur (compromis qualité) — pas encore tranché.
4. **Pré-actions** (cocher fold / check-call / fold-to-any pendant qu'on attend son tour) — déjà
   partiellement présent (`preAction`/`resolvePreAction`), vérifier la couverture complète.
5. **Rabbit hunt**.
6. Passe de direction artistique plus poussée sur la TABLE de jeu elle-même (le menu/lobby a déjà
   eu sa passe : Nunito, feutre, filigrane — la table de jeu (plateau/sièges) pas encore touchée).

---

## Ce qu'il NE faut PAS faire

- Renommer le jeu (reste POKER LOULT). Refaire le design sans y avoir été invité. Laisser le client
  décider stack/pot/tour/résultat — le serveur reste TOUJOURS la source de vérité, même pour de
  l'affichage informatif (force de main, Chen Score) : ces calculs sont client-side par simplicité
  MAIS s'appuient uniquement sur des données déjà authentifiées par le serveur (les propres cartes
  du viewer), jamais sur une donnée qu'il faudrait faire confiance au client d'inventer.
- Augmenter les blindes en pleine main ou à chaque main (uniquement à la fin du niveau, main suivante).
- Check auto si une mise est due (doit toujours FOLD dans ce cas, y compris à l'AFK/timeout — pas de
  "check auto si légal", règle explicitement abandonnée sur demande du user).
- Ignorer side pots / égalités / all-ins / l'ordre réel de révélation à l'abattage.
- Ajouter du son ou changer le design sans y avoir été invité.
- **Ajouter une nouvelle personnalité au pool "Personnalités"** sans réfléchir à qui c'est : pas de
  personne associée à des crimes graves, pas de génération d'images (uniquement des photos déjà
  publiées sur Wikipedia/Commons).
- **Ajouter une emote côté client sans l'ajouter aussi à `VALID_EMOTES` côté serveur** (`server.js`)
  — sinon elle est rejetée en silence, aucun message d'erreur.
