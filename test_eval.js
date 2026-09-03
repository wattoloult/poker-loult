/* Test de l'évaluateur de mains — node test_eval.js */
const { rank5, cmp, bestHand, HAND_NAMES } = require('./game.js');

const C = (code) => {
  const s = code[0], rc = code.slice(1);
  const r = rc === 'A' ? 14 : rc === 'K' ? 13 : rc === 'Q' ? 12 : rc === 'J' ? 11 : +rc;
  return { r, s, code };
};
const score5 = (codes) => rank5(codes.map(C));
const best = (codes) => bestHand(codes.map(C)).score;

let ok = 0, fail = 0;
function eq(label, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g === e) { ok++; }
  else { fail++; console.error(`✗ ${label}\n   attendu ${e}\n   obtenu  ${g}`); }
}
function assert(label, cond) {
  if (cond) ok++; else { fail++; console.error(`✗ ${label}`); }
}

// catégories (index dans HAND_NAMES)
eq('quinte flush royale', score5(['h10', 'hJ', 'hQ', 'hK', 'hA']), [9, 14]);
eq('quinte flush 9', score5(['h5', 'h6', 'h7', 'h8', 'h9']), [8, 9]);
eq('carré de 5', score5(['s5', 'h5', 'd5', 'c5', 'hK']), [7, 5, 13]);
eq('full 5 par K', score5(['s5', 'h5', 'd5', 'cK', 'hK']), [6, 5, 13]);
eq('couleur', score5(['h2', 'h5', 'h7', 'h9', 'hK']), [5, 13, 9, 7, 5, 2]);
eq('quinte roue A-5', score5(['hA', 's2', 'd3', 'c4', 'h5']), [4, 5]);
eq('quinte broadway', score5(['h10', 'sJ', 'dQ', 'cK', 'hA']), [4, 14]);
eq('brelan de 7', score5(['s7', 'h7', 'd7', 'c2', 'hK']), [3, 7, 13, 2]);
eq('double paire', score5(['s7', 'h7', 'd2', 'c2', 'hK']), [2, 7, 2, 13]);
eq('paire de 7', score5(['s7', 'h7', 'd2', 'c5', 'hK']), [1, 7, 13, 5, 2]);
eq('carte haute', score5(['s2', 'h5', 'd7', 'c9', 'hK']), [0, 13, 9, 7, 5, 2]);

// sélection meilleure main sur 7 cartes
eq('7 cartes -> quinte flush', best(['h2', 'h3', 'h4', 'h5', 'h6', 'sK', 'dQ']), [8, 6]);
eq('7 cartes -> full choisi', best(['s5', 'h5', 'd5', 'cK', 'hK', 'c2', 's9']), [6, 5, 13]);

// ordonnancement
assert('quinte flush > carré', cmp(score5(['h5', 'h6', 'h7', 'h8', 'h9']), score5(['s5', 'h5', 'd5', 'c5', 'hK'])) > 0);
assert('paire dames > paire valets',
  cmp(bestHand(['hQ', 'd9', 's4', 'h5', 'c8', 'hJ', 'dQ'].map(C)).score,
      bestHand(['sJ', 'h6', 's4', 'h5', 'c8', 'hJ', 'dQ'].map(C)).score) > 0);
assert('full > couleur', cmp(score5(['s5', 'h5', 'd5', 'cK', 'hK']), score5(['h2', 'h5', 'h7', 'h9', 'hK'])) > 0);
assert('meilleur kicker départage la paire',
  cmp(score5(['s7', 'h7', 'd2', 'c5', 'hA']), score5(['s7', 'h7', 'd2', 'c5', 'hK'])) > 0);

// ---- evalMade (main "faite" affichée au joueur) ----
const { evalMade, computeOuts } = require('./game.js');
const made = (codes) => evalMade(codes.map(C));
eq('made: paire préflop', made(['hA', 'cA']).cat, 1);
eq('made: hauteur préflop', made(['hK', 'c7']).cat, 0);
eq('made: nom hauteur roi', made(['hK', 'c7']).name, 'Hauteur Roi');
eq('made: brelan', made(['h9', 's9', 'd9', 'cK', 'h2']).cat, 3);
eq('made: quinte sur 7 cartes', made(['h9', 's8', 'd7', 'c6', 'h5', 'cK', 'dA']).cat, 4);
eq('made: full nommé', made(['s5', 'h5', 'd5', 'cK', 'hK', 'c2']).name, 'Full');
assert('made: paire surligne 2 cartes', made(['hA', 'cA', 'd7']).cards.length === 2);

// ---- computeOuts (cartes manquantes) ----
const outs = (hole, comm) => computeOuts(hole.map(C), comm.map(C));
(() => {
  const o = outs(['h9', 's8'], ['d7', 'c6', 'h2']); // tirage quinte bilatéral
  assert('outs: tirage quinte -> cat 4', o.length && o[0].cat === 4);
  assert('outs: quinte manque 10 et 5', o[0].ranks.includes(10) && o[0].ranks.includes(5));
})();
(() => {
  const o = outs(['hA', 'hK'], ['h7', 'h2', 's5']); // tirage couleur
  assert('outs: tirage couleur -> cat 5', o.length && o[0].cat === 5);
})();
(() => {
  const o = outs(['h9', 's9'], ['d2', 'cK', 'h5']); // set draw
  assert('outs: brelan possible sur le 9', o.some(x => x.cat === 3 && x.ranks.includes(9)));
})();
assert('outs: pas de tirage à la river', outs(['h9', 's8'], ['d7', 'c6', 'h2', 'sK', 'dQ']).length === 0);

console.log(`\n${ok} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
