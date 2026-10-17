// Scénarios coopératifs joués sur les VRAIS parcours (deux grimpeurs + chaîne) : contrepoids puis remontée à la chaîne, herse à deux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, groundBelow, ST, IDLE } from './sim.js';
import { getCourse } from './worlds.js';

const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { mx: dx / l, mz: dz / l }; };
const place = (W, k, b) => Object.assign(W.pl[k], { x: b.px, y: b.py + b.hh + 0.05, z: b.pz, vx: 0, vy: 0, vz: 0, st: ST.AIR });

// contrepoids : A charge le plateau +1, B monte sur le plateau -1 et gagne la corniche ; B s'arc-boute, A saute, pend et remonte la chaîne
function counterweight(courseId, cwId) {
  const L = getCourse(courseId), W = createWorld({ course: courseId });
  const plus = W.bodies.find((b) => b.cw?.id === cwId && b.cw.side === 1), minus = W.bodies.find((b) => b.cw?.id === cwId && b.cw.side === -1);
  const goal = W.bodies.find((b) => b.coop && b.i > minus.i);
  const cpi = L.checkpoints.findIndex((c) => c.zone === plus.zone); W.cp = cpi;
  place(W, 0, plus); place(W, 1, minus); layChain(W);
  let jcA = 0, jcB = 0, phase = 0, t = 0;
  const on = (p) => p.st === ST.GROUND && p.gb === goal.i, got = [false, false];
  for (let i = 0; i < 120 * 40 && !(got[0] && got[1]); i++) {
    const A = W.pl[0], B = W.pl[1]; t++;
    let ia = IDLE, ib = IDLE;
    if (phase === 0 && t > 240) phase = 1; // le plateau de B est monté
    const edge = (p, d) => p.st === ST.GROUND && !groundBelow(W, p.x + d.mx * 0.5, p.y + 0.05, p.z + d.mz * 0.5, 0.4); // bord : on saute
    if (phase === 1) { // B saute du plateau monté vers la corniche (A reste sur son plateau)
      const d = toward(B, goal.px, goal.pz); if (edge(B, d)) jcB++; ib = { ...IDLE, ...d, jc: jcB, jump: true };
      if (on(B)) { phase = 2; t = 0; }
    }
    if (phase === 2) { // B recule jusqu'à tendre la chaîne puis s'arc-boute ; A saute, pend et remonte la chaîne (Maj)
      const away = toward(B, 2 * B.x - A.x, 2 * B.z - A.z);
      const room = groundBelow(W, B.x + away.mx * 0.9, B.y + 0.05, B.z + away.mz * 0.9, 0.3); // encore du sol derrière soi
      ib = W.taut > 0.6 || !room ? { ...IDLE, brace: true } : { ...IDLE, mx: away.mx, mz: away.mz };
      const d = toward(A, goal.px, goal.pz); if (!on(A) && (edge(A, d) || (A.st === ST.GROUND && t % 90 === 0))) jcA++;
      ia = on(A) ? IDLE : { ...IDLE, ...d, jc: jcA, jump: true, brace: A.dangling };
    }
    stepWorld(W, [ia, ib]);
    W.pl.forEach((p, k) => { if (on(p)) got[k] = true; });
    if (process.env.DBG && i % 60 === 0) console.log(courseId, i, phase, W.pl.map((p) => [p.st, p.gb, p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1), p.dangling ? "D" : ""].join(" ")).join(" | "), "taut", W.taut.toFixed(2), "Lc", W.Lc.toFixed(2), "goal", goal.i);
  }
  return { W, ok: got[0] && got[1] && W.falls === 0, phase };
}
for (const [c, id] of [['torii', 'puits'], ['horloge', 'C'], ['toit', 'T'], ['remparts', 'treuil']]) {
  test(`contrepoids (${c}) : les deux finissent sur la corniche`, () => { const r = counterweight(c, id); assert.ok(r.ok, 'phase atteinte ' + r.phase + ', chutes ' + r.W.falls); });
}

test('herse (mine) : une plaque chacun, la herse se lève, les deux passent avant qu\'elle retombe', () => {
  const W = createWorld({ course: 'mine' });
  const p1 = W.bodies.find((b) => b.plate?.id === 'p1'), p2 = W.bodies.find((b) => b.plate?.id === 'p2'), door = W.bodies.find((b) => b.door), goal = W.bodies.find((b) => b.coop);
  W.cp = W.level.checkpoints.findIndex((c) => c.zone === p1.zone);
  place(W, 0, p1); place(W, 1, p2); layChain(W);
  for (let i = 0; i < 240; i++) stepWorld(W, [IDLE, IDLE]);
  assert.ok(W.dr[door.i] > 0.9, 'herse levée');
  let both = false;
  for (let i = 0; i < 120 * 8 && !both; i++) {
    const go = (p) => ({ ...IDLE, ...toward(p, goal.px + 3, goal.pz) });
    stepWorld(W, [go(W.pl[0]), go(W.pl[1])]);
    both = W.pl.every((p) => p.x > door.px + 1);
  }
  assert.ok(both, 'les deux de l\'autre côté de la herse');
  for (let i = 0; i < 120 * 8; i++) stepWorld(W, [IDLE, IDLE]);
  assert.ok((W.dr[door.i] || 0) < 0.05, 'la herse est retombée derrière eux');
});

test('herse à deux plaques (remparts) : levée tant que les plaques sont pressées, les deux passent pendant sa descente', () => {
  const W = createWorld({ course: 'remparts' });
  const d1 = W.bodies.find((b) => b.plate?.id === 'D1'), d2 = W.bodies.find((b) => b.plate?.id === 'D2'), h = W.bodies.find((b) => b.herse?.mode === 'switch'), goal = W.bodies.find((b) => b.summit);
  W.cp = W.level.checkpoints.findIndex((c) => c.zone === d1.zone); place(W, 0, d1); place(W, 1, d2); layChain(W);
  for (let i = 0; i < 360; i++) stepWorld(W, [IDLE, IDLE]);
  assert.ok(W.dr[h.i] > 0.95, 'herse levée (' + W.dr[h.i] + ')');
  let both = false;
  for (let i = 0; i < 120 * 6 && !both; i++) { const go = (p) => ({ ...IDLE, ...toward(p, goal.px, goal.pz) }); stepWorld(W, [go(W.pl[0]), go(W.pl[1])]); both = W.pl.every((p) => p.x > h.px + 0.6); }
  assert.ok(both, 'les deux sont passés'); assert.equal(W.falls, 0);
  for (let i = 0; i < 120 * 6; i++) stepWorld(W, [IDLE, IDLE]);
  assert.ok(W.dr[h.i] < 0.05, 'retombée derrière eux');
});
test('pont-levis (remparts) : levier, les deux traversent les douves avant qu\'il se relève', () => {
  const W = createWorld({ course: 'remparts' }), lv = W.bodies.find((b) => b.lever?.id === 'LB'), bank = W.bodies.find((b) => b.zone === 2 && !b.herse);
  Object.assign(W.pl[0], { x: lv.px - 0.4, z: lv.pz - 0.4 }); Object.assign(W.pl[1], { x: lv.px - 2.4, z: lv.pz - 0.8 }); layChain(W);
  for (let i = 0; i < 4; i++) stepWorld(W, [{ ...IDLE, uc: 1 }, IDLE]);
  let t = 0; while (W.db.pont.a > 0.01 && t++ < 600) stepWorld(W, [{ ...IDLE, uc: 1 }, IDLE]);
  assert.ok(t < 600, 'pont abaissé');
  let both = false;
  for (let i = 0; i < 120 * 6 && !both; i++) { const go = (p) => ({ ...IDLE, uc: 1, ...toward(p, bank.px, bank.pz) }); stepWorld(W, [go(W.pl[0]), go(W.pl[1])]); both = W.pl.every((p) => p.st === ST.GROUND && p.gb === bank.i); }
  assert.ok(both, 'les deux sur l\'autre rive'); assert.equal(W.falls, 0);
});
