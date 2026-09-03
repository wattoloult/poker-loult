// Vérif du calcul outs + proba de toucher (même formule que outsInfo() dans play.js).
// Lancer : node test_outs.js
const EV = require('./poker-eval.js');

// Construit une carte depuis le deck réel (garantit r/s corrects)
const deck = EV.makeDeck();
const card = (code) => { const c = deck.find(x => x.code === code); if (!c) throw new Error('carte inconnue ' + code); return c; };

function outsInfo(hole, board, targetCat) {
  const known = new Set([...hole, ...board].map(c => c.code));
  const d = EV.makeDeck().filter(c => !known.has(c.code));
  let outs = 0;
  for (const c of d) if (EV.evalMade([...hole, ...board, c]).cat >= targetCat) outs++;
  const u = d.length, no = u - outs;
  const pct = board.length === 4 ? outs / u : 1 - (no * (no - 1)) / (u * (u - 1));
  return { outs, pct: Math.round(pct * 100) };
}

let ok = 0, fail = 0;
function eq(actual, expected, label) {
  if (actual === expected) { ok++; }
  else { fail++; console.error(`FAIL ${label}: attendu ${expected}, obtenu ${actual}`); }
}

// Tirage couleur au flop : h8 h3 | hK h6 c2 -> 9 coeurs restants, ~35% (règle de 4)
const flushCat = EV.HAND_NAMES.indexOf('Couleur');
let hole = [card('h8'), card('h3')], board = [card('hK'), card('h6'), card('c2')];
eq(outsInfo(hole, board, flushCat).outs, 9, 'flush draw flop outs');
eq(outsInfo(hole, board, flushCat).pct, 35, 'flush draw flop %');

// Même tirage au turn (1 carte à venir) : 9/46 ~= 20%
board = [card('hK'), card('h6'), card('c2'), card('s9')];
eq(outsInfo(hole, board, flushCat).outs, 9, 'flush draw turn outs');
eq(outsInfo(hole, board, flushCat).pct, 20, 'flush draw turn %');

// Tirage quinte par les deux bouts : h9 c8 | d7 s6 c2 -> 8 outs (quatre 10, quatre 5)
const straightCat = EV.HAND_NAMES.indexOf('Quinte');
hole = [card('h9'), card('c8')]; board = [card('d7'), card('s6'), card('c2')];
eq(outsInfo(hole, board, straightCat).outs, 8, 'OESD flop outs');

console.log(`${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
