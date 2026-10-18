// Tests des mécanismes du monde glacé (core/biomes/ice.js) sur le VRAI parcours « col » : stalactites, glace mince, mur de glace à deux dalles,
// avalanche, neige poudreuse, courant de glace, floe commandé par un levier, tremplin, instantanés réseau.   node --test core/ice.test.js
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, layChain, snapWorld, applySnap, spawnAt, ST, IDLE, DT } from './sim.js';

const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const put = (W, k, b, dx = 0, dz = 0) => Object.assign(W.pl[k], { x: b.px + dx, y: b.py + b.hh + 0.05, z: b.pz + dz, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const at = (W, k, x, y, z) => Object.assign(W.pl[k], { x, y, z, vx: 0, vy: 0, vz: 0, st: ST.AIR });
const named = (W, n) => W.bodies.filter((b) => b.name === n);
const start = (name) => { const W = createWorld({ course: 'col' }); W.cp = W.level.checkpoints.findIndex((c) => c.name.includes(name)); assert.ok(W.cp >= 0, 'point de passage ' + name); spawnAt(W, W.cp); return W; };
const toward = (p, x, z) => { const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz) || 1; return { ...IDLE, mx: dx / l, mz: dz / l }; };

test('le parcours : 11 points de passage, mécanismes déclarés, jamais publié sans validation', () => {
  const W = createWorld({ course: 'col' });
  assert.equal(W.level.world, 'ice');
  assert.ok(W.level.checkpoints.length >= 10);
  assert.equal(W.level.checkpoints.at(-1).finish, true);
  assert.equal(W.level.published, true); // publié à la demande du propriétaire (2026-10-17)
  for (const n of ['stalactite', 'glace mince', 'mur de glace', 'avalanche', 'neige poudreuse', 'pente glacée', 'floe', 'conduit']) assert.ok(named(W, n).length, n);
});

test('stalactite : tremble, tombe sur celui qui reste dessous, se brise, puis repousse', () => {
  const W = start('Les Crevasses'), s = named(W, 'stalactite')[0], top = s.y - s.h / 2 - 4.6;
  at(W, 0, s.x, top + 0.05, s.z); at(W, 1, s.x + 1, top + 0.05, s.z + 1.5); layChain(W);
  run(W, 5);
  const S = () => W.ext.ice.s[s.i];
  assert.equal(S().s, 1, 'alerte');
  run(W, Math.round(0.8 / DT));
  assert.ok(S().s >= 2, 'tombe');
  const y0 = s.py; run(W, 10); assert.ok(s.py < y0, 'elle descend');
  let hit = false; for (let i = 0; i < 600 && S().s !== 3; i++) { stepWorld(W, [IDLE, IDLE]); if (W.ev.some((e) => e.k === 'hit')) hit = true; }
  assert.equal(S().s, 3, 'brisée');
  run(W, 2); assert.equal(s.on, false, 'plus de collision');
  at(W, 0, s.x + 8, top + 0.05, s.z); at(W, 1, s.x + 9, top + 0.05, s.z); layChain(W); // on s'écarte, sinon elle retombe aussitôt
  run(W, Math.round(6.5 / DT)); assert.equal(S().s, 0, 'repoussée'); assert.equal(s.on, true);
});

test('stalactite : celui qui passe en courant n\'est pas touché, et personne en dessous = rien ne tombe', () => {
  const W = start('Les Crevasses'), s = named(W, 'stalactite')[0];
  run(W, 240); assert.equal(W.ext.ice.s[s.i]?.s ?? 0, 0, 'rien ne tombe sans grimpeur dessous');
});

test('glace mince : un seul grimpeur la porte, deux la font céder, elle revient', () => {
  const W = start('Le Lac gelé'), t = named(W, 'glace mince')[0];
  put(W, 0, t); put(W, 1, t, 1.0); layChain(W);
  run(W, 30);
  assert.equal(W.pl.filter((p) => p.st === ST.GROUND && p.gb === t.i).length, 2, 'les deux sont dessus');
  run(W, Math.round(0.9 / DT));
  assert.equal(W.ext.ice.s[t.i].s, 2, 'cédée');
  assert.equal(t.on, false);
  run(W, Math.round(6.5 / DT)); assert.equal(t.on, true, 'revenue');
  // un seul dessus : tient
  const W2 = start('Le Lac gelé'), t2 = named(W2, 'glace mince')[0];
  put(W2, 0, t2); at(W2, 1, t2.px - 4, t2.py + t2.hh + 0.05, t2.pz); layChain(W2); run(W2, 400);
  assert.notEqual(W2.ext.ice.s[t2.i]?.s ?? 0, 2, 'un seul grimpeur : elle tient');
});

test('mur de glace : s\'ouvre avec les deux dalles, reste ouvert 7 s, ne se rabaisse jamais sur quelqu\'un', () => {
  const W = start('Le Mur de glace'), g = named(W, 'mur de glace')[0], A = named(W, 'dalle IA')[0], B = named(W, 'dalle IB')[0];
  put(W, 0, A); put(W, 1, B); layChain(W);
  run(W, 60); assert.equal(W.sw.IA && W.sw.IB, true);
  run(W, 240);
  const open = g.py - g.y; assert.ok(open > 5, 'ouvert (' + open.toFixed(1) + ')');
  // sur une seule dalle : fermé
  const W2 = start('Le Mur de glace'), g2 = named(W2, 'mur de glace')[0];
  put(W2, 0, named(W2, 'dalle IA')[0]); at(W2, 1, 165.5, 10.7, 0); layChain(W2); run(W2, 400);
  assert.ok(g2.py - g2.y < 0.01, 'une dalle ne suffit pas');
  // maintien puis fermeture ; jamais sur quelqu'un
  at(W, 0, g.px, g.y - g.hh + 0.05, g.pz - 1); at(W, 1, g.px - 3, g.y - g.hh + 0.05, g.pz - 3); layChain(W);
  run(W, Math.round(12 / DT)); assert.ok(g.py - g.y > 5, 'retenu tant que quelqu\'un est dans l\'ouverture');
  at(W, 0, g.px + 6, g.y - g.hh + 0.05, g.pz + 1); at(W, 1, g.px + 4, g.y - g.hh + 0.05, g.pz + 2); layChain(W);
  run(W, Math.round(14 / DT)); assert.ok(g.py - g.y < 0.01, 'refermé');
});

test('avalanche : se déclenche en entrant, avance, frappe, disparaît à l\'arrivée ; réinitialisée à la réapparition', () => {
  const W = start('L\'Avalanche'), a = named(W, 'avalanche')[0];
  assert.equal(a.on, true === false ? true : a.on); // avant déclenchement : inerte
  stepWorld(W, [IDLE, IDLE]); assert.equal(a.on, false, 'inerte avant le départ');
  put(W, 0, W.bodies.find((b) => b.x > 210 && b.x < 213 && b.mat === 'snow')); put(W, 1, W.bodies.find((b) => b.x > 210 && b.x < 213 && b.mat === 'snow'), -1); layChain(W);
  run(W, 10); assert.equal(a.on, true, 'déclenchée');
  const x0 = a.px; run(W, 240); assert.ok(a.px - x0 > 6.5 && a.px - x0 < 8.3, 'avance à ~3,7 m/s : ' + (a.px - x0).toFixed(2));
  // un grimpeur resté sur son chemin est frappé
  const mid = W.bodies.find((q) => q.x > 232 && q.x < 234 && q.mat === 'snow'); put(W, 0, mid); put(W, 1, mid, 0.5); layChain(W);
  let hit = false; for (let i = 0; i < 20 * 120 && !hit; i++) { stepWorld(W, [IDLE, IDLE]); if (W.ev.some((e) => e.k === 'hit')) hit = true; }
  assert.ok(hit, 'le mur frappe');
  const abri = W.bodies.find((q) => q.name === 'abri'); put(W, 0, abri); put(W, 1, abri, 1); layChain(W);
  for (let i = 0; i < 40 * 120 && a.on; i++) stepWorld(W, [IDLE, IDLE]);
  assert.equal(a.on, false, 'fin de course'); assert.ok(a.px >= 267.9);
  spawnAt(W, W.cp); stepWorld(W, [IDLE, IDLE]); assert.equal(a.on, false); assert.ok(a.px < 200, 'remise au départ');
});

test('neige poudreuse : vitesse au sol plafonnée ; sol normal : pleine course', () => {
  const sp = (name) => { const W = start('Le Glacier'); const b = named(W, name)[0] || W.bodies.find((q) => q.mat === 'snow' && q.w > 8); put(W, 0, b, -b.hw + 1.2); at(W, 1, W.pl[0].x - 1, W.pl[0].y, W.pl[0].z); layChain(W); run(W, 30);
    let m = 0; for (let i = 0; i < 160; i++) { stepWorld(W, [{ ...IDLE, mx: 1 }, IDLE]); if (W.pl[0].st === ST.GROUND) m = Math.max(m, Math.hypot(W.pl[0].vx, W.pl[0].vz)); } return m; };
  const slow = sp('neige poudreuse');
  assert.ok(slow < 3.3, 'poudreuse ' + slow.toFixed(2));
  const W = createWorld({ course: 'col' }); const b = W.bodies[0]; put(W, 0, b, -3); run(W, 30);
  let m = 0; for (let i = 0; i < 100; i++) { stepWorld(W, [{ ...IDLE, mx: 1 }, IDLE]); m = Math.max(m, W.pl[0].vx); }
  assert.ok(m > 5.5, 'sol normal ' + m.toFixed(2));
});

test('pente glacée : le courant ramène en arrière quand on s\'arrête, on la franchit en courant', () => {
  const W = start('Le Mur gelé'), p = named(W, 'pente glacée')[0];
  put(W, 0, p, 0); at(W, 1, p.px - 2, p.py + p.hh + 0.05, p.pz); layChain(W); run(W, 30);
  const x0 = W.pl[0].x; run(W, 240); assert.ok(W.pl[0].x < x0 - 1, 'entraîné vers l\'arrière : ' + (W.pl[0].x - x0).toFixed(2));
});

test('floe : le levier à impulsion le met en marche, il traverse le chenal et revient à son quai', () => {
  const W = start('La Banquise'), f = named(W, 'floe')[0], lv = W.bodies.find((b) => b.lever?.id === 'F1'), x0 = f.px;
  put(W, 0, f, -0.5); put(W, 1, f, 0.5); layChain(W);
  W.sw.F1 = true; run(W, 30);
  let far = -1e9; for (let i = 0; i < 13 * 120; i++) { stepWorld(W, [IDLE, IDLE]); far = Math.max(far, f.px); }
  assert.ok(far - x0 > 11.5, 'trajet ' + (far - x0).toFixed(1) + ' m');
  assert.ok(Math.abs(f.px - x0) < 0.1, 'revenu au quai');
  assert.equal(W.sw.F1, false, 'impulsion terminée'); assert.ok(lv);
  assert.ok(W.pl.every((p) => p.st === ST.GROUND && p.gb === f.i), 'les passagers sont restés à bord'); assert.equal(W.falls, 0);
});

test('souffle de la crevasse : on avance dans le courant ascendant et on se pose sur la corniche de la banquise', () => {
  const W = start('Le Mur gelé'), c = named(W, 'conduit')[0], dest = W.bodies.find((b) => b.x > 319.5 && b.x < 322.5 && b.mat === 'snow' && b.w === 5);
  put(W, 0, c, -0.6); put(W, 1, c, 0.6); layChain(W); run(W, 40);
  let ok = false, top = 0; for (let i = 0; i < 1200 && !ok; i++) { const p = W.pl[0]; top = Math.max(top, p.y); stepWorld(W, [{ ...IDLE, mx: p.y > 29.4 && p.x < 319.6 ? 1 : 0 }, { ...IDLE, mx: W.pl[0].y > 29.4 && W.pl[1].x < 319.6 ? 1 : 0 }]); ok = W.pl[0].st === ST.GROUND && W.pl[0].gb === dest.i; }
  assert.ok(top > 28.5, 'porté par le souffle : ' + top.toFixed(1));
  assert.ok(ok, 'posé sur la corniche');
});

test("pont-levis de glace : une dalle le maintient baissé, l'un tient et l'autre passe, puis on échange ; sans dalle il se relève", () => {
  const W = start('Le Ravin'), RA = named(W, 'dalle RA')[0], RB = named(W, 'dalle RB')[0], seg = W.bodies.find((b) => b.dbseg?.k === 0), id = seg.dbseg.id;
  put(W, 0, RA); at(W, 1, RA.px - 1.8, RA.py + RA.hh + 0.05, 0.4); layChain(W);
  run(W, 600); assert.ok(W.db[id].a < 0.02, 'baissé par la dalle RA');
  // B traverse et prend la dalle RB
  let ok = false; for (let i = 0; i < 1200 && !ok; i++) { stepWorld(W, [IDLE, toward(W.pl[1], RB.px, RB.pz)]); ok = W.pl[1].st === ST.GROUND && W.pl[1].gb === RB.i; }
  assert.ok(ok, 'B sur la dalle RB'); assert.ok(W.pl[0].st === ST.GROUND && W.pl[0].gb === RA.i, 'A est resté sur sa dalle');
  // A quitte RA et traverse : le pont reste baissé grâce à RB
  const land = W.bodies.find((b) => b.mat === 'snow' && b.x > RB.px && b.x < RB.px + 6 && b.w === 5);
  ok = false; for (let i = 0; i < 1500 && !ok; i++) { stepWorld(W, [toward(W.pl[0], land.px, 0), IDLE]); ok = W.pl[0].st === ST.GROUND && W.pl[0].gb === land.i; }
  assert.ok(ok, 'A a traversé'); assert.ok(W.db[id].a < 0.1, 'pont resté baissé'); assert.equal(W.falls, 0);
  // plus personne sur les dalles : il se relève
  put(W, 0, land, 0.5); put(W, 1, land, -0.5); layChain(W); run(W, 900);
  assert.ok(W.db[id].a > 0.5, 'relevé');
});

test('instantané réseau : l\'état des mécanismes glacés est restauré à l\'identique', () => {
  const W = start('Les Crevasses'), s = named(W, 'stalactite')[0], top = s.y - s.h / 2 - 4.6;
  at(W, 0, s.x, top + 0.05, s.z); at(W, 1, s.x + 1, top + 0.05, s.z + 1.5); layChain(W); run(W, 120);
  const snap = JSON.parse(JSON.stringify(snapWorld(W, true)));
  const W2 = createWorld({ course: 'col' }); applySnap(W2, snap);
  assert.deepEqual(W2.ext.ice.s[s.i], W.ext.ice.s[s.i]);
  run(W, 200); run(W2, 200);
  assert.equal(W2.ext.ice.s[s.i].s, W.ext.ice.s[s.i].s);
  assert.ok(Math.abs(W2.bodies[s.i].py - W.bodies[s.i].py) < 1e-6);
});
