// Tests des mécanismes sur des mini-parcours de laboratoire (vraie physique, deux grimpeurs + chaîne) : node --test
import './botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { course } from './kit.js';
import { createWorld, stepWorld, layChain, ST, IDLE } from './sim.js';

const lab = (fn) => { const K = course({ id: 'lab', world: 'medieval', name: 'Labo' }); K.block(0, -2, 0, 0, 30, 10, { mat: 'stone' }); K.cp(0, 0, 0); fn(K); return K.done({ abyss: -40 }); };
const run = (W, n, fa = () => IDLE, fb = () => IDLE) => { for (let i = 0; i < n; i++) stepWorld(W, [fa(i, W), fb(i, W)]); return W; };
const put = (W, k, x, y, z, st = ST.AIR) => { const p = W.pl[k]; Object.assign(p, { x, y, z, vx: 0, vy: 0, vz: 0, st }); };

test('vent : un courant d\'air pousse un grimpeur en l\'air', () => {
  const W = createWorld({ level: lab((K) => K.wind(0, 5, 0, 6, 10, 6, [14, 0, 0])) });
  run(W, 30); const x0 = W.pl[0].x;
  run(W, 80, (i) => ({ ...IDLE, jc: 1, jump: true }));
  assert.ok(W.pl[0].x > x0 + 0.6, 'déporté de ' + (W.pl[0].x - x0).toFixed(2));
});

test('tremplin : on rebondit beaucoup plus haut qu\'un saut', () => {
  const W = createWorld({ level: lab((K) => K.plat(6, 0.3, 0, 2, 2, { mat: 'metal', launch: 15 })) });
  put(W, 0, 6, 2, 0); put(W, 1, 3, 0, 0, ST.GROUND); layChain(W);
  let top = 0; for (let i = 0; i < 240; i++) { stepWorld(W, [IDLE, IDLE]); top = Math.max(top, W.pl[0].y); }
  assert.ok(top > 3.5, 'apex ' + top.toFixed(2));
});

test('plaques à deux + herse : la porte ne s\'ouvre que quand les deux grimpeurs sont sur leur plaque', () => {
  let door;
  const W = createWorld({ level: lab((K) => { K.plat(-3, 0.1, 2, 1.5, 1.5, { plate: { id: 'p1' } }); K.plat(3, 0.1, 2, 1.5, 1.5, { plate: { id: 'p2' } }); door = K.block(0, 0, 3, -3, 4, 0.5, { door: { open: ['p1', 'p2'] } }); }) });
  put(W, 0, -3, 0.2, 2); put(W, 1, 8, 0.2, 2); layChain(W); run(W, 120);
  assert.equal(W.dr[door] || 0, 0, 'une seule plaque : fermée');
  put(W, 0, -3, 0.2, 2); put(W, 1, 3, 0.2, 2); layChain(W); run(W, 180);
  assert.ok(W.dr[door] > 0.95, 'les deux : ouverte (' + W.dr[door] + ')');
  assert.ok(W.bodies[door].py > 3, 'la herse est remontée');
});

test('levier : bascule un mécanisme commandé (la plateforme n\'avance que levier abaissé)', () => {
  let mov;
  const W = createWorld({ level: lab((K) => { K.plat(2, 1, 0, 0.4, 0.4, { lever: { id: 'L' }, ghost: 1 }); mov = K.plat(10, 1, 0, 2, 2, { mat: 'metal', move: { k: 'lin', ax: 3, T: 4, gate: 'L' } }); }) });
  put(W, 0, 1.2, 0.05, 0, ST.GROUND); layChain(W); run(W, 60);
  const x0 = W.bodies[mov].px; run(W, 120); assert.equal(W.bodies[mov].px, x0, 'immobile sans levier');
  const pull = () => ({ ...IDLE, uc: 1 }); // compteur d'appuis : passe à 1 une fois
  run(W, 2, pull); assert.ok(W.sw.L, 'levier actionné');
  run(W, 120, pull); assert.ok(Math.abs(W.bodies[mov].px - x0) > 0.5, 'la plateforme bouge');
});

test('contrepoids : le plateau chargé descend, l\'autre monte', () => {
  let a, b;
  const W = createWorld({ level: lab((K) => { a = K.plat(-4, 4, 3, 2, 2, { cw: { id: 'c', side: 1, d: 2 } }); b = K.plat(4, 4, 3, 2, 2, { cw: { id: 'c', side: -1, d: 2 } }); }) });
  put(W, 0, -4, 4.1, 3); put(W, 1, -4, 0.05, -1, ST.GROUND); layChain(W); run(W, 360);
  assert.ok(W.bodies[a].py < W.bodies[b].py - 2, 'écart ' + (W.bodies[b].py - W.bodies[a].py).toFixed(2));
});

test('liane : on s\'y accroche en sautant, on se balance, on relâche avec de l\'élan', () => {
  const W = createWorld({ level: lab((K) => { K.rope(4, 8, 0, 6); K.plat(10, 0, 0, 3, 3); }) });
  put(W, 0, 2.8, 0.05, 0, ST.GROUND); put(W, 1, 0, 0.05, 0, ST.GROUND); layChain(W);
  let grabbed = false, maxX = 0;
  for (let i = 0; i < 360; i++) {
    stepWorld(W, [{ ...IDLE, mx: 1, jc: i > 2 ? 1 : 0, jump: i > 2 && i < 40 }, IDLE]);
    if (W.pl[0].st === ST.ROPE) grabbed = true; maxX = Math.max(maxX, W.pl[0].x);
  }
  assert.ok(grabbed, 'accroché à la liane');
  assert.ok(maxX > 5.5, 'balancé jusqu\'à x=' + maxX.toFixed(2));
});

test('barres : suspendu sous une barre, on saute vers la suivante', () => {
  const W = createWorld({ level: lab((K) => K.bars(2, 8, 2.6, 0, 3, { len: 3 })) });
  put(W, 0, 2, 0.05, 0, ST.GROUND); put(W, 1, -1, 0.05, 0, ST.GROUND); layChain(W);
  let hung = new Set();
  for (let i = 0; i < 600; i++) {
    const p = W.pl[0]; if (p.st === ST.HANG) hung.add(p.hang.b);
    stepWorld(W, [{ ...IDLE, mx: 1, jc: Math.floor(i / 45), jump: i % 45 < 20 }, { ...IDLE, mx: 1 }]);
  }
  assert.ok(hung.size >= 2, 'barres saisies : ' + hung.size);
});

test('roue verticale et piston : plateformes animées qui portent un grimpeur sans le lâcher', () => {
  let wheel;
  const W = createWorld({ level: lab((K) => { wheel = K.plat(0, 4, 3, 2.4, 2, { mat: 'metal', move: { k: 'circ', plane: 'xy', r: 3, T: 8 } }); }) });
  const b = W.bodies[wheel]; put(W, 0, b.px, b.py + b.hh + 0.05, b.pz, ST.AIR); put(W, 1, b.px + 1, 0.05, 0, ST.GROUND); layChain(W);
  run(W, 40); assert.equal(W.pl[0].st, ST.GROUND); assert.equal(W.pl[0].gb, wheel);
  run(W, 240); assert.equal(W.pl[0].gb, wheel, 'toujours porté par la roue');
});

/* ------------------------------ herses, portes lourdes, pont-levis ------------------------------ */
import { HP } from './sim.js';
test('herse en cycle : ouverte, alerte, chute, fermée, remontée ; elle bloque un grimpeur fermée', () => {
  let h;
  const W = createWorld({ level: lab((K) => { h = K.herse(4, 0, 0, 3.4, 4, { open: 1, warn: 0.5, fall: 'slam', hold: 1.5, rise: 2 }); }) });
  const seen = []; let last = -1;
  for (let i = 0; i < 120 * 7; i++) { stepWorld(W, [IDLE, IDLE]); const ph = W.hs[h].ph; if (ph !== last) { seen.push(ph); last = ph; } }
  assert.deepEqual(seen.slice(0, 5), [HP.OPEN, HP.WARN, HP.FALL, HP.SHUT, HP.RISE], 'phases ' + seen);
  // fermée : un grimpeur qui court dedans reste du bon côté
  const W2 = createWorld({ level: lab((K) => { h = K.herse(4, 0, 0, 3.4, 4, { start: 'shut', hold: 99 }); }) });
  put(W2, 0, 1, 0.05, 0, ST.GROUND); put(W2, 1, -1, 0.05, 0, ST.GROUND); layChain(W2);
  run(W2, 240, () => ({ ...IDLE, mx: 1 }));
  assert.ok(W2.pl[0].x < 4 - 0.18, 'arrêté devant la herse (x=' + W2.pl[0].x.toFixed(2) + ')');
});
test('herse : ne descend jamais sur un grimpeur engagé dessous, repart quand il sort ; la chaîne passe entre les barreaux', () => {
  let h;
  const W = createWorld({ level: lab((K) => { h = K.herse(4, 0, 0, 3.4, 4, { open: 0.2, warn: 0.2, fall: 'slam', hold: 1, rise: 2 }); }) });
  put(W, 0, 4, 0.05, 0, ST.GROUND); put(W, 1, 2, 0.05, 0, ST.GROUND); layChain(W);
  let minBottom = 99, jam = false;
  for (let i = 0; i < 180; i++) { stepWorld(W, [IDLE, IDLE]); const b = W.bodies[h]; minBottom = Math.min(minBottom, b.py - b.hh); jam ||= W.ev.some((e) => e.k === 'jam'); }
  assert.ok(jam, 'blocage signalé');
  assert.ok(minBottom > W.pl[0].y + 1.7, 'bas de la herse au-dessus de la tête (' + minBottom.toFixed(2) + ')');
  assert.ok(Math.abs(W.pl[0].y) < 0.05, 'pas écrasé dans le sol');
  run(W, 120, () => ({ ...IDLE, mx: 1 })); run(W, 120);
  assert.ok(W.dr[h] < 0.05 || W.hs[h].ph >= HP.SHUT, 'elle se referme une fois le passage libre');
  // la chaîne traverse : grimpeurs de part et d'autre de la herse fermée, chaîne tendue sans maillon coincé
  const W3 = createWorld({ level: lab((K) => { h = K.herse(4, 0, 0, 3.4, 4, { start: 'shut', hold: 99 }); }) });
  put(W3, 0, 1.5, 0.05, 0, ST.GROUND); put(W3, 1, 6.5, 0.05, 0, ST.GROUND); layChain(W3); run(W3, 120);
  const b = W3.bodies[h], stuck = W3.ch.filter((n) => Math.abs(n.x - b.px) < b.hw && n.y < b.py + b.hh).length;
  assert.ok(stuck >= 1, 'un maillon au moins passe dans la grille');
  assert.ok(W3.ch.every((n) => Number.isFinite(n.x)), 'chaîne stable');
});
test('herse à déclencheur : tombe quand un grimpeur approche, pas avant', () => {
  let h;
  const W = createWorld({ level: lab((K) => { h = K.herse(8, 0, 0, 3.4, 4, { mode: 'trigger', zone: [5, 11], warn: 0.6, hold: 2 }); }) });
  put(W, 0, -2, 0.05, 0, ST.GROUND); put(W, 1, -4, 0.05, 0, ST.GROUND); layChain(W); run(W, 240);
  assert.equal(W.hs[h].ph, HP.OPEN, 'reste ouverte sans personne');
  put(W, 0, 5.5, 0.05, 0, ST.GROUND); put(W, 1, 3.5, 0.05, 0, ST.GROUND); layChain(W); run(W, 30);
  assert.equal(W.hs[h].ph, HP.WARN, 'alerte dès l\'approche');
});
test('pont-levis : abaissé par le levier il devient praticable, puis se relève seul (stay) en faisant tomber la chaîne de planches', () => {
  let segs;
  const W = createWorld({ level: lab((K) => { K.plat(13, 1, 0, 0.4, 0.4, { lever: { id: 'LB' }, ghost: 1 }); segs = K.drawbridge(15, 0, 0, 6, 3, { id: 'pb', open: ['LB'], stay: 6 }); }) });
  run(W, 30); const far = W.bodies[segs[segs.length - 1]];
  assert.ok(far.py > 4, 'relevé au départ (bout à y=' + far.py.toFixed(2) + ')');
  put(W, 0, 13.4, 0.05, 0, ST.GROUND); put(W, 1, 11.5, 0.05, 0, ST.GROUND); layChain(W);
  run(W, 4, () => ({ ...IDLE, uc: 1 }));
  let down = null; for (let i = 0; i < 600 && down == null; i++) { stepWorld(W, [{ ...IDLE, uc: 1 }, IDLE]); if (W.db.pb.a < 0.001) down = i * (1 / 120); }
  assert.ok(down != null && down < 3.5, 'abaissé en ' + down + ' s');
  run(W, 2, () => ({ ...IDLE, uc: 1 })); assert.ok(Math.abs(far.py + far.hh) < 0.05, 'tablier à plat au niveau du sol (' + (far.py + far.hh).toFixed(3) + ')');
  put(W, 0, 19, 0.3, 0); put(W, 1, 17, 0.3, 0); layChain(W); run(W, 60, () => ({ ...IDLE, uc: 1 }));
  assert.equal(W.pl[0].st, ST.GROUND, 'on tient debout sur le tablier'); assert.ok(segs.includes(W.pl[0].gb), 'posé sur un tronçon du pont');
  run(W, 120 * 8, () => ({ ...IDLE, uc: 1 }));
  assert.ok(W.db.pb.a > 1, 'relevé seul après le délai (a=' + W.db.pb.a.toFixed(2) + ')');
});
test('pilon : lâché sur un grimpeur, il le rejette sur le côté sans jamais le traverser', () => {
  let h;
  const W = createWorld({ level: lab((K) => { h = K.herse(4, 0, 0, 1.5, 4, { look: 'stone', w: 1.6, crush: 1, fall: 'slam', lift: 2.5, open: 0.3, warn: 0.2, hold: 0.5, rise: 1 }); }) });
  put(W, 0, 4.2, 0.05, 0, ST.GROUND); put(W, 1, 1.5, 0.05, 0, ST.GROUND); layChain(W);
  let hit = false, inside = false;
  for (let i = 0; i < 240; i++) { stepWorld(W, [IDLE, IDLE]); hit ||= W.ev.some((e) => e.k === 'hit' && e.p === 0); const b = W.bodies[h], p = W.pl[0]; if (Math.abs(p.x - b.px) < b.hw && p.y + 1.75 > b.py - b.hh + 0.05 && p.y < b.py + b.hh) inside = true; }
  assert.ok(hit, 'grimpeur rejeté'); assert.ok(!inside, 'jamais dans le pilon');
  assert.ok(Math.abs(W.pl[0].x - 4) > 1.1, 'écarté du pilon (x=' + W.pl[0].x.toFixed(2) + ')');
});
