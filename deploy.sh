#!/usr/bin/env bash
# Déploie le dossier enchaines/ sur le VPS (LumaDock). À lancer DEPUIS TA MACHINE, à la racine du dépôt.
#   ./deploy.sh                       # utilise les valeurs par défaut ci-dessous
#   REMOTE_DIR=/var/www/site ./deploy.sh
# Aucun mot de passe n'est écrit ici : ssh le demande (ou utilise ta clé / ssh-agent).
set -euo pipefail

VPS_HOST="${VPS_HOST:-80.91.79.19}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-}"                 # dossier racine du site sur le VPS (celui qui contient play.html), OBLIGATOIRE
RESTART_CMD="${RESTART_CMD:-}"               # ex: "pm2 restart poker-loult" ou "systemctl restart poker-loult" (vide = pas de redémarrage)
CHECK_URL="${CHECK_URL:-https://loultparty.fr/enchaines/index.html}"

cd "$(dirname "$0")"
[ -d enchaines ] || { echo "Lance ce script depuis la racine du dépôt (dossier enchaines/ introuvable)."; exit 1; }
if [ -z "$REMOTE_DIR" ]; then
  echo "Il faut indiquer le dossier du site sur le VPS, par exemple :"
  echo "  REMOTE_DIR=/var/www/loultparty ./deploy.sh"
  echo "(pour le trouver : ssh $VPS_USER@$VPS_HOST 'ls /var/www; systemctl list-units --type=service | grep -Ei \"nginx|apache|node|pm2\"')"
  exit 1
fi

echo "→ Tests locaux"
node enchaines/test_sim.js | tail -1
node enchaines/test_level.js | tail -1

SSH="ssh -p $VPS_PORT -o StrictHostKeyChecking=accept-new"
TARGET="$VPS_USER@$VPS_HOST"

echo "→ Copie de enchaines/ vers $TARGET:$REMOTE_DIR/enchaines/"
if command -v rsync >/dev/null && $SSH "$TARGET" 'command -v rsync' >/dev/null 2>&1; then
  rsync -az --delete -e "$SSH" enchaines/ "$TARGET:$REMOTE_DIR/enchaines/"
else
  $SSH "$TARGET" "mkdir -p '$REMOTE_DIR/enchaines' && rm -rf '$REMOTE_DIR/enchaines'/*"
  tar -C enchaines -cf - . | $SSH "$TARGET" "tar -C '$REMOTE_DIR/enchaines' -xf -"
fi

if [ -n "$RESTART_CMD" ]; then
  echo "→ Redémarrage : $RESTART_CMD"
  $SSH "$TARGET" "$RESTART_CMD"
else
  echo "→ Pas de redémarrage (le dossier est servi en statique, aucun redémarrage nécessaire)."
fi

echo "→ Vérification : $CHECK_URL"
code=$(curl -s -o /dev/null -w '%{http_code}' "$CHECK_URL" || true)
if [ "$code" = "200" ]; then echo "OK : $CHECK_URL répond 200"; else echo "ATTENTION : $CHECK_URL répond '$code' (vérifie le serveur web / le chemin REMOTE_DIR)"; exit 1; fi
