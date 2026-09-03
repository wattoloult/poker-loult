// Bug réel trouvé en jeu (Draco+Meditikka, session du 2026-09-03) : en head's-up, si la SB (=bouton) a un
// stack <= la petite blinde, elle poste tapis en la postant. Le moteur donnait quand même la parole à ce
// joueur, qui n'avait plus AUCUNE action légale (legalActions renvoie null) -> chaque tentative rejetée en
// boucle, la main restait bloquée pour toujours. Corrigé via startActing() qui saute au prochain joueur
// capable d'agir, ou déroule direct jusqu'à l'abattage si personne ne le peut. node server/test_headsup_allin_blind.js
'use strict';
const assert = require('assert');
const E = require('./poker-engine.js');

// SB (bouton, seat 0) à court de jetons face à une BB (seat 1) bien fournie
const t = E.createTable({ startStack: 10000, seats: 2, maxPlayers: 2, levels: [{ sb: 400, bb: 800 }] });
E.addPlayer(t, { id: 'p0', name: 'P0', isBot: true }, 0);
E.addPlayer(t, { id: 'p1', name: 'P1', isBot: true }, 1);
t.seats[0].stack = 100; // < la SB (400) -> tapis forcé en postant

const r = E.startHand(t, 0);
assert.strictEqual(r.ok, true);
assert.strictEqual(t.seats[0].allIn, true, 'SB doit être tapis après avoir posté plus que son stack');
assert.notStrictEqual(t.hand.toAct, 0, 'la parole ne doit JAMAIS être donnée au joueur déjà tapis (aucune action légale)');
assert(E.legalActions(t, t.hand.toAct) !== null, 'le joueur désigné doit avoir au moins une action légale');

// la main doit pouvoir se jouer jusqu'au bout sans jamais se retrouver bloquée (legalActions null / action rejetée)
let guard = 0;
while (t.phase === 'playing' && guard++ < 100) {
  const seat = t.hand.toAct; if (seat < 0) break;
  const la = E.legalActions(t, seat);
  assert(la !== null, `legalActions ne doit jamais être null en cours de main (seat ${seat})`);
  const action = la.canCheck ? { type: 'check' } : { type: 'call' };
  const res = E.applyAction(t, seat, action, 0);
  assert.strictEqual(res.ok, true, `action rejetée de façon inattendue : ${JSON.stringify(res)}`);
}
assert(guard < 100, 'la main ne doit pas rester bloquée (boucle infinie détectée)');
assert.strictEqual(t.seats[0].stack + t.seats[1].stack, 10100, 'conservation des jetons (100 + 10000 initial)');

console.log('test_headsup_allin_blind.js : OK — SB tapis sur la blinde en head\'s-up ne bloque plus la main, jetons conservés');
