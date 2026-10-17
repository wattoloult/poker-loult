// LES ENCHAÎNÉS — décor COMPOSÉ d'un parcours (kit.deco) : des éléments placés avec intention, sans collision, qui racontent le lieu.
// tower    grande tour en ruine (étages Kenney Castle Kit habillés de la pierre du jeu), fenêtres, toit ; o: { y1, size, roof, broken }
// ruin     pan de mur écroulé ; o: { w, h, yaw }
// arch     arche de pierre (Quaternius Wall_Arch) ; o: { h, yaw }
// chain    grosse chaîne suspendue entre deux points (affaissée) ; o: { to: [x, y, z], sag }
// banner   bannière de tissu (Quaternius) ; o: { h, yaw, kind: 1 | 2 }
// wheel    roue de treuil en bois accrochée à la paroi (pièce du trébuchet Kenney) ; o: { r, spin }
// scaffold échafaudage de bois (Quaternius Prop_Support) empilé ; o: { h }
// lantern  lanterne murale allumée ; o: { light } (une vraie lumière seulement si demandé)
// flag     fanion au bout d'un mât (Kenney) ; o: { h }
import * as THREE from 'three';
import { S, LIB, sprite, linkRow, boxGeo } from './scene.js';
import * as Mechs from './mechs.js';

const HA = new THREE.Vector3(), HB = new THREE.Vector3();
let SPIN = [];
function fit(src, parent, height) {
  if (!src) return null; const o = src.clone(true), box = new THREE.Box3().setFromObject(src), h = box.max.y - box.min.y || 1, s = height / h;
  o.scale.setScalar(s); o.position.set(-((box.max.x + box.min.x) / 2) * s, -box.min.y * s, -((box.max.z + box.min.z) / 2) * s);
  const g = new THREE.Group(); g.add(o); parent.add(g); return g;
}
export function build(L, grp) {
  SPIN = [];
  const list = L.deco || []; if (!list.length) return;
  const chains = list.filter((d) => d.kind === 'chain');
  let links = null, n = 0;
  if (chains.length) { // toutes les chaînes du décor dans une seule instance (maillons figés)
    links = new THREE.InstancedMesh(S.hangLinks.geometry, S.mat.chain, chains.length * 160); links.castShadow = true; links.frustumCulled = false; grp.add(links);
  }
  for (const d of list) {
    const g = new THREE.Group(); g.position.set(d.x, d.y, d.z); g.rotation.y = d.yaw || 0; grp.add(g);
    if (d.kind === 'tower') { // étages empilés, fenêtres un étage sur trois, cassée en haut ou coiffée d'un toit
      const s = d.size || 6, top = d.y1 ?? d.y + 30, n = Math.max(1, Math.round((top - d.y) / (s * 1.07)));
      const base = Mechs.sized('tower-square-base-border', s * 1.08, s * 0.6, s * 1.08, S.mat.stone); if (base) g.add(base);
      for (let k = 0; k < n; k++) {
        const name = k % 3 === 1 ? 'tower-square-mid-windows' : 'tower-square-mid', p = Mechs.sized(name, s, s * 1.07, s, S.mat.stone);
        if (p) { p.position.y = s * 0.6 + k * s * 1.07; p.rotation.y = (k % 2) * Math.PI / 2; g.add(p); }
      }
      const yTop = s * 0.6 + n * s * 1.07;
      if (d.roof !== false) { const r = Mechs.sized('tower-square-top-roof-high', s * 1.12, s * 1.4, s * 1.12, S.mat.darkwood); if (r) { r.position.y = yTop; g.add(r); } }
      // meurtrières éclairées : quelques lueurs chaudes aux fenêtres (pas de vraies lumières)
      for (let k = 1; k < n; k += 3) { const gl = sprite(0xffa050, s * 0.35); gl.position.set(0, s * 0.6 + k * s * 1.07 + s * 0.55, s * 0.52); gl.material.opacity = 0.55; g.add(gl); }
    } else if (d.kind === 'ruin') {
      const w = d.w || 4, h = d.h || 3, k = Math.max(1, Math.round(w / 2));
      for (let i = 0; i < k; i++) { const hh = h * (0.45 + ((i * 7919) % 11) / 20); const p = Mechs.sized('wall-half', w / k, hh, 0.8, S.mat.stone); if (p) { p.position.x = -w / 2 + (i + 0.5) * (w / k); g.add(p); } }
    } else if (d.kind === 'arch') fit(LIB.Wall_Arch, g, d.h || 5);
    else if (d.kind === 'banner') fit(LIB[d.style === 2 ? 'Banner_2_Cloth' : 'Banner_1_Cloth'], g, d.h || 3);
    else if (d.kind === 'scaffold') { const h = d.h || 4, k = Math.max(1, Math.round(h / 2)); for (let i = 0; i < k; i++) { const p = fit(LIB.Prop_Support, g, h / k); if (p) p.position.y = i * (h / k); } }
    else if (d.kind === 'lantern') { const l = fit(LIB.Lantern_Wall, g, 0.7); const gl = sprite(0xffb15a, 1.8); gl.position.set(0, 0.3, 0.3); g.add(gl); if (d.light) { const pl = new THREE.PointLight(0xffa050, 14, 10, 1.8); pl.position.set(0, 0.4, 0.8); g.add(pl); } }
    else if (d.kind === 'flag') { const pole = new THREE.Mesh(boxGeo(0.12, d.h || 4, 0.12, [1, 1]), S.mat.darkwood); pole.position.y = (d.h || 4) / 2; g.add(pole); const f = Mechs.sized('flag-pennant', 0.1, 1.2, 1.6); if (f) { f.position.set(0, (d.h || 4) - 1.25, 0.8); f.traverse((m) => { if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ color: d.color || 0xb02a20, roughness: 0.8, side: THREE.DoubleSide }); }); g.add(f); } }
    else if (d.kind === 'wheel') { const w = Mechs.part('wheel'); if (w) { const r = d.r || 1.5; w.scale.setScalar(r / 0.2); w.traverse((m) => { if (m.isMesh) m.material = S.mat.darkwood; }); g.add(w); if (d.spin) SPIN.push({ w, s: d.spin }); } }
    else if (d.kind === 'chain' && links) { // chaînette : courbe affaissée en segments
      const [x1, y1, z1] = d.to, sag = d.sag ?? 1.2, seg = 8;
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg, t1 = (i + 1) / seg, f = (t) => [d.x + (x1 - d.x) * t, d.y + (y1 - d.y) * t - sag * 4 * t * (1 - t), d.z + (z1 - d.z) * t];
        HA.set(...f(t0)); HB.set(...f(t1)); n = linkRow(links, n, HA, HB, i);
      }
      grp.remove(g);
    }
  }
  if (links) { links.count = n; links.instanceMatrix.needsUpdate = true; }
}
export function update(dt) { for (const s of SPIN) s.w.rotation.z += s.s * dt; }
