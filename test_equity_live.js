// Test autonome : vérifie equityAt() (recalcul en temps réel du % de win, voir play.js) sans navigateur.
// Réimplémente la même logique en Node en s'appuyant sur poker-eval.js (partagé client/serveur).
const assert = require('assert');
const EV = require('./poker-eval.js');
const C = (code) => { const r = code.slice(0, -1), s = code.slice(-1); const rc = { A: 14, K: 13, Q: 12, J: 11 }[r] || +r; return { r: rc, s, code }; };

function equityAt(cont, board) {
  const known = new Set(board.map(c => c.code));
  cont.forEach(p => p.hole.forEach(c => known.add(c.code)));
  const deck = EV.makeDeck().filter(c => !known.has(c.code));
  const need = 5 - board.length;
  const win = {}; cont.forEach(p => win[p.seat] = 0); let total = 0;
  const tally = (full) => {
    let best = null, winners = [];
    for (const p of cont) { const sc = EV.bestHand(p.hole.concat(full)).score; const c = best ? EV.cmp(sc, best) : 1; if (c > 0) { best = sc; winners = [p.seat]; } else if (c === 0) winners.push(p.seat); }
    const share = 1 / winners.length; winners.forEach(seat => win[seat] += share); total++;
  };
  if (need === 0) tally(board);
  else { const rec = (start, acc) => { if (acc.length === need) return tally(board.concat(acc)); for (let j = start; j < deck.length; j++) { acc.push(deck[j]); rec(j + 1, acc); acc.pop(); } }; rec(0, []); }
  const eq = {}; cont.forEach(p => eq[p.seat] = Math.round(win[p.seat] / total * 100));
  return eq;
}

// 1) River complète : AA vs KK sur un board sans lien -> AA doit gagner à 100%
{
  const cont = [{ seat: 0, hole: [C('Ah'), C('Ad')] }, { seat: 1, hole: [C('Kh'), C('Kd')] }];
  const board = ['2c', '7d', '9s', 'Jc', '4h'].map(C);
  const eq = equityAt(cont, board);
  assert.strictEqual(eq[0], 100, 'AA doit gagner à 100% à la river');
  assert.strictEqual(eq[1], 0, 'KK doit perdre à 0% à la river');
}

// 2) Turn (1 carte à venir) : AA vs KK sur board sans tirage pour KK -> AA archi favori (~95%+), somme = 100
{
  const cont = [{ seat: 0, hole: [C('Ah'), C('Ad')] }, { seat: 1, hole: [C('Kh'), C('Kd')] }];
  const board = ['2c', '7d', '9s', 'Jc'].map(C);
  const eq = equityAt(cont, board);
  assert.ok(eq[0] > 85, `AA doit rester grand favori au turn, eq=${eq[0]}`);
  assert.strictEqual(eq[0] + eq[1], 100, 'les % doivent sommer à 100 (à l\'arrondi près)');
}

// 3) Équité qui BOUGE d'une rue à l'autre (le point du #10) : flop où KK a un tirage couleur, puis river qui le complète
//    AA en trèfle/pique (aucun cœur) pour ne pas fausser le test avec une couleur accidentelle côté AA.
{
  const cont = [{ seat: 0, hole: [C('As'), C('Ad')] }, { seat: 1, hole: [C('Kh'), C('Kd')] }];
  const flop = ['2h', '7h', '9h'].map(C);          // KK a déjà 4 cœurs (Kh + 3 au board) : tirage couleur nut
  const eqFlop = equityAt(cont, flop);
  const riverColor = ['2h', '7h', '9h', '3s', 'Qh'].map(C); // river complète la couleur cœur pour KK
  const eqRiver = equityAt(cont, riverColor);
  assert.ok(eqRiver[1] === 100 && eqRiver[0] === 0, 'la couleur cœur au river doit faire gagner KK à 100%');
  assert.ok(eqFlop[1] < eqRiver[1], `l'équité de KK doit AUGMENTER du flop (${eqFlop[1]}%) au river une fois la couleur tombée (${eqRiver[1]}%)`);
}

console.log('test_equity_live.js : 3/3 OK — équité recalculée correctement à chaque rue, et elle varie bien street par street');
