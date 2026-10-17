// Tests du monde « sky » (parcours Les Îles du Vent) : nuages-ressorts, ballons-ascenseurs (solo et à deux), balance à contrepoids, herse du temple à deux plaques.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, snapWorld, applySnap, layChain, groundBelow, ST, IDLE } from './sim.js';
import { getCourse } from './worlds.js';

const ID = 'iles', L = getCourse(ID);
const put = (W, k, x, y, z, st = ST.AIR) => Object.assign(W.pl[k], { x, y, z, vx: 0, vy: 0, vz: 0, st });
const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const onTop = (W, k, b) => put(W, k, b.px, b.py + b.hh + 0.05, b.pz);
const lifts = () => L.bodies.map((b, i) => ({ ...b, i })).filter((b) => b.sky?.k === 'lift');

test('parcours : 11 zones, un seul point d\'arrivée, non publié, pose du ballon dans le niveau', () => {
  assert.equal(L.published, true); // publié à la demande du propriétaire (2026-10-17)
  assert.equal(L.zones.length - 1, 11);
  assert.equal(L.checkpoints.filter((c) => c.finish).length, 1);
  assert.equal(lifts().length, 2);
  const W = createWorld({ course: ID }); assert.deepEqual(Object.keys(W.ext.sky), ['l', 'm']);
});

// chaque nuage-ressort catapulte sur le suivant (on retombe dessus en visant son centre)
const springs = L.bodies.map((b, i) => ({ ...b, i })).filter((b) => b.cloud && b.launch);
for (const s of springs) {
  test(`nuage-ressort #${s.i} : on atterrit sur le nuage ou l'île suivants`, () => {
    const next = L.bodies.map((b, i) => ({ ...b, i })).find((b) => b.i > s.i && b.mat !== 'metal');
    const W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
    put(W, 0, s.x, s.y + s.h / 2 + 0.4, s.z); let top = 0, hit = false;
    for (let i = 0; i < 120 * 5 && !hit; i++) {
      const p = W.pl[0], d = toward(p, next.x, next.z);
      stepWorld(W, [{ ...IDLE, ...d }, IDLE]); top = Math.max(top, p.y);
      hit = p.st === ST.GROUND && p.gb === next.i;
      if (next.launch && W.ev.some((e) => e.k === 'launch' && Math.abs(e.x - next.x) < next.w / 2 + 0.3 && Math.abs(e.y - (next.y + next.h / 2)) < 0.4)) hit = true; // relancé par le ressort suivant : on y a posé le pied
    }
    assert.ok(top > s.y + s.h / 2 + 4, 'apex ' + top.toFixed(2));
    assert.ok(hit, 'pas posé sur #' + next.i);
  });
}

test('ballon (1 grimpeur) : la nacelle monte sous le poids, garde son altitude, redescend vide, et on rejoint l\'île du haut', () => {
  const lf = lifts()[0], W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
  const b = W.bodies[lf.i], isle = W.bodies[lf.i + 1];
  onTop(W, 0, b); run(W, 20); assert.equal(W.pl[0].gb, lf.i);
  const y0 = b.py; run(W, 120 * 2); assert.ok(b.py > y0 + 4, 'monte (' + (b.py - y0).toFixed(1) + ')');
  assert.ok(W.pl[0].y > y0 + 4 && W.pl[0].gb === lf.i, 'le grimpeur est emporté');
  run(W, 120 * 6); assert.ok(Math.abs(b.py - (lf.y + lf.sky.rise)) < 0.01, 'butée en haut');
  assert.ok(Math.abs(b.py + b.hh - (isle.py + isle.hh)) < 0.5, 'la nacelle arrive au niveau de l\'île');
  let got = false; for (let i = 0; i < 240 && !got; i++) { stepWorld(W, [{ ...IDLE, ...toward(W.pl[0], isle.px, isle.pz), jump: i % 60 === 5 }, IDLE]); got = W.pl[0].st === ST.GROUND && W.pl[0].gb === isle.i; }
  assert.ok(got, 'posé sur l\'île du haut'); assert.equal(W.falls, 0);
  const top = b.py; run(W, 120 * 3); assert.ok(b.py < top - 3, 'la nacelle redescend vide (' + (top - b.py).toFixed(1) + ')');
});

test('gros ballon : un seul grimpeur ne le soulève pas, à deux il décolle', () => {
  const lf = lifts()[1], W = createWorld({ course: ID }), b = W.bodies[lf.i];
  W.cp = L.checkpoints.findIndex((c) => c.zone === lf.zone);
  onTop(W, 0, b); put(W, 1, b.px - 5, b.py + b.hh + 0.05 - 0.5, b.pz, ST.GROUND); layChain(W);
  W.pl[1].x = 999; // le second est hors de la nacelle
  const solo = createWorld({ course: ID }); solo.solo = true; put(solo, 1, 999, -999, 0); onTop(solo, 0, solo.bodies[lf.i]); run(solo, 120 * 3);
  assert.equal(solo.bodies[lf.i].py, lf.y, 'un seul à bord : immobile');
  const D = createWorld({ course: ID }), bd = D.bodies[lf.i];
  onTop(D, 0, bd); put(D, 1, bd.px + 0.9, bd.py + bd.hh + 0.05, bd.pz); layChain(D); run(D, 120 * 2);
  assert.ok(D.pl.every((p) => p.gb === lf.i), 'les deux à bord'); assert.ok(bd.py > lf.y + 3, 'il décolle (' + (bd.py - lf.y).toFixed(1) + ')');
});

test('ballon : l\'altitude passe dans les instantanés réseau', () => {
  const lf = lifts()[0], W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
  onTop(W, 0, W.bodies[lf.i]); run(W, 240);
  const S = JSON.parse(JSON.stringify(snapWorld(W, true))), V = createWorld({ course: ID }); applySnap(V, S);
  assert.ok(V.ext.sky.l[lf.i] > 1, 'altitude restaurée'); assert.equal(V.ext.sky.l[lf.i], W.ext.sky.l[lf.i]);
});

// balance à contrepoids : A charge le grand plateau, B monte sur le petit et gagne la corniche ; B s'arc-boute, A saute, pend et remonte la chaîne
test('balance (contrepoids) : les deux finissent sur la corniche', () => {
  const W = createWorld({ course: ID });
  const plus = W.bodies.find((b) => b.cw?.id === 'balance' && b.cw.side === 1), minus = W.bodies.find((b) => b.cw?.id === 'balance' && b.cw.side === -1);
  const goal = W.bodies.find((b) => b.coop && b.i > minus.i); W.cp = L.checkpoints.findIndex((c) => c.zone === plus.zone);
  onTop(W, 0, plus); onTop(W, 1, minus); layChain(W);
  let jcA = 0, jcB = 0, phase = 0, t = 0; const on = (p) => p.st === ST.GROUND && p.gb === goal.i, got = [false, false];
  for (let i = 0; i < 120 * 40 && !(got[0] && got[1]); i++) {
    const A = W.pl[0], B = W.pl[1]; t++; let ia = IDLE, ib = IDLE;
    if (phase === 0 && t > 240) phase = 1;
    const edge = (p, d) => p.st === ST.GROUND && !groundBelow(W, p.x + d.mx * 0.5, p.y + 0.05, p.z + d.mz * 0.5, 0.4);
    if (phase === 1) { const d = toward(B, goal.px, goal.pz); if (edge(B, d)) jcB++; ib = { ...IDLE, ...d, jc: jcB, jump: true }; if (on(B)) { phase = 2; t = 0; } }
    if (phase === 2) {
      const away = toward(B, 2 * B.x - A.x, 2 * B.z - A.z), room = groundBelow(W, B.x + away.mx * 0.9, B.y + 0.05, B.z + away.mz * 0.9, 0.3);
      ib = W.taut > 0.6 || !room ? { ...IDLE, brace: true } : { ...IDLE, mx: away.mx, mz: away.mz };
      const d = toward(A, goal.px, goal.pz); if (!on(A) && (edge(A, d) || (A.st === ST.GROUND && t % 90 === 0))) jcA++;
      ia = on(A) ? IDLE : { ...IDLE, ...d, jc: jcA, jump: true, brace: A.dangling };
    }
    stepWorld(W, [ia, ib]); W.pl.forEach((p, k) => { if (on(p)) got[k] = true; });
  }
  assert.ok(got[0] && got[1] && W.falls === 0, 'phase ' + phase + ', chutes ' + W.falls);
});

test('herse du temple : levée tant que les deux plaques sont pressées, les deux passent pendant sa descente', () => {
  const W = createWorld({ course: ID }), d1 = W.bodies.find((b) => b.plate?.id === 'T1'), d2 = W.bodies.find((b) => b.plate?.id === 'T2'), h = W.bodies.find((b) => b.herse?.mode === 'switch'), goal = W.bodies.find((b) => b.summit);
  W.cp = L.checkpoints.findIndex((c) => c.zone === d1.zone); onTop(W, 0, d1); onTop(W, 1, d2); layChain(W);
  run(W, 360); assert.ok(W.dr[h.i] > 0.95, 'herse levée (' + W.dr[h.i] + ')');
  let both = false;
  for (let i = 0; i < 120 * 6 && !both; i++) { const go = (p) => ({ ...IDLE, ...toward(p, goal.px, goal.pz) }); stepWorld(W, [go(W.pl[0]), go(W.pl[1])]); both = W.pl.every((p) => p.x > h.px + 0.6); }
  assert.ok(both, 'les deux sont passés'); assert.equal(W.falls, 0);
  run(W, 120 * 6); assert.ok(W.dr[h.i] < 0.05, 'retombée derrière eux');
});
