// LES ENCHAÎNÉS — physique propre au monde « jungle » (mécanismes que le moteur commun n'a pas). Fichier réservé à ce monde.
// Crochets appelés par core/sim.js (X = outils du moteur : ST, P, DT, HP, ev, clamp, onB, inside, groundBelow, bounds, spanOf) :
//   reset(W, X)        remise à zéro (départ, réapparition) : ranger l'état dans W.ext.jungle (il part dans les instantanés réseau)
//   step(W, X)         chaque pas, avant les grimpeurs (mécanismes)
//   pose(W, b, X)      pose d'une boîte marquée { ext: 'jungle' } : fixer b.px/py/pz, b.vx/vy/vz (et b.hw/hh/hd + X.bounds(b) si elle change) ; renvoyer true
//   post(W, X)         chaque pas, après le déplacement des grimpeurs (effets sur eux : tapis, glissade, souffle...)
export default {
  id: 'jungle',
};
