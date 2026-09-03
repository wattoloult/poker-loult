// Vérifie qu'un joueur ÉLIMINÉ (status='eliminated') dont le dernier flag allIn était resté à true ne
// redéclenche pas faussement "ALL IN" à la main suivante — allIn doit être remis à false pour TOUS les
// sièges occupés à chaque startHand, pas seulement les joueurs encore actifs (même classe de bug que
// l'inflation de committed déjà corrigée).
'use strict';
const E = require('./server/poker-engine.js');
const assert = require('assert');

const TEST_LEVELS = [{ sb: 200, bb: 400 }];
const t = E.createTable({ levels: TEST_LEVELS });
for (let i = 0; i < 3; i++) E.addPlayer(t, { id: 'p' + i, name: 'P' + i, isBot: i > 0 });

// force le siège 2 en all-in ET éliminé, comme s'il venait de perdre sa dernière main tapis
t.seats[2].allIn = true;
t.seats[2].status = 'eliminated';
t.seats[2].stack = 0;

E.startHand(t); // nouvelle main entre les 2 survivants (0 et 1)

assert.strictEqual(t.seats[2].allIn, false, 'le flag allIn du joueur éliminé doit être remis à false à la main suivante');
const snap = E.snapshot(t, -1);
assert.strictEqual(snap.seats[2].allIn, false, 'le snapshot ne doit plus signaler ce siège comme all-in');
console.log('test_allin_stale.js : OK — plus de fausse bannière ALL IN sur un joueur éliminé');
