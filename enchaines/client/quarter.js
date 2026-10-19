// LES ENCHAÎNÉS — rendu d'une arène bâtie avec le pack « Courtyard » (L.env, ex. « Le Quartier du Dragon », core/courses/quartier.js).
// Les bâtiments sont les NŒUDS D'ORIGINE du GLB, posés (clones : géométrie, matériaux et textures partagés, rien n'est dupliqué en mémoire) aux places de L.env.layout.
// Ce qui n'existe pas dans le pack (sol au-delà de l'ancienne rue, enceinte, porte, murets, caisses) est construit avec ses PROPRES matériaux : des échantillons
// découpés dans ses atlas (pavé de la rue, grosses pierres, tuiles, planches), en pixels nets comme le reste du pack. Au-delà de l'enceinte, d'autres toits du même
// pack (sans collision) laissent croire que la ville continue jusqu'aux montagnes.
import * as THREE from 'three';
import { boxGeo } from './scene.js';

// échantillons : [x0, y0, x1, y1] en pixels de l'atlas (taille de référence `ref`), taille réelle en mètres, mode de répétition
const SW = {
  pave: { from: 'Street', ref: 2048, rect: [0, 0, 640, 640], m: [12.3, 12.3], wrap: THREE.RepeatWrapping }, // 16 pavés × 10 doubles rangées : se répète sans raccord
  pierre: { from: 'Building_B4', ref: 1024, rect: [516, 772, 1020, 1020], m: [4, 2], wrap: THREE.MirroredRepeatWrapping },
  tuiles: { from: 'Building_B4', ref: 1024, rect: [4, 522, 508, 1020], m: [3, 3], wrap: THREE.MirroredRepeatWrapping },
  bois: { from: 'Building_B4', ref: 1024, rect: [516, 522, 1020, 762], m: [3, 1.43], wrap: THREE.MirroredRepeatWrapping },
};
const MAT = {};
function swatch(nodes, key, tint) {
  const id = key + (tint || ''); if (MAT[id]) return MAT[id];
  const s = SW[key], img = nodes[s.from]?.material?.map?.image;
  if (!img) { console.warn('[quartier] atlas introuvable pour', key, s.from); const m = new THREE.MeshStandardMaterial({ color: 0x8a8f86, roughness: 1 }); m.userData.tile = s.m; return (MAT[id] = m); }
  const k = (img.width || s.ref) / s.ref, [x0, y0, x1, y1] = s.rect.map((v) => Math.round(v * k)), cv = document.createElement('canvas');
  cv.width = x1 - x0; cv.height = y1 - y0; cv.getContext('2d').drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = s.wrap; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0, color: tint || 0xffffff, side: THREE.DoubleSide }); m.userData.tile = s.m; // double face, comme les matériaux du pack
  return (MAT[id] = m);
}
const mesh = (g, m, grp, x, y, z, r = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = r; o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
// chaperon de tuiles à deux pans (prisme) posé sur un mur de longueur len (selon x local), largeur w, hauteur h
function coping(len, w, h, m) {
  const g = new THREE.BufferGeometry(), x = len / 2, z = w / 2, [tu, tv] = m.userData.tile;
  const P = [-x, 0, -z, x, 0, -z, x, h, 0, -x, h, 0, /* pan avant */ -x, 0, z, -x, h, 0, x, h, 0, x, 0, z, /* pignons */ -x, 0, -z, -x, h, 0, -x, 0, z, x, 0, z, x, h, 0, x, 0, -z];
  const sl = Math.hypot(z, h), U = [0, 0, len / tu, 0, len / tu, sl / tv, 0, sl / tv, 0, 0, 0, sl / tv, len / tu, sl / tv, len / tu, 0, 0, 0, z / tu, h / tv, w / tu, 0, 0, 0, z / tu, h / tv, w / tu, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 11, 13, 12]); g.computeVertexNormals(); return g;
}
// mur de pierre à chaperon de tuiles, de (ax, az) à (bx, bz)
function wallRun(grp, nodes, ax, az, bx, bz, h, th) {
  const len = Math.hypot(bx - ax, bz - az); if (len < 0.05) return; const r = -Math.atan2(bz - az, bx - ax), cx = (ax + bx) / 2, cz = (az + bz) / 2;
  const st = swatch(nodes, 'pierre'), tu = swatch(nodes, 'tuiles', 0x9aa0a6);
  mesh(boxGeo(len, h, th, st.userData.tile), st, grp, cx, h / 2, cz, r);
  mesh(boxGeo(len + 0.3, 0.16, th + 0.5, tu.userData.tile), tu, grp, cx, h + 0.08, cz, r);
  mesh(coping(len + 0.3, th + 0.5, 0.42, tu), tu, grp, cx, h + 0.16, cz, r);
}

export function build(L, grp, scene, opts = {}) {
  const E = L.env, nodes = {}; scene.traverse((o) => { if (o.isMesh) nodes[o.name] = o; });
  // 1. les bâtiments du pack, à leurs nouvelles places
  for (const it of E.layout) { const src = nodes[it.node]; if (!src) continue; const o = src.clone(); o.position.set(it.x, 0, it.z); o.rotation.set(0, it.r || 0, 0); o.userData.envNode = it.node; o.userData.noSway = true; grp.add(o); }
  // 2. sol pavé (échantillon de la rue d'origine), à la hauteur de l'ancienne rue ; la cour d'origine (Arena_Floor) est posée par-dessus
  const B = E.ground, pv = swatch(nodes, 'pave'), [pu, pw] = pv.userData.tile;
  const pg = new THREE.PlaneGeometry(B.x1 - B.x0 + 1.6, B.z1 - B.z0 + 1.6); pg.rotateX(-Math.PI / 2);
  { const uv = pg.attributes.uv, p = pg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / pu, p.getZ(i) / pw); }
  const floor = mesh(pg, pv, grp, (B.x0 + B.x1) / 2, -0.002, (B.z0 + B.z1) / 2); floor.castShadow = false;
  // 3. enceinte (pierre + chaperon de tuiles) tout autour, murs intérieurs (E.walls) et porte du quartier OUVERTE (battants rabattus contre le mur)
  const Q = E.bounds, h = Q.wall, th = 0.8, o = th / 2;
  wallRun(grp, nodes, Q.x0 - o, Q.z0 - o, Q.x1 + o, Q.z0 - o, h, th); wallRun(grp, nodes, Q.x0 - o, Q.z0 - o, Q.x0 - o, Q.z1 + o, h, th); wallRun(grp, nodes, Q.x1 + o, Q.z0 - o, Q.x1 + o, Q.z1 + o, h, th);
  wallRun(grp, nodes, Q.x0 - o, Q.z1 + o, Q.x1 + o, Q.z1 + o, h, th);
  for (const [ax, az, bx, bz] of E.walls || []) wallRun(grp, nodes, ax, az, bx, bz, h, th);
  for (const g of E.gates || []) { // piliers, linteau, petit toit ; battants ouverts à 90°, plaqués contre le mur
    const wd = swatch(nodes, 'bois'), st = swatch(nodes, 'pierre'), tu = swatch(nodes, 'tuiles', 0x9aa0a6), gw = g.w / 2, z = g.z, H = 5.6;
    for (const sg of [-1, 1]) { mesh(boxGeo(1.2, H, 1.2, st.userData.tile), st, grp, g.x + sg * (gw + 0.6), H / 2, z); mesh(boxGeo(0.3, 4.2, gw, wd.userData.tile), wd, grp, g.x + sg * (gw - 0.15), 2.1, z - gw / 2 - 0.6); }
    mesh(boxGeo(g.w + 2.4, 0.9, 1.0, wd.userData.tile), wd, grp, g.x, 4.65, z);
    mesh(boxGeo(g.w + 3.6, 0.2, 2.2, tu.userData.tile), tu, grp, g.x, H + 0.1, z);
    mesh(coping(g.w + 3.6, 2.2, 0.9, tu), tu, grp, g.x, H + 0.2, z);
  }
  // 4. murets (pierre + tuiles) et caisses (planches) : mêmes dimensions que leurs collisions (core/courses/quartier.js PROPS)
  for (const [k, x, z, w, hh, d, r = 0] of E.props) {
    if (k === 'caisse') { const wd = swatch(nodes, 'bois'); mesh(boxGeo(w, hh, d, wd.userData.tile), wd, grp, x, hh / 2, z, r); if (hh > 1.5) mesh(boxGeo(w + 0.04, 0.08, d + 0.04, wd.userData.tile), swatch(nodes, 'bois', 0x7a6a5a), grp, x, hh / 2, z, r); }
    else if (k === 'muret') { const st = swatch(nodes, 'pierre'), tu = swatch(nodes, 'tuiles', 0x9aa0a6), along = w >= d; const len = along ? w : d, rr = r + (along ? 0 : Math.PI / 2);
      mesh(boxGeo(len, hh - 0.18, Math.min(w, d), st.userData.tile), st, grp, x, (hh - 0.18) / 2, z, rr); mesh(coping(len + 0.1, Math.min(w, d) + 0.16, 0.18, tu), tu, grp, x, hh - 0.18, z, rr); }
  }
  // 5. décor japonais (modèles CC0 du jeu : lanternes, érables, bambous), à la place et à la taille de leurs collisions (core/courses/quartier.js DECOR)
  const KEY = { lanterne: 'postLantern', erable: 'mapleA', bambou: 'bamboo' };
  (E.decor || []).forEach(([k, x, z, hh], i) => { const src = opts.prop?.(KEY[k]); const o = src && opts.place?.(src, grp, hh); if (o) { o.position.x += x; o.position.z += z; o.rotation.y = (i * 2.399) % (Math.PI * 2); o.userData.noSway = k !== 'erable'; } });
  // 6. PARKOUR VISION : les éléments praticables (volumes marqués pk dans core/courses/quartier.js) en ivoire nacré
  buildParkour(L, grp, nodes);
  // 7. au-delà de l'enceinte : un sol sombre jusqu'aux montagnes (plus aucune maison hors des limites : tout ce qui est bâti se visite)
  const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x5c6157, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.4; out.receiveShadow = true; grp.add(out);
}

/* ------------------------------ PARKOUR VISION : finition ivoire nacrée des éléments praticables ------------------------------ */
// Chaque mesh est taillé sur le VOLUME DE COLLISION qui porte la fonction (barre, course murale, appui, corniche) : l'aspect dit exactement ce que le jeu permet.
// Matériaux : texture d'origine (bois du pack) teintée ivoire, vernis (clearcoat) et reflet satiné (sheen) = nacré, légère émission pour rester lisible à l'ombre et de nuit.
// Vision (touche Q, ou permanente dans les réglages) : contour ivoire lumineux (coque arrière légèrement agrandie, pas de lumière dynamique) et émission renforcée.
// État centralisé : S.pk.set(on) — un seul interrupteur pour tout l'effet.
export const PK = { mats: [], shells: [], on: false };
function pearl(nodes, kind) {
  const wd = swatch(nodes, 'bois'), base = { color: kind === 'laque' ? 0xd9cfbc : 0xe8e0cf, roughness: kind === 'metal' ? 0.3 : 0.55, metalness: kind === 'metal' ? 0.55 : 0, clearcoat: kind === 'metal' ? 1 : 0.7, clearcoatRoughness: 0.22,
    sheen: 0.6, sheenColor: new THREE.Color(0xfff4e2), sheenRoughness: 0.35, emissive: new THREE.Color(0x413b31), emissiveIntensity: 0.25 }; // ivoire chaud, pas blanc pur (les détails restent lisibles en plein jour)
  const m = new THREE.MeshPhysicalMaterial(kind === 'wood' ? { ...base, map: wd.map } : base); // laque : ivoire uni (le bois sombre du pack, teinté, restait brun) m.userData.tile = wd.userData.tile; PK.mats.push(m); return m;
}
const DARK = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.9 });
const SHELL = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.55, side: THREE.BackSide, depthWrite: false });
function withShell(o, grow = 0.045) { const sh = new THREE.Mesh(o.geometry, SHELL); sh.position.copy(o.position); sh.rotation.copy(o.rotation); const bb = (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox)).getSize(new THREE.Vector3());
  sh.scale.set(1 + (2 * grow) / Math.max(bb.x, 0.01), 1 + (2 * grow) / Math.max(bb.y, 0.01), 1 + (2 * grow) / Math.max(bb.z, 0.01)); sh.visible = false; sh.renderOrder = 2; o.parent.add(sh); PK.shells.push(sh); return o; }
function buildParkour(L, grp, nodes) {
  PK.mats = []; PK.shells = []; PK.on = false;
  const wood = pearl(nodes, 'wood'), metal = pearl(nodes, 'metal'), lacq = pearl(nodes, 'laque');
  for (const b of L.bodies) {
    if (!b.pk) continue; const r = b.yaw || 0;
    if (b.pk === 'barre') { // barre métallique ronde, scellée par une platine dans le mur côté +x
      const along = b.w >= b.d, len = along ? b.w : b.d, g = new THREE.CylinderGeometry(0.045, 0.045, len, 14); g.rotateZ(Math.PI / 2); if (!along) g.rotateY(Math.PI / 2);
      withShell(mesh(g, metal, grp, b.x, b.y, b.z, r), 0.03); const pl = mesh(new THREE.BoxGeometry(0.06, 0.32, 0.32), metal, grp, b.x + (along ? len / 2 - 0.03 : 0), b.y, b.z + (along ? 0 : len / 2 - 0.03), r); pl.castShadow = false;
    } else if (b.pk === 'corniche') { // gouttière nacrée le long des quatre arêtes saisissables de l'égout
      const top = b.y + b.h / 2, c = Math.cos(r), s = Math.sin(r), hw = b.w / 2, hd = b.d / 2;
      for (const [lx, lz, len, alongX] of [[0, hd, b.w, 1], [0, -hd, b.w, 1], [hw, 0, b.d, 0], [-hw, 0, b.d, 0]]) {
        const g = alongX ? new THREE.BoxGeometry(len, 0.11, 0.12) : new THREE.BoxGeometry(0.12, 0.11, len);
        withShell(mesh(g, metal, grp, b.x + c * lx + s * lz, top - 0.05, b.z - s * lx + c * lz, r), 0.03);
      }
    } else if (b.pk === 'wallrun') { // planche de course : lattes horizontales laquées ivoire sur un fond sombre (lisible de loin, jamais confondue avec un mur), au volume exact
      const c = Math.cos(r), sn = Math.sin(r), thin = b.w < b.d, len = thin ? b.d : b.w, dep = thin ? b.w : b.d, n = Math.max(3, Math.round(b.h / 0.42)), sh = b.h / n;
      mesh(thin ? new THREE.BoxGeometry(dep * 0.5, b.h, len) : new THREE.BoxGeometry(len, b.h, dep * 0.5), DARK, grp, b.x, b.y, b.z, r);
      for (let i = 0; i < n; i++) withShell(mesh(thin ? new THREE.BoxGeometry(dep, sh - 0.06, len) : new THREE.BoxGeometry(len, sh - 0.06, dep), lacq, grp, b.x, b.y - b.h / 2 + sh * (i + 0.5), b.z, r), 0.03);
    } else { // poutre d'appui : bois laqué ivoire, à la taille exacte du volume
      withShell(mesh(new THREE.BoxGeometry(b.w, b.h, b.d), lacq, grp, b.x, b.y, b.z, r));
    }
  }
}
export function setVision(on) { if (PK.on === on) return; PK.on = on; for (const sh of PK.shells) sh.visible = on; for (const m of PK.mats) m.emissiveIntensity = on ? 0.85 : 0.25; }

