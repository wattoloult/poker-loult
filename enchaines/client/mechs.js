// LES ENCHAÎNÉS — rendu et sons des GROS MÉCANISMES : herses et lourdes portes, ponts-levis, treuils de contrepoids.
// Modèles : Kenney Castle Kit (CC0, assets/castle) — herse métallique, porte de bois, tablier de pont-levis, piliers ;
// la roue de treuil et le poids viennent des pièces détachées du trébuchet du même kit.
// La PHYSIQUE est dans core/sim.js (herse : W.hs / W.dr, pont : W.db) ; ce module ne fait que suivre son état, image par image,
// et en déduit les sons (verrou, cliquetis d'alerte, chaîne, treuil, chute, impact, claquement final), joués à la position du mécanisme.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { S, linkRow, boxGeo } from './scene.js';
import { HP, spanOf } from '../core/sim.js';
import * as Sfx from './sfx.js';

const M = {}; // modèles : M[nom] (scène du .glb)
let loading = null;
export const needs = (L) => L.bodies.some((b) => b.herse || b.dbseg || b.cw);
export function load() {
  if (loading) return loading;
  const ld = new GLTFLoader(), base = new URL('../assets/castle/', import.meta.url);
  loading = Promise.all(['metal-gate', 'gate', 'bridge-draw', 'wall-pillar', 'siege-trebuchet'].map(async (n) => {
    try { const g = await ld.loadAsync(new URL(n + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); M[n] = g.scene; } catch { /* modèle absent */ }
  }));
  return loading;
}
// pièce détachée du trébuchet (roue, poids), recentrée sur son origine
function part(name) { const t = M['siege-trebuchet']; const n = t?.getObjectByName(name); if (!n) return null; const c = n.clone(false); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); const g = new THREE.Group(); g.add(c); return g; }
// copie d'un modèle mise aux dimensions voulues (sx, sy, sz en mètres ; le modèle garde son origine), habillée d'un matériau du jeu :
// les modèles Kenney sont peints par une palette pastel ; on garde leur forme et on projette nos textures (pierre, bois, fer) dessus
export function sized(name, sx, sy, sz, mat) {
  const src = M[name]; if (!src) return null; const o = src.clone(true), box = new THREE.Box3().setFromObject(src), s = box.getSize(new THREE.Vector3());
  const k = [sx / (s.x || 1), sy / (s.y || 1), sz / (s.z || 1)]; o.scale.set(...k);
  if (mat) retex(o, mat, k); const g = new THREE.Group(); g.add(o); return g;
}
function retex(o, mat, k) {
  const tile = mat.userData.tile || [2.6, 2.6];
  o.traverse((m) => {
    if (!m.isMesh) return; const g = m.geometry.clone(), p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * k[0], y = p.getY(i) * k[1], z = p.getZ(i) * k[2], ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y]; uv[i * 2] = u / tile[0]; uv[i * 2 + 1] = v / tile[1];
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.geometry = g; m.material = mat;
  });
}
let IRON = null;
const ironMat = () => (IRON ||= Object.assign(S.mat.metal.clone(), { color: new THREE.Color(0x56514c), metalness: 0.75, roughness: 0.42 }));
const box = (w, h, d, mat) => { const m = new THREE.Mesh(boxGeo(w, h, d, mat.userData.tile || [2.6, 2.6]), mat); m.castShadow = m.receiveShadow = true; return m; };

// au-delà de 45 m de la caméra, un mécanisme se tait (ses boucles ne tournent pas)
const near = (x, y, z) => S.cam.position.distanceToSquared(TV.set(x, y, z)) < 45 * 45, TV = new THREE.Vector3();
let V = []; // vues : { kind, b | id, root, ..., snd }
export function build(W, grp) {
  for (const v of V) for (const s of Object.values(v.snd || {})) s.stop?.();
  V = [];
  const seenBridge = new Set(), seenCw = new Set();
  for (const b of W.bodies) {
    if (b.herse) V.push(herseView(b, grp));
    if (b.dbseg && !seenBridge.has(b.dbseg.id)) { seenBridge.add(b.dbseg.id); V.push(bridgeView(W, b.dbseg, grp)); }
    if (b.cw && !seenCw.has(b.cw.id)) { seenCw.add(b.cw.id); V.push({ kind: 'cw', id: b.cw.id, wheels: cwWheels(W, b.cw.id, grp), snd: { chain: Sfx.voice('chain_loop') }, last: 0, clickT: 0 }); }
  }
}

/* ------------------------------ herse / lourde porte ------------------------------ */
function herseView(b, grp) {
  const stone = b.look === 'stone', iron = b.look !== 'wood' && !stone, base = b.y - b.hh, root = new THREE.Group(); root.position.set(b.px, base, b.pz); grp.add(root);
  const gate = new THREE.Group(); root.add(gate);
  const m = stone ? null : sized(iron ? 'metal-gate' : 'gate', iron ? 0.3 : 0.5, b.h, b.d, iron ? ironMat() : S.mat.darkwood); if (m) gate.add(m);
  else if (!stone) gate.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, b.h, b.d), S.mat.metal));
  // encadrement : deux piliers de pierre assez hauts pour loger la herse levée, une poutre et le treuil au sommet (le pilon : poutre seule)
  const H = spanOf(b) + b.h + 0.8;
  // pilier arrière seulement : celui de devant cacherait la herse à la caméra
  if (!stone) { const p = box(0.9, H, 0.9, S.mat.stone); p.position.set(0, H / 2, -(b.hd + 0.45)); root.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, b.d + 1.8), S.mat.darkwood); beam.position.set(0, H - 0.25, 0); beam.castShadow = true; root.add(beam);
  const drum = part('wheel'); if (drum) { retex(drum, S.mat.darkwood, [2.4, 2.4, 2.4]); drum.scale.setScalar(2.4); drum.position.set(0.55, H + 0.1, 0); root.add(drum); }
  return { kind: 'herse', b, iron, root, gate, drum, H, ph: -1, jam: 0, clickT: 0,
    snd: { warn: Sfx.voice('gate_rattle', { fadeIn: 0.05 }), move: Sfx.voice(iron ? 'gate_lower' : 'gate_move_b'), up: Sfx.voice('gate_raise'), chain: Sfx.voice('chain_loop') } };
}
function herseUpdate(W, v, dt) {
  const b = v.b, s = W.hs[b.i], o = W.dr[b.i] ?? 1, span = spanOf(b), x = b.px, y = b.y - b.hh + o * span + b.h * 0.5, z = b.pz, k = 'h' + b.i;
  v.gate.position.y = o * span;
  v.gate.position.x = s.ph === HP.WARN || s.jam ? (Math.random() - 0.5) * 0.05 : 0; // elle tremble avant de tomber, et bloquée
  if (v.drum) v.drum.rotation.z = -o * 6;
  for (const sn of Object.values(v.snd)) sn.at(x, y, z);
  const slam = b.herse.fall === 'slam', wood = !v.iron;
  if (s.ph !== v.ph) { // transitions : un son ponctuel + les boucles qui conviennent
    const from = v.ph; v.ph = s.ph;
    if (s.ph === HP.WARN) { Sfx.one('gate_latch', x, y + 1, z, { key: k, v: 0.9 }); Sfx.one('winch_a', x, y + 2, z, { key: k, v: 0.7 }); }
    if (s.ph === HP.SHUT && from !== -1) { Sfx.one(wood ? 'gate_thud' : 'gate_slam', x, b.y - b.hh, z, { key: k, v: slam ? 1 : 0.75, rate: wood ? 0.85 : 1 }); Sfx.one('gate_rattle', x, b.y, z, { key: k + 'r', v: 0.5, dur: 1.2 }); S.shake = Math.max(S.shake || 0, slam ? 0.35 : 0.15); }
    if (s.ph === HP.OPEN && from === HP.RISE) Sfx.one('gate_latch', x, b.y + b.h, z, { key: k, v: 0.8, rate: 0.9 }); // claquement final, en position haute
    if (s.ph === HP.FALL && slam) Sfx.one('chain_loop', x, y + 2, z, { key: k, v: 0.9, rate: 1.7, dur: 0.7 }); // la chaîne file d'un coup
    if (s.ph === HP.RISE) Sfx.one('winch_c', x, y + 2, z, { key: k, v: 0.7 });
  }
  const on = near(x, y, z) ? 1 : 0;
  v.snd.warn.set(on * (s.ph === HP.WARN || s.jam ? 0.55 : 0));
  v.snd.move.set(on * (s.ph === HP.FALL && !slam && !s.jam ? 0.8 : 0));
  v.snd.up.set(on * (s.ph === HP.RISE ? 0.75 : 0), wood ? 0.85 : 1);
  v.snd.chain.set(on * (s.ph === HP.RISE || (s.ph === HP.FALL && !slam && !s.jam) ? 0.35 : 0), s.ph === HP.RISE ? 0.8 : 1.1);
  if (on && s.ph === HP.RISE && (v.clickT -= dt) < 0) { v.clickT = 0.55; Sfx.one('winch_b', x, y + 2, z, { key: k + 'c', v: 0.35, off: Math.random() * 1.5, dur: 0.5, gap: 0.4 }); }
}

/* ------------------------------ pont-levis ------------------------------ */
function bridgeView(W, S0, grp) {
  const root = new THREE.Group(), z = W.bodies.find((b) => b.dbseg?.id === S0.id).pz, d = W.bodies.find((b) => b.dbseg?.id === S0.id).d;
  root.position.set(S0.hx, S0.top, z); grp.add(root);
  const deck = new THREE.Group(); root.add(deck);
  const m = sized('bridge-draw', S0.len, S0.th, d, S.mat.wood); if (m) { m.scale.x *= -S0.side; m.position.y = -S0.th; deck.add(m); }
  else { const box = new THREE.Mesh(new THREE.BoxGeometry(S0.len, S0.th, d), S.mat.wood); box.position.set(S0.side * S0.len / 2, -S0.th / 2, 0); deck.add(box); }
  // potence : pilier côté charnière, treuil au sommet ; les chaînes vont du treuil au bout du tablier
  // potence : un poteau derrière le passage, une poutre en travers au-dessus, le treuil à son bout
  const top = S0.len * 0.95 + 0.6, post = box(0.6, top + 1.2, 0.6, S.mat.darkwood); post.position.set(-S0.side * 0.6, (top + 1.2) / 2 - 0.6, -d / 2 - 0.7); root.add(post);
  const beam = box(0.45, 0.45, d + 2, S.mat.darkwood); beam.position.set(-S0.side * 0.6, top, 0.15); root.add(beam);
  const drum = part('wheel'); if (drum) { retex(drum, S.mat.darkwood, [3, 3, 3]); drum.scale.setScalar(3); drum.position.set(-S0.side * 0.6, top + 0.2, -d / 2 - 1.15); root.add(drum); }
  return { kind: 'bridge', id: S0.id, S: S0, root, deck, drum, top, d, z, mv: 0, snd: { chain: Sfx.voice('chain_loop'), creak: Sfx.voice('gate_move_b'), up: Sfx.voice('gate_raise') } };
}
function bridgeUpdate(W, v, dt) {
  const D = W.db[v.id]; if (!D) return; const S0 = v.S, a = D.a;
  v.deck.rotation.z = S0.side * a; if (v.drum) v.drum.rotation.z = a * 4;
  const mx = S0.hx + S0.side * Math.cos(a) * S0.len * 0.5, my = S0.top + Math.sin(a) * S0.len * 0.5;
  for (const sn of Object.values(v.snd)) sn.at(mx, my, v.z);
  if (D.mv !== v.mv) {
    if (D.mv && !v.mv) Sfx.one('gate_latch', S0.hx, S0.top + 1, v.z, { key: 'b' + v.id, v: 0.9 }); // déverrouillage
    if (!D.mv && v.mv === -1) { Sfx.one('gate_thud', mx, S0.top, v.z, { key: 'b' + v.id, v: 1 }); Sfx.one('gate_rattle', S0.hx, S0.top + 3, v.z, { key: 'bt' + v.id, v: 0.45, dur: 1.4 }); S.shake = Math.max(S.shake || 0, 0.25); }
    if (!D.mv && v.mv === 1) Sfx.one('gate_latch', S0.hx, S0.top + 3, v.z, { key: 'b' + v.id, v: 0.8, rate: 0.85 });
    v.mv = D.mv;
  }
  const on = near(mx, my, v.z) ? 1 : 0;
  v.snd.chain.set(on * (D.mv ? 0.45 : 0), D.mv === -1 ? 1.2 : 0.8);
  v.snd.creak.set(on * (D.mv === -1 ? 0.6 : 0), 0.9);
  v.snd.up.set(on * (D.mv === 1 ? 0.6 : 0), 0.9);
}

/* ------------------------------ contrepoids : poulies au-dessus des plateaux ------------------------------ */
function cwWheels(W, id, grp) {
  return W.bodies.filter((b) => b.cw?.id === id).map((b) => { const w = part('wheel'); if (!w) return null; retex(w, S.mat.darkwood, [2.6, 2.6, 2.6]); w.scale.setScalar(2.6); w.position.set(b.x, b.y + b.hh + 6, b.z - 0.2); grp.add(w); return { w, b }; }).filter(Boolean);
}
function cwUpdate(W, v, dt) {
  const k = W.cw[v.id]; if (!k) return; const sp = Math.abs(k.v), b0 = v.wheels[0]?.b;
  for (const { w, b } of v.wheels) w.rotation.z = (k.y * b.cw.side) / 0.5;
  if (!b0) return;
  const x = b0.x, y = b0.y + 4, z = b0.z;
  v.snd.chain.at(x, y, z).set(!near(x, y, z) ? 0 : sp > 0.25 ? Math.min(0.5, sp * 0.4) : 0, 0.7 + Math.min(0.6, sp * 0.2));
  if (sp > 0.4 && (v.clickT -= dt) < 0) { v.clickT = 0.45; Sfx.one('winch_a', x, y + 2, z, { key: 'cw' + v.id, v: 0.3, gap: 0.3 }); }
  if (v.last > 1.2 && sp < 0.15) Sfx.one('gate_thud', x, b0.y, z, { key: 'cwt' + v.id, v: 0.4, rate: 1.2 }); // butée
  v.last = sp;
}

export function update(W, dt) {
  for (const v of V) { if (v.kind === 'herse') herseUpdate(W, v, dt); else if (v.kind === 'bridge') bridgeUpdate(W, v, dt); else if (v.kind === 'cw') cwUpdate(W, v, dt); }
}
// chaînes visibles (instances partagées S.hangLinks) : treuil -> herse, potence -> bout du pont
const HA = new THREE.Vector3(), HB = new THREE.Vector3();
export function links(W, n) {
  for (const v of V) {
    if (v.kind === 'herse') { const b = v.b, o = W.dr[b.i] ?? 1, base = b.y - b.hh; HA.set(b.px + 0.55, base + v.H, b.pz); HB.set(b.px, base + o * spanOf(b) + b.h, b.pz); if (HA.y - HB.y > 0.2) n = linkRow(S.hangLinks, n, HA, HB, b.i); }
    else if (v.kind === 'bridge') { const S0 = v.S, a = W.db[v.id]?.a || 0, ex = S0.hx + S0.side * Math.cos(a) * S0.len, ey = S0.top + Math.sin(a) * S0.len; for (const sz of [-1, 1]) { HA.set(S0.hx - S0.side * 0.6, S0.top + v.top, v.z + sz * (v.d / 2 + 0.2)); HB.set(ex, ey, v.z + sz * (v.d / 2 - 0.15)); n = linkRow(S.hangLinks, n, HA, HB, sz); } }
  }
  return n;
}
// état lisible des mécanismes (mode test)
export function describe(W) {
  return V.map((v) => v.kind === 'herse' ? `herse #${v.b.i} ${['ouverte', 'alerte', 'chute', 'fermée', 'remontée'][W.hs[v.b.i].ph]}${W.hs[v.b.i].jam ? ' BLOQUÉE' : ''} ${(W.dr[v.b.i] * 100).toFixed(0)}%`
    : v.kind === 'bridge' ? `pont ${v.id} ${(W.db[v.id].a * 57.3).toFixed(0)}°${W.db[v.id].mv ? (W.db[v.id].mv < 0 ? ' descend' : ' monte') : ''}` : `contrepoids ${v.id} ${W.cw[v.id]?.y.toFixed(2)}`).join('\n');
}
