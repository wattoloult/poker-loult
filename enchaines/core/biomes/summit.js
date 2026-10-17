// LES ENCHAÎNÉS — physique propre au monde « summit » (Le Sommet du monde). Fichier réservé à ce monde.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, HP, ev, clamp, onB, inside, groundBelow, bounds, spanOf, toAir) :
//   reset(W, X) · step(W, X) · pose(W, b, X) · post(W, X)
// Tout est déterministe (fonction du pas W.tick) ; l'état qui n'en découle pas vit dans W.ext.summit (part dans les instantanés réseau).
// Les mécanismes sont portés par des boîtes { ext: 'summit', sm: {...} } (le plus souvent `ghost` : porteurs de données sans collision) :
//   foudre      sm:{k:'bolt', T, ph, warn, r, y0, y1}   un éclair frappe la colonne (x, z) de rayon r toutes les T s (ph = déphasage 0..1) ; il est
//                                                       annoncé `warn` s avant (lueur au sol, grésillement). Frappe de y0 à y1 (relatif au dessus de la
//                                                       boîte). Un abri (roche au-dessus de la tête, à moins de 4 m) protège. Les touchés sont projetés.
//   rocher      sm:{k:'roll', x0, x1, T, run, ph}       rocher qui roule de x0 à x1 pendant `run` x T s puis disparaît ; boîte `hit` (projette).
//   avalanche   sm:{k:'avl', id, x0, x1, v, trig}       mur de neige : part de x0 vers x1 (v m/s) dès qu'un grimpeur entre dans la fenêtre trig = [xa, xb].
//                                                       Un grimpeur rattrapé (x < front) est enseveli : retour au dernier point de passage.
//   balise      sm:{k:'beacon', pulse}                  + lever:{id} : un coup de levier l'allume exactement `pulse` s (verrouillée, ne se coupe pas).
//   arche       sm:{k:'arch', open:[ids], lift}         + porte : se verrouille OUVERTE (définitivement) dès que TOUTES les balises sont allumées en même temps.
//   sol du vide level.sm.floors = [{x0, x1, y}]         le vide remonte avec le parcours : sous ce y, dans cette plage de x, c'est une chute.
// `W.solo` (banc d'essai tools/route.mjs, un seul grimpeur) : foudre, rochers et avalanche sont inertes (la vérification de l'itinéraire seule).
export const tk = (s) => Math.max(1, Math.round(s * 120)); // secondes -> pas (DT = 1/120)
const DT = 1 / 120;

// position dans le cycle d'une boîte périodique : { pos: pas écoulés dans le cycle, n: longueur du cycle en pas }
export function cyc(W, sm) { const n = tk(sm.T), off = Math.round((sm.ph || 0) * n); return { pos: (((W.tick + off) % n) + n) % n, n }; }
// état d'une foudre : warn 0..1 (montée de l'annonce), since = secondes depuis la dernière frappe
export function boltState(W, sm) { const { pos, n } = cyc(W, sm), wt = tk(sm.warn ?? 1.3); return { warn: pos >= n - wt ? (pos - (n - wt)) / wt : 0, since: pos * DT, pos, n }; }
// le point est-il à l'abri d'une roche à moins de 4 m au-dessus de sa tête ?
export function sheltered(W, p, P) {
  const top = p.y + P.H;
  for (const b of W.bodies) {
    if (!b.on || b.ghost || b.hit) continue;
    const lo = b.py - b.hh;
    if (lo < top - 0.2 || lo > top + 4 || Math.abs(p.x - b.px) > b.ex || Math.abs(p.z - b.pz) > b.ez) continue;
    return true;
  }
  return false;
}
export const rollState = (W, sm) => { const { pos, n } = cyc(W, sm), f = pos / n, run = sm.run ?? 0.5; return f < run ? { on: true, f: f / run } : { on: false, f: 1 }; };

export default {
  id: 'summit',
  reset(W) { if (W.level.world === 'summit') W.ext.summit = { av: {}, bc: {}, ar: {} }; },
  step(W, X) {
    const S = W.ext.summit; if (!S) return;
    const seen = {};
    for (const b of W.bodies) {
      const m = b.sm; if (!m) continue;
      if (m.k === 'bolt' && !W.solo) {
        const st = boltState(W, m);
        if (st.pos === 0) { // le coup tombe
          let hit = 0;
          for (const p of W.pl) {
            if (Math.hypot(p.x - b.px, p.z - b.pz) > (m.r ?? 2) || p.y < b.py + b.hh + (m.y0 ?? -1) || p.y > b.py + b.hh + (m.y1 ?? 4)) continue;
            if (sheltered(W, p, X.P)) continue;
            const s = Math.sign(p.x - b.px) || (p.id ? 1 : -1);
            p.vx = s * 8; p.vz = 0; p.vy = 6; p.knock = 0.6; p.sta = Math.max(0, p.sta - 0.5);
            if (p.st !== X.ST.AIR) { p.st = X.ST.AIR; p.stT = 0; p.hang = p.climb = p.mantle = p.rope = null; X.toAir(p); }
            hit++;
          }
          X.ev(W, 'bolt', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz, hit });
        } else if (st.pos === st.n - tk(m.warn ?? 1.3)) X.ev(W, 'charge', { b: b.i, x: b.px, y: b.py + b.hh, z: b.pz });
      } else if (m.k === 'avl') {
        const c = (S.av[m.id] ||= { x: m.x0, on: 0, d: 0 });
        if (!W.solo && !c.on && !c.d && W.pl.some((p) => p.x > m.trig[0] && p.x < m.trig[1] && p.y > W.level.abyss)) { c.on = 1; X.ev(W, 'avlStart', { id: m.id, x: c.x, y: b.py, z: b.pz }); }
        else if (c.on) {
          c.x += m.v * DT;
          for (const p of W.pl) if (p.x < c.x && p.y > W.level.abyss) { p.y = W.level.abyss - 8; p.vy = -4; X.ev(W, 'bury', { id: m.id, x: c.x, y: p.y, z: p.z }); }
          if (c.x >= m.x1) { c.x = m.x1; c.on = 0; c.d = 1; X.ev(W, 'avlEnd', { id: m.id, x: c.x, y: b.py, z: b.pz }); }
        }
      } else if (m.k === 'beacon' && b.lever && !seen[b.lever.id]) { // balise : impulsion verrouillée
        const id = b.lever.id; seen[id] = 1;
        if (S.ar.lock) { W.sw[id] = true; continue; } // arche ouverte : les balises restent allumées
        const s = (S.bc[id] ||= { a: 0, t: 0 });
        if (s.a) {
          if (!W.sw[id]) W.sw[id] = true;
          if (++s.t >= tk(m.pulse ?? 2.2)) { s.a = 0; s.t = 0; W.sw[id] = false; X.ev(W, 'release', { id, x: b.px, y: b.py, z: b.pz }); }
        } else if (W.sw[id]) { s.a = 1; s.t = 0; X.ev(W, 'ignite', { id, x: b.px, y: b.py, z: b.pz }); }
      } else if (m.k === 'arch') {
        const a = (S.ar[b.i] ||= { o: 0 });
        if (!S.ar.lock && m.open.every((id) => W.sw[id])) { S.ar.lock = 1; X.ev(W, 'archLock', { b: b.i, x: b.px, y: b.py, z: b.pz }); }
        const o = a.o, n = X.clamp(o + (S.ar.lock ? 1 : 0) * DT / (m.rise ?? 4), 0, 1);
        if (o === 0 && n > 0) X.ev(W, 'archMove', { b: b.i, x: b.px, y: b.py, z: b.pz, open: 1 }); else if (o < 1 && n === 1) X.ev(W, 'archMove', { b: b.i, x: b.px, y: b.py, z: b.pz, open: 0 });
        a.o = n;
      }
    }
  },
  pose(W, b, X) {
    const S = W.ext.summit, m = b.sm; if (!S || !m) return false;
    if (m.k === 'roll') {
      const r = rollState(W, m), x = r.on && !W.solo ? m.x0 + (m.x1 - m.x0) * r.f : m.x0;
      b.on = r.on && !W.solo;
      b.vx = b.on ? (x - b.px) / X.DT : 0; b.vy = b.vz = 0; b.px = x; b.py = b.y; b.pz = b.z; return true;
    }
    if (m.k === 'arch') {
      const o = S.ar[b.i]?.o || 0, e = o * o * (3 - 2 * o), py = b.y + e * (m.lift ?? b.h + 0.3);
      b.vx = b.vz = 0; b.vy = (py - b.py) / X.DT; b.py = py; return true;
    }
    return false;
  },
  post(W, X) {
    const F = W.level.sm?.floors; if (!F) return;
    for (const p of W.pl) for (const f of F) if (p.x >= f.x0 && p.x <= f.x1 && p.y < f.y && p.y > W.level.abyss) { p.y = W.level.abyss - 6; p.vy = -4; break; }
  },
};
