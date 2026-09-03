// Vérifie que les jetons sont CONSERVÉS (aucun créé/détruit) sur une longue partie
// avec des tapis et des éliminations. Lancer : node server/test_conservation.js
const E = require('./poker-engine.js');
const N = 6, START = 10000, TOTAL = N * START;
const t = E.createTable({ startStack: START, seats: N, maxPlayers: N });
for (let i = 0; i < N; i++) E.addPlayer(t, { id: 'p' + i, name: 'P' + i, isBot: true }, i);

let now = 0, hands = 0, elim = 0, fail = false;
for (let h = 0; h < 600 && !fail; h++) {
  if (h > 0 && h % 6 === 0) t.pendingLevelUp = true;   // blindes qui montent -> tapis/éliminations progressives
  const r = E.startHand(t, now);
  if (!r.ok) break;                                     // tournoi terminé (1 survivant)
  hands++;
  let guard = 0;
  while (t.phase === 'playing' && guard++ < 2000) {
    const seat = t.hand.toAct; if (seat < 0) break;
    const la = E.legalActions(t, seat);
    let a;
    if (la.canRaise && Math.random() < 0.05) a = { type: 'raise', amount: la.maxRaiseTo }; // tapis occasionnels
    else if (la.canCheck) a = { type: 'check' };
    else if (la.canCall && Math.random() < 0.85) a = { type: 'call' };
    else a = { type: 'fold' };
    E.applyAction(t, seat, a, now);
  }
  elim = t.seats.filter(p => p && p.status === 'eliminated').length;
  const total = t.seats.filter(Boolean).reduce((s, p) => s + p.stack, 0);
  if (total !== TOTAL) { console.error(`FAIL main ${hands} (${elim} éliminé(s)): total jetons = ${total} (attendu ${TOTAL})`); fail = true; }
}
if (!fail) console.log(`Conservation OK : ${TOTAL} jetons constants sur ${hands} mains (${elim} éliminé(s), survivants: ${t.seats.filter(p => p && p.status !== 'eliminated').length}).`);
process.exit(fail ? 1 : 0);
