# Reprise — Les Enchaînés (2026-10-17, soir)

Lire d'abord `CLAUDE.md` de ce dossier. NE PAS lancer de sessions parallèles (quota épuisé deux fois à cause de ça).

## Déjà en ligne (loultparty.fr/enchaines, commits `eda8ed8` et `5f139af` sur master, non poussés)
9 parcours publiés ; correctifs chaîne (plus d'envol, traction V seulement si le partenaire est en l'air, chaîne qui se redonne,
rendu lissé + visible à travers le décor) ; mode test solo (`?pt=CLÉ&solo` ou F9) ; piège rotatif de la tour ralenti ; sons de chaîne
réels (assets/sfx/chain) ; totems (client/totems.js) ; ambiance et décor composé de la tour (kit.deco + client/decor.js).

## Fait mais PAS vérifié, PAS commité, PAS déployé
1. **Sauts avec la voix du propriétaire** : `assets/sfx/voice/jump_1..3.mp3` (découpés de Downloads/3soundofjumps.wav), tirés au hasard
   sans répétition (`Sfx.jump` dans client/sfx.js, appelé dans main.js `case 'jump'`).
2. **Chat texte + vocal en ligne** :
   - server.js : messages `chat` (140 car., nettoyé, 1 message / 0,6 s, diffusé au salon) et `rtc` (relais de la négociation WebRTC
     vers l'autre grimpeur).
   - client/voice.js (nouveau) : WebRTC direct entre les 2 grimpeurs, STUN Google, négociation « parfaite » (grimpeur 2 poli),
     micro demandé seulement au clic, pastille « qui parle » sur l'étiquette.
   - main.js : Entrée = écrire (en ligne), M = micro, bouton #mic ; démarrage du vocal quand le salon a 2 grimpeurs, arrêt en partant.
   - index.html : bloc `#chat` ; style.css : section « chat du salon » à la fin.
   - server.test.js : test chat/rtc ajouté. `npm test` était EN COURS (dépassait 2 min) quand le quota a lâché : résultat inconnu.
3. **Travail des 7 sessions de monde après `5f139af`** (jungle, japan, deep, sky, mech, ice, summit) : elles ont été ARRÊTÉES en plein
   travail. Leurs fichiers (core/courses/<monde>.js, core/biomes/<monde>.js, client/worlds/<monde>.js, core/<monde>.test.js,
   entrées SPEC de client/totems.js et de client/themes.js) peuvent être à moitié modifiés.

## À faire, dans l'ordre
1. `npm test` (en arrière-plan, c'est long) puis `for c in tour remparts canopee torii mine iles horloge col toit; do COURSE=$c NOHIT=1 node tools/route.mjs | tail -1; done`.
   Si un monde casse : c'est une session arrêtée ; corriger dans SES fichiers (ou remettre la version commitée : `git -C D:/LOULTPOKER diff -- enchaines/<fichier>`).
2. Redémarrer le serveur de dev (server.js a changé : launch.json « enchaines », port 8807), tester le chat à deux onglets
   (Browser pane : sessionStorage par onglet), le vocal avec `__ch` ... `G.fakeMic = true` n'est pas exposé : tester `Voice` via
   `await import('/client/voice.js')` ou exposer `G.fakeMic` ; vérifier `pc.connectionState === 'connected'`. Tester les sauts (son).
3. `git add enchaines && git commit` (master, dossier enchaines seulement), puis `bash tools/deploy.sh` et vérifier les md5 en prod.
4. Reste demandé par le propriétaire (non fait) : difficulté crescendo, décor composé, totems et ambiance pour les 7 autres mondes
   (comme pour la tour) — à faire monde par monde, DANS UNE SEULE session.
