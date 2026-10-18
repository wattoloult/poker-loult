/* LES ENCHAÎNÉS — le parcours (données pures, UMD). Unités : mètres. Le parcours avance vers -z puis tourne à gauche vers -x. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnchLevel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const boxes = [];
  // tex : stone | wood | brick | moss | metal | ice ; shape : slab | pillar | beam (rendu seulement)
  function box(x0, x1, y0, y1, z0, z1, o) {
    const b = Object.assign({ min: [x0, y0, z0], max: [x1, y1, z1], kind: 'solid', tex: 'stone', shape: 'slab' }, o || {});
    boxes.push(b); return b;
  }
  const T = 1;     // épaisseur des plateformes (visuel)

  // ---- 1. Départ + plateformes en escalier ----
  box(-4, 4, -T, 0, -4, 4, { tex: 'brick', shape: 'slab' });
  box(-1.5, 1.5, -T, 0, -10, -7, { tex: 'stone' });
  box(-1.5, 1.5, -T, 0.9, -14, -11, { tex: 'wood', shape: 'beam' });
  box(-1.5, 1.5, -T, 1.8, -18, -15, { tex: 'stone' });

  // ---- 2. Rebord à grimper (edge-climb) puis tunnel bas à passer en glissade ----
  box(-3, 3, 0.2, 3.6, -36, -20, { tex: 'brick', shape: 'slab' });
  box(-3, 3, 4.9, 6.2, -34, -28, { tex: 'brick', shape: 'slab' });            // plafond bas : 1,3 m sous le plafond
  box(-3, -2.4, 3.6, 6.2, -34, -28, { tex: 'brick' });                         // murs du tunnel
  box(2.4, 3, 3.6, 6.2, -34, -28, { tex: 'brick' });

  // ---- 3. Pont étroit + rouleaux à pics ----
  box(-0.8, 0.8, 3.0, 3.6, -48, -36, { tex: 'wood', shape: 'beam' });

  // ---- 4. Virage : coin, puis chemin vers la gauche (-x) ----
  box(-4, 4, 2.6, 3.6, -58, -48, { tex: 'stone' });
  box(-14, -4, 3.0, 3.6, -55, -51, { tex: 'wood', shape: 'beam' });
  box(-22, -14, 2.6, 3.6, -60, -48, { tex: 'moss' });                          // base de la tour

  // ---- 5. Mur d'escalade (raccourci) ----
  box(-19.5, -18.5, 3.6, 12.6, -56, -50, { tex: 'vines', kind: 'grip', shape: 'pillar' });
  box(-37, -18.5, 11.6, 12.6, -56.5, -53.5, { tex: 'stone', shape: 'beam' });      // passerelle haute (voie rapide)

  // ---- 6. Voie principale : marches + pilier balayant ----
  box(-26, -23, 3.6, 4.6, -56, -52, { tex: 'stone' });
  box(-30, -27, 4.6, 5.6, -56, -52, { tex: 'wood', shape: 'beam' });
  box(-35, -31, 5.6, 6.6, -57, -51, { tex: 'moss' });
  box(-43, -36, 6.6, 7.6, -60, -48, { tex: 'brick' });                          // sol de la cheminée

  // ---- 7. Cheminée à wall-jump : deux murs lisses face à face ----
  box(-46, -43, 7.6, 19.6, -56, -52, { tex: 'brick', kind: 'solid', shape: 'pillar' });
  box(-40.4, -39.4, 7.6, 19.6, -56, -52, { tex: 'brick', kind: 'solid', shape: 'pillar' });   // face intérieure lisse
  box(-39.4, -38.4, 7.6, 19.6, -56, -52, { tex: 'vines', kind: 'grip', shape: 'pillar' });    // face extérieure agrippable (voie rapide)

  // ---- 8. Gauntlet final ----
  box(-52, -46, 18.6, 19.6, -57, -51, { tex: 'stone' });
  box(-66, -52, 18.6, 19.6, -55, -53, { tex: 'wood', shape: 'beam' });
  box(-76, -68, 18.6, 19.6, -59, -49, { tex: 'moss' });

  const rollers = [
    // pont : rouleau horizontal qui monte et descend
    { axis: 'x', c: [0, 5.6, -40], r: 0.7, len: 2.4, spike: 0.38, spin: 3.2, move: { dir: [0, 1, 0], amp: 1.5, speed: 1.7, phase: 0 } },
    // pont : pilier vertical qui balaie de côté
    { axis: 'y', c: [0, 4.2, -45], r: 0.55, len: 1.2, spike: 0.3, spin: 4, move: { dir: [1, 0, 0], amp: 2.2, speed: 1.3, phase: 1 } },
    // voie principale : pilier balayeur
    { axis: 'y', c: [-33, 7.3, -54], r: 0.55, len: 1.4, spike: 0.3, spin: 3.4, move: { dir: [0, 0, 1], amp: 2.4, speed: 1.4, phase: 0.5 } },
    // gauntlet : rouleau horizontal vertical + rouleau latéral
    { axis: 'x', c: [-57, 21.6, -54], r: 0.7, len: 2.6, spike: 0.38, spin: 3.4, move: { dir: [0, 1, 0], amp: 1.5, speed: 1.9, phase: 0.3 } },
    { axis: 'y', c: [-62, 20.2, -54], r: 0.55, len: 1.2, spike: 0.3, spin: 4.2, move: { dir: [0, 0, 1], amp: 2.0, speed: 1.6, phase: 2 } },
    { axis: 'z', c: [-64.5, 21.8, -54], r: 0.5, len: 3.0, spike: 0.3, spin: 3, move: { dir: [0, 1, 0], amp: 1.4, speed: 1.5, phase: 1.5 } }
  ];

  const vines = [
    { x: -21, z: -57.5, y0: 3.6, y1: 12.6 }
  ];

  const checkpoints = [
    { min: [-4, 0, -4], max: [4, 3, 4], respawn: [0, 0.02, 0], yaw: 0 },
    { min: [-3, 3.6, -34], max: [3, 6, -20], respawn: [0, 3.62, -22], yaw: 0 },
    { min: [-4, 3.6, -58], max: [4, 7, -48.5], respawn: [0, 3.62, -50], yaw: Math.PI / 2 },
    { min: [-43, 7.6, -60], max: [-36, 11, -48], respawn: [-38, 7.62, -49.5], yaw: Math.PI / 2 },
    { min: [-52, 19.6, -57], max: [-46, 23, -51], respawn: [-49, 19.62, -54], yaw: Math.PI / 2 }
  ];

  return {
    name: 'Les Enchaînés',
    boxes, rollers, vines, checkpoints,
    camZones: [{ min: [-4, 3.6, -58], max: [4, 7, -50], yaw: Math.PI / 2 }],
    finish: { min: [-76, 19.6, -59], max: [-70, 23, -49] },
    spawn: [0, 0.02, 0], spawnYaw: 0
  };
});
