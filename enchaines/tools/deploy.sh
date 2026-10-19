#!/usr/bin/env bash
# Déploiement des Enchaînés sur loultparty.fr (à lancer depuis Git Bash) :
#   1. archive du jeu (sans node_modules, outils, tests, .md, données) -> /opt/poker-loult/enchaines (ancienne version sauvegardée)
#   2. dépendances (ws), service systemd `enchaines-mm` (port 8807, classement dans /var/lib/enchaines, hors des fichiers servis)
#   3. route Caddy /enchaines-ws* -> 8807 dans les deux blocs + code serveur rendu privé (validé avant rechargement, sinon restauré)
#   4. vérifications : page servie, /stats du service, code serveur en 404
# Idempotent : relançable pour une mise à jour (le service est redémarré, la route Caddy n'est posée qu'une fois).
set -euo pipefail
cd "$(dirname "$0")/.."
KEY=~/.ssh/loultparty_vps; HOST=root@loultparty.fr; TGZ=/tmp/enchaines-$(date +%Y%m%d-%H%M%S).tgz
for f in client/*.js client/worlds/*.js core/*.js core/*/*.js server.js; do node --check "$f" || { echo "ERREUR DE SYNTAXE : $f"; exit 1; }; done
tar --force-local -czf "$TGZ" --exclude=node_modules --exclude=tools --exclude=data --exclude=playtest --exclude='*.test.js' --exclude='*.md' --exclude=assets/characters --exclude=assets/previews --exclude=assets/source --exclude=assets/marketing --exclude=assets/reports --exclude=assets/handoff --exclude=assets/scripts --exclude=assets/textures index.html style.css client core vendor assets server.js package.json
# module de test privé : envoyé à part, rangé HORS des fichiers servis (/var/lib/enchaines)
scp -i $KEY playtest/playtest.js $HOST:/tmp/enchaines-playtest.js
echo "archive : $(du -h "$TGZ" | cut -f1)"
scp -i $KEY "$TGZ" $HOST:/tmp/enchaines.tgz
ssh -i $KEY $HOST 'bash -s' <<'EOF'
set -e
D=/opt/poker-loult/enchaines
if [ -d "$D" ]; then tar -czf /root/enchaines-prev-$(date +%Y%m%d-%H%M%S).tgz -C /opt/poker-loult --exclude=enchaines/node_modules enchaines; fi
mkdir -p "$D" /var/lib/enchaines && tar -xzf /tmp/enchaines.tgz -C "$D" && rm /tmp/enchaines.tgz
mv /tmp/enchaines-playtest.js /var/lib/enchaines/playtest.js
# clé du mode test : créée une seule fois, gardée sur le serveur (pour couper le mode test : vider ENCH_PT_KEY dans ce fichier puis redémarrer)
[ -f /etc/enchaines.env ] || echo "ENCH_PT_KEY=$(openssl rand -hex 12)" > /etc/enchaines.env; chmod 600 /etc/enchaines.env
cd "$D" && npm i --omit=dev --no-audit --no-fund >/dev/null
cat >/etc/systemd/system/enchaines-mm.service <<'UNIT'
[Unit]
Description=Les Enchaînés (salons + physique autoritaire)
After=network.target
[Service]
WorkingDirectory=/opt/poker-loult/enchaines
ExecStart=/usr/bin/node server.js
Environment=PORT=8807
Environment=DATA_DIR=/var/lib/enchaines
Environment=ENCH_PT_FILE=/var/lib/enchaines/playtest.js
EnvironmentFile=-/etc/enchaines.env
Restart=always
User=root
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload && systemctl enable enchaines-mm >/dev/null 2>&1 && systemctl restart enchaines-mm
C=/etc/caddy/Caddyfile
if ! grep -q "handle /enchaines-ws" "$C"; then
  B="$C.bak-enchaines-$(date +%Y%m%d-%H%M%S)"; cp "$C" "$B"
  sed -i 's|^\thandle /blind-ws\* {|\thandle /enchaines-ws* {\n\t\treverse_proxy localhost:8807\n\t}\n\thandle /blind-ws* {|; s|/blind-arena/server.js|/blind-arena/server.js /enchaines/server.js /enchaines/node_modules/* /enchaines/package*.json|g' "$C"
  echo "routes : $(grep -c 'handle /enchaines-ws' "$C") (attendu 2) · privés : $(grep -c '/enchaines/server.js' "$C") (attendu 2)"
  if caddy validate --config "$C" --adapter caddyfile >/tmp/caddy-ench.log 2>&1; then systemctl reload caddy; echo "Caddy rechargé (sauvegarde $B)"
  else echo "Caddyfile INVALIDE : restauré"; tail -5 /tmp/caddy-ench.log; cp "$B" "$C"; exit 1; fi
fi
sleep 1; echo "stats : $(curl -s http://127.0.0.1:8807/stats)"; echo "lien de test privé : https://loultparty.fr/enchaines/?pt=$(grep -oE '[0-9a-f]{24}' /etc/enchaines.env)"
EOF
echo "page : $(curl -s -o /dev/null -w '%{http_code}' https://loultparty.fr/enchaines/)  (attendu 200)"
echo "code serveur : $(curl -s -o /dev/null -w '%{http_code}' https://loultparty.fr/enchaines/server.js)  (attendu 404)"
rm -f "$TGZ"
