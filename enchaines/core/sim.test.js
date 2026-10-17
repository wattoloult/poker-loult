// Tests de la physique : node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, snapWorld, applySnap, spawnAt, layChain, ST, DT, P, IDLE } from './sim.js';

const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const finite = (W) => W.pl.every((p) => [p.x, p.y, p.z, p.vx, p.vy, p.vz].every(Number.isFinite)) && W.ch.every((n) => Number.isFinite(n.x + n.y + n.z));

test('au repos : les deux grimpeurs restent posés au départ, chaîne stable', () => {
  const W = run(createWorld(), 600);
  assert.ok(finite(W));
  for (const p of W.pl) { assert.equal(p.st, ST.GROUND); assert.ok(Math.abs(p.y) < 0.02, 'y=' + p.y); assert.ok(Math.hypot(p.vx, p.vz) < 0.05); }
  assert.ok(W.ten < 0.3);
});

test('saut : apex ~1,5-1,7 m, retombe au sol', () => {
  const W = createWorld(); run(W, 30);
  let top = 0; const y0 = W.pl[0].y;
  run(W, 150, (i) => ({ ...IDLE, jc: 1, jump: i < 60 }), () => IDLE);
  // pas d'apex mesuré ici (fini au sol) : on rejoue en mesurant
  const W2 = createWorld(); run(W2, 30);
  for (let i = 0; i < 150; i++) { stepWorld(W2, [{ ...IDLE, jc: 1, jump: true }, IDLE]); top = Math.max(top, W2.pl[0].y - y0); }
  assert.ok(top > 1.4 && top < 1.8, 'apex ' + top);
  assert.equal(W2.pl[0].st, ST.GROUND);
  // saut court quand on relâche tout de suite
  const W3 = createWorld(); run(W3, 30); let top3 = 0;
  for (let i = 0; i < 150; i++) { stepWorld(W3, [{ ...IDLE, jc: 1, jump: i < 4 }, IDLE]); top3 = Math.max(top3, W3.pl[0].y - y0); }
  assert.ok(top3 < top * 0.75, 'saut court ' + top3);
});

test('course : atteint la vitesse de course, freine net', () => {
  const W = createWorld(); run(W, 10);
  run(W, 30, () => ({ ...IDLE, mx: 0, mz: 1 }));
  assert.ok(Math.abs(W.pl[0].vz - P.RUN) < 0.3, 'vz ' + W.pl[0].vz);
  run(W, 30);
  assert.ok(Math.hypot(W.pl[0].vx, W.pl[0].vz) < 0.05);
});

test('chaîne : on ne peut pas s\'éloigner au-delà de sa longueur', () => {
  const W = createWorld(); run(W, 10);
  run(W, 360, () => ({ ...IDLE, mx: -1, mz: 0 }), () => ({ ...IDLE, mx: 1, mz: 0 }));
  const [a, b] = W.pl, d = Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(finite(W));
  assert.ok(d < W.L * 1.08, 'distance ' + d);
  assert.ok(W.ten > 0.6, 'tension ' + W.ten);
});

test('chaîne : un grimpeur qui marche traîne l\'autre au sol', () => {
  const W = createWorld(); run(W, 10);
  const b0 = W.pl[1].x;
  run(W, 360, () => ({ ...IDLE, mx: -1, mz: 0 }));
  assert.ok(W.pl[1].x < b0 - 1.5, 'B traîné : ' + (W.pl[1].x - b0));
});

test('snap / applySnap : rejouer depuis un instantané donne le même état', () => {
  const W = createWorld(); const inA = (i) => ({ ...IDLE, mx: Math.sin(i / 30), mz: Math.cos(i / 50), jc: i >> 6, jump: (i & 63) < 20 });
  run(W, 200, inA);
  const s = JSON.parse(JSON.stringify(snapWorld(W, true)));
  const W2 = applySnap(createWorld(), s);
  for (let i = 200; i < 400; i++) { stepWorld(W, [inA(i), IDLE]); stepWorld(W2, [inA(i), IDLE]); }
  for (let k = 0; k < 2; k++) assert.ok(Math.hypot(W.pl[k].x - W2.pl[k].x, W.pl[k].y - W2.pl[k].y, W.pl[k].z - W2.pl[k].z) < 0.01, 'écart joueur ' + k);
});

test('sauvetage : arc-bouté au bord, on retient le partenaire qui tombe, il remonte la chaîne et se hisse', () => {
  const W = createWorld(); run(W, 5);
  const A = W.pl[0], B = W.pl[1]; A.x = 0; A.z = 7.4; B.x = 1; B.z = 6.6; layChain(W);
  let fellBelow = false;
  for (let i = 0; i < 1200; i++) {
    const ib = i < 60 ? { ...IDLE, mz: 1, jc: i > 20 ? 1 : 0, jump: i > 20 } : { ...IDLE, mz: 1, brace: i > 240 };
    stepWorld(W, [{ ...IDLE, brace: true }, ib]);
    if (W.pl[1].y < -3) fellBelow = true;
  }
  assert.ok(finite(W));
  assert.ok(fellBelow, 'B est bien passé dans le vide');
  assert.equal(W.falls, 0, 'personne dans l\'abîme');
  assert.ok(W.pl[0].st === ST.GROUND && W.pl[0].z < 8, 'A tient au bord');
  assert.ok(W.pl[1].y > -2.2, 'B remonté (y=' + W.pl[1].y.toFixed(2) + ')');
});

// « Tirer » : B tombe, A le retient arc-bouté puis tire la chaîne (sans bouger) depuis une position donnée
function haulFrom(az) {
  const W = createWorld(); run(W, 5);
  const A = W.pl[0], B = W.pl[1]; A.x = 0; A.z = az; B.x = 1; B.z = 6.6; layChain(W);
  let upT = null, zMax = 0, staMin = 1;
  for (let i = 0; i < 900; i++) {
    stepWorld(W, [i < 240 ? { ...IDLE, brace: true } : { ...IDLE, pull: true }, i < 60 ? { ...IDLE, mz: 1, jc: i > 20 ? 1 : 0, jump: i > 20 } : { ...IDLE, mz: -1 }]);
    zMax = Math.max(zMax, A.z); staMin = Math.min(staMin, A.sta); if (upT == null && i > 240 && B.st === ST.GROUND && B.y > -0.5) upT = (i - 240) * DT;
  }
  return { W, upT, zMax, staMin };
}
test("tirer : depuis un appui stable, on remonte le partenaire sans bouger ; ça coûte de l'endurance et fait glisser vers le bord", () => {
  const { W, upT, zMax, staMin } = haulFrom(5.6);
  assert.ok(finite(W)); assert.equal(W.falls, 0);
  assert.ok(upT != null && upT < 4, 'B remonté en ' + upT + ' s');
  assert.ok(zMax > 6, 'le tireur a glissé vers le bord (z max=' + zMax.toFixed(2) + ')');
  assert.ok(staMin < 0.5, 'endurance entamée');
});
test("tirer tout au bord : l'effort déséquilibre, le tireur est entraîné dans le vide", () => {
  assert.equal(haulFrom(7.4).W.falls, 1);
});

test('sans s\'arc-bouter, le poids du partenaire entraîne dans le vide (puis retour au point de passage)', () => {
  const W = createWorld(); run(W, 5);
  const A = W.pl[0], B = W.pl[1]; A.x = 0; A.z = 7.4; B.x = 1; B.z = 6.6; layChain(W);
  let respawn = false;
  for (let i = 0; i < 1400 && !respawn; i++) { stepWorld(W, [IDLE, i < 60 ? { ...IDLE, mz: 1, jc: i > 20 ? 1 : 0, jump: i > 20 } : IDLE]); respawn = W.ev.some((e) => e.k === 'respawn'); }
  assert.ok(respawn, 'chute commune dans l\'abîme');
  assert.equal(W.falls, 1);
});

test("zone 6 : l'un tient, l'autre traverse le gouffre (rebord ou balancement), puis fait traverser le premier", () => {
  const W = createWorld(); W.cp = 5; W.cpMax = 5; spawnAt(W, 5);
  W.pl[0].x = -10.5; W.pl[1].x = -8; layChain(W);
  let p2 = 0, ok = false;
  for (let i = 0; i < 3000 && !ok; i++) {
    const A = W.pl[0], B = W.pl[1], far = (p) => p.x < -15.9 && p.y > 53.5 && p.st === ST.GROUND;
    if (!p2 && far(B)) p2 = i;
    const jumps = (t0) => ({ jc: Math.floor((i - t0) / 50), jump: (i - t0) % 50 < 30 }); // appuis répétés
    const ia = p2 ? { ...IDLE, mx: -1, ...jumps(p2) } : { ...IDLE, brace: true };
    const ib = p2 ? { ...IDLE, brace: true } : { ...IDLE, mx: -1, ...jumps(30) };
    stepWorld(W, [ia, ib]);
    ok = p2 && far(W.pl[0]) && W.pl[1].x < -15.9;
  }
  assert.ok(p2, 'B est passé');
  assert.ok(ok, "les deux de l'autre côté du gouffre");
  assert.equal(W.falls, 0);
});

test('tirer sans partenaire suspendu ne raccourcit pas la chaîne', () => {
  const W = createWorld({ course: 'tour' }); const L0 = W.Lc;
  for (let i = 0; i < 240; i++) stepWorld(W, [{ ...IDLE, pull: true }, IDLE]);
  assert.equal(W.Lc, L0); assert.equal(W.pl[0].haul, false);
});

test("pas d'envol : l'un debout sur la tête de l'autre avec une chaîne courte, personne ne monte", () => {
  const W = createWorld(); run(W, 5);
  const A = W.pl[0], B = W.pl[1]; Object.assign(A, { x: 0, z: 3, y: 0 }); Object.assign(B, { x: 0.05, z: 3, y: 1.8, st: ST.AIR }); layChain(W); W.Lc = 1.6;
  let top = 0; for (let i = 0; i < 960; i++) { stepWorld(W, [{ ...IDLE, pull: i & 1 }, IDLE]); top = Math.max(top, A.y, B.y); }
  assert.ok(top < 2, 'y max ' + top.toFixed(2)); assert.ok(A.y < 0.05, 'celui du dessous reste au sol');
});
test('tirer puis garder V : le partenaire remonté n\'est pas collé à soi, la chaîne se redonne', () => {
  const { W } = haulFrom(5.6); run(W, 600, () => ({ ...IDLE, pull: true }), () => IDLE);
  const [A, B] = W.pl;
  assert.ok(Math.hypot(A.x - B.x, A.z - B.z) > 0.6 || Math.abs(A.y - B.y) < 0.3, 'pas superposés');
  assert.ok(Math.max(A.y, B.y) < 0.5, 'personne ne s\'envole');
  assert.ok(W.Lc > 6, 'chaîne redonnée (' + W.Lc.toFixed(2) + ')');
});
test('mode test solo : un seul grimpeur, aucune chaîne, il franchit le vide et active les points de passage seul', () => {
  const W = createWorld(); W.alone = true; run(W, 5);
  const A = W.pl[0];
  // il court au bord et saute dans le vide : rien ne le retient, il tombe et repart du point de passage
  run(W, 600, () => ({ ...IDLE, mz: 1 }));
  assert.ok(W.falls >= 1, 'tombé seul (aucune chaîne ne le retient)');
  assert.equal(W.taut, 0); assert.ok(W.ch.every((n) => Math.abs(n.x - A.x) < 0.01), 'chaîne repliée sur lui');
  // point de passage : il suffit que lui y soit
  const W2 = createWorld(); W2.alone = true; run(W2, 5); const A2 = W2.pl[0], c = W2.level.checkpoints[1]; Object.assign(A2, { x: c.x, y: c.y + 0.1, z: c.z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
  run(W2, 60); assert.equal(W2.cp, 1, 'point de passage atteint en solo');
});
