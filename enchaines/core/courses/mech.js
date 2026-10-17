// LES ENCHAÎNÉS — monde « Rouages anciens », parcours : « La Grande Horloge ».
// L'intérieur d'une horloge géante : piston-tremplin, bras d'engrenage qui tournent autour de leur axe, grande roue verticale,
// levier qui met en marche une passerelle, couloir de pilons, contrepoids à deux, plateformes synchronisées, cadran à escalader.
// Mécaniques : pistons (propulsion), bras en orbite, roue verticale, levier + mécanisme commandé, pilons, contrepoids, puis (core/biomes/mech.js)
// tapis roulants (arrêtés par un levier minuté), jets de vapeur pulsés, balanciers, marteaux-pendules, roues dentées, plaques + porte, monte-charge.
import { course } from '../kit.js';

const K = course({ id: 'horloge', world: 'mech', name: 'La Grande Horloge', short: 'Engrenages, tapis, vapeur, pendules, pistons et leviers', diff: 4, published: true,
  medals: { gold: 560, silver: 840, bronze: 1200 }, backdrop: 'machine' });
const { plat, block, cp, hint, cam, wind, bars } = K;

/* ---------------- 1. Le Mécanisme ---------------- */
K.zone(1, 'Le Mécanisme');
block(0, -8, 0, 0, 10, 8, { mat: 'metal' });
cp(0, 0, 0, { name: 'Le Mécanisme', yaw: Math.PI });
hint(3, 0, 0, 'Le piston vous propulse quand il remonte : posez-vous dessus et laissez-le faire');
plat(7.8, 0, 0, 2.6, 2.6, { mat: 'brass', h: 1, launch: 13.5, move: { k: 'piston', ay: 1.2, T: 3 } });
plat(12.8, 4.5, -0.5, 4, 3, { mat: 'metal' });
block(20, -8, 4.2, 0, 1.6, 1.6, { mat: 'brass', nograb: 1, deco: 'hub' });
hint(13.5, 4.5, -0.5, 'Bras d\'engrenage : montez dessus quand il passe, descendez de l\'autre côté');
plat(23, 4.5, 0, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 20, cz: 0, w: 0.55 }, gearArm: 1 });
plat(17, 4.5, 0, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 20, cz: 0, w: 0.55 }, gearArm: 1 });
plat(28.6, 4.5, 0, 4, 4, { mat: 'metal' });

/* ---------------- 2. La Roue ---------------- */
K.zone(2, 'La Roue');
cp(28.6, 4.5, 0, { name: 'La Roue' });
hint(30, 4.5, 0, 'La grande roue monte : restez sur sa nacelle jusqu\'en haut');
for (let k = 0; k < 4; k++) plat(37, 9.5, 0, 2.6, 1.8, { mat: 'brass', h: 0.5, move: { k: 'circ', plane: 'xy', r: 5, T: 13, ph: -Math.PI / 2 + (k * Math.PI) / 2 }, wheel: { cx: 37, cy: 9.5 }, alt: k > 0 ? 1 : 0 });
plat(44.6, 14.5, 0, 4, 3, { mat: 'metal' });
plat(45.6, 15.2, -1.1, 0.4, 0.4, { mat: 'brass', lever: { id: 'L1' }, ghost: 1, h: 1.4 });
hint(44.6, 14.5, 0, 'Actionnez le levier (touche F) : la passerelle se met en marche');
plat(52, 14.5, 0, 3, 2.6, { mat: 'metal', move: { k: 'lin', ax: 3.6, T: 5, gate: 'L1' } });
plat(60.2, 14.5, 0, 4, 4, { mat: 'metal' });

/* ---------------- 3. Les Pilons ---------------- */
K.zone(3, 'Les Pilons');
cp(60.2, 14.5, 0, { name: 'Les Pilons' });
hint(62, 14.5, 0, 'Les pilons frappent en rythme : comptez, puis passez');
plat(68.2, 14.5, 0, 12, 3, { mat: 'metal', h: 1 });
plat(65, 18.4, 0, 2, 2.8, { mat: 'iron', h: 1, hit: 1, nograb: 1, move: { k: 'drop', fall: 3.4, T: 2.4, wait: 1.3 } });
plat(68.4, 18.4, 0, 2, 2.8, { mat: 'iron', h: 1, hit: 1, nograb: 1, move: { k: 'drop', fall: 3.4, T: 2.4, wait: 1.3, ph: 0.33 } });
plat(71.8, 18.4, 0, 2, 2.8, { mat: 'iron', h: 1, hit: 1, nograb: 1, move: { k: 'drop', fall: 3.4, T: 2.4, wait: 1.3, ph: 0.66 } });
plat(76.8, 14.5, 0, 2.4, 2.4, { mat: 'brass', h: 1, launch: 15.5, move: { k: 'piston', ay: 1, T: 3 } });
plat(81.6, 20.5, -1, 4, 3, { mat: 'metal' });

/* ---------------- 4. Les Contrepoids ---------------- */
K.zone(4, 'Les Contrepoids');
cp(81.6, 20.5, -1, { name: 'Les Contrepoids' });
hint(83, 20.5, -1, 'L\'un charge un plateau, l\'autre monte sur l\'autre plateau et atteint la corniche');
plat(86.6, 20.5, 0.8, 2.6, 2.6, { mat: 'brass', h: 0.5, cw: { id: 'C', side: 1, d: 2.2, k: 2 } });
plat(86.6, 20.5, -1.8, 2.6, 2.6, { mat: 'brass', h: 0.5, cw: { id: 'C', side: -1, d: 2.2 } });
block(90.1, 14, 25.6, -1.8, 4, 4, { mat: 'metal', coop: 1 });
plat(95.6, 26.2, -2.2, 2.4, 2.4, { mat: 'brass', h: 0.6, move: { k: 'lin', ax: 1.6, T: 3 } });
plat(100.8, 26.8, -2.2, 2.4, 2.4, { mat: 'brass', h: 0.6, move: { k: 'lin', ax: -1.6, T: 3 } });
plat(106, 27.4, -2.4, 3, 3, { mat: 'metal' });

/* ---------------- 5. L'Atelier : tapis roulants et presses ---------------- */
K.zone(5, 'L\'Atelier');
cp(106, 27.4, -2.4, { name: 'L\'Atelier' });
hint(108, 27.4, -2.4, 'Le tapis roulant vous ramène en arrière : courez, et méfiez-vous des presses');
const belt = (x, w, v, o = {}) => plat(x, 27.4, -2.4, w, 3, { mat: 'metal', h: 0.6, ext: 'mech', mc: { k: 'belt', v, ...o }, belt: 1 });
belt(115, 14, -2.4);
const press = (x, ph) => plat(x, 31.3, -2.4, 2, 2.8, { mat: 'iron', h: 1, hit: 1, nograb: 1, move: { k: 'drop', fall: 3.4, T: 2.4, wait: 1.3, ph } });
press(112.6, 0); press(118.6, 0.5);
plat(125.5, 27.4, -2.4, 4, 3, { mat: 'metal' });
cp(125.5, 27.4, -2.4, { name: 'Le Tapis' });
hint(127, 27.4, -2.4, 'Ce tapis est trop rapide : actionnez le levier (F), il s\'arrête quelques secondes');
plat(126.6, 28.1, -1.2, 0.4, 0.4, { lever: { id: 'LB1' }, mc: { pulse: 10 }, ghost: 1, h: 1.4 });
belt(136, 14, -5.2, { off: 'LB1' });
plat(146, 27.4, -2.4, 4, 3, { mat: 'metal' });

/* ---------------- 6. Les Chaudières : vapeur et balanciers ---------------- */
K.zone(6, 'Les Chaudières');
cp(146, 27.4, -2.4, { name: 'Les Chaudières' });
hint(147.5, 27.4, -2.4, 'Les jets de vapeur vous soulèvent : sautez dedans quand ils jaillissent');
wind(150.5, 33, -2.4, 2.6, 12, 2.6, [0, 46, 0], { steam: 1, pulse: 6 });
plat(154.5, 33.4, -2.4, 3, 3, { mat: 'metal' });
plat(162, 33.4, -2.4, 2.6, 2.6, { mat: 'brass', h: 0.5, move: { k: 'pend', amp: 0.75, len: 4.5, T: 4, axis: 'x' }, hang: 4.5 });
plat(170.9, 33.4, -2.4, 4, 3, { mat: 'metal' });
cp(170.9, 33.4, -2.4, { name: 'Les Vannes' });
wind(175.9, 39, -2.4, 2.6, 12, 2.6, [0, 46, 0], { steam: 1, pulse: 6 });
plat(180.4, 39.4, -2.4, 3, 3, { mat: 'metal' });
hint(182, 39.4, -2.4, 'Les marteaux balancent : passez quand ils s\'écartent');
plat(190, 39.4, -2.4, 12, 3, { mat: 'metal', h: 1 });
const hammer = (x, ph) => plat(x, 41.9, -2.4, 1.2, 3, { mat: 'iron', h: 2.2, hit: 1, nograb: 1, move: { k: 'pend', amp: 0.9, len: 6, T: 3.6, axis: 'x', ph }, hammer: 6 });
hammer(187.5, 0); hammer(192.5, Math.PI);

/* ---------------- 7. La Salle des cames : roues dentées et porte à deux plaques ---------------- */
K.zone(7, 'La Salle des cames');
plat(200, 39.4, -2.4, 4, 3, { mat: 'metal' });
cp(200, 39.4, -2.4, { name: 'La Salle des cames' });
hint(201.5, 39.4, -2.4, 'Les roues dentées tournent : montez dessus, sautez de l\'une à l\'autre');
plat(206.5, 39.4, -2.4, 5, 5, { mat: 'brass', h: 0.6, gear: 1, move: { k: 'rot', w: 0.5, T: 12.6 } });
plat(213, 39.4, -2.4, 5, 5, { mat: 'brass', h: 0.6, gear: 1, move: { k: 'rot', w: -0.6, T: 10.5 } });
plat(231, 39.4, -2.4, 26, 6, { mat: 'metal', h: 1 });
cp(222, 39.4, -2.4, { name: 'La Porte des cames' });
hint(224, 39.4, -2.4, 'Chacun sur sa plaque : la porte s\'ouvre tant que les deux sont enfoncées. Passez ensemble !');
plat(229.2, 39.4, -2.4, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'K1' } });
plat(233.6, 39.4, -2.4, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'K2' } });
block(238.2, 39.3, 44.3, -2.4, 0.6, 6, { mat: 'metal', door: { open: ['K1', 'K2'], close: 0.16 }, nograb: 1 });

/* ---------------- 8. Le Monte-charge ---------------- */
K.zone(8, 'Le Monte-charge');
cp(241, 39.4, -2.4, { name: 'Le Monte-charge' });
hint(241, 39.4, -2.4, 'Levier (F) : la cabine monte, attend en haut, puis redescend. Sautez à temps !');
plat(242.2, 40.1, -4.2, 0.4, 0.4, { lever: { id: 'LE' }, mc: { pulse: 8 }, ghost: 1, h: 1.4 });
plat(247, 44.4, -2.4, 4, 4, { mat: 'brass', h: 0.6, move: { k: 'lin', ay: 5, T: 8, pause: 0.6, gate: 'LE', ph: -Math.PI / 2 } });
plat(253.5, 49.4, -2.4, 4, 3, { mat: 'metal' });

/* ---------------- 9. Le Puits des pistons et les barres ---------------- */
K.zone(9, 'Le Balancier');
cp(253.5, 49.4, -2.4, { name: 'Le Balancier' });
hint(255, 49.4, -2.4, 'Piston, puis barres : suspendez-vous et sautez de l\'une à l\'autre');
plat(258.2, 49.4, -2.4, 2.4, 2.4, { mat: 'brass', h: 1, launch: 13.5, move: { k: 'piston', ay: 1.2, T: 3 } });
plat(263.1, 53.9, -2.4, 4, 3, { mat: 'metal' });
bars(266.9, 274.7, 56, -2.4, 5, { len: 3 });
plat(277.9, 52.6, -2.4, 3, 3, { mat: 'metal', h: 1.2 });

/* ---------------- 10. Le Cadran ---------------- */
K.zone(10, 'Le Cadran');
cp(277.9, 52.6, -2.4, { name: 'Le Cadran' });
block(282.5, 39.4, 60.4, -2.4, 3, 5, { mat: 'grate', climb: 1, climbFaces: [1] });
cam(272, 50, -10, 312, 68, 6, { mode: 'far', dist: 4 });
plat(287.5, 60.4, -2.4, 3, 3, { mat: 'metal', h: 1.2 });
block(294.2, 44, 60.1, -2.4, 1.6, 1.6, { mat: 'brass', nograb: 1, deco: 'hub' });
plat(297.2, 60.4, -2.4, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 294.2, cz: -2.4, w: 0.55, T: 11.4 }, gearArm: 1 });
plat(291.2, 60.4, -2.4, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 294.2, cz: -2.4, w: 0.55, T: 11.4 }, gearArm: 1 });
block(302.8, 48, 60.4, -2.4, 8, 7, { mat: 'metal', summit: 1 });
cp(302.8, 60.4, -2.4, { name: 'Le sommet de l\'horloge', finish: true, r: 4 });

export default K.done({ abyss: -18 });
