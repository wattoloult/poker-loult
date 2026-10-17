// OUTIL : vérifie que chaque étape du parcours est franchissable par UN grimpeur seul, avec la vraie physique (sim.js).
// Un robot part de la plateforme A (élan pris depuis l'intérieur), court vers B, saute au bord, s'accroche / escalade / se hisse.
// Les étapes marquées `coop` (exigent la chaîne ou la courte échelle) sont listées à part. Plateformes mobiles : plusieurs départs.
//   node tools/route.mjs            -> tableau complet ;  node tools/route.mjs 12   -> détail de l'étape vers le corps n°12
import { createWorld, stepWorld, groundBelow, poseAt, windAt, ST, DT, IDLE } from '../core/sim.js';
import { getCourse } from '../core/worlds.js';

const LEVEL = getCourse(process.env.COURSE || 'tour');
// étapes = plateformes où l'on se pose (pas le décor, les obstacles, les barres, les leviers, les herses)
const route = LEVEL.bodies.map((b, i) => ({ ...b, i })).filter((b) => !b.hit && !b.cliff && !b.deco && !b.bar && !b.lever && !b.door && !b.herse && !b.plate && !b.ghost && !b.alt && !(b.dbseg && b.dbseg.k));
// barres entre deux étapes : celles du tableau des corps situées entre A et B
const barsBetween = (A, B) => LEVEL.bodies.map((b, i) => ({ ...b, i })).filter((b) => b.bar && b.i > A.i && b.i < B.i).map((b) => b.i);
const only = process.argv[2] != null ? +process.argv[2] : null;

function rectClosest(b, pose, x, z, inset) { // point du dessus de b le plus proche de (x, z), rentré de `inset`
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw), dx = x - pose.x, dz = z - pose.z;
  let lx = c * dx - s * dz, lz = s * dx + c * dz;
  const hw = Math.max(0, b.w / 2 - inset), hd = Math.max(0, b.d / 2 - inset);
  lx = Math.max(-hw, Math.min(hw, lx)); lz = Math.max(-hd, Math.min(hd, lz));
  return { x: pose.x + c * lx + s * lz, z: pose.z - s * lx + c * lz };
}
const PO = { x: 0, y: 0, z: 0, yaw: 0 };
function attempt(A, B, t0, verbose) {
  const W = createWorld({ course: LEVEL.id }); W.solo = true; W.tick = Math.round(t0 / DT);
  if (process.env.NOHIT) for (const b of W.bodies) if (b.hit) b.ghost = true; // NOHIT=1 : sans les obstacles qui frappent (géométrie seule)
  const p = W.pl[0], bA = W.bodies[A.i], bB = W.bodies[B.i];
  W.pl[1].x = 999; W.pl[1].y = -999;
  for (const b of W.bodies) if (b.lever && b.i < A.i) W.sw[b.lever.id] = true; // leviers déjà franchis : restés actionnés
  for (const b of W.bodies) if (b.dbseg && b.dbseg.ctl.open.length && b.dbseg.ctl.open.every((id) => W.sw[id])) W.db[b.dbseg.id].a = 0; // pont déjà abaissé
  stepWorld(W, [IDLE, IDLE]);
  const pa = poseAt(A, W.tick * DT, { ...PO }), pb = poseAt(B, W.tick * DT, { ...PO });
  const near = rectClosest(A, pa, pb.x, pb.z, 0.45), mid = rectClosest(A, pa, pa.x, pa.z, 0);
  // élan : 1,6 m en arrière vers le centre de A si la place le permet
  const bx = mid.x - near.x, bz = mid.z - near.z, bl = Math.hypot(bx, bz);
  const back = Math.min(1.6, bl);
  p.x = near.x + (bl ? (bx / bl) * back : 0); p.z = near.z + (bl ? (bz / bl) * back : 0);
  p.y = bA.py + bA.hh + 0.02; p.vx = p.vy = p.vz = 0; p.st = ST.AIR;
  for (let i = 0; i < 20; i++) stepWorld(W, [IDLE, IDLE]); // se pose (et suit A si elle bouge)
  let uc = 0;
  const gid = B.move?.gate || B.dbseg?.ctl.open[0], lever = gid ? W.bodies.find((b) => b.lever?.id === gid) : null; // mécanisme commandé : d'abord le levier
  let jc = 0, hold = 0, wait = !!(B.move || A.move), log = [];
  const topA = bA.py + bA.hh, topB = () => bB.py + bB.hh;
  const ropes = [...(B.via?.ropes || [])], R = LEVEL.ropes, barQ = barsBetween(A, B);
  // surplomb : B est au-dessus de A et le recouvre -> on vise le pied de son bord, côté A, puis on saute en poussant vers B
  const over = topB() - topA > 1.2 && !bB.climb && Math.abs(bA.px - bB.px) < bA.hw + bB.hw && Math.abs(bA.pz - bB.pz) < bA.hd + bB.hd; // étapes en liane : on vise chaque liane, puis la plateforme
  for (let i = 0; i < 900; i++) {
    if (ropes.length && p.st === ST.ROPE && p.rope.i === ropes[0]) ropes.shift();
    if (barQ.length && p.st === ST.HANG && barQ.includes(p.hang.b)) { while (barQ.length && barQ[0] !== p.hang.b) barQ.shift(); barQ.shift(); }
    const nextBar = barQ.length ? W.bodies[barQ[0]] : null;
    const nextRope = ropes.length ? R[ropes[0]] : null;
    let tgt = nextRope ? { x: nextRope.x, z: nextRope.z } : nextBar ? { x: nextBar.px, z: nextBar.pz } : rectClosest(B, { x: bB.px, y: bB.py, z: bB.pz, yaw: bB.yaw }, p.x, p.z, 0.6);
    // courant ascendant sur le chemin d'une île haute : on reste dans la colonne jusqu'à dépasser l'arrivée
    const up = (LEVEL.winds || []).find((w) => w.acc[1] > 20 && Math.abs(w.x - (bA.px + bB.px) / 2) < 8 && Math.abs(w.z - (bA.pz + bB.pz) / 2) < 6);
    if (up && !nextRope && !nextBar && topB() - topA > 3 && p.y < topB() + 0.8 && p.gb !== B.i) tgt = { x: up.x, z: up.z };
    if (over && !nextRope && !nextBar && p.st === ST.GROUND && p.gb !== B.i) { // pied du bord de B côté A
      // côté de B tourné vers le centre de A (axe dominant), juste au pied de ce bord
      const ax = bA.px - bB.px, az = bA.pz - bB.pz, onX = Math.abs(ax) / bB.hw >= Math.abs(az) / bB.hd;
      const foot = onX ? { x: bB.px + Math.sign(ax) * (bB.hw + 0.45), z: Math.max(bB.pz - bB.hd + 0.4, Math.min(bB.pz + bB.hd - 0.4, p.z)) } : { x: Math.max(bB.px - bB.hw + 0.4, Math.min(bB.px + bB.hw - 0.4, p.x)), z: bB.pz + Math.sign(az) * (bB.hd + 0.45) };
      if (Math.hypot(foot.x - p.x, foot.z - p.z) > 0.35) tgt = foot; else { tgt = { x: bB.px, z: bB.pz }; jc++; hold = 0.5; }
    }
    const look = p.st === ST.AIR ? 0.3 : 0; // en l'air on anticipe sa vitesse (freinage aérien)
    let mx = tgt.x - p.x - p.vx * look, mz = tgt.z - p.z - p.vz * look; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    if (wait && B.dbseg) { wait = W.db[B.dbseg.id].a > 0.01; if (wait) mx = mz = 0; } // pont-levis : on attend qu'il soit abaissé
    else if (wait) { // plateforme mobile : on attend qu'elle soit proche
      const edge = rectClosest(A, { x: bA.px, y: bA.py, z: bA.pz, yaw: bA.yaw }, bB.px, bB.pz, 0), e = rectClosest(B, { x: bB.px, y: bB.py, z: bB.pz, yaw: bB.yaw }, edge.x, edge.z, 0);
      if (Math.hypot(e.x - edge.x, e.z - edge.z) < 2.9 && (bB.climb || (topB() - p.y < 1.2 && topB() - p.y > -2.5)) && (B.move?.k !== 'lin' || !B.move.ay || bB.vy >= -0.5)) wait = false; else { mx = mz = 0; }
    }
    let jump = hold > 0; hold = Math.max(0, hold - DT);
    // rafale (au sol, ou juste devant si on est près d'une zone de rafales) : on s'arc-boute et on attend qu'elle passe
    const wa = windAt(W, p.x + p.vx * 0.5, p.y + 1, p.z + p.vz * 0.5), gust = p.st === ST.GROUND && (LEVEL.winds || []).some((w) => w.gust && Math.abs(p.x - w.x) < w.hw + 3 && Math.abs(p.z - w.z) < w.hd + 1) && Math.hypot(wa.x, wa.z) > 10;
    if (lever && !W.sw[lever.lever.id]) { tgt = { x: lever.px, z: lever.pz }; wait = false; if (Math.hypot(lever.px - p.x, lever.pz - p.z) < 1.2) uc = 1; else { mx = tgt.x - p.x; mz = tgt.z - p.z; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; } }
    else if (lever && !lever.done) { lever.done = true; wait = true; } // levier tiré : on attend la passerelle
    if (p.st === ST.HANG && W.bodies[p.hang.b].bar) { // sous une barre : on saute vers la suivante (ou vers B) en la regardant
      if (p.stT > 0.25) { jc++; jump = true; hold = 0.3; }
    }
    if (p.st === ST.ROPE) { // sur la liane : on pompe vers la cible et on lâche quand l'élan y mène
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz) || 1, vt = (p.vx * dx + p.vz * dz) / d;
      const reach = nextRope ? 3.2 : 3.6 + Math.max(0, p.y - topB()) * 0.4;
      if (vt > 3.2 && d < reach + vt * 0.25 && p.stT > 0.3 && (nextRope || p.y + 1 > topB() - 0.5)) { jc++; jump = true; hold = 0.3; }
    }
    if (p.st === ST.GROUND && !wait && p.gb !== B.i && !gust) {
      const ahead = groundBelow(W, p.x + mx * 0.45, p.y + 0.05, p.z + mz * 0.45, 0.4);
      const e = rectClosest(B, { x: bB.px, y: bB.py, z: bB.pz, yaw: bB.yaw }, p.x, p.z, 0), eg = Math.hypot(e.x - p.x, e.z - p.z);
      if (!ahead || (!over && !nextRope && topB() > p.y + 0.6 && eg < 1.6 && !bB.climb)) { jc++; hold = 0.45; jump = true; }
    }
    if (gust) { mx = mz = 0; jump = false; }
    stepWorld(W, [{ ...IDLE, mx, mz, jc, jump, uc, brace: gust }, IDLE]);
    if (verbose && i % 6 === 0) log.push(`${(i * DT).toFixed(2)} st=${p.st} x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} z=${p.z.toFixed(2)} v=${p.vx.toFixed(1)},${p.vy.toFixed(1)},${p.vz.toFixed(1)} gb=${p.gb}`);
    if (p.st === ST.GROUND && p.gb === B.i && p.stT > 0.15) return { ok: true, t: i * DT, log };
    if (p.y < Math.min(topA, topB()) - 4) return { ok: false, why: 'chute', log };
  }
  return { ok: false, why: 'temps', log };
}
let fails = 0, coop = 0;
for (let k = 1; k < route.length; k++) {
  const A = route[k - 1], B = route[k];
  if (only != null && B.i !== only) continue;
  const label = `#${B.i} z${B.zone} ${B.mat}${B.climb ? ' paroi' : ''}${B.move ? ' ' + B.move.k : ''}${B.crumble ? ' friable' : ''}${B.sink ? ' passerelle' : ''} top ${(B.y + B.h / 2).toFixed(1)}`;
  if (B.coop && !process.env.FORCE) { coop++; console.log('COOP ', label); continue; }
  const T = B.move?.T || A.move?.T || 0, tries = T ? 8 : 1;
  let best = null;
  for (let j = 0; j < tries && !best?.ok; j++) best = attempt(A, B, (T * j) / tries + 1, only != null);
  if (!best.ok) fails++;
  console.log(best.ok ? 'ok   ' : 'ECHEC', label, best.ok ? best.t.toFixed(2) + ' s' : best.why);
  if (only != null) console.log(best.log.join('\n'));
}
console.log(`\n${route.length - 1} étapes, ${fails} échecs, ${coop} coopératives`);
process.exitCode = fails ? 1 : 0;
