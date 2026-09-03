# Intégrer Poker Loult sur un autre site (ex: loult.fr)

Le jeu est une page web autonome (`play.html` servi à la racine). Pas besoin d'un plugin ou d'un
framework côté site hôte — un simple lien qui ouvre une **fenêtre popup plus petite** suffit.

## Le principe

```html
<button onclick="window.open(
  'https://poker.loult.fr/',            /* l'URL où tourne le serveur Poker Loult */
  'pokerLoult',                          /* nom de fenêtre : réutilise la même popup si déjà ouverte */
  'width=1100,height=720,resizable=yes,scrollbars=no'
)">
  ♠ Jouer au Poker Loult
</button>
```

- `width`/`height` : le plateau est en 16:9 et se met à l'échelle automatiquement (`container-type:
  size` sur `#board`) — 1100×720 donne une fenêtre confortable pour jusqu'à 6 joueurs. Le jeu reste
  jouable plus petit (les boutons du bas passent en mode compact sous 560px de large).
- `resizable=yes` : laisse le joueur agrandir s'il veut plus de place.
- Le nom de fenêtre (`'pokerLoult'`) évite d'ouvrir 10 popups si le joueur clique plusieurs fois —
  le navigateur réutilise la fenêtre existante et la remet au premier plan.

## Exemple complet, prêt à copier

Voir [`embed-example.html`](embed-example.html) : une page autonome avec le bouton ci-dessus, à
adapter (changer juste l'URL) et coller sur loult.fr.

## Ce qu'il faut côté hébergement

Le jeu doit tourner quelque part en HTTPS avec un nom de domaine stable (`poker.loult.fr` par
exemple) — aujourd'hui il tourne en local + tunnel Cloudflare, ce qui **change de lien à chaque
redémarrage**. Pour une vraie intégration permanente sur loult.fr, il faut :

1. Un hébergement où le processus Node (`server/server.js`) tourne en continu (VPS, ou même une
   petite instance chez n'importe quel hébergeur — le serveur est zéro-dépendance, `node
   server/server.js` suffit, pas de build).
2. Un sous-domaine pointant dessus (ex: `poker.loult.fr`) avec un reverse-proxy HTTPS (le WebSocket
   doit passer en `wss://` derrière HTTPS, pas de config spéciale côté jeu — il détecte déjà le
   protocole automatiquement via `location.protocol`).
3. Remplacer l'URL dans le bouton ci-dessus par celle-là.

C'est le point n°2 de la feuille de route dans `CLAUDE.md` ("Déploiement permanent") — pas encore
fait, la partie actuelle tourne sur un tunnel temporaire.

## Alternative : iframe plutôt que popup

Une iframe intégrée directement dans une page loult.fr fonctionnerait aussi (le jeu n'a pas de
restriction anti-iframe), mais une popup est recommandée ici : le jeu a son propre son/musique et
ses propres raccourcis clavier — une fenêtre séparée évite les conflits avec le reste du site et
donne au joueur une vraie table dédiée, comme un vrai client de poker.
