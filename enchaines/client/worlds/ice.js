// LES ENCHAÎNÉS — rendu et sons propres au monde « ice » (Passages glacés, Le Col gelé). Fichier réservé à ce monde.
// Dessine : les stalactites (rochers pointus du Nature Kit de Kenney retournés et givrés), la glace mince qui craque, le mur de glace coulissant,
// l'avalanche (tas de neige du Holiday Kit + poussière), le tapis de la pente glacée (chevrons animés), le floe, la voûte de la grotte
// (plafond, stalactites décoratives, lanternes) et les campements des points de passage (tente, feu, bonhomme de neige, traîneau…).
// Modèles CC0 de Kenney (assets/worlds/ice, crédits dans assets/credits-ice.txt) ; sons CC0 Freesound (assets/sfx/ice).
// Les sons et effets sont DÉDUITS de l'état de la sim (W.ext.ice, vitesses des corps), comme client/mechs.js : aucun état réseau propre.
// Crochets appelés par client/levelview.js (A = { THREE, S, LIB, PACK, place, matFor, sprite, linkRow, boxGeo, Sfx, HP, th }).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ctx } from '../audio.js';
import { windOn } from '../../core/sim.js';

const MODELS = ['snow-bunker', 'snow-pile', 'snowman', 'sled-long', 'tree-snow-a', 'tree-snow-b', 'lantern-hanging', 'rocks-large', 'bench', 'tent', 'tool-pickaxe', 'tool-axe',
  'barrel', 'signpost', 'campfire-pit', 'rock_tallA', 'rock_tallC', 'rock_tallE', 'rock_tallH', 'stone_tallB'];
const SOUNDS = ['ice_crack', 'ice_break', 'icicle_break', 'ice_creak', 'wind_gust', 'avalanche', 'avalanche_hit', 'chime', 'ice_land', 'ice_cave'];
let MOD = null; // modèles chargés une fois (promesse)
const loadModels = () => (MOD ||= Promise.all(MODELS.map(async (n) => { try { const g = await new GLTFLoader().loadAsync(new URL(`../../assets/worlds/ice/${n}.glb`, import.meta.url).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return [n, g.scene]; } catch { return [n, null]; } })).then((l) => Object.fromEntries(l)));
const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
let V = null; // état du rendu du niveau courant

/* ------------------------------ outils ------------------------------ */
// modèle `src` posé par sa base au point (x, y, z) de `parent`, de hauteur h (échelle uniforme)
// (maxW : largeur maximale — les rochers « hauts » de Kenney sont très larges une fois mis à la hauteur voulue)
function stand(A, src, parent, h, x, y, z, ry = 0, maxW = 0) {
  const g = A.place(src, parent, h); if (!g) return null;
  if (maxW) { const b = new A.THREE.Box3().setFromObject(g), w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z); if (w > maxW) g.scale.multiplyScalar(maxW / w); }
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
// givre un modèle : teinte bleutée, léger éclat, translucide
function icy(root, hex = 0xbfe6ff, op = 0.92) {
  root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.vertexColors = false; o.material.map = null; o.material.color.set(hex); o.material.emissive?.set(0x2a5a80); o.material.emissiveIntensity = 0.35; o.material.transparent = op < 1; o.material.opacity = op; o.material.roughness = 0.15; } });
  return root;
}
// tas de neige de largeur `width` (x, z) étiré en hauteur (tall × la largeur) : le modèle est un tas plat, on le dresse
function pile(A, src, parent, width, tall, x, y, z, ry = 0) {
  const g = A.place(src, parent, 1); if (!g) return null;
  const b = new A.THREE.Box3().setFromObject(g), w = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1, k = width / w;
  g.scale.set(k, k * tall, k); g.position.set(x, y, z); g.rotation.y = ry; return g;
}
function burst(A, x, y, z, n = 8, col = 0xdff4ff, size = 0.55, spread = 1.6) {
  const { THREE, S } = A;
  for (let i = 0; i < n; i++) {
    const s = A.sprite(col, size); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.85; s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 0.7 + Math.random() * 0.6, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), g: 14, grow: 0.5 });
  }
}
function puff(A, x, y, z, n = 3, size = 2.2, spread = 3) {
  const { THREE, S } = A;
  for (let i = 0; i < n; i++) {
    const s = A.sprite(0xf4f8ff, size); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.55; s.position.set(x + (Math.random() - 0.5) * spread, y + Math.random() * spread, z + (Math.random() - 0.5) * spread); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 1 + Math.random() * 0.8, v: new THREE.Vector3(1 + Math.random() * 2, 0.4 + Math.random(), (Math.random() - 0.5) * 2), grow: 1.6 });
  }
}
function fall(A, mesh) { const { S } = A; const d = mesh.clone(true); S.scene.add(d); d.position.copy(mesh.position); S.debris.push({ o: d, t: 0, v: 0, r: (Math.random() - 0.5) * 2 }); }
const snd = (A, name, x, y, z, o) => A.Sfx.one('ice/' + name, x, y, z, o);
// chevrons blancs sur fond de glace, qui défilent (tapis de la pente glacée)
function beltTexture(A) {
  const { THREE } = A, c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(160,215,245,0.55)'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(84, 22); g.lineTo(34, 64); g.lineTo(84, 106); g.stroke(); // chevron « < » : le courant va vers -x
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* ------------------------------ construction ------------------------------ */
function build(W, grp, A) {
  const { THREE, S } = A, tok = (V = { tok: 1, snd: false, stals: [], thins: [], gates: [], wall: null, floe: null, belts: [], winds: [], cave: null, prevWind: [] });
  for (const b of W.bodies) {
    const d = b.ic, m = S.bodyMesh[b.i]; if (!m) continue;
    if (d?.k === 'stal') tok.stals.push({ b, m, s: 0 });
    else if (d?.k === 'thin') { m.children[0].material = m.children[0].material.clone(); tok.thins.push({ b, m, s: 0 }); }
    else if (d?.k === 'gate') tok.gates.push({ b, m, o: 0 });
    else if (d?.k === 'wall') tok.wall = { b, m, id: d.id, on: 0, d: 0, voice: A.Sfx.voice('ice/avalanche', { ref: 16 }), t: 0 };
    else if (d?.k === 'cur') tok.belts.push({ b, m });
    if (b.name === 'floe') tok.floe = { b, m, mv: 0 };
  }
  // courants d'air à rafales : un souffle à chaque début de rafale
  (W.level.winds || []).forEach((w, i) => { if (w.gust) tok.winds.push({ w, i }); });
  // lumières froides dans la grotte (statiques : jamais basculées en jeu)
  const cx = [(118 + 140) / 2, 176];
  for (const x of cx) { const l = new THREE.PointLight(0x7fc4ff, 14, 26, 1.6); l.position.set(x, 14.5, 2); grp.add(l); }
  loadModels().then((M) => { if (V === tok) { try { decorate(W, grp, A, M, tok); } catch (e) { console.error('ice decor', e); } } });
}

function decorate(W, grp, A, M, tok) {
  const { THREE, S } = A, rocks = [M.rock_tallA, M.rock_tallC, M.rock_tallE, M.rock_tallH].filter(Boolean), spikes = [A.PACK.crystal, A.PACK.crystalB].filter(Boolean); // pointes : les cristaux du pack du monde, retournés
  if (!spikes.length) spikes.push(...rocks);
  // ---- stalactites : rochers pointus retournés, givrés, avec deux petits satellites ----
  for (const q of tok.stals) {
    const { b, m } = q; m.children[0].visible = false;
    const g = new THREE.Group(); m.add(g); q.g = g;
    const main = stand(A, spikes[b.i % spikes.length], g, b.h, 0, b.hh, 0, 0, 1.3); if (main) { icy(main); main.rotation.x = Math.PI; }
    for (const [dx, dz, k] of [[-0.55, 0.2, 0.55], [0.5, -0.25, 0.4]]) { const s = stand(A, spikes[(b.i + 1) % spikes.length], g, b.h * k, dx, b.hh - 0.1, dz, 0, 0.7); if (s) { icy(s); s.rotation.x = Math.PI; } }
  }
  // ---- avalanche : tas de neige empilés + blocs de glace ----
  if (tok.wall) {
    const { m, b } = tok.wall; m.children[0].visible = false;
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 7; i++) pile(A, M['snow-pile'], m, 4.2 + rnd(i, layer) * 2, 1.8 + rnd(i, 9) * 1.2, -0.4 + rnd(i, layer + 3) * 1.2, -b.hh + layer * 5.2, (i - 3) * 1.4 + (rnd(i, 7) - 0.5) * 0.8, rnd(i, 5) * 6);
    for (let i = 0; i < 5; i++) { const r = stand(A, rocks[i % rocks.length], m, 2 + rnd(i, 9) * 2.4, -1.2 + rnd(i, 2) * 2.4, -b.hh + 2 + rnd(i, 4) * 8, (rnd(i, 6) - 0.5) * 8, rnd(i, 8) * 6, 3); if (r) icy(r, 0xe8f4ff, 1); }
  }
  // ---- neige poudreuse : bosses de neige molle ----
  for (const b of W.bodies) if (b.ic?.k === 'powder') { const m = S.bodyMesh[b.i]; for (let k = 0; k < 5; k++) { const p = stand(A, M['snow-pile'], m, 0.45 + rnd(b.i, k) * 0.3, (rnd(b.i, k + 1) - 0.5) * b.w * 0.8, b.hh - 0.05, (rnd(b.i, k + 4) - 0.5) * b.d * 0.7, rnd(b.i, k) * 6); if (p) p.scale.multiplyScalar(1.6); } }
  // ---- tapis de la pente glacée : chevrons qui défilent vers l'arrière ----
  for (const q of tok.belts) {
    const { b, m } = q, tex = beltTexture(A); tex.repeat.set(b.w / 1.6, b.d / 1.6);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.1, b.d - 0.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }));
    m.children.slice(1).forEach((k) => m.remove(k)); // pas de blocs de glace fixes sur un tapis qui bouge
    pl.rotation.x = -Math.PI / 2; pl.position.y = b.hh + 0.03; pl.renderOrder = 10; m.add(pl); q.tex = tex;
  }
  // ---- floe : amas de neige et blocs de glace dessus ----
  if (tok.floe) { const { m, b } = tok.floe; for (let k = 0; k < 3; k++) { const p = stand(A, M['snow-pile'], m, 0.5 + rnd(k, 1) * 0.4, (k - 1) * 1.6, b.hh - 0.05, (rnd(k, 3) - 0.5) * 2, rnd(k, 4) * 6); if (p) p.scale.multiplyScalar(1.5); } }
  // ---- grotte (x 108 -> 205) : voûte, stalactites décoratives, colonnes de roche, lanternes ----
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(100, 16), new THREE.MeshStandardMaterial({ color: 0x9fb8cc, roughness: 0.7, side: THREE.FrontSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(156, 23, -1); grp.add(ceil); // visible seulement par en dessous (face avant vers le bas)
  for (let i = 0, x = 110; x < 205; i++, x += 2.6 + rnd(i, 1) * 2.4) {
    const s = stand(A, spikes[i % spikes.length], grp, 1.6 + rnd(i, 2) * 3.2, x, 23, (rnd(i, 3) - 0.5) * 12 - 1, rnd(i, 4) * 6, 1.8);
    if (s) { icy(s); s.rotation.x = Math.PI; }
  }
  for (let i = 0, x = 108; x < 205; i++, x += 6 + rnd(i, 5) * 3) { const r = stand(A, rocks[(i + 2) % rocks.length], grp, 7 + rnd(i, 6) * 7, x, 4, -5 - rnd(i, 7) * 2, rnd(i, 8) * 6, 4.5); if (r) icy(r, 0xc8e0f2, 1); }
  for (const x of [118, 130, 142, 168, 184]) {
    const gy = groundBelowY(W, x), l = stand(A, M['lantern-hanging'], grp, 0.9, x, gy + 3.7, -2.4); const g = A.sprite(0x9fd8ff, 2.4); g.position.set(x, gy + 3.2, -2.1); grp.add(g); S.fires.push(g); void l;
  }
  // ---- campements des points de passage ----
  W.level.checkpoints.forEach((c, i) => {
    if (c.finish) { stand(A, M.signpost, grp, 1.5, c.x + 3, c.y, c.z - 2.2); stand(A, M.snowman, grp, 1.6, c.x - 3, c.y, c.z - 2.2, 0.4); return; }
    const kind = i % 5, z = c.z - 1.9;
    if (i === 0) { stand(A, M['sled-long'], grp, 0.6, c.x + 3.4, c.y, z, 0.3); stand(A, M.snowman, grp, 1.5, c.x - 3.2, c.y, z, -0.5); return; }
    if (kind === 0) { stand(A, M.tent, grp, 1.9, c.x + 2.6, c.y, z, 0.2); const f = stand(A, M['campfire-pit'], grp, 0.5, c.x + 0.4, c.y, z + 0.5); if (f) { const g = A.sprite(0xff9a3c, 1.4); g.position.set(c.x + 0.4, c.y + 0.6, z + 0.5); grp.add(g); S.fires.push(g); } }
    else if (kind === 1) { stand(A, M.barrel, grp, 0.9, c.x + 2.2, c.y, z); stand(A, M['tool-pickaxe'], grp, 1.1, c.x + 1.4, c.y, z + 0.2, 0.8); stand(A, M['tool-axe'], grp, 0.9, c.x + 3, c.y, z + 0.1, -0.4); }
    else if (kind === 2) { stand(A, M.snowman, grp, 1.4, c.x + 2.4, c.y, z, -0.6); stand(A, M['snow-pile'], grp, 0.7, c.x - 2.2, c.y, z); }
    else if (kind === 3) { stand(A, M.bench, grp, 0.7, c.x + 2.2, c.y, z, 0); stand(A, M.signpost, grp, 1.5, c.x - 2.4, c.y, z); }
    else { stand(A, M['snow-bunker'], grp, 2.2, c.x + 3, c.y, z - 0.5, -0.2); stand(A, M['sled-long'], grp, 0.55, c.x - 2.2, c.y, z, 1.2); }
  });
  // ---- couloir de l'avalanche et lisière : (les sapins d'arrière-plan flottaient dans le vide : retirés) ----
  for (let i = 0, x = 285; x < 400; i++, x += 9 + rnd(i, 1) * 6) stand(A, M['rocks-large'], grp, 2 + rnd(i, 2) * 1.5, x, groundBelowY(W, x) - 0.2, -4.8, rnd(i, 4) * 6);
  // ---- sommet : bonhomme de neige au pied de l'arche ----
  void THREE;
}
const groundBelowY = (W, x) => { let best = 0, bd = 1e9; for (const b of W.bodies) { if (b.hit || b.move || b.cliff || b.lever || b.plate || b.bar || b.ghost) continue; const d = Math.max(0, Math.abs(b.x - x) - b.w / 2); if (d < bd) { bd = d; best = b.y + b.h / 2; } } return best; };

/* ------------------------------ image ------------------------------ */
function update(W, dt, t, A) {
  if (!V) return;
  const { S } = A, I = W.ext.ice, c = ctx();
  if (c && !V.snd) { V.snd = true; A.Sfx.add('ice', SOUNDS); V.cave = A.Sfx.voice('ice/ice_cave', { ref: 40, fadeIn: 0.6, fadeOut: 0.8 }); }
  const cam = S.cam.position, guard = (f) => { try { f(); } catch (e) { if (!V.err) { V.err = 1; console.error('ice', e); } } };
  // ambiance de la grotte : un grondement froid sous la voûte (x 108 -> 205), en fondu aux entrées
  guard(() => { if (!V.cave) return; const k = Math.max(0, Math.min(1, Math.min(cam.x - 106, 207 - cam.x) / 9)); V.cave.at(cam.x, cam.y, cam.z).set(k * 0.5, 1); });
  // rafales du col : un souffle à chaque début de rafale (position = centre de la zone)
  guard(() => { for (const q of V.winds) { const on = windOn(W, q.w); if (on && !V.prevWind[q.i]) snd(A, 'wind_gust', q.w.x, q.w.y, q.w.z, { v: 0.9, ref: 14, key: 'w' + q.i, gap: 1 }); V.prevWind[q.i] = on; } });
  // tapis de la pente : les chevrons défilent vers l'arrière
  guard(() => { for (const q of V.belts) if (q.tex) q.tex.offset.x -= dt * 2.6 / 1.6 * (q.b.ic.vx < 0 ? -1 : 1); });
  if (!I) return;
  // stalactites : tremblement, éclats, brisure, repousse
  guard(() => { for (const q of V.stals) {
    const b = q.b, st = I.s[b.i]?.s ?? 0;
    if (st !== q.s) {
      if (st === 1) snd(A, 'ice_creak', b.px, b.py - 1, b.pz, { v: 0.9, key: 'sa' + b.i, gap: 0.2 });
      else if (st === 3) { snd(A, 'icicle_break', b.px, b.py, b.pz, { v: 1, key: 'sa' + b.i }); burst(A, b.px, b.py, b.pz, 10); S.shake = Math.max(S.shake || 0, 0.14); }
      else if (st === 0 && q.s === 3) snd(A, 'chime', b.px, b.y, b.pz, { v: 0.25, rate: 1.3, key: 'sr' + b.i });
      q.s = st;
    }
    q.m.visible = b.on !== false && st !== 3;
    q.g?.position.set(st === 1 ? (Math.random() - 0.5) * 0.07 : 0, 0, st === 1 ? (Math.random() - 0.5) * 0.07 : 0);
  } });
  // glace mince : craque sous deux, cède, revient
  guard(() => { for (const q of V.thins) {
    const b = q.b, st = I.s[b.i]?.s ?? 0, mat = q.m.children[0].material;
    if (st !== q.s) {
      if (st === 1) snd(A, 'ice_crack', b.px, b.py + b.hh, b.pz, { v: 0.9, key: 'ta' + b.i, gap: 0.3 });
      else if (st === 2) { snd(A, 'ice_break', b.px, b.py, b.pz, { v: 1, key: 'ta' + b.i }); fall(A, q.m); burst(A, b.px, b.py + b.hh, b.pz, 10, 0xdff4ff, 0.6, b.w); S.shake = Math.max(S.shake || 0, 0.12); }
      else if (st === 0 && q.s === 2) snd(A, 'ice_land', b.px, b.py + b.hh, b.pz, { v: 0.35, rate: 1.2, key: 'tr' + b.i });
      q.s = st;
    }
    q.m.visible = st !== 2;
    mat.emissive?.setRGB(st === 1 ? 0.25 + 0.2 * Math.sin(t * 40) : 0, st === 1 ? 0.35 : 0, st === 1 ? 0.45 : 0);
    if (st === 1) { q.m.position.x += (Math.random() - 0.5) * 0.04; q.m.position.y += Math.sin(t * 60) * 0.012; }
  } });
  // mur de glace : grince en s'ouvrant, claque en se refermant
  guard(() => { for (const q of V.gates) {
    const b = q.b, o = I.g[b.i]?.o ?? 0, d = o - q.o;
    if (d > 0 && q.o === 0) { snd(A, 'ice_creak', b.px, b.py, b.pz, { v: 0.9, rate: 0.7, key: 'g' + b.i, gap: 0.5 }); snd(A, 'chime', b.px, b.py + 2, b.pz, { v: 0.3, rate: 0.8, key: 'gc' + b.i, gap: 0.5 }); burst(A, b.px, b.py - b.hh + 0.4, b.pz, 6, 0xdff4ff, 0.5, b.d); }
    if (d < 0 && o === 0) { snd(A, 'ice_land', b.px, b.py - b.hh, b.pz, { v: 1, rate: 0.7, key: 'g' + b.i }); burst(A, b.px, b.py - b.hh + 0.3, b.pz, 8, 0xdff4ff, 0.6, b.d); S.shake = Math.max(S.shake || 0, 0.16); }
    q.o = o;
  } });
  // avalanche : grondement qui suit le mur, secousses, nuage de neige
  guard(() => { const q = V.wall; if (!q) return; const st = I.c[q.id], b = q.b, on = st?.on ? 1 : 0, dn = st?.d ? 1 : 0;
    q.m.visible = !!b.on;
    if (on && !q.on) { snd(A, 'avalanche_hit', b.px, b.py + 6, b.pz, { v: 1, ref: 22, key: 'av' }); S.shake = Math.max(S.shake || 0, 0.5); }
    if (dn && !q.d) { snd(A, 'avalanche_hit', b.px, b.py + 6, b.pz, { v: 0.6, ref: 22, rate: 0.75, key: 'av' }); puff(A, b.px, b.py + 4, b.pz, 14, 3.2, 8); }
    q.on = on; q.d = dn;
    const near = on ? Math.max(0, 1 - Math.abs(b.px - cam.x) / 34) : 0;
    q.voice.at(b.px, b.py + 6, b.pz).set(on ? 0.3 + near * 0.7 : 0, 0.9 + near * 0.2);
    if (on) { S.shake = Math.max(S.shake || 0, near * 0.2); if ((q.t -= dt) < 0) { q.t = 0.07; puff(A, b.px + 1.8, b.py + 6 + Math.random() * 8, b.pz, 2, 2.6, 8); } } });
  // floe : grince au départ, tape à l'arrivée
  guard(() => { const q = V.floe; if (!q) return; const b = q.b, mv = Math.abs(b.vx) > 0.5 ? 1 : 0;
    if (mv !== q.mv) { if (mv) snd(A, 'ice_creak', b.px, b.py + b.hh, b.pz, { v: 0.8, rate: 0.6, key: 'fl' }); else { snd(A, 'ice_land', b.px, b.py + b.hh, b.pz, { v: 0.6, rate: 0.8, key: 'fl' }); burst(A, b.px, b.py + b.hh, b.pz, 4, 0xdff4ff, 0.5, b.w); } q.mv = mv; } });
}

function links(W, n) { return n; }

export default { build, update, links };
