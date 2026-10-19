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
  Object.assign(a, { x: -15, y: 0, z: -3, vx: 0, vz: 0, prot: 0 }); Object.assign(b, { x: -15 - SH, y: 0, z: 17, vx: 0, vz: 0, prot: 0, ...opts });
  return { W, a, b, aim: (ap = 0) => ({ ...IDLE, ay: 0, ap }) };
}
const fire = (I) => ({ ...I, fire: true });
const EYEC = 1.5 + CZ.CAMUP; // hauteur du rayon de visée de la caméra
const SH = CZ.SHOULDER;

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
  for (const [ap, dmg] of [[Math.atan2(1.0 - EYEC, 20), KAR.DMG_BODY], [Math.atan2(1.68 - EYEC, 20), KAR.DMG_HEAD], [Math.atan2(0.3 - EYEC, 20), KAR.DMG_LEG]]) {
    const { W, b, aim } = duel(); const ev = run(W, [fire(aim(ap)), IDLE], 0.05);
    const h = ev.find((e) => e.k === 'dmg'); assert.ok(h, 'touché'); assert.equal(h.dmg, dmg);
    assert.equal(b.hp, Math.max(0, KAR.HP - dmg));
  }
});

test('un mur arrête la balle', () => {
  const { W } = duel();
  const ev = run(W, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1 - EYEC, 20) }), IDLE], 0.05); assert.ok(ev.some((e) => e.k === 'dmg'));
  const W2 = mk(2); const [a2, b2] = W2.pl; Object.assign(a2, { x: 0, y: 0, z: 1, prot: 0 }); Object.assign(b2, { x: -SH, y: 0, z: 14, prot: 0 }); b2.hp = KAR.HP; W2.bodies.push(Object.assign({}, W2.bodies[0], { i: 99, px: 0, py: 1, pz: 8, hw: 6, hh: 2, hd: 0.3, ex: 6, ez: 6, c: 1, s: 0, on: true })); // mur plein entre les deux
  const ev2 = run(W2, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1 - EYEC, 12) }), IDLE], 0.05);
  assert.ok(!ev2.some((e) => e.k === 'dmg'), 'le mur protège'); assert.equal(b2.hp, KAR.HP);
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
  const { W, a, b } = duel(); const I = fire({ ...IDLE, ay: 0, ap: Math.atan2(1.68 - EYEC, 20) });
  const ev = run(W, [I, IDLE], 0.05);
  assert.ok(ev.some((e) => e.k === 'kill' && e.p === 0 && e.v === 1 && e.head)); assert.equal(a.kills, 1); assert.equal(b.deaths, 1); assert.ok(b.dead > 0);
  const ev2 = run(W, [IDLE, IDLE], CZ.RESPAWN + 0.1);
  assert.ok(ev2.some((e) => e.k === 'spawn' && e.p === 1)); assert.equal(b.hp, KAR.HP); assert.ok(b.prot > 0);
  a.kills = 3; W.time = W.tmax - 0.05; b.prot = 0; // la manche finit au temps (10 min), pas aux éliminations Object.assign(b, { x: -15 - SH, y: 0, z: 17 }); Object.assign(a, { x: -15, y: 0, z: -3, cd: 0, cyc: 0 });
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

test('la balle touche ce qui est sous le viseur de la caméra, de près comme de loin', () => {
  for (const dist of [2.5, 6, 40]) {
    const { W, b } = duel(); Object.assign(b, { x: -15 - SH, y: 0, z: -3 + dist });
    const ev = run(W, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1.0 - EYEC, dist) }), IDLE], 0.05);
    assert.ok(ev.some((e) => e.k === 'dmg' && e.v === 1), `touché à ${dist} m`);
  }
});

test('saut mural : trois au plus par envol', () => {
  const W = mk(1); const p = W.pl[0]; let n = 0;
  Object.assign(p, { x: 5, y: 3, z: 69.5 - P.R - 0.05, vx: 0, vz: 1, vy: -2, st: ST.AIR, stT: 1, prot: 0 });
  for (let i = 0; i < 40; i++) { Object.assign(p, { y: 3, vy: -2, z: 69.5 - P.R - 0.05, vz: 1, st: ST.AIR, stT: 1 }); p.wjCd = 0; stepWorld(W, [{ ...IDLE, mz: 1, jc: i + 1 }]); if (W.ev.some((e) => e.k === 'jump' && e.wall)) n++; }
  assert.equal(n, CZ.WJ_MAX);
});

test('la Cour du Dragon : on monte l\'escalier de 2 m en marchant et les pavillons sont des murs', () => {
  const W = createWorld({ crazy: true, course: 'cour', players: 1 }), p = W.pl[0];
  Object.assign(p, { x: 0, y: 0, z: -4, vx: 0, vz: 0, prot: 0, st: ST.GROUND });
  for (let i = 0; i < 600; i++) stepWorld(W, [{ ...IDLE, mz: -1, ay: Math.PI, ap: 0 }]);
  assert.ok(p.y > 1.9 && p.y < 2.1, 'en haut des marches : ' + p.y);
  Object.assign(p, { x: 14, y: 0, z: 0, vx: 0, vz: 0 }); for (let i = 0; i < 360; i++) stepWorld(W, [{ ...IDLE, mx: 1, ay: -Math.PI / 2, ap: 0 }]);
  assert.ok(p.x < 21, 'bloqué par l\'enceinte : ' + p.x);
});

test('la Cour du Dragon : le liseré de 12 cm autour du carré central est solide (on marche dessus, pas dedans)', () => {
  const W = createWorld({ crazy: true, course: 'cour', players: 1 }), p = W.pl[0];
  Object.assign(p, { x: -4, y: 0, z: 2, vx: 0, vz: 0, prot: 0, st: ST.GROUND }); let on = 0;
  for (let i = 0; i < 360; i++) { stepWorld(W, [{ ...IDLE, mz: 1, ay: 0, ap: 0 }]); if (p.z > 4.2 && p.z < 4.8) on = Math.max(on, p.y); }
  assert.ok(on > 0.11 && on < 0.13, 'sur le liseré, les pieds à 12 cm : ' + on);
  assert.ok(p.y < 0.01, 'redescendu de l\'autre côté : ' + p.y);
});

test('fuzz : quatre tireurs aux entrées aléatoires restent dans chaque arène (jamais sous le sol, jamais de valeur absurde)', () => {
  for (const c of courseList(true, true)) {
    const W = createWorld({ crazy: true, course: c.id, players: 4 }); let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const ins = W.pl.map(() => ({ ...IDLE })); let jc = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 90 === 0) for (const I of ins) { Object.assign(I, { mx: rnd() * 2 - 1, mz: rnd() * 2 - 1, ay: rnd() * 6 - 3, ap: rnd() * 0.6 - 0.3, fire: rnd() < 0.5, scope: rnd() < 0.2, reload: rnd() < 0.1, slide: rnd() < 0.2 }); }
      if (i % 40 === 0) for (const I of ins) if (rnd() < 0.5) I.jc = ++jc;
      stepWorld(W, ins);
      for (const p of W.pl) { assert.ok(Number.isFinite(p.x + p.y + p.z), `${c.id} valeur absurde`); assert.ok(p.dead > 0 || p.y > -2, `${c.id} sous le sol : ${p.y.toFixed(1)} (tick ${i})`); assert.ok(Math.abs(p.x) < 60 && Math.abs(p.z) < 60, `${c.id} sorti de l'arène : ${p.x.toFixed(0)},${p.z.toFixed(0)}`); }
    }
  }
});

test('visée : un seul niveau (à l\'épaule), jamais de lunette, et le tir part en visant', () => {
  const { W, a } = duel();
  run(W, [{ ...IDLE, ay: 0, ap: 0, scope: true }, IDLE], 1.0); assert.ok(a.scope && !a.zm, 'visée à l\'épaule, même maintenue 1 s : pas de second niveau');
  const ev = run(W, [fire({ ...IDLE, ay: 0, ap: Math.atan2(1.0 - EYEC, 20), scope: true }), IDLE], 0.05);
  assert.ok(ev.some((e) => e.k === 'shot') && ev.some((e) => e.k === 'dmg' && e.v === 1), 'tir pendant la visée : touché');
  run(W, [IDLE, IDLE], 0.1); assert.ok(!a.scope && a.scT === 0, 'relâché : visée normale');
});

test('déplacements crazy : départ et arrêt progressifs (pas instantanés), sprint avec Maj vers l\'avant, marche arrière plus lente', () => {
  const W = mk(1), p = W.pl[0]; Object.assign(p, { x: 0, y: 0, z: 0, vx: 0, vz: 0, st: ST.GROUND, prot: 0 });
  run(W, [{ ...IDLE, mz: 1, ay: 0 }], 0.05); const v1 = Math.hypot(p.vx, p.vz); assert.ok(v1 > 0.5 && v1 < 2.2, 'démarrage progressif : ' + v1.toFixed(2));
  run(W, [{ ...IDLE, mz: 1, ay: 0 }], 0.5); assert.ok(Math.abs(Math.hypot(p.vx, p.vz) - P.RUN) < 0.05, 'pleine vitesse en moins de 0,3 s');
  run(W, [{ ...IDLE, mz: 1, ay: 0, brace: true }], 0.5); assert.ok(Math.abs(Math.hypot(p.vx, p.vz) - P.RUN * CZ.SPRINT) < 0.05, 'sprint : ' + Math.hypot(p.vx, p.vz).toFixed(2));
  run(W, [{ ...IDLE, ay: 0 }], 0.05); assert.ok(Math.hypot(p.vx, p.vz) > 4, 'arrêt progressif');
  run(W, [{ ...IDLE, mz: -1, ay: 0 }], 0.8); assert.ok(Math.abs(Math.hypot(p.vx, p.vz) - P.RUN * CZ.BACK) < 0.05, 'marche arrière : ' + Math.hypot(p.vx, p.vz).toFixed(2));
});

test('glissade murale : contre un mur lisse on ne s\'accroche pas, on glisse (chute freinée, état visible) ; un bord à hauteur de poitrine se franchit d\'un coup', () => {
  const W = mk(1), p = W.pl[0];
  Object.assign(p, { x: 0, y: 3, z: 69.5 - P.R - 0.02, vx: 0, vy: -1, vz: 0, st: ST.AIR, stT: 1, prot: 0 }); let slid = 0, minVy = 0;
  for (let i = 0; i < 40; i++) { stepWorld(W, [{ ...IDLE, mz: 1, ay: 0 }]); if (p.wsl) slid++; minVy = Math.min(minVy, p.vy); }
  assert.ok(p.st !== ST.HANG && slid > 20 && minVy >= -CZ.WALL_SLIDE - 1e-6, `glisse sans s'accrocher (${slid} pas, vy min ${minVy.toFixed(2)})`);
  // muret de 1,2 m : on saute vers lui, on passe dessus sans pendre
  const K = course({ id: 'czv', world: 'mech', name: 't', short: 't', diff: 1, published: false, crazy: true, medals: { gold: 1, silver: 2, bronze: 3 }, abyss: -12 });
  K.block(0, -4, 0, 0, 40, 40, { mat: 'metal' }); K.block(0, 0, 1.7, 3, 6, 1.5, { mat: 'brick' }); K.cp(-15, 0, -15); K.cp(15, 0, 15); // mur plus haut que l'apex du saut (1,6 m) : on ne peut que le FRANCHIR en posant les mains
  const V = createWorld({ crazy: true, level: K.done(), players: 1 }), q = V.pl[0]; Object.assign(q, { x: 0, y: 0, z: 1.2, vx: 0, vz: 0, st: ST.GROUND, prot: 0 }); let hung = false;
  let top = 0; for (let i = 0; i < 120; i++) { stepWorld(V, [{ ...IDLE, mz: 1, ay: 0, jc: 1, jump: i < 40 }]); if (q.st === ST.HANG) hung = true; if (q.st === ST.GROUND) top = Math.max(top, q.y); }
  assert.ok(!hung && top > 1.65, 'mur de 1,7 m franchi d\'un coup, sans pendre : debout à ' + top.toFixed(2));
});
