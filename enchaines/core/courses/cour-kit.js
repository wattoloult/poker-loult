// LES ENCHAÎNÉS — pièces MESURÉES du pack « Courtyard » (assets/exports/combat_fight_arena_psx.glb, licence : assets/LICENSE.txt) pour bâtir des arènes crazy.
// Pour chaque nœud du GLB : ses collisions en repère LOCAL du nœud (mesurées sur le modèle : coupes horizontales, surfaces planes, cartes de hauteur des toits — voir
// tools/cour-audit.py ; core/quartier.test.js recompare ces volumes au maillage réel placé). Les volumes ne sont jamais des triangles du modèle : des boîtes simples,
// ajustées à la structure (murs, socles, balcons, auvents) ; les toits en pente sont des empilements de dalles de `dy` mètres (marches de 10 cm : on les monte en
// marchant, comme l'escalier de la cour), chaque dalle en retrait de la précédente selon la pente réelle.
// Le rebord d'un toit (dalle basse, `eave` = débord du toit au-delà du mur) se saisit depuis le pied du mur : le grimpeur pend sous le débord (core/sim.js findLedge).
// Repère local : x, z du nœud ; la façade principale (balcons, auvents, perron) est du côté +z.

// murs : [x0, x1, z0, z1, hauteur] ; rebords (balcons, auvents) : [x0, x1, z0, z1, bas, haut du garde-corps, épaisseur du plancher]
// toit : contour (x0..x1, z0..z1), égout `e`, faîte `t` ; kind : 'x' = faîtage parallèle à x (pentes vers ±z, faîte en z = c), 'z' = parallèle à z (pentes vers ±x),
// 'pt' = pyramide (sommet en (cx, cz)), 'x+' = appentis qui monte vers +x (de x0 à x1), 'x-' = qui monte vers -x
const roof = (kind, x0, x1, z0, z1, e, t, o = {}) => ({ kind, x0, x1, z0, z1, e, t, c: 0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ...o });

export const PIECES = {
  // pavillon central : U ouvert vers l'avant (baie de 4,66 m où monte le perron), deux balcons filants à 3,2 m et 6,2 m (garde-corps 3,89 / 6,89), toit à deux pans 9,0 → 10,45
  B1: { node: 'Building_B1', walls: [[-7, -2.33, -5.55, 5.45, 8.95], [2.33, 7, -5.55, 5.45, 8.95], [-2.33, 2.33, -5.55, 3.44, 8.95]],
    ledges: [[-7, 7, 5.45, 6.09, 3.05, 3.89, 0.16], [-7, 7, 5.45, 6.09, 6.05, 6.89, 0.16]], // balcons : trop étroits pour s'y tenir derrière le garde-corps, on se perche dessus
    roofs: [roof('x', -7.58, 7.58, -6.09, 5.99, 8.95, 10.45, { c: -0.05, eave: 0.55 })] },
  // ailes de la cour : corps à deux pans (6,9 → 8,15 ; faîtage selon x pour B2, selon z pour B3 : les deux ailes ne sont PAS symétriques) + appentis à 45° côté cour
  // (4,0 → 6,5), auvent à garde-corps sur la façade +z (3,9 / 4,83), presque entièrement sous le débord du toit
  B2: { node: 'Building_B2', walls: [[-6.76, -4.22, -4.03, 3.96, 4.0], [-4.22, 6.24, -4.03, 3.96, 6.9]],
    ledges: [[-3.76, 6.24, 3.96, 4.51, 3.9, 4.83, 0.16]],
    roofs: [roof('x', -4.22, 6.76, -4.51, 4.45, 6.9, 8.15, { eave: 0.5 }), roof('x+', -6.76, -4.22, -4.03, 3.96, 4.0, 6.5, { eave: 0.05, edge: 1 })] },
  B3: { node: 'Building_B3', walls: [[4.22, 6.74, -4.01, 3.98, 4.0], [-6.26, 4.22, -4.01, 3.98, 6.9]],
    ledges: [[-6.26, 3.74, 3.98, 4.53, 3.9, 4.83, 0.16]],
    roofs: [roof('z', -6.74, 4.22, -4.53, 4.51, 6.9, 8.15, { eave: 0.5, cx: -1.26 }), roof('x-', 4.22, 6.74, -4.01, 3.98, 4.0, 6.5, { eave: 0.05, edge: 1 })] },
  // maison basse : socle 0,42, toit en pyramide 3,0 → 4,98 (le plus accessible : on attrape l'égout d'un saut)
  B4: { node: 'Building_B4', walls: [[-5, 5, -5.5, 5.5, 3]], roofs: [roof('pt', -5.6, 5.6, -6.1, 6.1, 3.0, 4.98, { eave: 0.75 })] },
  // maison à porche : auvent à garde-corps sur la façade +z (3,21 / 3,96), toit à deux pans parallèle à z (6,0 → 7,07)
  B5: { node: 'Building_B5', walls: [[-5, 5, -5.5, 5.5, 5.85]], ledges: [[-5, 5, 5.3, 6.11, 3.05, 3.96, 0.16]],
    roofs: [roof('z', -5.66, 5.66, -6.2, 6.2, 5.85, 7.07, { eave: 0.8 })] },
  // grands pavillons du fond (hors d'atteinte : dalles grossières, seulement pour les tirs et la caméra)
  B6: { node: 'Building_B6', walls: [[-6.5, 6.5, -4.5, 4.5, 10]], roofs: [roof('x', -7.2, 7.2, -5.16, 5.16, 9.85, 11.07, { eave: 0.85, dy: 0.35, nograb: 1 })] },
  B7: { node: 'Building_B7', walls: [[-7, 7, -4.57, 4.43, 12]], ledges: [[-7, 7, 4.43, 5.05, 5.95, 6.95, 0.27]], // auvent de façade : un perchoir à 7 m qu'on atteint depuis le petit toit de B8
    roofs: [roof('pt', -7.48, 7.48, -5.05, 4.91, 12.0, 14.84, { dy: 0.4, nograb: 1 })] },
  // maisonnette étroite à deux niveaux : avant bas (toit 4,0 → 4,52), arrière haut (6,0 → 6,67), faîtages parallèles à z
  B8: { node: 'Building_B8', walls: [[-1.5, 1.5, -4.5, 1.5, 5.85], [-1.5, 1.5, 1.5, 4.5, 3.85]],
    roofs: [roof('z', -1.81, 1.81, -4.85, 1.85, 5.85, 6.67, { eave: 0.31 }), roof('z', -1.81, 1.81, 1.15, 4.85, 3.85, 4.52, { eave: 0.31 })] },
  B9: { node: 'Building_B9', walls: [[-5, 5, -4.5, 4.5, 6.85]], roofs: [roof('x', -5.7, 5.7, -5.16, 5.16, 6.85, 8.02, { eave: 0.85 })] },
  // perron de 2 m (dans la baie de B1) : 20 ressauts de 10 cm, le grimpeur n'enjambe pas une marche de 33 cm
  Stairs: { node: 'Stairs', stairs: { w: 4.66, z0: 1, z1: -1, h: 2 } },
};

// hauteur visuelle du toit en (x, z) local (sert aux tests : comparaison au maillage)
export function roofHeight(r, x, z) {
  if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return -Infinity;
  const k = (d, a, b) => (d >= 0 ? d / b : -d / a); // part de la pente parcourue (0 au faîte, 1 à l'égout), demi-largeurs a (côté −) et b (côté +)
  if (r.kind === 'x') return r.t - (r.t - r.e) * k(z - r.c, r.c - r.z0, r.z1 - r.c);
  if (r.kind === 'z') return r.t - (r.t - r.e) * k(x - (r.cx ?? 0), (r.cx ?? 0) - r.x0, r.x1 - (r.cx ?? 0));
  if (r.kind === 'pt') return r.t - (r.t - r.e) * Math.max(k(x - r.cx, r.cx - r.x0, r.x1 - r.cx), k(z - r.cz, r.cz - r.z0, r.z1 - r.cz));
  if (r.kind === 'x+') return r.e + (r.t - r.e) * (x - r.x0) / (r.x1 - r.x0);
  if (r.kind === 'x-') return r.e + (r.t - r.e) * (r.x1 - x) / (r.x1 - r.x0);
  return -Infinity;
}
// contour de la zone du toit au-dessus de la hauteur y (rectangle, les toits du pack sont convexes)
function roofSection(r, y) {
  const f = Math.max(0, Math.min(1, (r.t - y) / (r.t - r.e))); // 1 à l'égout, 0 au faîte
  if (r.kind === 'x') return [r.x0, r.x1, r.c - f * (r.c - r.z0), r.c + f * (r.z1 - r.c)];
  if (r.kind === 'z') { const c = r.cx ?? 0; return [c - f * (c - r.x0), c + f * (r.x1 - c), r.z0, r.z1]; }
  if (r.kind === 'pt') return [r.cx - f * (r.cx - r.x0), r.cx + f * (r.x1 - r.cx), r.cz - f * (r.cz - r.z0), r.cz + f * (r.z1 - r.cz)];
  if (r.kind === 'x+') return [r.x1 - f * (r.x1 - r.x0), r.x1, r.z0, r.z1];
  if (r.kind === 'x-') return [r.x0, r.x0 + f * (r.x1 - r.x0), r.z0, r.z1];
}

// pose une pièce : (x, z) = position du nœud, rot = rotation autour de y (rad) ; ajoute les boîtes au kit K. Renvoie les indices des boîtes.
// Les boîtes sont invisibles (`noMesh`) : le rendu est le modèle du pack lui-même.
export function placePiece(K, name, x, z, rot = 0, o = {}) {
  const P = PIECES[name], c = Math.cos(rot), s = Math.sin(rot), ids = [], tag = o.tag || name;
  const at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
  const box = (x0, x1, z0, z1, y0, y1, extra = {}) => { const [wx, wz] = at((x0 + x1) / 2, (z0 + z1) / 2); ids.push(K.block(wx, y0, y1, wz, x1 - x0, z1 - z0, { noMesh: 1, yaw: rot, piece: tag, ...extra })); };
  for (const w of P.walls || []) box(w[0], w[1], w[2], w[3], 0, w[4], { nograb: 1 }); // murs (socle compris) : on ne s'accroche qu'aux rebords et aux toits
  // balcons, auvents : un volume du plancher au haut du garde-corps ; on en saisit le bord du PLANCHER (lip = l[6], épaisseur au-dessus du bas) et on se hisse
  // par-dessus le garde-corps ; ils débordent du mur (eave = leur profondeur) : on saisit aussi le plancher en pendant dessous, depuis le perchoir du balcon inférieur
  for (const l of P.ledges || []) box(l[0], l[1], l[2], l[3], l[4], l[5], { ledge: 1, eave: Math.min(0.9, l[3] - l[2]), ...(l[6] ? { lip: l[6] } : {}) });
  for (const r of P.roofs || []) {
    const dy = r.dy || 0.1, n = Math.max(1, Math.ceil((r.t - r.e) / dy - 1e-6));
    for (let k = 0; k < n; k++) { // dalle k : zone où le toit dépasse e + k·dy ; dessus à mi-marche (écart au toit visible ≤ dy/2)
      const y = r.e + k * dy, top = Math.min(r.t, y + dy / 2), [x0, x1, z0, z1] = roofSection(r, y);
      if (x1 - x0 < 0.05 || z1 - z0 < 0.05) break;
      const bottom = y - (k === 0 ? 0.12 : 0.3); // la dalle d'égout est mince comme le débord réel (on tient debout sur un balcon juste dessous)
      box(x0, x1, z0, z1, bottom, top, k === 0 && !r.nograb ? { roof: 1, eave: r.eave || 0, ...(r.edge ? { edge: 1 } : {}) } : { roof: 1, nograb: 1, ...(r.nograb ? { high: 1 } : {}) }); // high : toit hors d'atteinte
    }
  }
  if (P.stairs) { const S = P.stairs, n = 20; for (let k = 0; k < n; k++) { const zz = S.z0 + (S.z1 - S.z0) * ((k + 0.5) / n); box(-S.w / 2, S.w / 2, zz - Math.abs(S.z1 - S.z0) / n / 2, zz + Math.abs(S.z1 - S.z0) / n / 2, 0, (S.h * (k + 1)) / n, { nograb: 1, stair: 1 }); } }
  return ids;
}
