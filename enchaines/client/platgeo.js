// LES ENCHAÎNÉS — forme des plateformes : une boîte aux arêtes du dessus CHANFREINÉES (le bord accroche la lumière), la texture à l'échelle du monde
// (même taille de pierre partout, décalée d'une plateforme à l'autre pour que deux plateformes voisines ne se répètent pas), et des couleurs de sommets qui
// donnent du volume sans lumière supplémentaire : socle assombri (ombre d'ambiance), liseré clair sur le chanfrein, léger voile sur le dessus.
// Seule la FORME VISIBLE change : la boîte physique (sim.js) reste exactement la même.
import * as THREE from 'three';

const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export function platGeo(w, h, d, tile, seed = 0, tops = null) { // tops : { top: [r,g,b] (dessus + chanfrein), side: [r,g,b] (flancs) } teintes multipliées aux couleurs de sommets
  const hw = w / 2, hh = h / 2, hd = d / 2, b = Math.min(0.1, w / 5, d / 5, h / 3), ao = Math.min(1.3, h * 0.45), yb = -hh + ao; // yb : haut de la bande sombre du socle
  const ox = hash(seed, 1) * 50, oz = hash(seed, 2) * 50, tint = 0.94 + hash(seed, 3) * 0.1;
  const pos = [], uv = [], col = [], idx = [];
  const TT = tops?.top || [1, 1, 1], SS = tops?.side || [1, 1, 1];
  const v = (x, y, z, u, vv, c) => { const k = c >= 1 ? TT : c > 0.8 ? [(TT[0] + SS[0]) / 2, (TT[1] + SS[1]) / 2, (TT[2] + SS[2]) / 2] : SS; pos.push(x, y, z); uv.push(u, vv); col.push(c * tint * k[0], c * tint * k[1], c * tint * k[2]); return pos.length / 3 - 1; };
  const quad = (a, b2, c, d2) => idx.push(a, b2, c, a, c, d2);
  const tx = tile[0], tz = tile[1];
  // dessus (inset de b) : u = x, v = z
  { const c = 1.0, a0 = v(-hw + b, hh, -hd + b, (-hw + b + ox) / tx, (-hd + b + oz) / tz, c), a1 = v(hw - b, hh, -hd + b, (hw - b + ox) / tx, (-hd + b + oz) / tz, c), a2 = v(hw - b, hh, hd - b, (hw - b + ox) / tx, (hd - b + oz) / tz, c), a3 = v(-hw + b, hh, hd - b, (-hw + b + ox) / tx, (hd - b + oz) / tz, c); quad(a0, a3, a2, a1); }
  // chanfreins (4 bandes) : du dessus inset au haut de la face latérale
  const rim = 1.14, top = 1.0, yt = hh - b;
  { // face -z (arrière) / +z (avant) / -x / +x ; chacun : bande entre (inset, y=hh) et (bord, y=hh-b)
    const band = (ax, az, bx, bz, cx, cz, dx, dz, u0, u1) => { const p = v(ax, hh, az, u0, 0, top), q = v(bx, hh, bz, u1, 0, top), r = v(cx, yt, cz, u1, b / tz, rim), s = v(dx, yt, dz, u0, b / tz, rim); quad(p, q, r, s); };
    band(-hw + b, -hd + b, hw - b, -hd + b, hw - b, -hd, -hw + b, -hd, (-hw + b + ox) / tx, (hw - b + ox) / tx);   // arrière (normale vers -z)
    band(hw - b, hd - b, -hw + b, hd - b, -hw + b, hd, hw - b, hd, (hw - b + ox) / tx, (-hw + b + ox) / tx);       // avant (normale vers +z)
    band(-hw + b, hd - b, -hw + b, -hd + b, -hw, -hd + b, -hw, hd - b, (hd - b + oz) / tz, (-hd + b + oz) / tz);     // gauche
    band(hw - b, -hd + b, hw - b, hd - b, hw, hd - b, hw, -hd + b, (-hd + b + oz) / tz, (hd - b + oz) / tz);       // droite
    // coins (triangles) : sommet inset, deux points du bord
    const tri = (ax, az, bx, bz, cx, cz) => { const p = v(ax, hh, az, (ax + ox) / tx, (az + oz) / tz, top), q = v(bx, yt, bz, (bx + ox) / tx, (bz + oz) / tz, rim), r = v(cx, yt, cz, (cx + ox) / tx, (cz + oz) / tz, rim); idx.push(p, q, r); };
    tri(-hw + b, -hd + b, -hw, -hd + b, -hw + b, -hd); tri(hw - b, -hd + b, hw - b, -hd, hw, -hd + b); tri(hw - b, hd - b, hw, hd - b, hw - b, hd); tri(-hw + b, hd - b, -hw + b, hd, -hw, hd - b);
  }
  // faces latérales : deux bandes (haut → socle, socle → bas) avec dégradé d'ombre d'ambiance
  const side = (x0, z0, x1, z1, u0, u1) => {
    const n1 = v(x0, yt, z0, u0, yt / tz, 1.0), n2 = v(x1, yt, z1, u1, yt / tz, 1.0), m1 = v(x0, yb, z0, u0, yb / tz, 0.84), m2 = v(x1, yb, z1, u1, yb / tz, 0.84), f1 = v(x0, -hh, z0, u0, -hh / tz, 0.56), f2 = v(x1, -hh, z1, u1, -hh / tz, 0.56);
    quad(n1, n2, m2, m1); quad(m1, m2, f2, f1);
  };
  side(-hw, -hd, hw, -hd, (-hw + ox) / tx, (hw + ox) / tx);   // arrière
  side(hw, hd, -hw, hd, (hw + ox) / tx, (-hw + ox) / tx);       // avant
  side(-hw, hd, -hw, -hd, (hd + oz) / tx, (-hd + oz) / tx);     // gauche
  side(hw, -hd, hw, hd, (-hd + oz) / tx, (hd + oz) / tx);       // droite
  // dessous
  { const a0 = v(-hw, -hh, -hd, 0, 0, 0.5), a1 = v(hw, -hh, -hd, w / tx, 0, 0.5), a2 = v(hw, -hh, hd, w / tx, d / tz, 0.5), a3 = v(-hw, -hh, hd, 0, d / tz, 0.5); quad(a0, a1, a2, a3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// copie d'un matériau de plateforme avec couleurs de sommets (les matériaux partagés ne sont pas modifiés : d'autres meshes n'ont pas d'attribut « color »)
const CACHE = new Map();
export function platMat(mat) {
  let m = CACHE.get(mat.uuid); if (!m) { m = mat.clone(); m.vertexColors = true; m.userData = mat.userData; CACHE.set(mat.uuid, m); } return m;
}
