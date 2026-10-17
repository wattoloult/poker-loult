// Tests des mécanismes des mines (core/biomes/deep.js) sur le VRAI parcours « mine » : leviers à impulsion, wagonnets, étais, éboulement,
// cage du treuil, contrepoids des bennes, instantanés réseau.   node --test core/deep.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, snapWorld, applySnap, spawnAt, groundBelow, ST, IDLE, DT } from './sim.js';

const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const put = (W, k, b, dx = 0, dz = 0) => Object.assign(W.pl[k], { x: b.px + dx, y: b.py + b.hh + 0.05, z: b.pz + dz, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const at = (W, k, x, y, z) => Object.assign(W.pl[k], { x, y, z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const byLever = (W, id) => W.bodies.find((b) => b.lever?.id === id);
const byGate = (W, id) => W.bodies.find((b) => b.move?.gate === id);
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const start = (name) => { const W = createWorld({ course: 'mine' }); W.cp = W.level.checkpoints.findIndex((c) => c.name.includes(name)); assert.ok(W.cp >= 0, 'point de passage ' + name); spawnAt(W, W.cp); return W; };
const pull = (W, id) => { W.sw[id] = true; };

test('levier à impulsion : actif exactement `pulse` s, impossible à couper en route, puis retombe', () => {
  const W = start('Les Rails'), lv = byLever(W, 'c1');
  pull(W, 'c1'); run(W, 60);
  assert.equal(W.sw.c1, true);
  W.sw.c1 = false; run(W, 1); // un joueur rappuie : sans effet
  assert.equal(W.sw.c1, true, 'verrouillé');
  run(W, Math.round(lv.deep.pulse / DT) - 65);
  assert.equal(W.sw.c1, true, 'toujours actif juste avant la fin');
  run(W, 12);
  assert.equal(W.sw.c1, false, 'retombé');
});

test('wagonnet : un aller-retour complet, il revient à son quai de départ', () => {
  const W = start('Les Rails'), w = byGate(W, 'c1'), x0 = w.px;
  put(W, 0, w, -0.5); put(W, 1, w, 0.5); layChain(W);
  pull(W, 'c1');
  let far = -1e9, x = 0;
  for (let i = 0; i < 16 * 120 + 30; i++) { stepWorld(W, [IDLE, IDLE]); far = Math.max(far, w.px); x = w.px; }
  assert.ok(far - x0 > 13.5, 'trajet ' + (far - x0).toFixed(1) + ' m');
  assert.ok(Math.abs(x - x0) < 0.05, 'revenu au quai (écart ' + (x - x0).toFixed(2) + ')');
  assert.ok(W.pl.every((p) => p.st === ST.GROUND && p.gb === w.i), 'les deux grimpeurs sont restés à bord');
  assert.equal(W.falls, 0);
});

test('wagonnet de la descente : les passagers arrivent en bas à l\'autre quai', () => {
  const W = start('Les Rails'), w = byGate(W, 'c2'), quay = W.bodies.find((b) => b.i > w.i && b.mat === 'rock');
  W.cp = W.level.checkpoints.findIndex((c) => c.name === 'Les Rails');
  put(W, 0, w, -0.5); put(W, 1, w, 0.5); layChain(W); pull(W, 'c2');
  let ok = false;
  for (let i = 0; i < 18 * 120 && !ok; i++) {
    stepWorld(W, [IDLE, IDLE]);
    if (w.px > quay.px - quay.hw - 4 && w.py > quay.py - 0.2 - 0.3 && Math.abs(w.py + w.hh - (quay.py + quay.hh)) < 0.05) { // arrivé : on avance sur le quai
      const go = (p) => ({ ...IDLE, ...toward(p, quay.px, quay.pz), jump: true, jc: 1 }); run(W, 120, () => go(W.pl[0]), () => go(W.pl[1])); ok = W.pl.every((p) => p.gb === quay.i);
    }
  }
  assert.ok(ok, 'les deux sur le quai bas');
});

test('étai : porte un grimpeur, cède sous deux, revient plus tard', () => {
  const W = start('L\'Entrée'), e = W.bodies.find((b) => b.deep?.k === 'prop');
  put(W, 0, e, -0.6); at(W, 1, e.px - 4, e.py + e.hh + 3, e.pz); layChain(W);
  run(W, 240);
  assert.equal(W.ext.deep.p[e.i].s, 0, 'un seul : tient');
  assert.equal(e.on, true);
  put(W, 1, e, 0.6); layChain(W);
  run(W, 30);
  assert.equal(W.ext.deep.p[e.i].s, 1, 'à deux : il gémit');
  assert.ok(e.py < e.y, 'il plie');
  run(W, 60);
  assert.equal(W.ext.deep.p[e.i].s, 2, 'puis cède');
  assert.equal(e.on, false);
  // les grimpeurs tombent ; on relâche (hors dessus) et on attend le retour de l'étai
  at(W, 0, e.px, e.py + 5, e.pz + 20); at(W, 1, e.px, e.py + 5, e.pz + 21); layChain(W);
  const back = e.deep.back ?? 6;
  for (let i = 0; i < (back + 1) * 120; i++) { stepWorld(W, [IDLE, IDLE]); at(W, 0, e.px, e.py + 5, e.pz + 20); at(W, 1, e.px, e.py + 5, e.pz + 21); }
  assert.equal(e.on, true, 'revenu');
});

test('étai : si le second saute avant la fin du gémissement, il tient', () => {
  const W = start('L\'Entrée'), e = W.bodies.find((b) => b.deep?.k === 'prop');
  put(W, 0, e, -0.6); put(W, 1, e, 0.6); layChain(W); run(W, 20);
  assert.equal(W.ext.deep.p[e.i].s, 1);
  at(W, 1, e.px + 6, e.py + e.hh + 0.05, e.pz); layChain(W);
  run(W, 120);
  assert.equal(W.ext.deep.p[e.i].s, 0);
  assert.equal(e.on, true);
});

test('éboulement : déclenché par l\'entrée dans la galerie, efface le sol derrière lui, repart à zéro à la réapparition', () => {
  const W = start('L\'Éboulement'), wall = W.bodies.find((b) => b.deep?.k === 'chase'), caves = W.bodies.filter((b) => b.deep?.k === 'cave');
  const d = wall.deep;
  run(W, 120);
  assert.equal(wall.on, false, 'rien tant que personne n\'entre');
  assert.equal(W.ext.deep.c.ebl.on, 0);
  at(W, 0, caves[0].x, caves[0].py + 2, 0); at(W, 1, caves[0].x - 1, caves[0].py + 2, 0); layChain(W);
  run(W, 2);
  assert.equal(W.ext.deep.c.ebl.on, 1, 'poursuite lancée');
  assert.equal(wall.on, true);
  const x1 = wall.px; run(W, 120);
  assert.ok(Math.abs(wall.px - x1 - d.v) < 0.1, 'avance de v m/s : ' + (wall.px - x1).toFixed(2));
  const keep = () => { at(W, 0, 111, -5, 0); at(W, 1, 111, -5, 1); layChain(W); }; // en l'air, à l'écart : jamais de chute (donc pas de réapparition)
  for (let i = 0; i < 40 * 120 && W.ext.deep.c.ebl.x < caves[2].x + 1; i++) { keep(); stepWorld(W, [IDLE, IDLE]); }
  keep(); run(W, 2);
  assert.ok(!caves[0].on && !caves[1].on && !caves[2].on, 'sol effondré derrière le mur');
  assert.ok(caves[8].on, 'le sol devant le mur est intact');
  for (let i = 0; i < 40 * 120 && W.ext.deep.c.ebl.on; i++) { keep(); stepWorld(W, [IDLE, IDLE]); }
  keep(); run(W, 2);
  assert.equal(W.ext.deep.c.ebl.d, 1, 'poursuite terminée');
  assert.equal(wall.on, false);
  spawnAt(W, W.cp); run(W, 2);
  assert.equal(W.ext.deep.c.ebl.on, 0); assert.equal(W.ext.deep.c.ebl.x, d.x0); assert.ok(caves.every((c) => c.on), 'le sol est revenu');
});

test('éboulement : un grimpeur happé par le mur est projeté vers l\'avant', () => {
  const W = start('L\'Éboulement'), wall = W.bodies.find((b) => b.deep?.k === 'chase'), cv = W.bodies.find((b) => b.deep?.k === 'cave');
  at(W, 0, cv.x, cv.py + cv.hh + 0.2, 0); at(W, 1, cv.x, cv.py + cv.hh + 0.2, 1); layChain(W);
  // le mur démarre à 14 m derrière ; on l'attend sans bouger tant qu'il n'a pas atteint les grimpeurs (le sol est encore là)
  let hit = false;
  for (let i = 0; i < 12 * 120 && !hit; i++) { stepWorld(W, [IDLE, IDLE]); hit = W.ev.some((e) => e.k === 'hit'); }
  assert.ok(hit, 'le mur frappe');
});

test('lampe à manivelle : 45 s de lumière puis retombe', () => {
  const W = start('La Galerie noire');
  pull(W, 'lamp'); run(W, 45 * 120 - 5); assert.equal(W.sw.lamp, true);
  run(W, 10); assert.equal(W.sw.lamp, false);
});

test('cage du treuil : les deux grimpeurs montent de 10 m et gagnent la corniche', () => {
  const W = start('Le Treuil'), cage = byGate(W, 'lift'), ledge = W.bodies.find((b) => b.i > cage.i && b.mat === 'rock');
  put(W, 0, cage, -0.6); put(W, 1, cage, 0.6); layChain(W); pull(W, 'lift');
  let top = false, got = false;
  for (let i = 0; i < 14 * 120 && !got; i++) {
    stepWorld(W, [IDLE, IDLE]);
    if (!top && cage.py + cage.hh > ledge.py + ledge.hh - 0.05) top = true;
    if (top) { const go = (p) => ({ ...IDLE, ...toward(p, ledge.px, ledge.pz), jump: true, jc: Math.floor(i / 20) }); stepWorld(W, [go(W.pl[0]), go(W.pl[1])]); got = W.pl.every((p) => p.gb === ledge.i); }
  }
  assert.ok(top, 'la cage arrive en haut'); assert.ok(got, 'les deux sur la corniche'); assert.equal(W.falls, 0);
});

// contrepoids des bennes (même scénario que coop.test.js : B monte sur la benne légère, A pend et remonte la chaîne)
test('contrepoids des bennes : les deux finissent sur la corniche', () => {
  const W = start('Le Contrepoids');
  const plus = W.bodies.find((b) => b.cw?.side === 1), minus = W.bodies.find((b) => b.cw?.side === -1), goal = W.bodies.find((b) => b.coop && b.i > minus.i);
  put(W, 0, plus); put(W, 1, minus); layChain(W);
  let jcA = 0, jcB = 0, phase = 0, t = 0; const on = (p) => p.st === ST.GROUND && p.gb === goal.i, got = [false, false];
  const edge = (p, d) => p.st === ST.GROUND && !groundBelow(W, p.x + d.mx * 0.5, p.y + 0.05, p.z + d.mz * 0.5, 0.4);
  for (let i = 0; i < 120 * 40 && !(got[0] && got[1]); i++) {
    const A = W.pl[0], B = W.pl[1]; t++; let ia = IDLE, ib = IDLE;
    if (phase === 0 && t > 240) phase = 1;
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

test('instantané réseau : l\'état des mines (impulsions, étais, éboulement) survit à snapWorld / applySnap', () => {
  const W = start('L\'Éboulement'), wall = W.bodies.find((b) => b.deep?.k === 'chase');
  pull(W, 'c1'); at(W, 0, W.bodies.find((b) => b.deep?.k === 'cave').x, -9, 0); at(W, 1, W.bodies.find((b) => b.deep?.k === 'cave').x, -9, 1); layChain(W); run(W, 200);
  const s = JSON.parse(JSON.stringify(snapWorld(W, true))), V = createWorld({ course: 'mine' });
  applySnap(V, s);
  assert.deepEqual(V.ext, W.ext);
  run(W, 1); run(V, 1);
  assert.ok(Math.abs(V.bodies[wall.i].px - wall.px) < 1e-9 && V.bodies[wall.i].on === wall.on, 'mur à la même place');
  run(W, 120); run(V, 120);
  assert.ok(Math.abs(V.bodies[wall.i].px - W.bodies[wall.i].px) < 1e-6, 'même évolution');
});

// poursuite : deux robots qui courent de planche en planche (saut au bord) arrivent à l'abri avant que le sol ne disparaisse sous eux
test('éboulement : deux grimpeurs qui courent sans traîner s\'en sortent, sans chute', () => {
  const W = start('L\'Éboulement'), wall = W.bodies.find((b) => b.deep?.k === 'chase'), nook = W.bodies.find((b) => b.i > wall.i && b.mat === 'rock' && !b.deep && b.px > 165);
  const jc = [0, 0], goal = { x: nook.px, z: nook.pz };
  let done = false, tEnd = 0;
  for (let i = 0; i < 40 * 120 && !done; i++) {
    const ins = W.pl.map((p, k) => {
      const d = toward(p, goal.x, goal.z), edge = p.st === ST.GROUND && !groundBelow(W, p.x + d.mx * 0.5, p.y + 0.05, p.z + d.mz * 0.5, 0.4);
      if (edge || (p.st === ST.GROUND && p.x < 114 && i % 40 === 0)) jc[k]++; // les premiers pas : aucun saut inutile, juste avancer
      const slow = k === 1 && W.pl[1].x > W.pl[0].x + 4; // le second ne dépasse pas la chaîne
      return { ...IDLE, mx: slow ? 0 : d.mx, mz: d.mz, jc: jc[k], jump: true };
    });
    stepWorld(W, ins);
    if (W.pl.every((p) => p.st === ST.GROUND && p.gb === nook.i)) { done = true; tEnd = i * DT; }
  }
  assert.ok(done, 'arrivés à l\'abri (chutes ' + W.falls + ', mur x=' + W.ext.deep.c.ebl.x.toFixed(1) + ')');
  assert.equal(W.falls, 0);
  assert.ok(tEnd < 25, 'temps ' + tEnd.toFixed(1)); if (process.env.DBG) console.log('traversée', tEnd.toFixed(1), 's, mur à', W.ext.deep.c.ebl.x.toFixed(1));
});
