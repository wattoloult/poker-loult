/* Tests du contrôleur de salle — node server/test-room.js */
'use strict';
const R = require('./room.js');

let ok = 0, fail = 0;
function assert(l, c) { if (c) ok++; else { fail++; console.error('✗ ' + l); } }
function eq(l, g, e) { if (JSON.stringify(g) === JSON.stringify(e)) ok++; else { fail++; console.error(`✗ ${l}\n   attendu ${JSON.stringify(e)}\n   obtenu  ${JSON.stringify(g)}`); } }

/* horloge virtuelle : timers déterministes, temps piloté à la main */
function virtualClock() {
  let t = 0, seq = 0; const q = [];
  return {
    now: () => t,
    setTimeout: (ms, fn) => { const id = ++seq; q.push({ at: t + ms, id, fn }); return id; },
    clearTimeout: (id) => { const i = q.findIndex(x => x.id === id); if (i >= 0) q.splice(i, 1); },
    advance: (ms) => {
      const end = t + ms;
      q.sort((a, b) => a.at - b.at);
      while (q.length && q[0].at <= end) { const e = q.shift(); t = e.at; e.fn(); q.sort((a, b) => a.at - b.at); }
      t = end;
    },
  };
}

/* ---------- 1. Tournoi 100% bots : la boucle tourne jusqu'à un vainqueur ---------- */
(() => {
  const clk = virtualClock();
  const room = R.createRoom({ seats: 3, startStack: 1000 }, clk);
  R.start(room);
  eq('main démarrée', room.table.phase, 'playing');
  clk.advance(2_000_000);
  eq('tournoi terminé', room.table.phase, 'tournamentOver');
  assert('un vainqueur désigné', !!room.table.winner);
  const survivors = room.table.seats.filter(p => p && p.status === 'active');
  eq('un seul survivant', survivors.length, 1);
})();

/* ---------- 2. Timer d'action : AFK -> action auto (fold face à une mise) ---------- */
(() => {
  const clk = virtualClock();
  const room = R.createRoom({ seats: 2, startStack: 10000, actionTime: 10 }, clk);
  R.start(room);
  const seat = R.join(room, 'h0', 'Toi'); // prend un siège de bot
  eq('humain assis', seat >= 0, true);
  // heads-up : le bouton (siège humain) est SB et parle en premier, face à la BB
  eq('c\'est au tour de l\'humain', room.table.hand.toAct, seat);
  clk.advance(10_500); // dépasse les 10s sans agir
  assert('AFK -> fold auto de l\'humain', room.table.log.some(e => e[0] === seat && e[1] === 'fold'));
})();

/* ---------- 3. Action hors-tour refusée ---------- */
(() => {
  const clk = virtualClock();
  const room = R.createRoom({ seats: 3, startStack: 10000, actionTime: 999 }, clk);
  R.start(room);
  const seat = R.join(room, 'h0', 'Toi'); // siège 0, = UTG (au tour)
  eq('humain au tour', room.table.hand.toAct, seat);
  const first = R.handleAction(room, 'h0', { type: 'call' });
  eq('1re action acceptée', first.ok, true);
  const second = R.handleAction(room, 'h0', { type: 'call' }); // plus son tour
  eq('2e action (hors-tour) refusée', second.ok, false);
})();

/* ---------- 4. Reconnexion : même token -> même siège, pas de doublon ---------- */
(() => {
  const clk = virtualClock();
  const room = R.createRoom({ seats: 3 }, clk);
  R.start(room);
  const s1 = R.join(room, 'tok', 'Toi');
  const s2 = R.join(room, 'tok', 'Toi'); // reconnexion
  eq('même siège à la reconnexion', s2, s1);
  eq('pas de siège en double', room.tokens.size, 1);
})();

/* ---------- 5. Niveau de blindes : reporté (jamais au milieu d'une main) ---------- */
(() => {
  const clk = virtualClock();
  const room = R.createRoom({ seats: 2, startStack: 10000, actionTime: 100, levelDuration: 2 }, clk);
  R.start(room);
  R.join(room, 'h0', 'Toi'); // fige la main sur le tour de l'humain (100s)
  eq('niveau 0 au départ', room.table.level, 0);
  clk.advance(2_100); // le timer de niveau (2s) expire pendant la main
  assert('hausse en attente', room.table.pendingLevelUp === true);
  eq('niveau inchangé en pleine main', room.table.level, 0);
})();

console.log(`\n${ok} OK, ${fail} échec(s)`);
process.exit(fail ? 1 : 0);
