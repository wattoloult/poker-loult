/* ============================================================
   POKER LOULT — CONTRÔLEUR DE SALLE (autorité serveur)
   ------------------------------------------------------------
   Enveloppe le moteur autoritaire, possède les VRAIS timers
   (action 10s / niveau de blindes), fait jouer les bots, boucle
   les mains, gère join/reconnexion. Aucun socket ici : le
   transport (server.js) branche onUpdate + handleAction.
   Le `scheduler` (timers + horloge) est injectable -> testable.
   ============================================================ */
'use strict';
const E = require('./poker-engine.js');
const EVAL = require('../poker-eval.js');

const realScheduler = {
  setTimeout: (ms, fn) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  now: () => Date.now(),
};

const BOT_NAMES = ['Miaouss', 'Roucool', 'Évoli', 'Salamèche', 'Rondoudou', 'Magicarpe'];
const INTER_HAND_MS = 2500;      // pause entre deux mains gagnées par fold (rien à révéler côté client)
const INTER_HAND_RIVER_MS = 5000; // abattage sans tapis : le board était déjà complet, rien ne se retourne en plus
const INTER_HAND_SHOWDOWN_MS = 9000; // pause après un VRAI abattage : le client peut encore être en train de
// révéler le board carte par carte (jusqu'à ~5.7s sur un tapis général) + il faut laisser le temps de
// cliquer SHOW une fois couché -> sinon la main suivante démarre côté serveur pendant que ça s'affiche
// encore, et un clic SHOW arrive trop tard (rejeté en silence, phase déjà repassée à 'playing').
const BOT_MIN_MS = 1400, BOT_MAX_MS = 3000; // tempo "humain" : les bots ne claquent plus leur action instantanément

function createRoom(config = {}, scheduler = realScheduler) {
  const cfg = Object.assign({ seats: 6 }, E.DEFAULT_CONFIG, config);
  const room = {
    config: cfg, scheduler,
    table: E.createTable(cfg),
    tokens: new Map(),        // token humain -> seat
    ready: new Map(),         // token humain -> prêt ? (salle d'attente uniquement, remis à zéro à chaque start)
    listeners: new Set(),     // { seat, fn }
    actionTimer: null, levelTimer: null, interHandTimer: null,
    levelEndsAt: 0, started: false,
  };
  return room;
}

/* ---------- abonnements / diffusion ---------- */
// seatFn() renvoie le siège COURANT de l'abonné (peut changer : lobby -> assis)
function subscribe(room, seatFn, fn) { const l = { seatFn, fn }; room.listeners.add(l); return () => room.listeners.delete(l); }
function roomSnapshot(room, seat) {
  const s = E.snapshot(room.table, seat);
  s.you = seat;
  s.now = room.scheduler.now();
  s.levelEndsAt = room.levelEndsAt;
  s.actionTime = room.config.actionTime;
  s.levelDuration = room.config.levelDuration;
  s.minRaise = room.table.hand ? room.table.hand.minRaise : 0;
  // actions légales : envoyées UNIQUEMENT au joueur dont c'est le tour
  if (room.table.phase === 'playing' && room.table.hand && room.table.hand.toAct === seat)
    s.legal = E.legalActions(room.table, seat);
  return s;
}
function broadcast(room) { for (const l of room.listeners) { try { l.fn(roomSnapshot(room, l.seatFn())); } catch (e) { } } }
function isActive(room) { return room.started && room.table.phase !== 'tournamentOver'; }
function sanitizeConfig(cfg = {}) {
  return {
    seats: Math.max(2, Math.min(6, (cfg.seats | 0) || 6)),
    levelDuration: Math.max(30, Math.min(3600, (cfg.levelDuration | 0) || E.DEFAULT_CONFIG.levelDuration)),
    startStack: Math.max(500, Math.min(1e7, (cfg.startStack | 0) || E.DEFAULT_CONFIG.startStack)),
    actionTime: Math.max(5, Math.min(120, (cfg.actionTime | 0) || E.DEFAULT_CONFIG.actionTime)),
  };
}
function seatHuman(room, token, name, seat = -1) {
  const s = E.addPlayer(room.table, { id: token, name: (name || 'Joueur').slice(0, 16), isBot: false }, seat);
  if (s >= 0) room.tokens.set(token, s);
  return s;
}
/* Lancement par l'hôte (bouton "Lancer la partie") : (re)configure puis démarre.
   Si une partie tourne déjà, on rejoint simplement. */
function hostStart(room, config, token, name) {
  if (isActive(room)) return join(room, token, name);
  Object.assign(room.config, sanitizeConfig(config));
  clearActionTimer(room); clearLevelTimer(room);
  if (room.interHandTimer != null) { room.scheduler.clearTimeout(room.interHandTimer); room.interHandTimer = null; }
  room.table = E.createTable(room.config);
  room.tokens.clear();
  room.started = false;
  const seat = seatHuman(room, token, name);
  start(room);
  return seat;
}

/* ---------- démarrage du tournoi ---------- */
function start(room) {
  if (room.started) return;
  room.started = true;
  room.ready.clear(); // remis à zéro : prêt pour CE lancement, pas pour la prochaine revanche
  // comble les sièges avec des bots jusqu'à config.seats
  for (let i = 0; i < room.config.seats; i++) {
    if (!room.table.seats[i]) E.addPlayer(room.table, { id: 'bot' + i, name: BOT_NAMES[i % BOT_NAMES.length], isBot: true }, i);
  }
  scheduleLevelTimer(room);
  beginHand(room);
}

/* ---------- prêt / auto-lancement : chaque joueur humain assis se déclare prêt, dès que TOUS le sont
   (2 minimum) la partie démarre toute seule -> pas besoin d'un hôte qui clique "Lancer la partie". */
function setReady(room, token, ready) {
  if (!room.tokens.has(token)) return; // pas assis (spectateur) -> ignoré
  if (ready) room.ready.set(token, true); else room.ready.delete(token);
  maybeAutoStart(room);
}
function allHumansReady(room) {
  const humanTokens = [...room.tokens.keys()];
  return humanTokens.length >= 2 && humanTokens.every(t => room.ready.get(t));
}
function maybeAutoStart(room) {
  if (!isActive(room) && allHumansReady(room)) startGame(room);
}

/* ---------- join / reconnexion / takeover d'un bot ---------- */
function join(room, token, name) {
  if (room.tokens.has(token)) return room.tokens.get(token); // reconnexion : même siège, timer inchangé
  // prend la place d'un bot si possible
  const botSeat = room.table.seats.findIndex(p => p && p.isBot);
  if (botSeat >= 0) {
    const p = room.table.seats[botSeat];
    p.isBot = false; p.id = token; p.name = name || p.name; p.connected = true;
    room.tokens.set(token, botSeat);
    // si c'était au tour de ce bot, on repasse en timer humain
    if (room.table.hand && room.table.hand.toAct === botSeat) scheduleActor(room);
    broadcast(room);
    return botSeat;
  }
  return -1; // table pleine d'humains -> spectateur
}
function setConnected(room, token, connected) {
  const seat = room.tokens.get(token);
  if (seat != null && room.table.seats[seat]) { room.table.seats[seat].connected = connected; broadcast(room); }
}

/* ---------- boucle des mains ---------- */
function beginHand(room) {
  clearActionTimer(room);
  const r = E.startHand(room.table, room.scheduler.now());
  if (!r.ok && room.table.phase === 'tournamentOver') { broadcast(room); clearLevelTimer(room); return; }
  broadcast(room);
  scheduleActor(room);
}
function afterAction(room) {
  clearActionTimer(room);
  broadcast(room);
  if (room.table.phase === 'playing') { scheduleActor(room); return; }
  if (room.table.phase === 'tournamentOver') { clearLevelTimer(room); return; }
  // handComplete -> main suivante après une pause CALIBRÉE sur ce que le client a réellement à montrer :
  //  - gain par fold : rien à révéler, on enchaîne vite
  //  - abattage normal (board déjà complet) : rien de neuf ne se retourne, 9 s était du temps mort
  //  - abattage APRÈS un tapis : le client déroule les cartes restantes à 1 s chacune (jusqu'à ~5,7 s)
  //    puis il faut encore laisser cliquer SHOW -> c'est le seul cas qui justifie la pause longue.
  //    h.equity n'est calculée QUE dans ce cas-là (voir nextStreet/noMoreBetting) : signal gratuit et fiable.
  const hand = room.table.hand;
  const results = hand && hand.results;
  const byFold = results && results.length === 1 && results[0].byFold;
  const runout = !!(hand && hand.equity);
  const delay = byFold ? INTER_HAND_MS : (runout ? INTER_HAND_SHOWDOWN_MS : INTER_HAND_RIVER_MS);
  room.interHandTimer = room.scheduler.setTimeout(delay, () => beginHand(room));
}

/* ---------- timer d'action (UN SEUL à la fois) ---------- */
function clearActionTimer(room) { if (room.actionTimer != null) { room.scheduler.clearTimeout(room.actionTimer); room.actionTimer = null; } }
function scheduleActor(room) {
  clearActionTimer(room);
  const t = room.table, h = t.hand;
  if (!h || h.toAct < 0) return;
  const seat = h.toAct, p = t.seats[seat];
  if (p.isBot) {
    const delay = BOT_MIN_MS + Math.floor(Math.random() * (BOT_MAX_MS - BOT_MIN_MS));
    room.actionTimer = room.scheduler.setTimeout(delay, () => {
      const dec = botDecide(room, seat);
      E.applyAction(t, seat, dec, room.scheduler.now());
      afterAction(room);
    });
  } else {
    // joueur humain : le vrai délai est le deadline autoritaire du moteur
    const ms = Math.max(0, h.deadline - room.scheduler.now());
    room.actionTimer = room.scheduler.setTimeout(ms, () => {
      E.timeoutCurrent(t, room.scheduler.now()); // AFK -> check si légal, sinon fold
      afterAction(room);
    });
  }
}

/* ---------- action d'un joueur (venue du transport) ---------- */
function handleAction(room, token, action) {
  const seat = room.tokens.get(token);
  if (seat == null) return { ok: false, error: 'not-seated' };
  const res = E.applyAction(room.table, seat, action, room.scheduler.now());
  if (res.ok) afterAction(room);
  return res;
}

/* ---------- timer de niveau de blindes (indépendant) ---------- */
function clearLevelTimer(room) { if (room.levelTimer != null) { room.scheduler.clearTimeout(room.levelTimer); room.levelTimer = null; } }
function scheduleLevelTimer(room) {
  clearLevelTimer(room);
  room.levelEndsAt = room.scheduler.now() + room.config.levelDuration * 1000;
  room.levelTimer = room.scheduler.setTimeout(room.config.levelDuration * 1000, () => onLevelExpire(room));
}
function onLevelExpire(room) {
  // la hausse s'applique à la PROCHAINE main (jamais au milieu d'une main en cours)
  if (room.table.level < room.config.levels.length - 1) room.table.pendingLevelUp = true;
  scheduleLevelTimer(room); // relance le compte à rebours du niveau suivant
  broadcast(room);
}

/* ============================================================
   IA des bots (côté serveur)
   ============================================================ */
function botStrength(hole, board) {
  if (board.length === 0) {
    const [a, b] = hole.map(c => c.r).sort((x, y) => y - x);
    let s = (a - 2) / 12 * 0.5 + (b - 2) / 12 * 0.2;
    if (a === b) s += 0.35; if (hole[0].s === hole[1].s) s += 0.08; if (a - b === 1) s += 0.05;
    return Math.min(1, s);
  }
  const best = EVAL.bestHand([...hole, ...board]);
  return Math.min(1, best.score[0] / 7 + best.score[1] / 200);
}
function botDecide(room, seat) {
  const t = room.table, h = t.hand, p = t.seats[seat];
  const la = E.legalActions(t, seat);
  if (!la) return { type: 'fold' };
  const pot = t.seats.reduce((s, x) => s + (x ? x.committed : 0), 0);
  const str = botStrength(p.hole, h.board) + (Math.random() - 0.5) * 0.15;
  const potOdds = la.toCall / (pot + la.toCall || 1);
  const bluff = Math.random() < 0.06;
  const raiseTo = (frac) => Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, h.currentBet + Math.max(h.minRaise, Math.round(pot * frac))));

  if (la.toCall === 0) {
    if (la.canRaise && (str > 0.62 || bluff)) { const a = raiseTo(0.5); if (a > h.currentBet) return { type: 'raise', amount: a }; }
    return { type: 'check' };
  }
  if (str < potOdds * 0.85 && !bluff) {
    if (la.toCall <= h.bb && Math.random() < 0.5) return { type: 'call' };
    return { type: 'fold' };
  }
  if (la.canRaise && str > 0.8 && Math.random() < 0.5) { const a = raiseTo(0.6); if (a >= la.minRaiseTo && a > h.currentBet) return { type: 'raise', amount: a }; }
  return { type: 'call' };
}

/* Démarre la partie dans une room en attente : comble avec les bots choisis. */
function startGame(room) {
  if (isActive(room)) return false;
  const seated = room.table.seats.filter(p => p).length;
  room.config.seats = Math.max(2, Math.min(room.config.maxPlayers, seated + (room.botCount || 0)));
  room.started = false;
  start(room);
  return true;
}
/* Retire un joueur : libère son siège si on est en attente ; en jeu on garde le siège (reconnexion). */
function removePlayer(room, token) {
  const seat = room.tokens.get(token);
  if (seat == null) return;
  room.tokens.delete(token);
  room.ready.delete(token);
  const p = room.table.seats[seat];
  if (!isActive(room)) { room.table.seats[seat] = null; maybeAutoStart(room); } // un départ peut suffire à rendre tout le monde prêt
  else if (p) { p.connected = false; }
  broadcast(room);
}
function humanCount(room) { return room.table.seats.filter(p => p && !p.isBot).length; }
function showCards(room, token, card) {
  const seat = room.tokens.get(token);
  const ok = seat != null && E.showCards(room.table, seat, card);
  if (ok) broadcast(room);
  return ok;
}

module.exports = {
  createRoom, start, join, setConnected, handleAction, subscribe, roomSnapshot, broadcast,
  isActive, hostStart, startGame, removePlayer, humanCount, showCards, seatHuman, sanitizeConfig, realScheduler, BOT_NAMES,
  setReady,
};
