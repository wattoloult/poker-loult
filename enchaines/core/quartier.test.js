// « Le Quartier du Dragon » (arène crazy) : collisions comparées au VRAI maillage du pack, parcours de parkour joués avec la vraie physique,
// rues toutes reliées, limites étanches, places d'apparition, points d'accroche des futures cordes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorld, stepWorld, DT, IDLE, ST, P, inside, groundBelow } from './sim.js';
import { COURSES } from './worlds.js';
import { LAYOUT, BOUNDS, ANCHORS } from './courses/quartier.js';
import { PIECES } from './courses/cour-kit.js';

const L = COURSES.quartier;

// ---------- maillage du pack : nœuds posés comme dans le jeu (env.layout), carte des hauteurs vue du dessus ----------
function glbNodes(path) {
  const b = readFileSync(new URL('../' + path, import.meta.url)), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString()), bin = b.subarray(20 + n + 8);
  const acc = (i, k) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], o = (v.byteOffset || 0) + (a.byteOffset || 0);
    if (a.componentType === 5126) return Array.from({ length: a.count }, (_, q) => Array.from({ length: k }, (_, c) => bin.readFloatLE(o + (q * (v.byteStride || k * 4)) + c * 4)));
    return Array.from({ length: a.count }, (_, q) => (a.componentType === 5125 ? bin.readUInt32LE(o + q * 4) : bin.readUInt16LE(o + q * 2))); };
  const out = {}; for (const nd of j.nodes) { const p = j.meshes[nd.mesh].primitives[0]; out[nd.name] = { pos: acc(p.attributes.POSITION, 3), idx: acc(p.indices, 1) }; } return out;
}
const RES = 0.25, X0 = BOUNDS.x0, Z0 = BOUNDS.z0, NX = Math.round((BOUNDS.x1 - X0) / RES), NZ = Math.round((BOUNDS.z1 - Z0) / RES);
function visualHeights() {
  const N = glbNodes(L.envGlb), H = new Float32Array(NX * NZ).fill(-1), who = new Array(NX * NZ).fill(null);
  for (const it of L.env.layout) {
    const m = N[it.node], c = Math.cos(it.r || 0), s = Math.sin(it.r || 0), V = m.pos.map(([x, y, z]) => [it.x + c * x + s * z, y, it.z - s * x + c * z]);
    for (let t = 0; t < m.idx.length; t += 3) {
      const [a, b, d] = [V[m.idx[t]], V[m.idx[t + 1]], V[m.idx[t + 2]]], den = (b[2] - d[2]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[2] - d[2]); if (Math.abs(den) < 1e-9) continue;
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], d[0]) - X0) / RES)), i1 = Math.min(NX - 1, Math.ceil((Math.max(a[0], b[0], d[0]) - X0) / RES));
      const k0 = Math.max(0, Math.floor((Math.min(a[2], b[2], d[2]) - Z0) / RES)), k1 = Math.min(NZ - 1, Math.ceil((Math.max(a[2], b[2], d[2]) - Z0) / RES));
      for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
        const x = X0 + (i + 0.5) * RES, z = Z0 + (k + 0.5) * RES, u = ((b[2] - d[2]) * (x - d[0]) + (d[0] - b[0]) * (z - d[2])) / den, v = ((d[2] - a[2]) * (x - d[0]) + (a[0] - d[0]) * (z - d[2])) / den, w = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue; const y = u * a[1] + v * b[1] + w * d[1], q = k * NX + i; if (y > H[q]) { H[q] = y; who[q] = it.node; }
      }
    }
  }
  return { H, who };
}
const solids = L.bodies.filter((b) => !b.bound && !b.prop && b.y + b.h / 2 > 0.05);
function colTop(W, x, z) { let t = -1; for (const b of W.bodies) { if (!solids.includes(L.bodies[b.i])) continue; const top = b.py + b.hh; if (top <= t) continue; const dx = x - b.px, dz = z - b.pz, lx = b.c * dx - b.s * dz, lz = b.s * dx + b.c * dz; if (Math.abs(lx) <= b.hw && Math.abs(lz) <= b.hd) t = top; } return t; }

test('Quartier : les collisions suivent le maillage réel (toits, balcons, auvents, escalier, cour) à quelques centimètres près', () => {
  const W = createWorld({ crazy: true, course: 'quartier', players: 1 }), { H, who } = visualHeights(), stat = {};
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const q = k * NX + i, h = H[q], node = who[q]; if (h < 0.05) continue;
    const x = X0 + (i + 0.5) * RES, z = Z0 + (k + 0.5) * RES, t = colTop(W, x, z), e = t - h, s = (stat[node] ||= { n: 0, bad: 0, max: 0, worst: null });
    // tolérance : 10 cm (toits en marches de 10 cm, dessus à mi-marche) ; escalier : marches visibles de 33 cm remplacées par des ressauts de 10 cm ; toits hors d'atteinte : dalles de 35-40 cm
    const tol = node === 'Stairs' ? 0.36 : /B6|B7/.test(node) ? 0.42 : 0.16;
    s.n++; if (Math.abs(e) > tol) { s.bad++; if (Math.abs(e) > Math.abs(s.max)) { s.max = e; s.worst = [x.toFixed(2), z.toFixed(2), h.toFixed(2), t.toFixed(2)]; } }
  }
  const rep = Object.entries(stat).map(([n, s]) => `${n} ${((100 * s.bad) / s.n).toFixed(1)}% hors tolérance (pire ${s.max.toFixed(2)} m en ${s.worst})`);
  // les arêtes exactes (bords des toits, poteaux, garde-corps de 12 cm) tombent entre deux cases : quelques cases de bord sont tolérées, pas plus de 4 % par bâtiment
  for (const [n, s] of Object.entries(stat)) assert.ok(s.bad / s.n < 0.04, 'écart collision / maillage trop fréquent :\n' + rep.join('\n'));
  console.log('  écarts collisions / maillage :\n  ' + rep.join('\n  '));
});

// ---------- robot : enchaîne des gestes avec la vraie physique ----------
function bot(x, y, z) {
  const W = createWorld({ crazy: true, course: 'quartier', players: 1 }), p = W.pl[0]; let jc = 0, t = 0;
  Object.assign(p, { x, y, z, vx: 0, vy: 0, vz: 0, prot: 0, st: ST.AIR, stT: 1 }); for (let i = 0; i < 30; i++) stepWorld(W, [{ ...IDLE, ay: 0 }]);
  const R = { W, p, log: [],
    // pousse dans la direction (dx, dz) ; jump : appuie une fois au début ; jusqu'à ce que cond(p) soit vrai (ou max secondes)
    go(dx, dz, cond, max = 2, jump = false, again = null) {
      const ay = Math.atan2(-dx, -dz); if (jump) jc++; let pressed = false, hold = jump ? 0.4 : 0; // la touche de saut reste enfoncée 0,4 s (relâchée tôt, le saut est coupé)
      for (let i = 0; i < Math.round(max / DT); i++) {
        if (again && !pressed && again(p)) { jc++; pressed = true; hold = 0.4; }
        stepWorld(W, [{ ...IDLE, mx: dx, mz: dz, jc, jump: hold > 0, ay, ap: 0 }]); t += DT; hold -= DT; if (cond(p)) { R.log.push(`${p.st} y=${p.y.toFixed(2)}`); return true; }
      }
      R.log.push(`ÉCHEC st=${p.st} (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`); return false;
    },
    hangs: (q) => q.st === ST.HANG, stands: (y) => (q) => q.st === ST.GROUND && q.y > y - 0.05,
    mantle() { return R.go(0, 0, (q) => q.st === ST.GROUND, 1.5, true); },
    get t() { return t; },
  };
  return R;
}
const at = (n, lx, lz) => { const [, x, z, r = 0] = LAYOUT.find((l) => l[0] === n && (n !== 'B8' || l[4] !== 'kiosque')); const c = Math.cos(r), s = Math.sin(r); return [x + c * lx + s * lz, z - s * lx + c * lz]; };

test('Quartier : la maison basse (B4) — on saisit l\'égout depuis le pied du mur, on pend sous le débord, on se hisse et on monte au faîte en marchant', () => {
  const [x, z] = at('B4', 5.4, 0), R = bot(x, 0, z), { p } = R; // contre la façade est (socle à x local 5,0)
  assert.ok(R.go(-1, 0, R.hangs, 1.5, true), 'accroché à l\'égout : ' + R.log);
  assert.ok(Math.abs(p.x - (x - 0.03)) < 0.6, 'pendu contre le mur, sous le débord (pas projeté dehors) : ' + p.x.toFixed(2));
  assert.ok(R.mantle(), 'hissé sur le toit : ' + R.log); assert.ok(p.y > 2.95, 'sur le toit : ' + p.y);
  assert.ok(R.go(-1, 0, (q) => q.y > 4.8, 4), 'monté au faîte en marchant sur les marches de 10 cm : ' + R.log);
});

test('Quartier : le pavillon (B1) se gravit par ses balcons — garde-corps 3,89 → 6,89 → égout 8,95 → faîte 10,45', () => {
  const [x, z] = at('B1', -5, 7.7), R = bot(x, 0, z), { p } = R; // élan depuis 1,6 m devant la façade (juste dessous, la tête cogne le plancher du balcon)
  assert.ok(R.go(0, -1, R.hangs, 1.5, true), 'balcon 1 saisi depuis la place : ' + R.log); assert.ok(R.mantle() && p.y > 3.8, 'perché sur le balcon 1 : ' + R.log);
  assert.ok(R.go(0, -1, R.hangs, 1.5, true), 'balcon 2 : ' + R.log); assert.ok(R.mantle() && p.y > 6.8, 'perché sur le balcon 2 : ' + R.log);
  assert.ok(R.go(0, -1, R.hangs, 1.5, true), 'égout du toit (sous le débord) : ' + R.log); assert.ok(R.mantle() && p.y > 8.9, 'sur le toit : ' + R.log);
  assert.ok(R.go(0, -1, (q) => q.y > 10.3, 4), 'faîte : ' + R.log);
});

test('Quartier : longer un balcon suspendu (déplacement latéral), puis passer le coin de la maison basse', () => {
  const [x, z] = at('B1', -5, 7.7), R = bot(x, 0, z), { p } = R; assert.ok(R.go(0, -1, R.hangs, 1.5, true));
  const x0 = p.x; for (let i = 0; i < 120; i++) stepWorld(R.W, [{ ...IDLE, mx: 1, jc: p.jc, ay: Math.PI, ap: 0 }]);
  assert.ok(p.st === ST.HANG && p.x > x0 + 1.5, 'longe le balcon vers l\'est : ' + (p.x - x0).toFixed(2));
  const [bx, bz] = at('B4', 5.4, 4.8), Q = bot(bx, 0, bz); assert.ok(Q.go(-1, 0, Q.hangs, 1.5, true), 'égout de B4 près du coin : ' + Q.log);
  const f0 = Q.p.hang.f; for (let i = 0; i < 240 && Q.p.hang?.f === f0; i++) stepWorld(Q.W, [{ ...IDLE, mz: 1, jc: Q.p.jc, ay: Math.PI / 2, ap: 0 }]);
  assert.ok(Q.p.st === ST.HANG && Q.p.hang.f !== f0, 'coin passé : on pend maintenant sur la façade sud');
});

test('Quartier : itinéraire nord — petit toit de B8 (3,9) → toit haut (5,9) → toit de B9 (7-8 m), et l\'auvent de B7 (6,95) depuis le petit toit', () => {
  const [x, z] = at('B8', 1.4, 5.2), R = bot(x, 0, z), { p } = R; // près du coin : la face avant est un pignon, seul son bas (aux angles) est un rebord
  assert.ok(R.go(0, -1, R.hangs, 1.5, true), 'égout du petit toit depuis la rue arrière : ' + R.log); assert.ok(R.mantle() && p.y > 3.8, R.log.join(' | '));
  assert.ok(R.go(0, -1, R.hangs, 2, true), 'égout du toit haut : ' + R.log); assert.ok(R.mantle() && p.y > 5.8, R.log.join(' | '));
  R.go(-1, 0, (q) => q.x < -9.4, 1); // au faîtage du toit haut, puis élan vers l'ouest et saut sur la pente de B9
  assert.ok(R.go(-1, 0, (q) => q.st === ST.GROUND && q.y > 6.85 && q.x < at('B9', 5.7, 0)[0], 3, false, (q) => q.x < -10.75), 'passé sur le toit de B9 : ' + R.log);
  const S = bot(...((a) => [a[0], 0, a[1]])(at('B8', 1.4, 5.2))); S.go(0, -1, S.hangs, 1.5, true); S.mantle();
  S.go(0, 1, (q) => q.z > -26.95, 1); // au bord avant du petit toit, dans l'axe de l'auvent (on en saisit le bout, puis on passe l'angle)
  assert.ok(S.go(1, 0, S.hangs, 2, false, (q) => q.x > -7.75) && S.p.hang && S.W.bodies[S.p.hang.b].ledge, 'auvent de B7 saisi depuis le petit toit : ' + S.log); assert.ok(S.mantle() && S.p.y > 6.9, S.log.join(' | '));
});

test('Quartier : appentis des ailes — inaccessible d\'un saut depuis le sol, accessible depuis la caisse d\'appui ; le kiosque se gravit', () => {
  const [x, z] = at('B3', 7.1, 2), R = bot(x, 0, z); assert.ok(!R.go(-1, 0, R.hangs, 1.5, true), 'égout à 4,1 m hors de portée d\'un simple saut');
  const Q = bot(-8.85, 1.25, 6.6); assert.ok(Q.go(-1, 0, Q.hangs, 1.5, true), 'depuis la caisse : ' + Q.log); assert.ok(Q.mantle() && Q.p.y > 4.0, Q.log.join(' | '));
  assert.ok(Q.go(-1, 0, (q) => q.y > 6, 4), 'on monte l\'appentis en marchant : ' + Q.log);
  const K = bot(3, 0, 12.6); assert.ok(K.go(0, -1, K.hangs, 1.5, true), 'kiosque, partie basse (égout sud) : ' + K.log); assert.ok(K.mantle() && K.p.y > 3.8, K.log.join(' | '));
  const C = bot(-2, 0, 5.4); assert.ok(C.go(0, 1, C.hangs, 1.5, true) && C.mantle() && C.p.y > 2.3, 'sur la pile de caisses : ' + C.log);
  assert.ok(C.go(0, 1, C.hangs, 2, true), 'kiosque, partie haute depuis la caisse : ' + C.log); assert.ok(C.mantle() && C.p.y > 5.8, C.log.join(' | '));
});

test('Quartier : refus d\'accroche — toits du fond (B6, B7), murs nus et enceinte ne se saisissent pas', () => {
  for (const [n, lx, lz, dx, dz] of [['B7', 0, 5.4, 0, -1], ['B6', 0, 4.9, 0, -1], ['B9', 0, 4.9, 0, -1]]) { const [x, z] = at(n, lx, lz), R = bot(x, 0, z); assert.ok(!R.go(dx, dz, R.hangs, 1.5, true), `${n} saisi depuis le sol : ` + R.log); }
  const E = bot(BOUNDS.x1 - 0.4, 0, -8); assert.ok(!E.go(1, 0, E.hangs, 1.5, true), 'enceinte saisie');
});

test('Quartier : toutes les rues sont reliées (aucune place d\'apparition isolée) et le sol n\'a pas de trou', () => {
  const W = createWorld({ crazy: true, course: 'quartier', players: 1 }), S = 0.5, nx = Math.round((BOUNDS.x1 - BOUNDS.x0) / S), nz = Math.round((BOUNDS.z1 - BOUNDS.z0) / S);
  const free = (i, k) => { const x = BOUNDS.x0 + (i + 0.5) * S, z = BOUNDS.z0 + (k + 0.5) * S; for (const h of [0.5, 1.0, 1.6]) if (inside(W, x, h, z, P.R - 0.02)) return false; return true; }; // (les ressauts de 12 cm se franchissent en marchant)
  const seen = new Uint8Array(nx * nz), q = []; const c0 = L.checkpoints[0], s0 = [Math.floor((c0.x - BOUNDS.x0) / S), Math.floor((c0.z - BOUNDS.z0) / S)]; seen[s0[1] * nx + s0[0]] = 1; q.push(s0);
  while (q.length) { const [i, k] = q.pop(); for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = k + dk; if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a] || !free(a, b)) continue; seen[b * nx + a] = 1; q.push([a, b]); } }
  for (const c of L.checkpoints) assert.ok(seen[Math.floor((c.z - BOUNDS.z0) / S) * nx + Math.floor((c.x - BOUNDS.x0) / S)], `apparition (${c.x}, ${c.z}) coupée des autres`);
  let cells = 0, open = 0; for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { if (free(i, k)) { open++; if (!seen[k * nx + i]) cells++; } }
  assert.ok(cells < 20, `${cells} cases libres au sol injoignables (recoins fermés)`);
  for (let k = 0; k < nz; k += 3) for (let i = 0; i < nx; i += 3) { const x = BOUNDS.x0 + (i + 0.5) * S, z = BOUNDS.z0 + (k + 0.5) * S; assert.ok(groundBelow(W, x, 20, z, 30), `trou dans le sol en (${x}, ${z})`); }
  console.log(`  sol praticable relié : ${(open * S * S).toFixed(0)} m² (enceinte ${((BOUNDS.x1 - BOUNDS.x0) * (BOUNDS.z1 - BOUNDS.z0)).toFixed(0)} m²)`);
});

test('Quartier : personne ne sort de l\'enceinte, même en sautant depuis les toits vers l\'extérieur', () => {
  const W = createWorld({ crazy: true, course: 'quartier', players: 4 }); let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  // départs : faîtes et rebords les plus hauts accessibles, au ras de l'enceinte
  const starts = [[...at('B9', 0, -3), 8.1], [...at('B4', -5, 0), 5], [...at('B3', -6, 0), 8.2], [...at('B5', 4.5, 0), 7.2]];
  for (let round = 0; round < 6; round++) {
    W.pl.forEach((p, i) => { const [x, z, y] = starts[(i + round) % 4]; Object.assign(p, { x, y: y + 0.3, z, vx: 0, vy: 0, vz: 0, st: ST.AIR, stT: 1, dead: 0, hang: null, mantle: null }); });
    const ins = W.pl.map(() => ({ ...IDLE })); let jc = 0;
    for (let i = 0; i < 900; i++) {
      if (i % 45 === 0) for (const [k, I] of ins.entries()) { const p = W.pl[k], ox = Math.sign(p.x) || 1, oz = p.z < -10 ? -1 : 1; Object.assign(I, rnd() < 0.7 ? { mx: ox * (0.5 + rnd()), mz: oz * rnd() } : { mx: rnd() * 2 - 1, mz: rnd() * 2 - 1 }, { ay: rnd() * 6 - 3, jc: ++jc }); }
      stepWorld(W, ins);
      for (const p of W.pl) if (!(p.dead > 0)) assert.ok(p.x > BOUNDS.x0 - 0.05 && p.x < BOUNDS.x1 + 0.05 && p.z > BOUNDS.z0 - 0.05 && p.z < BOUNDS.z1 + 0.05 && p.y > -0.5, `sorti : (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
  }
});

test('Quartier : places d\'apparition au sol, hors des objets, bien réparties (toutes les zones)', () => {
  const W = createWorld({ crazy: true, course: 'quartier', players: 4 });
  for (const c of L.checkpoints) { assert.ok(!inside(W, c.x, 1, c.z, P.R + 0.1), `apparition (${c.x}, ${c.z}) contre un objet`); const g = groundBelow(W, c.x, 1, c.z, 2); assert.ok(g && Math.abs(g.y) < 0.15, `apparition (${c.x}, ${c.z}) pas au sol`); }
  for (const c of L.checkpoints) { const d = Math.min(...L.checkpoints.filter((o) => o !== c).map((o) => Math.hypot(o.x - c.x, o.z - c.z))); assert.ok(d > 7, `apparitions trop proches : (${c.x}, ${c.z}) à ${d.toFixed(1)} m`); }
});

test('Quartier : points d\'accroche des cordes — posés sur du solide, arc de balancement libre du côté prévu', () => {
  const W = createWorld({ crazy: true, course: 'quartier', players: 1 });
  for (const a of ANCHORS) {
    let near = false; for (const [dx, dy, dz] of [[0, -0.08, 0], [0, -0.3, 0], [0.4, -0.3, 0], [-0.4, -0.3, 0], [0, -0.3, 0.4], [0, -0.3, -0.4], [0, -0.5, 0]]) if (inside(W, a.x + dx, a.y + dy, a.z + dz)) near = true;
    assert.ok(near, `${a.id} : aucun appui solide sous le point`);
    const dx = Math.sin(a.swing), dz = Math.cos(a.swing);
    for (let deg = 0; deg <= 60; deg += 10) for (const L2 of [a.arc * 0.6, a.arc]) { const t = (deg * Math.PI) / 180, x = a.x + dx * Math.sin(t) * L2 + dx * 0.9, y = a.y - Math.cos(t) * L2, z = a.z + dz * Math.sin(t) * L2 + dz * 0.9;
      assert.ok(!inside(W, x, y, z, 0.3), `${a.id} : l'arc de balancement touche le décor à ${deg}° (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`); }
  }
});

test('Quartier : chaque pièce du pack a ses collisions, et le kit couvre tous les nœuds posés', () => {
  for (const it of L.env.layout) assert.ok(it.node === 'Arena_Floor' || Object.values(PIECES).some((p) => p.node === it.node), it.node);
  assert.ok(L.bodies.length < 320, 'nombre de boîtes raisonnable pour 4 joueurs à 120 Hz : ' + L.bodies.length);
});
