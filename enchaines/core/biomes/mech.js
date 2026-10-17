// LES ENCHAÎNÉS — physique propre au monde « mech » (mécanismes que le moteur commun n'a pas). Fichier réservé à ce monde.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, HP, ev, clamp, onB, inside, groundBelow, bounds, spanOf) :
//   reset(W, X)   remise à zéro : l'état vit dans W.ext.mech (nombres seulement : il part dans les instantanés réseau)
//   step(W, X)    chaque pas, avant les grimpeurs
//   pose(W, b, X) pose d'une boîte { ext: 'mech' } ; post(W, X) effets sur les grimpeurs après leur déplacement
//
// Données portées par les boîtes (champ `mc`) :
//   tapis roulant    ext:'mech', mc:{k:'belt', v, off?, on?}   emporte les grimpeurs posés dessus à v m/s selon x (v < 0 = vers -x).
//                    off = id d'un interrupteur qui l'ARRÊTE tant qu'il est actif ; on = il ne tourne QUE tant que l'interrupteur est actif.
//   levier minuté    lever:{id}, mc:{pulse}                    un coup de levier = interrupteur actif exactement `pulse` s, puis il retombe seul
//                    (on ne peut pas le couper). Branché sur `move.gate` : ascenseur (pulse = move.T pour un cycle complet), tapis (off/on).
//   La vapeur (jets pulsés) et les pendules / pilons / roues dentées sont des données du moteur commun (winds, move pend / drop / rot).
const beltV = (W, b) => {
  const m = b.mc; if (!m || m.k !== 'belt') return 0;
  if (m.off && W.sw[m.off]) return 0;
  if (m.on && !W.sw[m.on]) return 0;
  return m.v;
};
export default {
  id: 'mech',
  reset(W) { if (W.level.world === 'mech') W.ext.mech = { t: {}, a: {} }; },
  step(W, X) {
    const M = W.ext.mech; if (!M) return;
    const seen = {};
    for (const b of W.bodies) {
      const m = b.mc; if (!m || !b.lever || !m.pulse || seen[b.lever.id]) continue;
      const id = b.lever.id; seen[id] = 1;
      if (M.a[id]) {
        if (!W.sw[id]) W.sw[id] = true; // verrouillé tant que l'impulsion court
        if (++M.t[id] >= Math.round(m.pulse / X.DT)) { M.a[id] = 0; M.t[id] = 0; W.sw[id] = false; X.ev(W, 'release', { id, x: b.px, y: b.py, z: b.pz }); }
      } else if (W.sw[id]) { M.a[id] = 1; M.t[id] = 0; }
    }
  },
  pose(W, b, X) {
    if (b.mc?.k !== 'belt') return false;
    b.vx = beltV(W, b); b.vy = b.vz = 0; b.px = b.x; b.py = b.y; b.pz = b.z; return true;
  },
  post(W, X) {
    if (!W.ext.mech) return;
    for (const p of W.pl) {
      if (p.st !== X.ST.GROUND || p.gb < 0) continue;
      const b = W.bodies[p.gb]; if (b?.mc?.k !== 'belt') continue;
      p.gvx = b.vx; if (b.vx) { const nx = p.x + b.vx * X.DT; if (!X.inside(W, nx + Math.sign(b.vx) * P_R, p.y + 0.6, p.z)) p.x = nx; }
    }
  },
};
const P_R = 0.32;
