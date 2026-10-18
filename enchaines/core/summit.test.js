// Mécanismes du Sommet du monde (core/biomes/summit.js) joués sur le VRAI parcours « toit » : foudre et abris, rochers et niches, avalanche,
// balises à allumer ensemble + arche, sol du vide, instantané réseau, marge de l'avalanche (robot de tools/route.mjs).
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createWorld, stepWorld, layChain, snapWorld, applySnap, ST, IDLE, DT } from './sim.js';
import { boltState } from './biomes/summit.js';

const world = (cp = 0) => { const W = createWorld({ course: 'toit' }); W.cp = cp; return W; };
const smOf = (W, k) => W.bodies.filter((b) => b.sm?.k === k);
const put = (W, k, x, y, z) => Object.assign(W.pl[k], { x, y: y + 0.05, z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const inp = (W, k, o = {}) => ({ ...IDLE, uc: W.pl[k].uc || 0, ...o });
const idle = (W, n) => { for (let i = 0; i < n; i++) stepWorld(W, [inp(W, 0), inp(W, 1)]); };
const press = (W, k) => stepWorld(W, W.pl.map((p, j) => (j === k ? inp(W, j, { uc: (p.uc || 0) + 1 }) : inp(W, j))));
const top = (b) => b.py + b.hh;
// avance jusqu'au prochain événement du genre donné (au plus `max` pas), renvoie-le
function until(W, kind, max = 120 * 14, f = () => [inp(W, 0), inp(W, 1)], b = null) { for (let i = 0; i < max; i++) { stepWorld(W, f()); const e = W.ev.find((x) => x.k === kind && (b == null || x.b === b)); if (e) return e; } return null; }
const bolts = (W) => smOf(W, 'bolt');
const bolt = (W, x) => bolts(W).find((b) => Math.abs(b.px - x) < 0.1);

test('foudre : annoncée, frappe les deux grimpeurs à découvert, projetés', () => {
  const W = world(4), b = bolt(W, 129.2);
  put(W, 0, b.px - 0.6, top(b), b.pz); put(W, 1, b.px + 0.6, top(b), b.pz); layChain(W); idle(W, 5);
  const c = until(W, 'charge', 120 * 14, undefined, b.i); assert.ok(c, 'la charge (lueur, grésillement) est annoncée');
  assert.ok(boltState(W, b.sm).warn >= 0 && boltState(W, b.sm).warn < 0.05);
  const e = until(W, 'bolt', 120 * 3); assert.ok(e, 'l\'éclair tombe ~1,4 s après l\'annonce'); assert.equal(e.hit, 2);
  assert.ok(W.pl.every((p) => p.knock > 0 && p.vy > 3), 'projetés');
});

test('foudre : un abri (roche au-dessus de la tête) protège ; la roche d\'un abri ne bloque pas l\'accès', () => {
  const W = world(4), bb = bolts(W);
  const a = bolt(W, 129.2);
  // on déplace virtuellement la frappe sur la plateforme à abri (135,6) : même carrière, même colonne
  const shelter = W.bodies.find((b) => b.deco === 'roof' && Math.abs(b.px - 136.4) < 0.1), plat = W.bodies.find((b) => Math.abs(b.px - 135.6) < 0.1 && b.mat === 'stone');
  assert.ok(shelter && plat && bb.length === 5);
  a.px = plat.px; a.pz = plat.pz; a.py = plat.py + plat.hh - a.hh; // la boîte-porteur de la 1re frappe vient sur l'abri
  put(W, 0, plat.px + 0.8, top(plat), plat.pz); put(W, 1, plat.px + 1.0, top(plat), plat.pz + 0.4); layChain(W); idle(W, 5);
  const e = until(W, 'bolt', 120 * 14, undefined, a.i); assert.ok(e); assert.equal(e.hit, 0, 'à l\'abri : personne n\'est touché');
  assert.ok(W.pl.every((p) => p.knock <= 0));
});

test('rocher : roule sur la corniche et projette ; en niche on est épargné', () => {
  const W = world(8), rocks = W.bodies.filter((b) => b.sm?.k === 'roll'), ledge = W.bodies.find((b) => b.mat === 'rock' && b.w > 30), niche = W.bodies.find((b) => b.deco === 'niche');
  assert.equal(rocks.length, 2);
  put(W, 0, 262, top(ledge), ledge.pz); put(W, 1, niche.px, top(niche), niche.pz); layChain(W);
  let hit = 0, safe = true, seen = false;
  for (let i = 0; i < 120 * 20; i++) {
    stepWorld(W, [inp(W, 0), inp(W, 1)]);
    if (rocks.some((r) => r.on)) seen = true;
    for (const e of W.ev) if (e.k === 'hit' && e.p === 0) hit++; else if (e.k === 'hit') safe = false;
    if (hit) break;
    Object.assign(W.pl[1], { x: niche.px, z: niche.pz, vx: 0, vz: 0 }); // le partenaire reste dans sa niche
  }
  assert.ok(seen, 'un rocher a roulé'); assert.ok(hit > 0, 'le rocher frappe celui qui reste sur la corniche'); assert.ok(safe, 'celui de la niche n\'est jamais touché');
});

test('rocher : sa course est périodique et s\'arrête au bout (invisible hors course)', () => {
  const W = world(8), r = W.bodies.find((b) => b.sm?.k === 'roll'); let on = 0, off = 0;
  for (let i = 0; i < 120 * 18; i++) { stepWorld(W, [IDLE, IDLE]); if (r.on) on++; else off++; if (r.on) assert.ok(r.px <= r.sm.x0 + 0.01 && r.px >= r.sm.x1 - 0.01); }
  assert.ok(on / (on + off) > 0.6 && on / (on + off) < 0.75, 'visible ~67 % du temps (run = 0,67) : ' + on / (on + off));
});

test('avalanche : déclenchée en quittant le col, avance, ensevelit le retardataire, remise à zéro à la réapparition', () => {
  const W = world(10), c0 = W.level.checkpoints[10], av = W.bodies.find((b) => b.sm?.k === 'avl'), m = av.sm;
  put(W, 0, 321, 60.8, -2.6); put(W, 1, 320, 60.8, -2.6); layChain(W); idle(W, 120);
  assert.ok(!W.ext.summit.av.A?.on, 'pas encore déclenchée');
  put(W, 0, 323.5, 60.8, -2.6); put(W, 1, 322.2, 60.8, -2.6); layChain(W);
  assert.ok(until(W, 'avlStart', 10), 'départ de l\'avalanche');
  const x0 = W.ext.summit.av.A.x; idle(W, 120 * 5); const x1 = W.ext.summit.av.A.x;
  assert.ok(Math.abs((x1 - x0) / 5 - m.v) < 0.05, 'vitesse ' + (x1 - x0) / 5);
  // les deux sont restés sur le col : rattrapés
  const f0 = W.falls; let buried = 0; for (let i = 0; i < 120 * 12 && W.falls === f0; i++) { stepWorld(W, [inp(W, 0), inp(W, 1)]); buried += W.ev.filter((e) => e.k === 'bury').length; }
  assert.ok(buried > 0 && W.falls === f0 + 1, 'ensevelis -> retour au point de passage');
  assert.deepEqual(W.ext.summit.av, {}, 'avalanche remise à zéro');
  assert.ok(Math.abs(W.pl[0].x - c0.x) < 4, 'réapparus au col');
});

test('avalanche : celui qui garde de l\'avance est sauf ; elle s\'arrête à x1 et disparaît', () => {
  const W = world(10), m = W.bodies.find((b) => b.sm?.k === 'avl').sm, end = W.bodies.find((b) => b.mat === 'stone' && Math.abs(b.px - 394.2) < 0.1);
  put(W, 0, 323.5, 60.8, -2.6); put(W, 1, 322.5, 60.8, -2.6); layChain(W); until(W, 'avlStart', 10);
  put(W, 0, end.px, top(end), end.pz); put(W, 1, end.px - 0.8, top(end), end.pz); layChain(W);
  const e = until(W, 'avlEnd', 120 * 40); assert.ok(e, 'l\'avalanche arrive au bout'); assert.equal(e.x, m.x1); assert.equal(W.falls, 0, 'personne n\'est enseveli à l\'arrivée');
  idle(W, 120 * 2); assert.equal(W.falls, 0);
});

test('avalanche : marge — le robot de route.mjs traverse la course en bien moins de temps que le mur n\'en met', () => {
  const out = execFileSync(process.execPath, ['tools/route.mjs'], { env: { ...process.env, COURSE: 'toit' }, encoding: 'utf8' });
  const W = world(10), m = W.bodies.find((b) => b.sm?.k === 'avl').sm, run = W.bodies.filter((b) => b.zone === 10).map((b) => b.i);
  const robot = out.split('\n').map((l) => /^ok\s+#(\d+) z10 .* ([\d.]+) s$/.exec(l)).filter(Boolean).reduce((s, r) => s + (run.includes(+r[1]) ? +r[2] : 0), 0);
  const wall = (m.x1 - 324.6) / 1 / m.v * 0 + (m.x1 - m.x0) / m.v; // le mur met ça pour atteindre x1 depuis x0 ; les grimpeurs partent de 323, 20 m devant
  assert.ok(robot > 10, 'robot : ' + robot + ' s'); assert.ok(robot * 1.35 < wall, 'robot ' + robot.toFixed(1) + ' s (x1,35) < mur ' + wall.toFixed(1) + ' s');
  assert.match(out, / 0 échecs/);
});

test('balises : une impulsion exacte de 2,2 s, verrouillée ; l\'arche ne s\'ouvre pas si elles ne brûlent pas ensemble', () => {
  const W = world(11), [b1, b2, b3] = W.bodies.filter((b) => b.sm?.k === 'beacon'), door = W.bodies.find((b) => b.sm?.k === 'arch');
  assert.equal(b2.px - b1.px, 6);
  put(W, 0, b1.px, 75.2, b1.pz); put(W, 1, b1.px - 2, 75.2, b1.pz); layChain(W); idle(W, 40);
  press(W, 0); assert.ok(W.sw.B1, 'allumée'); let n = 0; while (W.sw.B1 && n < 120 * 5) { idle(W, 1); n++; }
  assert.ok(Math.abs(n / 120 - 2.2) < 0.05, 'dure ' + n / 120 + ' s');
  press(W, 0); idle(W, 120); assert.ok(W.sw.B1, 'une 2e pression pendant la combustion ne l\'éteint pas');
  // une par une, trop lentement : jamais ensemble
  idle(W, 120 * 3); put(W, 0, b2.px, 75.2, b2.pz); layChain(W); idle(W, 40); press(W, 0); idle(W, 120 * 3);
  put(W, 0, b3.px, 75.2, b3.pz); layChain(W); idle(W, 40); press(W, 0); idle(W, 120 * 4);
  assert.ok(!W.ext.summit.ar.lock, 'pas ensemble : l\'arche reste fermée'); assert.ok((W.ext.summit.ar[door.i]?.o || 0) === 0);
});

test('balises : à deux (l\'un en B1 et l\'autre en B2, puis B3 aussitôt) l\'arche se verrouille ouverte et on la franchit', () => {
  const W = world(11), [b1, b2, b3] = W.bodies.filter((b) => b.sm?.k === 'beacon'), door = W.bodies.find((b) => b.sm?.k === 'arch'), goal = W.level.checkpoints.at(-1);
  put(W, 0, b1.px, 75.2, b1.pz); put(W, 1, b2.px, 75.2, b2.pz); layChain(W); idle(W, 40);
  stepWorld(W, [inp(W, 0, { uc: W.pl[0].uc + 1 }), inp(W, 1, { uc: W.pl[1].uc + 1 })]); assert.ok(W.sw.B1 && W.sw.B2);
  // B marche vers B3 (6 m) et appuie ; la chaîne (6,5 m) force A à suivre vers B2
  let pressed = false;
  for (let i = 0; i < 120 * 2 && !pressed; i++) {
    const p = W.pl[1], d = Math.hypot(b3.px - p.x, b3.pz - p.z);
    if (d < 1.4) { stepWorld(W, [inp(W, 0), inp(W, 1, { uc: p.uc + 1 })]); pressed = true; } else { const a = W.pl[0], da = Math.hypot(b2.px - a.x, b2.pz - a.z) || 1; stepWorld(W, [inp(W, 0, { mx: (b2.px - a.x) / da, mz: (b2.pz - a.z) / da }), inp(W, 1, { mx: (b3.px - p.x) / d, mz: (b3.pz - p.z) / d })]); }
  }
  idle(W, 1); assert.ok(pressed && W.ext.summit.ar.lock, 'les trois ensemble : arche verrouillée');
  idle(W, 120 * 6); assert.equal(W.ext.summit.ar[door.i].o, 1, 'ouverte'); assert.ok(W.sw.B1 && W.sw.B2 && W.sw.B3, 'les balises restent allumées');
  // ouverte pour de bon : on passe, personne ne tombe, rien ne se referme
  let both = false;
  for (let i = 0; i < 120 * 10 && !both; i++) { const go = (p) => ({ ...IDLE, mx: Math.sign(goal.x - p.x) || 1, mz: (goal.z - p.z) * 0.5 }); stepWorld(W, [go(W.pl[0]), go(W.pl[1])]); both = W.pl.every((p) => p.x > door.px + 1); }
  assert.ok(both && W.falls === 0, 'franchie');
});

test('sol du vide : sous le sol de la zone, c\'est une chute (retour au point de passage)', () => {
  const W = world(9); put(W, 0, 300, 20, -2); put(W, 1, 299, 20, -2); layChain(W);
  const f = W.falls; idle(W, 3); assert.equal(W.falls, f + 1, 'chute détectée bien avant l\'abîme absolu (-20)');
});

test('instantané réseau : foudre, rocher, avalanche, balises et arche repartent identiques après applySnap', () => {
  const W = world(11), b1 = W.bodies.find((b) => b.lever?.id === 'B1');
  put(W, 0, b1.px, 75.2, b1.pz); put(W, 1, b1.px - 2, 75.2, b1.pz); layChain(W); idle(W, 40); press(W, 0); idle(W, 90);
  const s = JSON.parse(JSON.stringify(snapWorld(W, true))), W2 = createWorld({ course: 'toit' }); applySnap(W2, s);
  idle(W, 240); idle(W2, 240);
  assert.deepEqual(W2.ext.summit, W.ext.summit); assert.deepEqual(W2.sw, W.sw);
  const r = W.bodies.find((b) => b.sm?.k === 'roll'), r2 = W2.bodies[r.i]; assert.equal(r2.px, r.px); assert.equal(r2.on, r.on);
});

test('le parcours : 11 zones, un point de passage par zone, terminé par l\'arche', () => {
  const W = world(), L = W.level;
  assert.equal(L.zones.length - 1, 11); assert.ok(L.checkpoints.at(-1).finish);
  assert.equal(smOf(W, 'bolt').length, 5); assert.equal(smOf(W, 'beacon').length, 3);
  assert.equal(L.published, true); // publié à la demande du propriétaire (2026-10-17)
});
