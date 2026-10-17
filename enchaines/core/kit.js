// LES ENCHAÎNÉS — kit de construction des parcours. Un parcours = un fichier de core/courses/ qui décrit ses DONNÉES avec ce kit ;
// le moteur (sim.js) et le rendu (client) ne connaissent que l'objet produit par done().
// Repères : y = haut ; une plateforme est décrite par son DESSUS (top). Matériaux : noms abstraits (stone, wood, brick, metal, rock, ice,
// moss, bamboo, lacquer, crystal…) traduits en textures par le thème du monde (client/themes.js).
//
// Mécanismes (drapeaux des boîtes, interprétés par sim.js) :
//   climb / climbFaces      paroi escaladable (0 +x, 1 -x, 2 +z, 3 -z)
//   move {k:'lin'|'rot'|'pend'|'circ'|'orbit'|'piston'|'drop', ...}  animée par une fonction du temps ; `gate` = n'avance que si l'interrupteur est actif
//   crumble {t, back}       s'effondre après t s de présence, revient après back s
//   sink {d, k, max}        s'enfonce sous le poids (passerelles, ponts suspendus)
//   cw {id, side, d}        contrepoids : deux plateaux liés, le plus chargé descend, l'autre monte
//   plate {id, need}        plaque de pression (need = nombre de grimpeurs requis dessus)
//   door {open: [ids], all} porte / herse : s'ouvre (glisse vers le haut) quand les plaques ou leviers indiqués sont actifs
//   herse {mode, open, warn, fall, speed, hold, rise, ph, zone, start, look}  herse / lourde porte qui tombe et remonte au treuil (voir sim.js)
//   dbseg {id, k, n, ...}   tronçon de pont-levis (créé par drawbridge())
//   grid                    la chaîne passe au travers (barreaux)
//   lever {id}              levier : touche « Interagir » à côté pour l'actionner (bascule)
//   launch v                tremplin / piston : propulse vers le haut quand on s'y pose (ou quand il monte)
//   ice                     sol glissant ; hit = frappe et projette ; nograb = pas d'accroche ; bar = barre d'accroche (on saute de barre en barre)
// Autres données : ropes (lianes / cordes), winds (courants d'air, cascades), cams (cadrages par zone), music (par zone).

export function course(meta) {
  const B = [], CP = [], HINTS = [], ROPES = [], WINDS = [], CAMS = [], ZN = [''], MUS = [], DECO = [];
  let Z = 1;
  const K = {
    zone(n, name) { Z = n; ZN[n] = name; return K; },
    // plateforme : centre (x, z), dessus à `top`, largeur w (x), profondeur d (z), épaisseur h
    plat(x, top, z, w, d, o = {}) { const h = o.h || 0.7; B.push({ x, y: top - h / 2, z, w, h, d, mat: 'wood', zone: Z, ...o }); return B.length - 1; },
    // bloc plein de `from` jusqu'au dessus `top`
    block(x, from, top, z, w, d, o = {}) { const h = top - from; B.push({ x, y: from + h / 2, z, w, h, d, mat: 'stone', zone: Z, ...o }); return B.length - 1; },
    cp(x, y, z, o = {}) { CP.push({ x, y, z, r: 3.2, zone: Z, ...o }); return CP.length - 1; },
    hint(x, y, z, txt) { HINTS.push({ x, y, z, txt }); },
    // liane / corde : point d'attache et longueur ; on s'y accroche en sautant dessus, on se balance, on saute pour lâcher
    rope(x, y, z, len, o = {}) { ROPES.push({ x, y, z, len, zone: Z, ...o }); return ROPES.length - 1; },
    // courant d'air ou cascade : boîte alignée (centre, tailles) qui accélère les grimpeurs (m/s²) ; pulse = rafales de période T
    wind(x, y, z, w, h, d, acc, o = {}) { WINDS.push({ x, y, z, hw: w / 2, hh: h / 2, hd: d / 2, acc, zone: Z, ...o }); },
    // cadrage : dans la boîte, la caméra prend ce mode (side | three | behind | far | tunnel) et ces angles
    cam(x0, y0, z0, x1, y1, z1, o) { CAMS.push({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], ...o }); },
    music(y, key) { MUS.push({ y, key }); },
    // décor composé, sans collision (rendu par client/decor.js) : tower, ruin, arch, chain, banner, wheel, scaffold, lantern, flag
    deco(kind, x, y, z, o = {}) { DECO.push({ kind, x, y, z, zone: Z, ...o }); },
    // pont suspendu : planches qui s'enfoncent entre deux points (même hauteur), espacées de `gap`
    bridge(x0, x1, top, z, o = {}) {
      const w = o.w || 1.2, gap = o.gap ?? 0.25, d = o.d || 2.2, n = Math.max(2, Math.round(Math.abs(x1 - x0) / (w + gap))), s = (x1 - x0) / n;
      const ids = []; for (let i = 0; i < n; i++) ids.push(K.plat(x0 + s * (i + 0.5), top, z, Math.abs(s) - gap, d, { mat: o.mat || 'wood', h: 0.3, sink: o.sink || { d: 0.35, k: 34, max: 1.2 }, plank: 1, ...o.extra }));
      return ids;
    },
    // pont suspendu orienté selon z
    bridgeZ(x, top, z0, z1, o = {}) {
      const w = o.w || 2.2, gap = o.gap ?? 0.25, d = o.d || 1.2, n = Math.max(2, Math.round(Math.abs(z1 - z0) / (d + gap))), s = (z1 - z0) / n;
      const ids = []; for (let i = 0; i < n; i++) ids.push(K.plat(x, top, z0 + s * (i + 0.5), w, Math.abs(s) - gap, { mat: o.mat || 'wood', h: 0.3, sink: o.sink || { d: 0.35, k: 34, max: 1.2 }, plank: 1, ...o.extra }));
      return ids;
    },
    // herse (look 'iron') ou lourde porte (look 'wood') : passage selon x ; base = sol sous la herse, h = hauteur, d = largeur du passage (z)
    herse(x, base, z, h, d, o = {}) { const { look = 'iron', w = 0.36, ...H } = o; return K.block(x, base, base + h, z, w, d, { mat: 'metal', herse: { mode: 'cycle', ...H }, look, grid: look === 'iron' ? 1 : 0, nograb: 1, ...(look === 'stone' ? { mat: 'stone' } : {}) }); },
    // pont-levis : charnière en (hx, top), tablier de longueur len vers side (+1 = +x), largeur d ; o.open = leviers / plaques qui l'abaissent,
    // o.stay = il se relève seul après stay s ; o.up = angle relevé (rad)
    drawbridge(hx, top, z, len, d, o = {}) {
      const n = o.n || Math.max(3, Math.round(len / 0.75)), side = o.side || 1, th = o.th || 0.4, id = o.id || 'pont', up = o.up ?? 1.45, ids = [];
      const ctl = { open: o.open || [], any: o.any, stay: o.stay, lift: o.lift, drop: o.drop, vmax: o.vmax };
      for (let k = 0; k < n; k++) ids.push(K.plat(hx + side * (k + 0.5) * (len / n), top, z, len / n, d, { mat: o.mat || 'plank', h: th, dbseg: { id, k, n, len, hx, top, side, th, up, ctl } }));
      return ids;
    },
    // rangée de barres d'accroche horizontales (selon x), sous lesquelles on se suspend et de l'une à l'autre on saute
    bars(x0, x1, y, z, n, o = {}) { const ids = []; for (let i = 0; i < n; i++) ids.push(K.plat(x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y, z, 0.18, o.len || 2.4, { mat: 'metal', h: 0.18, bar: 1, ...o })); return ids; },
    done(extra = {}) {
      const tops = B.filter((b) => !b.cliff).map((b) => b.y + b.h / 2);
      return { ...meta, bodies: B, checkpoints: CP, hints: HINTS, ropes: ROPES, winds: WINDS, cams: CAMS, music: MUS, zones: ZN, deco: DECO,
        abyss: meta.abyss ?? Math.min(...tops) - 18, top: CP[CP.length - 1]?.y ?? Math.max(...tops), ...extra };
    },
    get count() { return B.length; },
  };
  return K;
}
