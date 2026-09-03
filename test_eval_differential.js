// Test DIFFÉRENTIEL de l'évaluateur : le jeu a deux chemins de code indépendants pour juger une main —
// rank5()/bestHand() (qui désigne le GAGNANT et paie le pot) et evalMade() (qui AFFICHE "Double paire" au
// joueur). S'ils divergent, le jeu annonce une chose et en paie une autre. On vérifie qu'ils sont toujours
// d'accord sur des mains aléatoires, PUIS qu'ils ont raison sur les cas piège classiques (être d'accord ne
// suffit pas : les deux pourraient partager la même erreur). node test_eval_differential.js
'use strict';
const assert = require('assert');
const EV = require('./poker-eval.js');

/* ---------- 1. différentiel sur mains aléatoires ---------- */
const deck = EV.makeDeck();
const N = 50000;
let divergences = 0, exemple = null;
for (let i = 0; i < N; i++) {
  const pool = deck.slice(), hand = [];
  for (let k = 0; k < 7; k++) { const j = (Math.random() * pool.length) | 0; hand.push(pool[j]); pool[j] = pool[pool.length - 1]; pool.pop(); }
  if (EV.bestHand(hand).score[0] !== EV.evalMade(hand).cat) {
    divergences++;
    if (!exemple) exemple = hand.map(c => c.code).join(' ');
  }
}
assert.strictEqual(divergences, 0, `${divergences}/${N} mains où rank5 et evalMade ne sont pas d'accord (ex: ${exemple})`);

/* ---------- 2. cas piège à réponse connue ---------- */
const C = s => s.split(' ').map(x => {
  const su = x[0], rc = x.slice(1);
  const r = rc === 'A' ? 14 : rc === 'K' ? 13 : rc === 'Q' ? 12 : rc === 'J' ? 11 : +rc;
  return { r, s: su, code: x };
});
const sc = h => EV.bestHand(C(h)).score;
const cat = h => sc(h)[0];
const cmp = (a, b) => EV.cmp(sc(a), sc(b));

assert.strictEqual(cat('hA h2 d3 s4 c5 d9 dK'), 4, 'la roue A-2-3-4-5 est une quinte');
assert.strictEqual(sc('hA h2 d3 s4 c5 d9 dK')[1], 5, 'la roue est une quinte à la hauteur 5, pas à l\'As');
assert.strictEqual(cat('hA h2 h3 h4 h5 d9 dK'), 8, 'roue assortie = quinte flush (pas royale)');
assert.strictEqual(cat('hA hK hQ hJ h10 d9 c2'), 9, 'quinte flush royale');
assert.strictEqual(cat('h9 d9 s9 c9 hK h2 d5'), 7, 'carré');
assert.strictEqual(cat('h9 d9 s9 cK hK h2 h5'), 6, 'full');
assert.strictEqual(cat('h2 h5 h9 hJ hK d9 c3'), 5, 'couleur');

assert(cmp('h2 h5 h9 hJ hK s3 c4', 'c6 h7 d8 s9 c10 d2 hA') > 0, 'couleur > quinte');
assert(cmp('h9 d9 s9 cK hK h2 h5', 'h2 h5 h9 hJ hK s3 c4') > 0, 'full > couleur');
assert(cmp('h9 d9 s9 c9 hK h2 d5', 'h9 d9 s9 cK hK h2 h5') > 0, 'carré > full');
assert(cmp('h5 h6 h7 h8 h9 d2 c3', 'h9 d9 s9 c9 hK h2 d5') > 0, 'quinte flush > carré');
assert(cmp('c6 h2 d3 s4 c5 d9 dK', 'hA h2 d3 s4 c5 d9 dK') > 0, 'quinte 6-haute > roue');
assert(cmp('h9 d9 sA c7 h4 d2 c3', 'h9 d9 sK c7 h4 d2 c3') > 0, 'kicker As > kicker Roi');
assert(cmp('hA dA s2 c7 h4 d9 c3', 'hK dK s2 c7 h4 d9 c3') > 0, 'paire d\'As > paire de Rois');
assert.strictEqual(cmp('h2 d3 sA cK hQ dJ c10', 'h4 d5 sA cK hQ dJ c10'), 0, 'board qui joue -> égalité parfaite (pot partagé)');

console.log(`test_eval_differential.js : OK — ${N} mains aléatoires sans divergence entre les 2 évaluateurs, + 15 cas piège corrects`);
