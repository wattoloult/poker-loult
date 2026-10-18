/* ============================================================
   POKER LOULT — SERVEUR (HTTP + WebSocket, zéro dépendance)
   Multi-rooms : lobby, création/rejoindre, mots de passe, bots.
   Le serveur est la SOURCE DE VÉRITÉ. Lancer : node server/server.js
   ============================================================ */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const R = require('./room.js');

const PORT = process.env.PORT || 8770;
const ROOT = path.join(__dirname, '..');
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const STARTING_STACK = 10000; // fixe pour tous

/* ---------- registre des rooms ---------- */
const rooms = new Map();       // code -> { ctrl, meta }
const playerRoom = new Map();  // token -> code (pour la reconnexion)
const lobbyConns = new Set();  // connexions actuellement au lobby
const allConns = new Set();    // toutes les connexions (pour le chat)
const CHAT_PRESETS = ['Bien joué !', 'GG', 'Bluff ?', 'All-in !', 'Trop fort', 'Chanceux…', 'Allez !', 'Aïe 😬', 'Nice 😎', 'Mdr 😂', 'Bien tenté', 'Merci !'];

function genCode() { let c; do { c = Math.random().toString(36).slice(2, 6).toUpperCase(); } while (rooms.has(c)); return c; }
function roomStatus(r) { return !r.ctrl.started ? 'waiting' : (r.ctrl.table.phase === 'tournamentOver' ? 'over' : 'playing'); }
const ABANDONED_ROOM_MS = 2 * 60 * 1000; // room "en jeu" gardée pour reconnexion : purgée si TOUS les humains restent déconnectés ce temps-là (sinon elle bloque le code + la liste publique pour toujours, personne ne peut plus la rejoindre)
function allHumansDisconnected(ctrl) {
  const humans = ctrl.table.seats.filter(p => p && !p.isBot);
  return humans.length > 0 && humans.every(p => !p.connected);
}
function scheduleAbandonedCleanup(code, r) {
  clearTimeout(r.meta.emptyTimer);
  r.meta.emptyTimer = setTimeout(() => {
    if (rooms.get(code) === r && allHumansDisconnected(r.ctrl)) { rooms.delete(code); broadcastLobby(); }
  }, ABANDONED_ROOM_MS);
}
// room dont le TOURNOI EST FINI (quelqu'un a gagné) : avant ce correctif elle restait affichée "en cours"/
// "terminée" dans la liste publique POUR TOUJOURS tant que l'humain ne fermait pas proprement l'onglet
// (un onglet resté ouvert sur l'écran de victoire, ou en arrière-plan sur mobile, ne déclenche jamais la
// déconnexion) -> la liste s'encombre de rooms mortes. On laisse le temps de voir l'écran de victoire /
// relancer, puis on purge, indépendamment de la connexion.
const OVER_ROOM_MS = 3 * 60 * 1000;
function watchRoomLifecycle(code, r) {
  let overTimer = null;
  R.subscribe(r.ctrl, () => -1, () => {
    const isOver = roomStatus(r) === 'over';
    if (isOver && !overTimer) {
      overTimer = setTimeout(() => {
        overTimer = null;
        if (rooms.get(code) === r && roomStatus(r) === 'over') { rooms.delete(code); broadcastLobby(); }
      }, OVER_ROOM_MS);
    } else if (!isOver && overTimer) { clearTimeout(overTimer); overTimer = null; }
  });
}
// room publique toujours dispo, créée une fois au démarrage : plus besoin de cliquer "Créer une room" pour
// juste jouer avec des amis -> on entre directement dedans et chacun se déclare prêt (voir 'toggleReady').
// meta.permanent=true l'exempte de toute purge auto (room vide/abandonnée) : elle attend le prochain arrivant.
const DEFAULT_ROOM_CODE = 'LOULT';
function ensureDefaultRoom() {
  if (rooms.has(DEFAULT_ROOM_CODE)) return;
  const ctrl = R.createRoom({ maxPlayers: 6, seats: 6, startStack: STARTING_STACK, actionTime: 15, levelDuration: 120, avatarKind: 'pokemon' });
  ctrl.botCount = 0;
  rooms.set(DEFAULT_ROOM_CODE, { ctrl, meta: { code: DEFAULT_ROOM_CODE, name: 'Table de Loult', isPrivate: false, password: '', hostToken: null, permanent: true } });
}
function publicRoomList() {
  return [...rooms.values()].filter(r => !r.meta.isPrivate).map(r => ({
    code: r.meta.code, name: r.meta.name, players: R.humanCount(r.ctrl),
    max: r.ctrl.config.maxPlayers, locked: !!r.meta.password, status: roomStatus(r),
  }));
}
function broadcastLobby() { const list = publicRoomList(); for (const c of lobbyConns) c.send({ type: 'rooms', rooms: list }); }
function withMeta(r, snap, token) {
  const humans = R.humanCount(r.ctrl), readyCount = [...r.ctrl.ready.keys()].filter(t => r.ctrl.tokens.has(t)).length;
  snap.room = {
    code: r.meta.code, name: r.meta.name, isPrivate: r.meta.isPrivate, locked: !!r.meta.password,
    status: roomStatus(r), host: r.meta.hostToken === token, bots: r.ctrl.botCount || 0,
    maxPlayers: r.ctrl.config.maxPlayers, startingStack: STARTING_STACK,
    humans, readyCount, youReady: !!r.ctrl.ready.get(token),
  };
  snap.seats.forEach(p => { if (p && !p.isBot) p.ready = !!r.ctrl.ready.get(p.id); });
  return snap;
}

/* ---------- entrer / quitter une room ---------- */
function enterRoom(conn, code, name) {
  const r = rooms.get(code);
  if (!r) { conn.send({ type: 'error', msg: 'Room introuvable' }); return; }
  lobbyConns.delete(conn);
  conn.code = code;
  let seat;
  if (R.isActive(r.ctrl) && r.ctrl.tokens.has(conn.token)) seat = r.ctrl.tokens.get(conn.token); // reconnexion
  else seat = R.seatHuman(r.ctrl, conn.token, name);
  if (seat < 0) { conn.send({ type: 'error', msg: 'Room pleine' }); lobbyConns.add(conn); conn.code = null; return; }
  conn.seat = seat;
  playerRoom.set(conn.token, code);
  conn.unsub = R.subscribe(r.ctrl, () => conn.seat, (snap) => conn.send({ type: 'state', snap: withMeta(r, snap, conn.token) }));
  R.setConnected(r.ctrl, conn.token, true);
  clearTimeout(r.meta.emptyTimer); // quelqu'un est revenu -> annule la purge programmée par scheduleAbandonedCleanup
  conn.send({ type: 'joined', code, you: seat });
  conn.send({ type: 'state', snap: withMeta(r, R.roomSnapshot(r.ctrl, seat), conn.token) });
  R.broadcast(r.ctrl);
  broadcastLobby();
}
function leaveRoom(conn, silent) {
  const r = conn.code && rooms.get(conn.code);
  if (r) {
    if (conn.unsub) { conn.unsub(); conn.unsub = null; }
    R.removePlayer(r.ctrl, conn.token);
    playerRoom.delete(conn.token);
    if (R.humanCount(r.ctrl) === 0 && !r.meta.permanent) rooms.delete(conn.code); // room vide -> supprimée (sauf la room permanente)
    else R.broadcast(r.ctrl);
  }
  conn.code = null; conn.seat = -1;
  lobbyConns.add(conn);
  if (!silent) { conn.send({ type: 'left' }); conn.send({ type: 'rooms', rooms: publicRoomList() }); }
  broadcastLobby();
}

/* ============================================================
   HTTP statique
   ============================================================ */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/play.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^(\.\.[\\/])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    // no-cache : le navigateur récupère TOUJOURS la dernière version (fini les bugs de cache sur play.js/css)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(data);
  });
});

/* ============================================================
   WebSocket
   ============================================================ */
function acceptKey(key) { return crypto.createHash('sha1').update(key + WS_GUID).digest('base64'); }
function parseFrames(buf) {
  const frames = []; let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off], b1 = buf[off + 1];
    const opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0; let len = b1 & 0x7f; let p = off + 2;
    if (len === 126) { if (p + 2 > buf.length) break; len = buf.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(p)); p += 8; }
    let mask; if (masked) { if (p + 4 > buf.length) break; mask = buf.slice(p, p + 4); p += 4; }
    if (p + len > buf.length) break;
    let payload = buf.slice(p, p + len);
    if (masked) { const o = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) o[i] = payload[i] ^ mask[i & 3]; payload = o; }
    frames.push({ opcode, payload }); off = p + len;
  }
  return { frames, rest: buf.slice(off) };
}
function encodeFrame(str, opcode = 0x1) {
  const payload = Buffer.from(str, 'utf8'), len = payload.length; let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { header = Buffer.allocUnsafe(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.allocUnsafe(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
const clean = (s, n) => String(s == null ? '' : s).slice(0, n);

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n');

  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('t') || 'guest-' + crypto.randomBytes(6).toString('hex');
  const conn = { token, code: null, seat: -1, unsub: null, chatAt: 0, send: (obj) => { try { socket.write(encodeFrame(JSON.stringify(obj))); } catch (e) { } } };
  allConns.add(conn);

  conn.send({ type: 'hello', token });
  // reconnexion automatique dans une partie en cours
  const prev = playerRoom.get(token);
  if (prev && rooms.get(prev) && R.isActive(rooms.get(prev).ctrl)) enterRoom(conn, prev, null);
  else { lobbyConns.add(conn); conn.send({ type: 'rooms', rooms: publicRoomList() }); }

  let buf = Buffer.alloc(0);
  socket.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    const { frames, rest } = parseFrames(buf); buf = rest;
    for (const f of frames) {
      if (f.opcode === 0x8) { socket.end(); return; }
      if (f.opcode === 0x9) { socket.write(encodeFrame('', 0xA)); continue; }
      if (f.opcode !== 0x1) continue;
      let m; try { m = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
      handle(conn, m);
    }
  });
  const cleanup = () => {
    const r = conn.code && rooms.get(conn.code);
    if (r) {
      if (conn.unsub) { conn.unsub(); conn.unsub = null; }
      if (R.isActive(r.ctrl)) { // garde le siège (reconnexion), mais purge la room si personne ne revient (voir ABANDONED_ROOM_MS)
        R.setConnected(r.ctrl, conn.token, false); R.broadcast(r.ctrl);
        if (!r.meta.permanent && allHumansDisconnected(r.ctrl)) scheduleAbandonedCleanup(conn.code, r);
      }
      else { R.removePlayer(r.ctrl, conn.token); playerRoom.delete(conn.token); if (R.humanCount(r.ctrl) === 0 && !r.meta.permanent) rooms.delete(conn.code); broadcastLobby(); }
    }
    lobbyConns.delete(conn);
    allConns.delete(conn);
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

/* ---------- routage des messages ---------- */
function handle(conn, m) {
  const inRoom = () => conn.code && rooms.get(conn.code);
  switch (m.type) {
    case 'listRooms': conn.send({ type: 'rooms', rooms: publicRoomList() }); break;

    case 'createRoom': {
      if (conn.code) leaveRoom(conn, true);
      const code = genCode();
      const ctrl = R.createRoom({ maxPlayers: 6, seats: 6, startStack: STARTING_STACK, actionTime: 15, levelDuration: 120, avatarKind: m.avatarKind === 'people' ? 'people' : 'pokemon' });
      ctrl.botCount = Math.max(0, Math.min(5, m.bots | 0));
      const meta = { code, name: clean(m.name, 24) || ('Room ' + code), isPrivate: !!m.isPrivate, password: clean(m.password, 24), hostToken: conn.token };
      const room = { ctrl, meta };
      rooms.set(code, room);
      watchRoomLifecycle(code, room);
      enterRoom(conn, code, clean(m.pseudo, 16) || 'Hôte');
      break;
    }
    case 'joinRoom': {
      const r = rooms.get(clean(m.code, 8).toUpperCase());
      if (!r) { conn.send({ type: 'error', msg: 'Room introuvable' }); break; }
      if (r.meta.password && r.meta.password !== clean(m.password, 24)) { conn.send({ type: 'error', msg: 'Mot de passe incorrect' }); break; }
      if (roomStatus(r) !== 'waiting' && !r.ctrl.tokens.has(conn.token)) { conn.send({ type: 'error', msg: 'La partie a déjà commencé' }); break; }
      if (conn.code) leaveRoom(conn, true);
      enterRoom(conn, r.meta.code, clean(m.pseudo, 16) || 'Joueur');
      break;
    }
    case 'leaveRoom': leaveRoom(conn); break;

    case 'setBots': { const r = inRoom(); if (r && r.meta.hostToken === conn.token && !r.ctrl.started) { r.ctrl.botCount = Math.max(0, Math.min(5, m.bots | 0)); R.broadcast(r.ctrl); } break; }

    case 'startGame': {
      const r = inRoom();
      if (!r || r.meta.hostToken !== conn.token) break;
      const total = R.humanCount(r.ctrl) + (r.ctrl.botCount || 0);
      if (total < 2) { conn.send({ type: 'error', msg: 'Il faut au moins 2 joueurs (ajoute un bot ou attends un ami).' }); break; }
      R.startGame(r.ctrl); R.broadcast(r.ctrl); broadcastLobby();
      break;
    }
    case 'newGame': { // rematch après un tournoi
      const r = inRoom();
      if (r && r.meta.hostToken === conn.token && roomStatus(r) === 'over') { R.startGame(r.ctrl); R.broadcast(r.ctrl); broadcastLobby(); }
      break;
    }
    // chaque joueur assis se déclare prêt ; dès que TOUS les humains le sont (2 mini), la partie démarre
    // toute seule (voir room.js/maybeAutoStart) -> pas besoin d'un hôte qui clique "Lancer la partie".
    case 'toggleReady': {
      const r = inRoom();
      if (r) { R.setReady(r.ctrl, conn.token, !!m.ready); R.broadcast(r.ctrl); broadcastLobby(); }
      break;
    }
    case 'action': { const r = inRoom(); if (r) R.handleAction(r.ctrl, conn.token, m.action); break; }

    case 'show': { const r = inRoom(); if (r && !R.showCards(r.ctrl, conn.token, m.card)) conn.send({ type: 'error', msg: 'Trop tard pour montrer (main déjà terminée).' }); break; }

    case 'chat': {
      const r = inRoom(); if (!r) break;
      const seat = r.ctrl.tokens.get(conn.token);
      const text = CHAT_PRESETS[m.i | 0];
      if (seat == null || !text) break;
      const now = Date.now();
      if (now - conn.chatAt < 1200) break;                 // anti-spam : 1 message / 1.2s
      conn.chatAt = now;
      for (const c of allConns) if (c.code === conn.code) c.send({ type: 'chat', seat, text });
      break;
    }
    case 'emote': {
      const r = inRoom(); if (!r) break;
      const seat = r.ctrl.tokens.get(conn.token);
      const emote = String(m.emote || '').slice(0, 16);
      // DOIT rester identique à la liste EMOTES de play.js (ids valides)
      const VALID_EMOTES = new Set(['cigare', 'cafe', 'pistolet', 'baffe', 'gossip', 'w-relax', 'w-cheer', 'w-cool', 'w-angry', 'w-sleep', 'w-love', 'w-think', 'w-sweat', 'w-card', 'w-throw', 'w-chips', 'w-shrug']);
      if (seat == null || !VALID_EMOTES.has(emote)) break;
      // pistolet/baffe : nécessitent une cible valide (siège occupé, différent du tireur) — sinon purement cosmétique, pas de cible
      let target = null;
      if (emote === 'pistolet' || emote === 'baffe') {
        target = Number.isInteger(m.target) ? m.target : -1;
        if (target < 0 || target > 5 || target === seat || !r.ctrl.table.seats[target]) { conn.send({ type: 'error', msg: 'Cible invalide.' }); break; }
      }
      const now = Date.now();
      // cooldown 5s CÔTÉ SERVEUR (indépendant du compteur client, qui peut se désynchroniser après un
      // refresh) : le signaler au client au lieu de laisser tomber en silence (sinon ça ressemble à un bug).
      if (now - (conn.emoteAt || 0) < 5000) { conn.send({ type: 'error', msg: 'Emote en recharge…' }); break; }
      conn.emoteAt = now;
      for (const c of allConns) if (c.code === conn.code) c.send({ type: 'emote', seat, emote, target });
      break;
    }
  }
}

ensureDefaultRoom();
server.listen(PORT, () => console.log('POKER LOULT — serveur multi-rooms sur http://localhost:' + PORT));
