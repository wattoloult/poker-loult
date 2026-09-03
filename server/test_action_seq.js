// Vérifie que h.lastAction.seq est GLOBAL à la table (jamais remis à zéro à chaque main) : sinon la 1ère
// action d'une main peut retomber sur le même numéro que la dernière action traitée par le client pour la
// main précédente -> ignorée en silence côté client (tag CHECK/SFX manqué). node server/test_action_seq.js
'use strict';
const assert = require('assert');
const E = require('./poker-engine.js');

const t = E.createTable({ levels: [{ sb: 200, bb: 400 }] });
E.addPlayer(t, { id: 'p0', name: 'P0', isBot: false });
E.addPlayer(t, { id: 'p1', name: 'P1', isBot: false });

const seenSeqs = [];
function playOneHandToEnd() {
  E.startHand(t, Date.now());
  // heads-up : bouton=SB agit en 1er préflop -> fold immédiat termine la main en 1 seule action
  const r = E.applyAction(t, t.hand.toAct, { type: 'fold' }, Date.now());
  assert.strictEqual(r.ok, true);
  seenSeqs.push(t.hand.lastAction.seq);
}

playOneHandToEnd(); // main 1 : une seule action -> seq recommencerait à 1 si le compteur était par-main
playOneHandToEnd(); // main 2 : idem -> AVANT LE FIX, même seq=1 que la main 1 -> collision
playOneHandToEnd(); // main 3

assert.strictEqual(new Set(seenSeqs).size, seenSeqs.length, `seq doivent tous être uniques, obtenu: ${seenSeqs}`);
for (let i = 1; i < seenSeqs.length; i++) assert(seenSeqs[i] > seenSeqs[i - 1], `seq doit strictement augmenter entre les mains: ${seenSeqs}`);

console.log('test_action_seq.js : OK — seq global et strictement croissant sur plusieurs mains (pas de collision au changement de main), obtenu:', seenSeqs);
