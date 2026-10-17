// LES ENCHAÎNÉS — rendu et sons propres au monde « summit » (Le Sommet du monde). Fichier réservé à ce monde.
// Dessine : la foudre (lueur d'annonce au sol + colonne, éclair, éclat du ciel), les rochers qui roulent (modèles Kenney), le mur d'avalanche
// (nuage de neige + blocs), les balises (colonne + vasque + flamme + compte à rebours), l'arche finale (piliers, linteau, porte qui rentre dans le linteau),
// le camp de base (tentes, feu de camp), roches et pins du décor. Physique : core/biomes/summit.js. Modèles : Kenney Nature Kit (CC0, assets/worlds/summit).
// Sons ENREGISTRÉS (assets/sfx/summit, crédits dans assets/credits-summit.txt) déduits de l'état de la sim, comme client/mechs.js : aucun état propre à synchroniser.
// Crochets appelés par client/levelview.js (A = { THREE, S, LIB, PACK, place, matFor, sprite, linkRow, boxGeo, Sfx, HP, th }).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windOn } from '../../core/sim.js';
import { boltState, rollState, tk } from '../../core/biomes/summit.js';

const SOUNDS = ['thunder_strike', 'thunder_roll', 'charge', 'gale', 'rock_roll', 'rock_hit', 'avalanche', 'ignite', 'crackle', 'arch_open'];
const NAMES = ['rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_tallA', 'rock_tallC', 'rock_tallG', 'stone_largeB', 'stone_largeD', 'stone_tallB', 'stone_smallFlatA', 'tent_detailedClosed',
  'tent_smallClosed', 'campfire_stones', 'campfire_logs', 'statue_ring', 'statue_column', 'statue_columnDamaged', 'statue_obelisk', 'tree_pineTallA', 'tree_pineSmallA', 'log', 'sign', 'fence_simpleLow', 'statue_block'];
const M = {}; let loading = null;
const top0 = (b, W) => W.bodies.filter((x) => x.i !== b.i && x.zone === b.zone && Math.abs(x.px - b.px) < 2 && !x.deco && !x.ghost).reduce((m, x) => Math.max(m, x.py + x.hh), -1e9); // dessus de la plateforme sous un abri
const rnd = (i, k) => { const x = Math.sin(i * 91.7 + k * 17.3) * 43758.5453; return x - Math.floor(x); };
const load = () => (loading ||= (async () => {
  const ld = new GLTFLoader(), base = new URL('../../assets/worlds/summit/', import.meta.url);
  await Promise.all(NAMES.map(async (n) => { try { const g = await ld.loadAsync(new URL(n + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (/^tree_pine/.test(n) && o.material.name === 'leafsDark') { o.material = o.material.clone(); o.material.color.setHex(0x4fb862); } // le pack peint les pins en turquoise
 if (/^(rock|stone|cliff)/.test(n)) { o.material = o.material.clone(); o.material.color.setHex(o.material.name === 'grass' ? 0xf0f4ff : 0x8a909e); } } }); M[n] = g.scene; } catch { /* modèle absent : ignoré */ } }));
})());

let V = null; // état de la vue courante (reconstruit à chaque build)

// modèle étiré aux dimensions voulues (w selon x, h selon y, d selon z), posé sur y = 0 et centré
function fit(A, src, w, h, d) {
  if (!src) return null;
  const { THREE } = A, o = src.clone(true), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const sx = w / (sz.x || 1), sy = h / (sz.y || 1), sz2 = d / (sz.z || 1);
  o.scale.set(sx, sy, sz2); o.position.set(-c.x * sx, -box.min.y * sy, -c.z * sz2);
  const g = new THREE.Group(); g.add(o); return g;
}
// nuage de neige : disque flou, un peu irrégulier
function cloudTexture(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 64 + Math.cos(i * 2.4) * 22, y = 64 + Math.sin(i * 1.7) * 22, r = 30 + (i % 3) * 8, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// éclair en zigzag de la hauteur y1 à y0 (tube fin), graine = pas de la frappe
function boltMesh(A, seed, h) {
  const { THREE } = A, pts = []; let x = 0, z = 0;
  const n = 16; for (let k = 0; k <= n; k++) { const f = k / n; pts.push(new THREE.Vector3(x, h * (1 - f), z)); x += (rnd(seed, k) - 0.5) * (k < n - 1 ? 3.2 : 0.2) * (1 - f * 0.4); z += (rnd(seed, k + 40) - 0.5) * 0.8; }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 48, 0.16, 5, false);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xdce8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
}

export default {
  build(W, grp, A) {
    const { THREE, S, sprite, Sfx } = A;
    const flash = document.getElementById('sm-flash') || Object.assign(document.createElement('div'), { id: 'sm-flash' });
    Object.assign(flash.style, { position: 'fixed', inset: '0', background: '#dfe8ff', opacity: '0', pointerEvents: 'none', zIndex: '4' }); if (!flash.parentNode) document.body.appendChild(flash);
    V = { grp, flash, flashV: 0, bolts: [], rocks: [], beacons: [], arch: null, avl: null, snd: 0, loaded: false, t0: 0, cloud: cloudTexture(THREE), pv: { bolt: {}, bc: {}, ar: {}, rock: {}, avl: {} } };
    Sfx.add('summit', SOUNDS);
    V.gales = (W.level.winds || []).filter((w) => w.gust).map((w) => ({ w, v: Sfx.voice('summit/gale', { ref: 9, fadeIn: 0.25, fadeOut: 0.6 }).at(w.x, w.y, w.z) }));
    const mine = V;
    // ---- foudre : lueur d'annonce, colonne, éclair (créés tout de suite : pas besoin de modèles) ----
    for (const b of W.bodies) {
      const m = b.sm; if (!m) continue;
      if (m.k === 'bolt') {
        const g = new THREE.Group(); g.position.set(b.px, b.py + b.hh, b.pz); grp.add(g);
        const mat = (c, o = 0) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
        const disc = new THREE.Mesh(new THREE.CircleGeometry(m.r, 40), mat(0xff5a30)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; g.add(disc);
        const ring = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.16, m.r, 56), mat(0xffd0a0)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(m.r * 0.9, m.r * 0.9, 70, 20, 1, true), mat(0xff8a60)); beam.position.y = 35; g.add(beam);
        const glow = sprite(0xcfe0ff, 11); glow.position.y = 1.2; glow.material.opacity = 0; g.add(glow);
        V.bolts.push({ b, m, g, disc, ring, beam, glow, bolt: null });
      } else if (m.k === 'avl') {
        const g = new THREE.Group(); g.visible = false; grp.add(g); const parts = [];
        for (let k = 0; k < 44; k++) {
          const u = rnd(k, 1), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: V.cloud, color: k % 3 ? 0xf2f6ff : 0xdfe6f4, transparent: true, depthWrite: false, opacity: 0.92, fog: false }));
          const s = 7 + rnd(k, 2) * 8; sp.scale.set(s, s * 0.8, 1); sp.position.set(-(u * u) * 17, -2 + rnd(k, 3) * 17, -2 + (rnd(k, 4) - 0.5) * 20); g.add(sp); parts.push({ sp, y0: sp.position.y, ph: rnd(k, 5) * 6 });
        }
        V.avl = { b, m, g, parts, rocks: [], fade: 0, was: 0, snd: Sfx.voice('summit/avalanche', { ref: 22, fadeIn: 0.4, fadeOut: 0.8 }).at(b.px, b.py, b.pz) };
      } else if (m.k === 'roll') {
        const g = new THREE.Group(); g.visible = false; grp.add(g);
        V.rocks.push({ b, m, g, spin: new THREE.Group(), x: b.px, snd: Sfx.voice('summit/rock_roll', { ref: 12, fadeIn: 0.15, fadeOut: 0.3 }).at(b.px, b.py, b.pz) }); g.add(V.rocks.at(-1).spin);
      } else if (m.k === 'beacon') {
        const ground = b.py - 1.0, g = new THREE.Group(); g.position.set(b.px, ground, b.pz); grp.add(g);
        const ember = sprite(0xff5a20, 0.9); ember.position.y = 1.75; ember.material.opacity = 0.45; g.add(ember);
        const flame = sprite(0xff9a38, 3.2); flame.position.y = 2.2; flame.material.opacity = 0; g.add(flame);
        const core = sprite(0xfff0b0, 1.5); core.position.y = 1.95; core.material.opacity = 0; g.add(core);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.95, 48), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
        V.beacons.push({ b, m, g, ember, flame, core, ring, id: b.lever.id, snd: Sfx.voice('summit/crackle', { ref: 6 }).at(b.px, ground + 2, b.pz) });
      } else if (m.k === 'arch') {
        const g = new THREE.Group(); grp.add(g);
        V.arch = { b, m, g, door: null, runes: null, base: b.y, glow: null };
      }
    }
    // ---- modèles : décor, rochers, balises, arche (dès qu'ils sont chargés) ----
    load().then(() => {
      if (V !== mine || S.level !== grp) return;
      const stone = A.matFor('stone');
      // camp de base : tentes, feu de camp, pins
      const camp = W.bodies[0], cx = camp.px, ct = camp.py + camp.hh;
      const tent = fit(A, M.tent_detailedClosed, 3.4, 2.4, 2.9); if (tent) { tent.position.set(cx - 3, ct, camp.pz - 2.2); tent.rotation.y = 0.5; grp.add(tent); }
      const tent2 = fit(A, M.tent_smallClosed, 2.4, 2.1, 2.7); if (tent2) { tent2.position.set(cx - 3.6, ct, camp.pz + 2); tent2.rotation.y = -0.4; grp.add(tent2); }
      const fire = fit(A, M.campfire_stones, 1.3, 0.25, 1.3); if (fire) { fire.position.set(cx + 0.8, ct, camp.pz - 2.6); grp.add(fire); const f = sprite(0xff9a3c, 1.6); f.position.set(cx + 0.8, ct + 0.6, camp.pz - 2.6); grp.add(f); S.fires.push(f); }
      const lg = fit(A, M.log, 0.5, 0.45, 1.8); if (lg) { lg.position.set(cx + 0.8, ct, camp.pz - 1.3); lg.rotation.y = 1.5; grp.add(lg); }
      const sg = fit(A, M.sign, 1.0, 1.4, 0.2); if (sg) { sg.position.set(cx + 4, ct, camp.pz + 3); sg.rotation.y = -0.5; grp.add(sg); }
      for (let k = 0; k < 6; k++) { const p = fit(A, k % 2 ? M.tree_pineTallA : M.tree_pineSmallA, 2.1 + rnd(k, 1), 6 + rnd(k, 2) * 4, 2.1 + rnd(k, 1)); if (p) { p.position.set(cx - 8 + k * 3.4, ct - 0.2, camp.pz - 5.5 - rnd(k, 3) * 1.5); grp.add(p); } }
      // roches et abris : sur chaque grande plateforme de pierre, un bloc de roche en arrière-plan ; les abris reçoivent un vrai surplomb de roche
      for (const b of W.bodies) {
        const i = b.i, o = S.bodyMesh[i], top = b.py + b.hh;
        if (b.deco === 'roof') { // surplomb : roche massive + stalactites de pierre
          const r = fit(A, M.rock_largeE, b.w + 0.9, 1.3, b.d + 0.6); if (r) { r.position.set(b.px, b.py + b.hh - 0.15, b.pz); r.rotation.y = 0; grp.add(r); }
          const r2 = fit(A, M.rock_tallA, 1.5, b.py - b.hh - top0(b, W) + 0.3, 1.1); if (r2) { r2.position.set(b.px - b.hw + 0.5, top0(b, W), b.pz - b.hd + 0.2); grp.add(r2); } // pilier de roche : le surplomb tient à la paroi
        } else if (b.deco === 'niche' && o) {
          const r = fit(A, [M.rock_tallA, M.stone_tallB, M.rock_tallC][i % 3], 1.2, 1.3 + rnd(i, 1) * 0.8, 1.0); if (r) { r.position.set(b.px + (rnd(i, 2) - 0.5), top, b.pz + b.hd - 0.6); r.rotation.y = rnd(i, 3) * 6; grp.add(r); }
        } else if (!b.deco && !b.move && !b.crumble && !b.climb && !b.post && !b.plank && !b.beam && !b.hit && !b.ghost && !b.cw && !b.bar && !b.sink && b.w * b.d >= 9 && b.zone && b.mat !== 'metal' && b.mat !== 'brass') {
          if (rnd(i, 4) > 0.3) { const r = fit(A, [M.rock_tallA, M.stone_tallB, M.rock_tallG, M.rock_tallC][i % 4], 0.9 + rnd(i, 5) * 0.7, 1 + rnd(i, 6) * 1.5, 0.8 + rnd(i, 7) * 0.6); if (r) { r.position.set(b.px + (rnd(i, 8) - 0.5) * (b.w - 1.6), top - 0.05, b.pz - b.hd + 0.5); r.rotation.y = rnd(i, 9) * 6; grp.add(r); } }
          if (rnd(i, 10) > 0.5) { const r = fit(A, M.rock_largeC, 1.3, 0.35, 1.2); if (r) { r.position.set(b.px + (rnd(i, 11) - 0.5) * (b.w - 1.4), top - 0.04, b.pz + b.hd - 0.5); r.rotation.y = rnd(i, 12) * 6; grp.add(r); } }
        }
        if (b.zone <= 2 && b.post && rnd(i, 13) > 0.5) { const p = fit(A, M.tree_pineTallA, 2.2, 7, 2.2); if (p) { p.position.set(b.px + 1, b.py - b.hh - 3.2, b.pz - 4.5); grp.add(p); } }
      }
      // rochers qui roulent
      for (const r of V.rocks) { const m = fit(A, [M.stone_largeD, M.stone_largeB][r.b.i % 2], 1.8, 1.7, 2.0); if (m) { m.position.y = -0.85; r.spin.add(m); } }
      // balises : colonne + vasque
      for (const bc of V.beacons) {
        const col = fit(A, M.statue_column, 0.55, 1.6, 0.55); if (col) bc.g.add(col);
        const bowl = fit(A, M.campfire_stones, 1.15, 0.25, 1.15); if (bowl) { bowl.position.y = 1.55; bc.g.add(bowl); }
        const base = fit(A, M.statue_block, 1.3, 0.35, 1.3); if (base) { base.position.y = 0; bc.g.add(base); }
      }
      // avalanche : blocs de roche dans le front
      if (V.avl) for (let k = 0; k < 12; k++) { const r = fit(A, [M.rock_largeA, M.stone_largeB, M.rock_tallC, M.stone_tallB][k % 4], 1.4 + rnd(k, 1) * 1.6, 1.2 + rnd(k, 2) * 1.8, 1.4 + rnd(k, 1) * 1.6); if (r) { r.position.set(-rnd(k, 3) * 5, rnd(k, 4) * 7, -2 + (rnd(k, 5) - 0.5) * 10); r.userData.w = [rnd(k, 6) - 0.5, rnd(k, 7) - 0.5]; V.avl.g.add(r); V.avl.rocks.push(r); } }
      // arche : piliers, linteau, porte qui rentre dans le linteau
      if (V.arch) {
        const { b, g } = V.arch, bot = b.y - b.hh, lintelH = 5.4, z = b.pz;
        for (const sz of [-1, 1]) {
          const p = fit(A, M.statue_column, 1.5, 11.4, 1.5); if (p) { p.position.set(b.px, bot, z + sz * (b.hd + 0.55)); g.add(p); }
          const c = fit(A, M.statue_columnDamaged, 2.1, 1.5, 2.1); if (c) { c.position.set(b.px, bot, z + sz * (b.hd + 0.55)); g.add(c); }
          const o2 = fit(A, M.statue_obelisk, 0.9, 3.4, 0.9); if (o2) { o2.position.set(b.px + 2.4, bot, z + sz * (b.hd - 0.6)); g.add(o2); }
        }
        const lintel = new THREE.Mesh(A.boxGeo(1.7, lintelH, b.d + 2.9, stone.userData.tile), stone); lintel.position.set(b.px, bot + 5.7 + lintelH / 2, z); lintel.castShadow = lintel.receiveShadow = true; g.add(lintel);
        const ring = fit(A, M.statue_ring, 2.4, 3.2, 1.2); if (ring) { ring.position.set(b.px, bot + 5.7 + lintelH, z); ring.rotation.y = Math.PI / 2; g.add(ring); }
        const door = new THREE.Mesh(A.boxGeo(b.w, b.h, b.d, stone.userData.tile), stone.clone()); door.material.emissive = new THREE.Color(0x000000); door.castShadow = door.receiveShadow = true; g.add(door); V.arch.door = door;
        const runes = new THREE.Mesh(new THREE.PlaneGeometry(b.d * 0.7, b.h * 0.78), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        runes.rotation.y = Math.PI / 2; runes.position.x = b.hw + 0.02; door.add(runes); const r2 = runes.clone(); r2.rotation.y = -Math.PI / 2; r2.position.x = -b.hw - 0.02; r2.material = runes.material; door.add(r2); V.arch.runes = runes;
        V.arch.glow = sprite(0xffd890, 9); V.arch.glow.position.set(b.px + 1.4, bot + 3.2, z); V.arch.glow.material.opacity = 0; g.add(V.arch.glow);
        // sommet : feux de part et d'autre de l'arrivée
        for (const sz of [-1, 1]) { const f = fit(A, M.campfire_stones, 1.2, 0.25, 1.2); if (f) { f.position.set(b.px + 6.5, bot, z + sz * 2.2); g.add(f); const fl = sprite(0xff9a3c, 1.6); fl.position.set(b.px + 6.5, bot + 0.6, z + sz * 2.2); g.add(fl); S.fires.push(fl); } }
      }
    });
  },

  update(W, dt, t, A) {
    if (!V) return;
    const { S, Sfx: sf } = A, E = W.ext.summit, cam = S.cam, pv = V.pv;
    if (!V.loaded && (V.t0 -= dt) <= 0) { V.t0 = 2; V.loaded = !!A.Sfx.add('summit', SOUNDS); } // le contexte audio n'existe qu'après le premier geste
    const dist = (x, y, z) => (cam ? Math.hypot(cam.position.x - x, cam.position.y - y, cam.position.z - z) : 0);
    for (const g of V.gales) g.v.set(windOn(W, g.w) ? 0.8 : 0.12, 1); // rafales : le vent hurle quand ça souffle
    // ---- foudre ----
    for (const v of V.bolts) {
      const st = boltState(W, v.m), p = pv.bolt[v.b.i], x = v.b.px, y = v.b.py + v.b.hh, z = v.b.pz;
      if (p && p.warn === 0 && st.warn > 0) sf.one('summit/charge', x, y + 1, z, { v: 0.9, key: 'ch' + v.b.i, gap: 1, ref: 14 });
      if (p && st.since < p.since) { // le coup tombe
        if (v.bolt) { v.g.remove(v.bolt); v.bolt.geometry.dispose(); }
        v.bolt = boltMesh(A, W.tick + v.b.i, 60); v.g.add(v.bolt); v.age = 0;
        sf.one('summit/thunder_strike', x, y + 6, z, { v: 1.3, key: 'th' + v.b.i, gap: 0.5, ref: 28 });
        sf.one('summit/thunder_roll', x, y + 20, z, { v: 0.7, key: 'tr', gap: 3, ref: 60, off: 0 });
        V.flashV = Math.max(V.flashV, Math.max(0.1, 0.55 - dist(x, y, z) / 160));
      }
      pv.bolt[v.b.i] = { warn: st.warn, since: st.since };
      const w = st.warn, pulse = 0.65 + 0.35 * Math.sin(t * (9 + w * 28));
      v.disc.material.opacity = w * 0.55 * pulse; v.ring.material.opacity = w * (0.5 + 0.4 * pulse) ; v.beam.material.opacity = w * 0.1 * pulse;
      v.age = (v.age ?? 9) + dt;
      const k = Math.max(0, 1 - v.age / 0.45);
      if (v.bolt) { v.bolt.material.opacity = k * (0.7 + 0.3 * Math.random()); if (k === 0) v.bolt.visible = false; else v.bolt.visible = true; }
      v.glow.material.opacity = k * 0.9; v.glow.scale.setScalar(6 + k * 10);
      if (k > 0) { v.disc.material.opacity = Math.max(v.disc.material.opacity, k * 0.5); }
    }
    V.flashV *= Math.exp(-dt / 0.12); V.flash.style.opacity = String(V.flashV > 0.01 ? V.flashV.toFixed(3) : 0);
    // ---- rochers ----
    for (const r of V.rocks) {
      const b = r.b, was = pv.rock[b.i];
      r.g.visible = !!b.on; r.g.position.set(b.px, b.py, b.pz); r.spin.rotation.z = (r.b.sm.x0 - b.px) / 0.85;
      r.snd.at(b.px, b.py, b.pz).set(b.on ? 0.9 : 0, 1);
      if (was && !b.on) sf.one('summit/rock_hit', r.b.sm.x1, b.py, b.pz, { v: 1.2, key: 'rk' + b.i, gap: 1, ref: 12 });
      pv.rock[b.i] = !!b.on;
    }
    // ---- avalanche ----
    const av = V.avl;
    if (av) {
      const c = E?.av[av.m.id], on = !!c?.on, d = !!c?.d;
      if (on && !av.was) { sf.one('summit/rock_hit', c.x, av.b.py + 4, av.b.pz, { v: 1.2, key: 'av0', gap: 2, ref: 30 }); sf.one('summit/thunder_roll', c.x, av.b.py + 8, av.b.pz, { v: 0.8, key: 'av1', gap: 4, ref: 60 }); av.fade = 1; }
      if (d && av.was === 1) av.fade = 1;
      av.was = on ? 1 : d ? 2 : 0;
      if (d) av.fade = Math.max(0, av.fade - dt / 3.5);
      av.g.visible = on || (d && av.fade > 0);
      if (av.g.visible) {
        const x = c ? c.x : av.m.x0; av.g.position.set(x, av.b.py, av.b.pz);
        for (const q of av.parts) { q.sp.position.y = q.y0 + Math.sin(t * 1.6 + q.ph) * 0.5; q.sp.material.opacity = 0.92 * (d ? av.fade : 1); q.sp.material.rotation = t * 0.1 + q.ph; }
        for (const r of av.rocks) { r.rotation.x += dt * 2 * r.userData.w[0]; r.rotation.z += dt * 2.4 * r.userData.w[1]; r.visible = !d || av.fade > 0.5; }
      }
      av.snd.at(c ? c.x : av.m.x0, av.b.py + 3, av.b.pz).set(on ? 1 : 0, 1);
      if (on) sf.one('summit/rock_hit', c.x - 6 + Math.random() * 3, av.b.py + 2, av.b.pz, { v: 0.5, key: 'avr', gap: 0.9 + Math.random() * 1.2, ref: 20, rate: 0.6 + Math.random() * 0.4 });
    }
    // ---- balises ----
    for (const bc of V.beacons) {
      const on = !!W.sw[bc.id], was = pv.bc[bc.id], s = E?.bc[bc.id], lock = !!E?.ar.lock;
      const x = bc.b.px, y = bc.g.position.y + 2, z = bc.b.pz;
      if (on && !was) sf.one('summit/ignite', x, y, z, { v: 1.1, key: 'ig' + bc.id, gap: 0.3, ref: 10 });
      pv.bc[bc.id] = on;
      const left = on ? (lock ? 1 : s?.a ? 1 - (s.t || 0) / tk(bc.m.pulse ?? 2.2) : 0) : 0, fl = 1 + Math.sin(t * 19 + bc.b.i) * 0.08 + Math.sin(t * 31 + bc.b.i * 2) * 0.05;
      bc.flame.material.opacity = on ? 0.85 : 0; bc.flame.scale.setScalar((on ? 3.3 : 0.4) * fl); bc.flame.material.color.setHex(lock ? 0xffd070 : 0xff9a38);
      bc.core.material.opacity = on ? 0.9 : 0; bc.core.scale.setScalar(1.6 * fl);
      bc.ember.material.opacity = on ? 0 : 0.4 + 0.15 * Math.sin(t * 4 + bc.b.i);
      bc.ring.material.opacity = on ? (lock ? 0.6 : 0.9) : 0; bc.ring.scale.setScalar(Math.max(0.01, left));
      bc.snd.at(x, y, z).set(on ? 0.5 : 0, 1);
    }
    // ---- arche ----
    const ar = V.arch;
    if (ar) {
      const b = ar.b, o = E?.ar[b.i]?.o || 0, lit = V.beacons.reduce((n, q) => n + (W.sw[q.id] ? 1 : 0), 0), lock = !!E?.ar.lock, pa = pv.ar;
      if (ar.door) ar.door.position.set(b.px, b.py, b.pz);
      const glow = lock ? 1 : lit / 3 * 0.6;
      if (ar.runes) ar.runes.material.opacity = glow * (0.75 + 0.25 * Math.sin(t * 5));
      if (ar.glow) ar.glow.material.opacity = glow * 0.5;
      if (ar.door) ar.door.material.emissive.setRGB(glow * 0.35, glow * 0.22, glow * 0.05);
      if (lock && !pa.lock) sf.one('summit/thunder_roll', b.px, b.py + 4, b.pz, { v: 0.6, key: 'al', gap: 5, ref: 40 });
      if (o > 0 && !(pa.o > 0)) sf.one('summit/arch_open', b.px, b.py + 2, b.pz, { v: 1.1, key: 'ao', gap: 8, ref: 24 });
      if (o >= 1 && pa.o < 1) sf.one('summit/rock_hit', b.px, b.py + 5, b.pz, { v: 1, key: 'ae', gap: 3, ref: 20 });
      pa.o = o; pa.lock = lock;
    }
  },
};
