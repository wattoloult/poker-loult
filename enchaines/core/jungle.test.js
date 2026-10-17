// Tests du monde « jungle » (parcours La Canopée) : fleurs-ressorts, nénuphars, racines à levier, racine-porte à deux plaques, tronc-balance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, groundBelow, ST, IDLE } from './sim.js';
import { getCourse } from './worlds.js';

const ID = 'canopee', L = getCourse(ID);
const put = (W, k, x, y, z, st = ST.AIR) => Object.assign(W.pl[k], { x, y, z, vx: 0, vy: 0, vz: 0, st });
const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const fresh = (cpName) => { const W = createWorld({ course: ID }); W.cp = L.checkpoints.findIndex((c) => c.name === cpName); return W; };

test('parcours : 12 zones, un seul point d\'arrivée, abîme sous le lac, non publié', () => {
  assert.equal(L.published, true); // publié à la demande du propriétaire (2026-10-17)
  assert.equal(L.zones.length - 1, 12);
  assert.equal(L.checkpoints.filter((c) => c.finish).length, 1);
  assert.ok(L.abyss < L.bodies.filter((b) => b.lily).reduce((m, b) => Math.min(m, b.y), 99));
});

// chaque fleur-ressort catapulte sur la plateforme suivante (on retombe dessus en visant son centre)
const springs = L.bodies.map((b, i) => ({ ...b, i })).filter((b) => b.spring);
for (const s of springs) {
  test(`fleur-ressort #${s.i} : on atterrit sur la plateforme suivante`, () => {
    const next = L.bodies.map((b, i) => ({ ...b, i })).find((b) => b.i > s.i && !b.spring && b.mat !== 'bark');
    const W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
    put(W, 0, s.x, s.y + s.h / 2 + 0.4, s.z); let top = 0, on = false;
    for (let i = 0; i < 120 * 5 && !on; i++) {
      const p = W.pl[0], d = p.vy > 0 || p.st !== ST.GROUND ? toward(p, next.x, next.z) : { mx: 0, mz: 0 };
      stepWorld(W, [{ ...IDLE, ...d }, IDLE]); top = Math.max(top, p.y);
      on = p.st === ST.GROUND && p.gb === next.i;
    }
    assert.ok(top > s.y + s.h / 2 + 3, 'apex ' + top.toFixed(2));
    assert.ok(on, 'pas posé sur la plateforme ' + next.i);
  });
}

test('fleur-ressort : en sautant du bord de l\'île on est catapulté', () => {
  const s = springs[0], W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
  put(W, 0, 179.4, 20.02, L.checkpoints.find((c) => c.name.startsWith('L\'île')).z, ST.GROUND); run(W, 20);
  let top = 0; for (let i = 0; i < 120 * 3; i++) { const p = W.pl[0]; stepWorld(W, [{ ...IDLE, mx: 1, mz: 0 }, IDLE]); top = Math.max(top, p.y); }
  assert.ok(top > 23, 'apex ' + top.toFixed(2));
});

test('nénuphar : il s\'enfonce sous le poids puis remonte', () => {
  const lily = L.bodies.findIndex((b) => b.lily && !b.move), W = createWorld({ course: ID }); W.solo = true; put(W, 1, 999, -999, 0);
  const b = W.bodies[lily]; put(W, 0, b.px, b.py + b.hh + 0.05, b.pz); run(W, 90);
  assert.equal(W.pl[0].gb, lily); const low = b.py; assert.ok(low < L.bodies[lily].y - 0.1, 'enfoncé de ' + (L.bodies[lily].y - low).toFixed(2));
  put(W, 0, b.px, b.py + 6, b.pz + 8); run(W, 180); assert.ok(b.py > low + 0.1, 'remonté');
});

test('racines : immobiles tant que le levier n\'est pas tiré, puis elles bougent', () => {
  const W = fresh('La cime des fleurs'), r = W.bodies.find((b) => b.root), lever = W.bodies.find((b) => b.lever?.id === 'LR');
  put(W, 0, lever.px - 0.6, lever.py, lever.pz, ST.GROUND); put(W, 1, lever.px - 2, lever.py, lever.pz, ST.GROUND); layChain(W);
  const x0 = r.px; run(W, 240); assert.equal(r.px, x0);
  run(W, 3, () => ({ ...IDLE, uc: 1 })); assert.ok(W.sw.LR, 'levier actionné');
  let dx = 0; for (let i = 0; i < 360; i++) { stepWorld(W, [{ ...IDLE, uc: 1 }, IDLE]); dx = Math.max(dx, Math.abs(r.px - x0)); }
  assert.ok(dx > 1.5, 'amplitude ' + dx.toFixed(2));
});

test('racine-porte : une seule plaque ne l\'ouvre pas ; à deux, on passe avant qu\'elle retombe', () => {
  const W = fresh('Le Fourré'), p1 = W.bodies.find((b) => b.plate?.id === 'R1'), p2 = W.bodies.find((b) => b.plate?.id === 'R2'), door = W.bodies.find((b) => b.rootwall);
  const dx = door.px + 3;
  put(W, 0, p1.px, p1.py + p1.hh + 0.05, p1.pz); put(W, 1, p1.px - 3, p1.py + p1.hh + 0.05, p1.pz + 3, ST.GROUND); layChain(W); run(W, 240);
  assert.equal(W.dr[door.i] || 0, 0, 'une plaque : fermée');
  put(W, 0, p1.px, p1.py + p1.hh + 0.05, p1.pz); put(W, 1, p2.px, p2.py + p2.hh + 0.05, p2.pz); layChain(W); run(W, 150);
  assert.ok(W.dr[door.i] > 0.95, 'ouverte ' + W.dr[door.i]);
  run(W, 120 * 3, (i, W) => ({ ...IDLE, ...toward(W.pl[0], dx, door.pz - 0.6), jc: 0 }), (i, W) => ({ ...IDLE, ...toward(W.pl[1], dx, door.pz + 0.6) }));
  assert.ok(W.pl.every((p) => p.x > door.px + 0.8 && p.y > 31), 'les deux sont passés : ' + W.pl.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)));
  assert.equal(W.falls, 0);
});

test('tronc-balance : B est hissé sur la corniche, A le rejoint à la chaîne', () => {
  const plus = L.bodies.findIndex((b) => b.cw?.id === 'balance' && b.cw.side === 1), minus = L.bodies.findIndex((b) => b.cw?.id === 'balance' && b.cw.side === -1);
  const goal = L.bodies.findIndex((b) => b.coop && b > 0 && L.bodies.indexOf(b) > minus);
  const W = fresh('Le Tronc-balance'), gi = L.bodies.findIndex((b, i) => i > minus && b.coop), g = W.bodies[gi];
  const pl = W.bodies[plus], mi = W.bodies[minus];
  put(W, 0, pl.px, pl.py + pl.hh + 0.05, pl.pz); put(W, 1, mi.px, mi.py + mi.hh + 0.05, mi.pz); layChain(W);
  const on = (p) => p.st === ST.GROUND && p.gb === gi, got = [false, false];
  let jcA = 0, jcB = 0, phase = 0;
  const edge = (p, d) => p.st === ST.GROUND && !groundBelow(W, p.x + d.mx * 0.5, p.y + 0.05, p.z + d.mz * 0.5, 0.4);
  for (let t = 0; t < 120 * 40 && !(got[0] && got[1]); t++) {
    const A = W.pl[0], B = W.pl[1]; let ia = IDLE, ib = IDLE;
    if (phase === 0 && t > 240) phase = 1;
    if (phase === 1) { const d = toward(B, g.px, g.pz); if (edge(B, d)) jcB++; ib = { ...IDLE, ...d, jc: jcB, jump: true }; if (on(B)) { phase = 2; } }
    if (phase === 2) {
      const away = toward(B, 2 * B.x - A.x, 2 * B.z - A.z), room = groundBelow(W, B.x + away.mx * 0.9, B.y + 0.05, B.z + away.mz * 0.9, 0.3);
      ib = W.taut > 0.6 || !room ? { ...IDLE, brace: true } : { ...IDLE, mx: away.mx, mz: away.mz };
      const d = toward(A, g.px, g.pz); if (!on(A) && (edge(A, d) || (A.st === ST.GROUND && t % 90 === 0))) jcA++;
      ia = on(A) ? IDLE : { ...IDLE, ...d, jc: jcA, jump: true, brace: A.dangling };
    }
    stepWorld(W, [ia, ib]); W.pl.forEach((p, k) => { if (on(p)) got[k] = true; });
  }
  assert.ok(got[0] && got[1] && W.falls === 0, 'phase ' + phase + ', chutes ' + W.falls);
});
