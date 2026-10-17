// LES ENCHAÎNÉS — monde « Passages glacés », parcours : « Le Col gelé ».
// Sept zones : le glacier (glace vive, neige poudreuse, pont de neige), les crevasses (ponts de glace qui se brisent, première stalactite),
// le vent du col (poutre givrée dans les rafales, balancier, courant ascendant), la GROTTE DE GLACE (galerie de stalactites, lac de glace mince
// qui ne porte qu'un grimpeur, mur de glace à deux dalles, barres au-dessus de la crevasse), l'AVALANCHE (course devant un mur de neige),
// le mur gelé (paroi, balanciers, tremplin de neige) et la banquise (floes commandés par un levier, glace mince en escalier, sérac final).
// Mécanismes propres au monde : core/biomes/ice.js (stalactites, glace mince, mur de glace, avalanche, neige poudreuse, courant de glace).
import { course } from '../kit.js';

const K = course({ id: 'col', world: 'ice', name: 'Le Col gelé', short: 'Glace vive, grotte, avalanche et banquise', diff: 4, published: true,
  medals: { gold: 560, silver: 860, bronze: 1250 }, backdrop: 'snow' });
const { plat, block, cp, hint, wind, cam, bridge, bars } = K;
// stalactite : pendue à `ground + 7`, sa pointe est à 4,6 m au-dessus du sol `ground` ; elle tombe quand on passe dessous (r = demi-largeur de déclenchement)
const stal = (x, ground, z, o = {}) => plat(x, ground + 7, z, 0.9, 0.9, { mat: 'icicle', h: 2.4, hit: 1, nograb: 1, ext: 'ice', ic: { k: 'stal', r: o.r ?? 2.2, fall: 4.6, warn: o.warn ?? 0.6, back: 6 }, name: 'stalactite' });
// glace mince : ne porte qu'un grimpeur à la fois
const thin = (x, top, z, w, d, o = {}) => plat(x, top, z, w, d, { mat: 'ice', ice: 1, h: 0.45, ext: 'ice', ic: { k: 'thin', max: 1, warn: 0.6, back: 6 }, name: 'glace mince', ...o });
const levier = (x, top, z, id, o = {}) => plat(x, top, z, 0.4, 0.4, { lever: { id }, ghost: 1, ...o });

/* ---------------- 1. Le Glacier ---------------- */
K.zone(1, 'Le Glacier');
block(0, -8, 0, 0, 10, 8, { mat: 'snow' });
cp(0, 0, 0, { name: 'Le Glacier', yaw: Math.PI });
hint(3, 0, 0, 'La glace glisse : on met du temps à s\'arrêter et à repartir. Anticipez vos sauts');
plat(8.4, 0, 0, 3.6, 3, { mat: 'ice', ice: 1, h: 1.6 });
plat(13.4, 0.5, 0.5, 3.6, 3, { mat: 'ice', ice: 1, h: 1.6 });
plat(18.4, 1, -0.5, 3.6, 3, { mat: 'ice', ice: 1, h: 1.6 });
hint(21.5, 1, 0, 'Neige poudreuse : on s\'y enfonce, on avance lentement');
plat(24.4, 1, 0, 7, 4, { mat: 'snow', h: 2, ic: { k: 'powder', slow: 0.5 }, name: 'neige poudreuse' });
bridge(29.6, 38.6, 1, 0, { d: 2, mat: 'snowbridge', sink: { d: 0.45, k: 30, max: 1.4 } });
plat(41, 1, 0, 4, 4, { mat: 'snow', h: 2 });

/* ---------------- 2. Les Crevasses ---------------- */
K.zone(2, 'Les Crevasses');
cp(41, 1, 0, { name: 'Les Crevasses' });
hint(42.5, 1, 0, 'Les ponts de glace se brisent peu après qu\'on s\'y pose : ne vous attardez pas');
plat(46.2, 1, 0, 3, 2.6, { mat: 'ice', ice: 1, h: 0.5, crumble: { t: 0.55, back: 4 } });
plat(51.2, 1.4, 0, 3, 2.6, { mat: 'ice', ice: 1, h: 0.5, crumble: { t: 0.55, back: 4 } });
plat(55.8, 1.8, 0, 3, 2.6, { mat: 'ice', ice: 1, h: 0.5, crumble: { t: 0.55, back: 4 } });
plat(63.5, 1.8, 0, 9, 4, { mat: 'snow', h: 2 });
hint(60.5, 1.8, 0, 'Une stalactite se décroche quand on passe dessous : écartez-vous ou courez');
stal(63.5, 1.8, 0, { r: 1.6, warn: 0.8 });
block(70.9, -6, 8, 0, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1], frozen: 1 });
plat(76.1, 8.6, 0, 5, 4, { mat: 'snow', h: 2 });

/* ---------------- 3. Le Vent du col ---------------- */
K.zone(3, 'Le Vent du col');
cp(76.1, 8.6, 0, { name: 'Le Vent du col' });
hint(78.4, 8.6, 0, 'Poutre givrée dans les rafales : arc-boutez-vous (Maj) quand le vent souffle, avancez entre deux');
plat(84.9, 8.6, 0, 12, 1.4, { mat: 'frost', h: 0.6, beam: 1 });
wind(84.1, 9.8, 0, 10.4, 3, 9, [0, 0, 28], { pulse: 3.2, ground: 1, gust: 1 });
plat(94.5, 9, 0, 4, 4, { mat: 'snow', h: 2 });
plat(100.1, 9.4, 0, 3, 1.4, { mat: 'ice', h: 0.6, move: { k: 'pend', axis: 'x', len: 6, amp: 0.4, T: 3.6 }, hang: 6 });
plat(105.7, 9.8, 0, 3, 3, { mat: 'snow', h: 2 });

/* ---------------- 4. La Grotte de glace ---------------- */
K.zone(4, 'La Grotte de glace');
plat(111.5, 9.8, 0, 4, 4, { mat: 'snow', h: 2 });
cp(111.5, 9.8, 0, { name: 'La Grotte de glace' });
hint(113.5, 9.8, 0, 'Galerie de stalactites : elles tombent quand on passe dessous, ne vous arrêtez pas sur la glace');
cam(110, 4, -8, 160, 24, 8, { mode: 'tunnel', pitch: 0.2 });
plat(119.5, 9.8, 0, 6, 3, { mat: 'ice', ice: 1, h: 1.2 });
stal(119.5, 9.8, 0, { r: 2.4, warn: 0.5 });
plat(127.5, 10.2, 0.4, 6, 3, { mat: 'ice', ice: 1, h: 1.2 });
stal(127.5, 10.2, 0.4, { r: 2.4, warn: 0.5 });
plat(135.5, 10.6, -0.4, 6, 3, { mat: 'ice', ice: 1, h: 1.2 });
stal(135.5, 10.6, -0.4, { r: 2.4, warn: 0.5 });
plat(142.5, 10.6, 0, 4, 4, { mat: 'snow', h: 2 });

/* ---------------- 5. Le Lac gelé : la glace mince ne porte qu'un grimpeur ---------------- */
K.zone(5, 'Le Lac gelé');
cp(142.5, 10.6, 0, { name: 'Le Lac gelé' });
hint(144.5, 10.6, 0, 'Glace mince : elle ne porte qu\'un seul grimpeur. Passez l\'un après l\'autre, la chaîne vous le permet');
thin(148.4, 10.6, 0, 3.2, 3);
thin(152.4, 10.6, 0.3, 3.2, 3);
thin(156.4, 10.6, -0.3, 3.2, 3);
thin(160.4, 10.6, 0, 3.2, 3);
plat(165.5, 10.6, 0, 5, 6, { mat: 'snow', h: 2 });

/* ---------------- 6. Le Mur de glace : deux dalles, une porte ---------------- */
K.zone(6, 'Le Mur de glace');
cp(165.5, 10.6, 0, { name: 'Le Mur de glace' });
cam(160, 6, -6, 190, 24, 8, { mode: 'three', yaw: 0.6, pitch: 0.28 });
hint(167.5, 10.6, 0, 'Un mur de glace barre la salle : une dalle chacun, ensemble. Il reste ouvert quelques secondes quand vous les quittez');
plat(176, 10.6, 0, 14, 6.4, { mat: 'snow', h: 2 }); // x 169 -> 183
plat(171.5, 10.65, -2.3, 1.6, 1.6, { mat: 'metal', h: 0.1, plate: { id: 'IA' }, name: 'dalle IA' });
plat(171.5, 10.65, 2.3, 1.6, 1.6, { mat: 'metal', h: 0.1, plate: { id: 'IB' }, name: 'dalle IB' });
block(177, 10.6, 15.8, 0, 0.9, 6.4, { mat: 'ice', nograb: 1, deco: 'gate', ext: 'ice', ic: { k: 'gate', open: ['IA', 'IB'], lift: 5.4, hold: 7, speed: 0.9 }, name: 'mur de glace' });
plat(188, 10.6, 0, 5, 4, { mat: 'snow', h: 2 });
hint(184.8, 10.6, 0, 'Barres de la grotte : suspendez-vous et passez de l\'une à l\'autre');
bars(191.5, 200.5, 12.7, 0, 4, { len: 3 });
plat(205, 11.4, 0, 4, 4, { mat: 'snow', h: 2 });

/* ---------------- 7. L'Avalanche : on court devant le mur de neige ---------------- */
K.zone(7, 'L\'Avalanche');
cp(205, 11.4, 0, { name: 'L\'Avalanche' });
hint(207, 11.4, 0, 'Une avalanche ! Courez sans vous arrêter : le mur de neige avance derrière vous');
cam(204, 4, -8, 300, 30, 8, { mode: 'far', dist: 5, pitch: 0.16 });
plat(211.5, 11.4, 0, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(216.8, 11.8, 0.6, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(222.2, 12.0, -0.6, 3.4, 3, { mat: 'ice', ice: 1, h: 1.4 });
plat(227.6, 12.2, 0.4, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(233, 12.2, -0.4, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(238.4, 12.6, 0.4, 3.4, 3, { mat: 'ice', ice: 1, h: 1.4 });
plat(243.8, 12.8, -0.4, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(249.2, 13, 0.4, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(254.6, 13.2, 0, 3.4, 3, { mat: 'snow', h: 1.4 });
plat(260, 13.4, 0.6, 3.4, 3, { mat: 'ice', ice: 1, h: 1.4 });
plat(265.4, 13.6, -0.6, 3.4, 3, { mat: 'snow', h: 1.4 });
block(273, -6, 13.8, 0, 8, 6, { mat: 'snow', name: 'abri' });
block(192, 6, 36, 0, 2.6, 9, { mat: 'snow', hit: 1, nograb: 1, ext: 'ice', ic: { k: 'wall', id: 'av', x0: 192, x1: 268, v: 3.7, trig: [209, 214] }, name: 'avalanche' });

/* ---------------- 8. Le Mur gelé ---------------- */
K.zone(8, 'Le Mur gelé');
cp(273, 13.8, 0, { name: 'Le Mur gelé' });
hint(275, 13.8, 0, 'Paroi gelée : plaquez-vous contre elle pour grimper, les rebords givrés glissent');
block(280.6, -6, 19.6, 0, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1], frozen: 1 });
plat(286.2, 20.2, 0, 4, 4, { mat: 'snow', h: 2 });
hint(289, 20.2, 0, 'Un courant de glace descend la pente : il vous ramène en arrière, ne ralentissez pas');
plat(293.2, 20.8, 0, 8, 3, { mat: 'ice', ice: 1, h: 1.2, ic: { k: 'cur', vx: -2.6 }, name: 'pente glacée' });
plat(301.2, 22, 0, 3.4, 3, { mat: 'frost', ice: 1, h: 0.6 });
plat(306.2, 23.2, 0, 3.4, 3, { mat: 'frost', ice: 1, h: 0.6 });
plat(311, 24.4, 0, 4, 4, { mat: 'snow', h: 2 });
hint(313, 24.4, 0, 'Un souffle monte de la crevasse : laissez-vous porter jusqu\'à la corniche');
plat(316, 24.4, 0, 2.6, 2.8, { mat: 'snow', h: 0.8, name: 'conduit' });
wind(316.3, 28.2, 0, 2.6, 7.6, 2.6, [0, 40, 0], { updraft: 1 });
const B0 = 320.8; // corniche de la banquise
plat(B0, 29.6, 0, 5, 4, { mat: 'snow', h: 2 });

/* ---------------- 9. La Banquise ---------------- */
K.zone(9, 'La Banquise');
cp(B0, 29.6, 0, { name: 'La Banquise' });
hint(B0 + 2.5, 29.6, 0, 'Le levier détache un floe : montez dessus ensemble, il traverse le chenal et revient');
levier(B0 + 2.4, 29.6, 1.4, 'F1', { ic: { pulse: 12 } });
block(B0 + 7.5, 20, 29.6, 0, 4, 5, { mat: 'snow', name: 'quai' });
plat(B0 + 18.5, 29.6, 0, 5.2, 4, { mat: 'snow', h: 1.2, move: { k: 'lin', ax: 6, T: 12, ph: -Math.PI / 2, gate: 'F1', pause: 0.5 }, name: 'floe' });
block(B0 + 31.5, 20, 29.6, 0, 6, 5, { mat: 'snow', name: 'quai 2' });
hint(B0 + 32.5, 29.6, 0, 'Le lac gelé : de la glace mince en escalier. Un seul sur chaque dalle');
thin(B0 + 39.4, 30.2, 0, 3.2, 3);
thin(B0 + 43.4, 30.8, 0.3, 3.2, 3);
thin(B0 + 47.4, 31.4, -0.3, 3.2, 3);
thin(B0 + 51.4, 32, 0, 3.2, 3);
plat(B0 + 56.5, 32, 0, 5, 4, { mat: 'snow', h: 2 });

/* ---------------- 10. Le Ravin : un pont-levis de glace que seule une dalle maintient baissée ---------------- */
K.zone(10, 'Le Ravin');
cp(B0 + 56.5, 32, 0, { name: 'Le Ravin' });
hint(B0 + 54.8, 32, 0, "Un pont-levis de glace : il ne reste baissé que tant qu'un grimpeur est sur une des deux dalles. L'un tient, l'autre passe, puis on échange");
plat(B0 + 58.2, 32.05, -1.2, 1.6, 1.6, { mat: 'metal', h: 0.1, plate: { id: 'RA' }, name: 'dalle RA' });
const RH = B0 + 59; // charnière, au bord de la corniche
const ravinIds = K.drawbridge(RH, 32, 0, 4, 3, { id: 'glace', open: ['RA', 'RB'], any: true, mat: 'ice', th: 0.5, lift: 0.5, drop: 1.4, vmax: 1.3 });
const ravinLand = plat(RH + 4 + 2.5, 32, 0, 5, 4, { mat: 'snow', h: 2 });
plat(RH + 4 + 1.0, 32.05, -1.2, 1.6, 1.6, { mat: 'metal', h: 0.1, plate: { id: 'RB' }, name: 'dalle RB' });

/* ---------------- 11. Le Sérac ---------------- */
K.zone(11, 'Le Sérac');
const S0 = RH + 4 + 2.5; // corniche d'arrivée du ravin
cp(S0, 32, 0, { name: 'Le Sérac' });
hint(S0 + 2.2, 32, 0, 'Le sérac final : une dernière paroi, puis le col');
block(S0 + 7.1, 22, 37.6, 0, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1], frozen: 1 });
plat(S0 + 12.5, 38.2, 0, 4, 4, { mat: 'snow', h: 2 });
block(S0 + 17.4, 22, 44.2, 0, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1], frozen: 1 });
block(S0 + 23.8, 22, 44.8, -1, 8, 7, { mat: 'snow', summit: 1 });
cp(S0 + 23.8, 44.8, -1, { name: 'Le Col', finish: true, r: 4 });

const level = K.done({ abyss: -20 });
level.bodies[ravinIds[0]].coop = 1; level.bodies[ravinLand].coop = 1; // le robot de tools/route.mjs ne sait pas poser les dalles : étape testée dans core/ice.test.js
export default level;
