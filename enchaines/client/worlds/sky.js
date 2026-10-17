// LES ENCHAÎNÉS — rendu et sons propres au monde « sky » (Les Îles du Vent). Fichier réservé à ce monde.
// Modèles (assets/worlds/sky, CC0, crédits dans assets/credits-sky.txt) : nuages Quaternius (nuages-ressorts, nuages d'orage, grande roue, mer de nuages),
// moulin Quaternius, ballons de fête loafbrr1 (grappes au-dessus des nacelles). Îles, colonnes et arches : pack assets/props/sky.glb (déjà dans le jeu).
// Sons (assets/sfx/sky) : vent, rafale, craquement, carillon, bouffée, pop, choc, corde.
// La PHYSIQUE est dans core/sim.js (ressorts = launch, planches = sink, balance = cw) et core/biomes/sky.js (ballons-ascenseurs) ;
// ce module ne fait que dessiner et déduire les sons de l'état de la sim. Tout est sous try/catch : un module de monde ne casse jamais le jeu.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windOn, ST } from '../../core/sim.js';

const CLOUDS = ['cloud_a', 'cloud_b', 'cloud_c'], MODELS = [...CLOUDS, 'windmill', 'balloons'];
const SOUNDS = ['wind_loop', 'gust', 'creak', 'chime', 'puff', 'pop', 'thud', 'rope'];
const M = {}; let loading = null;
const rnd = (i, k) => { const x = Math.sin(i * 91.7 + k * 17.3) * 43758.5453; return x - Math.floor(x); };
const load = () => (loading ||= (async () => {
  const ld = new GLTFLoader(), base = new URL('../../assets/worlds/sky/', import.meta.url);
  await Promise.all(MODELS.map(async (n) => { try { const g = await ld.loadAsync(new URL(n + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); M[n] = g.scene; } catch { /* modèle absent : ignoré */ } }));
  const bs = M.balloons; // un seul fichier : on en tire quelques formes (ballon rond, étoile, cœur, fleur)
  if (bs) for (const [k, n] of [['round', 'Balloon_Balloon'], ['star', 'Balloon_Star'], ['heart', 'Balloon_Heart'], ['flower', 'Balloon_Flower_A']]) { const o = bs.getObjectByName(n); if (o) M[k] = o; }
})());

let V = null; // état de la vue courante
const d2 = (cam, x, y, z) => (cam.position.x - x) ** 2 + (cam.position.y - y) ** 2 + (cam.position.z - z) ** 2;

export default {
  build(W, grp, A) {
    const { THREE: T, S, place, Sfx } = A, L = W.level;
    V = { grp, lifts: [], springs: [], voices: [], gusts: [], planks: new Map(), rope: [0, 0], snd: false };
    const mine = V, v3 = new T.Vector3();
    // fixe un modèle à la largeur voulue (place() normalise la hauteur) ; renvoie le groupe et sa hauteur
    const fitW = (src, parent, w) => { const g = place(src, parent, 1); if (!g) return null; const s = new T.Box3().setFromObject(g).getSize(v3); g.scale.multiplyScalar(w / (Math.max(s.x, s.z) || 1)); g.userData.h = new T.Box3().setFromObject(g).getSize(v3).y; return g; };
    const tint = (g, color, emissive) => g.traverse((m) => { if (!m.isMesh) return; m.material = m.material.clone(); m.material.color?.set(color); if (emissive != null) m.material.emissive?.set(emissive); });
    const glow = (g, e = 0x6a707c) => tint(g, 0xffffff, e);
    const still = (g) => g.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    // voix du vent pour chaque courant ascendant, rafales sonores pour chaque zone pulsée
    L.winds?.forEach((w, i) => {
      if (w.updraft) V.voices.push({ w, v: Sfx.voice('sky/wind_loop', { ref: 7 }).at(w.x, w.y, w.z) });
      if (w.gust) V.gusts.push({ w, i, on: windOn(W, w) });
    });
    for (const b of W.bodies) {
      if (b.sky?.k === 'lift') V.lifts.push({ b, h: 0, m: 0, v: Sfx.voice('sky/wind_loop', { ref: 6 }).at(b.px, b.py, b.pz), g: null });
      if (b.cloud && b.launch) V.springs.push({ b, t: 9, m: null });
      if (b.plank && b.sink) V.planks.set(b.i, false);
    }
    load().then(() => {
      if (V !== mine || S.level !== grp) return; // le niveau a été reconstruit entre-temps
      for (const b of W.bodies) {
        const o = S.bodyMesh[b.i]; if (!o) continue;
        const i = b.i, hide = () => { if (o.children[0]) o.children[0].visible = false; };
        if (b.cloud) { // nuages : ressort (clair), orage (sombre), roue (blanc)
          const g = fitW(M[CLOUDS[i % 3]], o, b.w * 1.75); if (!g) continue; hide();
          g.position.y = b.hh - g.userData.h + 0.12; g.rotation.y = rnd(i, 1) * 6;
          if (b.storm) tint(g, 0x59606e, 0x15171c); else if (b.launch) tint(g, 0xffe6f0, 0x70606a); else glow(g);
          const q = V.springs.find((s) => s.b === b); if (q) q.m = g;
        } else if (b.mill) { // moulin posé sur l'île, derrière le passage
          const g = place(M.windmill, o, 6.4); if (g) { g.position.set(b.hw * 0.2, b.hh, -b.hd - 1.3); g.rotation.y = 0.35 + rnd(i, 2) * 0.5; }
        } else if (b.sky?.k === 'lift') { // nacelle : garde-corps de bois et grappe de ballons de fête
          const l = V.lifts.find((s) => s.b === b), big = b.sky.need > 1, wood = A.matFor('log'), top = b.hh;
          const bar = (w, h, d, x, y, z) => { const q = new T.Mesh(A.boxGeo(w, h, d, wood.userData.tile), wood); q.position.set(x, y, z); q.castShadow = true; o.add(q); };
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bar(0.14, 1.0, 0.14, sx * (b.hw - 0.1), top + 0.5, sz * (b.hd - 0.1));
          for (const dz of [-1, 1]) bar(b.w, 0.1, 0.12, 0, top + 1.0, dz * (b.hd - 0.1));
          bar(0.12, 0.1, b.d, -(b.hw - 0.1), top + 1.0, 0); bar(0.12, 0.1, b.d, b.hw - 0.1, top + 1.0, 0);
          const cl = new T.Group(); cl.position.y = top + 1.0 + (big ? 7.5 : 5.2); o.add(cl); // pivot de la grappe
          const forms = big ? [M.round, M.star, M.heart, M.round, M.flower] : [M.round, M.heart, M.star];
          forms.forEach((f, k) => { const g = place(f, cl, (big ? 3.6 : 2.6) * (0.85 + rnd(i, k) * 0.3)); if (!g) return; const a = (k / forms.length) * 6.283 + 0.4; g.position.set(Math.cos(a) * (big ? 1.5 : 1), rnd(i, k + 5) * 0.8 - 0.2, Math.sin(a) * (big ? 1.4 : 0.9)); g.rotation.y = rnd(i, k + 9) * 6; });
          const lines = new T.LineBasicMaterial({ color: 0xece3d2 });
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(sx * (b.hw - 0.1), top + 1.0, sz * (b.hd - 0.1)), new T.Vector3(0, cl.position.y, 0)]); o.add(new T.Line(geo, lines)); }
          if (l) l.g = cl;
        }
      }
      // mer de nuages sous le parcours et grands nuages au loin (décor, sans ombres)
      const cps = L.checkpoints, yAt = (x) => { let best = cps[0]; for (const c of cps) if (Math.abs(c.x - x) < Math.abs(best.x - x)) best = c; return best.y; };
      const xs = cps.map((c) => c.x), x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 40;
      for (let k = 0, x = x0; x < x1; k++, x += 9 + rnd(k, 3) * 7) {
        const sea = fitW(M[CLOUDS[k % 3]], grp, 16 + rnd(k, 1) * 16); if (sea) { sea.position.set(x, yAt(x) - 24 - rnd(k, 2) * 14, -6 + (rnd(k, 4) - 0.5) * 60); sea.rotation.y = rnd(k, 5) * 6; still(sea); glow(sea); }
        if (k % 2) { const far = fitW(M[CLOUDS[(k + 1) % 3]], grp, 22 + rnd(k, 6) * 26); if (far) { far.position.set(x + 8, yAt(x) + rnd(k, 7) * 26 - 8, -50 - rnd(k, 8) * 70); far.rotation.y = rnd(k, 9) * 6; still(far); glow(far, 0x7a808c); } }
      }
    }).catch((e) => console.error('sky', e));
    const add = () => { if (V !== mine || mine.snd) return; if (Sfx.add('sky', SOUNDS)) mine.snd = true; };
    add(); mine.add = add;
  },

  update(W, dt, t, A) {
    if (!V) return;
    const { S, Sfx } = A, cam = S.cam, SK = W.ext.sky;
    if (!V.snd) V.add?.();
    const guard = (f) => { try { f(); } catch (e) { if (!V.err) { V.err = 1; console.error('sky', e); } } };
    const near = (x, y, z, r) => d2(cam, x, y, z) < r * r;
    // courants ascendants : le vent chante tant qu'on est à portée
    guard(() => { for (const q of V.voices) q.v.set(near(q.w.x, q.w.y, q.w.z, 38) ? 0.55 : 0, 1); });
    // rafales : un souffle à chaque début de bourrasque
    guard(() => { for (const q of V.gusts) { const on = windOn(W, q.w); if (on && !q.on) Sfx.one('sky/gust', q.w.x, q.w.y, q.w.z, { v: 0.8, ref: 9, key: 'g' + q.i, gap: 0.6 }); q.on = on; } });
    // ballons : nacelle qui monte -> craquement + vent ; arrivée en haut -> choc et carillon ; grappe qui se balance
    guard(() => { for (const q of V.lifts) {
      const b = q.b, h = SK?.l[b.i] || 0, m = SK?.m[b.i] || 0;
      if (m !== q.m) {
        if (m === 1) { Sfx.one('sky/creak', b.px, b.py, b.pz, { v: 0.8, key: 'lc' + b.i, gap: 0.4 }); Sfx.one('sky/puff', b.px, b.py + 4, b.pz, { v: 0.7, key: 'lp' + b.i, gap: 0.3 }); }
        if (m === -1) Sfx.one('sky/creak', b.px, b.py, b.pz, { v: 0.5, rate: 0.8, key: 'lc' + b.i, gap: 0.4 });
        if (m === 0 && h > 0.5 * (b.sky.rise ?? 10)) { Sfx.one('sky/thud', b.px, b.py, b.pz, { v: 0.8, key: 'lt' + b.i, gap: 0.5 }); Sfx.one('sky/chime', b.px, b.py + 2, b.pz, { v: 0.6, key: 'lh' + b.i, gap: 0.5 }); }
        if (m === 0 && h < 0.05) Sfx.one('sky/thud', b.px, b.py, b.pz, { v: 0.4, rate: 0.8, key: 'lt' + b.i, gap: 0.5 });
        q.m = m;
      }
      q.v.at(b.px, b.py, b.pz).set(m !== 0 && near(b.px, b.py, b.pz, 40) ? 0.5 : 0, m > 0 ? 1.1 : 0.85);
      if (q.g) { q.g.rotation.z = Math.sin(t * 1.3 + b.i) * 0.05 + (m > 0 ? -0.04 : 0); q.g.rotation.x = Math.cos(t * 1.1 + b.i) * 0.04; q.g.position.y += (Math.sin(t * 2.2 + b.i) * 0.04 - (q.g.userData.bob || 0)); q.g.userData.bob = Math.sin(t * 2.2 + b.i) * 0.04; }
    } });
    // nuages-ressorts : écrasés et bouffée au moment du rebond (le rebond ne vaut que pendant 0,5 s : avant, (0,5 - t) devenait très négatif et le nuage s'étirait de plus en plus haut avec le temps = colonne rose géante)
    guard(() => { for (const q of V.springs) {
      const b = q.b, top = b.py + b.hh; q.t += dt;
      if (q.t > 0.5) for (const p of W.pl) if (p.vy > 11 && Math.abs(p.x - b.px) < b.hw + 0.4 && Math.abs(p.z - b.pz) < b.hd + 0.4 && p.y - top < 1.2 && p.y >= top - 0.2) {
        q.t = 0; Sfx.one('sky/pop', b.px, top, b.pz, { v: 0.8, key: 'sp' + b.i, gap: 0.3 }); Sfx.one('sky/puff', b.px, top, b.pz, { v: 0.7, key: 'sq' + b.i, gap: 0.3 });
      }
      if (q.m) { const k = q.t < 0.45 ? Math.sin((q.t / 0.45) * Math.PI) : 0; q.m.scale.y = (q.m.userData.sy ??= q.m.scale.y) * (1 - 0.28 * k + 0.12 * (q.t < 0.5 ? Math.max(0, Math.sin(q.t * 18) * (0.5 - q.t)) : 0)); }
    } });
    // ponts de cordes : les planches gémissent en s'enfonçant ; lianes : claquement de corde à l'accroche
    guard(() => {
      for (const [i, was] of V.planks) { const y = W.sk[i]?.y ?? 0, on = y < -0.12; if (on && !was) { const b = W.bodies[i]; Sfx.one('sky/creak', b.px, b.py, b.pz, { v: 0.35, rate: 1.2, key: 'pl' + i, gap: 0.5, ref: 5 }); } V.planks.set(i, on); }
      W.pl.forEach((p, k) => { const on = p.st === ST.ROPE ? 1 : 0; if (on && !V.rope[k]) Sfx.one('sky/rope', p.x, p.y + 1, p.z, { v: 0.8, key: 'rope' + k, gap: 0.3 }); V.rope[k] = on; });
    });
  },
};
