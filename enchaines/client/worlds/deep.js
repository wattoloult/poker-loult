// LES ENCHAÎNÉS — rendu et sons propres au monde « deep » (les mines). Fichier réservé à ce monde.
// Crochets appelés par client/levelview.js (A = { THREE, S, LIB, PACK, place, matFor, sprite, linkRow, boxGeo, Sfx, HP, th }) :
//   build(W, grp, A)       construction (après le décor commun) : rails, chevalets, échelles, étais, mur d'éboulis, cage du treuil, lampe, casques
//   update(W, dt, t, A)    chaque image : sons et effets DÉDUITS de l'état de la sim (W.ext.deep, W.sw, vitesses des corps), comme client/mechs.js
//   links(W, n, A)         câbles de la cage du treuil
// La physique est dans core/biomes/deep.js. Modèles : assets/worlds/deep/*.glb (CC0, voir assets/credits-deep.txt) + le pack de décor du monde
// (assets/props/deep.glb : wagonnet, rails, chevalet, cristaux). Sons : assets/sfx/deep/*.mp3 (CC0), chargés avec Sfx.add('deep', …).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ctx } from '../audio.js';
import { poseAt } from '../../core/sim.js';

const MODELS = ['ladder', 'lantern', 'debris', 'pickaxe', 'goldore', 'planks'];
const SOUNDS = ['rockfall', 'rumble', 'stone_hit', 'stone_hit2', 'creak', 'snap', 'plank_fall', 'clack', 'cart_loop', 'brake', 'lamp_click', 'lamp_on', 'chime', 'ladder'];
let MOD = null; // modèles chargés une fois (promesse)
const loadModels = () => (MOD ||= Promise.all(MODELS.map(async (n) => { try { const g = await new GLTFLoader().loadAsync(new URL(`../../assets/worlds/deep/${n}.glb`, import.meta.url).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return [n, g.scene]; } catch { return [n, null]; } })).then((l) => Object.fromEntries(l)));
const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
let V = null; // état du rendu du niveau courant

/* ------------------------------ outils ------------------------------ */
// modèle `src` mis à la largeur w (plus grande dimension horizontale), posé par sa base au point (x, y, z) de `parent`
function fit(A, src, parent, w, x, y, z, ry = 0) {
  if (!src) return null;
  const { THREE } = A, o = src.clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  const b = new THREE.Box3().setFromObject(o), s = w / (Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1);
  o.scale.setScalar(s); o.position.set(-((b.max.x + b.min.x) / 2) * s, -b.min.y * s, -((b.max.z + b.min.z) / 2) * s);
  const g = new THREE.Group(); g.add(o); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g;
}
function dust(A, x, y, z, n = 6, col = 0x8f8272, size = 0.9, spread = 2) {
  const { THREE, S } = A;
  for (let i = 0; i < n; i++) {
    const s = A.sprite(col, size); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.5; s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 0.9 + Math.random() * 0.6, v: new THREE.Vector3((Math.random() - 0.5) * 2, 0.4 + Math.random(), (Math.random() - 0.5) * 2), grow: 1.4 });
  }
}
function fall(A, mesh) { const { S } = A; const d = mesh.clone(true); S.scene.add(d); d.position.copy(mesh.position); S.debris.push({ o: d, t: 0, v: 0, r: (Math.random() - 0.5) * 2 }); }
const snd = (A, name, x, y, z, o) => A.Sfx.one('deep/' + name, x, y, z, o);
const groundY = (W, x) => { let best = null, bd = 1e9; for (const b of W.bodies) { if (b.hit || b.move || b.cliff || b.lever || b.plate) continue; const d = Math.max(0, Math.abs(b.x - x) - b.w / 2); if (d < bd) { bd = d; best = b; } } return best ? best.y + best.h / 2 : 0; };

/* ------------------------------ construction ------------------------------ */
function build(W, grp, A) {
  const { THREE, S } = A, tok = (V = { tok: 1, snd: false, sw: {}, props: [], caves: [], darks: [], carts: [], levers: [], ladders: [], chase: null, cage: null, climbT: [0, 0], lights: [], head: [] });
  for (const b of W.bodies) {
    const d = b.deep, m = S.bodyMesh[b.i];
    if (b.lever && d?.pulse) tok.levers.push(b.i);
    if (d?.k === 'prop' && m) { m.children[0].material = m.children[0].material.clone(); tok.props.push({ b, m, s: 0 }); }
    else if (d?.k === 'cave' && m) tok.caves.push({ b, m, on: true });
    else if (d?.k === 'chase' && m) tok.chase = { b, m, id: d.id, on: 0, d: 0, voice: A.Sfx.voice('deep/rumble', { ref: 14 }), dustT: 0 };
    if (d?.dark && m) { const mesh = m.children[0]; mesh.material = mesh.material.clone(); m.children.slice(1).forEach((c) => m.remove(c)); tok.darks.push({ b, mesh, base: mesh.material.color.clone(), f: 0 }); }
    if (b.cart && b.move?.gate && m) tok.carts.push({ b, m, v: A.Sfx.voice('deep/cart_loop', { ref: 9 }), mv: 0, ph: 0 });
    if (b.lift && b.move?.gate && m) tok.cage = { b, m, a: A.Sfx.voice('chain_loop', { ref: 10 }), mv: 0, y0: 0 };
    if (d?.ladder) tok.ladders.push(b);
  }
  // casques : une lampe frontale par grimpeur (le monde est sombre, les cristaux et les lampes ne suffisent pas)
  for (let k = 0; k < 2; k++) { const l = new THREE.PointLight(k ? 0xbfe0ff : 0xffd9a0, 7, 13, 1.6); grp.add(l); tok.head.push(l); }
  // lampe à manivelle de la galerie noire : trois points de lumière le long du passage, éteints tant que le levier n'a pas été tiré
  const lamp = W.bodies.find((b) => b.lever?.id === 'lamp'), dk = tok.darks.map((d) => d.b.px);
  if (lamp && dk.length) for (let k = 0; k < 3; k++) { const l = new THREE.PointLight(0xffc27a, 0, 17, 1.5); l.position.set(lamp.px + 4 + (k * (Math.max(...dk) - lamp.px - 4)) / 2, lamp.py + 5, lamp.pz + 2); grp.add(l); tok.lights.push(l); }
  loadModels().then((M) => { if (V === tok) { try { decorate(W, grp, A, M, tok); } catch (e) { console.error('deep decor', e); } } });
}

function decorate(W, grp, A, M, tok) {
  const { THREE, S, PACK } = A;
  // rails + chevalets sous les wagonnets
  for (const c of tok.carts) {
    const b = c.b, m = b.move, o = c.m, a = poseAt(b, 0, { x: 0, y: 0, z: 0, yaw: 0 }), cy = b.y, e = poseAt({ ...b, move: { ...m, ph: Math.PI / 2 } }, 0, { x: 0, y: 0, z: 0, yaw: 0 });
    const x0 = a.x, y0 = a.y, x1 = e.x, y1 = e.y, ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0) + 3, n = Math.ceil(len / 2);
    // wagonnet : le modèle du décor posé sur sa base, un peu élargi aux dimensions réelles de la plateforme
    o.children.slice(1).forEach((k) => o.remove(k)); o.children[0].visible = false;
    const cart = A.place(PACK.minecart, o, 1.15); if (cart) { cart.position.y = -b.hh; cart.scale.set(b.w / 1.96 * 0.95, 1, b.d / 1.77 * 0.9); c.model = cart; }
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * (len / n) - 1.5, r = A.place(PACK.rail, grp, 0.13); if (!r) break;
      r.position.set(x0 + Math.cos(ang) * u, y0 - b.hh + 0.02 + Math.sin(ang) * u, b.z); r.rotation.z = ang; r.scale.set(len / n / 2 * 1.0, 1, b.d / 1.47 * 0.95); // rails jointifs
      if (i % 3 === 1) { const h = Math.max(0.5, y0 - b.hh + Math.sin(ang) * u + 24), p = A.place(PACK.support, grp, Math.min(10, h)); if (p) { p.position.set(r.position.x, r.position.y - Math.min(10, h) + 0.0, b.z - b.d / 2 - 0.1); p.rotation.y = 0; } }
    }
  }
  // échelles : on retire les prises de cristal de la paroi et on y plaque de vraies échelles
  for (const b of tok.ladders) {
    const o = S.bodyMesh[b.i]; if (!o) continue; o.children.slice(1).forEach((k) => o.remove(k));
    const n = Math.ceil(b.h / 4.4), hn = b.h / n;
    for (let i = 0; i < n; i++) for (const z of [-0.8, 0.8]) { const l = A.place(M.ladder, o, hn); if (l) { l.rotation.y = -Math.PI / 2; l.position.set(-b.hw - 0.1, -b.hh + i * hn, z); } }
  }
  // charpentes : des cadres de bois en toile de fond, avec une lanterne suspendue un cadre sur deux
  const zmin = W.level.checkpoints.length ? -3.6 : -3.6; let k = 0;
  for (let x = 5; x < 322; x += 6.4) {
    if (x > 112 && x < 166) continue; // couloir de l'éboulement : décor propre
    const gy = groundY(W, x), h = 5.6 + rnd(k, 1) * 1.4, fr = A.place(PACK.support, grp, h); k++;
    if (fr) { fr.position.set(x, gy - 1.4, zmin + (rnd(k, 3) - 0.5) * 0.8); fr.rotation.y = (rnd(k, 2) - 0.5) * 0.12; }
    if (k % 2 === 0 && M.lantern) { const L = fit(A, M.lantern, grp, 0.5, x + 0.5, gy + h - 3.6, zmin + 0.2); const g = A.sprite(0xffb060, 2.2); g.position.set(x + 0.5, gy + h - 4.4, zmin + 0.6); grp.add(g); S.fires.push(g); }
  }
  // couloir de l'éboulement : poteaux au-dessus du vide, lanternes
  for (const c of tok.caves) { const b = c.b; if (rnd(b.i, 5) > 0.55) continue; const p = A.place(PACK.support, grp, 6); if (p) p.position.set(b.x + 1, b.y + b.h / 2 - 3.6, -3.4); }
  // mur d'éboulis : blocs de roche, gravats et poussière
  if (tok.chase) {
    const { m, b } = tok.chase;
    for (let i = 0; i < 9; i++) { const r = A.place(PACK.rockL, m, 2.2 + rnd(i, 1) * 1.8); if (r) { r.position.set(-1.2 + rnd(i, 2) * 3.3, b.hh - 6.5 + rnd(i, 3) * 7.2 + (i < 3 ? 6 : 0), (rnd(i, 4) - 0.5) * 5.4); r.rotation.set(rnd(i, 6) * 6, rnd(i, 7) * 6, rnd(i, 8) * 6); } }
    for (let i = 0; i < 4; i++) fit(A, M.debris, m, 3.4, 2.4 + i * 0.4, b.hh - 7.5 + rnd(i, 9) * 0.3, (i - 1.5) * 1.6, rnd(i, 4) * 6);
  }
  // cage du treuil : montants, cadre, poulie et câbles
  if (tok.cage) {
    const { b, m } = tok.cage, wood = A.matFor('log'), metal = A.matFor('metal'), top = b.y + 5 + 5.4;
    const bar = (w, h, d, x, y, z, mat) => { const q = new THREE.Mesh(A.boxGeo(w, h, d, mat.userData.tile), mat); q.position.set(x, y, z); q.castShadow = true; m.add(q); return q; };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bar(0.16, 2.4, 0.16, sx * (b.hw - 0.1), b.hh + 1.2, sz * (b.hd - 0.1), wood);
    bar(b.w, 0.14, 0.16, 0, b.hh + 2.4, -(b.hd - 0.1), wood); bar(b.w, 0.14, 0.16, 0, b.hh + 2.4, b.hd - 0.1, wood); bar(0.16, 0.14, b.d, 0, b.hh + 2.4, 0, wood);
    bar(b.w, 0.9, 0.06, 0, b.hh + 0.45, b.hd - 0.02, metal).material = metal; // garde-corps plein
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, b.d + 3), A.matFor('plank')); beam.position.set(b.x, top, b.z); beam.castShadow = true; grp.add(beam);
    for (const dz of [-b.hd - 1.3, b.hd + 1.3]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, top - b.y + 6, 0.55), A.matFor('log')); post.position.set(b.x, b.y - 6 + (top - b.y + 6) / 2 - 0.5, b.z + dz); post.castShadow = true; grp.add(post); }
    tok.cage.top = top;
  }
  // lampe à manivelle : lanterne près du levier + halo
  const lamp = W.bodies.find((q) => q.lever?.id === 'lamp');
  if (lamp && M.lantern) { const L = fit(A, M.lantern, grp, 0.9, lamp.px, lamp.py + 2.3, lamp.pz - 0.3); tok.lampLantern = L; const g = A.sprite(0xffc27a, 3.2); g.position.set(lamp.px, lamp.py + 1.8, lamp.pz - 0.3); g.material.opacity = 0; grp.add(g); tok.lampGlow = g; }
  // outils et filons près des points de passage
  W.level.checkpoints.forEach((c, i) => { if (i === 0 || c.finish) return; fit(A, M.pickaxe, grp, 1.1, c.x + 1.9, c.y, c.z - 1.2, 0.5 + i); for (let j = 0; j < 2; j++) fit(A, M.goldore, grp, 0.5, c.x - 2.3 + j * 0.5, c.y, c.z - 1.1 + j * 0.3, i + j); });
  for (const b of W.bodies) if (b.mat === 'rock' && !b.move && !b.deep && b.w >= 4 && !b.cliff && rnd(b.i, 11) > 0.45) fit(A, M.goldore, S.bodyMesh[b.i] || grp, 0.55, (rnd(b.i, 12) - 0.5) * b.w * 0.7, b.hh, -b.hd + 0.4, b.i);
  // planches empilées au pied des quais des wagonnets
  for (const c of tok.carts) fit(A, M.planks, grp, 1.4, c.b.x - c.b.move.ax - 2.2, c.b.y - c.b.hh + 0.1, c.b.z - 2.1, 0.4);
}

/* ------------------------------ image ------------------------------ */
function update(W, dt, t, A) {
  if (!V) return;
  const { S } = A, D = W.ext.deep, c = ctx();
  if (c && !V.snd) { V.snd = true; A.Sfx.add('deep', SOUNDS); }
  // lampes frontales
  W.pl.forEach((p, k) => V.head[k]?.position.set(p.x, p.y + 2.4, p.z + 1.6));
  if (!D) return;
  const cam = S.cam.position, cx = (x, y, z) => cam.distanceToSquared({ x, y, z }) < 55 * 55;
  const guard = (f) => { try { f(); } catch (e) { if (!V.err) { V.err = 1; console.error('deep', e); } } };
  // levier à impulsion : clic au déclenchement
  guard(() => { for (const i of V.levers) { const b = W.bodies[i], id = b.lever.id, on = !!W.sw[id]; if (on !== !!V.sw[id]) { V.sw[id] = on; if (on) { snd(A, 'lamp_click', b.px, b.py, b.pz, { v: 0.9, key: id }); if (id === 'lamp') snd(A, 'lamp_on', b.px, b.py + 2, b.pz, { v: 0.7, key: 'lamp' }); } else if (id === 'lamp') snd(A, 'lamp_click', b.px, b.py, b.pz, { v: 0.5, rate: 0.8, key: id }); } } });
  // étais : gémissent, cèdent, reviennent
  guard(() => { for (const q of V.props) {
    const b = q.b, s = D.p[b.i]?.s ?? 0, mat = q.m.children[0].material;
    if (s !== q.s) {
      if (s === 1) snd(A, 'creak', b.px, b.py + b.hh, b.pz, { v: 0.9, key: 'p' + b.i, gap: 0.3 });
      else if (s === 2) { snd(A, 'snap', b.px, b.py, b.pz, { v: 1, key: 'p' + b.i }); snd(A, 'plank_fall', b.px, b.py - 1, b.pz, { v: 0.8, key: 'pf' + b.i }); fall(A, q.m); dust(A, b.px, b.py, b.pz, 7, 0xb59a74, 0.7, b.w); S.shake = Math.max(S.shake || 0, 0.18); }
      else if (s === 0 && q.s === 2) snd(A, 'clack', b.px, b.py + b.hh, b.pz, { v: 0.5, rate: 0.7, key: 'p' + b.i });
      q.s = s;
    }
    q.m.visible = s !== 2;
    if (s === 1) { q.m.position.x += (Math.random() - 0.5) * 0.04; q.m.position.y += Math.sin(t * 60) * 0.015; }
    mat.emissive.setHex(0x000000); if (s === 1) mat.emissive.setRGB(0.35 + 0.2 * Math.sin(t * 30), 0.06, 0.02);
  } });
  // sol de l'éboulement : s'effondre derrière le mur
  guard(() => { for (const q of V.caves) {
    const on = q.b.on; q.m.visible = on;
    if (on !== q.on) { q.on = on; if (!on) { snd(A, 'stone_hit2', q.b.px, q.b.py, q.b.pz, { v: 0.9, key: 'c' + q.b.i, gap: 0.1 }); fall(A, q.m); dust(A, q.b.px, q.b.py, q.b.pz, 8, 0x7c7064, 1.1, q.b.w); } }
  } });
  // mur de gravats
  guard(() => { const q = V.chase; if (!q) return; const st = D.c[q.id], b = q.b, on = st?.on ? 1 : 0, dn = st?.d ? 1 : 0;
    q.m.visible = !!b.on;
    if (on && !q.on) { snd(A, 'rockfall', b.px, b.py + 4, b.pz, { v: 1, ref: 20, key: 'ebl' }); S.shake = Math.max(S.shake || 0, 0.55); }
    if (dn && !q.d) { snd(A, 'rockfall', b.px, b.py + 4, b.pz, { v: 0.6, ref: 20, rate: 0.8, key: 'ebl' }); dust(A, b.px, b.py + 6, b.pz, 14, 0x8a7d6c, 2, 5); }
    q.on = on; q.d = dn;
    const d = Math.abs(b.px - cam.x), near = on ? Math.max(0, 1 - d / 30) : 0;
    q.voice.at(b.px, b.py + 3, b.pz).set(on ? 0.35 + near * 0.65 : 0, 0.9 + near * 0.2);
    if (on) { S.shake = Math.max(S.shake || 0, near * 0.22); if ((q.dustT -= dt) < 0) { q.dustT = 0.09; dust(A, b.px + 2.2, b.py + 7 + Math.random() * 2, b.pz, 2, 0x8a7d6c, 1.6, 4); if (Math.random() < 0.3) snd(A, 'stone_hit', b.px + 2, b.py + 6, b.pz, { v: 0.5, gap: 0.5, key: 'ebh' }); } } });
  // wagonnets : roulent avec un cliquetis de rails, freinent à l'arrivée
  guard(() => { for (const q of V.carts) { const b = q.b, sp = Math.hypot(b.vx, b.vy), mv = sp > 0.4 ? 1 : 0, x = b.px, y = b.py + b.hh, z = b.pz;
    q.v.at(x, y, z).set(cx(x, y, z) ? Math.min(0.9, sp * 0.22) * mv : 0, 0.8 + Math.min(0.5, sp * 0.1));
    if (mv !== q.mv) { if (mv) snd(A, 'clack', x, y, z, { v: 0.9, key: 'k' + b.i, gap: 0.5 }); else { snd(A, 'brake', x, y, z, { v: 0.8, key: 'k' + b.i }); dust(A, x, y, z, 4, 0xb0a090, 0.6, b.w); } q.mv = mv; }
  } });
  // cage du treuil
  guard(() => { const q = V.cage; if (!q) return; const b = q.b, sp = Math.abs(b.vy), mv = sp > 0.3 ? 1 : 0, x = b.px, y = b.py + b.hh + 2, z = b.pz;
    q.a.at(x, y, z).set(cx(x, y, z) ? Math.min(0.55, sp * 0.18) * mv : 0, 0.8 + Math.min(0.5, sp * 0.1));
    if (mv && (q.t = (q.t || 0) - dt) < 0) { q.t = 0.5; snd(A, 'clack', x, y + 1, z, { v: 0.35, rate: 0.6 + Math.random() * 0.2, gap: 0.3, key: 'cg' }); }
    if (mv !== q.mv) { if (mv) A.Sfx.one('winch_a', x, y, z, { v: 0.8, key: 'cage' }); else { A.Sfx.one('gate_thud', x, b.py, z, { v: 0.7, rate: 1.1, key: 'cage' }); S.shake = Math.max(S.shake || 0, 0.12); } q.mv = mv; } });
  // galerie noire : les planches ne se voient bien que lampe allumée ; clignotement dans les dernières secondes
  guard(() => { const lamp = W.sw.lamp ? 1 : 0, left = lamp ? 45 - (D.t.lamp || 0) / 120 : 0, flick = lamp && left < 6 ? (Math.sin(t * 26) > -0.2 + left * 0.05 ? 1 : 0.35) : lamp;
    for (const q of V.darks) { q.f += ((flick) - q.f) * Math.min(1, dt * 6); q.mesh.material.color.copy(q.base).multiplyScalar(0.16 + 0.84 * q.f); }
    V.lights.forEach((l, i) => { l.intensity += ((flick ? 30 + Math.sin(t * 9 + i) * 3 : 0) * (flick || 0) - l.intensity) * Math.min(1, dt * 6); });
    if (V.lampGlow) V.lampGlow.material.opacity = 0.25 + 0.6 * (flick || 0); });
  // échelles : bruit de barreaux pendant qu'on grimpe
  guard(() => { W.pl.forEach((p, k) => { const on = p.st === 3 && p.climb && W.bodies[p.climb.b]?.deep?.ladder, mv = on && Math.abs(p.vy) > 0.3;
    if (mv && (V.climbT[k] -= dt) < 0) { V.climbT[k] = 0.36; snd(A, 'ladder', p.x, p.y + 1, p.z, { v: 0.45, key: 'l' + k, gap: 0.25 }); } }); });
}

function links(W, n, A) {
  const q = V?.cage; if (!q?.top) return n;
  const { THREE, S } = A, b = q.b, a = new THREE.Vector3(), c = new THREE.Vector3();
  for (const sz of [-1, 1]) { a.set(b.x, q.top - 0.3, b.z + sz * (b.hd - 0.1)); c.set(b.px, b.py + b.hh + 2.4, b.pz + sz * (b.hd - 0.1)); if (a.y - c.y > 0.3) n = A.linkRow(S.hangLinks, n, a, c, sz); }
  return n;
}

export default { build, update, links };
