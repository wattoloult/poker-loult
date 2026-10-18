// LES ENCHAÎNÉS — monde « Ruines célestes », parcours : « Les Îles du Vent ». Onze zones au-dessus des nuages, de l'archipel du départ au temple du ciel.
// Mécanismes : courants ascendants, rafales latérales (s'arc-bouter les annule), plateformes en orbite, vent de face, NUAGES-RESSORTS (launch),
// BALLONS-ASCENSEURS (ext 'sky', core/biomes/sky.js : la nacelle monte tant qu'on est dessus, il en faut deux pour le gros), ponts de cordes
// (planches qui plient, une volée de planches vermoulues), moulins (poutres tournantes), grande roue de nuages, barges à levier, lianes,
// balance à contrepoids (coop), herse du temple à deux plaques (coop).
import { course } from '../kit.js';

const K = course({ id: 'iles', world: 'sky', name: 'Les Îles du Vent', short: 'Courants, ballons, moulins et nuages-ressorts', diff: 3, published: true,
  medals: { gold: 560, silver: 880, bronze: 1300 }, backdrop: 'sky' });
const { plat, block, cp, hint, rope, wind, cam, bridge } = K;
const isle = (x, top, z, w, d, o = {}) => plat(x, top, z, w, d, { mat: 'grass', h: 2.4, island: 1, ...o });
const ruin = (x, top, z, w, d, o = {}) => plat(x, top, z, w, d, { mat: 'stone', h: 1.6, island: 1, ...o });
const spring = (x, top, z = 0) => plat(x, top, z, 2.8, 2.8, { mat: 'stone', h: 0.8, cloud: 1, launch: 17, coop: 1 });
const lift = (x, top, o) => plat(x, top, 0, o.w || 3.6, o.w || 3.6, { mat: 'wood', h: 0.5, ext: 'sky', sky: { k: 'lift', rise: o.rise, up: o.up ?? 3, down: o.down ?? 1.6, need: o.need || 1 }, balloon: o.need || 1, coop: 1 });

/* ---------------- 1. L'Envol ---------------- */
K.zone(1, 'L\'Envol');
block(0, -12, 0, 0, 10, 8, { mat: 'grass', island: 1 });
cp(0, 0, 0, { name: 'L\'Envol', yaw: Math.PI });
hint(3, 0, 0, 'Les îles sont espacées : prenez toute votre élan avant de sauter');
isle(8.6, 0.4, 0, 3, 3);
isle(14.4, 1, 1, 3, 3);
isle(20.2, 1.6, -0.5, 3, 3);
hint(21, 1.6, -0.5, 'Courant ascendant : sautez dedans, il vous porte vers l\'île du haut');
wind(25, 9, 0, 2.6, 22, 2.6, [0, 46, 0], { updraft: 1 });
isle(29.6, 14, 0, 4, 4);

/* ---------------- 2. Les Rafales ---------------- */
K.zone(2, 'Les Rafales');
cp(29.6, 14, 0, { name: 'Les Rafales' });
hint(32, 14, 0, 'Les rafales poussent hors de la passerelle : maintenez Maj pendant qu\'elles soufflent');
plat(38, 14, 0, 12, 1.2, { mat: 'stone', h: 0.6, beam: 1 });
wind(38, 15.2, 0, 12, 3, 9, [0, 0, -40], { pulse: 3, ground: 1, gust: 1 });
isle(47.6, 14.6, 0, 4, 4);
plat(54.4, 14.6, 0, 5.2, 1.6, { mat: 'stone', h: 0.6, move: { k: 'rot', w: 0.55 } });
isle(61.2, 15.2, 0, 4, 4);

/* ---------------- 3. Les Orbites ---------------- */
K.zone(3, 'Les Orbites');
cp(61.2, 15.2, 0, { name: 'Les Orbites' });
plat(67.4, 15.2, 0, 2.8, 2.8, { mat: 'grass', h: 2, island: 1, move: { k: 'circ', r: 2.2, T: 7 } });
plat(73.8, 16, 0, 2.8, 2.8, { mat: 'grass', h: 2, island: 1, move: { k: 'circ', r: 2.2, T: 7, ph: Math.PI } });
plat(80, 16.8, 0, 3, 3, { mat: 'stone', h: 1, move: { k: 'lin', ay: 1.6, T: 5 } });
isle(86, 17.4, 0, 4, 4);
const r1 = rope(92, 26, 0, 8);
isle(98.4, 17.4, 0, 4, 4, { via: { ropes: [r1] } });

/* ---------------- 4. Les nuages-ressorts ---------------- */
K.zone(4, 'Les nuages-ressorts');
cp(98.4, 17.4, 0, { name: 'Les nuages-ressorts' });
hint(101, 17.4, 0, 'Les gros nuages sont élastiques : retombez dessus, ils vous catapultent. Visez le suivant en l\'air');
spring(104.4, 17.4);
spring(110.2, 22.2);
spring(116, 27);
spring(121.8, 31.8);
ruin(129, 36.6, 0, 4, 4);

/* ---------------- 5. Le Ballon ---------------- */
K.zone(5, 'Le Ballon');
cp(129, 36.6, 0, { name: 'Le Ballon' });
hint(130.5, 36.6, 0, 'Montez sur la nacelle : le ballon s\'élève tant que quelqu\'un est dessus. Sautez sur l\'île du haut, il redescendra');
lift(134.6, 36.6, { rise: 12, w: 3.6 });
isle(140.8, 48.8, 0, 4, 4, { coop: 1 }); // atteint en ballon (testé dans core/sky.test.js)

/* ---------------- 6. Les Cordes ---------------- */
K.zone(6, 'Les ponts de cordes');
cp(140.8, 48.8, 0, { name: 'Les ponts de cordes' });
hint(143.6, 48.8, 0, 'Pont de cordes : les planches plient sous le poids, les rafales poussent sur le côté. Maj pour s\'arc-bouter');
bridge(145, 160, 48.8, 0, { d: 1.9, mat: 'wood' });
wind(152.5, 50, 0, 15, 3, 9, [0, 0, -38], { pulse: 3.4, ph: 0.6, ground: 1, gust: 1 });
isle(165.4, 49.2, 0, 4.4, 4);
cp(165.4, 49.2, 0, { name: 'L\'îlot du milieu' });
hint(168.6, 49.2, 0, 'Ces planches sont vermoulues : elles cèdent peu après votre passage. Ne vous arrêtez pas');
bridge(169.8, 184, 49.2, 0, { d: 1.9, mat: 'wood', extra: { crumble: { t: 0.7, back: 4.5 } } });
isle(189.4, 49.8, 0, 4.4, 4);

/* ---------------- 7. Les Moulins ---------------- */
K.zone(7, 'Les Moulins');
cp(189.4, 49.8, 0, { name: 'Le grand courant' });
hint(191.6, 49.8, 0, 'Un nouveau courant vous porte vers les moulins : sautez dans la colonne d\'air');
wind(194.6, 57.3, 0, 2.6, 22, 2.6, [0, 46, 0], { updraft: 1 });
isle(199, 63.4, 0, 4, 4, { mill: 1 });
cp(199, 63.4, 0, { name: 'Les moulins' });
hint(201.6, 63.4, 0, 'Les ailes des moulins tournent : montez sur une poutre quand elle passe près de vous');
plat(206, 64, 0, 5.2, 1.6, { mat: 'wood', h: 0.5, move: { k: 'rot', w: 0.6 }, sail: 1 });
isle(212.8, 64.6, 0, 4, 4, { mill: 1 });
plat(219.8, 65.2, 0, 5.2, 1.6, { mat: 'wood', h: 0.5, move: { k: 'rot', w: -0.65, ph: 1.2 }, sail: 1 });
isle(226.8, 65.8, 0, 4, 4, { mill: 1 });
cp(226.8, 65.8, 0, { name: 'La grande roue' });
hint(229.4, 65.8, 0, 'La grande roue de nuages tourne : grimpez sur un nuage en bas, descendez de l\'autre côté, en haut');
for (let k = 0; k < 3; k++) plat(234, 67.6, 0, 3, 3, { mat: 'stone', h: 0.6, cloud: 1, wheel: 1, move: { k: 'circ', plane: 'xy', r: 2.4, T: 12, ph: k * 2.0944 } });
isle(241.2, 68.2, 0, 4, 4);
cp(241.2, 68.2, 0, { name: 'Les barges' });
hint(243.8, 68.2, 0, 'Tirez le levier (F) : les barges du ciel se mettent à naviguer. Traversez ensemble');
plat(240.4, 68.2, 1.6, 0.4, 0.4, { lever: { id: 'B1' }, ghost: 1 });
plat(248, 68.4, 0, 3.2, 3, { mat: 'wood', h: 0.6, barge: 1, move: { k: 'lin', ax: 1.9, T: 6, gate: 'B1' } });
plat(253.8, 68.7, 0, 3.2, 3, { mat: 'wood', h: 0.6, barge: 1, move: { k: 'lin', ax: 1.9, T: 6, gate: 'B1', ph: Math.PI } });
isle(260.6, 69.2, 0, 4, 4);

/* ---------------- 8. La Tempête ---------------- */
K.zone(8, 'La Tempête');
cp(260.6, 69.2, 0, { name: 'La Tempête' });
hint(263.2, 69.2, 0, 'Tempête : deux passerelles battues par des rafales contraires. Maj pour tenir bon');
plat(270.8, 69.2, 0, 12, 1.2, { mat: 'stone', h: 0.6, beam: 1 });
wind(270.8, 70.4, 0, 12, 3, 9, [0, 0, 40], { pulse: 3, ph: 1.4, ground: 1, gust: 1 });
isle(281, 69.8, 0, 4, 4);
plat(291.6, 69.8, 0, 14, 1.2, { mat: 'stone', h: 0.6, beam: 1 });
wind(291.6, 71, 0, 14, 3, 9, [0, 0, -42], { pulse: 2.6, ph: 0.3, ground: 1, gust: 1 });
isle(302.2, 70.4, 0, 4, 4);
cp(302.2, 70.4, 0, { name: 'Les nuages d\'orage' });
hint(304.8, 70.4, 0, 'Les nuages d\'orage se dissipent peu après qu\'on y a posé le pied : enchaînez les sauts');
for (let k = 0; k < 4; k++) plat(308.6 + k * 5.4, 70.9 + k * 0.5, 0, 2.8, 2.8, { mat: 'stone', h: 0.8, cloud: 1, storm: 1, crumble: { t: 0.65, back: 4.5 } });
isle(330.8, 73.2, 0, 4, 4);

/* ---------------- 9. Les Lianes ---------------- */
K.zone(9, 'Les lianes');
cp(330.8, 73.2, 0, { name: 'Les lianes' });
hint(333.4, 73.2, 0, 'Courant ascendant, puis les grandes lianes : balancez-vous (saut pour lâcher) et visez l\'île suivante');
wind(335.8, 80.7, 0, 2.6, 22, 2.6, [0, 46, 0], { updraft: 1 });
isle(340.4, 86.8, 0, 4, 4);
const l1 = rope(346.6, 95.4, 0, 8);
isle(352.8, 87.4, 0, 4, 4, { via: { ropes: [l1] } });
const l2 = rope(359, 96, 0, 8);
isle(365.2, 88, 0, 4, 4, { via: { ropes: [l2] } });
cp(365.2, 88, 0, { name: 'La balance des nuages' });

/* ---------------- 10. La Balance ---------------- */
K.zone(10, 'La balance des nuages');
hint(367.4, 88, 0, 'Balance : l\'un monte sur le grand plateau (celui qui descend), l\'autre sur le petit ; il est hissé vers la corniche, puis tire son partenaire (V)');
plat(371.4, 88, 0.7, 2.6, 2.6, { mat: 'stone', h: 0.6, cw: { id: 'balance', side: 1, d: 2.2, k: 2 } });
plat(371.4, 88, -1.9, 2.6, 2.6, { mat: 'stone', h: 0.6, cw: { id: 'balance', side: -1, d: 2.2 } });
block(375, 83, 93.1, -1.9, 4, 4, { mat: 'stone', coop: 1, island: 1 });
isle(381.4, 93.2, 0, 5, 5);

/* ---------------- 11. Le Temple du ciel ---------------- */
K.zone(11, 'Le Temple du ciel');
cp(381.4, 93.2, 0, { name: 'Le Temple du ciel' });
hint(383.4, 93.2, 0, 'Le gros ballon est lourd : il ne décolle qu\'avec vous DEUX à bord');
lift(389.6, 93.2, { rise: 14, w: 4.2, need: 2, up: 3.2 });
ruin(398.4, 107.4, 0, 4.4, 4, { coop: 1 }); // idem, avec le gros ballon à deux
cp(398.4, 107.4, 0, { name: 'Les vents du temple' });
hint(400.8, 107.4, 0, 'Vent de face par rafales : sautez entre deux bourrasques');
ruin(405.2, 108, 0, 3, 3);
ruin(411.4, 108.6, 0, 3, 3);
wind(405.4, 110, 0, 16, 8, 8, [-16, 0, 0], { pulse: 2.4, ph: 1, gust: 1 });
bridge(413.2, 424.6, 108.6, 0, { d: 1.8, mat: 'stone' });
block(430, 96, 109.2, 0, 8, 5, { mat: 'stone', island: 1 });
cp(430, 109.2, 0, { name: 'La herse du temple' });
hint(430, 109.2, 0, 'La herse ne reste levée que si DEUX plaques sont pressées : lâchez-les et courez ensemble');
plat(428.2, 109.25, -1.3, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'T1' } });
plat(432.2, 109.25, 1.3, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'T2' } });
K.herse(434, 109.2, 0, 3.4, 5, { look: 'stone', mode: 'switch', open: ['T1', 'T2'], start: 'shut', warn: 0.7, speed: 1.2, rise: 1.8 });
cam(424, 104, -8, 456, 124, 8, { mode: 'far', dist: 6 });
block(444.4, 100, 109.2, 0, 10, 8, { mat: 'stone', summit: 1, island: 1, coop: 1 });
cp(444.4, 109.2, 0, { name: 'Le temple du ciel', finish: true, r: 4 });

/* l'île finale : un rouleau à pics balaie la plateforme dans sa profondeur */
K.roller(444.4, 109.7, 0, 7.4, 0.5, { axis: 'z', spin: 3, zone: 11, move: { k: 'lin', ax: 3, T: 8 } });
export default K.done({ abyss: -20 });
