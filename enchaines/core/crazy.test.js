// mode CRAZY : tir, culasse, rechargement, saut mural, mort / réapparition, fin de manche
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, DT, IDLE, ST, P, CZ, inside } from './sim.js';
import { KAR } from './weapon.js';
import { courseList } from './worlds.js';
import { course } from './kit.js';

// terrain d'essai : grand sol plat, un mur plein en travers à z = 9, deux places d'apparition
const flat = (() => { const K = course({ id: 'czflat', world: 'mech', name: 't', short: 't', diff: 1, published: false, crazy: true, medals: { gold: 1, silver: 2, bronze: 3 }, abyss: -12 });
  K.block(0, -4, 0, 0, 120, 120, { mat: 'metal' }); K.block(0, -4, 8, 70, 120, 1, { mat: 'brick' }); K.cp(-30, 0, -30); K.cp(30, 0, 30); return K.done(); })();

const mk = (n = 2, course) => createWorld({ crazy: true, ...(course ? { course } : { level: flat }), players: n });
const run = (W, ins, secs) => { const evs = []; for (let i = 0; i < Math.round(secs / DT); i++) { stepWorld(W, ins); evs.push(...W.ev.map((e) => ({ ...e }))); } return evs; };
// tireur p0 en (0,0,-10) regardant +z ; cible p1 à 20 m devant
function duel(opts = {}) {
  const W = mk(2); const [a, b] = W.pl;
  Object.assign(a, { x: -15, y: 0, z: -3, vx: 0, vz: 0, prot: 0 }); Object.assign(b, { x: -15.45, y: 0, z: 17, vx: 0, vz: 0, prot: 0, ...opts });
  return { W, a, b, aim: (ap = 0) => ({ ...IDLE, ay: 0, ap }) };
}
const fire = (I) => ({ ...I, fire: true });

test('les arènes crazy sont à part des parcours et leurs places d\'apparition sont libres', () => {
  assert.ok(courseList(true, true).length >= 2);
  assert.ok(!courseList(true).some((c) => c.crazy));
  for (const c of courseList(true, true)) {
    const W = createWorld({ crazy: true, course: c.id, players: 4 });
    for (const q of c.checkpoints) for (const h of [0.6, 1, 1.7]) assert.ok(!inside(W, q.x, q.y + h, q.z, 0.3), `${c.id} apparition ${q.x},${q.z} dans un objet à ${h}`);
    for (const p of W.pl) for (const h of [0.6, 1, 1.7]) assert.ok(!inside(W, p.x, p.y + h, p.z, 0.3), `${c.id} joueur ${p.id} dans un objet`);
  }
});

test('un tir au corps retire 60, à la tête tue, aux jambes 40', () => {
  for (const [ap, dmg] of [[Math.atan2(1.0 - 1.5, 20), KAR.DMG_BODY], [Math.atan2(1.68 - 1.5, 20), KAR.DMG_HEAD], [Math.atan2(0.3 - 1.5, 20), KAR.DMG_LEG]]) {
    const { W, b, aim } = duel(); const ev = run(W, [fire(aim(ap)), IDLE], 0.05);
    const h = ev.find((e) => e.k === 'hit'); assert.ok(h, 'touché'); assert.equal(h.dmg, dmg);
    assert.equal(b.hp, Math.max(0, KAR.HP - dmg));
  }
});

test('un mur arrête la balle', () => {
  const { W } = duel();
  const ev = run(W, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1 - 1.5, 20) }), IDLE], 0.05); assert.ok(ev.some((e) => e.k === 'hit'));
  const W2 = mk(2); const [a2, b2] = W2.pl; Object.assign(a2, { x: 0, y: 0, z: 1, prot: 0 }); Object.assign(b2, { x: -0.45, y: 0, z: 14, prot: 0 }); b2.hp = KAR.HP; W2.bodies.push(Object.assign({}, W2.bodies[0], { i: 99, px: 0, py: 1, pz: 8, hw: 6, hh: 2, hd: 0.3, ex: 6, ez: 6, c: 1, s: 0, on: true })); // mur plein entre les deux
  const ev2 = run(W2, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1 - 1.5, 12) }), IDLE], 0.05);
  assert.ok(!ev2.some((e) => e.k === 'hit'), 'le mur protège'); assert.equal(b2.hp, KAR.HP);
});

test('cycle de culasse : une douille éjectée par tir, pas de tir pendant le cycle, 5 cartouches', () => {
  const { W, a } = duel(); const I = fire({ ...IDLE, ay: 0, ap: 0.2 });
  const ev = run(W, [I, IDLE], KAR.CYCLE * 2 + 0.1);
  assert.equal(ev.filter((e) => e.k === 'shot').length, 3, 'tirs espacés par le cycle (maintenir = 1 tir / cycle)');
  assert.equal(ev.filter((e) => e.k === 'casing').length, 2);
  assert.deepEqual(ev.filter((e) => e.k === 'bolt').slice(0, 5).map((e) => e.s), ['up', 'back', 'eject', 'fwd', 'down']);
  assert.equal(a.ammo, KAR.AMMO - 3);
});

test('chargeur vide : clic à vide puis rechargement complet', () => {
  const { W, a } = duel(); a.ammo = 0;
  let ev = run(W, [fire({ ...IDLE, ay: 0, ap: 0.2 }), IDLE], 0.02);
  assert.ok(a.rl >= 0, 'rechargement lancé au tir à vide');
  ev = ev.concat(run(W, [{ ...IDLE, ay: 0 }, IDLE], KAR.RELOAD + 0.1));
  assert.deepEqual(ev.filter((e) => e.k === 'reload').map((e) => e.s), ['open', 'clip', 'push', 'close']);
  assert.equal(a.ammo, KAR.AMMO); assert.equal(a.rl, -1);
});

test('mort, compteurs, réapparition protégée, fin de manche', () => {
  const { W, a, b } = duel(); const I = fire({ ...IDLE, ay: 0, ap: Math.atan2(1.68 - 1.5, 20) });
  const ev = run(W, [I, IDLE], 0.05);
  assert.ok(ev.some((e) => e.k === 'kill' && e.p === 0 && e.v === 1 && e.head)); assert.equal(a.kills, 1); assert.equal(b.deaths, 1); assert.ok(b.dead > 0);
  const ev2 = run(W, [IDLE, IDLE], CZ.RESPAWN + 0.1);
  assert.ok(ev2.some((e) => e.k === 'spawn' && e.p === 1)); assert.equal(b.hp, KAR.HP); assert.ok(b.prot > 0);
  a.kills = W.limit - 1; b.prot = 0; Object.assign(b, { x: -15.45, y: 0, z: 17 }); Object.assign(a, { x: -15, y: 0, z: -3, cd: 0, cyc: 0 });
  const ev3 = run(W, [I, IDLE], 0.1); assert.ok(W.done); assert.deepEqual(W.rank, [0, 1]); assert.ok(ev3.some((e) => e.k === 'end'));
});

test('saut mural : on repart à l\'opposé d\'un mur, en boucle entre deux colonnes', () => {
  const W = mk(1); const p = W.pl[0];
  // contre l'enceinte nord (z = 42), en l'air
  Object.assign(p, { x: 5, y: 3, z: 69.5 - P.R - 0.05, vx: 0, vz: 1, vy: -2, st: ST.AIR, stT: 1, prot: 0 });
  stepWorld(W, [{ ...IDLE, mz: 1, jc: 1 }]); // appui sur saut
  assert.ok(W.ev.some((e) => e.k === 'jump' && e.wall), 'saut mural'); assert.ok(p.vz < -4, 'repart vers -z'); assert.ok(p.vy > 7);
  const before = p.vy; stepWorld(W, [{ ...IDLE, mz: 1, jc: 1 }]); assert.ok(p.vy <= before, 'pas de second saut mural immédiat');
});

test('chute dans le vide = mort (crédit à celui qui a touché en dernier)', () => {
  const { W, a, b } = duel(); b.lastBy = 0; b.lastByT = 0; b.y = -50;
  const ev = run(W, [IDLE, IDLE], 0.05);
  assert.ok(ev.some((e) => e.k === 'kill' && e.v === 1 && e.p === 0)); assert.equal(a.kills, 1);
});

test('déterminisme : mêmes entrées => même état', () => {
  const go = () => { const { W } = duel(); const I = fire({ ...IDLE, ay: 0.01, ap: 0.05, mx: 0.5 }); run(W, [I, IDLE], 3); return JSON.stringify(W.pl.map((p) => [p.x, p.y, p.z, p.hp, p.ammo, p.cyc])); };
  assert.equal(go(), go());
});
