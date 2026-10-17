// LES ENCHAÎNÉS — rendu et sons propres au monde « mech » (La Grande Horloge). Fichier réservé à ce monde.
// Dessine : tapis roulants (modèle Kenney Factory Kit + bande à chevrons qui défile à la vitesse réelle), presses (piston Kenney + tige), roues dentées
// sous les plateaux tournants (cog Kenney, tournent avec eux), jets de vapeur (bouffées + tuyau Kenney), plaques de pression.
// Sons ENREGISTRÉS (assets/sfx/mech, crédits dans assets/credits-mech.txt) DÉDUITS de l'état de la sim, comme client/mechs.js : aucun état propre.
// Crochets appelés par client/levelview.js (A = { THREE, S, LIB, PACK, place, matFor, sprite, linkRow, boxGeo, Sfx, HP, th }).
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { windOn } from '../../core/sim.js';

const SOUNDS = ['belt_loop', 'steam', 'press_slam', 'gear_click', 'piston', 'gear_loop', 'door_open', 'door_close', 'swing', 'lever_clunk'];
const MOD = {}; // modèles chargés une fois (promesses)
const load = (n) => (MOD[n] ||= new GLTFLoader().loadAsync(new URL(`../../assets/worlds/mech/${n}.glb`, import.meta.url).href)
  .then((g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g.scene; }).catch(() => null));
let ST = null; // état de rendu de la partie (reconstruit à chaque build)

// modèle étiré aux dimensions voulues (w selon x, h selon y, d selon z), posé sur y = 0 et centré
function fit(A, src, w, h, d) {
  const { THREE } = A, o = src.clone(true), box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const sx = w / (sz.x || 1), sy = h / (sz.y || 1), sz2 = d / (sz.z || 1);
  o.scale.set(sx, sy, sz2); o.position.set(-c.x * sx, -box.min.y * sy, -c.z * sz2);
  const g = new THREE.Group(); g.add(o); return g;
}
// bande de tapis : fond sombre, chevrons clairs tous les 1,2 m (une période de texture)
function beltTexture(A) {
  const { THREE } = A, c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#26262a'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#d9a63c'; g.lineWidth = 9; g.lineCap = 'butt'; g.beginPath(); g.moveTo(50, 2); g.lineTo(80, 32); g.lineTo(50, 62); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 128, (i * 53) % 64, 6, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const puff = (A, x, y, z, up) => {
  const { THREE, S } = A, s = A.sprite(0xe8eef0, 1.3); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.42;
  s.position.set(x + (Math.random() - 0.5) * 0.8, y, z + (Math.random() - 0.5) * 0.8); S.scene.add(s);
  S.fx.push({ o: s, t: 0, life: 0.8 + Math.random() * 0.5, v: new THREE.Vector3((Math.random() - 0.5) * 1.2, up, (Math.random() - 0.5) * 1.2), grow: 2.2 });
};

export default {
  build(W, grp, A) {
    const { THREE, S } = A;
    ST = { belts: [], presses: [], gears: [], vents: [], levers: [], plates: [], doors: [], lifts: [], hammers: [], prev: { sw: {}, door: {}, press: {}, wind: [], piston: {} }, loaded: false, t0: 0, grp };
    A.Sfx.add('mech', SOUNDS);
    const tex = beltTexture(A);
    for (const b of W.bodies) {
      const o = S.bodyMesh[b.i];
      if (b.mc?.k === 'belt' && o) { // tapis : bâti Kenney + bande qui défile
        const body = o.children[0], mt = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.85 }); mt.map.needsUpdate = true; const sg = Math.sign(b.mc.v) || 1; mt.map.repeat.set((sg * b.w) / 1.2, 1); // chevrons pointés dans le sens du tapis
        const band = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d - 0.7), mt); band.rotation.x = -Math.PI / 2; band.position.y = b.hh + 0.02; band.receiveShadow = true; o.add(band);
        const n = Math.max(1, Math.round(b.w / 3));
        load('conveyor-long-sides').then((src) => { if (!src || ST?.grp !== grp) return; body.visible = false; for (let k = 0; k < n; k++) { const m = fit(A, src, b.w / n + 0.02, b.h, b.d); m.position.set(-b.hw + (k + 0.5) * (b.w / n), -b.hh, 0); o.add(m); } });
        ST.belts.push({ b, mt, sg, voice: A.Sfx.voice('mech/belt_loop', { ref: 7 }) });
      }
      if (b.move?.k === 'drop' && b.hit && o) { // presse : tige + piston Kenney fixe au-dessus
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), A.matFor('iron')); rod.position.y = b.hh + 3.5; rod.castShadow = true; o.add(rod);
        load('piston-square').then((src) => { if (!src || ST?.grp !== grp) return; const h = fit(A, src, 2.6, 3.4, 2.6); h.position.set(b.x, b.y + b.hh + 4.3, b.z); grp.add(h); });
        ST.presses.push({ b, low: b.y - b.move.fall });
      }
      if (b.gear && o) { // roue dentée sous un plateau tournant : tourne avec lui
        const k = ST.gears.length; load(['cog-a', 'cog-b'][k % 2]).then((src) => { if (!src || ST?.grp !== grp) return; const m = fit(A, src, b.w * 1.25, 0.6, b.d * 1.25); m.position.set(0, -b.hh - 0.7, 0); o.add(m); });
        ST.gears.push(b);
      }
      if (b.move?.k === 'piston') ST.prev.piston[b.i] = false;
      if (b.move?.gate && b.move.k === 'lin') ST.lifts.push({ b, voice: A.Sfx.voice('mech/gear_loop', { ref: 8 }) });
      if (b.lever) ST.levers.push(b);
      if (b.plate && o) { // couronne mécanique par-dessus la plaque
        load('button-floor-round').then((src) => { if (!src || ST?.grp !== grp) return; const m = fit(A, src, 1.2, 0.25, 1.2); m.position.y = b.hh - 0.02; o.add(m); });
        ST.plates.push(b);
      }
      if (b.door) ST.doors.push(b);
      if (b.move?.k === 'pend' && b.hammer) ST.hammers.push({ b, prev: 0 });
    }
    // jets de vapeur : tuyau Kenney au pied de la colonne
    (W.level.winds || []).forEach((w, i) => {
      if (!w.steam) return;
      load('pipe-large-long').then((src) => { if (!src || ST?.grp !== grp) return; const m = fit(A, src, 0.9, 2.2, 0.9); m.position.set(w.x, w.y - w.hh - 0.9, w.z); grp.add(m); });
      ST.vents.push({ w, i, acc: 0 });
    });
  },
  update(W, dt, t, A) {
    if (!ST) return;
    const sf = A.Sfx, pv = ST.prev;
    if (!ST.loaded && (ST.t0 -= dt) <= 0) { ST.t0 = 2; ST.loaded = !!sf.add('mech', SOUNDS); } // le contexte audio n'existe qu'après le premier geste
    // ---- tapis : la bande défile à la vitesse réelle, ronronnement tant qu'il tourne ----
    for (const c of ST.belts) {
      const b = c.b, v = b.vx; c.mt.map.offset.x -= (v * dt * c.sg) / 1.2;
      c.voice.at(b.px, b.py + 0.5, b.pz).set(Math.abs(v) > 0.1 ? 0.5 + Math.min(0.3, Math.abs(v) * 0.05) : 0, 0.8 + Math.abs(v) * 0.08);
    }
    // ---- presses : coup sourd quand elles touchent le bas ----
    for (const p of ST.presses) { const low = p.b.py <= p.low + 0.05; if (low && !pv.press[p.b.i]) sf.one('mech/press_slam', p.b.px, p.b.py, p.b.pz, { v: 0.9, key: 'pr' + p.b.i, gap: 0.5, ref: 8 }); pv.press[p.b.i] = low; }
    // ---- pistons-tremplins : claquement à chaque remontée ----
    for (const b of W.bodies) if (b.move?.k === 'piston') { const up = b.vy > 4; if (up && !pv.piston[b.i]) sf.one('mech/piston', b.px, b.py, b.pz, { v: 0.9, key: 'pi' + b.i, gap: 0.8, ref: 8 }); pv.piston[b.i] = up; }
    // ---- marteaux : souffle à chaque passage au point bas ----
    for (const h of ST.hammers) { const s = h.b.px - h.b.x; if (h.prev * s < 0) sf.one('mech/swing', h.b.px, h.b.py, h.b.pz, { v: 0.6, key: 'hm' + h.b.i, gap: 0.5, ref: 7 }); h.prev = s; }
    // ---- leviers, plaques, portes ----
    for (const b of ST.levers) { const on = !!W.sw[b.lever.id]; if (on !== !!pv.sw[b.lever.id]) sf.one('mech/lever_clunk', b.px, b.py + 0.5, b.pz, { v: 0.9, key: 'lv' + b.i, gap: 0.25 }); pv.sw[b.lever.id] = on; }
    for (const b of ST.plates) { const on = !!W.sw[b.plate.id]; if (on && !pv.sw['p' + b.i]) sf.one('mech/gear_click', b.px, b.py + 0.2, b.pz, { v: 0.9, key: 'pl' + b.i, gap: 0.25 }); pv.sw['p' + b.i] = on; }
    for (const b of ST.doors) {
      const o = W.dr[b.i] || 0, was = pv.door[b.i] || 0;
      if (o > was + 0.001 && was < 0.001) sf.one('mech/door_open', b.px, b.py, b.pz, { v: 0.8, key: 'dr' + b.i, gap: 1 });
      else if (o < was - 0.001 && was > 0.99) sf.one('mech/door_close', b.px, b.py, b.pz, { v: 0.8, key: 'dr' + b.i, gap: 1 });
      pv.door[b.i] = o;
    }
    // ---- monte-charge : moteur tant que l'interrupteur est actif ----
    for (const l of ST.lifts) l.voice.at(l.b.px, l.b.py, l.b.pz).set(W.sw[l.b.move.gate] ? 0.55 : 0, 1);
    // ---- vapeur : bouffées tant que le jet jaillit, sifflement à chaque départ ----
    for (const v of ST.vents) {
      const w = v.w, on = windOn(W, w), was = pv.wind[v.i];
      if (on && was === false) sf.one('mech/steam', w.x, w.y - w.hh, w.z, { v: 0.8, key: 'st' + v.i, gap: 1.5, ref: 9, dur: 3 });
      pv.wind[v.i] = on;
      if (on) { v.acc += dt * 26; while (v.acc >= 1) { v.acc -= 1; puff(A, w.x, w.y - w.hh + Math.random() * w.hh * 1.6, w.z, 5 + Math.random() * 4); } }
    }
  },
};
