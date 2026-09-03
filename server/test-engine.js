/* Tests du moteur autoritaire — node server/test-engine.js */
'use strict';
const E = require('./poker-engine.js');

let ok = 0, fail = 0;
function assert(label, cond) { if (cond) ok++; else { fail++; console.error('✗ ' + label); } }
function eq(label, got, exp) { const g = JSON.stringify(got), e = JSON.stringify(exp); if (g === e) ok++; else { fail++; console.error(`✗ ${label}\n   attendu ${e}\n   obtenu  ${g}`); } }

const codeToCard = (code) => { const s = code[0], rc = code.slice(1); const r = rc === 'A' ? 14 : rc === 'K' ? 13 : rc === 'Q' ? 12 : rc === 'J' ? 11 : +rc; return { r, s, code }; };
function scriptedShuffle(drawCodes) {
  return (fresh) => { const used = new Set(drawCodes); const rest = fresh.filter(c => !used.has(c.code)); return [...rest, ...drawCodes.map(codeToCard).reverse()]; };
}
// blindes FIXES pour les tests (indépendant de la progression de prod)
const TEST_LEVELS = [{ sb: 200, bb: 400 }, { sb: 300, bb: 600 }, { sb: 400, bb: 800 }, { sb: 500, bb: 1000 }];
function tableWith(n, drawCodes, stacks) {
  const t = E.createTable({ levels: TEST_LEVELS }, drawCodes ? scriptedShuffle(drawCodes) : undefined);
  for (let i = 0; i < n; i++) E.addPlayer(t, { id: 'p' + i, name: 'P' + i, isBot: i > 0 });
  if (stacks) stacks.forEach((s, i) => { t.seats[i].stack = s; });
  return t;
}
const act = (t, seat, type, amount) => E.applyAction(t, seat, { type, amount });

/* ---------- 1. Blindes + pot + positions (6 joueurs) ---------- */
(() => {
  const t = tableWith(6);
  E.startHand(t);
  eq('button 1re main = siège 0', t.button, 0);
  eq('SB siège 1', t.hand.sbSeat, 1);
  eq('BB siège 2', t.hand.bbSeat, 2);
  eq('SB stack -200', t.seats[1].stack, 9800);
  eq('BB stack -400', t.seats[2].stack, 9600);
  const pot = t.seats.reduce((s, p) => s + (p ? p.committed : 0), 0);
  eq('pot = 600', pot, 600);
  eq('premier à parler = UTG siège 3', t.hand.toAct, 3);
  assert('chaque joueur a 2 cartes', t.seats.every(p => p.hole.length === 2));
  assert('un seul joueur actif', t.seats.filter(p => p.seat === t.hand.toAct).length === 1);
})();

/* ---------- 2. Heads-up : positions & premier à parler ---------- */
(() => {
  const t = tableWith(2);
  E.startHand(t);
  eq('HU: SB = bouton', t.hand.sbSeat, t.button);
  eq('HU: BB = autre', t.hand.bbSeat, 1);
  eq('HU: bouton parle en premier préflop', t.hand.toAct, t.button);
})();

/* ---------- 3. Option de la BB préflop (tout le monde limp) ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t); // button0 sb1 bb2, premier = 0
  eq('call ok', act(t, 0, 'call').ok, true);
  eq('SB complète', act(t, 1, 'call').ok, true);
  eq('toAct = BB', t.hand.toAct, 2);
  eq('BB peut checker', E.legalActions(t, 2).canCheck, true);
  act(t, 2, 'check');
  eq('passage au flop', t.hand.street, 'flop');
  eq('flop = 3 cartes', t.hand.board.length, 3);
})();

/* ---------- 4. Calcul de la relance minimale ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t);
  act(t, 0, 'raise', 1200);                 // inc 800 >= 400
  eq('currentBet 1200', t.hand.currentBet, 1200);
  eq('minRaise = 800', t.hand.minRaise, 800);
  eq('relance min suivante = 2000', E.legalActions(t, 1).minRaiseTo, 2000);
})();

/* ---------- 5. Fold général -> dernier gagne sans showdown ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t);
  act(t, 0, 'fold'); act(t, 1, 'fold');
  eq('main terminée', t.phase, 'handComplete');
  eq('gain par fold', t.hand.results[0].byFold, true);
  eq('BB (siège2) récupère les blindes', t.seats[2].stack, 10000 + 200); // gagne le SB (200), a payé BB 400 puis récupéré
})();

/* ---------- 6. Side pots à 3 tapis inégaux + attribution ---------- */
(() => {
  const draw = ['hK', 'h3', 'hA', 'dK', 'd4', 'dA', 'c5', 'c2', 'd7', 's9', 'c6', 'hJ', 'c8', 'sQ'];
  // ordre distrib [1,2,0] : S1=hK/dK(paire K), S2=h3/d4(hauteur), S0=hA/dA(paire A). Board c2 d7 s9 hJ sQ
  const t = tableWith(3, draw, [2000, 5000, 10000]);
  E.startHand(t); // button0 sb1 bb2 ; premier = 0
  act(t, 0, 'allin'); // A tapis 2000
  act(t, 1, 'allin'); // B tapis 5000
  act(t, 2, 'allin'); // C tapis 10000
  const pots = E.buildPots(t).map(p => p.amount);
  eq('3 pots [6000,6000,5000]', pots, [6000, 6000, 5000]);
  eq('A (siège0, paire A) gagne main pot', t.seats[0].stack, 6000);
  eq('B (siège1, paire K) gagne side pot 1', t.seats[1].stack, 6000);
  eq('C (siège2) reprend son side pot 2', t.seats[2].stack, 5000);
  eq('conservation des jetons', t.seats[0].stack + t.seats[1].stack + t.seats[2].stack, 17000);
})();

/* ---------- 7. Égalité -> partage du pot (broadway au tableau) ---------- */
(() => {
  // HU : S0=c2/d3, S1=s4/h5 (petites cartes) ; board 10-J-Q-K-A -> les deux jouent le tableau => égalité
  const draw = ['c2', 's4', 'd3', 'h5', 'c7', 's10', 'dJ', 'cQ', 'c8', 'hK', 'c9', 'dA'];
  const t = tableWith(2, draw, [10000, 10000]);
  E.startHand(t);
  act(t, 0, 'allin'); act(t, 1, 'allin');
  eq('jetons conservés', t.seats[0].stack + t.seats[1].stack, 20000);
  eq('partage exact 10000/10000', [t.seats[0].stack, t.seats[1].stack], [10000, 10000]);
})();

/* ---------- 8. AFK : FOLD auto quand une mise est due ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t); // premier = siège0 face à la BB
  const seat = t.hand.toAct;
  E.timeoutCurrent(t, t.hand.deadline + 1);
  eq('AFK face à une mise -> fold', t.seats[seat].folded, true);
})();

/* ---------- 9. AFK : FOLD auto même sans mise due (2026-09-02 : plus d'auto-check, toujours fold) ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t);
  act(t, 0, 'call'); act(t, 1, 'call'); // action revient à la BB (siège2), toCall 0 (check aurait été gratuit)
  eq('toAct = BB', t.hand.toAct, 2);
  E.timeoutCurrent(t, t.hand.deadline + 1);
  assert('AFK sans mise due -> fold quand même', t.seats[2].folded);
  eq('les 2 autres continuent au flop', t.hand.street, 'flop');
})();

/* ---------- 10. Tapis incomplet : ne rouvre PAS l'enchère ---------- */
(() => {
  const t = tableWith(3, null, [10000, 10000, 1500]);
  E.startHand(t); // button0 sb1(200) bb2(400, reste 1100)
  act(t, 0, 'raise', 1000);   // relance complète (inc 600)
  act(t, 1, 'call');          // SB suit à 1000
  act(t, 2, 'allin');         // BB tapis 1500 : incomplet (inc 500 < minRaise 600)
  eq('currentBet = 1500', t.hand.currentBet, 1500);
  const la = E.legalActions(t, 0);
  assert('siège0 ne peut PAS relancer (tapis incomplet)', la.canRaise === false);
  assert('siège0 peut suivre', la.canCall === true);
})();

/* ---------- 11. Élimination + victoire du tournoi (heads-up) ---------- */
(() => {
  const draw = ['hA', 'hK', 'dA', 'dK', 'c5', 'c2', 'd7', 's9', 'c6', 'hJ', 'c8', 'sQ'];
  const t = tableWith(2, draw, [10000, 10000]);
  E.startHand(t); // S0=hA/dA (paire A) bat S1=hK/dK (paire K)
  act(t, 0, 'allin'); act(t, 1, 'allin');
  eq('perdant éliminé', t.seats[1].status, 'eliminated');
  eq('tournoi terminé', t.phase, 'tournamentOver');
  eq('gagnant = p0', t.winner, 'p0');
  eq('vainqueur récupère tout', t.seats[0].stack, 20000);
})();

/* ---------- 12. Rotation du bouton sur plusieurs mains ---------- */
(() => {
  const t = tableWith(4);
  E.startHand(t); eq('main1 bouton 0', t.button, 0);
  act(t, 3, 'fold'); act(t, 0, 'fold'); act(t, 1, 'fold'); // il reste la BB (2)
  eq('main1 finie', t.phase, 'handComplete');
  E.startHand(t); eq('main2 bouton 1', t.button, 1);
  // termine la main 2 par folds jusqu'à un seul
  let g = 0; while (t.phase === 'playing' && g++ < 20) { const s = t.hand.toAct; act(t, s, E.legalActions(t, s).canCheck ? 'check' : 'fold'); }
  E.startHand(t); eq('main3 bouton 2', t.button, 2);
})();

/* ---------- 13. Niveau de blindes différé à la main suivante ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t);
  eq('niveau 1 = 200/400', t.config.levels[t.level], { sb: 200, bb: 400 });
  t.pendingLevelUp = true;                 // le timer de niveau a expiré PENDANT la main
  eq('blindes inchangées en pleine main', t.hand.bb, 400);
  act(t, 0, 'fold'); act(t, 1, 'fold');    // fin de main
  E.startHand(t);                       // main suivante
  eq('niveau 2 appliqué', t.level, 1);
  eq('nouvelles blindes 300/600', t.config.levels[t.level], { sb: 300, bb: 600 });
  eq('BB de la nouvelle main = 600', t.hand.bb, 600);
  assert('pending remis à zéro', t.pendingLevelUp === false);
})();

/* ---------- 14. Le stack est bien débité à chaque mise ---------- */
(() => {
  const t = tableWith(3);
  E.startHand(t);
  const before = t.seats[0].stack;
  act(t, 0, 'raise', 1000);
  eq('stack débité de la mise', t.seats[0].stack, before - 1000);
  eq('committed = 1000', t.seats[0].committed, 1000);
})();

console.log(`\n${ok} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
