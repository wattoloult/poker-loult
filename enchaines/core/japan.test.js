// Mécanismes japonais du parcours « Les Mille Torii » (core/biomes/japan.js) : shoji à plaques, cloches qui retombent seules, shoji à deux
// leviers éloignés, dernier shoji (cloche + deux dalles), instantané réseau. Joués sur le VRAI parcours avec la vraie physique.
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, snapWorld, applySnap, ST, IDLE, DT } from './sim.js';

const named = (W, n) => W.bodies.find((b) => b.name === n);
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const put = (W, k, x, z, floor) => Object.assign(W.pl[k], { x, y: floor + 0.05, z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
// « Interagir » est un compteur (un front = un appui) : on garde le compteur courant de chaque grimpeur tant qu'on n'appuie pas
const inp = (W, k, o = {}) => ({ ...IDLE, uc: W.pl[k].uc || 0, ...o });
const press = (W, k) => stepWorld(W, W.pl.map((p, j) => (j === k ? inp(W, j, { uc: (p.uc || 0) + 1 }) : inp(W, j))));
const idle = (W, n) => { for (let i = 0; i < n; i++) stepWorld(W, [inp(W, 0), inp(W, 1)]); };
const open = (W, b) => W.ext.japan.sh[b.i]?.o || 0;
const world = (at) => { const W = createWorld({ course: 'torii' }); W.cp = W.level.checkpoints.findIndex((c) => c.name === at); return W; };

test('shoji SA : fermé au départ, ouvert par les deux dalles, reste ouvert ~6 s puis se referme', () => {
  const W = world('La Maison de thé'), sa = named(W, 'shoji SA'), ta = named(W, 'dalle TA'), tb = named(W, 'dalle TB');
  put(W, 0, ta.px, ta.pz, 5.4); put(W, 1, 47, 0, 5.4); layChain(W);
  idle(W, 240); assert.equal(open(W, sa), 0, 'une seule dalle ne suffit pas');
  put(W, 1, tb.px, tb.pz, 5.4); layChain(W);
  idle(W, 240); assert.ok(open(W, sa) > 0.99, 'ouvert (' + open(W, sa) + ')');
  assert.ok(sa.pz < -4, 'le panneau a glissé hors du passage (z = ' + sa.pz + ')');
  // un seul sur sa dalle : on quitte la dalle TB, le panneau reste ouvert (maintien) puis se referme
  put(W, 1, 47, 0, 5.4); layChain(W);
  idle(W, 120 * 3); assert.ok(open(W, sa) > 0.99, 'maintenu ouvert');
  idle(W, 120 * 6); assert.equal(open(W, sa), 0, 'refermé');
});

test('shoji SA : les deux passent pendant le maintien, aucune chute, le panneau se referme derrière', () => {
  const W = world('La Maison de thé'), sa = named(W, 'shoji SA'), ta = named(W, 'dalle TA'), tb = named(W, 'dalle TB');
  put(W, 0, ta.px, ta.pz, 5.4); put(W, 1, tb.px, tb.pz, 5.4); layChain(W); idle(W, 240);
  let both = false;
  for (let i = 0; i < 120 * 6 && !both; i++) { stepWorld(W, W.pl.map((p, j) => ({ ...inp(W, j), ...toward(p, 56, 0) }))); both = W.pl.every((p) => p.x > sa.x + 1); }
  assert.ok(both, 'les deux de l\'autre côté'); assert.equal(W.falls, 0);
  idle(W, 120 * 8); assert.equal(open(W, sa), 0, 'refermé derrière eux');
});

test('shoji : ne se referme pas sur un grimpeur resté dans l\'ouverture', () => {
  const W = world('La Maison de thé'), sa = named(W, 'shoji SA'), ta = named(W, 'dalle TA'), tb = named(W, 'dalle TB');
  put(W, 0, ta.px, ta.pz, 5.4); put(W, 1, tb.px, tb.pz, 5.4); layChain(W); idle(W, 240);
  put(W, 0, sa.x, 0, 5.4); put(W, 1, sa.x - 1.2, 0.6, 5.4); layChain(W);
  idle(W, 120 * 12);
  assert.ok(open(W, sa) > 0.99, 'reste ouvert tant que quelqu\'un est dans l\'ouverture');
  put(W, 0, sa.x + 4, 0, 5.4); put(W, 1, sa.x + 3, 0.5, 5.4); layChain(W);
  idle(W, 120 * 3); assert.equal(open(W, sa), 0, 'se referme une fois libre');
});

test('cloche K1 : un coup (F) ouvre SB 9 s, puis la cloche se tait et le panneau se referme', () => {
  const W = world('La Maison de thé'), sb = named(W, 'shoji SB'), k = named(W, 'cloche K1');
  put(W, 0, k.px, k.pz - 0.5, 5.4); put(W, 1, k.px - 3, 0, 5.4); layChain(W); idle(W, 30);
  press(W, 0); assert.ok(W.sw.K1, 'cloche frappée');
  idle(W, 120 * 3); assert.ok(open(W, sb) > 0.99, 'SB ouvert');
  idle(W, 120 * 7); assert.ok(!W.sw.K1, 'la cloche s\'est tue'); assert.equal(open(W, sb), 0, 'SB refermé');
  // on peut refrapper
  press(W, 0); assert.ok(W.sw.K1, 'refrappée');
});

test('shoji SC : deux cloches éloignées, la première puis la seconde avant qu\'elle ne se taise', () => {
  const W = world('Le Clocher'), sc = named(W, 'shoji SC'), a = named(W, 'cloche KA'), b = named(W, 'cloche KB');
  assert.ok(Math.hypot(a.px - b.px, a.pz - b.pz) > 5, 'cloches hors de portée d\'une seule personne');
  put(W, 0, a.px, a.pz - 0.5, 33.6); put(W, 1, b.px, b.pz + 0.5, 33.6); layChain(W); idle(W, 30);
  press(W, 0); idle(W, 120); assert.equal(open(W, sc), 0, 'une seule cloche ne suffit pas');
  press(W, 1); idle(W, 120 * 3); assert.ok(open(W, sc) > 0.99, 'les deux cloches ouvrent SC');
  let both = false;
  for (let i = 0; i < 120 * 8 && !both; i++) { stepWorld(W, W.pl.map((p, j) => ({ ...inp(W, j), ...toward(p, 276, W.pl[0].z) }))); both = W.pl.every((p) => p.x > sc.x + 1); }
  assert.ok(both, 'les deux sont passés'); assert.equal(W.falls, 0);
});

test('shoji SD : grande cloche puis une dalle chacun ; sans la cloche rien ne bouge', () => {
  const W = world('Le Clocher (sommet)'), sd = named(W, 'shoji SD'), te = named(W, 'dalle TE'), tf = named(W, 'dalle TF'), kc = named(W, 'cloche KC');
  put(W, 0, te.px, te.pz, 41.4); put(W, 1, tf.px, tf.pz, 41.4); layChain(W); idle(W, 300);
  assert.equal(open(W, sd), 0, 'dalles seules : fermé');
  put(W, 0, kc.px, kc.pz - 0.6, 41.4); layChain(W); idle(W, 30); press(W, 0);
  assert.ok(W.sw.KC, 'grande cloche frappée');
  put(W, 0, te.px, te.pz, 41.4); put(W, 1, tf.px, tf.pz, 41.4); layChain(W); idle(W, 240);
  assert.ok(open(W, sd) > 0.99, 'SD ouvert (' + open(W, sd) + ')');
  const goal = W.bodies.find((b) => b.summit); let both = false;
  for (let i = 0; i < 120 * 7 && !both; i++) { stepWorld(W, W.pl.map((p, j) => ({ ...inp(W, j), ...toward(p, goal.px, goal.pz) }))); both = W.pl.every((p) => p.x > sd.x + 1); }
  assert.ok(both, 'les deux sur le sanctuaire'); assert.equal(W.falls, 0);
});

test('instantané réseau : l\'état des shoji et des cloches repart identique après applySnap', () => {
  const W = world('La Maison de thé'), ta = named(W, 'dalle TA'), tb = named(W, 'dalle TB'), k = named(W, 'cloche K1');
  put(W, 0, ta.px, ta.pz, 5.4); put(W, 1, tb.px, tb.pz, 5.4); layChain(W); idle(W, 90);
  W.sw.K1 = true; idle(W, 60);
  const s = JSON.parse(JSON.stringify(snapWorld(W, true))), W2 = createWorld({ course: 'torii' }); applySnap(W2, s);
  idle(W, 240); idle(W2, 240);
  assert.deepEqual(W2.ext.japan, W.ext.japan); assert.equal(W2.sw.K1, W.sw.K1);
  assert.ok(Math.abs(named(W2, 'shoji SA').pz - named(W, 'shoji SA').pz) < 1e-6);
});
