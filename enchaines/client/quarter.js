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

export function build(L, grp, scene) {
  const E = L.env, nodes = {}; scene.traverse((o) => { if (o.isMesh) nodes[o.name] = o; });
  // 1. les bâtiments du pack, à leurs nouvelles places
  for (const it of E.layout) { const src = nodes[it.node]; if (!src) continue; const o = src.clone(); o.position.set(it.x, 0, it.z); o.rotation.set(0, it.r || 0, 0); o.userData.envNode = it.node; o.userData.noSway = true; grp.add(o); }
  // 2. sol pavé (échantillon de la rue d'origine), à la hauteur de l'ancienne rue ; la cour d'origine (Arena_Floor) est posée par-dessus
  const B = E.ground, pv = swatch(nodes, 'pave'), [pu, pw] = pv.userData.tile;
  const pg = new THREE.PlaneGeometry(B.x1 - B.x0 + 1.6, B.z1 - B.z0 + 1.6); pg.rotateX(-Math.PI / 2);
  { const uv = pg.attributes.uv, p = pg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / pu, p.getZ(i) / pw); }
  const floor = mesh(pg, pv, grp, (B.x0 + B.x1) / 2, -0.002, (B.z0 + B.z1) / 2); floor.castShadow = false;
  // 3. enceinte (pierre + chaperon de tuiles) avec la porte du quartier au sud
  const Q = E.bounds, h = Q.wall, th = 0.8, o = th / 2, gx = E.gate.x, gw = E.gate.w / 2;
  wallRun(grp, nodes, Q.x0 - o, Q.z0 - o, Q.x1 + o, Q.z0 - o, h, th); wallRun(grp, nodes, Q.x0 - o, Q.z0 - o, Q.x0 - o, Q.z1 + o, h, th); wallRun(grp, nodes, Q.x1 + o, Q.z0 - o, Q.x1 + o, Q.z1 + o, h, th);
  wallRun(grp, nodes, Q.x0 - o, Q.z1 + o, gx - gw - 0.6, Q.z1 + o, h, th); wallRun(grp, nodes, gx + gw + 0.6, Q.z1 + o, Q.x1 + o, Q.z1 + o, h, th);
  { // porte : deux battants de planches fermés dans un cadre de piliers, linteau et petit toit
    const wd = swatch(nodes, 'bois'), st = swatch(nodes, 'pierre'), tu = swatch(nodes, 'tuiles', 0x9aa0a6), z = Q.z1 + o, H = 5.6;
    mesh(boxGeo(gw * 2, 4.2, 0.3, wd.userData.tile), wd, grp, gx, 2.1, z + 0.1);
    mesh(boxGeo(0.12, 4.2, 0.34, wd.userData.tile), wd, grp, gx, 2.1, z + 0.08); // joint des battants
    for (const s of [-1, 1]) mesh(boxGeo(1.2, H, 1.2, st.userData.tile), st, grp, gx + s * (gw + 0.6), H / 2, z);
    mesh(boxGeo(gw * 2 + 2.4, 0.9, 1.0, wd.userData.tile), wd, grp, gx, 4.65, z);
    mesh(boxGeo(gw * 2 + 3.6, 0.2, 2.2, tu.userData.tile), tu, grp, gx, H + 0.1, z);
    mesh(coping(gw * 2 + 3.6, 2.2, 0.9, tu), tu, grp, gx, H + 0.2, z);
  }
  // 4. murets (pierre + tuiles) et caisses (planches) : mêmes dimensions que leurs collisions (core/courses/quartier.js PROPS)
  for (const [k, x, z, w, hh, d, r = 0] of E.props) {
    if (k === 'caisse') { const wd = swatch(nodes, 'bois'); mesh(boxGeo(w, hh, d, wd.userData.tile), wd, grp, x, hh / 2, z, r); if (hh > 1.5) mesh(boxGeo(w + 0.04, 0.08, d + 0.04, wd.userData.tile), swatch(nodes, 'bois', 0x7a6a5a), grp, x, hh / 2, z, r); }
    else if (k === 'muret') { const st = swatch(nodes, 'pierre'), tu = swatch(nodes, 'tuiles', 0x9aa0a6), along = w >= d; const len = along ? w : d, rr = r + (along ? 0 : Math.PI / 2);
      mesh(boxGeo(len, hh - 0.18, Math.min(w, d), st.userData.tile), st, grp, x, (hh - 0.18) / 2, z, rr); mesh(coping(len + 0.1, Math.min(w, d) + 0.16, 0.18, tu), tu, grp, x, hh - 0.18, z, rr); }
  }
  // 5. au-delà de l'enceinte : d'autres toits du quartier (mêmes nœuds, tournés et répartis, sans collision) puis un sol sombre jusqu'aux montagnes
  const far = [['Building_B5', -31, -28, Math.PI / 2], ['Building_B9', -31, -12, -Math.PI / 2], ['Building_B6', -32, 4, Math.PI / 2], ['Building_B4', -30, 19, 0.3], ['Building_B2', -10, 27, Math.PI],
    ['Building_B7', 9, 30, Math.PI], ['Building_B3', 27, 26, Math.PI], ['Building_B6', 32, 8, -Math.PI / 2], ['Building_B9', 31, -9, Math.PI / 2], ['Building_B5', 31, -26, -Math.PI / 2],
    ['Building_B4', 24, -45, Math.PI], ['Building_B1', 4, -46, Math.PI], ['Building_B9', -16, -45, Math.PI], ['Building_B8', -28, -40, 0.6]];
  for (const [n, x, z, r] of far) { const src = nodes[n]; if (!src) continue; const c = src.clone(); c.position.set(x, -0.4, z); c.rotation.set(0, r, 0); c.castShadow = false; c.userData.noSway = true; grp.add(c); }
  const out = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x5c6157, roughness: 1 })); out.rotation.x = -Math.PI / 2; out.position.y = -0.4; out.receiveShadow = true; grp.add(out);
}
