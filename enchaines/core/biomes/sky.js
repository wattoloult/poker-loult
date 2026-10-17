// LES ENCHAÎNÉS — physique propre au monde « sky » (mécanismes que le moteur commun n'a pas). Fichier réservé à ce monde.
// Un mécanisme, déterministe (fonction de l'état W.ext.sky et du temps de simulation) :
//   · ballon-ascenseur : corps { ext:'sky', sky:{ k:'lift', rise, up, down, need } }
//       la nacelle monte de `rise` m (à `up` m/s) tant que `need` grimpeurs (1 par défaut) se tiennent dessus, et redescend doucement
//       (`down` m/s) quand elle est vide ; elle garde son altitude le temps qu'on saute dessus / dessous. Un grimpeur qui la quitte
//       en haut reste sur l'île d'arrivée : elle redescend sans lui.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, HP, ev, clamp, onB, inside, groundBelow, bounds, spanOf) :
//   reset(W, X)   remise à zéro : état dans W.ext.sky (il part dans les instantanés réseau)
//   step(W, X)    chaque pas, avant les grimpeurs
//   pose(W, b, X) pose d'une boîte { ext: 'sky' } ; renvoie true
// État : W.ext.sky.l[indice du corps] = altitude de la nacelle au-dessus de sa position basse (m) ; .m[indice] = 1 si elle monte, -1 si elle descend, 0 si elle est arrêtée.
export default {
  id: 'sky',
  reset(W) { W.ext.sky = { l: {}, m: {} }; },
  step(W, X) {
    const S = W.ext.sky; if (!S) return;
    for (const b of W.bodies) {
      const d = b.sky; if (d?.k !== 'lift') continue;
      const h = S.l[b.i] || 0, rise = d.rise ?? 10, up = X.onB(W, b) >= (d.need || 1);
      const n = up ? Math.min(rise, h + (d.up ?? 3) * X.DT) : Math.max(0, h - (d.down ?? 1.4) * X.DT);
      const m = n > h ? 1 : n < h ? -1 : 0;
      if (m !== (S.m[b.i] || 0)) { S.m[b.i] = m; X.ev(W, 'lift', { b: b.i, m, x: b.px, y: b.py, z: b.pz }); }
      S.l[b.i] = n;
    }
  },
  pose(W, b, X) {
    const S = W.ext.sky, d = b.sky; if (!S || d?.k !== 'lift') return false;
    const py = b.y + (S.l[b.i] || 0); b.vx = b.vz = 0; b.vy = (py - b.py) / X.DT; b.py = py; return true;
  },
};
