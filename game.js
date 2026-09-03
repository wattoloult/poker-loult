/* ============================================================
   POKER LOULT — Texas Hold'em (faux argent) — Ronflex croupier
   ============================================================ */

const SUITS = ['h', 'd', 's', 'c'];
const START_STACK = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const N = 4;
const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte',
                    'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------- Modèle ---------- */
function rankCode(r) { return r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : '' + r; }
function rankLabel(r, plural) {
  if (r === 14) return 'As';
  if (r === 13) return plural ? 'Rois' : 'Roi';
  if (r === 12) return plural ? 'Dames' : 'Dame';
  if (r === 11) return plural ? 'Valets' : 'Valet';
  return '' + r;
}
function makeDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ r, s, code: s + rankCode(r) });
  return d;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const G = {
  players: [], deck: [], community: [], pot: 0, button: 0,
  currentBet: 0, minRaise: BIG_BLIND, street: 'idle', rebuys: 0, revealed: false,
};

function initPlayers() {
  const names = ['Toi', 'Miaouss', 'Roucool', 'Évoli'];
  G.players = names.map((name, i) => ({
    id: i, name, isHuman: i === 0,
    stack: START_STACK, cards: [], bet: 0, committed: 0,
    folded: false, allIn: false, acted: false, eval: null, made: null, _won: 0,
    seatEl: $('#seat-' + i),
  }));
  G.players.forEach(renderSeatShell);
}

/* ============================================================
   ÉVALUATION — score comparable (meilleure main de 5 parmi 7)
   ============================================================ */
function rank5(cards) {
  const ranks = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }
  const cnt = {}; ranks.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.entries(cnt).map(([r, c]) => [c, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const counts = groups.map(g => g[0]);
  const byCount = groups.map(g => g[1]);
  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (counts[0] === 4) return [7, ...byCount];
  if (counts[0] === 3 && counts[1] === 2) return [6, ...byCount];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (counts[0] === 3) return [3, ...byCount];
  if (counts[0] === 2 && counts[1] === 2) return [2, ...byCount];
  if (counts[0] === 2) return [1, ...byCount];
  return [0, ...byCount];
}
function cmp(a, b) { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function combos5(cards) {
  const res = [], n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++)
      res.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
  return res;
}
function bestHand(cards) {
  let best = null;
  for (const combo of combos5(cards)) { const s = rank5(combo); if (!best || cmp(s, best.score) > 0) best = { score: s, cards: combo }; }
  return best;
}

/* ============================================================
   MAIN "FAITE" (catégorie + cartes clés) pour l'affichage + outs
   Fonctionne avec 2 à 7 cartes.
   ============================================================ */
function findStraight(cards) {
  const have = {}; cards.forEach(c => { if (!have[c.r]) have[c.r] = c; });
  for (let high = 14; high >= 5; high--) {
    const seq = [];
    for (let k = 0; k < 5; k++) { let r = high - k; seq.push(r === 1 ? 14 : r); }
    if (seq.every(r => have[r])) return { high, cards: seq.map(r => have[r]) };
  }
  return null;
}
function nameFor(cat, cards) {
  const top = Math.max(...cards.map(c => c.r));
  switch (cat) {
    case 9: return 'Quinte flush royale';
    case 8: return 'Quinte flush';
    case 7: return 'Carré de ' + rankLabel(cards[0].r, true);
    case 6: return 'Full';
    case 5: return 'Couleur';
    case 4: return 'Quinte';
    case 3: return 'Brelan de ' + rankLabel(cards[0].r, true);
    case 2: return 'Double paire';
    case 1: return 'Paire de ' + rankLabel(cards[0].r, true);
    default: return 'Hauteur ' + rankLabel(top, false);
  }
}
function evalMade(cards) {
  const byRank = {}; cards.forEach(c => (byRank[c.r] = byRank[c.r] || []).push(c));
  const bySuit = {}; cards.forEach(c => (bySuit[c.s] = bySuit[c.s] || []).push(c));
  const ranksDesc = [...new Set(cards.map(c => c.r))].sort((a, b) => b - a);
  const mk = (cat, cs) => ({ cat, cards: cs, name: nameFor(cat, cs) });

  // quinte flush
  for (const s in bySuit) if (bySuit[s].length >= 5) { const sf = findStraight(bySuit[s]); if (sf) return mk(sf.high === 14 ? 9 : 8, sf.cards); }
  // carré
  const quad = ranksDesc.find(r => byRank[r].length === 4);
  if (quad) return mk(7, byRank[quad].slice(0, 4));
  // full
  const trips = ranksDesc.filter(r => byRank[r].length >= 3);
  const pairs = ranksDesc.filter(r => byRank[r].length >= 2);
  if (trips.length && pairs.some(r => r !== trips[0])) {
    const p = pairs.find(r => r !== trips[0]);
    return mk(6, [...byRank[trips[0]].slice(0, 3), ...byRank[p].slice(0, 2)]);
  }
  // couleur
  for (const s in bySuit) if (bySuit[s].length >= 5) return mk(5, bySuit[s].slice().sort((a, b) => b.r - a.r).slice(0, 5));
  // quinte
  const st = findStraight(cards); if (st) return mk(4, st.cards);
  // brelan
  if (trips.length) return mk(3, byRank[trips[0]].slice(0, 3));
  // double paire
  if (pairs.length >= 2) return mk(2, [...byRank[pairs[0]].slice(0, 2), ...byRank[pairs[1]].slice(0, 2)]);
  // paire
  if (pairs.length) return mk(1, byRank[pairs[0]].slice(0, 2));
  // hauteur
  const hi = cards.slice().sort((a, b) => b.r - a.r)[0];
  return mk(0, [hi]);
}

/* Outs : cartes manquantes (1 seule) qui améliorent vers double paire ou mieux */
function computeOuts(hole, community) {
  if (community.length < 3 || community.length >= 5) return []; // seulement flop & turn
  const known = new Set([...hole, ...community].map(c => c.code));
  const cur = evalMade([...hole, ...community]).cat;
  const byCat = {};
  for (const c of makeDeck()) {
    if (known.has(c.code)) continue;
    const cat = evalMade([...hole, ...community, c]).cat;
    if (cat > cur && cat >= 2) (byCat[cat] = byCat[cat] || new Set()).add(c.r);
  }
  return Object.keys(byCat).map(Number).sort((a, b) => b - a)
    .map(cat => ({ cat, ranks: [...byCat[cat]].sort((a, b) => b - a) }));
}

/* ============================================================
   RENDU / UI
   ============================================================ */
function renderSeatShell(p) {
  p.seatEl.innerHTML = `
    <div class="hand"></div>
    <div class="status"></div>
    <div class="nameplate"><div class="pname">${p.name}</div><div class="stack">${p.stack}</div></div>
    <div class="bet-chips"><span>0</span></div>`;
  p.handEl = p.seatEl.querySelector('.hand');
  p.statusEl = p.seatEl.querySelector('.status');
  p.stackEl = p.seatEl.querySelector('.stack');
  p.chipsEl = p.seatEl.querySelector('.bet-chips');
  p.chipsAmtEl = p.chipsEl.querySelector('span');
}
function updateUI() {
  $('#pot-amount').textContent = G.pot;
  G.players.forEach(p => {
    p.stackEl.textContent = p.stack;
    p.chipsAmtEl.textContent = p.bet;
    p.chipsEl.classList.toggle('show', p.bet > 0);
    p.seatEl.classList.toggle('folded', p.folded);
  });
}
function setStatus(p, txt) { p.statusEl.textContent = txt; }
function setActive(idx) { G.players.forEach((p, i) => p.seatEl.classList.toggle('active', i === idx)); }
function clearActive() { G.players.forEach(p => p.seatEl.classList.remove('active')); }

function makeCard(data) {
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<div class="card-inner"><div class="face back"></div>
      <div class="face front" style="background-image:url('cards/${data.code}.png')"></div></div>`;
  el._data = data;
  return el;
}
async function dealCardTo(container, data, faceUp, fast) {
  const card = makeCard(data);
  container.appendChild(card);
  const deck = $('#deck').getBoundingClientRect();
  const dest = card.getBoundingClientRect();
  const dx = deck.left - dest.left, dy = deck.top - dest.top;
  card.style.transition = 'none';
  card.style.transform = `translate(${dx}px,${dy}px) rotate(-8deg)`;
  card.getBoundingClientRect();
  card.style.transition = 'transform .3s ease';
  card.style.transform = '';
  if (faceUp) setTimeout(() => card.classList.add('flipped'), 160);
  await sleep(fast ? 90 : 150);
  return card;
}
function flipUp(p) { [...p.handEl.children].forEach(c => c.classList.add('flipped')); }

/* ---------- Bulle de Ronflex ---------- */
let bubbleTimer = null;
function ronflex(msg, ms = 1400) {
  const b = $('#ronflex-bubble');
  b.textContent = msg; b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), ms);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- Barre d'info du joueur ---------- */
function clearMade() { document.querySelectorAll('.card.made').forEach(c => c.classList.remove('made')); }
function updateHumanInfo() {
  const me = G.players[0];
  clearMade();
  if (me.folded || me.cards.length < 2) { $('#hand-name').textContent = ''; $('#hand-outs').textContent = ''; return; }
  const made = evalMade([...me.cards, ...G.community]);
  const codes = new Set(made.cards.map(c => c.code));
  me.handEl.querySelectorAll('.card').forEach(c => { if (codes.has(c._data.code)) c.classList.add('made'); });
  $('#community').querySelectorAll('.card').forEach(c => { if (codes.has(c._data.code)) c.classList.add('made'); });
  $('#hand-name').textContent = 'Ta main : ' + made.name;

  const outs = computeOuts(me.cards, G.community);
  if (outs.length) {
    const best = outs[0];
    const ranks = best.ranks.slice(0, 4).map(r => rankLabel(r, false)).join(', ');
    $('#hand-outs').textContent = `Out : ${ranks} → ${HAND_NAMES[best.cat]}`;
  } else $('#hand-outs').textContent = '';
}

/* ============================================================
   DÉROULÉ D'UNE MAIN
   ============================================================ */
function livePlayers() { return G.players.filter(p => !p.folded); }
function actablePlayers() { return G.players.filter(p => !p.folded && !p.allIn); }

async function startHand() {
  hideAnnounce();
  $('#btn-next').hidden = true;
  clearMade();
  document.querySelectorAll('.card.win').forEach(c => c.classList.remove('win'));
  $('#hand-name').textContent = ''; $('#hand-outs').textContent = '';

  G.players.forEach(p => { if (p.stack <= 0) { p.stack = START_STACK; G.rebuys++; setStatus(p, 'Recave'); } }); // ponytail: recave illimitée
  G.players.forEach(p => {
    p.cards = []; p.bet = 0; p.committed = 0; p.folded = false; p.allIn = false;
    p.acted = false; p.eval = null; p.made = null; p._won = 0; p.handEl.innerHTML = '';
    if (p.statusEl.textContent !== 'Recave') setStatus(p, '');
  });
  $('#community').innerHTML = ''; G.community = []; G.pot = 0; G.revealed = false;
  G.deck = shuffle(makeDeck());
  G.button = (G.button + 1) % N;
  updateDealerButton();
  updateUI();

  const sb = (G.button + 1) % N, bb = (G.button + 2) % N;
  postBlind(G.players[sb], SMALL_BLIND);
  postBlind(G.players[bb], BIG_BLIND);
  G.currentBet = BIG_BLIND; G.minRaise = BIG_BLIND;
  updateUI();

  // Ronflex distribue, 1 carte à la fois, rapidement
  G.street = 'preflop';
  ronflex('Distribution !', 1200);
  const flavor = ['Tenez !', 'Voilà', 'Et hop', 'Bonne chance'];
  for (let round = 0; round < 2; round++) {
    for (let k = 0; k < N; k++) {
      const p = G.players[(sb + k) % N];
      const data = G.deck.pop();
      p.cards.push(data);
      await dealCardTo(p.handEl, data, p.isHuman, true);
      if (Math.random() < 0.25) ronflex(pick(flavor), 700);
    }
  }
  updateHumanInfo();
  await sleep(250);
  await bettingRound((G.button + 3) % N);
  await runStreets();
}

function updateDealerButton() {
  document.querySelectorAll('.dealer-btn').forEach(e => e.remove());
  const b = document.createElement('div'); b.className = 'dealer-btn'; b.textContent = 'D';
  G.players[G.button].seatEl.querySelector('.nameplate').appendChild(b);
}
function postBlind(p, amt) {
  const pay = Math.min(amt, p.stack);
  p.stack -= pay; p.bet += pay; p.committed += pay; G.pot += pay;
  if (p.stack === 0) p.allIn = true;
}

async function runStreets() {
  const deals = { flop: 3, turn: 1, river: 1 };
  const labels = { flop: 'Le flop…', turn: 'La turn', river: 'La river' };
  for (const street of ['flop', 'turn', 'river']) {
    if (livePlayers().length <= 1) break;
    maybeRevealAllIn();
    G.street = street;
    G.players.forEach(p => { p.bet = 0; p.acted = false; });
    G.currentBet = 0; G.minRaise = BIG_BLIND;
    G.deck.pop(); // brûle
    ronflex(labels[street], 1100);

    // pose les cartes face cachée puis retourne une par une (flop cool)
    const cards = [];
    for (let i = 0; i < deals[street]; i++) {
      const data = G.deck.pop(); G.community.push(data);
      cards.push(await dealCardTo($('#community'), data, false, true));
    }
    for (const card of cards) {
      card.classList.add('flipped', 'pop');
      card.addEventListener('animationend', () => card.classList.remove('pop'), { once: true });
      await sleep(street === 'flop' ? 300 : 220);
    }
    updateUI();
    updateHumanInfo();
    if (livePlayers().length === 2 && street === 'flop') ronflex('Tête-à-tête !', 1200);
    await sleep(300);

    if (actablePlayers().length >= 2) await bettingRound((G.button + 1) % N);
  }
  await showdown();
}

/* révèle toutes les mains quand il n'y a plus rien à miser (tapis général) */
function maybeRevealAllIn() {
  if (!G.revealed && livePlayers().length > 1 && actablePlayers().length < 2) {
    livePlayers().forEach(p => { if (!p.isHuman) flipUp(p); });
    ronflex('Tapis ! On abat.', 1500);
    G.revealed = true;
  }
}

/* ---------- Tour d'enchères ---------- */
function roundSettled() {
  if (livePlayers().length <= 1) return true;
  return actablePlayers().every(p => p.acted && p.bet === G.currentBet);
}
async function bettingRound(firstIdx) {
  let idx = firstIdx, guard = 0;
  while (guard++ < 400) {
    if (roundSettled()) break;
    const p = G.players[idx];
    if (p.folded || p.allIn) { idx = (idx + 1) % N; continue; }
    setActive(idx);
    const dec = p.isHuman ? await humanTurn(p) : await botTurn(p);
    applyAction(p, dec.type, dec.amount);
    updateUI();
    await sleep(p.isHuman ? 80 : 240);
    idx = (idx + 1) % N;
  }
  clearActive(); clearControls();
  G.players.forEach(p => { p.bet = 0; });
  updateUI();
}
function applyAction(p, type, amount) {
  p.acted = true;
  if (type === 'fold') { p.folded = true; setStatus(p, 'Couché'); if (p.isHuman) updateHumanInfo(); return; }
  if (type === 'check') { setStatus(p, 'Check'); return; }
  if (type === 'call') {
    const pay = Math.min(G.currentBet - p.bet, p.stack);
    p.stack -= pay; p.bet += pay; p.committed += pay; G.pot += pay;
    if (p.stack === 0) { p.allIn = true; setStatus(p, 'All-in'); ronflex(pick(['Tapis !', 'Ça suit tapis !']), 1100); }
    else setStatus(p, 'Suit');
    return;
  }
  if (type === 'raise') {
    const target = Math.min(amount, p.bet + p.stack);
    const inc = target - G.currentBet, pay = target - p.bet;
    p.stack -= pay; p.bet = target; p.committed += pay; G.pot += pay;
    G.currentBet = target;
    if (inc >= G.minRaise) G.minRaise = inc;
    G.players.forEach(o => { if (o !== p && !o.folded && !o.allIn) o.acted = false; });
    if (p.stack === 0) { p.allIn = true; setStatus(p, 'Tapis ' + target); ronflex(pick(['Tapis !', 'Oh là là !', 'Ça envoie !']), 1200); }
    else setStatus(p, 'Relance ' + target);
    return;
  }
}

/* ---------- Tour du joueur ---------- */
function humanTurn(p) {
  return new Promise(resolve => {
    const toCall = G.currentBet - p.bet;
    const foldB = $('#btn-fold'), checkB = $('#btn-check'), callB = $('#btn-call');
    const allinB = $('#btn-allin'), raiseB = $('#btn-raise'), slider = $('#raise-slider'), amtL = $('#raise-amount');
    const raiseBox = $('#raise-box');

    foldB.disabled = false;
    checkB.hidden = toCall > 0; checkB.disabled = false;
    callB.hidden = toCall <= 0; callB.disabled = false;
    callB.textContent = toCall >= p.stack ? `All-in (${p.stack})` : `Suivre ${toCall}`;
    allinB.hidden = p.stack <= 0; allinB.disabled = false;

    const minRaiseTo = G.currentBet + G.minRaise, allInTo = p.bet + p.stack;
    const canRaise = p.stack > toCall && allInTo > minRaiseTo;
    raiseBox.style.display = canRaise ? 'flex' : 'none';
    if (canRaise) {
      slider.min = minRaiseTo; slider.max = allInTo; slider.step = SMALL_BLIND;
      slider.value = Math.min(minRaiseTo, allInTo); amtL.textContent = slider.value;
    }
    slider.oninput = () => amtL.textContent = (+slider.value === +slider.max ? slider.value + ' (tapis)' : slider.value);

    const finish = (dec) => { slider.oninput = null; [foldB, checkB, callB, allinB, raiseB].forEach(b => b.onclick = null); resolve(dec); };
    foldB.onclick = () => finish({ type: 'fold' });
    checkB.onclick = () => finish({ type: 'check' });
    callB.onclick = () => finish({ type: 'call' });
    raiseB.onclick = () => finish({ type: 'raise', amount: +slider.value });
    allinB.onclick = () => finish(allInTo > G.currentBet ? { type: 'raise', amount: allInTo } : { type: 'call' });
  });
}
function clearControls() {
  ['#btn-fold', '#btn-check', '#btn-call', '#btn-allin', '#btn-raise'].forEach(s => $(s).disabled = true);
  $('#raise-box').style.display = 'none';
}

/* ---------- IA ---------- */
function estimateStrength(p) {
  if (G.community.length === 0) {
    const [a, b] = p.cards.map(c => c.r).sort((x, y) => y - x);
    let s = (a - 2) / 12 * 0.5 + (b - 2) / 12 * 0.2;
    if (a === b) s += 0.35;
    if (p.cards[0].s === p.cards[1].s) s += 0.08;
    if (a - b === 1) s += 0.05;
    return Math.min(1, s);
  }
  const best = bestHand([...p.cards, ...G.community]);
  return Math.min(1, best.score[0] / 7 + best.score[1] / 200);
}
async function botTurn(p) {
  await sleep(320 + Math.random() * 380);
  const toCall = G.currentBet - p.bet;
  const str = estimateStrength(p) + (Math.random() - 0.5) * 0.15;
  const potOdds = toCall / (G.pot + toCall || 1);
  const bluff = Math.random() < 0.08;
  if (toCall === 0) {
    if (str > 0.62 || bluff) {
      const raiseTo = Math.min(p.bet + p.stack, G.currentBet + Math.max(G.minRaise, Math.round(G.pot * (0.4 + Math.random() * 0.4))));
      if (raiseTo > G.currentBet) return { type: 'raise', amount: raiseTo };
    }
    return { type: 'check' };
  }
  if (str < potOdds * 0.85 && !bluff) {
    if (toCall <= BIG_BLIND && Math.random() < 0.5) return { type: 'call' };
    return { type: 'fold' };
  }
  if (str > 0.78 && Math.random() < 0.7) {
    const raiseTo = Math.min(p.bet + p.stack, G.currentBet + Math.max(G.minRaise, Math.round(G.pot * 0.6)));
    if (raiseTo > G.currentBet + G.minRaise - 1) return { type: 'raise', amount: raiseTo };
  }
  return { type: 'call' };
}

/* ============================================================
   ABATTAGE + GAINS (side pots)
   ============================================================ */
async function showdown() {
  clearActive(); clearMade();
  $('#hand-name').textContent = ''; $('#hand-outs').textContent = '';
  const live = livePlayers();

  if (live.length === 1) {
    const w = live[0]; const gain = G.pot; w.stack += gain; G.pot = 0; updateUI();
    announce(`${w.name} remporte ${gain}`); endHand(); return;
  }
  live.forEach(p => { if (!p.isHuman) flipUp(p); p.eval = bestHand([...p.cards, ...G.community]); p.made = evalMade([...p.cards, ...G.community]); });
  await sleep(750);

  const results = awardPots();
  updateUI();
  const top = results[results.length - 1];
  if (top) {
    const codes = new Set(); top.winners.forEach(w => w.made.cards.forEach(c => codes.add(c.code)));
    highlightWinners(codes, top.winners);
    const w = top.winners[0];
    announce(`${top.winners.map(x => x.name).join(' & ')} gagne avec ${w.made.name} — +${w._won}`);
    if (w.made.cat >= 6) ronflex(pick(['WOW !', 'Incroyable !', 'Quelle main !']), 2200);
    else if (w.made.cat >= 4) ronflex(pick(['Wow !', 'Joli !']), 1800);
    else ronflex('Bien joué !', 1600);
  }
  endHand();
}
function awardPots() {
  const active = G.players.filter(p => p.committed > 0);
  const levels = [...new Set(active.map(p => p.committed))].sort((a, b) => a - b);
  let prev = 0; const results = [];
  for (const lvl of levels) {
    let potAmt = 0;
    for (const p of G.players) potAmt += Math.max(0, Math.min(p.committed, lvl) - prev);
    const eligible = G.players.filter(p => !p.folded && p.committed >= lvl && p.eval);
    if (eligible.length && potAmt > 0) {
      let bestScore = eligible[0].eval.score;
      eligible.forEach(p => { if (cmp(p.eval.score, bestScore) > 0) bestScore = p.eval.score; });
      const winners = eligible.filter(p => cmp(p.eval.score, bestScore) === 0);
      const share = Math.floor(potAmt / winners.length);
      winners.forEach(w => { w.stack += share; w._won += share; });
      const rem = potAmt - share * winners.length;
      winners[0].stack += rem; winners[0]._won += rem;
      results.push({ winners, amount: potAmt });
    }
    prev = lvl;
  }
  G.pot = 0; return results;
}
function highlightWinners(codes, winners) {
  winners.forEach(w => w.handEl.querySelectorAll('.card').forEach(c => { if (codes.has(c._data.code)) c.classList.add('win'); }));
  $('#community').querySelectorAll('.card').forEach(c => { if (codes.has(c._data.code)) c.classList.add('win'); });
}
function endHand() { G.street = 'idle'; clearControls(); $('#btn-next').hidden = false; }

function announce(txt) { const a = $('#announce'); a.textContent = txt; a.classList.add('show'); }
function hideAnnounce() { $('#announce').classList.remove('show'); }

/* ============================================================
   RESPONSIVE : ajuste la table à l'écran
   ============================================================ */
function fitBoard() {
  const board = $('#board');
  const reserved = $('#controls').offsetHeight + $('#hand-info').offsetHeight + 10;
  const availH = window.innerHeight - reserved;
  const availW = window.innerWidth - 6;
  const bw = Math.min(availW, availH * 1.5), bh = bw / 1.5;
  board.style.width = bw + 'px'; board.style.height = bh + 'px';
}

/* ============================================================
   BOOT
   ============================================================ */
function boot() {
  initPlayers();
  fitBoard();
  window.addEventListener('resize', fitBoard);
  window.addEventListener('orientationchange', () => setTimeout(fitBoard, 200));
  $('#btn-next').onclick = () => startHand();
  clearControls();
  startHand();
}
if (typeof document !== 'undefined') boot();
if (typeof module !== 'undefined') module.exports = { rank5, cmp, bestHand, makeDeck, HAND_NAMES, evalMade, findStraight, computeOuts };
