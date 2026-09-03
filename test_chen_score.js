// Vérifie la formule de Chen (force d'une main de départ, avant flop) contre les exemples fournis dans la
// demande : AA=20, KK=16, QQ=14, K9o≈3, + les mécanismes (paire mini 5, assortie +2, pénalité d'écart).
// node test_chen_score.js
'use strict';
const assert = require('assert');
const EV = require('./poker-eval.js');
const h = (r1, s1, r2, s2) => [{ r: r1, s: s1, code: '' }, { r: r2, s: s2, code: '' }];

assert.strictEqual(EV.chenScore(h(14, 'h', 14, 'd')), 20, 'AA = 10 x 2 = 20');
assert.strictEqual(EV.chenScore(h(13, 'h', 13, 'd')), 16, 'KK = 8 x 2 = 16');
assert.strictEqual(EV.chenScore(h(12, 'h', 12, 'd')), 14, 'QQ = 7 x 2 = 14');
assert.strictEqual(EV.chenScore(h(2, 'h', 2, 'd')), 5, 'paire de 2 : score minimum forcé à 5');
assert.strictEqual(EV.chenScore(h(13, 'h', 9, 'd')), 3, 'K9 offsuit : 8 - 5 (écart 4) = 3');
assert.strictEqual(EV.chenScore(h(14, 'h', 13, 'h')), 11, 'AKs : 10 + 2 (assorti) - 1 (écart 1) = 11');
assert.strictEqual(EV.chenScore(h(14, 'h', 12, 'h')), 10, 'AQs : 10 + 2 (assorti) - 2 (écart 2) = 10');
assert(EV.chenScore(h(14, 'h', 14, 'd')) > EV.chenScore(h(4, 'h', 4, 'd')), 'AA doit surclasser 44 (même catégorie, force différente)');
assert(EV.chenScore(h(13, 's', 12, 's')) > EV.chenScore(h(13, 'h', 12, 'd')), 'assortie doit toujours surclasser la même main non assortie');

console.log('test_chen_score.js : OK — formule de Chen conforme à tous les exemples fournis');
