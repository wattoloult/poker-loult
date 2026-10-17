// LES ENCHAÎNÉS — physique propre au monde « ice » (Passages glacés). Fichier réservé à ce monde.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, ev, clamp, onB…). Tout est déterministe (fonctions de W.sw, du temps
// de simulation et de la position des grimpeurs) ; l'état vit dans W.ext.ice (nombres seulement : il part dans les instantanés réseau).
// ATTENTION : le champ `ice` d'une boîte est déjà pris par le moteur (sol glissant) -> les données de ce monde sont dans `ic`.
//
// Données portées par les boîtes (champ `ic`) ; les boîtes qui BOUGENT portent aussi ext:'ice' (les helpers de core/courses/ice.js le posent) :
//   stalactite   ic:{k:'stal', r, fall, warn, back}   pendue au plafond ; quand un grimpeur passe dessous (|dx| < r, dans la hauteur de chute), elle
//                tremble `warn` s, tombe de `fall` m (pesanteur), se brise au sol (obstacle qui frappe : hit:1 sur la boîte) puis repousse après `back` s.
//   glace mince  ic:{k:'thin', max, warn, back}       porte `max` grimpeurs ; au-delà elle craque `warn` s puis cède (revient après `back` s).
//   mur de glace ic:{k:'gate', open:[ids], any, lift, speed, hold}   bloc qui coulisse vers le haut quand les plaques / leviers sont actifs, reste ouvert
//                `hold` s après leur relâchement et ne se rabaisse jamais sur quelqu'un.
//   avalanche    ic:{k:'wall', id, x0, x1, v, trig:[xa, xb]}   mur de neige (hit:1) qui avance de x0 vers x1 (v m/s) dès qu'un grimpeur entre dans trig ;
//                n'existe que pendant la course.
//   neige poudreuse  ic:{k:'powder', slow}   plafonne la vitesse au sol à slow × course.
//   courant de glace ic:{k:'cur', vx, vz}     tapis : entraîne (m/s) ceux qui se tiennent dessus, quel que soit le frottement (pente glacée).
//   levier à impulsion lever:{id}, ic:{pulse}  actif exactement `pulse` s (comme le Japon / les Mines : verrouillé, retombe seul).
export default {
  id: 'ice',
  reset(W) { if (W.level.world === 'ice') W.ext.ice = { s: {}, c: {}, g: {}, t: {}, a: {} }; },
  step(W, X) {
    const I = W.ext.ice; if (!I) return;
    const dt = X.DT, seen = {};
    for (const b of W.bodies) {
      const d = b.ic; if (!d) continue;
      if (b.lever && d.pulse && !seen[b.lever.id]) { // levier à impulsion
        const id = b.lever.id; seen[id] = 1;
        if (I.a[id]) {
          if (!W.sw[id]) W.sw[id] = true;
          if (++I.t[id] >= Math.round(d.pulse / dt)) { I.a[id] = 0; I.t[id] = 0; W.sw[id] = false; X.ev(W, 'release', { id, x: b.px, y: b.py, z: b.pz }); }
        } else if (W.sw[id]) { I.a[id] = 1; I.t[id] = 0; }
      } else if (d.k === 'stal') {
        const s = (I.s[b.i] ||= { s: 0, t: 0, d: 0, v: 0 }), r = d.r ?? 2.6, fall = d.fall ?? 8;
        if (s.s === 0) {
          if (W.pl.some((p) => Math.abs(p.x - b.x) < r && Math.abs(p.z - b.z) < b.hd + 1.6 && p.y < b.y - b.h / 2 && p.y > b.y - b.h / 2 - fall - 1.5)) { s.s = 1; s.t = 0; X.ev(W, 'icewarn', { b: b.i, x: b.x, y: b.y, z: b.z }); }
        } else if (s.s === 1) { if ((s.t += dt) >= (d.warn ?? 0.7)) { s.s = 2; s.t = 0; s.v = 0; s.d = 0; }
        } else if (s.s === 2) {
          s.v += 30 * dt; s.d += s.v * dt;
          if (s.d >= fall) { s.d = fall; s.s = 3; s.t = 0; X.ev(W, 'iceshatter', { b: b.i, x: b.x, y: b.y - fall - b.h / 2, z: b.z }); }
        } else if ((s.t += dt) >= (d.back ?? 6)) { s.s = 0; s.t = 0; s.d = 0; s.v = 0; X.ev(W, 'restore', { b: b.i }); }
      } else if (d.k === 'thin') {
        const s = (I.s[b.i] ||= { s: 0, t: 0 }), n = X.onB(W, b), warn = d.warn ?? 0.6;
        if (s.s === 0) { if (n > (d.max ?? 1)) { s.s = 1; s.t = 0; X.ev(W, 'icecrack', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz }); } }
        else if (s.s === 1) {
          if (n > (d.max ?? 1)) { s.t += dt; if (s.t >= warn) { s.s = 2; s.t = 0; X.ev(W, 'icebreak', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz }); } }
          else { s.t = Math.max(0, s.t - dt * 2); if (s.t === 0) s.s = 0; }
        } else if ((s.t += dt) >= (d.back ?? 6)) { s.s = 0; s.t = 0; X.ev(W, 'restore', { b: b.i }); }
      } else if (d.k === 'gate') {
        const g = (I.g[b.i] ||= { o: 0, h: 0 }), ids = d.open || [], ok = ids.length && (d.any ? ids.some((i) => W.sw[i]) : ids.every((i) => W.sw[i]));
        if (ok) g.h = d.hold || 0; else if (g.h > 0) g.h = Math.max(0, g.h - dt);
        let want = ok || g.h > 0;
        if (!want && g.o > 0) for (const p of W.pl) // jamais rabaissé sur quelqu'un (le bloc fermé occupe [x ± hw] × [z ± hd])
          if (Math.abs(p.x - b.x) < b.hw + X.P.R + 0.3 && Math.abs(p.z - b.z) < b.hd + X.P.R && p.y < b.y + b.hh && p.y + X.P.H > b.y - b.hh) { want = true; break; }
        const o = g.o, n = X.clamp(o + (want ? 1 : -0.7) * (d.speed ?? 0.8) * dt, 0, 1);
        if (n > 0 && o === 0) X.ev(W, 'icegate', { b: b.i, open: 1, x: b.x, y: b.y, z: b.z }); else if (n === 0 && o > 0) X.ev(W, 'icegate', { b: b.i, open: 0, x: b.x, y: b.y, z: b.z });
        g.o = n;
      } else if (d.k === 'wall') {
        const c = (I.c[d.id] ||= { x: d.x0, on: 0, d: 0 });
        if (!c.on && !c.d) { if (W.pl.some((p) => p.x > d.trig[0] && p.x < d.trig[1] && p.y > W.level.abyss)) { c.on = 1; X.ev(W, 'avalanche', { id: d.id, x: c.x, y: b.py, z: b.pz }); } }
        else if (c.on) { c.x += d.v * dt; if (c.x >= d.x1) { c.x = d.x1; c.on = 0; c.d = 1; X.ev(W, 'avalancheEnd', { id: d.id, x: c.x, y: b.py, z: b.pz }); } }
      }
    }
  },
  pose(W, b, X) {
    const I = W.ext.ice, d = b.ic; if (!I || !d) return false;
    if (d.k === 'stal') {
      const s = I.s[b.i], py = b.y - (s ? s.d : 0);
      b.on = !(s && s.s === 3); b.vy = s && s.s === 2 ? -s.v : 0; b.py = py; return true;
    }
    if (d.k === 'thin') {
      const s = I.s[b.i], sag = s && s.s === 1 ? 0.12 * Math.min(1, s.t / (d.warn ?? 0.6)) : 0, py = b.y - sag;
      b.on = !(s && s.s === 2); b.vy = (py - b.py) / X.DT; b.py = py; return true;
    }
    if (d.k === 'gate') {
      const o = I.g[b.i]?.o || 0, e = o * o * (3 - 2 * o), py = b.y + (d.lift ?? b.h + 0.2) * e;
      b.vy = (py - b.py) / X.DT; b.py = py; return true;
    }
    if (d.k === 'wall') {
      const c = I.c[d.id], x = c ? c.x : d.x0;
      b.vx = (x - b.px) / X.DT; b.vy = b.vz = 0; b.px = x; b.on = !!(c && c.on); return true;
    }
    return false;
  },
  // effets sur les grimpeurs posés sur une boîte marquée : neige poudreuse (freine), courant de glace (entraîne)
  post(W, X) {
    if (!W.ext.ice) return;
    for (const p of W.pl) {
      if (p.st !== X.ST.GROUND) continue;
      const c = W.bodies[p.gb]?.ic; if (!c) continue;
      if (c.k === 'powder') { const m = X.P.RUN * (c.slow ?? 0.6), sp = Math.hypot(p.vx, p.vz); if (sp > m) { p.vx *= m / sp; p.vz *= m / sp; } }
      else if (c.k === 'cur') { p.x += (c.vx || 0) * X.DT; p.z += (c.vz || 0) * X.DT; } // tapis : déplacement direct (le frottement de la glace n'a pas de prise)
    }
  },
};
