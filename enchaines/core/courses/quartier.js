// LES ENCHAÎNÉS — mode CRAZY : « Le Quartier du Dragon », refonte jouable de la Cour du Dragon (pack « Courtyard », assets/exports/combat_fight_arena_psx.glb).
// Les neuf bâtiments du pack sont DÉPLACÉS (jamais étirés) pour ouvrir des rues de 5 à 9 m, une place devant le pavillon central et une rue arrière ; la maisonnette B8
// est réemployée une seconde fois, tournée, comme kiosque au milieu de la place (casse la grande ligne de tir nord-sud). Le sol, l'enceinte, la porte et les éléments
// de couverture sont construits avec les matériaux d'origine du pack (échantillons de ses atlas : pavé, pierre, tuiles, bois — client/levelview.js).
// Collisions : pièces mesurées (core/courses/cour-kit.js) ; toits praticables en marches de 10 cm ; rebords de toits, balcons et auvents saisissables.
// L'ancienne arène (core/courses/cour.js) est conservée telle quelle. Plan, choix et parcours : enchaines/MAP_QUARTIER.md.
import { course } from '../kit.js';
import { placePiece } from './cour-kit.js';

const GLB = 'assets/exports/combat_fight_arena_psx.glb';
const K = course({ id: 'quartier', world: 'medieval', name: 'Le Quartier du Dragon', short: 'Rues larges, toits praticables, balcons et kiosque autour du pavillon', diff: 2, published: true, crazy: true,
  medals: { gold: 1, silver: 2, bronze: 3 }, backdrop: 'enceinte', abyss: -10, envGlb: GLB, envBackdrop: 'assets/exports/mountains_sky_backdrop.glb' });
const { block, cp } = K;
K.zone(1, 'Le Quartier');

// ENCEINTE : mur de pierre à chaperon de tuiles (rendu : env.props 'enceinte'), x ±22,5, z −36,2 … 16,5 ; au-dessus du mur, la limite continue (on ne saute pas
// par-dessus depuis un toit) ; on ne s'y accroche pas
export const BOUNDS = { x0: -22.5, x1: 22.5, z0: -36.2, z1: 16.5, wall: 4.6 };
const B = BOUNDS, solid = { noMesh: 1, nograb: 1, bound: 1 };
block((B.x0 + B.x1) / 2, -4, 0, (B.z0 + B.z1) / 2, B.x1 - B.x0 + 4, B.z1 - B.z0 + 4, { noMesh: 1, nograb: 1 }); // sol (le pavé est dessiné par le client)
block(B.x0 - 0.5, 0, 40, (B.z0 + B.z1) / 2, 1, B.z1 - B.z0 + 2, solid); block(B.x1 + 0.5, 0, 40, (B.z0 + B.z1) / 2, 1, B.z1 - B.z0 + 2, solid);
block(0, 0, 40, B.z0 - 0.5, B.x1 - B.x0 + 2, 1, solid); block(0, 0, 40, B.z1 + 0.5, B.x1 - B.x0 + 2, 1, solid);

// BÂTIMENTS : [pièce, x, z, rotation] — positions des nœuds du GLB (le rendu pose le même nœud au même endroit : env.layout)
export const LAYOUT = [
  // rangée nord, adossée à l'enceinte (B7 reste la silhouette dominante, hors d'atteinte)
  ['B9', -16.9, -31.6, 0], ['B8', -9.3, -31.6, 0], ['B7', 0, -31.6, 0], ['B6', 14.8, -31.6, 0],
  // rangée du milieu : pavillon central et son perron, maison basse à l'ouest, maison à porche à l'est (décalées en z : pas de symétrie parfaite)
  ['B4', -17.4, -14.5, 0], ['B1', 0, -14, 0], ['Stairs', 0, -9.555, 0], ['B5', 17.3, -16, 0],
  // ailes de la cour, adossées aux côtés, appentis tournés vers la place
  ['B3', -16.25, 5, 0], ['B2', 16.2, -1, 0], // rues ouest et est décalées en z : pas de ligne de tir d'un bout à l'autre de la carte
  // kiosque : la maisonnette B8 réemployée, tournée d'un quart de tour (partie basse à l'est)
  ['B8', 0, 9.5, Math.PI / 2, 'kiosque'],
];
for (const [n, x, z, r, tag] of LAYOUT) placePiece(K, n, x, z, r, { tag });
// comblements : fentes entre un bâtiment et l'enceinte (trop étroites pour être des passages)
block(-22.2, 0, 7, -31.6, 0.6, 9, solid); block(21.9, 0, 10, -31.6, 1.2, 9, solid);
// liseré de 12 cm de la cour pavée (Arena_Floor), découpé au pied du perron
const RIM = { noMesh: 1 }, fz = -11.555; // position du nœud Arena_Floor (z local 3 … 14)
block(0, 0, 0.12, fz + 13.5, 14, 1, RIM); block(-6.5, 0, 0.12, fz + 8.5, 1, 9, RIM); block(6.5, 0, 0.12, fz + 8.5, 1, 9, RIM);
block(-4.665, 0, 0.12, fz + 3.5, 4.67, 1, RIM); block(4.665, 0, 0.12, fz + 3.5, 4.67, 1, RIM);

// COUVERTURE et appuis (construits avec les matériaux du pack) : [genre, x, z, largeur, hauteur, profondeur, rotation]
// caisses = appuis de grimpe (1,2 m : on s'y hisse) et couverture pleine (2,4 m) ; murets = couverture basse qu'on enjambe d'un saut
export const PROPS = [
  // place : deux murets entre la cour et le kiosque, caisses au pied du pavillon
  ['muret', -6.8, 4.6, 3.6, 1.1, 0.7], ['muret', 6.8, 4.6, 3.6, 1.1, 0.7],
  ['caisse', -2, 7.3, 1.4, 2.4, 1.4], // contre le flanc nord du kiosque : appui vers son toit haut
  ['caisse', -5.4, -6.4, 1.2, 1.2, 1.2], ['caisse', 5.6, -6.7, 1.2, 2.4, 1.2], ['caisse', 6.9, -6.7, 1.2, 1.2, 1.2],
  // rue arrière : la seule longue ligne de tir est-ouest, coupée par des caisses et un muret
  ['caisse', -4.2, -23.4, 1.4, 2.4, 1.4], ['caisse', -2.8, -23.6, 1.2, 1.2, 1.2], ['muret', -15, -23.6, 4, 1.1, 0.7], ['caisse', 11.5, -23.2, 1.4, 2.4, 1.4],
  // rue ouest (large) et rue est (étroite)
  ['caisse', -13.6, -4.2, 1.4, 2.4, 1.4], ['muret', -19.5, -2.6, 0.7, 1.1, 3.2], ['caisse', 13.2, -7.4, 1.2, 1.2, 1.2],
  // placettes du sud, devant les façades de B3 et B2
  ['muret', -14.6, 13.4, 4, 1.1, 0.7], ['caisse', -20.4, 14.6, 1.4, 2.4, 1.4], ['caisse', 19.8, 11.4, 1.4, 2.4, 1.4], ['muret', 13.2, 12.8, 0.7, 1.1, 3.6], ['caisse', 10.6, 6.6, 1.2, 1.2, 1.2], ['caisse', 8.8, 1.4, 1.2, 1.2, 1.2], ['caisse', -8.85, 6.6, 1.2, 1.2, 1.2], // appuis au pied des appentis (égout à 4,1 m : hors de portée d'un saut depuis le sol) ['muret', 17.5, 7.2, 3.6, 1.1, 0.7],
];
for (const [k, x, z, w, h, d, r = 0] of PROPS) block(x, 0, h, z, w, d, { noMesh: 1, yaw: r, prop: k, ...(k === 'muret' ? { nograb: 1 } : {}) });

// PLACES D'APPARITION : rues, ruelles, placettes (la plus éloignée des adversaires est choisie)
const spawns = [[-10, -23.6, Math.PI / 2], [10, -23.8, -Math.PI / 2], [0, -23, Math.PI], [-9.7, -14, 0], [9.9, -12, 0], [-17.5, -4.6, -Math.PI / 2], [17.5, -7.6, Math.PI / 2],
  [-6, -1.5, 0], [6, -1.5, 0], [-16.5, 11.6, Math.PI], [16, 12.8, Math.PI], [0, 14.2, Math.PI]];
for (const [x, z, yaw] of spawns) cp(x, 0, z, { name: 'Quartier', yaw });

// POINTS D'ACCROCHE POUR LES CORDES (préparation : AUCUN système de corde de grappin n'existe encore ; données lues seulement par les tests et l'outil de plan).
// x, y, z = point solide réel du décor (faîtage, égout, poutre de balcon) ; reach = longueur de corde utile ; swing = axe du balancement prévu (rad, 0 = vers +z) ;
// arc = rayon libre exigé sous le point (vérifié par core/quartier.test.js : aucun volume dans le cône de balancement)
export const ANCHORS = [
  { id: 'pavillon-avant', kind: 'égout', x: 0, y: 9.0, z: -8.2, reach: 6, swing: 0, arc: 5, note: 'au-dessus du perron : se balancer vers la place ou vers les balcons' },
  { id: 'pavillon-arriere', kind: 'égout', x: 0, y: 9.0, z: -19.9, reach: 6, swing: Math.PI, arc: 5, note: 'traverser la rue arrière jusqu’à l’auvent de B7' },
  { id: 'porte', kind: 'poutre', x: 0, y: 5.0, z: 16.4, reach: 4.5, swing: Math.PI, arc: 4, note: 'linteau de la porte du quartier : se balancer vers le kiosque' },
  { id: 'porche-est', kind: 'égout', x: 17.3, y: 6.0, z: -9.8, reach: 4.5, swing: 0, arc: 4, note: 'rue est : du toit de B5 vers l’appentis de B2' },
  { id: 'auvent-b2', kind: 'poutre', x: 16.2, y: 4.83, z: 3.45, reach: 4, swing: 0, arc: 3.5, note: 'garde-corps de l’auvent de B2, au-dessus de la placette sud-est' },
  { id: 'auvent-b7', kind: 'poutre', x: -3, y: 6.95, z: -26.5, reach: 5, swing: 0, arc: 4, note: 'redescendre de l’auvent de B7 vers la rue arrière' },
];

// DÉCOR rendu par le client (core ne s'en sert pas) : nœuds du GLB posés, sol pavé, enceinte, porte, accessoires
export const ENV = {
  layout: [...LAYOUT.map(([n, x, z, r]) => ({ node: n === 'Stairs' ? 'Stairs' : 'Building_' + n, x, z, r })), { node: 'Arena_Floor', x: 0, z: fz, r: 0 }],
  ground: { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, bounds: B, gate: { x: 0, w: 5 }, props: PROPS,
};
export default K.done({ env: ENV, anchors: ANCHORS });
