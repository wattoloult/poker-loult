// LES ENCHAÎNÉS — monde « Jungle oubliée », parcours : « La Canopée ».
// Traversée d'est en ouest d'une gorge tropicale : troncs sur la rivière, lianes au-dessus du vide, ponts de corde dans la canopée,
// passage derrière une cascade qui plaque vers le bas, racines et feuilles fragiles, puis l'ascension du sanctuaire englouti.
// Mécaniques : lianes, ponts de corde, cascades (une qui gronde par rafales), plateformes végétales fragiles, nénuphars qui s'enfoncent et dérivent,
// fleurs-ressorts qui catapultent, racines qui bougent quand on tire le levier, racine-porte à deux plaques, tronc-balance (contrepoids), falaise à lianes.
import { course } from '../kit.js';

const K = course({ id: 'canopee', world: 'jungle', name: 'La Canopée', short: 'Lianes, nénuphars, fleurs-ressorts et racines', diff: 3, published: true,
  medals: { gold: 560, silver: 800, bronze: 1150 }, backdrop: 'jungle' });
const { plat, block, cp, hint, rope, wind, cam, bridge } = K;
const Z0 = -6.5; // axe de la haute canopée

/* ---------------- 1. La Rive ---------------- */
K.zone(1, 'La Rive');
block(0, -6, 0, 0, 12, 8, { mat: 'moss' });
cp(0, 0, 0, { name: 'La Rive', yaw: Math.PI });
hint(3, 0, 0, 'Les troncs roulent un peu sous le poids : avancez ensemble sans traîner');
plat(8.5, 0.3, 0, 3, 1.1, { mat: 'log', h: 0.8, beam: 1 });
plat(12.6, 0.6, 0.4, 3, 1.1, { mat: 'log', h: 0.8, beam: 1 });
plat(16.4, 1.2, -0.8, 1.7, 1.7, { mat: 'rock', h: 2 });
plat(19.6, 1.8, 0.7, 1.7, 1.7, { mat: 'rock', h: 2 });
plat(22.7, 2.4, -0.4, 1.7, 1.7, { mat: 'rock', h: 2 });
block(27, -6, 3, 0, 5, 6, { mat: 'moss' });

/* ---------------- 2. Les Lianes ---------------- */
K.zone(2, 'Les Lianes');
cp(27, 3, 0, { name: 'Les Lianes' });
hint(28.5, 3, 0, 'Saute sur la liane en poussant vers elle, balance-toi, puis saute pour lâcher. Maj = remonter la liane');
const r1 = rope(33.6, 11, 0, 7.5), r2 = rope(41.4, 11.5, 0, 7.5);
plat(49, 4.5, 0, 4, 4, { mat: 'wood', tree: 1, via: { ropes: [r1, r2] } });

/* ---------------- 3. La Canopée ---------------- */
K.zone(3, 'La Canopée');
cp(49, 4.5, 0, { name: 'La Canopée' });
bridge(51.2, 58.8, 4.5, 0, { d: 2 });
plat(61, 4.5, 0, 4.4, 4.4, { mat: 'wood', tree: 1 });
hint(61, 4.5, 0, 'L\'écorce couverte de mousse s\'escalade : poussez vers le tronc');
block(61, -12, 11, -4, 3.4, 2.6, { mat: 'bark', climb: 1, climbFaces: [2] });
plat(61, 11.6, -7.3, 5, 4, { mat: 'wood', tree: 1 });
cam(56, 4, -12, 66, 16, 4, { mode: 'three', yaw: 0.45 });
plat(66.6, 11.6, -7, 4, 1, { mat: 'log', h: 0.8, beam: 1 });
plat(72, 12.2, -7.2, 4, 1, { mat: 'log', h: 0.8, beam: 1 });
plat(77, 12.6, -7, 2.4, 2.4, { mat: 'leaf', h: 0.3, crumble: { t: 0.7, back: 4 } });
plat(81, 13.2, -6.6, 2.4, 2.4, { mat: 'leaf', h: 0.3, crumble: { t: 0.7, back: 4 } });
plat(87, 13.8, -6, 6, 5, { mat: 'wood', tree: 1 });

/* ---------------- 4. La Cascade ---------------- */
K.zone(4, 'La Cascade');
cp(87, 13.8, -6, { name: 'La Cascade' });
hint(89, 13.8, -6, 'La cascade plaque vers le bas : prenez de l\'élan, l\'un tient pendant que l\'autre traverse');
wind(91.9, 8, -6, 2.4, 30, 6, [0, -26, 0], { water: 1 });
plat(95.2, 13.8, -6, 3, 3, { mat: 'moss', h: 1.4 });
plat(99.6, 13.8, -6, 3, 3.6, { mat: 'moss', h: 1.4 });
block(103, -4, 22, -10.2, 5, 2.2, { mat: 'moss', climb: 1, climbFaces: [2] });
wind(103, 17, -8.6, 5, 10, 1.2, [0, -6, 0], { water: 1, thin: 1 });
plat(103, 22.6, -6.5, 5, 4, { mat: 'wood', tree: 1 });

/* ---------------- 5. Les Racines ---------------- */
K.zone(5, 'Les Racines');
cp(103, 22.6, -6.5, { name: 'Les Racines' });
const r3 = rope(110, 30.5, -6.5, 7);
plat(116.8, 24.6, -6.5, 2.4, 2.4, { mat: 'leaf', h: 0.3, crumble: { t: 0.8, back: 4 }, via: { ropes: [r3] } });
const r4 = rope(121.6, 32.5, -6.5, 7.2);
block(129, 8, 26, -6.5, 6, 6, { mat: 'temple', via: { ropes: [r4] } });

/* ---------------- 6. Les Nénuphars ---------------- */
K.zone(6, 'Les Nénuphars');
cp(129, 26, Z0, { name: 'Le Temple' });
hint(133, 26, Z0, 'Les nénuphars s\'enfoncent sous le poids : ne vous attardez pas, et attendez ceux qui dérivent');
plat(135.5, 24.6, Z0, 3, 3, { mat: 'moss', h: 1.2 });
plat(140.5, 23.2, Z0, 3, 3, { mat: 'moss', h: 1.2 });
plat(145, 21.8, Z0, 3, 3, { mat: 'moss', h: 1.2 });
for (let k = 0; k < 7; k++) {
  const o = { mat: 'leaf', h: 0.22, lily: 1, sink: { d: 0.3, k: 30, max: 0.8 } };
  if (k === 2 || k === 4) o.move = { k: 'lin', az: 1.8, T: 6.5, ph: k * 1.3 };
  plat(150 + 4.2 * k, 20, Z0 + (k % 2 ? 1.1 : -1.1), 2.4, 2.4, o);
}
block(181, 10, 20, Z0, 5, 5, { mat: 'moss' });
cp(181, 20, Z0, { name: 'L\'île aux grenouilles' });
cam(146, 14, -14, 178, 28, 4, { mode: 'three', yaw: 0.4, pitch: 0.24 });

/* ---------------- 7. Les Fleurs-ressorts ---------------- */
K.zone(7, 'Les Fleurs-ressorts');
hint(183.8, 20, Z0, 'Sautez sur la fleur-ressort : elle vous catapulte. Visez la plateforme suivante en l\'air');
const spring = (x, top) => plat(x, top, Z0, 1.8, 1.8, { mat: 'moss', h: 0.6, launch: 16, spring: 1, coop: 1 });
spring(185.2, 19.5);
plat(192, 24, Z0, 7, 4.4, { mat: 'wood', tree: 1 });
spring(197.4, 23.5);
plat(204, 28, Z0, 5, 4.4, { mat: 'wood', tree: 1 });
spring(208.4, 27.5);
plat(215, 32, Z0, 6, 5, { mat: 'wood', tree: 1 });
cp(215, 32, Z0, { name: 'La cime des fleurs' });
cam(184, 18, -14, 220, 36, 4, { mode: 'three', yaw: 0.35, pitch: 0.3 });

/* ---------------- 8. Les Racines vivantes (levier + racine-porte) ---------------- */
K.zone(8, 'Les Racines vivantes');
plat(216.8, 32.1, Z0 + 1.7, 0.4, 0.4, { lever: { id: 'LR' }, ghost: 1 });
hint(214, 32, Z0, 'Actionne le levier (F) : les racines se tendent au-dessus du vide tant que la sève circule');
plat(222.6, 32, Z0, 3, 3, { mat: 'bark', h: 0.7, root: 1, move: { k: 'lin', ax: 2.2, T: 6, gate: 'LR' } });
plat(229.4, 32, Z0, 3, 3, { mat: 'bark', h: 0.7, root: 1, move: { k: 'lin', ax: 2.2, T: 6, gate: 'LR', ph: Math.PI } });
plat(238.9, 32, Z0, 9.8, 8, { mat: 'moss', h: 1.4 });
cp(238, 32, Z0, { name: 'Le Fourré' });
hint(237, 32, Z0, 'Deux plaques, une racine-porte : posez-vous chacun sur une plaque, puis courez ensemble avant qu\'elle ne retombe');
plat(240, 32.08, Z0 - 2.3, 1.5, 1.5, { mat: 'rock', h: 0.16, plate: { id: 'R1' }, plateLook: 'root' });
plat(240, 32.08, Z0 + 2.3, 1.5, 1.5, { mat: 'rock', h: 0.16, plate: { id: 'R2' }, plateLook: 'root' });
block(243.6, 32, 35.6, Z0, 0.7, 6, { mat: 'bark', door: { open: ['R1', 'R2'], speed: 1.1, close: 0.5 }, rootwall: 1, nograb: 1 });
cam(228, 26, -14, 252, 40, 4, { mode: 'three', yaw: 0.6, pitch: 0.28 });
plat(247, 32, Z0, 6, 6, { mat: 'moss', h: 1.4, coop: 1 });

/* ---------------- 9. Le Tronc-balance ---------------- */
K.zone(9, 'Le Tronc-balance');
cp(247.5, 32, Z0, { name: 'Le Tronc-balance' });
hint(248, 32, Z0, 'Tronc-balance : l\'un monte sur le long bras, l\'autre sur le court, le plus lourd descend. Une fois hissé, tirez votre partenaire (V)');
plat(253.2, 32, Z0 + 0.7, 2.6, 2.6, { mat: 'log', beam: 1, cw: { id: 'balance', side: 1, d: 2.2, k: 2 } });
plat(253.2, 32, Z0 - 1.9, 2.6, 2.6, { mat: 'log', beam: 1, cw: { id: 'balance', side: -1, d: 2.2 } });
block(256.7, 27, 37.1, Z0 - 1.9, 4, 4, { mat: 'bark', coop: 1 });

/* ---------------- 10. La Falaise aux lianes ---------------- */
K.zone(10, 'La Falaise aux lianes');
cp(256.7, 37.1, Z0 - 1.9, { name: 'La Falaise' });
hint(259, 37.1, Z0 - 1.9, 'Deux lianes de suite : lâchez la première en pleine course vers la seconde');
const r5 = rope(263, 44.6, Z0 - 1.9, 7.5), r6 = rope(270.8, 45, Z0 - 1.9, 7.5);
plat(277.9, 38.6, Z0 - 1.9, 4, 4, { mat: 'wood', tree: 1, via: { ropes: [r5, r6] } });
cp(277.9, 38.6, Z0 - 1.9, { name: 'Le pied de la falaise' });
hint(279, 38.6, Z0 - 1.9, 'Escalade : poussez vers le tronc ; l\'endurance se vide, gagnez le replat à mi-hauteur');
plat(283.5, 38.6, -1.8, 4.4, 4.4, { mat: 'wood', tree: 1 });
block(283.5, 28, 44, -6.2, 3.4, 2.6, { mat: 'bark', climb: 1, climbFaces: [2] });
plat(283.5, 44.6, -10, 5, 5, { mat: 'wood', tree: 1 });
cam(278, 36, -14, 290, 56, 4, { mode: 'three', yaw: 0.5 });
cp(283.5, 44.6, -10, { name: 'Le replat' });
block(283.5, 38, 54, -14.3, 3.4, 2.6, { mat: 'bark', climb: 1, climbFaces: [2] });
plat(283.5, 54.6, -18.1, 5, 5, { mat: 'wood', tree: 1 });

/* ---------------- 11. La crue ---------------- */
K.zone(11, 'La Crue');
cp(283.5, 54.6, -18.1, { name: 'La Crue' });
hint(286, 54.6, -18.1, 'La crue gronde par rafales : attendez que la cascade s\'apaise, puis traversez d\'un trait');
plat(290.4, 54.6, -18.1, 3, 3, { mat: 'moss', h: 1.4 });
wind(293.9, 49, -18.1, 2.4, 14, 3.6, [0, -26, 0], { water: 1, pulse: 7 });
plat(297.4, 54.6, -18.1, 3, 3, { mat: 'moss', h: 1.4 });
plat(302.2, 55.3, -18.1, 2.4, 2.4, { mat: 'leaf', h: 0.3, crumble: { t: 0.7, back: 4 } });
plat(306, 56.0, -18.1, 2.4, 2.4, { mat: 'leaf', h: 0.3, crumble: { t: 0.7, back: 4 } });

/* ---------------- 12. Le Sanctuaire ---------------- */
K.zone(12, 'Le Sanctuaire');
block(310.8, 46, 56.6, -18.1, 4, 5, { mat: 'temple' });
cp(310.8, 56.6, -18.1, { name: 'Le Sanctuaire' });
block(315.8, 46, 58, -18.1, 3, 5, { mat: 'temple' });
block(319.8, 46, 59.8, -18.1, 3, 5, { mat: 'temple' });
cam(308, 52, -24, 338, 72, -10, { mode: 'far', dist: 4 });
block(328, 40, 61.8, -18.1, 9, 7, { mat: 'temple', summit: 1 });
cp(328, 61.8, -18.1, { name: 'Le Sanctuaire englouti', finish: true, r: 4 });

export default K.done({ abyss: -22 });
