// Mécanismes du parcours « La Grande Horloge » (core/biomes/mech.js) : tapis roulants et levier minuté, vapeur, monte-charge, porte à deux plaques,
// instantané réseau. Joués sur le VRAI parcours avec la vraie physique.
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, snapWorld, applySnap, ST, IDLE, DT } from './sim.js';

const lever = (W, id) => W.bodies.find((b) => b.lever?.id === id);
const put = (W, k, x, y, z) => Object.assign(W.pl[k], { x, y: y + 0.05, z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const inp = (W, k, o = {}) => ({ ...IDLE, uc: W.pl[k].uc || 0, ...o });
const press = (W, k) => stepWorld(W, W.pl.map((p, j) => (j === k ? inp(W, j, { uc: (p.uc || 0) + 1 }) : inp(W, j))));
const idle = (W, n) => { for (let i = 0; i < n; i++) stepWorld(W, [inp(W, 0), inp(W, 1)]); };
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const world = (zone) => { const W = createWorld({ course: 'horloge' }); W.cp = W.level.checkpoints.findIndex((c) => c.zone === zone); return W; };

test('tapis : emporte un grimpeur immobile vers -x ; le levier LB1 arrête le tapis rapide 10 s puis il repart', () => {
  const W = world(5); for (const b of W.bodies) if (b.hit) b.ghost = true; const belts = W.bodies.filter((b) => b.mc?.k === 'belt'), slow = belts[0], fast = belts[1];
  put(W, 0, slow.x + 4, 27.4, -2.4); put(W, 1, slow.x + 5, 27.4, -2.4); layChain(W);
  idle(W, 160); const x0 = W.pl[0].x; idle(W, 120);
  assert.ok(x0 - W.pl[0].x > 2.0 && x0 - W.pl[0].x < 2.8, 'dérive de ~2,4 m en 1 s (' + (x0 - W.pl[0].x) + ')');
  const L = lever(W, 'LB1'); put(W, 0, L.px, 27.4, L.pz - 0.6); put(W, 1, L.px - 1, 27.4, L.pz); layChain(W); idle(W, 20);
  assert.ok(fast.vx < -5, 'tapis rapide en marche'); press(W, 0); idle(W, 2);
  assert.equal(fast.vx, 0, 'tapis arrêté par le levier');
  idle(W, 120 * 9); assert.equal(fast.vx, 0, 'toujours arrêté à 9 s');
  press(W, 0); idle(W, 2); assert.ok(W.sw.LB1 && fast.vx === 0, 'le levier ne se coupe pas en route');
  idle(W, 120 * 2); assert.ok(!W.sw.LB1 && fast.vx < -5, 'retombé : le tapis repart');
});

test('vapeur : un jet pulsé soulève un grimpeur placé dans la colonne', () => {
  const W = world(6), w = W.level.winds.find((v) => v.steam); put(W, 0, w.x, 27.4, w.z); put(W, 1, w.x - 1, 27.4, w.z); layChain(W);
  let top = 0; for (let i = 0; i < 120 * 2; i++) { stepWorld(W, [IDLE, IDLE]); top = Math.max(top, W.pl[0].y); }
  assert.ok(top > 33, 'monté au-dessus du premier palier (' + top.toFixed(1) + ')');
});

test('monte-charge : un coup de levier = un cycle complet, la cabine monte, attend en haut, redescend', () => {
  const W = world(8), L = lever(W, 'LE'), lift = W.bodies.find((b) => b.move?.gate === 'LE');
  put(W, 0, L.px, 39.4, L.pz + 0.6); put(W, 1, L.px - 1, 39.4, L.pz); layChain(W); idle(W, 20);
  const top = () => lift.py + lift.hh, bottom = top(); assert.ok(Math.abs(bottom - 39.4) < 0.05, 'cabine en bas');
  press(W, 0); let max = -1e9; for (let i = 0; i < 120 * 8.2; i++) { stepWorld(W, [inp(W, 0), inp(W, 1)]); max = Math.max(max, top()); }
  assert.ok(max > 49.3, 'montée en haut (' + max + ')'); assert.ok(Math.abs(top() - bottom) < 0.1, 'redescendue');
  assert.ok(!W.sw.LE);
});

test('porte des cames : une plaque chacun, la porte s\'ouvre, les deux passent avant qu\'elle retombe', () => {
  const W = world(7), p1 = W.bodies.find((b) => b.plate?.id === 'K1'), p2 = W.bodies.find((b) => b.plate?.id === 'K2'), door = W.bodies.find((b) => b.door);
  W.cp = W.level.checkpoints.findIndex((c) => c.name === 'La Porte des cames');
  put(W, 0, p1.px, p1.py + p1.hh, p1.pz); put(W, 1, p2.px, p2.py + p2.hh, p2.pz); layChain(W); idle(W, 30);
  assert.ok(W.sw.K1 && W.sw.K2, 'plaques enfoncées'); idle(W, 150);
  assert.ok(W.dr[door.i] > 0.9, 'porte ouverte'); let both = false;
  for (let i = 0; i < 120 * 8 && !both; i++) { stepWorld(W, W.pl.map((p) => ({ ...IDLE, ...toward(p, door.px + 4, door.pz) }))); both = W.pl.every((p) => p.x > door.px + 1); }
  assert.ok(both && W.falls === 0, 'les deux de l\'autre côté'); idle(W, 120 * 8); assert.ok((W.dr[door.i] || 0) < 0.05, 'porte retombée');
});

test('porte des cames : une seule plaque ne suffit pas', () => {
  const W = world(7), p1 = W.bodies.find((b) => b.plate?.id === 'K1'), door = W.bodies.find((b) => b.door);
  put(W, 0, p1.px, p1.py + p1.hh, p1.pz); put(W, 1, p1.px - 1.5, p1.py + p1.hh, p1.pz); layChain(W); idle(W, 300);
  assert.ok(W.sw.K1 && !W.sw.K2 && !(W.dr[door.i] > 0.01), 'porte fermée');
});

test('instantané réseau : tapis et levier minuté repartent identiques après applySnap', () => {
  const W = world(5), L = lever(W, 'LB1'); put(W, 0, L.px, 27.4, L.pz - 0.6); put(W, 1, L.px - 1, 27.4, L.pz); layChain(W); idle(W, 20); press(W, 0); idle(W, 200);
  const s = JSON.parse(JSON.stringify(snapWorld(W, true))), W2 = createWorld({ course: 'horloge' }); applySnap(W2, s);
  idle(W, 120 * 11); idle(W2, 120 * 11);
  assert.deepEqual(W2.ext.mech, W.ext.mech); assert.equal(W2.sw.LB1, W.sw.LB1);
});
