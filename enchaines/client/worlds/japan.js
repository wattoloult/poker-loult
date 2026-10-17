// LES ENCHAÎNÉS — rendu et sons propres au monde « japan » (Les Mille Torii). Fichier réservé à ce monde.
// Dessine : les panneaux shoji coulissants (modèle Quaternius, cadre laqué), les cloches (kane) à frapper et leur compte à rebours, la bûche de gong,
// les tatamis (texture tissée + sol de tatami des salles), les écrans shoji muraux, lanternes, le sanctuaire du sommet (modèle Kay Lousberg).
// Sons ENREGISTRÉS (assets/sfx/japan, crédits dans assets/credits-japan.txt) déduits de l'état de la sim, comme client/mechs.js : aucun état propre.
// Crochets appelés par client/levelview.js (A = { THREE, S, LIB, PACK, place, matFor, sprite, linkRow, boxGeo, Sfx, HP, th }).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windOn } from '../../core/sim.js';

const SOUNDS = ['kane', 'gong', 'shoji_open', 'shoji_close', 'bamboo', 'chimes', 'creak', 'bridge_creak'];
const MODELS = {}; // modèles propres au monde (assets/worlds/japan/*.glb), chargés une fois
const load = (name) => (MODELS[name] ||= new GLTFLoader().loadAsync(new URL('../../assets/worlds/japan/' + name + '.glb', import.meta.url).href)
  .then((g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g.scene; }).catch(() => null));

let ST = null; // état de rendu de la partie (reconstruit à chaque build)

// modèle étiré aux dimensions voulues (w selon x, h selon y, d selon z), posé sur y = 0 et centré
function fit(A, src, w, h, d) {
  const { THREE } = A, o = src.clone(true), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const sx = w / (sz.x || 1), sy = h / (sz.y || 1), sz2 = d / (sz.z || 1);
  o.scale.set(sx, sy, sz2); o.position.set(-c.x * sx, -box.min.y * sy, -c.z * sz2);
  const g = new THREE.Group(); g.add(o); return g;
}
// texture de tatami : paille tissée, bordure sombre sur les grands côtés (une natte = 2:1)
function tatamiMaterial(A) {
  const { THREE } = A, c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#a9b46c'; g.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = y % 4 ? 'rgba(255,255,220,0.10)' : 'rgba(70,80,30,0.10)'; g.fillRect(0, y, 256, 1); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + (i * 7) % 60},${100 + (i * 13) % 60},50,0.10)`; g.fillRect((i * 37) % 256, (i * 91) % 128, 2 + (i % 5), 1); }
  g.fillStyle = '#3a4a2a'; g.fillRect(0, 0, 256, 5); g.fillRect(0, 123, 256, 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
}
const box = (A, w, h, d, mat, x, y, z, parent) => { const m = new A.THREE.Mesh(new A.THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

// ---- décor du village : bosquets, bambous, lanternes de pierre, torii en fond, guirlandes de lanternes entre les plateformes ----
const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
function scenery(W, grp, A, P) {
  const { THREE, sprite } = A, lacquer = A.matFor('lacquer');
  const put = (src, h, x, y, z, ry = 0) => { const g = src && A.place(src, grp, h); if (g) { g.position.set(x, y, z); g.rotation.y = ry; } return g; };
  const trees = [P.mapleA, P.mapleB, P.mapleC, P.autumn].filter(Boolean), tw = [P.mapleA, P.mapleB].filter(Boolean);
  const statics = W.bodies.filter((b) => !b.move && !b.crumble && !b.climb && !b.ghost && !b.tatami && !b.bar && !b.plank && !b.beam && !b.post && !b.sink && b.hh >= 0.2 && b.w >= 3 && b.d >= 2.4);
  for (const b of statics) {
    const i = b.i, top = b.py + b.hh, hw = b.hw, hd = b.hd, zone = b.zone || 0, big = b.w * b.d >= 10;
    const dense = zone <= 3 || zone === 5 || zone === 11;                       // village, maison de thé, pont, pagode, sanctuaire : décor dense
    if (b.name === 'salle' || b.name === 'galerie' || b.name === 'vestibule') continue; // les salles ont déjà leurs shoji
    // rangée du fond : arbres et bambous en alternance, à l'intérieur de la plateforme
    const n = big ? Math.floor((b.w - 3) / 3.2) + (dense ? 1 : 0) : (dense && b.w >= 4 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const x = b.px + (n === 1 ? (hash(i, 1) - 0.5) * (b.w - 3) : -hw + 1.8 + (k + hash(i, k + 2) * 0.5) * ((b.w - 3.6) / Math.max(1, n - 1))), z = b.pz - hd + 0.9 + hash(i, k + 5) * 0.8;
      const r = hash(i, k + 9);
      if (r < 0.45 && trees.length) put(trees[(i + k) % trees.length], 3.6 + hash(i, k + 3) * 2.6, x, top, z, hash(i, k + 4) * 6);
      else if (r < 0.8 && P.bamboo) for (let q = 0; q < 3; q++) put(q === 1 ? (P.bambooM || P.bamboo) : P.bamboo, 3.2 + hash(i, q + k * 3) * 1.8, x + (q - 1) * 0.35, top, z + (hash(i, q + 7) - 0.5) * 0.5);
      else if (P.lantern) put(P.lantern, 1.5, x, top, z + 0.4);
    }
    // lanternes aux coins avant des grandes plateformes
    if (big && dense && P.postLantern) for (const sx of [-1, 1]) put(P.postLantern, 1.7, b.px + sx * (hw - 0.6), top, b.pz + hd - 0.55, sx > 0 ? 0 : 3);
    // le portail torii au fond, cadrant la scène (une plateforme sur deux parmi les larges, zones 1-2)
    if (b.w >= 10 && zone <= 2 && P.torii) put(P.torii, 5.4, b.px + (hash(i, 20) - 0.5) * (b.w - 6), top, b.pz - hd + 0.2);
    // petite chapelle sur la plus grande place du village
    if (zone === 1 && b.w * b.d >= 80) load('shrine').then((src) => { if (!src || ST?.grp !== grp) return; const sh = fit(A, src, 3.2, 3.2, 3.2); sh.position.set(b.px + hw - 3, top, b.pz - hd + 1.8); sh.rotation.y = -0.25; grp.add(sh); });
  }
  // guirlandes de lanternes : un fil entre deux poteaux, plateformes voisines de même zone
  const sorted = statics.filter((b) => b.w >= 4 && (b.zone <= 3 || b.zone === 5 || b.zone === 10)).sort((a, c) => a.px - c.px);
  for (let q = 0; q + 1 < sorted.length; q++) {
    const a = sorted[q], c = sorted[q + 1], ax = a.px + a.hw - 0.4, cx = c.px - c.hw + 0.4, gap = cx - ax, dy = (c.py + c.hh) - (a.py + a.hh);
    if (gap < 1.5 || gap > 9 || Math.abs(dy) > 5 || (a.zone !== c.zone)) continue;
    const ya = a.py + a.hh + 3.3, yc = c.py + c.hh + 3.3, za = a.pz - a.hd + 0.4, zc = c.pz - c.hd + 0.4;
    for (const [x, y0, z, top] of [[ax, a.py + a.hh, za, ya], [cx, c.py + c.hh, zc, yc]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, top - y0, 0.16), lacquer); m.position.set(x, (top + y0) / 2, z); m.castShadow = true; grp.add(m); }
    const pts = [], N = 12; for (let k = 0; k <= N; k++) { const u = k / N; pts.push(new THREE.Vector3(ax + (cx - ax) * u, ya + (yc - ya) * u - Math.sin(u * Math.PI) * 0.7, za + (zc - za) * u)); }
    grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2a20 })));
    const m = Math.max(2, Math.floor(gap / 1.6)); for (let k = 1; k <= m; k++) { const p = pts[Math.round((k / (m + 1)) * N)]; const l = put(P.hangLantern, 0.8, p.x, p.y - 0.8, p.z); if (l) { const g = sprite(0xffa860, 1.8); g.position.set(p.x, p.y - 0.4, p.z); grp.add(g); } }
  }
}

export default {
  build(W, grp, A) {
    const { THREE, PACK, sprite } = A, P = PACK || {}, lacquer = A.matFor('lacquer');
    ST = { shoji: [], bells: [], gongs: [], prev: { sw: {}, sh: {}, cr: {}, wind: [] }, loaded: false, t0: 0, grp };
    A.Sfx.add('japan', SOUNDS);
    const tat = tatamiMaterial(A);
    // ---- tatamis (nattes mobiles) : on remplace la matière de la boîte ----
    for (const b of W.bodies) {
      if (b.tatami) {
        const m = A.S.bodyMesh[b.i]?.children[0]; if (m) { const mt = tat.clone(); mt.map = tat.map.clone(); mt.map.needsUpdate = true; m.material = mt; m.geometry.dispose(); m.geometry = A.boxGeo(b.w, b.h, b.d, [1.82, 0.91]); }
      }
      // sol de tatami des salles : un plan par-dessus le sol de pierre
      if (b.name === 'salle' || b.name === 'galerie' || b.name === 'vestibule') {
        const mt = tat.clone(); mt.map = tat.map.clone(); mt.map.needsUpdate = true; mt.map.repeat.set(b.w / 1.82, b.d / 0.91);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), mt); pl.rotation.x = -Math.PI / 2; pl.position.set(b.x, b.y + b.h / 2 + 0.012, b.z); pl.receiveShadow = true; grp.add(pl);
        // écrans shoji sur le mur du fond (modèle) et lanternes suspendues
        const top = b.y + b.h / 2, n = Math.floor(b.w / 4);
        for (let k = 0; k < n; k++) {
          const x = b.x - b.w / 2 + (k + 0.5) * (b.w / n);
          const s = P.shoji && fit(A, P.shoji, b.w / n - 0.1, 3.9, 0.25); if (s) { s.position.set(x, top, b.z - b.d / 2 - 0.05); grp.add(s); }
          const l = P.hangLantern && A.place(P.hangLantern, grp, 0.9); if (l) { l.position.set(x + (b.w / n) / 2, top + 3.0, b.z + b.d / 2 - 0.5); const g = sprite(0xffa860, 2.2); g.position.copy(l.position).y += 0.45; grp.add(g); }
        }
        // poutre faîtière le long du fond
        box(A, b.w, 0.3, 0.45, lacquer, b.x, top + 4.1, b.z - b.d / 2 - 0.25, grp);
        for (let k = 0; k <= n; k++) box(A, 0.34, 4.2, 0.34, lacquer, b.x - b.w / 2 + k * (b.w / n), top + 2.1, b.z - b.d / 2 - 0.1, grp);
      }
      // ---- panneaux shoji : cadre laqué fixe + panneau mobile ----
      if (b.jp?.kind === 'shoji') {
        const [y0, y1, d] = b.jp.vis, g = new THREE.Group(); grp.add(g);
        const m = P.shoji && fit(A, P.shoji, d, y1 - y0, 0.36); if (m) { m.rotation.y = Math.PI / 2; g.add(m); }
        else box(A, 0.36, y1 - y0, d, A.matFor('shoji'), 0, (y1 - y0) / 2, 0, g);
        ST.shoji.push({ b, g, y0 });
        for (const sz of [-1, 1]) box(A, 0.4, y1 - y0 + 0.4, 0.4, lacquer, b.x, (y0 + y1) / 2 + 0.2, b.z + sz * (d / 2 + 0.25), grp);
        box(A, 0.45, 0.4, d + 1.1, lacquer, b.x, y1 + 0.2, b.z, grp);
        box(A, 0.42, 0.14, d + 0.2, lacquer, b.x, y0 + 0.07, b.z, grp); // rail
      }
      // ---- cloches : portique laqué + kane (modèle) qui se balance ----
      if (b.bell) {
        const big = b.bell === 'KC', floor = b.py + 0.2, H = big ? 3.4 : 2.6, y = floor, g = new THREE.Group(); g.position.set(b.px, y, b.pz); grp.add(g);
        for (const sz of [-1, 1]) box(A, 0.22, H, 0.22, lacquer, 0, H / 2, sz * (big ? 1.2 : 0.85), g);
        box(A, 0.3, 0.26, (big ? 2.6 : 1.95), lacquer, 0, H, 0, g);
        const pivot = new THREE.Group(); pivot.position.set(0, H - 0.12, 0); g.add(pivot);
        const bh = big ? 1.7 : 0.95, rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), A.S.mat.wood); rope.position.y = -0.15; pivot.add(rope);
        const holder = new THREE.Group(); holder.position.y = -0.3 - bh; pivot.add(holder);
        const glow = sprite(0xffd890, big ? 4.2 : 3); glow.position.set(0, H - 0.3 - bh / 2, 0); glow.material.opacity = 0; g.add(glow);
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), A.S.mat.wood); tail.position.set(0.35, H - 0.4 - bh - 0.5, 0); g.add(tail);
        const ent = { b, g, pivot, glow, big, E: 0, a: 0 }; ST.bells.push(ent);
        load('kane').then((src) => { if (!src || ST?.grp !== grp) return; const k = fit(A, src, bh * 0.9, bh, bh * 0.9); holder.add(k); });
      }
      if (b.gong) ST.gongs.push({ b, prev: 0 });
      if (b.summit) { // sanctuaire au fond du sommet
        load('shrine').then((src) => { if (!src || ST?.grp !== grp) return; const s = fit(A, src, 3.6, 3.6, 3.6); s.position.set(b.x + 3.4, b.y + b.h / 2, b.z - b.d / 2 + 1.7); grp.add(s); });
      }
    }
    scenery(W, grp, A, P);
  },
  update(W, dt, t, A) {
    if (!ST) return;
    const J = W.ext.japan, sf = A.Sfx, pv = ST.prev;
    if (!ST.loaded && (ST.t0 -= dt) <= 0) { ST.t0 = 2; ST.loaded = !!A.Sfx.add('japan', SOUNDS); } // le contexte audio n'existe qu'après le premier geste
    // ---- shoji ----
    for (const s of ST.shoji) {
      const b = s.b, o = J?.sh[b.i]?.o || 0, was = pv.sh[b.i] || 0;
      s.g.position.set(b.px, s.y0, b.pz);
      if (o > 0.001 && was <= 0.001) sf.one('japan/shoji_open', b.px, s.y0 + 1.5, b.pz, { v: 0.9, key: 'sj' + b.i, gap: 0.5 });
      if (o <= 0.001 && was > 0.001) sf.one('japan/shoji_close', b.px, s.y0 + 1.5, b.pz, { v: 0.9, key: 'sj' + b.i, gap: 0.5 });
      pv.sh[b.i] = o;
    }
    // ---- cloches ----
    for (const c of ST.bells) {
      const id = c.b.bell, on = !!W.sw[id], was = !!pv.sw[id], stay = W.level.jp?.bells?.[id] || 9, el = J?.bell[id] || 0;
      if (on && !was) { c.E = 1; c.a = 0; sf.one('japan/kane', c.b.px, c.b.py + 1.5, c.b.pz, { v: c.big ? 1.2 : 0.9, rate: c.big ? 0.62 : 1, key: id, gap: 0.4, ref: c.big ? 12 : 7 }); }
      pv.sw[id] = on;
      c.a += dt; c.E *= Math.exp(-dt / 1.7);
      c.pivot.rotation.z = c.E * 0.5 * Math.sin(c.a * (c.big ? 4.4 : 6.5));
      c.glow.material.opacity = on ? 0.35 + 0.35 * (1 - el / stay) * (0.8 + 0.2 * Math.sin(t * 6)) : 0;
    }
    // ---- bûche de gong : un coup sourd à chaque passage au milieu de la salle, dans le même sens ----
    for (const g of ST.gongs) { const s = g.b.pz - g.b.z; if (g.prev < 0 && s >= 0) sf.one('japan/gong', g.b.px, g.b.py, g.b.pz, { v: 0.8, key: 'gg', gap: 1.2, ref: 9 }); g.prev = s; }
    // ---- dalles, planches pourries, rafales ----
    for (const b of W.bodies) {
      if (b.plate) { const on = !!W.sw[b.plate.id]; if (on && !pv.sw['p' + b.i]) sf.one('japan/bamboo', b.px, b.py + 0.3, b.pz, { v: 0.9, key: 'pl' + b.i, gap: 0.3 }); pv.sw['p' + b.i] = on; }
      if (b.sink) { const dn = (W.sk[b.i]?.y || 0) < -0.2; if (dn && !pv.cr['s' + b.i]) sf.one('japan/bridge_creak', b.px, b.py, b.pz, { v: 0.5, key: 'br', gap: 4, dur: 2.5 }); pv.cr['s' + b.i] = dn; } // le grand pont gémit sous le poids
      if (b.crumble) { const s = W.cr[b.i]?.s || 0; if (s === 1 && !pv.cr[b.i]) sf.one('japan/creak', b.px, b.py, b.pz, { v: 0.7, key: 'cr' + b.i, gap: 0.12, rate: 0.9 + (b.i % 5) * 0.06 }); pv.cr[b.i] = s === 1; }
    }
    (W.level.winds || []).forEach((w, i) => { if (!w.pulse || w.ph) return; const on = windOn(W, w); if (on && pv.wind[i] === false) sf.one('japan/chimes', w.x, w.y, w.z, { v: 0.4, key: 'wd' + i, gap: 3, ref: 14 }); pv.wind[i] = on; });
  },
};
