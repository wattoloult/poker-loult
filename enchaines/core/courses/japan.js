// LES ENCHAÎNÉS — monde « Sanctuaires » (Japon traditionnel), parcours : « Les Mille Torii ».
// Toits du village, MAISON DE THÉ (panneaux shoji à plaques et à cloche, bûche de gong), long pont suspendu puis pont aux planches pourries (rafales),
// bosquet de bambous (paroi à escalader, toits de tuiles mouillés), ascension extérieure d'une pagode (barres sous les avant-toits), huit torii dans
// le vent, puits à contrepoids (à deux), panneaux coulissants, SALLE DES TATAMIS (tapis qui glissent et plateau tournant), puis le CLOCHER
// (deux leviers éloignés pour ouvrir un shoji, paroi, plaques + grande cloche) et le sanctuaire du sommet.
// Mécanismes japonais : shoji coulissants commandés (core/biomes/japan.js), cloches qui retombent seules, tatamis.
import { course } from '../kit.js';

const K = course({ id: 'torii', world: 'japan', name: 'Les Mille Torii', short: 'Shoji, cloches, pagode, torii et tatamis', diff: 2, published: true,
  medals: { gold: 620, silver: 930, bronze: 1350 }, backdrop: 'valley' });
const { plat, block, cp, hint, cam, bridge, bars, wind } = K;
// torii : deux piliers et une poutre supérieure (kasagi) sur laquelle on peut se poser, en travers du chemin (selon z)
function torii(x, top, z, o = {}) {
  block(x, top - 9, top - 0.6, z - 2, 0.5, 0.5, { mat: 'lacquer', nograb: 1, deco: 'post' });
  block(x, top - 9, top - 0.6, z + 2, 0.5, 0.5, { mat: 'lacquer', nograb: 1, deco: 'post' });
  return plat(x, top, z, 0.95, 5.4, { mat: 'lacquer', h: 0.6, torii: 1, ...o });
}
// panneau shoji coulissant posé sur un sol (dessus `floor`), large de d (selon z), qui glisse de dz quand les interrupteurs `open` sont actifs.
// Le corps de collision déborde en largeur (+2,4 m) et plonge sous le sol (sinon on le contourne en s'agrippant au bord du sol) ; seule la partie
// visible (jp.vis = [bas, haut, largeur]) est dessinée par client/worlds/japan.js. Haut de 4,2 m : trop haut pour sauter dessus, même à deux.
const shoji = (x, floor, z, d, open, o = {}) => block(x, floor - 3.5, floor + 4.2, z, 0.36, d + 2.4, { mat: 'shoji', nograb: 1, deco: 'shoji', noMesh: 1, ext: 'japan',
  jp: { kind: 'shoji', open, dz: o.dz ?? -(d + 1.7), hold: o.hold ?? 0, speed: o.speed ?? 1.1, any: o.any, vis: [floor, floor + 4.2, d] }, name: o.name });
// levier-cloche (kane) : sans collision, rendu par client/worlds/japan.js ; sa durée est déclarée dans jp.bells (en bas du fichier)
const bell = (id, x, top, z) => plat(x, top, z, 0.4, 0.4, { lever: { id }, ghost: 1, noMesh: 1, bell: id, name: 'cloche ' + id });
const tatami = (x, top, z, w, d, o = {}) => plat(x, top, z, w, d, { mat: 'path', h: 0.4, tatami: 1, ...o });

/* ---------------- 1. Le Village ---------------- */
K.zone(1, 'Le Village');
block(0, -6, 0, 0, 12, 8, { mat: 'path' });
cp(0, 0, 0, { name: 'Le Village', yaw: Math.PI });
hint(3, 0, 0, 'Les toits du village : sautez de l\'un à l\'autre');
plat(9, 1.2, -1, 4, 4, { mat: 'tile', h: 0.6, roof: 1 });
plat(14.6, 2.4, 0.5, 4, 3, { mat: 'tile', h: 0.6, roof: 1 });
plat(20.2, 3.6, -0.5, 4, 3, { mat: 'tile', h: 0.6, roof: 1 });
plat(25, 3.9, 0, 1.2, 1.2, { mat: 'bamboo', h: 9, post: 1 });
plat(28.6, 4.5, 1, 1.2, 1.2, { mat: 'bamboo', h: 9, post: 1 });
plat(32.2, 5.1, -0.4, 1.2, 1.2, { mat: 'bamboo', h: 9, post: 1 });
block(37.5, -6, 5.4, 0, 5, 6, { mat: 'stone' });

/* ---------------- 2. La Maison de thé : deux shoji, une cloche, une bûche de gong ---------------- */
K.zone(2, 'La Maison de thé');
cp(37.5, 5.4, 0, { name: 'La Maison de thé' });
block(53, -6, 5.4, 0, 26, 4.4, { mat: 'path', name: 'salle' }); // x 40 -> 66
block(53, 5.4, 9.6, -3.4, 26, 2.2, { mat: 'pagoda', nograb: 1, deco: 'wall' }); // mur du fond
cam(36, 2, -7, 67, 14, 8, { mode: 'three', yaw: 0.7, pitch: 0.28 }); // de trois-quarts : on voit les panneaux de face
hint(41.5, 5.4, 0, 'Un shoji ferme la salle : une dalle chacun, ensemble. Il reste ouvert quelques secondes quand vous les quittez');
plat(45.5, 5.45, -1.2, 1.6, 1.6, { mat: 'path', h: 0.1, plate: { id: 'TA' }, name: 'dalle TA' });
plat(45.5, 5.45, 1.2, 1.6, 1.6, { mat: 'path', h: 0.1, plate: { id: 'TB' }, name: 'dalle TB' });
shoji(50, 5.4, 0, 4.4, ['TA', 'TB'], { hold: 6, speed: 1.2, name: 'shoji SA' });
hint(52, 5.4, 0, 'La cloche : frappez-la (F), le second shoji reste ouvert 9 secondes');
bell('K1', 54.5, 5.4, 1.5);
shoji(58, 5.4, 0, 4.4, ['K1'], { speed: 1.4, name: 'shoji SB' });
hint(60, 5.4, 0, 'La bûche du gong balaie la salle : passez quand elle s\'écarte');
plat(62.5, 6.35, 0, 1.1, 1.3, { mat: 'wood', h: 1.1, move: { k: 'pend', axis: 'z', len: 5, amp: 0.68, T: 3.2 }, hit: 1, nograb: 1, hammer: 5, gong: 1, name: 'gong' });

/* ---------------- 3. Le Pont de la vallée (puis le pont aux planches pourries) ---------------- */
K.zone(3, 'Le Pont de la vallée');
cp(64.5, 5.4, 0, { name: 'Le Pont de la vallée' });
hint(67, 5.4, 0, 'Le pont s\'enfonce sous le poids : ne vous arrêtez pas à deux sur la même planche');
bridge(66.4, 82, 5.4, 0, { d: 2.2 });
cam(66, 0, -6, 112, 12, 6, { mode: 'far', dist: 5, pitch: 0.18 });
block(86, -6, 5.4, 0, 7, 6, { mat: 'stone', name: 'îlot' });
hint(88, 5.4, 0, 'Les planches de l\'autre pont sont pourries : elles cèdent quand on s\'y attarde, et le vent se lève');
for (let i = 0; i < 8; i++) plat(91.4 + i * 1.55, 5.4, 0, 1.15, 2.2, { mat: 'wood', h: 0.3, plank: 1, crumble: { t: 0.8, back: 5 } });
wind(96, 7, 0, 15, 6, 6, [0, 0, -6], { pulse: 5 }); // 8 -> 6 : une petite erreur de direction sur ce pont étroit suffisait à faire tomber
wind(96, 7, 0, 15, 6, 6, [0, 0, 6], { pulse: 5, ph: Math.PI });
block(106, -6, 5.4, 0, 7, 6, { mat: 'stone', name: 'rive' });

/* ---------------- 4. Le Bosquet de bambous : paroi à escalader, toits de tuiles mouillés ---------------- */
K.zone(4, 'Le Bosquet de bambous');
cp(106, 5.4, 0, { name: 'Le Bosquet de bambous' });
hint(107.5, 5.4, 0, 'Une paroi de bambou : plaquez-vous contre elle pour grimper');
block(111, -6, 10.8, 0, 3, 4.4, { mat: 'bamboo', climb: 1, climbFaces: [1] });
hint(112, 10.8, 0, 'Les tuiles sont mouillées : elles glissent. Freinez à l\'atterrissage');
plat(116, 11.0, 0.3, 3.4, 3.4, { mat: 'tile', h: 0.6, roof: 1, ice: 1 });
plat(120.4, 11.6, -0.3, 3.4, 3.4, { mat: 'tile', h: 0.6, roof: 1, ice: 1 });
plat(124.8, 12.2, 0.3, 3.4, 3.4, { mat: 'tile', h: 0.6, roof: 1, ice: 1 });
block(131, -6, 12.6, 0, 8, 7, { mat: 'stone', name: 'terrasse' });

/* ---------------- 5. La Pagode (originale, décalée de 71 m / 7,2 m) ---------------- */
K.zone(5, 'La Pagode');
cp(131, 12.6, 0, { name: 'La Pagode' });
hint(133, 12.6, 0, 'Accrochez-vous au bord de chaque avant-toit pour monter d\'étage en étage');
plat(139, 15.6, -1.5, 7, 6, { mat: 'tile', h: 0.5, roof: 1 });
plat(141, 18.6, -1.5, 6, 5, { mat: 'tile', h: 0.5, roof: 1 });
plat(143, 21.6, -1.5, 5, 4, { mat: 'tile', h: 0.5, roof: 1 });
plat(145, 24.6, -1.5, 4, 4, { mat: 'tile', h: 0.5, roof: 1, pagodaTop: 1 });
block(142, -6, 15.1, -1.5, 9, 4, { mat: 'pagoda', nograb: 1, deco: 'pagoda' });
cam(133, 12, -8, 151, 29, 6, { mode: 'three', yaw: -0.5 });
hint(146, 24.6, -1.5, 'Barres sous l\'avant-toit : suspendez-vous et sautez de l\'une à l\'autre');
bars(149.4, 158.4, 26.7, -1.5, 4, { len: 3 });
plat(162, 22.2, -1.5, 4, 4, { mat: 'lacquer', h: 0.6 });

/* ---------------- 6. Les Torii : huit poutres dans le vent ---------------- */
K.zone(6, 'Les Torii');
cp(162, 22.2, -1.5, { name: 'Les Torii' });
hint(163, 22.2, -1.5, 'Les poutres des torii sont étroites : freinez en l\'air pour vous y poser. Le vent souffle en rafales');
const tops = [22.8, 23.4, 24.0, 24.6, 24.6, 24.6, 24.6, 24.6];
tops.forEach((t, k) => torii(166.4 + k * 3.9, t, -1.5));
wind(180, 28, -1.5, 32, 9, 6, [0, 0, 7], { pulse: 4 });
wind(180, 28, -1.5, 32, 9, 6, [0, 0, -7], { pulse: 4, ph: Math.PI });
plat(198.6, 24.6, 0, 4, 4, { mat: 'stone' });

/* ---------------- 7. Le Puits ---------------- */
K.zone(7, 'Le Puits');
cp(198.6, 24.6, 0, { name: 'Le Puits' });
hint(200.6, 24.6, 0, 'Contrepoids : quand l\'un charge un plateau, l\'autre monte. Le plus haut tire ensuite son partenaire');
plat(203.6, 24.6, 0.7, 2.6, 2.6, { mat: 'wood', cw: { id: 'puits', side: 1, d: 2.2, k: 2 } });
plat(203.6, 24.6, -1.9, 2.6, 2.6, { mat: 'wood', cw: { id: 'puits', side: -1, d: 2.2 } });
block(207.1, 12, 29.7, -1.9, 4, 4, { mat: 'stone', coop: 1 });

/* ---------------- 8. Le Sanctuaire : panneaux coulissants ---------------- */
K.zone(8, 'Le Sanctuaire');
cp(207.1, 29.7, -1.9, { name: 'Le Sanctuaire' });
hint(210.6, 30.6, -2.4, 'Les panneaux coulissent : sautez quand ils viennent à vous');
plat(212.6, 30.2, -2.4, 2.6, 2.6, { mat: 'shoji', move: { k: 'lin', az: 2.4, T: 3.6 } });
plat(218, 31.2, -2.4, 2.6, 2.6, { mat: 'shoji', move: { k: 'lin', az: -2.4, T: 3.2, ph: 1 } });
plat(222.4, 31.8, -2.4, 2.6, 2.6, { mat: 'shoji', move: { k: 'lin', ax: 1.4, T: 2.8 } });
block(228.6, 10, 32.4, -2.4, 6, 6, { mat: 'stone', name: 'seuil' });

/* ---------------- 9. La Salle des tatamis : tapis qui glissent, plateau tournant ---------------- */
K.zone(9, 'La Salle des tatamis');
const Zt = -2.4;
cp(228.6, 32.4, Zt, { name: 'La Salle des tatamis' });
cam(228, 28, -8, 258, 42, 6, { mode: 'three', yaw: 0.55, pitch: 0.3 });
hint(231, 32.4, Zt, 'Les tatamis glissent le long de la salle : choisissez l\'instant où ils se rejoignent');
tatami(235.4, 32.4, Zt, 3.2, 3.4, { move: { k: 'lin', ax: 0.9, T: 3.6 }, name: 'tatami 1' });
tatami(241.2, 32.8, Zt, 3.2, 3.4, { move: { k: 'lin', ax: 0.9, T: 3.6, ph: 2.1 }, name: 'tatami 2' });
tatami(246.2, 33.2, Zt, 3.2, 3.4, { move: { k: 'lin', ax: 0.9, T: 3.6, ph: 4.2 }, name: 'tatami 3' });
hint(250, 33.2, Zt, 'Le plateau tourne lentement : montez, puis sautez de l\'autre côté');
tatami(251, 33.2, Zt, 3.4, 3.4, { move: { k: 'rot', w: 0.8 }, name: 'tatami tournant' });
block(258, -6, 33.6, Zt, 5, 4.4, { mat: 'path', name: 'vestibule' }); // x 255.5 -> 260.5

/* ---------------- 10. Le Clocher : deux leviers, une paroi, deux dalles et la grande cloche ---------------- */
K.zone(10, 'Le Clocher');
cp(258, 33.6, Zt, { name: 'Le Clocher' });
block(268, -6, 33.6, Zt, 15, 4.4, { mat: 'path', name: 'galerie' }); // x 260.5 -> 275.5 (jointif au vestibule)
block(268, 33.6, 37.8, Zt - 3.4, 15, 2.2, { mat: 'pagoda', nograb: 1, deco: 'wall' });
hint(262, 33.6, Zt, 'Deux cloches éloignées : frappez la première puis courez à la seconde, avant qu\'elle ne se taise');
bell('KA', 262, 33.6, Zt + 1.5);
bell('KB', 269, 33.6, Zt - 1.5);
shoji(272, 33.6, Zt, 4.4, ['KA', 'KB'], { hold: 5, speed: 1.2, name: 'shoji SC' });
cam(256, 30, -8, 280, 46, 6, { mode: 'three', yaw: 0.6, pitch: 0.28 });
block(277, -6, 41.4, Zt, 3, 4.4, { mat: 'pagoda', climb: 1, climbFaces: [1], name: 'paroi du clocher' }); // x 275.5 -> 278.5
hint(274, 33.6, Zt, 'Le clocher : escaladez sa paroi de bois');

/* ---------------- 11. Le sommet : grande cloche, dalles et sanctuaire ---------------- */
K.zone(11, 'Le Sanctuaire du sommet');
block(283, -6, 41.4, Zt, 9, 6, { mat: 'stone', name: 'plateforme du clocher' }); // x 278.5 -> 287.5
cp(282, 41.4, Zt, { name: 'Le Clocher (sommet)' });
hint(281, 41.4, Zt, 'La grande cloche (F) puis une dalle chacun : le dernier shoji s\'ouvre sur le sanctuaire');
bell('KC', 280.5, 41.4, Zt + 2);
plat(284.4, 41.45, Zt - 1.8, 1.6, 1.6, { mat: 'path', h: 0.1, plate: { id: 'TE' }, name: 'dalle TE' });
plat(284.4, 41.45, Zt + 1.8, 1.6, 1.6, { mat: 'path', h: 0.1, plate: { id: 'TF' }, name: 'dalle TF' });
shoji(286.6, 41.4, Zt, 6, ['KC', 'TE', 'TF'], { hold: 8, speed: 1.0, name: 'shoji SD' });
block(293, -6, 41.4, Zt, 11, 8, { mat: 'stone', summit: 1, coop: 1, name: 'sanctuaire' }); // x 287.5 -> 298.5
cp(293.5, 41.4, Zt, { name: 'Le Sanctuaire du sommet', finish: true, r: 4 });

/* pilier à pics qui tourne sur la dernière terrasse : il décrit un cercle, on passe quand il s'écarte */
K.roller(293, 42.7, -2.4, 2.6, 0.6, { axis: 'y', spin: 4, zone: 11, move: { k: 'circ', r: 2.4, T: 7 } });
export default K.done({ abyss: -18, jp: { bells: { K1: 9, KA: 9, KB: 9, KC: 14 } } });
