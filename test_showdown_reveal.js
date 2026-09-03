// Vérifie qu'à un abattage normal (plusieurs joueurs vont jusqu'à la river sans se coucher), le snapshot
// expose bien les cartes de TOUS les joueurs non couchés (pas seulement le gagnant), pour un spectateur
// (viewerSeat = -1, ce qu'un autre joueur à table verrait de chacun de ses adversaires).
'use strict';
const E = require('./server/poker-engine.js');
const assert = require('assert');

const TEST_LEVELS = [{ sb: 200, bb: 400 }];
const t = E.createTable({ levels: TEST_LEVELS });
for (let i = 0; i < 3; i++) E.addPlayer(t, { id: 'p' + i, name: 'P' + i, isBot: i > 0 });
E.startHand(t);
const act = (seat, type, amount) => { const r = E.applyAction(t, seat, { type, amount }); assert.ok(r.ok, 'action refusée: ' + JSON.stringify(r)); };

// préflop : tout le monde call jusqu'à la BB (option check)
act(t.hand.toAct, 'call'); act(t.hand.toAct, 'call'); act(t.hand.toAct, 'check');
assert.strictEqual(t.hand.street, 'flop', 'devrait être au flop');
// flop/turn/river : tout le monde check à chaque street (aucun fold)
for (const street of ['flop', 'turn', 'river']) {
  assert.strictEqual(t.hand.street, street);
  act(t.hand.toAct, 'check'); act(t.hand.toAct, 'check'); act(t.hand.toAct, 'check');
}
const snap = E.snapshot(t, -1); // vue d'un spectateur : aucun siège n'est "moi"
console.log('phase =', snap.phase, '| results =', JSON.stringify(snap.results));
assert.ok(snap.phase !== 'playing', 'la main devrait être terminée (handComplete)');
for (let seat = 0; seat < 3; seat++) {
  const p = snap.seats[seat];
  assert.ok(p, `siège ${seat} présent`);
  assert.ok(!p.folded, `siège ${seat} ne devrait pas être couché (personne n'a fold dans ce script)`);
  const hasRealCards = Array.isArray(p.hole) && p.hole.length === 2 && p.hole.every(c => c && c.code);
  assert.ok(hasRealCards, `siège ${seat} : les cartes devraient être révélées à l'abattage (obtenu: ${JSON.stringify(p.hole)})`);
}
console.log('test_showdown_reveal.js : OK — les 3 joueurs non couchés ont bien leurs cartes exposées au snapshot à l\'abattage');
