// LES ENCHAÎNÉS — physique pure et déterministe (120 pas/s), commune au serveur (autorité) et au client (prédiction + rejeu).
// Deux grimpeurs reliés par une chaîne à maillons (PBD) dans un niveau de boîtes orientées (lacet seulement), fixes ou animées
// par des fonctions du temps. Aucune dépendance, aucun hasard : mêmes entrées => même état. Unités : mètres, secondes.
import { getCourse, DEFAULT_COURSE } from './worlds.js';

export const DT = 1 / 120;
export const ST = { GROUND: 0, AIR: 1, HANG: 2, CLIMB: 3, MANTLE: 4, ROPE: 5 };
export const ST_NAME = ['sol', 'air', 'rebord', 'escalade', 'hisse', 'liane'];
export const P = {
  R: 0.32, H: 1.75, WAIST: 1.0,                 // capsule verticale (pieds = origine), point d'attache de la chaîne
  RUN: 6.2, ACC: 52, DEC: 44, TURN: 14,         // course : vitesse, accélération, freinage, rotation du corps (rad/s)
  AIR_TURN: 3.8, AIR_ACC: 24, AIR_MAX: 6.4, AIR_DRAG: 0.4, AIR_BRAKE: 1.4, AIR_LAT: 0, SWING_ACC: 36,    // contrôle aérien façon « air strafing » : accélère vers la direction voulue tant que la vitesse dans cette direction < AIR_MAX
  JUMP: 8.6, G_UP: 23, G_DOWN: 30, G_CUT: 46, FALL_MAX: 30, // saut (apex ~1,6 m), pesanteur montée / descente / saut relâché tôt
  COYOTE: 0.12, BUFFER: 0.14,
  GRAB_LO: 0.8, GRAB_HI: 2.4, GRAB_REACH: 0.5, GRAB_VY: 9, GRAB_CD: 0.3, // fenêtre d'accroche des rebords (hauteur du bord au-dessus des pieds)
  HANG_DROP: 2.0, SHIMMY: 1.9, MANTLE_T: 0.36, CLIMB_V: 2.5, CLIMB_LAT: 2.2,
  SLIDE_T: 0.85, SLIDE_MIN: 0.22, SLIDE_BOOST: 1.45, SLIDE_DECEL: 6.0, SLIDE_TURN: 1.0, SLIDE_CD: 0.9, SLIDE_JUMP: 1.14, HS: 0.95, SLIDE_REC: 0.35, CRAWL: 2.2, TACKLE_R: 1.15, TACKLE_V: 9.5, TACKLE_VY: 4.2, TACKLE_CD: 1.2, // glissade : durée, durée mini avant de pouvoir la couper, élan, freinage, virage, recharge, bonus de saut glissé
  WJ_OUT: 5.6, WJ_UP: 8.2,                      // saut depuis un mur ou un rebord
  STA_CLIMB: 1 / 7, STA_HANG: 1 / 16, STA_LOAD: 1 / 5, STA_ROPE: 1 / 6, STA_REGEN: 0.6,
  PULL_V: 2.6, DRAG_V: 0.9, TOW_V: 3.2, HAUL_MOVE: 0.3, HAUL_SLIP: 0.45, STA_HAUL: 1 / 4.5, // tirer la chaîne : petits pas, on glisse vers le partenaire (HAUL_SLIP x charge), ça épuise                     // au sol avec un partenaire suspendu : vitesse en le hissant / glissade si on ne s'arc-boute pas
  KNOCK: 7, PUNCH_R: 1.35, PUNCH_CD: 0.75, PUNCH_V: 8.5, PUNCH_VY: 6.2, KICK_R: 1.75, KICK_HIT: 0.3, KICK_CD: 1.1, KICK_V: 11, KICK_VY: 7, DOWN_T: 1.5, // coups : portée, recharge, éjection ; temps au sol
  CUP_V: 12.6, CUP_R: 1.25, // courte échelle : élan donné par les mains jointes (apex ~3,4 m, comme debout sur la tête puis sauter), portée
  ROPE_REACH: 0.7, ROPE_PUMP: 22, ROPE_VMAX: 9, ROPE_CLIMB: 1.6, ROPE_JUMP: 6, ROPE_STA: 1 / 22, BAR_FWD: 5.8, BAR_UP: 7.4, USE_R: 1.9,
};
export const CH = { N: 12, L: 6.5, MIN: 1.6, ITER: 16, NODE_G: 0.6, DAMP: 0.996, CLIMB: 1.5, HAUL: 1.9, GROW: 2.2, MAXDV: 18 };
export const ABYSS = -30;

import { BIOMES, EXT } from './biomes/index.js';
import { KAR, rayBody, rayCapsule, aimDir } from './weapon.js';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

/* ------------------------------ niveau ------------------------------ */
// pose d'une boîte animée au temps t (fonctions du temps : rien à synchroniser)
export function poseAt(b, t, o) {
  if (b.yaw0 === undefined) b.yaw0 = b.yaw || 0; // cap d'origine, jamais écrasé : b.yaw est la pose COURANTE (avant : on repartait de la pose courante à chaque pas, le plateau tournant accélérait sans fin)
  o.x = b.x; o.y = b.y; o.z = b.z; o.yaw = b.yaw0;
  const m = b.move; if (!m) return o;
  const ph = 2 * Math.PI * (t / m.T) + (m.ph || 0);
  if (m.k === 'lin') { // aller-retour ; « pause » > 0 = arrêts aux extrémités (ascenseurs)
    let s = Math.sin(ph); if (m.pause) s = clamp(s * (1 + m.pause), -1, 1);
    o.x += (m.ax || 0) * s; o.y += (m.ay || 0) * s; o.z += (m.az || 0) * s;
  } else if (m.k === 'rot') o.yaw += m.w * t + (m.ph || 0);
  else if (m.k === 'pend') { // poutre suspendue qui se balance autour d'un pivot situé m.len au-dessus d'elle
    const a = m.amp * Math.sin(ph), dx = Math.sin(a) * m.len, dy = (1 - Math.cos(a)) * m.len;
    if (m.axis === 'z') o.z += dx; else o.x += dx; o.y += dy;
  } else if (m.k === 'circ') { // cercle horizontal, ou vertical (plane 'xy' : grande roue, la plateforme reste à plat)
    if (m.plane === 'xy') { o.x += m.r * Math.cos(ph); o.y += m.r * Math.sin(ph); } else { o.x += m.r * Math.cos(ph); o.z += m.r * Math.sin(ph); }
  } else if (m.k === 'orbit') { // bras d'engrenage : tourne autour d'un pivot (cx, cz) en pivotant sur lui-même
    const a = m.w * t + (m.ph || 0), c = Math.cos(a), s = Math.sin(a), dx = b.x - m.cx, dz = b.z - m.cz;
    o.x = m.cx + c * dx + s * dz; o.z = m.cz - s * dx + c * dz; o.yaw += a;
  } else if (m.k === 'piston') { // montée brusque, palier, redescente lente (tremplin mécanique)
    const f = ((t / m.T + (m.ph || 0) / (2 * Math.PI)) % 1 + 1) % 1, e = (u) => u * u * (3 - 2 * u);
    o.y += m.ay * (f < 0.12 ? e(f / 0.12) : f < 0.5 ? 1 : 1 - e((f - 0.5) / 0.5));
  } else if (m.k === 'drop') { // chute périodique (rocher, stalactite) : immobile en haut, puis tombe de m.fall et revient
    const f = ((t / m.T + (m.ph || 0)) % 1 + 1) % 1, tf = f * m.T - (m.wait || m.T * 0.6);
    if (tf > 0) o.y -= Math.min(m.fall, 0.5 * 26 * tf * tf);
  }
  return o;
}
// temps propre d'une boîte : global, ou accumulé seulement quand son interrupteur est actif (mécanisme « gate »)
const bodyT = (W, b) => (b.move?.gate ? W.gt[b.i] || 0 : W.tick * DT);

export function buildBodies(level) {
  return level.bodies.map((d, i) => {
    const b = { ...d, i, hw: d.w / 2, hh: d.h / 2, hd: d.d / 2, px: d.x, py: d.y, pz: d.z, yaw: d.yaw || 0, c: 1, s: 0, vx: 0, vy: 0, vz: 0, wy: 0, on: true, ex: 0, ez: 0, sy: 0 };
    b.dyn = !!(d.move || d.crumble || d.sink || d.door || d.cw || d.herse || d.dbseg || d.ext);
    bounds(b); return b;
  });
}
function bounds(b) {
  b.c = Math.cos(b.yaw); b.s = Math.sin(b.yaw);
  const ac = Math.abs(b.c), as = Math.abs(b.s);
  b.ex = ac * b.hw + as * b.hd; b.ez = as * b.hw + ac * b.hd;
}
const PO = { x: 0, y: 0, z: 0, yaw: 0 }, PO2 = { x: 0, y: 0, z: 0, yaw: 0 };
function updateBodies(W) {
  for (const b of W.bodies) {
    if (!b.dyn) continue;
    if (b.ext && EXT[b.ext]?.pose?.(W, b, X)) continue; // mécanisme propre à un monde (core/biomes)
    let sy = 0;
    if (b.sink) { const k = W.sk[b.i]; sy = k.y; }
    if (b.door || b.herse) sy += (W.dr[b.i] || 0) * spanOf(b); // la herse remonte dans son logement
    if (b.dbseg) { poseSeg(W, b); continue; }
    if (b.cw) sy += (W.cw[b.cw.id]?.y || 0) * b.cw.side;
    if (b.crumble) { const k = W.cr[b.i]; b.on = k.s !== 2; }
    if (b.move) {
      const t = bodyT(W, b), tp = b.move.gate ? (W.gtp?.[b.i] ?? t) : t - DT;
      poseAt(b, t, PO); poseAt(b, tp, PO2);
      b.px = PO.x; b.py = PO.y + sy; b.pz = PO.z; b.yaw = PO.yaw;
      b.vx = (PO.x - PO2.x) / DT; b.vy = (PO.y - PO2.y) / DT; b.vz = (PO.z - PO2.z) / DT; b.wy = (PO.yaw - PO2.yaw) / DT;
      bounds(b);
    } else { const py = b.y + sy; b.vy = (py - b.py) / DT; b.py = py; }
  }
}
// pont-levis : chaque tronçon est une boîte alignée qui couvre son morceau de tablier incliné (marches de plus en plus hautes
// quand le pont se relève, mur quand il est levé) ; la charnière est en (hx, top), le tablier part vers side (+1 / -1 en x)
function poseSeg(W, b) {
  const S = b.dbseg, a = W.db[S.id]?.a || 0, L = S.len / S.n, d = (S.k + 0.5) * L, ca = Math.cos(a), sa = Math.sin(a);
  const px = S.hx + S.side * (ca * d + sa * S.th / 2), py = S.top + sa * d - ca * S.th / 2;
  b.hw = Math.max(S.th, L * ca + S.th * sa) / 2; b.hh = Math.max(S.th, L * sa + S.th * ca) / 2;
  if (b.posed) { b.vx = (px - b.px) / DT; b.vy = (py - b.py) / DT; } else { b.vx = b.vy = 0; b.posed = 1; }
  b.vz = 0; b.px = px; b.py = py; bounds(b);
}
// déplacement d'un point posé sur une boîte entre t-DT et t (porté par une plateforme mobile ou tournante)
function carryDelta(W, b, x, z, out) {
  out.x = 0; out.y = 0; out.z = 0; out.yaw = 0;
  if (!b.dyn) return out;
  if (!b.move) { out.y = b.vy * DT; return out; }
  const t = bodyT(W, b), tp = b.move.gate ? (W.gtp?.[b.i] ?? t) : t - DT; poseAt(b, tp, PO2); poseAt(b, t, PO);
  const dx = x - PO2.x, dz = z - PO2.z, dyaw = PO.yaw - PO2.yaw, c = Math.cos(dyaw), s = Math.sin(dyaw);
  out.x = PO.x + c * dx + s * dz - x; out.z = PO.z - s * dx + c * dz - z; out.y = PO.y - PO2.y + (b.sink ? b.vy * 0 : 0); out.yaw = dyaw;
  return out;
}
const local = (b, x, z, o) => { const dx = x - b.px, dz = z - b.pz; o.lx = b.c * dx - b.s * dz; o.lz = b.s * dx + b.c * dz; return o; };
const L = { lx: 0, lz: 0 };
export function inside(W, x, y, z, pad = 0, grid = false) { // le point est-il dans une boîte solide ? (grid : les grilles laissent passer la chaîne)
  for (const b of W.bodies) {
    if (!b.on || b.ghost || (grid && b.grid)) continue;
    if (Math.abs(x - b.px) > b.ex + pad || Math.abs(z - b.pz) > b.ez + pad || Math.abs(y - b.py) > b.hh + pad) continue;
    local(b, x, z, L);
    if (Math.abs(L.lx) < b.hw + pad && Math.abs(L.lz) < b.hd + pad) return b;
  }
  return null;
}
// rayon vertical vers le bas : dessus de boîte le plus haut sous (x, y, z) dans la distance donnée
export function groundBelow(W, x, y, z, dist) {
  let best = -Infinity, bb = null;
  for (const b of W.bodies) {
    if (!b.on || b.ghost) continue;
    const top = b.py + b.hh;
    if (top > y + 0.01 || top < y - dist || Math.abs(x - b.px) > b.ex || Math.abs(z - b.pz) > b.ez) continue;
    local(b, x, z, L);
    if (Math.abs(L.lx) <= b.hw && Math.abs(L.lz) <= b.hd && top > best) { best = top; bb = b; }
  }
  return bb ? { y: best, b: bb } : null;
}

/* ------------------------------ monde ------------------------------ */
export function newPlayer(id, x, y, z) {
  return { id, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.PI, st: ST.GROUND, stT: 0, gb: -1, gvx: 0, gvy: 0, gvz: 0, coy: 0, buf: 0, jHeld: false, cut: false,
    sta: 1, hang: null, climb: null, mantle: null, brace: false, grabCd: 0, jc: 0, dc: 0, peakY: y, dangle: 0, anchorY: 0, knock: 0, land: 0, ropeUp: false, haul: false, onMate: false };
}
export function createWorld(opts = {}) {
  const level = opts.level || getCourse(opts.course || DEFAULT_COURSE);
  const W = { tick: 0, level, bodies: buildBodies(level), L: clamp(+opts.L || CH.L, 3, 12), cp: 0, cpMax: 0, pl: [], ch: null, Lc: 0,
    cr: {}, sk: {}, dr: {}, cw: {}, sw: {}, gt: {}, gtp: {}, hs: {}, db: {}, ten: 0, taut: 0, ev: [], time: 0, started: false, done: false, falls: 0, saves: 0, resets: 0, resetHold: [0, 0], best: 0 };
  W.Lc = W.L;
  // MODE LIBRE (jusqu'à 4 grimpeurs, SANS chaîne, chacun pour soi, premier au sommet) : règles « solo » (une plaque suffit, second saut) mais coups et tacles entre grimpeurs
  if (opts.free) { W.free = true; W.alone = true; W.rank = []; W.nPl = clamp(Math.round(+opts.players || 2), 1, 4); }
  // MODE CRAZY : arène, fusil à verrou, chacun pour soi, première équipe à CZ.LIMIT éliminations (ou le plus de victimes au bout de CZ.TIME s)
  if (opts.crazy) { W.crazy = true; W.free = true; W.alone = true; W.rank = []; W.nPl = clamp(Math.round(+opts.players || 2), 1, 4); W.limit = CZ.LIMIT; W.tmax = +opts.tmax || CZ.TIME; }
  spawnAt(W, 0);
  return W;
}
export function spawnAt(W, cpIndex) {
  if (W.free) return spawnFree(W);
  const cp = W.level.checkpoints[cpIndex];
  const dx = Math.min(1.6, W.L * 0.3);
  W.pl = [newPlayer(0, cp.x - dx, cp.y, cp.z), newPlayer(1, cp.x + dx, cp.y, cp.z)];
  for (const p of W.pl) { p.yaw = cp.yaw ?? Math.PI; p.peakY = cp.y; }
  W.Lc = W.L;
  W.ch = [];
  for (let i = 0; i <= CH.N; i++) { const f = i / CH.N, x = cp.x - dx + 2 * dx * f, y = cp.y + P.WAIST - Math.sin(f * Math.PI) * 0.6; W.ch.push({ x, y, z: cp.z, ox: x, oy: y, oz: cp.z }); }
  resetMechanisms(W);
  W.ten = 0; W.taut = 0; W.resetHold = [0, 0];
  updateBodies(W);
  safeSpots(W, cp, dx);
}
// une place d'apparition doit avoir un sol fixe à hauteur du point de passage et rien de solide dans le corps du grimpeur ; sinon on prend
// la place sûre la plus proche autour du point (avant : réapparition dans une planche mobile du Pont de la vallée, ou au-dessus du vide)
function spotOk(W, x, y, z, loose = false) { // loose : accepte aussi une plateforme mobile / friable / qui s'enfonce (point de passage posé dessus), mais jamais dans un objet
  const g = groundBelow(W, x, y + 0.6, z, loose ? 2.4 : 1.4);
  if (!g || (!loose && (g.b.move || g.b.crumble || g.b.sink)) || Math.abs(g.y - y) >= (loose ? 1.8 : 0.7) || inside(W, x, g.y + 0.5, z, P.R - 0.05) || inside(W, x, g.y + 1.4, z, P.R - 0.05)) return null;
  // ni dans la course d'un obstacle mobile (mur coulissant, pilon, plateforme qui passe) : sa boîte élargie de son amplitude
  // (loose : la plateforme mobile sur laquelle on se pose ne compte pas dans la course des obstacles mobiles)
  for (const b of W.bodies) { const m = b.move; if (!m || b.ghost || m.k !== 'lin' || (loose && b === g.b)) continue; const bx = b.x ?? b.px, by = b.y ?? b.py, bz = b.z ?? b.pz;
    if (Math.abs(x - bx) < b.w / 2 + Math.abs(m.ax || 0) + P.R && Math.abs(z - bz) < b.d / 2 + Math.abs(m.az || 0) + P.R && g.y + P.H > by - b.h / 2 - Math.abs(m.ay || 0) && g.y < by + b.h / 2 + Math.abs(m.ay || 0)) return null; }
  return g.y;
}
function safeSpots(W, cp, dx) {
  let moved = false; const taken = [];
  for (const p of W.pl) {
    const side = p.id ? 1 : -1; let best = null;
    if (spotOk(W, p.x, cp.y, p.z) != null) { taken.push(p); continue; }
    for (const ox of [dx, 1.1, 0.7, 0.35, 0, -0.35, -0.7]) for (const oz of [0, 0.6, -0.6, 1.2, -1.2]) {
      const x = cp.x + side * ox, z = cp.z + oz, y = spotOk(W, x, cp.y, z);
      if (y == null || taken.some((q) => Math.hypot(q.x - x, q.z - z) < 0.75)) continue;
      const d = Math.hypot(x - (cp.x + side * dx), z - cp.z); if (!best || d < best.d) best = { x, y, z, d };
    }
    if (best) { p.x = best.x; p.y = best.y; p.z = best.z; moved = true; }
    taken.push(p);
  }
  if (moved) layChain(W);
}
// mode libre : un emplacement SÛR au pied du point de passage, au plus près de l'emplacement souhaité (px, pz) : sol franc (pas de plateforme mobile / friable / qui s'enfonce),
// ni dans un objet (capsule libre), ni dans un autre grimpeur (écart d'au moins 2 rayons). On cherche de plus en plus loin (±4 m, y compris sur les plateformes voisines à la même hauteur).
function placeNear(W, cp, px, pz, taken) {
  const cand = [];
  for (let ox = -4; ox <= 4.001; ox += 0.5) for (let oz = -3; oz <= 3.001; oz += 0.6) cand.push([ox, oz, Math.hypot(ox, oz)]);
  cand.sort((a, b) => a[2] - b[2]);
  for (const [gap, loose] of [[0.8, false], [0.68, false], [0.8, true], [0.68, true]]) for (const [ox, oz] of cand) {
    const x = px + ox, z = pz + oz, y = spotOk(W, x, cp.y, z, loose);
    if (y == null || taken.some((q) => Math.hypot(q.x - x, q.z - z) < gap)) continue;
    return { x, y, z };
  }
  return { x: cp.x, y: cp.y, z: cp.z }; // dernier recours : le point de passage lui-même (posé par le concepteur du parcours)
}
function spawnFree(W) {
  if (W.crazy) return spawnCrazy(W);
  const cp = W.level.checkpoints[0], n = W.nPl; W.pl = []; W.ch = []; W.rank = []; W.rLock = []; W.done = false;
  for (let i = 0; i < n; i++) {
    const at = placeNear(W, cp, cp.x + (i - (n - 1) / 2) * 1.1, cp.z, W.pl);
    const p = newPlayer(i, at.x, at.y, at.z); p.yaw = cp.yaw ?? Math.PI; p.peakY = at.y; p.cp = 0; p.done = false; W.pl.push(p);
  }
  resetMechanisms(W); W.ten = 0; W.taut = 0; W.cp = 0;
}
// mode libre : retour d'UN grimpeur à son dernier point de passage (les autres continuent)
export function respawnPlayer(W, p) {
  const cps = W.level.checkpoints, idx = cps[p.cp]?.finish ? Math.max(0, p.cp - 1) : p.cp; // arrivé puis retombé : on repart du point d'avant (le sommet est souvent posé sur une pièce mobile)
  const cp = cps[idx] || cps[0], at = placeNear(W, cp, cp.x + (p.id - 1.5) * 0.5, cp.z, W.pl.filter((q) => q !== p));
  Object.assign(p, { x: at.x, y: at.y, z: at.z, vx: 0, vy: 0, vz: 0, st: ST.GROUND, stT: 0, gb: -1, gvx: 0, gvy: 0, gvz: 0, hang: null, climb: null, mantle: null, rope: null, brace: false, knock: 0, ko: false, downT: 0, pT: null,
    slideT: 0, crawl: false, recT: 0, sta: 1, yaw: cp.yaw ?? Math.PI, peakY: at.y, onMate: false, fell: false });
}
// remise en état des mécanismes (départ, réapparition) : planches, passerelles, portes, contrepoids, leviers et plaques
export function resetMechanisms(W) {
  W.cr = {}; W.sk = {}; W.dr = {}; W.cw = {}; W.sw = {}; W.gt = {}; W.gtp = {}; W.hs = {}; W.db = {}; W.ext = {};
  for (const m of BIOMES) m.reset?.(W, X);
  for (const b of W.bodies) {
    if (b.herse) { const sh = b.herse.start === 'shut'; W.hs[b.i] = { ph: sh ? HP.SHUT : HP.OPEN, t: b.herse.ph || 0, v: 0, jam: 0 }; W.dr[b.i] = sh ? 0 : 1; }
    if (b.dbseg && !W.db[b.dbseg.id]) W.db[b.dbseg.id] = { a: b.dbseg.up, v: 0, t: 0, mv: 0 };
    if (b.crumble) W.cr[b.i] = { s: 0, t: 0 }; if (b.sink) W.sk[b.i] = { y: 0, v: 0 }; if (b.door) W.dr[b.i] = 0;
    if (b.cw && !W.cw[b.cw.id]) W.cw[b.cw.id] = { y: 0, v: 0 }; if (b.move?.gate) { W.gt[b.i] = 0; W.gtp[b.i] = 0; }
  }
}
// pose la chaîne en ligne droite entre les deux grimpeurs (après un placement manuel : outils, tests)
export function layChain(W) {
  const [A, B] = W.pl;
  W.ch.forEach((n, i) => { const f = i / CH.N; n.x = n.ox = A.x + (B.x - A.x) * f; n.y = n.oy = A.y + P.WAIST + (B.y - A.y) * f; n.z = n.oz = A.z + (B.z - A.z) * f; });
}
const ev = (W, k, o = {}) => { W.ev.push({ k, ...o }); };

/* ------------------------------ collisions ------------------------------ */
const CN = { x: 0, y: 0, z: 0, d: 0 };
// capsule verticale (pieds en y) contre boîte orientée ; renvoie la pénétration et la normale monde dans CN
function capsuleBox(b, x, y, z, r, h) {
  local(b, x, z, L);
  const lx = L.lx, lz = L.lz, ly = y - b.py, ya = ly + r, yb = ly + h - r;
  const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
  let sy, cy;
  if (yb < -b.hh) { sy = yb; cy = -b.hh; } else if (ya > b.hh) { sy = ya; cy = b.hh; } else { const lo = Math.max(ya, -b.hh), hi = Math.min(yb, b.hh); sy = cy = (lo + hi) / 2; }
  let nx = lx - cx, ny = sy - cy, nz = lz - cz;
  const d = Math.hypot(nx, ny, nz);
  if (d >= r) return false;
  let pen;
  if (d > 1e-6) { nx /= d; ny /= d; nz /= d; pen = r - d; }
  else { // axe de la capsule dans la boîte : sortie par le plus court chemin
    const c = [[b.hw - lx + r, 1, 0, 0], [lx + b.hw + r, -1, 0, 0], [b.hd - lz + r, 0, 0, 1], [lz + b.hd + r, 0, 0, -1], [b.hh - ly, 0, 1, 0], [ly + b.hh + h, 0, -1, 0]];
    let k = c[0]; for (const e of c) if (e[0] < k[0]) k = e;
    pen = k[0]; nx = k[1]; ny = k[2]; nz = k[3];
  }
  CN.x = b.c * nx + b.s * nz; CN.z = -b.s * nx + b.c * nz; CN.y = ny; CN.d = pen;
  return true;
}
// place pour se relever ? (sous un plafond bas, la glissade devient une reptation au lieu de se relever dans le plafond)
function canStand(W, p) {
  for (const b of W.bodies) {
    if (!b.on || b.ghost || (p.thruT > 0 && b.i === p.thru) || b.hit) continue;
    if (Math.abs(p.x - b.px) > b.ex + P.R + 0.05 || Math.abs(p.z - b.pz) > b.ez + P.R + 0.05) continue;
    if (p.y > b.py + b.hh + 0.05 || p.y + P.H < b.py - b.hh - 0.05) continue;
    if (capsuleBox(b, p.x, p.y + 0.02, p.z, P.R, P.H) && CN.y < -0.3) return false;
  }
  return true;
}
function collidePlayer(W, p, groundOk = true) {
  let ground = null, gn = 0;
  for (let it = 0; it < 3; it++) {
    let any = false;
    for (const b of W.bodies) {
      if (!b.on || b.ghost || (p.thruT > 0 && b.i === p.thru)) continue; // on traverse la barre qu'on vient de lâcher
      if (Math.abs(p.x - b.px) > b.ex + P.R + 0.05 || Math.abs(p.z - b.pz) > b.ez + P.R + 0.05) continue;
      const hp = p.slideT > 0 ? P.HS : P.H; // glissade / tacle : on est bas (on passe sous les obstacles bas)
      if (p.y > b.py + b.hh + 0.05 || p.y + hp < b.py - b.hh - 0.05) continue;
      if (!capsuleBox(b, p.x, p.y, p.z, P.R, hp)) continue;
      any = true;
      p.x += CN.x * CN.d; p.y += CN.y * CN.d; p.z += CN.z * CN.d;
      // vitesse relative à la surface : on retire la part qui rentre dedans
      const rvx = p.vx - b.vx, rvy = p.vy - b.vy, rvz = p.vz - b.vz, vn = rvx * CN.x + rvy * CN.y + rvz * CN.z;
      if (vn < 0) { p.vx -= vn * CN.x; p.vy -= vn * CN.y; p.vz -= vn * CN.z; }
      if (CN.y > 0.55 && groundOk && !b.spike) { if (CN.y > gn) { gn = CN.y; ground = b; } }
      else if (CN.y < -0.6 && p.vy > b.vy) p.vy = b.vy;
      if (b.hit && (b.spike || Math.abs(CN.y) < 0.6) && p.knock <= 0) { // obstacle qui frappe : projeté (rouleau à pics : aussi par-dessus, dans l'axe d'éloignement du centre)
        const hs = Math.hypot(b.vx, b.vz) + Math.abs(b.wy) * 2;
        let kx = CN.x, kz = CN.z; if (b.spike && Math.abs(CN.y) >= 0.6) { const dx = p.x - b.px, dz = p.z - b.pz, l = Math.hypot(dx, dz) || 1; kx = dx / l; kz = dz / l; }
        p.vx = kx * P.KNOCK + b.vx * 0.6; p.vz = kz * P.KNOCK + b.vz * 0.6; p.vy = Math.max(p.vy, b.spike ? 6.5 : 4.5); p.knock = 0.5;
        if (p.st !== ST.AIR) { p.st = ST.AIR; p.stT = 0; p.hang = p.climb = p.mantle = null; }
        ev(W, 'hit', { p: p.id, x: p.x, y: p.y + 1, z: p.z, v: hs });
      }
    }
    if (!any) break;
  }
  return ground;
}
// collision entre les deux grimpeurs : on peut se pousser et monter sur la tête de l'autre
function collideMates(W) { const [a, b] = W.pl; collidePair(a, b); }
function collideAll(W) { for (let i = 0; i < W.pl.length; i++) for (let j = i + 1; j < W.pl.length; j++) collidePair(W.pl[i], W.pl[j]); }
function collidePair(a, b) {
  const r = P.R * 2;
  const ay0 = a.y + P.R, ay1 = a.y + P.H - P.R, by0 = b.y + P.R, by1 = b.y + P.H - P.R;
  // points les plus proches de deux segments verticaux
  const sa = clamp((Math.max(ay0, by0) + Math.min(ay1, by1)) / 2, ay0, ay1), sb = clamp(sa, by0, by1), sa2 = clamp(sb, ay0, ay1);
  let dx = b.x - a.x, dy = sb - sa2, dz = b.z - a.z; const d = Math.hypot(dx, dy, dz);
  if (d >= r || d < 1e-6) return;
  dx /= d; dy /= d; dz /= d; const pen = r - d;
  const wa = a.st === ST.GROUND ? 1 : a.st === ST.AIR ? 1 : 0, wb = b.st === ST.GROUND ? 1 : b.st === ST.AIR ? 1 : 0;
  if (wa + wb === 0) return;
  const ka = wa / (wa + wb), kb = wb / (wa + wb);
  a.x -= dx * pen * ka; a.y -= dy * pen * ka; a.z -= dz * pen * ka; b.x += dx * pen * kb; b.y += dy * pen * kb; b.z += dz * pen * kb;
  const top = dy > 0.6 ? b : dy < -0.6 ? a : null, under = top === b ? a : b;
  if (top && top.st === ST.AIR && top.vy <= under.vy + 0.1) { top.vy = under.vy; top.st = ST.GROUND; top.onMate = true; top.gb = -1; top.gvx = under.vx; top.gvz = under.vz; top.gvy = 0; top.coy = P.COYOTE; }
}

/* ------------------------------ rebords et murs ------------------------------ */
// faces latérales d'une boîte (repère local) : 0 +x, 1 -x, 2 +z, 3 -z
const FACE = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function faceInfo(b, f) { const [fx, fz] = FACE[f]; return { half: fx ? b.hd : b.hw, out: fx ? b.hw : b.hd, nx: b.c * fx + b.s * fz, nz: -b.s * fx + b.c * fz }; }
// point monde du bord : face f, abscisse u le long du bord, à la distance off devant la face, hauteur y
function facePoint(b, f, u, off, y, o) {
  const [fx, fz] = FACE[f], fi = faceInfo(b, f);
  const lx = fx ? fx * (fi.out + off) : u, lz = fx ? u : fz * (fi.out + off);
  o.x = b.px + b.c * lx + b.s * lz; o.z = b.pz - b.s * lx + b.c * lz; o.y = y; return o;
}
const FP = { x: 0, y: 0, z: 0 };
// cherche un rebord saisissable devant le joueur (en l'air, mains dans la fenêtre, on pousse vers lui)
function findLedge(W, p, wx, wz) {
  let best = null, bd = 1e9;
  for (const b of W.bodies) {
    if (!b.on || b.ghost || b.nograb || b.hit) continue;
    const top = b.py + b.hh, rel = grabY(b) - p.y; // lip : on saisit le bord d'un plancher de balcon, on se hisse ensuite par-dessus son garde-corps (dessus de la boîte)
    if (rel < P.GRAB_LO || rel > P.GRAB_HI) continue;
    if (p.vy > 0 && p.y + (p.vy * p.vy) / (2 * P.G_UP) > top + 0.05) continue; // on passera au-dessus : on atterrira dessus plutôt que s'y pendre
    if (Math.abs(p.x - b.px) > b.ex + 1 || Math.abs(p.z - b.pz) > b.ez + 1) continue;
    local(b, p.x, p.z, L);
    if (b.bar) { // barre d'accroche (selon son grand axe) : on la saisit en passant dessous ou à côté, quel que soit le sens
      const alongX = b.hw > b.hd, cross = alongX ? L.lz : L.lx, u = alongX ? L.lx : L.lz, half = alongX ? b.hw : b.hd;
      if (Math.abs(cross) > P.ROPE_REACH || Math.abs(u) > half - 0.15) continue;
      const vc = alongX ? p.vz : p.vx; // côté d'arrivée : on fait face au sens de la traversée
      const f = alongX ? (cross > 0.05 ? 2 : cross < -0.05 ? 3 : vc > 0 ? 3 : 2) : (cross > 0.05 ? 0 : cross < -0.05 ? 1 : vc > 0 ? 1 : 0);
      if (Math.abs(cross) < bd) { bd = Math.abs(cross); best = { b: b.i, f, u }; }
      continue;
    }
    for (let f = 0; f < 4; f++) {
      const [fx, fz] = FACE[f], fi = faceInfo(b, f);
      const dist = fx ? fx * L.lx - fi.out : fz * L.lz - fi.out, u = fx ? L.lz : L.lx;
      if (dist < P.R - 0.05 - (b.eave || 0) || dist > P.R + P.GRAB_REACH || Math.abs(u) > fi.half - 0.12) continue; // eave : rebord d'un toit qui déborde du mur, saisi depuis le pied du mur
      const push = -(wx * fi.nx + wz * fi.nz), into = -(p.vx * fi.nx + p.vz * fi.nz);
      if (push < 0.35 && into < 1.2) continue;
      // la main tombe sur un vrai bord : rien au-dessus du bord ni juste devant
      facePoint(b, f, u, 0.12, top + 0.15, FP); if (inside(W, FP.x, FP.y, FP.z)) continue;
      if (!b.edge) { facePoint(b, f, u, -0.25, top + 0.15, FP); if (inside(W, FP.x, FP.y, FP.z)) continue; } // edge : rebord certifié (toit raide : la pente commence juste derrière)
      const m = b.eave ? P.R + Math.abs(dist - P.R) : dist; // (sans débord : le bord le plus proche, comme avant)
      if (m < bd) { bd = m; best = { b: b.i, f, u, ...(b.eave ? { o: clamp(dist, P.R + 0.03 - b.eave, P.R + 0.03) } : {}) }; }
    }
  }
  return best;
}
const grabY = (b) => (b.lip !== undefined ? b.py - b.hh + b.lip : b.py + b.hh); // hauteur des mains quand on pend à ce rebord
function hangPose(W, p) { // position du corps suspendu à partir du bord (suit la boîte si elle bouge)
  const b = W.bodies[p.hang.b], top = grabY(b), fi = faceInfo(b, p.hang.f);
  facePoint(b, p.hang.f, p.hang.u, b.bar ? -fi.out : p.hang.o ?? P.R + 0.03, top - P.HANG_DROP, FP); // sous une barre : centré dessous ; sous un débord de toit : contre le mur (o)
  p.x = FP.x; p.y = FP.y; p.z = FP.z; p.yaw = Math.atan2(-fi.nx, -fi.nz);
  return fi;
}
function climbPose(W, p) {
  const b = W.bodies[p.climb.b], fi = faceInfo(b, p.climb.f);
  facePoint(b, p.climb.f, p.climb.u, P.R + 0.03, b.py + p.climb.y, FP);
  p.x = FP.x; p.y = FP.y; p.z = FP.z; p.yaw = Math.atan2(-fi.nx, -fi.nz);
  return fi;
}
function findClimb(W, p, wx, wz) {
  for (const b of W.bodies) {
    if (!b.on || !b.climb) continue;
    if (Math.abs(p.x - b.px) > b.ex + 0.8 || Math.abs(p.z - b.pz) > b.ez + 0.8) continue;
    if (p.y + 0.6 < b.py - b.hh || p.y + 0.4 > b.py + b.hh) continue;
    local(b, p.x, p.z, L);
    for (let f = 0; f < 4; f++) {
      const [fx, fz] = FACE[f], fi = faceInfo(b, f);
      if (b.climbFaces && !b.climbFaces.includes(f)) continue;
      const dist = fx ? fx * L.lx - fi.out : fz * L.lz - fi.out, u = fx ? L.lz : L.lx;
      if (dist < P.R - 0.08 || dist > P.R + 0.18 || Math.abs(u) > fi.half - 0.2) continue;
      if (-(wx * fi.nx + wz * fi.nz) < 0.5) continue;
      return { b: b.i, f, u, y: clamp(p.y - b.py, -b.hh, b.hh - 1.2) };
    }
  }
  return null;
}
function startMantle(W, p, b, f, u) {
  const top = b.py + b.hh, fi = faceInfo(b, f);
  facePoint(b, f, u, -Math.min(0.55, fi.out - 0.05), top, FP);
  p.mantle = { b: b.i, f, u, x0: p.x, y0: p.y, z0: p.z, lx: -Math.min(0.55, fi.out - 0.05), t: 0 };
  p.st = ST.MANTLE; p.stT = 0; p.hang = p.climb = null; p.vx = p.vy = p.vz = 0;
  ev(W, 'mantle', { p: p.id, x: FP.x, y: top, z: FP.z });
}
function leaveWall(p, nx, nz, ix, iz, mode) {
  p.st = ST.AIR; p.stT = 0; p.hang = p.climb = null; p.grabCd = P.GRAB_CD;
  if (mode === 'jump') { // saut mural : on repart à l'opposé, un peu orientable par la direction voulue
    p.vx = nx * P.WJ_OUT + ix * 2.4; p.vz = nz * P.WJ_OUT + iz * 2.4; p.vy = P.WJ_UP; p.cut = false; p.jHeld = true;
  } else { p.vx = nx * 0.8; p.vz = nz * 0.8; p.vy = 0; }
}

/* ------------------------------ grimpeur ------------------------------ */
export const IDLE = { mx: 0, mz: 0, jump: false, jc: 0, brace: false, pull: false, dc: 0, uc: 0, reset: false };
const CD = { x: 0, y: 0, z: 0, yaw: 0 };
const others = (W, p) => W.pl.filter((q) => q !== p);
function nearestOther(W, p) { let best = null, bd = 1e9; for (const q of W.pl) { if (q === p) continue; const d = Math.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y); if (d < bd) { bd = d; best = q; } } return best; }
function stepPlayer(W, p, I, mate) {
  const dt = DT;
  p.stT += dt; p.grabCd = Math.max(0, p.grabCd - dt); p.thruT = Math.max(0, (p.thruT || 0) - dt); p.knock = Math.max(0, p.knock - dt); p.land = Math.max(0, p.land - dt);
  let wx = I.mx || 0, wz = I.mz || 0, wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const jPress = I.jc !== p.jc; p.jc = I.jc;
  const dPress = I.dc !== p.dc; p.dc = I.dc;
  if (jPress) p.buf = P.BUFFER; else p.buf = Math.max(0, p.buf - dt);
  const uPress = (I.uc || 0) !== (p.uc || 0); p.uc = I.uc || 0;
  p.brace = !!I.brace;
  // tirer la chaîne (action dédiée) : seulement debout au sol et avec de l'endurance ; on ne peut pas s'arc-bouter en même temps
  // on ne ravale la chaîne que si elle porte un partenaire en l'air : posé ou accroché, on ne tire plus (sinon on le colle à soi et ils s'envolent)
  p.haul = !!I.pull && p.st === ST.GROUND && p.sta > 0.02 && mate?.st === ST.AIR && W.taut > 0.4; if (I.pull && p.st === ST.GROUND) p.brace = false;
  // COURTE ÉCHELLE (action dédiée, maintenue) : debout au sol, on joint les mains devant soi et on ne bouge plus, tourné vers le partenaire ;
  // le partenaire qui saute tout près (au sol ou en retombant à hauteur des mains) pose le pied dedans et part bien plus haut (P.CUP_V)
  p.cup = !!I.cup && wl < 0.2 && p.st === ST.GROUND && !p.onMate && !p.haul && !W.alone && !W.solo;
  if (p.cup) { p.brace = false; p.cupT = (p.cupT || 0) + dt; wx = wz = wl = 0; const d = Math.atan2(mate.x - p.x, mate.z - p.z) - p.yaw; p.yaw += clamp(Math.atan2(Math.sin(d), Math.cos(d)), -P.TURN * dt, P.TURN * dt); } else p.cupT = 0;
  p.pushT = Math.max(0, (p.pushT || 0) - dt);
  // ÉJECTÉ par un coup de poing : on vole sans contrôle (knock) ; à la réception, on reste au sol DOWN_T s, puis on se relève
  if (p.ko && p.st !== ST.AIR) { p.ko = false; if (p.st === ST.GROUND) { p.downT = P.DOWN_T; p.knock = 0; ev(W, 'down', { p: p.id, x: p.x, y: p.y, z: p.z }); } }
  if (p.downT > 0) { p.downT = Math.max(0, p.downT - dt); wx = wz = wl = 0; p.buf = 0; p.cup = false; p.brace = false; if (!p.downT) ev(W, 'getup', { p: p.id }); }
  // COUPS (actions dédiées, bits 32 = poing, 64 = pied) : poing = jab du bras gauche ou cross du bras droit au hasard (tirage déterministe :
  // même résultat chez tous), calé sur les vraies animations (impact à 0,20 s / 0,26 s) ; pied = coup de pied de face (impact à 0,30 s).
  // On se tourne vers le partenaire et on fait un PAS vers lui pendant l'armé (le coup touche le visage / le torse au lieu de frapper dans le vide).
  const pPress = !!I.punch && !p.pHeld, kPress = !!I.kick && !p.kHeld; p.pHeld = !!I.punch; p.kHeld = !!I.kick; p.pCd = Math.max(0, (p.pCd || 0) - dt);
  if (p.pT != null) {
    const t0 = p.pT, H = atkHit(p); p.pT += dt;
    if (p.pT <= H && p.lunge > 0 && (p.st === ST.GROUND || p.st === ST.AIR)) { const s = Math.min(p.lunge, (p.lunge / Math.max(dt, H - t0)) * dt); const nx = p.x + Math.sin(p.yaw) * s, nz = p.z + Math.cos(p.yaw) * s; if (!inside(W, nx, p.y + 0.9, nz, P.R)) { p.x = nx; p.z = nz; } p.lunge -= s; }
    if (p.pT < H + 0.12) wx = wz = wl = 0; // pendant le coup, on ne court pas
    if (t0 < H && p.pT >= H) { if (W.free) for (const q of others(W, p)) punchHit(W, p, q); else punchHit(W, p, mate); }
    if (p.pT > (p.pK ? 0.75 : 0.55)) p.pT = null;
  }
  if ((pPress || kPress) && p.pCd <= 0 && !p.downT && !p.ko && (p.st === ST.GROUND || p.st === ST.AIR) && !p.cup && !p.haul) {
    p.pT = 0; p.pK = kPress && !pPress ? 1 : 0; p.pCd = p.pK ? P.KICK_CD : P.PUNCH_CD; p.lunge = 0;
    p.pSide = p.pK ? 1 : (Math.imul(W.tick + 7 * p.id + 13, 2654435761) >>> 16) & 1; // poing : 0 = jab (gauche), 1 = cross (droite)
    const tg = W.free ? nearestOther(W, p) : mate;
    if (tg && (W.free || (!W.alone && !W.solo))) { const h = Math.hypot(tg.x - p.x, tg.z - p.z), want = p.pK ? 1.3 : 1.0;
      if (h < 2.6) p.yaw = Math.atan2(tg.x - p.x, tg.z - p.z);
      if (h > want && h < (p.pK ? P.KICK_R : P.PUNCH_R) + 0.7 && Math.abs(tg.y - p.y) < 1) p.lunge = h - want; }
    ev(W, 'swing', { p: p.id, side: p.pSide, kick: p.pK, x: p.x, y: p.y + 1.4, z: p.z });
  }
  p.ropeUp = false;
  if (p.st !== ST.GROUND && p.slideT) { p.slideT = 0; p.crawl = false; p.slideCd = P.SLIDE_CD; }
  if (p.st !== ST.AIR) { p.dj = false; p.cupUsed = false; p.slideJump = false; } // second saut (mode solo) rendu dès qu'on touche quelque chose
  p.ropeCd = Math.max(0, (p.ropeCd || 0) - dt);
  // levier à portée : « Interagir » le bascule
  if (uPress && p.st !== ST.AIR) for (const b of W.bodies) if (b.lever && Math.hypot(b.px - p.x, b.pz - p.z) < P.USE_R && Math.abs(b.py - (p.y + 1)) < 2.2) {
    W.sw[b.lever.id] = !W.sw[b.lever.id]; ev(W, 'lever', { id: b.lever.id, on: W.sw[b.lever.id] ? 1 : 0, x: b.px, y: b.py, z: b.pz }); break;
  }

  // porté par la plateforme sous ses pieds (ou par le partenaire sur lequel on se tient)
  if (p.st === ST.GROUND && p.gb >= 0) {
    const b = W.bodies[p.gb]; carryDelta(W, b, p.x, p.z, CD);
    p.x += CD.x; p.y += CD.y; p.z += CD.z; p.yaw -= CD.yaw;
  }

  if (p.st === ST.ROPE) stepRope(W, p, I, wx, wz, wl, dPress);
  else if (p.st === ST.HANG) {
    const b = W.bodies[p.hang.b];
    if (!b.on) { leaveWall(p, 0, 0, 0, 0, 'drop'); }
    else {
      const fi = hangPose(W, p), into = -(wx * fi.nx + wz * fi.nz), lat = wx * fi.nz - wz * fi.nx; // lat > 0 = vers la droite du grimpeur (face au mur)
      const half = faceInfo(b, p.hang.f).half, nu = clamp(p.hang.u + uStep(b, p.hang.f, fi, lat * P.SHIMMY * dt), -half + 0.2, half - 0.2);
      // on ne glisse pas vers un tronçon de bord bouché
      facePoint(b, p.hang.f, nu, 0.12, b.py + b.hh + 0.15, FP);
      if (!inside(W, FP.x, FP.y, FP.z)) p.hang.u = nu;
      // au bout du rebord, on continue de pousser sur le côté : on passe le coin et on reprend sur la face voisine (on fait le tour de la plateforme)
      if (!b.bar && !b.nograb && Math.abs(lat) > 0.5 && Math.abs(p.hang.u) >= half - 0.21) { p.cornerT = (p.cornerT || 0) + dt; if (p.cornerT > 0.15) { turnCorner(W, p, b, fi, lat); p.cornerT = 0; } }
      else p.cornerT = 0;
      p.sta -= (P.STA_HANG + (p.load || 0) * P.STA_LOAD) * dt;
      hangPose(W, p); p.vx = b.vx; p.vy = b.vy; p.vz = b.vz;
      const canUp = !b.bar && roomAbove(W, b, p.hang.f, p.hang.u);
      if (dPress || p.sta <= 0) { leaveWall(p, fi.nx, fi.nz, 0, 0, 'drop'); ev(W, 'let', { p: p.id }); }
      else if (b.bar && p.buf > 0 && p.stT > 0.1) { // barre : on saute vers l'avant (direction voulue, sinon dans le sens de la traversée)
        p.buf = 0; let dx = wl > 0.3 ? wx : -fi.nx, dz = wl > 0.3 ? wz : -fi.nz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        p.st = ST.AIR; p.stT = 0; p.hang = null; p.grabCd = 0.22; p.thru = b.i; p.thruT = 0.3; p.vx = dx * P.BAR_FWD + b.vx; p.vz = dz * P.BAR_FWD + b.vz; p.vy = P.BAR_UP; p.jHeld = true; p.cut = false;
        ev(W, 'jump', { p: p.id, wall: 1 });
      }
      else if (p.buf > 0 && p.stT > 0.06) {
        p.buf = 0;
        if (into > -0.3 && canUp) startMantle(W, p, b, p.hang.f, p.hang.u);
        else { leaveWall(p, fi.nx, fi.nz, wx, wz, 'jump'); ev(W, 'jump', { p: p.id, wall: 1 }); }
      } else if (globalThis.ENCH_AUTOMANTLE && into > 0.6 && canUp && p.stT > 0.18) startMantle(W, p, b, p.hang.f, p.hang.u); // ROBOTS de test seulement : pousser = Espace
      // joueurs : se hisser = Espace seulement (pousser vers le mur ne hisse plus : on peut longer le rebord sans monter par erreur)
      p.lat = lat;
    }
  } else if (p.st === ST.CLIMB) {
    const b = W.bodies[p.climb.b];
    const fi = climbPose(W, p), into = -(wx * fi.nx + wz * fi.nz), lat = wx * fi.nz - wz * fi.nx;
    p.climb.u = clamp(p.climb.u + uStep(b, p.climb.f, fi, lat * P.CLIMB_LAT * dt), -faceInfo(b, p.climb.f).half + 0.25, faceInfo(b, p.climb.f).half - 0.25);
    const tired = p.sta <= 0;
    p.climb.y += (tired ? -1.2 : into * P.CLIMB_V) * dt;
    p.sta -= (P.STA_CLIMB * (Math.abs(into) + Math.abs(lat) > 0.2 ? 1 : 0.55) + (p.load || 0) * P.STA_LOAD) * dt;
    climbPose(W, p); p.vx = b.vx; p.vy = into * P.CLIMB_V; p.vz = b.vz; p.lat = lat; p.climbV = into;
    const handsTop = b.hh - (p.climb.y + 1.95);
    const canUp = roomAbove(W, b, p.climb.f, p.climb.u);
    if (handsTop < 0 && into > 0.3 && canUp) startMantle(W, p, b, p.climb.f, p.climb.u);
    else if (p.climb.y > b.hh - 1.95) p.climb.y = b.hh - 1.95;
    if (p.st === ST.CLIMB) {
      const gr = groundBelow(W, p.x, p.y + 0.05, p.z, 0.08);
      if (dPress || p.sta < -0.4) { leaveWall(p, fi.nx, fi.nz, 0, 0, 'drop'); ev(W, 'let', { p: p.id }); }
      else if (p.buf > 0 && p.stT > 0.1) { p.buf = 0; leaveWall(p, fi.nx, fi.nz, wx, wz, 'jump'); ev(W, 'jump', { p: p.id, wall: 1 }); }
      else if (gr && into < -0.3) { p.st = ST.GROUND; p.climb = null; p.stT = 0; }
    }
  } else if (p.st === ST.MANTLE) {
    const m = p.mantle, b = W.bodies[m.b];
    m.t += dt; const k = clamp(m.t / P.MANTLE_T, 0, 1);
    facePoint(b, m.f, m.u, m.lx, b.py + b.hh, FP);
    // d'abord le corps monte le long du mur, puis passe par-dessus le bord
    const ku = clamp(k / 0.65, 0, 1), kf = clamp((k - 0.45) / 0.55, 0, 1), e = (t) => t * t * (3 - 2 * t);
    const fi = faceInfo(b, m.f); const ex = FP.x + fi.nx * (-m.lx + P.R + 0.03), ez = FP.z + fi.nz * (-m.lx + P.R + 0.03);
    p.x = ex + (FP.x - ex) * e(kf); p.z = ez + (FP.z - ez) * e(kf); p.y = m.y0 + (FP.y + 0.02 - m.y0) * e(ku);
    if (b.move) { /* le bord bouge : on suit */ m.y0 += b.vy * dt; }
    p.vx = b.vx; p.vy = 0; p.vz = b.vz;
    if (k >= 1) { p.st = ST.GROUND; p.stT = 0; p.mantle = null; p.gb = b.i; p.peakY = p.y; p.coy = P.COYOTE; }
  } else {
    // ---- au sol / en l'air ----
    const ground = p.st === ST.GROUND;
    windAt(W, p.x, p.y + 1, p.z, WA);
    // vent : en l'air il porte (courant ascendant = pas de saut coupé), au sol il pousse selon la zone (WA.g) ; arc-bouté au sol, on lui résiste
    if (WA.x || WA.y || WA.z) {
      const k = ground ? (p.brace ? 0 : WA.g) : 1; p.vx += WA.x * dt * k; p.vz += WA.z * dt * k;
      if (!ground) { p.vy += WA.y * dt; if (WA.y > 0) p.noCut = true; } else if (WA.y > 12) { p.vy = WA.y * 0.25; toAir(p); }
    }
    const gbody = ground ? W.bodies[p.gb] : null;
    if (gbody?.launch && gbody.move && gbody.vy > 3) { p.vy = gbody.launch; toAir(p); p.coy = 0; p.noCut = true; ev(W, 'launch', { p: p.id, x: p.x, y: p.y, z: p.z }); }
    if (p.st === ST.GROUND) {
      p.dj = false; p.coy = P.COYOTE; p.sta = p.haul ? p.sta - P.STA_HAUL * (0.4 + (p.load || 0)) * dt : Math.min(1, p.sta + P.STA_REGEN * dt);
      // GLISSADE (touche dédiée) : en courant, un appui lance une glissade rapide (élan ×1,28, freinage doux, virage lent) ; sauter pendant la glissade donne
      // un saut plus long ; on peut la couper (relâcher) après 0,22 s. Recharge courte.
      const sPress = !!I.slide && !p.sHeld; p.sHeld = !!I.slide; p.slideCd = Math.max(0, (p.slideCd || 0) - dt); p.tackleCd = Math.max(0, (p.tackleCd || 0) - dt); p.recT = Math.max(0, (p.recT || 0) - dt);
      if (sPress && !p.slideT && p.slideCd <= 0 && !p.haul && !p.cup && !p.downT) {
        const rvx0 = p.vx - p.gvx, rvz0 = p.vz - p.gvz, sp0 = Math.hypot(rvx0, rvz0);
        if (sp0 > 1.2) { p.sdx = rvx0 / sp0; p.sdz = rvz0 / sp0; } else if (wl > 0.3) { p.sdx = wx / wl; p.sdz = wz / wl; } else { p.sdx = Math.sin(p.yaw); p.sdz = Math.cos(p.yaw); }
        p.slideT = P.SLIDE_T; p.crawl = false; p.sv = Math.max(sp0, P.RUN) * P.SLIDE_BOOST; ev(W, 'slide', { p: p.id, x: p.x, y: p.y, z: p.z, dx: p.sdx, dz: p.sdz });
      }
      let spd = P.RUN * (p.recT > 0 ? 0.55 : 1); // juste après une glissade : on se relève (plus lent)
      let tx = wx * spd, tz = wz * spd;
      if (p.brace) { tx *= 0.25; tz *= 0.25; } // arc-bouté : on avance à petits pas
      if (p.haul) { tx *= P.HAUL_MOVE; tz *= P.HAUL_MOVE; } // on tire à deux mains : la chaîne nous attire vers le vide 
      // chaîne tendue : on hisse un partenaire suspendu (lentement), on glisse vers le vide si on ne s'arc-boute pas,
      // on remorque un partenaire au sol (lentement), on ne s'éloigne pas d'un partenaire accroché ou arc-bouté
      if (W.taut > 0.5 && p.pullX !== undefined) {
        const ux = p.pullX, uz = p.pullZ, along = tx * ux + tz * uz; // > 0 = vers le partenaire
        if (mate.dangling) {
          if (p.haul) { tx += ux * P.HAUL_SLIP * p.load; tz += uz * P.HAUL_SLIP * p.load; } // l'effort déséquilibre : les pieds glissent vers le bord
          else if (p.brace) { tx = 0; tz = 0; }
          else if (along < -0.3) { const k = P.PULL_V / spd; tx *= k; tz *= k; }
          else if (Math.hypot(tx, tz) < 0.5) { tx = ux * P.DRAG_V * p.load; tz = uz * P.DRAG_V * p.load; }
        } else if (along < 0) {
          const cap = mate.st === ST.GROUND ? (mate.brace ? 0.4 : P.TOW_V) : mate.st === ST.AIR ? spd : 0;
          if (-along > cap) { tx += ux * (-along - cap); tz += uz * (-along - cap); }
        }
      }
      const rvx = p.vx - p.gvx, rvz = p.vz - p.gvz, k = (tx * rvx + tz * rvz > 0 ? P.ACC : P.DEC) * dt * (p.knock > 0 ? 0.15 : 1) * (W.bodies[p.gb]?.ice ? 0.18 : 1);
      const nvx = approach(rvx, tx, Math.abs(k * (tx - rvx) / (Math.hypot(tx - rvx, tz - rvz) || 1)));
      const nvz = approach(rvz, tz, Math.abs(k * (tz - rvz) / (Math.hypot(tx - rvx, tz - rvz) || 1)));
      p.vx = nvx + p.gvx; p.vz = nvz + p.gvz; p.vy = Math.min(p.vy, p.gvy);
      if (p.slideT > 0) { // la glissade impose la vitesse : direction qui tourne lentement vers la direction voulue, vitesse qui retombe
        p.slideT -= dt;
        if (p.crawl) { // sous un plafond bas : on rampe, la direction suit l'envie
          if (wl > 0.2) { p.sdx = wx / wl; p.sdz = wz / wl; p.sv = P.CRAWL; } else p.sv = 0;
        } else {
          if (wl > 0.2) { const a0 = Math.atan2(p.sdx, p.sdz), d = Math.atan2(Math.sin(Math.atan2(wx, wz) - a0), Math.cos(Math.atan2(wx, wz) - a0)), a1 = a0 + clamp(d, -P.SLIDE_TURN * dt, P.SLIDE_TURN * dt); p.sdx = Math.sin(a1); p.sdz = Math.cos(a1); }
          p.sv = Math.max(P.RUN * 0.7, p.sv - P.SLIDE_DECEL * dt);
          for (const q of others(W, p)) tackleHit(W, p, q);
        }
        p.vx = p.sdx * p.sv + p.gvx; p.vz = p.sdz * p.sv + p.gvz;
        if (!p.crawl && ((!I.slide && p.slideT < P.SLIDE_T - P.SLIDE_MIN) || p.brace || p.haul)) p.slideT = 0;
        if (p.slideT <= 0) {
          if (!canStand(W, p) && !p.brace && !p.haul) { p.slideT = 0.05; p.crawl = true; } // plafond bas : on reste accroupi
          else { p.slideT = 0; p.crawl = false; p.slideCd = P.SLIDE_CD; p.recT = P.SLIDE_REC; }
        }
      }
      if (p.crawl && p.buf > 0) p.buf = 0; // coincé sous un plafond bas : pas de saut
      if (p.buf > 0 && cupBoost(W, p, mate)) { /* courte échelle */ }
      else if (p.buf > 0) { // saut : on garde l'élan de la plateforme
        p.buf = 0; p.vy = P.JUMP + Math.max(0, p.gvy); p.st = ST.AIR; p.stT = 0; p.coy = 0; p.cut = false; p.jHeld = true; p.onMate = false;
        if (p.slideT > 0) { p.vx = (p.vx - p.gvx) * P.SLIDE_JUMP + p.gvx; p.vz = (p.vz - p.gvz) * P.SLIDE_JUMP + p.gvz; p.slideT = 0; p.slideCd = P.SLIDE_CD; p.slideJump = true; } // saut glissé : plus long
        ev(W, 'jump', { p: p.id, x: p.x, y: p.y, z: p.z, slide: p.slideJump ? 1 : 0 });
      }
    } else {
      p.coy = Math.max(0, p.coy - dt);
      if (p.buf > 0 && cupBoost(W, p, mate)) { /* courte échelle en retombant sur les mains */ }
      else if (p.buf > 0 && p.coy > 0) { // coyote time : le saut part encore juste après avoir quitté le bord
        p.buf = 0; p.vy = P.JUMP; p.coy = 0; p.cut = false; p.jHeld = true; ev(W, 'jump', { p: p.id, x: p.x, y: p.y, z: p.z });
      } else if (W.crazy && p.buf > 0 && (p.wjCd || 0) <= 0 && p.stT > 0.05 && wallJump(W, p, wx, wz)) { /* saut mural (mode crazy) */
      } else if (W.alone && p.buf > 0 && !p.dj && p.stT > 0.08 && !(p.vy < 0 && groundBelow(W, p.x, p.y + 0.02, p.z, Math.max(0.6, -p.vy * (P.BUFFER + 0.04))))) { // MODE SOLO : un second saut en l'air remplace la courte échelle (passages prévus pour deux)
        p.buf = 0; p.dj = true; p.vy = Math.max(p.vy, P.JUMP); p.cut = false; p.jHeld = true; ev(W, 'jump', { p: p.id, x: p.x, y: p.y, z: p.z, dj: 1 });
      }
      // contrôle aérien : on accélère vers la direction voulue tant que la vitesse dans ce sens reste sous AIR_MAX (l'élan n'est jamais coupé)
      if (wl > 0.05) {
        // suspendu à la chaîne : on « pompe » le balancement plus fort (c'est ce qui permet d'atteindre une paroi lointaine)
        if (!p.dangling && p.knock <= 0) { // avec de l'élan AU-DESSUS de la vitesse de course (saut glissé, tremplin, grand élan), le virage fait TOURNER la vitesse (elle garde sa norme) au lieu de la laisser filer tout droit
          const sp = Math.hypot(p.vx - (p.gvx || 0), p.vz - (p.gvz || 0));
          if (sp > P.AIR_MAX + 0.3) { const rx = p.vx - (p.gvx || 0), rz = p.vz - (p.gvz || 0), a0 = Math.atan2(rx, rz), d = Math.atan2(Math.sin(Math.atan2(wx, wz) - a0), Math.cos(Math.atan2(wx, wz) - a0)), t = clamp(d, -P.AIR_TURN * dt * Math.min(1, wl), P.AIR_TURN * dt * Math.min(1, wl)); p.vx = Math.sin(a0 + t) * sp + (p.gvx || 0); p.vz = Math.cos(a0 + t) * sp + (p.gvz || 0); }
        }
        const sw = p.dangling ? P.SWING_ACC / P.AIR_ACC : 1, cur = p.vx * wx + p.vz * wz;
        const opp = cur < 0 ? P.AIR_BRAKE : 1; // demi-tour en l'air : on freine plus fort qu'on n'accélère (un virage raté se rattrape)
        const add = clamp(P.AIR_MAX * (p.dangling ? 1.2 : 1) * Math.min(1, wl) - cur, 0, P.AIR_ACC * sw * opp * dt * (p.knock > 0 ? 0.3 : 1));
        p.vx += wx * add; p.vz += wz * add;
        if (!p.dangling && p.knock <= 0) { // la dérive latérale s'amortit quand on pousse : l'élan de côté ne s'accumule pas
          const cu = p.vx * wx + p.vz * wz, lx = p.vx - cu * wx, lz = p.vz - cu * wz, kk = Math.min(1, P.AIR_LAT * dt * Math.min(1, wl)); p.vx -= lx * kk; p.vz -= lz * kk;
        }
      } else { const k = 1 - P.AIR_DRAG * dt; p.vx *= k; p.vz *= k; }
      // saut à hauteur variable : relâcher tôt = pesanteur plus forte jusqu'à l'apex
      if (!I.jump) p.jHeld = false;
      const g = p.vy > 0 ? (p.jHeld || p.noCut ? P.G_UP : P.G_CUT) : P.G_DOWN; // propulsé (tremplin, piston) : pas de saut coupé
      p.vy = Math.max(-P.FALL_MAX, p.vy - g * dt);
      if (W.crazy) { p.wjCd = Math.max(0, (p.wjCd || 0) - dt); if (p.vy < -CZ.WALL_SLIDE && wl > 0.3) { const n = wallNormal(W, p); if (n && wx * n.x + wz * n.z < -0.3) p.vy = -CZ.WALL_SLIDE; } } // glissade le long d'un mur
      // grimper le long de la chaîne quand on pend dessous (maintenir « Tenir »)
      if (p.brace && p.dangling && p.sta > 0) { p.ropeUp = true; p.sta -= P.STA_ROPE * dt; }
    }
    // rotation du corps vers la direction de course
    const hs = Math.hypot(p.vx - p.gvx, p.vz - p.gvz);
    if (wl > 0.1 || hs > 0.6) {
      const ty = Math.atan2(wl > 0.1 ? wx : p.vx, wl > 0.1 ? wz : p.vz); let d = ty - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      p.yaw += clamp(d, -P.TURN * dt, P.TURN * dt);
    }
    // au sol, la plateforme nous a déjà portés (carryDelta) : on n'intègre que la vitesse relative
    if (p.st === ST.GROUND && p.gb >= 0) { p.x += (p.vx - p.gvx) * dt; p.y += Math.max(0, p.vy - p.gvy) * dt; p.z += (p.vz - p.gvz) * dt; }
    else { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
    const wasGround = ground;
    const g = collidePlayer(W, p);
    if (g) setGround(W, p, g);
    else if (p.onMate && mate && Math.abs(p.y - (mate.y + P.H)) < 0.08 && Math.hypot(p.x - mate.x, p.z - mate.z) < P.R * 2) { p.st = ST.GROUND; }
    else if (wasGround && p.vy <= p.gvy + 0.01 && !p.onMate) {
      // accroche au sol : on suit les marches et les plateformes qui descendent
      const gr = groundBelow(W, p.x, p.y + 0.02, p.z, 0.32);
      if (gr) { p.y = gr.y; setGround(W, p, gr.b); }
      else toAir(p);
    } else if (p.st === ST.GROUND) toAir(p);
    if (p.st === ST.AIR) {
      if (p.y > p.peakY) p.peakY = p.y;
      if (p.grabCd <= 0 && p.vy < P.GRAB_VY && p.knock <= 0) {
        const c = findClimb(W, p, wx, wz);
        if (c) { p.st = ST.CLIMB; p.climb = c; p.stT = 0; p.vy = 0; ev(W, 'grab', { p: p.id, wall: 1 }); }
        else {
          const h = findLedge(W, p, wx, wz);
          if (h) { p.st = ST.HANG; p.hang = h; p.stT = 0; p.vx = p.vy = p.vz = 0; hangPose(W, p); ev(W, 'grab', { p: p.id, x: p.x, y: p.y + 2, z: p.z }); }
          else { const r = findRope(W, p, mate); if (r) { p.st = ST.ROPE; p.rope = r; p.stT = 0; ev(W, 'grab', { p: p.id, rope: 1, x: p.x, y: p.y + 2, z: p.z }); } }
        }
      }
    } else if (p.st === ST.GROUND && wl > 0.3) { // au sol contre un mur d'escalade : on s'y agrippe en poussant
      const c = findClimb(W, p, wx, wz);
      if (c && p.stT > 0.15) { p.st = ST.CLIMB; p.climb = c; p.stT = 0; p.vy = 0; ev(W, 'grab', { p: p.id, wall: 1 }); }
    }
  }
  if (p.st !== ST.AIR) { p.peakY = Math.max(p.y, p.st === ST.GROUND ? p.y : p.peakY); }
}
// déplacement monde « vers la droite du grimpeur face au mur » converti en abscisse locale u le long de la face
function turnCorner(W, p, b, fi, lat) {
  const mx = fi.nz * Math.sign(lat), mz = -fi.nx * Math.sign(lat); // direction du déplacement le long du bord
  for (let f2 = 0; f2 < 4; f2++) {
    if (f2 === p.hang.f) continue; const g = faceInfo(b, f2); if (g.nx * mx + g.nz * mz < 0.7) continue;
    local(b, p.x, p.z, L); const u2 = clamp(FACE[f2][0] ? L.lz : L.lx, -g.half + 0.25, g.half - 0.25);
    facePoint(b, f2, u2, 0.12, b.py + b.hh + 0.15, FP); if (inside(W, FP.x, FP.y, FP.z)) return false; // coin bouché
    p.hang.f = f2; p.hang.u = u2; ev(W, 'grab', { p: p.id, x: p.x, y: p.y + 1.8, z: p.z }); return true;
  }
  return false;
}
function uStep(b, f, fi, d) { const ax = FACE[f][0] ? b.s : b.c, az = FACE[f][0] ? b.c : -b.s; return d * (fi.nz * ax - fi.nx * az); }
// place pour se hisser au-dessus du bord ?
function roomAbove(W, b, f, u) { facePoint(b, f, u, -0.4, b.py + b.hh + 1.0, FP); return !inside(W, FP.x, FP.y, FP.z); }
const atkHit = (p) => (p.pK ? P.KICK_HIT : p.pSide ? 0.26 : 0.2); // instant de l'impact du coup en cours
function punchHit(W, p, m) {
  if (!m || W.crazy || (W.alone && !W.free) || W.solo || m.ko || m.downT > 0) return;
  if (m.st !== ST.GROUND && m.st !== ST.AIR) return; // accroché, en paroi, en liane : on ne le décroche pas d'un coup
  const dx = m.x - p.x, dz = m.z - p.z, h = Math.hypot(dx, dz), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  if (h > (p.pK ? P.KICK_R : P.PUNCH_R) || Math.abs(m.y - p.y) > 1.3 || (h > 0.2 && (dx * fx + dz * fz) / h < 0.35)) return;
  const ux = h > 0.2 ? dx / h : fx, uz = h > 0.2 ? dz / h : fz;
  const V = p.pK ? P.KICK_V : P.PUNCH_V; m.vx = ux * V + p.vx * 0.3; m.vz = uz * V + p.vz * 0.3; m.vy = p.pK ? P.KICK_VY : P.PUNCH_VY; toAir(m); m.coy = 0; m.noCut = true;
  m.knock = 0.9; m.ko = true; m.grabCd = 0.6; m.hang = m.climb = m.mantle = null; m.cup = false; m.pT = null;
  ev(W, 'punch', { p: p.id, v: m.id, side: p.pSide, kick: p.pK, x: m.x, y: m.y + (p.pK ? 1.15 : 1.55), z: m.z, ux, uz });
}
// TACLE : la glissade fauche les grimpeurs DEBOUT sur le sol devant soi (un saut bien placé l'évite). Le tacleur perd de l'élan, la victime est projetée puis reste au sol.
function tackleHit(W, p, m) {
  if (!m || W.crazy || W.solo || (W.alone && !W.free) || m.ko || m.downT > 0 || m.st !== ST.GROUND || (p.tackleCd || 0) > 0 || p.sv < P.RUN * 0.9) return;
  const dx = m.x - p.x, dz = m.z - p.z, h = Math.hypot(dx, dz);
  if (h > P.TACKLE_R || Math.abs(m.y - p.y) > 0.6 || (h > 0.15 && (dx * p.sdx + dz * p.sdz) / h < 0.35)) return;
  m.vx = p.sdx * P.TACKLE_V + (p.gvx || 0); m.vz = p.sdz * P.TACKLE_V + (p.gvz || 0); m.vy = P.TACKLE_VY; toAir(m); m.coy = 0; m.noCut = true;
  m.knock = 0.7; m.ko = true; m.grabCd = 0.6; m.hang = m.climb = m.mantle = null; m.cup = false; m.pT = null; m.slideT = 0;
  p.sv *= 0.55; p.tackleCd = P.TACKLE_CD;
  ev(W, 'tackle', { p: p.id, v: m.id, x: m.x, y: m.y + 0.4, z: m.z, ux: p.sdx, uz: p.sdz });
}
// le grimpeur p saute dans les mains jointes de son partenaire (mains depuis au moins 0,15 s, à portée, pieds à hauteur du sol ou des mains)
function cupBoost(W, p, m) {
  if (!m || !m.cup || m.cupT < 0.15 || p.cup || (p.st === ST.AIR && p.cupUsed)) return false; // en l'air : une seule relance avant de retoucher le sol
  const h = Math.hypot(p.x - m.x, p.z - m.z), dy = p.y - m.y;
  if (h > P.CUP_R || dy < -0.4 || dy > 1.4 || (p.st === ST.AIR && p.vy > 1)) return false;
  p.buf = 0; p.vy = P.CUP_V + Math.max(0, m.gvy || 0); toAir(p); p.cupUsed = true; p.coy = 0; p.cut = false; p.jHeld = true; p.noCut = true;
  m.pushT = 0.4; ev(W, 'boost', { p: p.id, by: m.id, x: m.x, y: m.y + 0.8, z: m.z });
  return true;
}
function toAir(p) { p.st = ST.AIR; p.stT = 0; p.vx += 0; p.onMate = false; p.gb = -1; p.gvx = p.gvy = p.gvz = 0; }
function setGround(W, p, b) {
  if (p.st === ST.AIR) {
    const drop = p.peakY - p.y;
    p.land = 0.25; ev(W, 'land', { p: p.id, x: p.x, y: p.y, z: p.z, v: -p.vy, h: drop });
    if (drop > 9) { W.falls++; ev(W, 'fall', { p: p.id, h: drop }); }
    if (drop > 8 && p.y < (W.level.checkpoints[W.cp]?.y ?? -Infinity) - 6) p.fell = true; // retombé bien plus bas que son point de passage (retour auto si les deux le sont)
    p.peakY = p.y;
  }
  const vy = p.vy; p.noCut = false; p.lgx = p.x; p.lgy = p.y; p.lgz = p.z; // dernier appui (anti-chute du mode test)
  p.st = ST.GROUND; p.gb = b.i; p.gvx = b.vx; p.gvy = b.vy; p.gvz = b.vz; p.onMate = false;
  if (b.move && b.move.k === 'rot') { // vitesse du point sous les pieds sur un plateau tournant
    const dx = p.x - b.px, dz = p.z - b.pz; p.gvx = b.vx + b.wy * dz; p.gvz = b.vz - b.wy * dx;
  }
  if (vy < p.gvy) p.vy = p.gvy;
  if (b.crumble) { const k = W.cr[b.i]; if (k.s === 0) { k.s = 1; k.t = 0; ev(W, 'crack', { b: b.i }); } }
  if (b.launch && !b.move) { p.vy = b.launch; toAir(p); p.coy = 0; p.noCut = true; ev(W, 'launch', { p: p.id, x: p.x, y: p.y, z: p.z }); } // tremplin
}
/* ------------------------------ vent, lianes ------------------------------ */
const WA = { x: 0, y: 0, z: 0, g: 0.35 };
// courants d'air / cascades : accélération (m/s²) des zones qui contiennent le point ; « pulse » = rafales intermittentes
export function windAt(W, x, y, z, o = { x: 0, y: 0, z: 0 }) {
  o.x = o.y = o.z = 0; o.g = 0.35; const t = W.tick * DT;
  for (const w of W.level.winds || []) {
    if (Math.abs(x - w.x) > w.hw || Math.abs(y - w.y) > w.hh || Math.abs(z - w.z) > w.hd) continue;
    if (w.pulse && Math.sin((2 * Math.PI * t) / w.pulse + (w.ph || 0)) < 0) continue;
    o.x += w.acc[0]; o.y += w.acc[1]; o.z += w.acc[2]; if (w.ground != null) o.g = w.ground;
  }
  return o;
}
export const windOn = (W, w) => !w.pulse || Math.sin((2 * Math.PI * W.tick * DT) / w.pulse + (w.ph || 0)) >= 0;
// liane libre à portée de main (une seule personne par liane)
function findRope(W, p, mate) {
  const ropes = W.level.ropes; if (!ropes) return null;
  const hy = p.y + 1.9;
  for (let i = 0; i < ropes.length; i++) {
    const r = ropes[i];
    if (mate?.st === ST.ROPE && mate.rope.i === i) continue;
    if ((p.ropeCd > 0 && p.lastRope === i) || hy > r.y - 0.4 || hy < r.y - r.len) continue;
    if (Math.hypot(p.x - r.x, p.z - r.z) > P.ROPE_REACH + (r.y - hy) * 0.05) continue;
    return { i, s: Math.max(0.8, r.y - hy) };
  }
  return null;
}
// balancement : la main reste sur une sphère de rayon s autour du point d'attache ; on pompe avec la direction, Maj = monter, C = lâcher
function stepRope(W, p, I, wx, wz, wl, dPress) {
  const r = W.level.ropes[p.rope.i], dt = DT;
  let hx = p.x, hy = p.y + 1.9, hz = p.z;
  p.vy -= P.G_DOWN * dt;
  if (wl > 0.05) { const cur = p.vx * wx + p.vz * wz, add = clamp(P.ROPE_VMAX - cur, 0, P.ROPE_PUMP * dt); p.vx += wx * add; p.vz += wz * add; }
  if (p.brace && p.rope.s > 0.9 && p.sta > 0) { p.rope.s -= P.ROPE_CLIMB * dt; p.sta -= P.STA_ROPE * dt; }
  p.sta -= P.ROPE_STA * dt;
  hx += p.vx * dt; hy += p.vy * dt; hz += p.vz * dt;
  const dx = hx - r.x, dy = hy - r.y, dz = hz - r.z, d = Math.hypot(dx, dy, dz) || 1;
  if (d > p.rope.s) { // corde tendue : retour sur la sphère, la vitesse radiale disparaît
    const k = p.rope.s / d; hx = r.x + dx * k; hy = r.y + dy * k; hz = r.z + dz * k;
    const nx = dx / d, ny = dy / d, nz = dz / d, vn = p.vx * nx + p.vy * ny + p.vz * nz;
    if (vn > 0) { p.vx -= vn * nx; p.vy -= vn * ny; p.vz -= vn * nz; }
  }
  p.x = hx; p.y = hy - 1.9; p.z = hz;
  if (collidePlayer(W, p, false)) { /* contre un mur : la vitesse a été coupée par la collision */ }
  if (wl > 0.1) p.yaw = Math.atan2(wx, wz);
  const let_ = () => { p.st = ST.AIR; p.stT = 0; p.lastRope = p.rope.i; p.rope = null; p.ropeCd = 0.45; p.grabCd = 0.15; };
  if (dPress || p.sta <= 0) { let_(); ev(W, 'let', { p: p.id }); }
  else if (p.buf > 0 && p.stT > 0.12) { p.buf = 0; let_(); p.vx += wx * 2.2; p.vz += wz * 2.2; p.vy = Math.max(p.vy, 0) + P.ROPE_JUMP; p.jHeld = true; p.cut = false; ev(W, 'jump', { p: p.id, rope: 1 }); }
  else if (p.y < r.y - r.len - 1.95) let_(); // glissé au bout de la corde
}

/* ------------------------------ chaîne ------------------------------ */
// Modèle : les maillons (PBD, bouts épinglés aux grimpeurs) donnent la FORME de la chaîne, qui s'enroule sur les bords du décor ;
// la FORCE passe par une contrainte de poulie sur la longueur du chemin : si le chemin dépasse la longueur de chaîne, chaque grimpeur
// est tiré le long de la chaîne (direction de son premier tronçon), au prorata de sa masse inverse.
// accroché = ancre, arc-bouté = presque ancre, au sol = lourd (le sol tient la verticale), en l'air = libre
function invMass(p) {
  if (p.st === ST.HANG || p.st === ST.CLIMB || p.st === ST.MANTLE) return 0;
  if (p.st === ST.GROUND) return p.brace ? 0 : p.haul ? 0.15 : 0.5; // qui tire a les pieds plantés, sans être une ancre
  if (p.st === ST.ROPE) return 0.3; // la liane porte presque tout son poids
  return 1;
}
const PIV = [0, 0], EP = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], DIR = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
function solveNodes(W, seg, iters) {
  const C = W.ch, N = CH.N;
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < N; i++) {
      const a = C[i], b = C[i + 1], wa = i === 0 ? 0 : 1, wb = i + 1 === N ? 0 : 1, ws = wa + wb;
      if (!ws) continue;
      let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d = Math.hypot(dx, dy, dz);
      if (d <= seg || d < 1e-9) continue; // une chaîne ne travaille qu'en traction
      const c = (d - seg) / d / ws; dx *= c; dy *= c; dz *= c;
      a.x += dx * wa; a.y += dy * wa; a.z += dz * wa; b.x -= dx * wb; b.y -= dy * wb; b.z -= dz * wb;
    }
  }
}
function nodeCollide(W) {
  const C = W.ch, N = CH.N;
  for (let i = 1; i < N; i++) {
    const n = C[i];
    const b = inside(W, n.x, n.y, n.z, 0.05, true); // la chaîne passe entre les barreaux d'une herse
    if (!b) { n.hit = 0; continue; }
    local(b, n.x, n.z, L);
    const ly = n.y - b.py, c = [[b.hw + 0.05 - L.lx, 1, 0, 0], [L.lx + b.hw + 0.05, -1, 0, 0], [b.hd + 0.05 - L.lz, 0, 0, 1], [L.lz + b.hd + 0.05, 0, 0, -1], [b.hh + 0.05 - ly, 0, 1, 0], [ly + b.hh + 0.05, 0, -1, 0]];
    let k = c[0]; for (const e of c) if (e[0] < k[0]) k = e;
    const nx = b.c * k[1] + b.s * k[3], nz = -b.s * k[1] + b.c * k[3];
    n.x += nx * k[0]; n.y += k[2] * k[0]; n.z += nz * k[0]; n.hit = k[2] > 0 ? 2 : 1;
    // frottement : la vitesse tangentielle du maillon est fortement amortie au contact, il suit la plateforme qui le porte
    const f = k[2] > 0 ? 0.25 : 0.04; // posée sur un dessus : frotte (retient) ; le long d'un mur : glisse presque librement
    n.ox += (n.x - n.ox - b.vx * DT) * f; n.oy += (n.y - n.oy - b.vy * DT) * f; n.oz += (n.z - n.oz - b.vz * DT) * f;
  }
}
// point de pivot vu du bout k : premier maillon posé sur un dessus ou un bord (la chaîne s'y enroule), sinon l'autre bout
function pivotIdx(C, k) {
  const N = C.length - 1;
  if (k) { for (let j = N - 1; j > 0; j--) if (C[j].hit === 2) return j; return 0; }
  for (let j = 1; j < N; j++) if (C[j].hit === 2) return j; return N;
}
// chaîne tendue : les maillons entre le bout et son pivot se remettent en ligne droite (affichage et frottements cohérents)
function straighten(C, k, j, f) {
  const N = C.length - 1, e = C[k ? N : 0], q = C[j], n = Math.abs((k ? N : 0) - j);
  for (let m = 1; m < n; m++) {
    const i = k ? N - m : m, t = m / n, c = C[i];
    c.x += (e.x + (q.x - e.x) * t - c.x) * f; c.y += (e.y + (q.y - e.y) * t - c.y) * f; c.z += (e.z + (q.z - e.z) * t - c.z) * f;
  }
}
// longueur du chemin TENDU : des bouts aux maillons posés sur un bord (pivots), en ligne droite entre eux.
// Une chaîne qui pend a des maillons à pleine longueur mais du mou : seul ce chemin dit si elle tire vraiment.
function tautLen(C) {
  let s = 0, prev = C[0];
  for (let i = 1; i < C.length - 1; i++) if (C[i].hit === 2) { s += Math.hypot(C[i].x - prev.x, C[i].y - prev.y, C[i].z - prev.z); prev = C[i]; }
  const e = C[C.length - 1]; return s + Math.hypot(e.x - prev.x, e.y - prev.y, e.z - prev.z);
}
const pathLen = (C) => { let s = 0; for (let i = 0; i < C.length - 1; i++) s += Math.hypot(C[i + 1].x - C[i].x, C[i + 1].y - C[i].y, C[i + 1].z - C[i].z); return s; };
function stepChain(W) {
  const C = W.ch, N = CH.N, [A, B] = W.pl;
  // longueur utile : raccourcie quand un grimpeur remonte la chaîne, se redéroule quand elle est lâche
  // « Tirer » : celui qui tire ravale la chaîne, la poulie rend la différence aux deux bouts selon leurs masses (le tireur est donc entraîné aussi)
  if (A.haul || B.haul) W.Lc = Math.max(CH.MIN, W.Lc - CH.HAUL * DT);
  else if (A.ropeUp || B.ropeUp) W.Lc = Math.max(CH.MIN, W.Lc - CH.CLIMB * DT);
  // personne ne pend : la chaîne ravalée se redonne (on n'est pas retenus court après un sauvetage)
  else if (W.Lc < W.L && (W.taut < 0.35 || (!A.dangling && !B.dangling))) W.Lc = Math.min(W.L, W.Lc + CH.GROW * DT);
  const seg = W.Lc / N, g = P.G_DOWN * CH.NODE_G * DT * DT;
  for (let i = 1; i < N; i++) {
    const n = C[i], vx = (n.x - n.ox) * CH.DAMP, vy = (n.y - n.oy) * CH.DAMP, vz = (n.z - n.oz) * CH.DAMP;
    n.ox = n.x; n.oy = n.y; n.oz = n.z; n.x += vx; n.y += vy - g; n.z += vz;
  }
  const ends = [A, B], w = [invMass(A), invMass(B)];
  const pin = () => { for (let k = 0; k < 2; k++) { const p = ends[k], n = C[k ? N : 0]; n.x = p.x; n.y = p.y + P.WAIST; n.z = p.z; } };
  pin();
  for (let k = 0; k < 2; k++) { EP[k].x = ends[k].x; EP[k].y = ends[k].y; EP[k].z = ends[k].z; }
  // vitesse relative des deux bouts le long de la chaîne (secousse)
  const dxAB = B.x - A.x, dyAB = B.y - A.y, dzAB = B.z - A.z, dAB = Math.hypot(dxAB, dyAB, dzAB) || 1;
  const relV = ((B.vx - A.vx) * dxAB + (B.vy - A.vy) * dyAB + (B.vz - A.vz) * dzAB) / dAB;
  solveNodes(W, seg, CH.ITER);
  nodeCollide(W);
  // contrainte de poulie : excès de longueur du chemin, rendu aux grimpeurs le long de leur premier tronçon
  if (w[0] + w[1] === 0 && A.st === ST.GROUND && B.st === ST.GROUND) { w[0] = w[1] = 0.05; } // deux arc-boutés : la chaîne reste dure
  // l'un debout sur l'autre (courte échelle) : la chaîne pend entre eux, aucune traction (sinon elle soulève celui du dessous et ils s'envolent)
  const vAB = Math.abs(A.y - B.y), stacked = Math.hypot(A.x - B.x, A.z - B.z) < P.R * 2 + 0.15 && vAB > 1.2 && vAB < 2.3;
  if (stacked) w[0] = w[1] = 0;
  const ex = tautLen(C) - W.Lc, ws = w[0] + w[1];
  let corr = 0;
  if (ex > 0 && ws > 0) {
    for (let k = 0; k < 2; k++) { // direction de la chaîne au départ de chaque bout : vers le point de pivot (bord où elle s'enroule, ou l'autre bout)
      const e = C[k ? N : 0], j = PIV[k] = pivotIdx(C, k), n = C[j], d = DIR[k];
      d.x = n.x - e.x; d.y = n.y - e.y; d.z = n.z - e.z;
      if (ends[k].st === ST.GROUND) d.y = Math.max(0, d.y) * 0.25; // au sol, on est surtout traîné à l'horizontale
      const l = Math.hypot(d.x, d.y, d.z) || 1; d.x /= l; d.y /= l; d.z /= l;
    }
    const lam = ex / ws;
    for (let k = 0; k < 2; k++) { // position : l'excès est rendu au prorata des masses inverses
      const p = ends[k], m = lam * w[k]; if (!m) continue;
      const d = DIR[k]; p.x += d.x * m; p.y += d.y * m; p.z += d.z * m; corr += m;
      if (p.st === ST.GROUND && d.y * m > 0.006) toAir(p); // soulevé du sol par la chaîne
    }
    // vitesse : contrainte inélastique le long de la chaîne (vitesse d'éloignement annulée, partagée selon les masses = remorquage)
    const sep = -(A.vx * DIR[0].x + A.vy * DIR[0].y + A.vz * DIR[0].z) - (B.vx * DIR[1].x + B.vy * DIR[1].y + B.vz * DIR[1].z);
    if (sep > 3 && W.tick - (W.jerkT || 0) > 30) { W.jerkT = W.tick; ev(W, 'jerk', { v: sep, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 + 1, z: (A.z + B.z) / 2 }); }
    if (sep > 0) {
      const li = Math.min(sep, CH.MAXDV) / ws;
      for (let k = 0; k < 2; k++) { const p = ends[k], d = DIR[k], m = li * w[k]; p.vx += d.x * m; p.vy += d.y * m; p.vz += d.z * m; }
    }
    pin(); for (let k = 0; k < 2; k++) straighten(C, k, PIV[k], 0.3); solveNodes(W, seg, 4);
  }
  // tension (0..1) lissée, pour l'interface, les sons et l'escalade
  const t = Math.max(clamp(corr / DT / 3, 0, 1), clamp((tautLen(C) / W.Lc - 0.9) / 0.1, 0, 1));
  const was = W.taut;
  W.ten += (t - W.ten) * Math.min(1, DT * 14);
  W.taut = t;
  if (t < 0.15 && was > 0.6) ev(W, 'slack', {});
  // qui pend sous l'autre ? (pour hisser, s'arc-bouter, grimper à la chaîne, compter les sauvetages)
  for (let k = 0; k < 2; k++) {
    const p = ends[k], o = ends[1 - k];
    const anchored = o.st !== ST.AIR;
    const dang = p.st === ST.AIR && anchored && W.taut > 0.5 && p.y < o.y - 0.4;
    p.dangling = dang;
    if (dang) { if (p.dangle === 0) p.anchorY = o.y; p.dangle += DT; }
    else if (p.dangle > 0) {
      if (p.dangle > 0.8 && p.st !== ST.AIR && p.y >= p.anchorY - 2.5) { W.saves++; ev(W, 'save', { p: p.id, x: p.x, y: p.y, z: p.z }); }
      if (p.st !== ST.AIR || p.dangle > 0) p.dangle = p.st === ST.AIR ? p.dangle : 0;
    }
    // le partenaire qui tient : direction de la traction (horizontale) et charge, pour le sol et l'endurance
    const n1 = C[k ? N - 1 : 1], e = C[k ? N : 0];
    const hx = n1.x - e.x, hz = n1.z - e.z, hl = Math.hypot(hx, hz) || 1;
    const load = o.dangling ? W.taut : 0;
    p.load = load; p.pullX = hx / hl; p.pullZ = hz / hl;
  }
}

/* ------------------------------ état du monde ------------------------------ */
function stepMechanisms(W) {
  for (const id in W.cr) { // plateformes qui s'effondrent : tremblent, tombent, reviennent
    const k = W.cr[id], b = W.bodies[id];
    if (k.s === 1) { k.t += DT; if (k.t > (b.crumble.t || 0.8)) { k.s = 2; k.t = 0; ev(W, 'collapse', { b: +id, x: b.px, y: b.py, z: b.pz }); } }
    else if (k.s === 2) { k.t += DT; if (k.t > (b.crumble.back || 4.5)) { k.s = 0; k.t = 0; ev(W, 'restore', { b: +id }); } }
  }
  for (const id in W.sk) { // passerelles qui s'enfoncent sous le poids puis remontent (ressort amorti)
    const k = W.sk[id], b = W.bodies[id];
    let load = 0; for (const p of W.pl) if (p.st === ST.GROUND && p.gb === +id) load++;
    const target = -(b.sink.d || 0.5) * load;
    k.v += ((target - k.y) * (b.sink.k || 40) - k.v * 7) * DT; k.y += k.v * DT;
    if (k.y < -(b.sink.max || 1.6)) { k.y = -(b.sink.max || 1.6); k.v = 0; }
  }
  // plaques de pression : actives tant qu'assez de grimpeurs se tiennent dessus (need = 2 : les deux ensemble)
  const onB = (b) => { let n = 0; for (const p of W.pl) if (p.st === ST.GROUND && p.gb === b.i) n++; return n; };
  for (const b of W.bodies) if (b.plate) {
    const on = onB(b) >= (b.plate.need || 1), was = !!W.sw[b.plate.id];
    if (on !== was) { W.sw[b.plate.id] = on; ev(W, on ? 'press' : 'release', { id: b.plate.id, x: b.px, y: b.py + b.hh, z: b.pz }); }
  }
  // herses / portes : s'ouvrent quand leurs interrupteurs sont actifs (tous, ou au moins un), se referment sinon
  for (const b of W.bodies) if (b.door) {
    const ids = b.door.open || [], ok = b.door.any || W.alone ? ids.some((i) => W.sw[i]) : ids.every((i) => W.sw[i]); // solo : une plaque suffit
    const o = W.dr[b.i] || 0, n = clamp(o + (ok ? 1 : -(b.door.close ?? 0.6)) * (b.door.speed || 1.4) * DT, 0, 1);
    if (n > 0 && o === 0) ev(W, 'door', { b: b.i, open: 1 }); else if (n === 0 && o > 0) ev(W, 'door', { b: b.i, open: 0 });
    W.dr[b.i] = n;
  }
  for (const b of W.bodies) if (b.herse) stepHerse(W, b);
  for (const id in W.db) stepBridge(W, id);
  for (const m of BIOMES) m.step?.(W, X);
  // contrepoids : deux plateaux liés ; le plus chargé descend (ressort amorti), l'autre monte d'autant
  for (const id in W.cw) {
    const k = W.cw[id]; let load = 0, d = 2;
    for (const b of W.bodies) if (b.cw && b.cw.id === id) { load += onB(b) * b.cw.side * (b.cw.k || 1); d = b.cw.d || d; if (W.alone && b.cw.side < 0 && onB(b)) load += 2 * (b.cw.k || 2); } // solo : le plateau où l'on monte s'élève (le partenaire absent « charge » l'autre) // k = bras de levier (un grimpeur sur le long bras soulève l'autre)
    const target = clamp(-load * d, -d, d); // côté +1 chargé -> y négatif (descend)
    k.v += ((target - k.y) * 10 - k.v * 5) * DT; k.y = clamp(k.y + k.v * DT, -d, d);
  }
  // mécanismes commandés : leur temps n'avance que lorsque l'interrupteur est actif
  for (const b of W.bodies) if (b.move?.gate) { W.gtp[b.i] = W.gt[b.i] || 0; if (W.sw[b.move.gate]) W.gt[b.i] = (W.gt[b.i] || 0) + DT; }
}
/* ------------------------------ herses et lourdes portes ------------------------------ */
// cycle : ouverte -> alerte (cliquetis, elle tremble) -> chute (lente au treuil, ou lâchée d'un coup) -> fermée -> remontée au treuil.
// mode 'cycle' (périodique), 'trigger' (un grimpeur entre dans la zone), 'switch' (ouverte tant que des leviers / plaques sont actifs).
// Sécurité : elle ne descend jamais sur un grimpeur engagé dessous, elle s'arrête au-dessus de sa tête (bloquée) et repart quand il sort.
export const HP = { OPEN: 0, WARN: 1, FALL: 2, SHUT: 3, RISE: 4 };
export const spanOf = (b) => b.herse?.lift ?? b.h + 0.15; // course verticale (levée = posée + span)
function stepHerse(W, b) {
  const H = b.herse, s = W.hs[b.i], span = spanOf(b), base = b.y - b.hh; let o = W.dr[b.i] ?? 1;
  s.t += DT;
  const go = (ph) => { s.ph = ph; s.t = 0; s.v = 0; ev(W, 'herse', { b: b.i, ph, x: b.px, y: base, z: b.pz }); };
  if (H.mode === 'switch') {
    const ids = H.open || [], ok = H.any || W.alone ? ids.some((i) => W.sw[i]) : ids.every((i) => W.sw[i]);
    if (ok && (s.ph === HP.SHUT || s.ph === HP.FALL || s.ph === HP.WARN)) go(HP.RISE);
    else if (!ok && (s.ph === HP.OPEN || s.ph === HP.RISE)) go(HP.WARN);
  }
  const zone = H.zone || [b.px - 3.5, b.px + 3.5];
  const near = () => W.pl.some((p) => p.x > zone[0] && p.x < zone[1] && Math.abs(p.z - b.pz) < b.hd + 2.5 && p.y > base - 2 && p.y < base + b.h + 1.5);
  switch (s.ph) {
    case HP.OPEN: o = 1;
      if ((H.mode === 'cycle' && s.t >= (H.open ?? 3)) || (H.mode === 'trigger' && s.t >= (H.rearm ?? 0.8) && near())) go(HP.WARN);
      break;
    case HP.WARN: if (s.t >= (H.warn ?? 0.9)) go(HP.FALL); break;
    case HP.FALL: {
      s.v = H.fall === 'slam' ? Math.min(s.v + 34 * DT, 18) : (H.speed || 1.4); // lâchée : chute libre ; au treuil : vitesse constante
      let n = o - (s.v * DT) / span, jam = 0;
      for (const p of W.pl) { // un grimpeur sous la herse : elle s'arrête juste au-dessus de lui
        if (Math.abs(p.x - b.px) > b.hw + P.R || Math.abs(p.z - b.pz) > b.hd + P.R || p.y > base + o * span + 0.1) continue;
        const need = (p.y + P.H + 0.06 - base) / span; if (need > n) { n = Math.min(o, need); jam = 1;
          // pilon (crush) : il ne s'arrête pas sur la tête, il rejette le grimpeur sur le côté (recul contrôlé, sans le traverser)
          if (H.crush && p.knock <= 0) { const sx = Math.sign(p.x - b.px) || (H.crush > 0 ? 1 : -1); p.vx = sx * P.KNOCK; p.vy = 5; p.knock = 0.45; if (p.st !== ST.AIR) { p.st = ST.AIR; p.stT = 0; p.hang = p.climb = p.mantle = null; } ev(W, 'hit', { p: p.id, x: p.x, y: p.y + 1, z: p.z, v: 6 }); } }
      }
      if (jam && !s.jam) ev(W, 'jam', { b: b.i, x: b.px, y: base + n * span, z: b.pz });
      s.jam = jam; if (jam) s.v = 0;
      if (n <= 0) { n = 0; go(HP.SHUT); }
      o = n; break;
    }
    case HP.SHUT: o = 0; if (H.mode !== 'switch' && s.t >= (H.hold ?? 2)) go(HP.RISE); break;
    case HP.RISE: o = Math.min(1, o + DT / (H.rise ?? 3)); if (o >= 1) go(HP.OPEN); break;
  }
  W.dr[b.i] = o;
}
/* ------------------------------ pont-levis ------------------------------ */
// abaissé tant que ses leviers / plaques sont actifs ; « stay » : il se relève seul au bout de stay s (le levier revient).
// Il descend lourdement (accélère, choc en bas) et remonte lentement au treuil.
function stepBridge(W, id) {
  const D = W.db[id], segs = ((W._dbs ||= {})[id] ||= W.bodies.filter((b) => b.dbseg?.id === id)), S = segs[0].dbseg, C = S.ctl || {};
  const ids = C.open || [], ok = C.any || W.alone ? ids.some((i) => W.sw[i]) : ids.length ? ids.every((i) => W.sw[i]) : true;
  const tgt = ok ? 0 : S.up, was = D.mv;
  if (Math.abs(D.a - tgt) < 1e-4) { D.v = 0; D.mv = 0; }
  else if (tgt < D.a) { D.v = Math.min(D.v + (C.drop ?? 1.6) * DT, C.vmax ?? 1.1); D.a = Math.max(tgt, D.a - D.v * DT); D.mv = -1; if (D.a === tgt) ev(W, 'bridge', { id, end: 'down', v: D.v, x: S.hx + S.side * S.len / 2, y: S.top, z: segs[0].pz }); }
  else { D.v = C.lift ?? 0.4; D.a = Math.min(tgt, D.a + D.v * DT); D.mv = 1; if (D.a === tgt) ev(W, 'bridge', { id, end: 'up', x: S.hx, y: S.top + 2, z: segs[0].pz }); }
  if (D.mv && !was) ev(W, 'bridge', { id, start: D.mv, x: S.hx, y: S.top, z: segs[0].pz });
  if (ok && D.a < 0.02 && C.stay) { D.t += DT; if (D.t > C.stay) { D.t = 0; for (const i of ids) if (W.sw[i]) { W.sw[i] = false; ev(W, 'release', { id: i }); } } } else D.t = 0;
}
function shadowMate(W) {
  const [A, B] = W.pl;
  Object.assign(B, { x: A.x, y: A.y, z: A.z, vx: A.vx, vy: A.vy, vz: A.vz, st: A.st === ST.GROUND ? ST.GROUND : ST.AIR, gb: A.gb, hang: null, climb: null, mantle: null, rope: null, dangling: false, brace: false, haul: false, sta: 1 });
  A.dangling = false; A.load = 0; W.taut = 0; W.ten = 0; W.Lc = W.L;
  for (const n of W.ch) { n.x = n.ox = A.x; n.y = n.oy = A.y + P.WAIST; n.z = n.oz = A.z; }
}
// outils du moteur prêtés aux modules de monde (core/biomes)
const onBody = (W, b) => { let n = 0; for (const p of W.pl) if (p.st === ST.GROUND && p.gb === b.i) n++; return n; };
const X = { ST, P, DT, HP, CH, ev: (W, k, o) => ev(W, k, o), clamp, onB: onBody, inside, groundBelow, bounds, spanOf, toAir: (p) => toAir(p) };

/* ------------------------------ mode CRAZY : arène, fusil à verrou ------------------------------ */
export const CZ = { LIMIT: 15, TIME: 300, RESPAWN: 3, PROT: 2, SHOULDER: 0.75, CAMUP: 0.35, BORE: 0.12, WALL_SLIDE: 3.2, WALL_CD: 0.22, WJ_MAX: 3, SCOPE_SLOW: 0.55, ZOOM_T: 0.3, SCOPE_UP: -0.068, WJ_OUT: 6.4, WJ_UP: 8.6,
  // phases du cycle de culasse (s depuis le tir) et du rechargement (s depuis son début) : chacune émet un événement de son propre bruit
  BOLT: [[0.10, 'up'], [0.22, 'back'], [0.42, 'eject'], [0.60, 'fwd'], [0.80, 'down']], RELOAD_AT: [[0.25, 'open'], [0.85, 'clip'], [1.85, 'push'], [2.3, 'close']] };
export const crazyEye = (p) => (p.slideT > 0 || p.crawl ? KAR.EYE_SLIDE : KAR.EYE);
// droite de l'écran pour un cap donné (caméra tournée vers (sin yaw, cos yaw), y vers le haut)
export const rightOf = (yaw) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });
// dispersion angulaire (rad) : nulle en visant à l'arrêt, petite à la hanche, forte en courant ou en l'air
export function crazySpread(p) {
  const sp = Math.hypot(p.vx - (p.gvx || 0), p.vz - (p.gvz || 0)); // la vitesse due à une plateforme mobile ne compte pas
  const base = p.scope ? 0 : 0.006, mv = Math.min(1, sp / P.RUN) * (p.scope ? 0.012 : 0.03), air = p.st === ST.AIR ? (p.scope ? 0.03 : 0.045) : 0;
  return base + mv + air;
}
const WD = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071], [-0.7071, -0.7071]];
// normale (horizontale, unitaire, vers l'extérieur du mur) si un mur touche le grimpeur, sinon null
function wallNormal(W, p) {
  let nx = 0, nz = 0;
  for (const [dx, dz] of WD) for (const h of [0.5, 1.25]) if (inside(W, p.x + dx * (P.R + 0.14), p.y + h, p.z + dz * (P.R + 0.14), 0)) { nx -= dx; nz -= dz; break; }
  const l = Math.hypot(nx, nz); return l > 0.01 ? { x: nx / l, z: nz / l } : null;
}
function wallJump(W, p, wx, wz) {
  if ((p.wjN || 0) >= CZ.WJ_MAX) return false; // pas d'escalade infinie d'un mur : trois sauts muraux par envol
  const n = wallNormal(W, p); if (!n) return false;
  p.wjN = (p.wjN || 0) + 1; p.buf = 0; p.wjCd = CZ.WALL_CD; p.cut = false; p.jHeld = true; p.dj = false;
  const dn = wx * n.x + wz * n.z, sx = wx - n.x * dn, sz = wz - n.z * dn; // on se laisse orienter le long du mur seulement
  p.vx = n.x * CZ.WJ_OUT + sx * 2.2; p.vz = n.z * CZ.WJ_OUT + sz * 2.2; p.vy = CZ.WJ_UP;
  ev(W, 'jump', { p: p.id, x: p.x, y: p.y, z: p.z, wall: 1, nx: n.x, nz: n.z });
  return true;
}
function resetCombat(p) {
  p.hp = KAR.HP; p.ammo = KAR.AMMO; p.cd = 0; p.cyc = 0; p.ejected = true; p.rl = -1; p.scope = false; p.dead = 0; p.lastBy = -1; p.lastByT = 0;
}
// la place d'apparition la plus éloignée des adversaires vivants (égalité : la première) ; les points de passage du parcours servent de places
function pickSpawn(W, p) {
  const cps = W.level.checkpoints, foes = W.pl.filter((q) => q !== p && !q.dead);
  let best = 0, bd = -1;
  cps.forEach((c, i) => { let d = 1e9; for (const q of foes) d = Math.min(d, Math.hypot(q.x - c.x, q.z - c.z) + Math.abs(q.y - c.y) * 0.5); if (!foes.length) d = (i * 7 + p.id * 5) % cps.length; if (d > bd) { bd = d; best = i; } });
  return cps[best];
}
function placeAt(W, p, c) {
  Object.assign(p, { x: c.x, y: c.y, z: c.z, vx: 0, vy: 0, vz: 0, st: ST.GROUND, stT: 0, gb: -1, gvx: 0, gvy: 0, gvz: 0, hang: null, climb: null, mantle: null, rope: null, brace: false, knock: 0, ko: false, downT: 0, pT: null,
    slideT: 0, crawl: false, recT: 0, sta: 1, yaw: c.yaw ?? Math.PI, ay: c.yaw ?? Math.PI, ap: 0, peakY: c.y, onMate: false, fell: false, dj: false, wjCd: 0 });
}
function spawnCrazy(W) {
  W.pl = []; W.ch = []; W.rank = []; W.rLock = []; W.done = false; W.time = 0;
  for (let i = 0; i < W.nPl; i++) {
    const p = newPlayer(i, 0, 0, 0); p.cp = 0; p.done = false; p.kills = 0; p.deaths = 0; p.prot = CZ.PROT; resetCombat(p);
    placeAt(W, p, pickSpawn(W, p)); W.pl.push(p);
  }
  resetMechanisms(W); W.ten = 0; W.taut = 0; W.cp = 0;
}
function respawnCrazy(W, p) {
  resetCombat(p); placeAt(W, p, pickSpawn(W, p)); p.prot = CZ.PROT; ev(W, 'spawn', { p: p.id, x: p.x, y: p.y, z: p.z });
}
function killPlayer(W, v, by, head, dx, dy, dz) {
  if (v.dead > 0) return;
  v.dead = CZ.RESPAWN; v.hp = 0; v.deaths++; v.scope = false; v.rl = -1; v.cyc = 0; v.slideT = 0; v.crawl = false; v.st = ST.AIR; v.hang = v.climb = v.mantle = null;
  const k = by != null && by !== v.id ? W.pl[by] : null; if (k) k.kills++;
  ev(W, 'kill', { p: by ?? -1, v: v.id, head: head ? 1 : 0, x: v.x, y: v.y + 1, z: v.z, dx, dy, dz, w: 'kar' });
}
// premier obstacle sur un rayon : décor (boîtes) ou adversaire vivant et vulnérable ; renvoie { t, kind (0 rien, 1 décor, 2 joueur), victim, n }
function traceRay(W, p, ox, oy, oz, d, max) {
  const r = { t: max, kind: 0, victim: null, nx: 0, ny: 1, nz: 0 };
  for (const b of W.bodies) {
    if (!b.on || b.ghost || b.ex === undefined) continue;
    if (Math.abs(ox - b.px) - b.ex > max || Math.abs(oz - b.pz) - b.ez > max) continue;
    const hit = rayBody(b, ox, oy, oz, d.x, d.y, d.z, r.t); if (hit && hit.t < r.t) { r.t = hit.t; r.kind = 1; r.nx = hit.nx; r.ny = hit.ny; r.nz = hit.nz; }
  }
  let tp = -1, victim = null;
  for (const q of W.pl) {
    if (q === p || q.dead > 0 || q.prot > 0) continue;
    const Hq = q.slideT > 0 || q.crawl ? P.H * 0.55 : P.H, t = rayCapsule(ox, oy, oz, d.x, d.y, d.z, q.x, q.y + P.R, q.y + Hq - P.R, q.z, P.R + 0.08, r.t);
    if (t >= 0 && (tp < 0 || t < tp)) { tp = t; victim = q; }
  }
  if (victim && tp <= r.t) { r.t = tp; r.kind = 2; r.victim = victim; }
  return r;
}
// TIR : comme dans tout jeu à la troisième personne, la caméra (épaule décalée, derrière le tireur) vise un POINT ; la balle part du fusil vers ce point
// (ce qui est sous le viseur est touché à toute distance). Le rayon de caméra part de l'épaule + CZ.SHOULDER, au niveau des yeux.
function fireShot(W, p) {
  const ay = p.ay, ap = p.ap, sp = crazySpread(p);
  // dispersion déterministe (même tirage chez tous) : un point dans un disque autour de la visée
  const h = Math.imul(W.tick * 31 + p.id * 977 + p.ammo, 2654435761) >>> 0, a = ((h & 0xffff) / 65536) * Math.PI * 2, r = (((h >>> 16) & 0xffff) / 65536) ** 0.5 * sp;
  const d = aimDir(ay + Math.cos(a) * r, clamp(ap + Math.sin(a) * r, -1.45, 1.45)), R = rightOf(ay), eye = crazyEye(p);
  // visée à la lunette (clic droit maintenu ZOOM_T s) : le rayon de visée est l'axe de la lunette (au-dessus du canon, à droite du corps) ; sinon, l'axe de la caméra par-dessus l'épaule
  const zm = !!p.zm, cx = p.x + R.x * (zm ? CZ.BORE : CZ.SHOULDER), cy = p.y + eye + (zm ? CZ.SCOPE_UP : CZ.CAMUP), cz = p.z + R.z * (zm ? CZ.BORE : CZ.SHOULDER);
  const aimT = traceRay(W, p, cx, cy, cz, d, KAR.RANGE).t, px = cx + d.x * aimT, py = cy + d.y * aimT, pz = cz + d.z * aimT;
  // départ de la balle : au niveau du fusil, à droite du corps
  const ox = p.x + R.x * CZ.BORE, oy = p.y + eye - 0.12, oz = p.z + R.z * CZ.BORE;
  let bx = px - ox, by = py - oy, bz = pz - oz; const bl = Math.hypot(bx, by, bz);
  const db = bl > 0.6 ? { x: bx / bl, y: by / bl, z: bz / bl } : d;
  const hit = traceRay(W, p, ox, oy, oz, db, KAR.RANGE), t = hit.t, victim = hit.victim;
  const mx = ox + db.x * 0.9, my = oy + db.y * 0.9, mz = oz + db.z * 0.9; // bouche du canon (~0,9 m devant le départ)
  if (victim) {
    const hx = ox + db.x * t, hy = oy + db.y * t, hz = oz + db.z * t, Hq = victim.slideT > 0 || victim.crawl ? P.H * 0.55 : P.H, rel = (hy - victim.y) / Hq;
    const zone = rel >= KAR.HEAD_FROM ? 2 : rel < KAR.LEG_TO ? 0 : 1, dmg = zone === 2 ? KAR.DMG_HEAD : zone === 1 ? KAR.DMG_BODY : KAR.DMG_LEG;
    victim.hp -= dmg; victim.lastBy = p.id; victim.lastByT = W.time; victim.vx += db.x * 1.2; victim.vz += db.z * 1.2;
    ev(W, 'dmg', { p: p.id, v: victim.id, zone, dmg, x: hx, y: hy, z: hz, dx: db.x, dy: db.y, dz: db.z, hp: Math.max(0, victim.hp) });
    if (victim.hp <= 0) killPlayer(W, victim, p.id, zone === 2, db.x, db.y, db.z);
  }
  ev(W, 'shot', { p: p.id, x: mx, y: my, z: mz, ex: ox + db.x * t, ey: oy + db.y * t, ez: oz + db.z * t, kind: hit.kind, nx: hit.nx, ny: hit.ny, nz: hit.nz, dx: db.x, dy: db.y, dz: db.z });
}
function stepCombat(W, p, I) {
  const dt = DT;
  p.prot = Math.max(0, (p.prot || 0) - dt); p.cd = Math.max(0, p.cd - dt);
  const free = p.st === ST.GROUND || p.st === ST.AIR;
  // cycle de culasse après un tir : lever, reculer (la douille saute), avancer, verrouiller
  if (p.cyc > 0) {
    const e0 = KAR.CYCLE - p.cyc; p.cyc = Math.max(0, p.cyc - dt); const e1 = KAR.CYCLE - p.cyc;
    for (const [t, s] of CZ.BOLT) if (e0 < t && e1 >= t) {
      ev(W, 'bolt', { p: p.id, s });
      if (s === 'eject') { const R = rightOf(p.ay), d = aimDir(p.ay, p.ap), eye = crazyEye(p), h = Math.imul(W.tick + p.id * 131, 2246822519) >>> 0, j = (h & 255) / 255;
        ev(W, 'casing', { p: p.id, x: p.x + R.x * (CZ.BORE + 0.07) + d.x * 0.35, y: p.y + eye - 0.12 + d.y * 0.35, z: p.z + R.z * (CZ.BORE + 0.07) + d.z * 0.35,
          vx: R.x * (2.0 + j) + p.vx * 0.5, vy: 2.4 + ((h >>> 8) & 255) / 255, vz: R.z * (2.0 + j) + p.vz * 0.5 }); }
    }
    if (!p.cyc) p.ejected = true;
  }
  // rechargement : ouvrir la culasse, glisser la lame, pousser les cartouches, refermer
  if (p.rl >= 0) {
    if (!free) p.rl = -1; // accroché, hissé : le rechargement est interrompu
    else {
      const e0 = p.rl; p.rl += dt;
      for (const [t, s] of CZ.RELOAD_AT) if (e0 < t && p.rl >= t) ev(W, 'reload', { p: p.id, s });
      if (p.rl >= KAR.RELOAD) { p.rl = -1; p.ammo = KAR.AMMO; }
    }
  }
  p.scope = !!I.scope && free && p.rl < 0; p.scT = p.scope ? (p.scT || 0) + dt : 0; p.zm = p.scT > CZ.ZOOM_T;
  if (!free) return;
  const want = !!I.reload && p.ammo < KAR.AMMO, empty = p.ammo <= 0 && I.fire;
  if ((want || empty) && p.rl < 0 && p.cyc <= 0) { p.rl = 0; p.scope = false; }
  else if (I.fire && p.rl < 0) {
    if (p.ammo <= 0) { if (!p.dryHeld) ev(W, 'dry', { p: p.id }); }
    else if (p.cd <= 0 && p.cyc <= 0) { p.ammo--; p.cd = KAR.FIRE_CD; p.cyc = KAR.CYCLE; p.ejected = false; fireShot(W, p); }
  }
  p.dryHeld = !!I.fire;
}
function stepCrazy(W, inputs) {
  const pl = W.pl, n = pl.length;
  if (!W.started) { W.started = true; ev(W, 'go'); }
  if (!W.done) W.time += DT;
  for (let i = 0; i < n; i++) {
    const p = pl[i], I = inputs[i] || IDLE;
    if (p.dead > 0) { p.dead -= DT; p.vx = p.vz = 0; if (p.dead <= 0 && !W.done) respawnCrazy(W, p); continue; }
    p.ay = Number.isFinite(I.ay) ? I.ay : p.ay; p.ap = clamp(Number.isFinite(I.ap) ? I.ap : p.ap, -1.45, 1.45);
    const sl = p.scope ? CZ.SCOPE_SLOW : p.rl >= 0 ? 0.8 : 1;
    stepPlayer(W, p, { ...I, mx: (I.mx || 0) * sl, mz: (I.mz || 0) * sl, punch: false, kick: false, reset: false, cup: false, pull: false }, null);
    if (p.st === ST.GROUND || p.st === ST.AIR) p.yaw = p.ay; // le tireur regarde toujours où il vise
    if (p.st !== ST.AIR) p.wjN = 0;
    stepCombat(W, p, I);
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (!pl[i].dead && !pl[j].dead) collidePair(pl[i], pl[j]);
  for (const p of pl) if (!p.dead && (p.st === ST.AIR || p.st === ST.GROUND)) { const g = collidePlayer(W, p); if (g && p.st === ST.AIR && p.vy <= g.vy + 0.5) setGround(W, p, g); }
  for (const p of pl) if (!p.dead && p.y < W.level.abyss) { ev(W, 'abyss', { p: p.id }); const by = p.lastBy >= 0 && W.time - p.lastByT < 6 ? p.lastBy : null; killPlayer(W, p, by, false, 0, 0, 0); }
  if (!W.done && (pl.some((p) => p.kills >= W.limit) || W.time >= W.tmax)) {
    W.done = true; W.rank = pl.map((p) => p.id).sort((a, b) => pl[b].kills - pl[a].kills || pl[a].deaths - pl[b].deaths || a - b);
    ev(W, 'end', { rank: W.rank.slice() });
  }
  W.cp = 0; W.best = 0;
  return W;
}

function stepFree(W, inputs) {
  if (W.crazy) return stepCrazy(W, inputs);
  const pl = W.pl, n = pl.length, cps = W.level.checkpoints;
  if (!W.started && pl.some((p, i) => { const I = inputs[i] || IDLE; return Math.hypot(I.mx || 0, I.mz || 0) > 0.2 || I.jc !== p.jc; })) { W.started = true; ev(W, 'go'); }
  if (W.started && !W.done) W.time += DT;
  for (let i = 0; i < n; i++) stepPlayer(W, pl[i], inputs[i] || IDLE, nearestOther(W, pl[i]));
  collideAll(W);
  for (const p of pl) if (p.st === ST.AIR || p.st === ST.GROUND) { const g = collidePlayer(W, p); if (g && p.st === ST.AIR && p.vy <= g.vy + 0.5) setGround(W, p, g); }
  for (const m of BIOMES) m.post?.(W, X);
  for (let i = 0; i < n; i++) {
    const p = pl[i], I = inputs[i] || IDLE;
    if (!I.reset) W.rLock[i] = false; p.rHold = I.reset && !W.rLock[i] ? (p.rHold || 0) + DT : 0;
    const abyss = p.y < W.level.abyss;
    if (abyss || p.rHold > 0.5) { if (abyss) { W.falls++; ev(W, 'abyss', { p: p.id }); } else { W.resets++; W.rLock[i] = true; ev(W, 'reset', { p: p.id }); } respawnPlayer(W, p); ev(W, 'respawn', { p: p.id, cp: p.cp }); continue; }
    for (let c = p.cp + 1; c < cps.length; c++) {
      const cc = cps[c];
      if (p.st === ST.GROUND && Math.hypot(p.x - cc.x, p.z - cc.z) < cc.r && Math.abs(p.y - cc.y) < 3) {
        p.cp = c; ev(W, 'checkpoint', { p: p.id, cp: c, x: cc.x, y: cc.y, z: cc.z });
        if (cc.finish && !p.done) { p.done = true; p.finishT = W.time; W.rank.push(p.id); ev(W, 'finish', { p: p.id, time: W.time, rank: W.rank.length }); if (W.rank.length >= n) W.done = true; }
        break;
      }
    }
  }
  W.cp = Math.max(...pl.map((p) => p.cp)); W.cpMax = Math.max(W.cpMax, W.cp); W.best = Math.max(W.best, ...pl.map((p) => p.y));
  return W;
}
export function stepWorld(W, inputs) {
  W.ev.length = 0;
  W.tick++;
  updateBodies(W);
  stepMechanisms(W);
  if (W.free) return stepFree(W, inputs);
  const [A, B] = W.pl, IA = inputs[0] || IDLE, IB = inputs[1] || IDLE;
  if (!W.started && (Math.hypot(IA.mx, IA.mz) > 0.2 || Math.hypot(IB.mx, IB.mz) > 0.2 || IA.jc !== A.jc || IB.jc !== B.jc)) { W.started = true; ev(W, 'go'); }
  if (W.started && !W.done) W.time += DT;
  if (W.solo) { stepPlayer(W, A, IA, B); return W; } // banc d'essai d'un saut isolé (outil de vérification du parcours)
  if (W.alone) { // MODE TEST SOLO : un seul grimpeur, sans chaîne ; le second est son ombre (mêmes position et état) pour les points de passage et les plaques
    stepPlayer(W, A, IA, B); if (A.st === ST.AIR || A.st === ST.GROUND) { const g = collidePlayer(W, A); if (g && A.st === ST.AIR && A.vy <= g.vy + 0.5) setGround(W, A, g); }
    shadowMate(W);
  } else {
    stepPlayer(W, A, IA, B); stepPlayer(W, B, IB, A);
    collideMates(W);
    stepChain(W);
    for (const p of W.pl) if (p.st === ST.AIR || p.st === ST.GROUND) { const g = collidePlayer(W, p); if (g && p.st === ST.AIR && p.vy <= g.vy + 0.5) setGround(W, p, g); }
  }
  for (const m of BIOMES) m.post?.(W, X);
  // retour au dernier point de passage : maintenir R (les deux en local, l'un ou l'autre en ligne)
  W.rLock ||= [false, false]; // après un retour, il faut relâcher R (sinon on réapparaîtrait en boucle en le gardant enfoncé)
  for (let k = 0; k < 2; k++) { const I = inputs[k] || IDLE; if (!I.reset) W.rLock[k] = false; W.resetHold[k] = I.reset && !W.rLock[k] ? W.resetHold[k] + DT : 0; }
  if (W.noAbyss) for (const p of W.pl) if (p.y < W.level.abyss && p.lgx != null) { Object.assign(p, { x: p.lgx, y: p.lgy + 0.05, z: p.lgz, vx: 0, vy: 0, vz: 0, st: ST.AIR, hang: null, climb: null, rope: null }); layChain(W); ev(W, 'respawn', {}); }
  // TOMBÉS BIEN BAS (pas dans le vide, sur un rebord en contrebas) : quand les deux le sont et posés depuis 1,5 s, retour au point de passage
  const cpY = W.level.checkpoints[W.cp]?.y ?? -Infinity; for (const p of W.pl) if (p.fell && p.y > cpY - 3) p.fell = false; // il est remonté
  const lost = W.solo ? false : W.alone ? A.fell && A.st === ST.GROUND : A.fell && B.fell && A.st === ST.GROUND && B.st === ST.GROUND;
  W.lostT = lost ? (W.lostT || 0) + DT : 0;
  const abyss = A.y < W.level.abyss || B.y < W.level.abyss;
  if (abyss || Math.max(...W.resetHold) > (W.alone ? 0.05 : 1.0) || W.lostT > 1.5) { // solo : R réagit tout de suite ; à deux on le maintient (pas de retour par erreur)
    if (abyss) { W.falls++; ev(W, 'abyss'); } else if (W.lostT > 1.5) ev(W, 'lost'); else { W.resets++; ev(W, 'reset'); }
    W.lostT = 0; if (!abyss) W.rLock = [true, true];
    spawnAt(W, W.cp); ev(W, 'respawn', { cp: W.cp }); return W;
  }
  // points de passage : les deux grimpeurs dans la zone, au moins un au sol
  const cps = W.level.checkpoints;
  for (let i = W.cp + 1; i < cps.length; i++) {
    const c = cps[i], inA = Math.hypot(A.x - c.x, A.z - c.z) < c.r && Math.abs(A.y - c.y) < 3, inB = Math.hypot(B.x - c.x, B.z - c.z) < c.r && Math.abs(B.y - c.y) < 3;
    if (inA && inB && (A.st === ST.GROUND || B.st === ST.GROUND)) {
      W.cp = i; W.cpMax = Math.max(W.cpMax, i); ev(W, 'checkpoint', { cp: i, x: c.x, y: c.y, z: c.z });
      if (c.finish && !W.done) { W.done = true; ev(W, 'finish', { time: W.time }); }
      break;
    }
  }
  W.best = Math.max(W.best, A.y, B.y);
  return W;
}

/* ------------------------------ réseau : état complet compact ------------------------------ */
const R3 = (v) => Math.round(v * 1e4) / 1e4;
export function snapWorld(W, exact = false) {
  const r3 = exact ? (v) => v : R3;
  return {
    k: W.tick, L: W.L, Lc: r3(W.Lc), cp: W.cp, cpm: W.cpMax, tm: r3(W.time), st: W.started ? 1 : 0, dn: W.done ? 1 : 0, f: W.falls, sv: W.saves, rs: W.resets, ten: r3(W.ten), ta: r3(W.taut), be: r3(W.best),
    rh: W.resetHold.map(r3), lt: r3(W.lostT || 0), rl: (W.rLock || [false, false]).slice(), rk: (W.rank || []).slice(),
    pl: W.pl.map((p) => ({ ...p, hang: p.hang && { ...p.hang }, climb: p.climb && { ...p.climb }, mantle: p.mantle && { ...p.mantle } })),
    ch: W.ch.map((n) => [r3(n.x), r3(n.y), r3(n.z), r3(n.ox), r3(n.oy), r3(n.oz)]),
    cr: W.cr, sk: W.sk, dr: W.dr, cw: W.cw, sw: W.sw, gt: W.gt, gtp: W.gtp, hs: W.hs, db: W.db, ext: W.ext,
  };
}
export function applySnap(W, s) {
  W.tick = s.k; W.L = s.L; W.Lc = s.Lc; W.cp = s.cp; W.cpMax = s.cpm; W.time = s.tm; W.started = !!s.st; W.done = !!s.dn; W.falls = s.f; W.saves = s.sv; W.resets = s.rs; W.ten = s.ten; W.taut = s.ta; W.best = s.be;
  W.resetHold = s.rh.slice(); W.lostT = s.lt || 0; W.rLock = (s.rl || [false, false]).slice(); if (W.free) W.rank = (s.rk || []).slice();
  W.pl = s.pl.map((p) => ({ ...p, hang: p.hang && { ...p.hang }, climb: p.climb && { ...p.climb }, mantle: p.mantle && { ...p.mantle } }));
  W.ch = s.ch.map((a) => ({ x: a[0], y: a[1], z: a[2], ox: a[3], oy: a[4], oz: a[5] }));
  const cp = (o) => JSON.parse(JSON.stringify(o || {}));
  W.cr = cp(s.cr); W.sk = cp(s.sk); W.dr = cp(s.dr); W.cw = cp(s.cw); W.sw = cp(s.sw); W.gt = cp(s.gt); W.gtp = cp(s.gtp); W.hs = cp(s.hs || {}); W.db = cp(s.db || {}); W.ext = cp(s.ext || {});
  updateBodies(W);
  return W;
}
