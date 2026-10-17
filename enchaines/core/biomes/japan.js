// LES ENCHAÎNÉS — physique propre au monde « japan » (mécanismes que le moteur commun n'a pas). Fichier réservé à ce monde.
// Deux mécanismes, tous deux déterministes (fonctions de W.sw et du temps de simulation) :
//   · panneau coulissant (shoji) : corps { ext:'japan', jp:{ kind:'shoji', open:[ids de plaques / leviers], any, dz|dx, speed, hold } }
//       glisse de (dx, dz) mètres quand les interrupteurs sont actifs ; reste ouvert `hold` s après leur relâchement ; ne se referme
//       jamais sur un grimpeur engagé dans l'ouverture (attend qu'il soit passé).
//   · cloche : levier { lever:{id} } déclaré dans W.level.jp.bells = { id: durée } ; l'interrupteur retombe tout seul après `durée` s
//       (frapper la cloche = « ouvert pendant N secondes »). Cadencé par W.ext.japan.bell[id].
// État dans W.ext.japan (part dans les instantanés réseau) : sh[indice du corps] = { o: 0..1 ouverture, h: temps de maintien restant },
//   bell[id] = temps écoulé depuis la frappe.
export default {
  id: 'japan',
  reset(W) { W.ext.japan = { sh: {}, bell: {} }; },
  step(W, X) {
    const J = W.ext.japan; if (!J) return;
    const bells = W.level.jp?.bells;
    if (bells) for (const id in bells) { // la cloche retombe seule
      if (W.sw[id]) { const t = (J.bell[id] = (J.bell[id] || 0) + X.DT); if (t > bells[id]) { W.sw[id] = false; J.bell[id] = 0; X.ev(W, 'release', { id }); } }
      else J.bell[id] = 0;
    }
    for (const b of W.bodies) {
      const j = b.jp; if (j?.kind !== 'shoji') continue;
      const s = (J.sh[b.i] ||= { o: 0, h: 0 }), ids = j.open || [];
      const ok = ids.length && (j.any ? ids.some((i) => W.sw[i]) : ids.every((i) => W.sw[i]));
      if (ok) s.h = j.hold || 0; else if (s.h > 0) s.h = Math.max(0, s.h - X.DT);
      let want = ok || s.h > 0;
      // jamais refermé sur quelqu'un qui est dans l'ouverture (le panneau fermé occupe [x ± hw] x [z ± hd])
      if (!want && s.o > 0) for (const p of W.pl) {
        if (Math.abs(p.x - b.x) < b.hw + X.P.R + 0.25 && Math.abs(p.z - b.z) < b.hd + X.P.R && p.y < b.y + b.hh && p.y + X.P.H > b.y - b.hh) { want = true; break; }
      }
      const o = s.o, n = X.clamp(o + (want ? 1 : -1) * (j.speed || 1.1) * X.DT, 0, 1);
      if (n > 0 && o === 0) X.ev(W, 'shoji', { b: b.i, open: 1, x: b.x, y: b.y, z: b.z }); else if (n === 0 && o > 0) X.ev(W, 'shoji', { b: b.i, open: 0, x: b.x, y: b.y, z: b.z });
      s.o = n;
    }
  },
  // pose d'un panneau : translation selon l'ouverture (adoucie), vitesse déduite pour porter / pousser ce qui est dessus
  pose(W, b, X) {
    if (b.jp?.kind !== 'shoji') return false;
    const o = W.ext.japan?.sh[b.i]?.o || 0, e = o * o * (3 - 2 * o);
    const x = b.x + (b.jp.dx || 0) * e, z = b.z + (b.jp.dz || 0) * e;
    b.vx = (x - b.px) / X.DT; b.vz = (z - b.pz) / X.DT; b.vy = 0; b.px = x; b.pz = z; b.py = b.y;
    return true;
  },
};
