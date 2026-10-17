// LES ENCHAÎNÉS — physique propre au monde « deep » (les mines). Fichier réservé à ce monde.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, HP, ev, clamp, onB, inside, groundBelow, bounds, spanOf) :
//   reset(W, X)   remise à zéro : l'état du monde vit dans W.ext.deep (nombres seulement : il part dans les instantanés réseau)
//   step(W, X)    chaque pas, avant les grimpeurs
//   pose(W, b, X) pose d'une boîte marquée { ext: 'deep' } : fixe b.px / b.py / b.pz, b.vx.. et b.on ; renvoie true
//
// Données portées par les boîtes (champ `deep`) :
//   levier à impulsion   lever: {id}, deep: {pulse: s}   un coup de levier lance l'impulsion : l'interrupteur reste ACTIF exactement `pulse` s
//                        puis retombe (on ne peut pas le couper en route). Branché sur `move.gate` : wagonnet, cage de treuil, lampe.
//                        Pour qu'un va-et-vient (move.k 'lin', temps accumulé) revienne à son quai, pulse = move.T (un cycle complet).
//   étai                 deep: {k:'prop', max:1, warn:0.55, back:6}   tient `max` grimpeurs ; au-delà, il gémit puis cède (et revient après `back` s)
//   éboulement           deep: {k:'chase', id, x0, x1, v, trig:[xa,xb]}   mur de gravats qui avance de x0 vers x1 (v m/s) dès qu'un grimpeur
//                        entre dans la fenêtre `trig` ; hit:1 (projette). Les boîtes deep: {k:'cave', of:id} s'effondrent quand il les atteint.
export default {
  id: 'deep',
  reset(W) { if (W.level.world === 'deep') W.ext.deep = { t: {}, a: {}, p: {}, c: {} }; },
  step(W, X) {
    const D = W.ext.deep; if (!D) return;
    const dt = X.DT, seen = {};
    for (const b of W.bodies) {
      const d = b.deep; if (!d) continue;
      if (b.lever && d.pulse && !seen[b.lever.id]) { // levier à impulsion
        const id = b.lever.id; seen[id] = 1;
        if (D.a[id]) {
          if (!W.sw[id]) W.sw[id] = true; // verrouillé tant que l'impulsion court
          if (++D.t[id] >= Math.round(d.pulse / dt)) { D.a[id] = 0; D.t[id] = 0; W.sw[id] = false; X.ev(W, 'release', { id, x: b.px, y: b.py, z: b.pz }); }
        } else if (W.sw[id]) { D.a[id] = 1; D.t[id] = 0; }
      } else if (d.k === 'prop') { // étai : un seul à la fois
        const s = (D.p[b.i] ||= { s: 0, t: 0 }), n = X.onB(W, b), warn = d.warn ?? 0.55;
        if (s.s === 0) { if (n > (d.max ?? 1)) { s.s = 1; s.t = 0; X.ev(W, 'creak', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz }); } }
        else if (s.s === 1) {
          if (n > (d.max ?? 1)) { s.t += dt; if (s.t >= warn) { s.s = 2; s.t = 0; X.ev(W, 'snap', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz }); } }
          else { s.t = Math.max(0, s.t - dt * 2); if (s.t === 0) s.s = 0; }
        } else if ((s.t += dt) >= (d.back ?? 6)) { s.s = 0; s.t = 0; X.ev(W, 'restore', { b: b.i }); }
      } else if (d.k === 'chase') { // éboulement poursuivant
        const c = (D.c[d.id] ||= { x: d.x0, on: 0, d: 0 });
        if (!c.on && !c.d) { if (W.pl.some((p) => p.x > d.trig[0] && p.x < d.trig[1] && p.y > W.level.abyss)) { c.on = 1; X.ev(W, 'chase', { id: d.id, x: c.x, y: b.py, z: b.pz }); } }
        else if (c.on) { c.x += d.v * dt; if (c.x >= d.x1) { c.x = d.x1; c.on = 0; c.d = 1; X.ev(W, 'chaseEnd', { id: d.id, x: c.x, y: b.py, z: b.pz }); } }
      }
    }
  },
  pose(W, b, X) {
    const D = W.ext.deep, d = b.deep; if (!D || !d) return false;
    if (d.k === 'prop') {
      const s = D.p[b.i], sag = s && s.s === 1 ? 0.14 * Math.min(1, s.t / (d.warn ?? 0.55)) : 0, py = b.y - sag;
      b.on = !(s && s.s === 2); b.vy = (py - b.py) / X.DT; b.py = py; return true;
    }
    if (d.k === 'chase') {
      const c = D.c[d.id], x = c ? c.x : d.x0;
      b.vx = (x - b.px) / X.DT; b.vy = b.vz = 0; b.px = x; b.on = !!(c && c.on); return true; // n'existe que pendant la poursuite
    }
    if (d.k === 'cave') { const c = D.c[d.of]; b.on = !(c && c.x > b.x); b.vy = 0; return true; }
    return false;
  },
};
