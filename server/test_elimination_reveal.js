// Bug réel trouvé en jeu (Draco, session du 2026-09-03) : un tapis qui élimine l'adversaire ET termine le
// tournoi annonçait "X remporte le tournoi" SANS jamais montrer les cartes du perdant. Cause : finishHand()
// mettait p.inHand=false EN MÊME TEMPS que le statut "eliminated" -> le snapshot (qui exige inHand pour
// révéler les cartes à l'abattage) faisait disparaître la main du joueur éliminé au lieu de la montrer.
// node server/test_elimination_reveal.js
'use strict';
const assert = require('assert');
const E = require('./poker-engine.js');

const t = E.createTable({ startStack: 1000, seats: 2, maxPlayers: 2, levels: [{ sb: 400, bb: 800 }] });
E.addPlayer(t, { id: 'p0', name: 'P0', isBot: true }, 0);
E.addPlayer(t, { id: 'p1', name: 'P1', isBot: true }, 1);
E.startHand(t, 0);
// heads-up : bouton=SB agit en 1er préflop -> les 2 tapis direct, main jouée jusqu'au bout automatiquement
const first = t.hand.toAct;
let r = E.applyAction(t, first, { type: 'allin' }, 0);
assert.strictEqual(r.ok, true, JSON.stringify(r));
const second = t.hand.toAct;
if (second >= 0) { r = E.applyAction(t, second, { type: 'allin' }, 0); assert.strictEqual(r.ok, true, JSON.stringify(r)); }

assert.strictEqual(t.phase, 'tournamentOver', 'un des deux doit être éliminé (stacks égaux au départ -> sauf split exact)');
const loserSeat = t.seats.findIndex(p => p.status === 'eliminated');
assert(loserSeat >= 0, 'un joueur doit être éliminé');
assert.strictEqual(t.seats[loserSeat].inHand, true, "inHand ne doit PAS être mis à false par finishHand (sinon ses cartes disparaissent du snapshot)");

const snap = E.snapshot(t, -1); // vue spectateur : personne n'est "moi", tout dépend de showAll/inHand/folded
const loser = snap.seats[loserSeat];
const hasRealCards = Array.isArray(loser.hole) && loser.hole.length === 2 && loser.hole.every(c => c && c.code);
assert(hasRealCards, `les cartes du joueur ÉLIMINÉ doivent être révélées à l'abattage (obtenu: ${JSON.stringify(loser.hole)})`);

// --- 2e partie : l'éliminé ne doit PLUS compter comme "dans la main" dès la main SUIVANTE ---
// (régression introduite en corrigeant le point ci-dessus : garder inHand=true pour toujours faisait
//  renvoyer l'éliminé par inHandPlayers(), et endHandByFold() pouvait lui attribuer le pot.)
const t3 = E.createTable({ startStack: 10000, seats: 3, maxPlayers: 3, levels: [{ sb: 400, bb: 800 }] });
E.addPlayer(t3, { id: 'q0', name: 'Q0', isBot: true }, 0);
E.addPlayer(t3, { id: 'q1', name: 'Q1', isBot: true }, 1);
E.addPlayer(t3, { id: 'q2', name: 'Q2', isBot: true }, 2);
t3.seats[2].stack = 300; // court -> éliminé dès la 1re main
E.startHand(t3, 0);
let guard = 0;
while (t3.phase === 'playing' && guard++ < 60) {
  const seat = t3.hand.toAct; if (seat < 0) break;
  const la = E.legalActions(t3, seat); if (!la) break;
  E.applyAction(t3, seat, la.canRaise ? { type: 'allin' } : { type: 'call' }, 0);
}
assert(t3.seats.some(p => p.status === 'eliminated'), 'au moins un joueur doit être éliminé');
if (t3.phase !== 'tournamentOver') {
  E.startHand(t3, 0);
  const fantomes = t3.seats.filter(p => p && p.inHand && !p.folded && p.status !== 'active');
  assert.strictEqual(fantomes.length, 0, `un joueur éliminé est encore compté dans la main suivante (${fantomes.map(p => p.id)}) -> inHandPlayers/endHandByFold faussés`);
}

console.log("test_elimination_reveal.js : OK — cartes du perdant révélées à l'abattage, et plus aucun éliminé fantôme à la main suivante");
