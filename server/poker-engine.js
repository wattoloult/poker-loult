/* ============================================================
   POKER LOULT — MOTEUR AUTORITAIRE (Texas Hold'em No-Limit, tournoi 6-max)
   ------------------------------------------------------------
   Machine à états PURE : aucun DOM, aucun réseau, aucun timer réel.
   Le serveur possède les vrais timers (action 10s / niveau de blindes)
   et appelle startHand/applyAction/timeoutCurrent en passant `now` (ms).
   Le moteur est la SOURCE DE VÉRITÉ : il valide chaque action.
   ============================================================ */
'use strict';
const EVAL = require('../poker-eval.js');
const fs = require('fs');
const path = require('path');

// pool "personnalités" (portraits Wikipedia téléchargés par scripts/fetch_people.py, PAS générés) :
// une partie sur deux (voir room.js/hostStart), la table pioche ici au lieu du pool Pokémon.
let PEOPLE_POOL = [];
try {
  PEOPLE_POOL = JSON.parse(fs.readFileSync(path.join(__dirname, '../avatars/people/manifest.json'), 'utf8'))
    .map(e => e.slug);
} catch (e) { /* manifest pas encore généré -> reste vide, la table retombe sur Pokémon */ }

const DEFAULT_CONFIG = {
  startStack: 10000,
  levels: [ // progression rapide, +1 niveau toutes les 2 min (timer GLOBAL de table, appliqué à la main suivante)
    { sb: 400, bb: 800 }, { sb: 600, bb: 1200 }, { sb: 1000, bb: 2000 }, { sb: 1500, bb: 3000 },
    { sb: 2000, bb: 4000 }, { sb: 3000, bb: 6000 }, { sb: 4000, bb: 8000 }, { sb: 6000, bb: 12000 },
    { sb: 8000, bb: 16000 }, { sb: 10000, bb: 20000 }, { sb: 15000, bb: 30000 }, { sb: 20000, bb: 40000 },
    { sb: 30000, bb: 60000 }, { sb: 40000, bb: 80000 },
  ],
  levelDuration: 120, // 2 minutes par niveau
  actionTime: 10,     // secondes par action (configurable)
  maxPlayers: 6,
};

/* ---------- utilitaires ---------- */
function defaultShuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function createTable(config = {}, shuffle = defaultShuffle) {
  const cfg = Object.assign({}, DEFAULT_CONFIG, config);
  return {
    config: cfg,
    shuffle,
    seats: new Array(cfg.maxPlayers).fill(null), // index de siège -> player | null
    avatarKind: (cfg.avatarKind === 'people' && PEOPLE_POOL.length) ? 'people' : 'pokemon',
    button: -1,
    level: 0,
    pendingLevelUp: false,   // le niveau a expiré pendant une main : on applique à la prochaine
    handNo: 0,
    phase: 'lobby',          // lobby | playing | handComplete | tournamentOver
    winner: null,
    hand: null,
    log: [],
  };
}

function newPlayer(id, name, isBot, stack) {
  return {
    id, name, isBot: !!isBot, seat: -1, stack,
    status: 'active',        // active | eliminated
    connected: true,
    // état par main :
    hole: [], folded: false, allIn: false, inHand: false,
    bet: 0,                  // misé sur la street courante
    committed: 0,            // misé total sur la main (pour les side pots)
    actedSinceRaise: false,  // a agi depuis la dernière relance COMPLÈTE
    showing: false,          // joueur couché qui a choisi de montrer ses cartes
    shown: [false, false],   // quelles cartes il montre (par index)
  };
}

// bots nommés d'après un Pokémon -> son id Pokédex ; sinon aléatoire
const BOT_AVATAR = { 'Miaouss': 52, 'Roucool': 16, 'Évoli': 133, 'Salamèche': 4, 'Rondoudou': 39, 'Magicarpe': 129 };
function pickAvatar(t, name) {
  const used = new Set(t.seats.filter(p => p).map(p => p.avatar));
  if (t.avatarKind === 'people') {
    const free = PEOPLE_POOL.filter(s => !used.has(s));
    return free.length ? free[Math.floor(Math.random() * free.length)] : PEOPLE_POOL[0];
  }
  const pref = BOT_AVATAR[name];
  if (pref && !used.has(pref)) return pref;                       // bot -> son Pokémon si libre
  const free = []; for (let i = 1; i <= 151; i++) if (!used.has(i)) free.push(i);
  return free.length ? free[Math.floor(Math.random() * free.length)] : 1; // aléatoire UNIQUE parmi les 151
}
function addPlayer(t, { id, name, isBot }, seatWanted = -1) {
  let seat = seatWanted;
  if (seat < 0 || t.seats[seat]) seat = t.seats.findIndex(s => s === null);
  if (seat < 0) return -1;
  const p = newPlayer(id, name, isBot, t.config.startStack);
  p.seat = seat; p.avatarKind = t.avatarKind; p.avatar = pickAvatar(t, name); t.seats[seat] = p;
  return seat;
}

/* ---------- itération des sièges ---------- */
function occupied(t) { return t.seats.filter(p => p); }
function activePlayers(t) { return t.seats.filter(p => p && p.status === 'active'); }
function nextActiveSeat(t, from) { // prochain siège actif dans le sens horaire (exclusif)
  for (let k = 1; k <= t.config.maxPlayers; k++) {
    const s = (from + k) % t.config.maxPlayers;
    if (t.seats[s] && t.seats[s].status === 'active') return s;
  }
  return -1;
}
function inHandPlayers(t) { return t.seats.filter(p => p && p.inHand && !p.folded); }
function canStillAct(p) { return p && p.inHand && !p.folded && !p.allIn; }

/* ============================================================
   DÉMARRAGE D'UNE MAIN
   ============================================================ */
function startHand(t, now = Date.now()) {
  const actives = activePlayers(t);
  if (actives.length < 2) { t.phase = 'tournamentOver'; t.winner = actives[0] ? actives[0].id : null; return { ok: false, reason: 'tournamentOver' }; }

  // niveau de blindes différé : on applique SEULEMENT entre deux mains
  if (t.pendingLevelUp) { t.level = Math.min(t.level + 1, t.config.levels.length - 1); t.pendingLevelUp = false; }
  const { sb, bb } = t.config.levels[t.level];

  // bouton : avance au prochain joueur actif (première main : premier siège actif)
  t.button = t.button < 0 ? actives[0].seat : nextActiveSeat(t, t.button);

  const heads = actives.length === 2;
  let sbSeat, bbSeat;
  if (heads) { sbSeat = t.button; bbSeat = nextActiveSeat(t, t.button); }
  else { sbSeat = nextActiveSeat(t, t.button); bbSeat = nextActiveSeat(t, sbSeat); }

  // reset état de main — bet/committed/allIn remis à 0 pour TOUS les sièges, PAS seulement les actifs :
  // un joueur éliminé garde sinon le committed/allIn de sa dernière main (celle qui l'a fait perdre) pour
  // toujours -> committed fantôme recompté dans chaque pot suivant (jetons créés à l'infini), et allIn=true
  // qui redéclenche à tort la bannière "ALL IN" à chaque nouvelle main.
  // `inHand` des NON-actifs (éliminés) remis à false ICI et pas dans finishHand : pendant toute la fin de la
  // main précédente (abattage + pause), l'éliminé doit garder inHand=true pour que ses cartes soient
  // révélées ; mais dès la main suivante il ne doit plus compter comme "encore dans le coup", sinon
  // inHandPlayers() le renvoie et endHandByFold() peut lui donner le pot.
  occupied(t).forEach(p => { p.bet = 0; p.committed = 0; p.allIn = false; if (p.status !== 'active') p.inHand = false; });
  actives.forEach(p => { p.hole = []; p.folded = false; p.inHand = true; p.actedSinceRaise = false; p.showing = false; p.shown = [false, false]; });

  const deck = t.shuffle(EVAL.makeDeck());
  // 2 cartes chacun, en commençant à gauche du bouton (SB), 2 tours
  const order = [];
  let s = sbSeat;
  for (let i = 0; i < actives.length; i++) { order.push(s); s = nextActiveSeat(t, s); }
  for (let round = 0; round < 2; round++) for (const seat of order) t.seats[seat].hole.push(deck.pop());

  t.handNo++;
  t.phase = 'playing';
  t.hand = {
    deck, board: [], street: 'preflop',
    sbSeat, bbSeat, sb, bb,
    currentBet: 0, minRaise: bb, lastAggressor: -1,
    toAct: -1, deadline: 0,
    pots: null, results: null, dealtOrder: order,
  };

  postBlind(t, sbSeat, sb);
  postBlind(t, bbSeat, bb);
  t.hand.currentBet = bb; t.hand.minRaise = bb;

  // premier à parler préflop : heads-up -> SB(bouton) ; sinon -> gauche de la BB
  const first = heads ? sbSeat : nextActiveSeat(t, bbSeat);
  startActing(t, first, now);
  return { ok: true };
}

// démarre l'action à `seat` s'il peut encore agir ; sinon cherche le prochain qui le peut en partant de là ;
// si PERSONNE ne peut agir (blindes qui mettent déjà tapis dès le départ, ex: heads-up avec la SB à court de
// jetons), déroule directement le board jusqu'à l'abattage (même mécanisme que nextStreet en cours de main).
// Avant ce correctif : setActor visait toujours `first`, même déjà tapis -> plus aucune action légale
// possible pour personne, la main restait bloquée pour toujours (chaque tentative rejetée en boucle).
function startActing(t, seat, now) {
  for (let k = 0; k < t.config.maxPlayers; k++) {
    const s = (seat + k) % t.config.maxPlayers;
    if (canStillAct(t.seats[s])) { setActor(t, s, now); return; }
  }
  nextStreet(t, now);
}

function postBlind(t, seat, amount) {
  const p = t.seats[seat];
  const pay = Math.min(amount, p.stack);
  p.stack -= pay; p.bet += pay; p.committed += pay;
  if (p.stack === 0) p.allIn = true;
}

/* ---------- désignation du joueur actif ---------- */
function setActor(t, seat, now) {
  t.hand.toAct = seat;
  t.hand.deadline = seat >= 0 ? now + t.config.actionTime * 1000 : 0;
}

/* ============================================================
   ACTIONS LÉGALES
   ============================================================ */
function legalActions(t, seat) {
  const h = t.hand, p = t.seats[seat];
  if (!h || !p || !canStillAct(p)) return null;
  const toCall = h.currentBet - p.bet;
  const maxRaiseTo = p.bet + p.stack;           // tapis total
  let minRaiseTo = h.currentBet + h.minRaise;    // relance minimale légale
  if (minRaiseTo > maxRaiseTo) minRaiseTo = maxRaiseTo; // sinon tapis pour moins qu'une relance min
  const bettingOpen = !p.actedSinceRaise;        // relance rouverte pour ce joueur
  const isBet = h.currentBet === 0;              // aucune mise encore -> "miser" sinon "relancer"
  return {
    toCall: Math.max(0, toCall),
    callAmount: Math.min(Math.max(0, toCall), p.stack),
    canCheck: toCall === 0,
    canCall: toCall > 0,
    canFold: true,
    canRaise: p.stack > toCall && bettingOpen,   // il reste des jetons au-delà du call, et l'enchère lui est ouverte
    isBet,
    minRaiseTo, maxRaiseTo,
    canAllIn: p.stack > 0,
  };
}

/* ============================================================
   APPLIQUER UNE ACTION  (le moteur valide TOUT)
   type: 'fold' | 'check' | 'call' | 'raise' | 'allin'
   pour 'raise', amount = mise TOTALE visée sur la street
   ============================================================ */
function applyAction(t, seat, action, now = Date.now()) {
  const h = t.hand;
  if (t.phase !== 'playing' || !h) return { ok: false, error: 'no-hand' };
  if (seat !== h.toAct) return { ok: false, error: 'not-your-turn' };
  const p = t.seats[seat];
  if (!canStillAct(p)) return { ok: false, error: 'cannot-act' };
  if (now > h.deadline + 50) return { ok: false, error: 'timeout' }; // action après expiration refusée

  const la = legalActions(t, seat);
  let type = action.type;

  if (type === 'allin') { // raccourci : convertit en raise total ou call tapis
    const allInTo = p.bet + p.stack;
    type = allInTo > h.currentBet ? 'raise' : 'call';
    action = { type, amount: allInTo };
  }

  if (type === 'fold') {
    p.folded = true; p.actedSinceRaise = true; t.log.push([seat, 'fold']);
  } else if (type === 'check') {
    if (!la.canCheck) return { ok: false, error: 'check-illegal' };
    p.actedSinceRaise = true; t.log.push([seat, 'check']);
  } else if (type === 'call') {
    if (!la.canCall) return { ok: false, error: 'call-illegal' };
    const pay = Math.min(h.currentBet - p.bet, p.stack);
    p.stack -= pay; p.bet += pay; p.committed += pay; p.actedSinceRaise = true;
    if (p.stack === 0) p.allIn = true;
    t.log.push([seat, 'call', pay]);
  } else if (type === 'raise') {
    const target = Math.min(action.amount | 0, la.maxRaiseTo);
    const isAllIn = target === la.maxRaiseTo && target < h.currentBet + h.minRaise;
    // relance légale : soit une relance complète >= minRaiseTo, soit un tapis pour moins (incomplet)
    if (!isAllIn && (target < la.minRaiseTo || !la.canRaise)) return { ok: false, error: 'raise-illegal' };
    const increment = target - h.currentBet, pay = target - p.bet;
    if (pay > p.stack) return { ok: false, error: 'not-enough' };
    p.stack -= pay; p.bet = target; p.committed += pay;
    h.currentBet = target; h.lastAggressor = seat;
    if (isAllIn) {
      // tapis incomplet : NE rouvre PAS l'enchère (les joueurs ayant déjà agi ne peuvent que suivre/coucher)
      p.actedSinceRaise = true;
    } else {
      h.minRaise = increment;
      inHandPlayers(t).forEach(o => { if (o !== p && !o.allIn) o.actedSinceRaise = false; });
      p.actedSinceRaise = true;
    }
    if (p.stack === 0) p.allIn = true;
    t.log.push([seat, 'raise', target]);
  } else {
    return { ok: false, error: 'unknown-action' };
  }

  // seq GLOBAL à la table (pas à la main) : sinon il repart de 1 à chaque main, et si la 1ère action de la
  // main N+1 retombe sur le même numéro que la dernière action traitée par le client pour la main N, ce
  // dernier l'ignore en silence (seq inchangé) -> tag CHECK/SFX manqué pile sur cette action.
  h.lastAction = { seat, type, seq: (t.actionSeq = (t.actionSeq || 0) + 1) }; // pour les SFX côté client
  advance(t, now);
  return { ok: true };
}

/* le joueur actif n'a pas joué à temps : toujours FOLD (même si check était gratuit) */
function timeoutCurrent(t, now = Date.now()) {
  const h = t.hand;
  if (t.phase !== 'playing' || !h || h.toAct < 0) return { ok: false };
  const seat = h.toAct;
  const forced = { type: 'fold' }; // AFK -> toujours couché (même si check était possible gratuitement)
  // on force l'action au deadline exact (bypass du contrôle timeout)
  h.deadline = now;
  return applyAction(t, seat, forced, now);
}

/* ============================================================
   PROGRESSION : joueur suivant ou street suivante
   ============================================================ */
function roundComplete(t) {
  const live = inHandPlayers(t);
  if (live.length <= 1) return true;
  return live.every(p => p.allIn || (p.actedSinceRaise && p.bet === t.hand.currentBet));
}
function advance(t, now) {
  const h = t.hand;
  // fin de main immédiate si un seul joueur reste
  if (inHandPlayers(t).length <= 1) return endHandByFold(t);

  if (!roundComplete(t)) {
    // prochain joueur à gauche pouvant encore agir et devant agir
    let s = h.toAct;
    for (let k = 1; k <= t.config.maxPlayers; k++) {
      const seat = (h.toAct + k) % t.config.maxPlayers;
      const p = t.seats[seat];
      if (canStillAct(p) && (!p.actedSinceRaise || p.bet < h.currentBet)) { setActor(t, seat, now); return; }
    }
  }
  // street terminée
  nextStreet(t, now);
}

function collectStreet(t) {
  // remet les mises de street à zéro (les totaux `committed` servent aux side pots)
  inHandPlayers(t).forEach(p => { p.bet = 0; p.actedSinceRaise = false; });
  t.hand.currentBet = 0; t.hand.minRaise = t.config.levels[t.level].bb;
}

function nextStreet(t, now) {
  const h = t.hand;
  collectStreet(t);

  if (inHandPlayers(t).length <= 1) return endHandByFold(t);

  const noMoreBetting = t.seats.filter(canStillAct).length <= 1; // tapis général -> on déroule sans miser
  if (noMoreBetting && !h.equity && h.board.length < 5) h.equity = computeEquity(t); // % de win figés au moment du tapis
  const deal = (n) => { h.deck.pop(); for (let i = 0; i < n; i++) h.board.push(h.deck.pop()); };

  const seq = { preflop: 'flop', flop: 'turn', turn: 'river' };
  if (h.street === 'river') return showdown(t);
  h.street = seq[h.street];
  if (h.street === 'flop') deal(3); else deal(1);

  if (noMoreBetting) {
    if (h.street === 'river') return showdown(t);
    return nextStreet(t, now); // continue à distribuer jusqu'à la river puis showdown
  }
  // premier à parler post-flop : premier joueur actif à gauche du bouton pouvant agir
  let s = t.button;
  for (let k = 1; k <= t.config.maxPlayers; k++) {
    const seat = (t.button + k) % t.config.maxPlayers;
    if (canStillAct(t.seats[seat])) { setActor(t, seat, now); return; }
  }
  showdown(t); // personne ne peut agir
}

/* ============================================================
   SIDE POTS + ATTRIBUTION
   ============================================================ */
// équité Monte-Carlo (% de win) des joueurs encore en jeu, au board courant — appelé au tapis général
function computeEquity(t) {
  const h = t.hand, cont = inHandPlayers(t);
  if (cont.length < 2) return null;
  const known = new Set(h.board.map(c => c.code));
  cont.forEach(p => p.hole.forEach(c => known.add(c.code)));
  const deck = EVAL.makeDeck().filter(c => !known.has(c.code));
  const need = 5 - h.board.length, N = 1500, win = {};
  cont.forEach(p => { win[p.seat] = 0; });
  for (let i = 0; i < N; i++) {
    const pool = deck.slice(), board = h.board.slice();
    for (let k = 0; k < need; k++) { const j = (Math.random() * pool.length) | 0; board.push(pool[j]); pool[j] = pool[pool.length - 1]; pool.pop(); }
    let best = null, winners = [];
    for (const p of cont) { const sc = EVAL.bestHand([...p.hole, ...board]).score; const c = best ? EVAL.cmp(sc, best) : 1; if (c > 0) { best = sc; winners = [p.seat]; } else if (c === 0) winners.push(p.seat); }
    winners.forEach(s => { win[s] += 1 / winners.length; }); // partage l'égalité
  }
  const eq = {}; cont.forEach(p => { eq[p.seat] = Math.round(win[p.seat] / N * 100); });
  return eq;
}
function buildPots(t) {
  const contribs = occupied(t).filter(p => p.committed > 0);
  const levels = [...new Set(contribs.map(p => p.committed))].sort((a, b) => a - b);
  let prev = 0; const pots = [];
  for (const lvl of levels) {
    let amount = 0;
    for (const p of occupied(t)) amount += Math.max(0, Math.min(p.committed, lvl) - prev);
    const eligible = occupied(t).filter(p => !p.folded && p.inHand && p.committed >= lvl).map(p => p.seat);
    if (amount > 0) pots.push({ amount, eligible });
    prev = lvl;
  }
  return pots;
}

function endHandByFold(t) {
  const winner = inHandPlayers(t)[0];
  const total = occupied(t).reduce((s, p) => s + p.committed, 0);
  winner.stack += total;
  t.hand.pots = [{ amount: total, eligible: [winner.seat] }];
  t.hand.results = [{ seat: winner.seat, won: total, byFold: true }];
  finishHand(t);
}

function showdown(t) {
  const h = t.hand;
  setActor(t, -1, 0);
  const shown = inHandPlayers(t);
  shown.forEach(p => { p.eval = EVAL.bestHand([...p.hole, ...h.board]); });

  const pots = buildPots(t);
  const wonBy = {}; // seat -> montant
  for (const pot of pots) {
    const contenders = pot.eligible.map(s => t.seats[s]).filter(p => !p.folded);
    if (!contenders.length) continue;
    let best = contenders[0].eval.score;
    contenders.forEach(p => { if (EVAL.cmp(p.eval.score, best) > 0) best = p.eval.score; });
    let winners = contenders.filter(p => EVAL.cmp(p.eval.score, best) === 0);
    const share = Math.floor(pot.amount / winners.length);
    let rem = pot.amount - share * winners.length;
    // ordre déterministe pour le jeton restant : premier gagnant à gauche du bouton
    winners = winners.slice().sort((a, b) =>
      ((a.seat - t.button + t.config.maxPlayers) % t.config.maxPlayers) - ((b.seat - t.button + t.config.maxPlayers) % t.config.maxPlayers));
    winners.forEach((w, i) => { const gain = share + (i < rem ? 1 : 0); w.stack += gain; wonBy[w.seat] = (wonBy[w.seat] || 0) + gain; });
  }
  h.pots = pots;
  h.results = shown.map(p => ({ seat: p.seat, won: wonBy[p.seat] || 0, hand: p.eval.score, made: EVAL.evalMade([...p.hole, ...h.board]).name }));
  finishHand(t);
}

/* ---------- clôture de la main + élimination ---------- */
function finishHand(t) {
  // NE PAS toucher p.inHand ici : le snapshot s'en sert pour décider si ses cartes doivent être révélées à
  // l'abattage (showAll && p.inHand && !p.folded). Le mettre à false EN MÊME TEMPS que l'élimination faisait
  // disparaître les cartes du joueur éliminé au lieu de les montrer (perdant d'un tapis qui finit le tournoi
  // -> "WINNER" annoncé sans jamais voir sa main). inHand repart de toute façon à true pour les actifs au
  // prochain startHand ; un joueur éliminé ne rejoue plus, donc le laisser à true ici ne fausse rien.
  occupied(t).forEach(p => { if (p.stack <= 0 && p.inHand) { p.status = 'eliminated'; } });
  t.phase = 'handComplete';
  const actives = activePlayers(t);
  if (actives.length <= 1) { t.phase = 'tournamentOver'; t.winner = actives[0] ? actives[0].id : null; }
}

/* ============================================================
   SNAPSHOT (état diffusable, cartes des autres masquées)
   ============================================================ */
function snapshot(t, viewerSeat = -1) {
  const h = t.hand;
  const showAll = t.phase !== 'playing'; // au showdown / fin, on montre
  return {
    phase: t.phase, handNo: t.handNo, button: t.button, level: t.level, lastAggressor: h ? h.lastAggressor : -1,
    blinds: t.config.levels[t.level], winner: t.winner,
    board: h ? h.board.slice() : [],
    pot: t.phase === 'playing' ? occupied(t).reduce((s, p) => s + p.committed, 0) : 0,
    currentBet: h ? h.currentBet : 0,
    toAct: h ? h.toAct : -1,
    deadline: h ? h.deadline : 0,
    street: h ? h.street : null,
    lastAction: h ? (h.lastAction || null) : null,
    pots: h ? h.pots : null,
    results: h ? h.results : null,
    equity: h ? h.equity || null : null,   // % de win par siège au tapis général
    seats: t.seats.map(p => p ? {
      seat: p.seat, id: p.id, name: p.name, isBot: p.isBot, stack: p.stack, avatar: p.avatar, avatarKind: p.avatarKind,
      status: p.status, connected: p.connected,
      bet: p.bet, committed: p.committed, folded: p.folded, allIn: p.allIn, inHand: p.inHand,
      hole: p.seat === viewerSeat ? p.hole.slice()
        : (showAll && p.inHand && !p.folded) ? p.hole.slice()
        : (showAll && p.inHand && p.folded && p.shown && (p.shown[0] || p.shown[1])) ? p.hole.map((c, i) => (p.shown[i] ? c : null)) // couché : seulement les cartes montrées
        : (p.inHand ? [null, null] : []),
    } : null),
  };
}

/* un joueur couché montre UNE carte (card=0/1) ou les deux (card indéfini) après la main */
function showCards(t, seat, card) {
  const p = t.seats[seat];
  if (!p || !p.inHand || !p.folded || t.phase !== 'handComplete') return false;
  if (!p.shown) p.shown = [false, false];
  if (card === 0 || card === 1) { if (p.shown[card]) return false; p.shown[card] = true; }
  else { if (p.shown[0] && p.shown[1]) return false; p.shown = [true, true]; }
  p.showing = true;
  return true;
}

module.exports = {
  DEFAULT_CONFIG, createTable, addPlayer, startHand, legalActions, applyAction, timeoutCurrent,
  snapshot, activePlayers, inHandPlayers, buildPots, nextActiveSeat, showCards,
};
