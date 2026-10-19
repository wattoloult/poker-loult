// Tests du MODE LIBRE (jusqu'à 4 grimpeurs, sans chaîne) et du tacle : node --test core/free.test.js
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { course } from './kit.js';
import { createWorld, stepWorld, ST, P, IDLE } from './sim.js';

const run = (W, n, f = () => []) => { for (let i = 0; i < n; i++) stepWorld(W, f(i, W)); return W; };
const evs = (W, k) => W.ev.filter((e) => e.k === k);
function testCourse(build) {
  const K = course({ id: 'free-test', world: 'medieval', name: 't', short: 't', diff: 1, published: false, medals: { gold: 1, silver: 2, bronze: 3 }, backdrop: 'gorge' });
  K.block(0, -6, 0, 0, 24, 60, { mat: 'stone' }); K.cp(0, 0, -10, { yaw: 0 });
  build(K); return K.done({ abyss: -30 });
}

test('mode libre : 4 grimpeurs au départ, aucune chaîne, tous posés', () => {
  const W = run(createWorld({ free: true, players: 4 }), 240, () => []);
  assert.equal(W.pl.length, 4); assert.equal(W.ch.length, 0); assert.ok(W.free && W.alone);
  for (const p of W.pl) { assert.equal(p.st, ST.GROUND); assert.ok(Math.abs(p.vx) + Math.abs(p.vz) < 0.1); }
  const xs = W.pl.map((p) => p.x).sort((a, b) => a - b); for (let i = 1; i < 4; i++) assert.ok(xs[i] - xs[i - 1] > 0.5, 'pas empilés : ' + xs);
});

test('mode libre : chacun bouge pour soi (pas de chaîne qui retient)', () => {
  const W = createWorld({ free: true, players: 3 }); run(W, 60);
  const z0 = W.pl.map((p) => p.z);
  run(W, 60, () => [{ ...IDLE, mz: 1 }, IDLE, IDLE]);
  assert.ok(W.pl[0].z - z0[0] > 2, 'le coureur avance librement : ' + (W.pl[0].z - z0[0]));
  assert.ok(Math.abs(W.pl[1].z - z0[1]) < 0.3 && Math.abs(W.pl[2].z - z0[2]) < 0.3, 'les autres ne sont pas tirés');
});

test('mode libre : un grimpeur qui tombe revient à SON point de passage, pas les autres', () => {
  const W = createWorld({ free: true, players: 3 }); run(W, 60);
  W.pl[1].x = 6; const z1 = W.pl[2].z; W.pl[0].y = -100;
  run(W, 3);
  assert.ok(W.pl[0].y > -5, 'tombé : réapparu'); assert.equal(W.pl[1].x, 6, 'l\'autre n\'a pas bougé'); assert.ok(Math.abs(W.pl[2].z - z1) < 0.05);
});

test('tacle : la glissade fauche un grimpeur debout, un saut l\'évite', () => {
  const mk = () => createWorld({ level: testCourse(() => {}), free: true, players: 2 });
  const play = (jumper) => {
    const W = mk(); run(W, 60);
    W.pl[0].x = -2; W.pl[0].z = -8; W.pl[1].x = -2; W.pl[1].z = -5.2; W.pl[0].yaw = 0;
    let hit = false;
    run(W, 150, (i) => {
      for (const e of W.ev) if (e.k === 'tackle') hit = true;
      const a = i < 22 ? { ...IDLE, mz: 1 } : i === 22 ? { ...IDLE, mz: 1, slide: true } : { ...IDLE, mz: 1, slide: true };
      const b = jumper && i === 14 ? { ...IDLE, jc: 1, jump: true } : jumper && i < 80 ? { ...IDLE, jump: true, jc: 1 } : IDLE;
      return [a, b];
    });
    return { W, hit };
  };
  const { W, hit } = play(false);
  assert.ok(hit, 'le tacle touche'); assert.ok(W.pl[1].z > -5.2, 'victime projetée vers l\'avant : z=' + W.pl[1].z);
  const e = play(true); assert.equal(e.hit, false, 'le grimpeur en l\'air n\'est pas fauché');
});

test('glissade : on passe sous un obstacle bas, debout on est bloqué ; reptation si on y reste', () => {
  const lvl = testCourse((K) => { K.block(0, 1.1, 3.5, 6, 8, 4, { mat: 'stone' }); K.cp(0, 0, 18, { yaw: 0, finish: true }); });
  // debout : bloqué devant le plafond (z = 4)
  const A = createWorld({ level: lvl, free: true, players: 1 }); run(A, 60);
  run(A, 200, () => [{ ...IDLE, mz: 1 }]);
  assert.ok(A.pl[0].z < 4.1, 'debout bloqué : z=' + A.pl[0].z);
  // glissade : passe dessous et ressort de l'autre côté (la reptation prend le relais sous le plafond)
  const B = createWorld({ level: lvl, free: true, players: 1 }); run(B, 60);
  let crawled = false, slid = false;
  run(B, 600, (i, W) => { const p = W.pl[0]; if (p.crawl) crawled = true; if (p.slideT > 0) slid = true;
    return [{ ...IDLE, mz: 1, slide: p.z > 2.4 && p.z < 3.6 || p.slideT > 0 }]; });
  assert.ok(slid, 'glissade déclenchée'); assert.ok(B.pl[0].z > 8, 'passé de l\'autre côté : z=' + B.pl[0].z);
  assert.equal(B.pl[0].crawl, false); assert.ok(B.pl[0].y < 0.2, 'toujours au sol');
});

test('mode libre : le premier au sommet est classé, la partie finit quand tous ont fini', () => {
  const lvl = testCourse((K) => { K.cp(0, 0, 6, { yaw: 0, finish: true }); });
  const W = createWorld({ level: lvl, free: true, players: 2 }); run(W, 60);
  run(W, 420, (i) => [{ ...IDLE, mz: 1 }, IDLE]);
  assert.deepEqual(W.rank, [0]); assert.equal(W.done, false); assert.ok(W.pl[0].done && !W.pl[1].done);
  W.pl[1].z = 6; W.pl[1].x = 0; run(W, 30, () => [IDLE, IDLE]);
  assert.deepEqual(W.rank, [0, 1]); assert.equal(W.done, true);
});

test('inertie en l\'air : avec de l\'élan au-dessus de la course, le virage fait TOURNER la vitesse', () => {
  const W = createWorld({ level: testCourse(() => {}), free: true, players: 1 }); run(W, 60);
  const p = W.pl[0]; p.y += 6; p.st = ST.AIR; p.vx = 0; p.vz = 10; p.vy = 0; p.stT = 1;
  run(W, 36, () => [{ ...IDLE, mx: 1, mz: 0 }]);
  assert.ok(p.vx > 5, 'la vitesse a tourné vers +x : vx=' + p.vx.toFixed(2));
  assert.ok(Math.hypot(p.vx, p.vz) > 8, 'et garde son élan : ' + Math.hypot(p.vx, p.vz).toFixed(2));
  assert.ok(p.vz < 7, 'elle ne file plus tout droit : vz=' + p.vz.toFixed(2));
});

test('saut tapé juste avant le sol : part DEPUIS le sol et laisse le double saut disponible', () => {
  const W = createWorld({ level: testCourse(() => {}), free: true, players: 1 }); run(W, 60);
  let jc = 0; const jumps = [];
  const step = (jump) => { if (jump) jc++; stepWorld(W, [{ ...IDLE, jc, jump: !!jump }]); for (const e of W.ev) if (e.k === 'jump') jumps.push(e.dj ? 'dj' : 'sol'); };
  step(true);                                           // 1er saut depuis le sol
  for (let i = 0; i < 400 && !(W.pl[0].vy < -3 && W.pl[0].y < 0.5); i++) step(false); // on retombe
  step(true);                                           // saut tapé à ~40 cm du sol, vitesse descendante
  for (let i = 0; i < 30; i++) step(false);
  assert.deepEqual(jumps, ['sol', 'sol'], 'les deux sont des sauts depuis le sol : ' + jumps);
  assert.equal(W.pl[0].dj, false, 'le double saut n\'a pas été gaspillé');
  for (let i = 0; i < 12; i++) step(false);
  step(true);
  assert.deepEqual(jumps, ['sol', 'sol', 'dj'], 'et il part bien en l\'air : ' + jumps);
});

test('mode libre : poing et coup de pied touchent le grimpeur en face, pas les autres', () => {
  for (const kind of ['punch', 'kick']) {
    const W = createWorld({ level: testCourse(() => {}), free: true, players: 3 }); run(W, 60);
    // 0 regarde +z ; 1 est à 1 m devant lui ; 2 est derrière
    Object.assign(W.pl[0], { x: -3, z: -8, yaw: 0 }); Object.assign(W.pl[1], { x: -3, z: -7, yaw: Math.PI }); Object.assign(W.pl[2], { x: -3, z: -11, yaw: 0 });
    run(W, 20);
    const hits = []; let swung = false;
    run(W, 90, (i) => { for (const e of W.ev) { if (e.k === 'punch') hits.push(e.v); if (e.k === 'swing') swung = true; } return [{ ...IDLE, [kind]: i === 2 }, IDLE, IDLE]; });
    assert.ok(swung, kind + ' : le geste part');
    assert.deepEqual(hits, [1], kind + ' : seul le grimpeur en face est touché : ' + hits);
    assert.ok(W.pl[1].downT > 0 || W.pl[1].ko || W.pl[1].knock > 0 || W.pl[1].z > -6.5, kind + ' : il est projeté');
  }
});
