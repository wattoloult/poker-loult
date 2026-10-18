// LES ENCHAÎNÉS — rendu et sons propres au monde « jungle ». Fichier réservé à ce monde.
// Modèles : Kenney Nature Kit (CC0, assets/worlds/jungle) — nénuphars, champignons-ressorts, fleurs, buissons, troncs, statues.
// Sons : assets/sfx/jungle (cascade, rivière, grenouille, oiseau, boing ; crédits dans assets/worlds/jungle/credits-jungle.txt).
// La PHYSIQUE est dans core/sim.js (nénuphars = sink, racines = move + gate, fleurs-ressorts = launch, tronc-balance = cw) ;
// ce module ne fait que dessiner et en déduire les sons (spatialisés, jamais bloquants : tout est sous try/catch).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windOn } from '../../core/sim.js';

const NAMES = ['lily_large', 'lily_small', 'mushroom_red', 'mushroom_redTall', 'mushroom_redGroup', 'mushroom_tan', 'flower_purpleA', 'flower_redA', 'flower_yellowA',
  'plant_bushLarge', 'plant_bushDetailed', 'plant_flatTall', 'hanging_moss', 'tree_palmTall', 'tree_palmDetailedTall', 'tree_palmBend', 'log_large', 'stump_roundDetailed',
  'statue_obelisk', 'statue_head', 'statue_column', 'statue_columnDamaged'];
const SOUNDS = ['waterfall', 'river', 'frog', 'bird', 'boing'];
const M = {}; let loading = null;
const rnd = (i, k) => { const x = Math.sin(i * 91.7 + k * 17.3) * 43758.5453; return x - Math.floor(x); };
const load = () => (loading ||= (async () => {
  const ld = new GLTFLoader(), base = new URL('../../assets/worlds/jungle/', import.meta.url);
  await Promise.all(NAMES.map(async (n) => { try { const g = await ld.loadAsync(new URL(n + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); M[n] = g.scene; } catch { /* modèle absent : ignoré */ } }));
})());

let V = null; // état de la vue courante
const dist2 = (cam, x, y, z) => (cam.position.x - x) ** 2 + (cam.position.y - y) ** 2 + (cam.position.z - z) ** 2;

export default {
  build(W, grp, A) {
    const { THREE: T, S, place, Sfx } = A;
    V = { grp, springs: [], roots: [], voices: [], sndT: 0, bird: 3, frog: 2, snd: false, boing: new Map() };
    const lake = W.bodies.filter((b) => b.lily);
    V.lake = lake.length ? { x: lake.reduce((s, b) => s + b.x, 0) / lake.length, y: lake[0].y, z: lake[0].z } : null;
    for (const w of W.level.winds || []) if (w.water) V.voices.push({ w, v: Sfx.voice('jungle/waterfall', { ref: 5 }).at(w.x, w.y, w.z) });
    if (V.lake) V.river = Sfx.voice('jungle/river', { ref: 12 }).at(V.lake.x, V.lake.y, V.lake.z);
    const mine = V;
    load().then(() => {
      if (V !== mine || S.level !== grp) return; // le niveau a été reconstruit entre-temps
      const fit = (src, o, w) => { const p = place(src, o, 1); if (!p) return null; const box = new T.Box3().setFromObject(p), s = box.getSize(new T.Vector3()); p.scale.multiplyScalar(w / (Math.max(s.x, s.z) || 1)); return p; };
      // plantes plates (fleurs, buissons) : posées à une hauteur, elles devenaient immenses en largeur ; on plafonne leur emprise au sol
      const cap = (p, w) => { if (!p) return p; const s = new T.Box3().setFromObject(p).getSize(new T.Vector3()), m = Math.max(s.x, s.z); if (m > w) p.scale.multiplyScalar(w / m); return p; };
      for (const b of W.bodies) {
        const o = S.bodyMesh[b.i]; if (!o) continue;
        const top = b.hh, i = b.i, hide = () => { if (o.children[0]) o.children[0].visible = false; };
        if (b.lily) { hide(); const p = fit(M.lily_large, o, b.w * 1.15); if (p) { p.position.y = top - 0.12; p.rotation.y = rnd(i, 1) * 6; if (rnd(i, 2) > 0.4) { const f = cap(place([M.flower_redA, M.flower_purpleA, M.flower_yellowA][i % 3], o, 0.5), 0.6); if (f) f.position.set(0.5, top - 0.1, -0.3); } } }
        else if (b.spring) { const m = place(M.mushroom_red, o, 1.5); if (m) { m.position.y = top - 0.1; m.userData.base = m.scale.clone(); V.springs.push({ b, m }); } const g = place(M.plant_flatTall, o, 0.8); if (g) g.position.set(0.5, top, 0.4); }
        else if (b.root) { const l = place(M.log_large, o, 1); if (l) { l.rotation.y = Math.PI / 2; const box = new T.Box3().setFromObject(l), s = box.getSize(new T.Vector3()); l.scale.multiplyScalar(b.d * 1.05 / (s.z || 1)); l.position.y = top - 0.35; hide(); }
          const mt = place(M.hanging_moss, o, 1.1); if (mt) mt.position.set(0.5, -b.hh - 0.9, 0.2);
          const g = A.sprite(0x9dff6a, 2.4); g.position.y = top + 0.2; g.visible = false; o.add(g); V.roots.push({ b, g }); }
        else if (b.cw) { const l = place(M.log_large, o, 1); if (l) { l.rotation.y = Math.PI / 2; const box = new T.Box3().setFromObject(l), s = box.getSize(new T.Vector3()); l.scale.multiplyScalar(b.d * 1.15 / (s.z || 1)); l.position.y = top - 0.45; hide(); } }
        else if (b.rootwall) { for (let k = 0; k < 3; k++) { const mt = place(M.hanging_moss, o, 1.4); if (mt) mt.position.set(b.hw + 0.02, top - 1.3, (k - 1) * b.hd * 0.3); } }
        else if (b.plate) { const f = cap(place(M.flower_purpleA, o, 0.5), 0.7); if (f) f.position.y = top; }
        else if (b.tree) { const m = place(M.hanging_moss, o, 1.6); if (m) m.position.set(-b.hw * 0.5, -b.hh - 1.5, b.hd * 0.8); }
        // sous-bois sur les grandes plateformes fixes
        if (!b.lily && !b.spring && !b.root && !b.cw && !b.move && !b.sink && !b.crumble && !b.plank && !b.cliff && !b.door && !b.plate && b.w * b.d >= 9 && (b.mat === 'moss' || b.mat === 'wood')) {
          const pool = [M.flower_redA, M.flower_purpleA, M.flower_yellowA, M.plant_bushLarge, M.plant_bushDetailed, M.plant_flatTall, M.mushroom_tan];
          for (let k = 0; k < 3; k++) { const p = cap(place(pool[Math.floor(rnd(i, k + 5) * pool.length)], o, 0.5 + rnd(i, k + 9) * 0.7), 0.9); if (p) { p.position.set((rnd(i, k + 11) > 0.5 ? 1 : -1) * (b.hw - 0.45), top, -b.hd + 0.5 + rnd(i, k + 13) * 0.8); p.rotation.y = rnd(i, k) * 6; } }
          if (rnd(i, 3) > 0.55) { const t = place(M.tree_palmTall, o, 4.5 + rnd(i, 4) * 2); if (t) t.position.set(b.hw - 0.6, top, -b.hd + 0.6); }
        }
        if (b.mat === 'temple' && b.w >= 3 && !b.climb) { // vestiges du sanctuaire
          const s = place(b.summit ? M.statue_obelisk : [M.statue_column, M.statue_columnDamaged][i % 2], o, b.summit ? 5 : 2.6); if (s) s.position.set(b.hw - 0.6, top, b.hd - 0.6);
          if (b.summit) { const h = place(M.statue_head, o, 2.2); if (h) h.position.set(-b.hw + 1.2, top, b.hd - 1.2); }
        }
      }
    });
    const add = () => { if (V !== mine || mine.snd) return; const p = Sfx.add('jungle', SOUNDS); if (p) mine.snd = true; };
    add(); mine.add = add;
  },

  update(W, dt, t, A) {
    const v = V; if (!v) return;
    const { S, Sfx } = A, cam = S.cam;
    if (!v.snd) v.add?.(); // le contexte audio n'existe qu'après le premier geste
    // fleurs-ressorts : écrasement puis détente quand un grimpeur est catapulté dessus
    for (const s of v.springs) {
      const b = s.b, k = (s.k ||= { t: 9, last: 0 });
      for (const p of W.pl) if (Math.abs(p.x - b.px) < b.hw + 0.4 && Math.abs(p.z - b.pz) < b.hd + 0.4 && p.y > b.py && p.y < b.py + b.hh + 1.6 && p.vy > b.launch * 0.75 && t - k.last > 0.5) {
        k.t = 0; k.last = t; Sfx.one('jungle/boing', b.px, b.py + b.hh, b.pz, { v: 0.9, gap: 0.3, key: 'sp' + b.i });
      }
      k.t += dt; const e = Math.exp(-k.t * 5) * Math.sin(k.t * 22); // ressort amorti : écrasé puis allongé
      if (s.m && s.m.userData.base) { s.m.scale.set(s.m.userData.base.x * (1 - e * 0.25), s.m.userData.base.y * (1 + e * 0.5), s.m.userData.base.z * (1 - e * 0.25)); }
    }
    // racines : lueur de sève tant que le levier est actionné
    for (const r of v.roots) r.g.visible = !!W.sw.LR;
    // cascades : grondement fort quand la crue passe, rafales intermittentes comprises ; rivière près du lac
    for (const c of v.voices) {
      const near = dist2(cam, c.w.x, c.w.y, c.w.z) < 45 * 45;
      c.v.set(near ? (!c.w.pulse || windOn(W, c.w) ? 1 : 0.18) : 0);
    }
    if (v.river) v.river.set(v.lake && dist2(cam, v.lake.x, v.lake.y, v.lake.z) < 50 * 50 ? 0.5 : 0);
    // grenouilles au bord du lac, oiseaux dans la canopée : sons ponctuels, espacés au hasard
    v.sndT += dt; v.frog -= dt; v.bird -= dt;
    const c = cam.position;
    if (v.frog <= 0) { v.frog = 3 + Math.random() * 5; if (v.lake && dist2(cam, v.lake.x, v.lake.y, v.lake.z) < 40 * 40) Sfx.one('jungle/frog', v.lake.x + (Math.random() - 0.5) * 36, v.lake.y + 0.5, v.lake.z + (Math.random() - 0.5) * 6, { v: 0.8, gap: 1, ref: 4 }); }
    if (v.bird <= 0) { v.bird = 5 + Math.random() * 8; if (!v.lake || c.x < v.lake.x - 20 || c.y > 24) Sfx.one('jungle/bird', c.x + (Math.random() - 0.5) * 24, c.y + 3 + Math.random() * 4, c.z - 6 - Math.random() * 6, { v: 0.5, gap: 2, ref: 5 }); }
  },
};
