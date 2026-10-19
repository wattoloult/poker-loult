// LES ENCHAÎNÉS — mode CRAZY : arènes de tir. Pas de parcours à gravir : de quoi se battre — couvertures, conteneurs empilés, colonnes proches pour enchaîner les sauts muraux,
// passerelles en hauteur, tremplins, plateformes mobiles. Les « points de passage » (cp) servent ici de PLACES D'APPARITION (la plus éloignée des adversaires est choisie).
import { course } from '../kit.js';

const mirror = (K, f) => { f(1, 1); f(-1, 1); f(1, -1); f(-1, -1); };

// Le Dépôt de Loult : hangar à ciel ouvert, symétrique, une tour centrale à escalier, des conteneurs, des colonnes à sauts muraux
function depot() {
  const K = course({ id: 'depot', world: 'medieval', name: 'Le Dépôt de Loult', short: 'Conteneurs, passerelles et colonnes à sauts muraux', diff: 1, published: true, crazy: true,
    medals: { gold: 1, silver: 2, bronze: 3 }, backdrop: 'gorge', abyss: -12 });
  const { plat, block, cp } = K;
  K.zone(1, 'Le Dépôt');
  // sol et enceinte
  block(0, -4, 0, 0, 84, 84, { mat: 'stone' });
  block(0, -4, 16, 42.5, 86, 1, { mat: 'brick' }); block(0, -4, 16, -42.5, 86, 1, { mat: 'brick' });
  block(42.5, -4, 16, 0, 1, 86, { mat: 'brick' }); block(-42.5, -4, 16, 0, 1, 86, { mat: 'brick' });
  // tour centrale : socle plein, escalier sur ses 4 faces, plateforme haute en croix
  block(0, 0, 7.2, 0, 7, 7, { mat: 'stone' });
  for (let i = 0; i < 6; i++) { const h = 1.1 * (i + 1), o = 4.5 + 1.6 * (5 - i);
    block(o, 0, h, 0, 1.6, 4, { mat: 'stone' }); block(-o, 0, h, 0, 1.6, 4, { mat: 'stone' }); }
  plat(0, 7.2, 0, 5, 5, { mat: 'wood', h: 0.3 });
  block(0, 7.2, 8.6, 2.3, 4.6, 0.4, { mat: 'wood' }); block(0, 7.2, 8.6, -2.3, 4.6, 0.4, { mat: 'wood' }); // garde-corps = couverture de tireur
  // conteneurs : quatre groupes symétriques, certains superposés
  mirror(K, (sx, sz) => {
    block(sx * 18, 0, 2.6, sz * 8, 7, 2.8, { mat: 'metal', yaw: 0 });
    block(sx * 18, 2.6, 5.2, sz * 8, 7, 2.8, { mat: 'metal' });
    block(sx * 12, 0, 2.6, sz * 22, 2.8, 7, { mat: 'metal' });
    block(sx * 30, 0, 2.6, sz * 12, 2.8, 7, { mat: 'metal' });
    block(sx * 30, 2.6, 5.2, sz * 12, 2.8, 7, { mat: 'metal' });
    // couvertures basses
    block(sx * 8, 0, 1.3, sz * 14, 5, 0.8, { mat: 'brick' });
    block(sx * 25, 0, 1.3, sz * 25, 0.8, 5, { mat: 'brick' });
    // colonnes proches (écart 2,4 m) : sauts muraux de l'une à l'autre pour monter
    block(sx * 36, 0, 13, sz * 30, 2, 2, { mat: 'stone' }); block(sx * 36, 0, 13, sz * 33.4, 2, 2, { mat: 'stone' });
    block(sx * 36, 0, 13, sz * 36.8, 2, 2, { mat: 'stone' });
    // passerelle d'angle en hauteur, reliée par une rampe de blocs (escalier) à une colonne
    plat(sx * 36, 9.5, sz * 24, 4, 14, { mat: 'wood', h: 0.4 });
    for (let i = 0; i < 6; i++) block(sx * (31 - i * 0) , 0, 1.5 * (i + 1) + 0.0, sz * (14 + i * 1.6), 3, 1.6, { mat: 'stone' });
    // tremplin vers la passerelle
    plat(sx * 31, 0.4, sz * 36, 3, 3, { mat: 'metal', h: 0.8, launch: 15 });
    // apparition
    cp(sx * 39.5, 0, sz * 39.5, { name: 'Coin', yaw: Math.atan2(-sx, -sz) });
  });
  // pont haut entre passerelles voisines (même z) et plateforme mobile au centre-nord / sud
  plat(36, 9.5, 0, 4, 20, { mat: 'wood', h: 0.4 }); plat(-36, 9.5, 0, 4, 20, { mat: 'wood', h: 0.4 });
  // deux estrades fixes (une arène de tir ne bouge pas sous les pieds)
  plat(0, 3.2, 28, 8, 4, { mat: 'wood', h: 0.5 });
  plat(0, 3.2, -28, 8, 4, { mat: 'wood', h: 0.5 });
  cp(0, 0, 20, { name: 'Nord', yaw: Math.PI }); cp(0, 0, -20, { name: 'Sud', yaw: 0 }); cp(20, 0, 0, { name: 'Est', yaw: -Math.PI / 2 }); cp(-20, 0, 0, { name: 'Ouest', yaw: Math.PI / 2 });
  return K.done();
}

// Les Toits : blocs d'immeubles de hauteurs différentes séparés par des ruelles, de grands vides entre les toits, tremplins et ponts de planches
function toits() {
  const K = course({ id: 'toits', world: 'medieval', name: 'Les Toits de Loult', short: 'Toits, ruelles et sauts de toit en toit', diff: 2, published: true, crazy: true,
    medals: { gold: 1, silver: 2, bronze: 3 }, backdrop: 'gorge', abyss: -14 });
  const { plat, block, cp } = K;
  K.zone(1, 'Les Toits');
  block(0, -4, 0, 0, 70, 70, { mat: 'stone' });
  block(0, -4, 12, 35.5, 72, 1, { mat: 'brick' }); block(0, -4, 12, -35.5, 72, 1, { mat: 'brick' });
  block(35.5, -4, 12, 0, 1, 72, { mat: 'brick' }); block(-35.5, -4, 12, 0, 1, 72, { mat: 'brick' });
  // immeubles : grille 3×3 de ruelles de 6 m, hauteurs variées (symétrie centrale)
  const H = [[5, 9, 6], [8, 12, 8], [6, 9, 5]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const h = H[i][j], x = (i - 1) * 21, z = (j - 1) * 21;
    block(x, 0, h, z, 12, 12, { mat: i === 1 && j === 1 ? 'brick' : 'brick' });
    plat(x, h + 0.9, z, 4, 4, { mat: 'wood', h: 0.9 }); // petit abri sur le toit : couverture
  }
  // ponts de planches entre toits voisins (à la hauteur du plus bas) et tremplins au sol
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
    const a = H[i][j], b = H[i + 1][j], top = Math.min(a, b), x = (i - 0.5) * 21, z = (j - 1) * 21;
    plat(x, top, z, 9.3, 2.4, { mat: 'wood', h: 0.3 });
  }
  for (const [x, z] of [[0, -30], [0, 30], [-30, 0], [30, 0]]) plat(x, 0.4, z, 3, 3, { mat: 'metal', h: 0.8, launch: 14 });
  // escaliers de toit de rue (accès aux toits bas)
  for (const [x, z, sx] of [[-12.5, -21, 1], [12.5, 21, -1]]) for (let k = 0; k < 5; k++) block(x + sx * k * 1.2, 0, 1 * (k + 1), z, 1.2, 4, { mat: 'stone' });
  for (const [x, z] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) cp(x, 0, z, { name: 'Ruelle', yaw: Math.atan2(-x, -z) });
  cp(0, 0, 10.8, { name: 'Place', yaw: Math.PI }); cp(0, 0, -10.8, { name: 'Place', yaw: 0 }); cp(10.8, 0, 0, { name: 'Place', yaw: -Math.PI / 2 }); cp(-10.8, 0, 0, { name: 'Place', yaw: Math.PI / 2 });
  return K.done();
}
export default depot();
export const more = [toits()];
