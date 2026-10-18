// LES ENCHAÎNÉS — monde « Royaume médiéval », parcours 2 : « Les Remparts ». Le château de Loult par l'extérieur puis par le donjon,
// construit autour de ses MÉCANISMES : pont-levis sur les douves, herses de la porterie, lourde porte de bois, pilons et murs coulissants
// du chemin de ronde, treuil à contrepoids, remparts suspendus, herse lâchée à l'entrée du donjon, herse à deux plaques au sommet.
import { course } from '../kit.js';

const K = course({ id: 'remparts', world: 'medieval', name: 'Les Remparts', short: 'Pont-levis, herses et treuils du château', diff: 2, published: true,
  medals: { gold: 420, silver: 660, bronze: 960 }, backdrop: 'gorge' });
const { plat, block, cp, hint } = K, zone = K.zone;
const Z = 0; // axe du passage (z) au sol ; les remparts hauts sont en retrait (Zr)
const Zr = -1.9;

/* ------------------------- zone 1 — Les Douves : le pont-levis ------------------------- */
zone(1, 'Les Douves');
block(0, -8, 0, Z, 14, 8, { mat: 'stone', name: 'rive' });
cp(-3, 0, Z, { name: 'Les Douves', yaw: Math.PI });
plat(4.8, 1, Z + 1.6, 0.4, 0.4, { lever: { id: 'LB' }, ghost: 1 });
hint(1.5, 0, Z, 'Le pont-levis est relevé : actionne le levier (F). Il se relève tout seul au bout de 10 s, traversez ensemble');
K.drawbridge(16, 0, Z, 9, 3.4, { id: 'pont', side: -1, open: ['LB'], stay: 10, n: 12 });

/* ------------------------- zone 2 — La Porterie : deux herses au rythme différent ------------------------- */
zone(2, 'La Porterie');
block(19.5, -8, 0, Z, 7, 4.4, { mat: 'stone' });
K.herse(23, 0, Z, 3.4, 4.4, { open: 2.6, warn: 1, speed: 1.3, hold: 1.4, rise: 2.6 }); // descend au treuil : on a le temps
block(26.5, -8, 0, Z, 7, 4.4, { mat: 'brick' });
K.herse(30, 0, Z, 3.4, 4.4, { open: 2.2, warn: 0.8, fall: 'slam', hold: 1.6, rise: 2.4, ph: 1.4 }); // lâchée d'un coup
block(33.5, -8, 0, Z, 7, 4.4, { mat: 'stone' });
block(26.5, 0, 9, Z - 4.4, 16, 4, { mat: 'brick', nograb: 1, deco: 'wall' }); // mur de la porterie, derrière le passage
hint(19.5, 0, Z, 'Herses : écoutez le cliquetis avant la chute et passez ensemble. Une herse ne descend jamais sur quelqu\'un, mais la chaîne passe entre les barreaux');
cp(34.5, 0, Z, { name: 'La Porterie' });
K.cam(15, -3, -6, 37, 9, 8, { mode: 'three', yaw: 0.75, pitch: 0.26 }); // de trois-quarts : on voit les herses de face

/* ------------------------- zone 3 — La Cour : porte lourde, pilons, murs coulissants ------------------------- */
zone(3, 'La Cour');
plat(39.6, 1.1, Z, 3, 3, { mat: 'wood' });
plat(43.2, 2.2, Z, 3, 3, { mat: 'wood' });
plat(46.8, 3.3, Z, 3, 3, { mat: 'wood' });
block(52, -3, 4.4, Z, 6, 4.4, { mat: 'stone' });
hint(51, 4.4, Z, 'La lourde porte tombe dès qu\'on approche : attendez qu\'elle remonte, ou foncez pendant l\'alerte');
K.herse(55, 4.4, Z, 3.2, 4.4, { look: 'wood', mode: 'trigger', zone: [50.5, 59.5], warn: 1.3, speed: 2.6, hold: 2.2, rise: 3 });
cp(52, 4.4, Z, { name: 'La Cour' });
K.cam(48, 1, -6, 70, 14, 8, { mode: 'three', yaw: 0.6, pitch: 0.3 });
block(57.5, -3, 4.4, Z, 5, 4.4, { mat: 'stone' });
K.herse(60, 4.4, Z, 1.5, 4.4, { look: 'stone', w: 1.6, crush: 1, fall: 'slam', lift: 2.5, open: 1.5, warn: 0.55, hold: 0.6, rise: 1.3 }); // pilon
block(62.5, -3, 4.4, Z, 5, 4.4, { mat: 'stone' });
K.herse(65, 4.4, Z, 1.5, 4.4, { look: 'stone', w: 1.6, crush: 1, fall: 'slam', lift: 2.5, open: 1.5, warn: 0.55, hold: 0.6, rise: 1.3, ph: 1.6 });
block(67.5, -3, 4.4, Z, 5, 4.4, { mat: 'stone' });
hint(58, 4.4, Z, 'Pilons : ils rejettent sur le côté celui qui reste dessous. Retenez votre partenaire s\'il tombe');
plat(70, 6.6, Z - 3.6, 1.2, 2.4, { mat: 'brick', h: 2.2, move: { k: 'lin', az: 3.4, T: 3.4 }, hit: 1, nograb: 1 }); // mur coulissant
block(72.5, -3, 4.4, Z, 5, 4.4, { mat: 'stone' });

/* ------------------------- zone 4 — Le Treuil : contrepoids ------------------------- */
zone(4, 'Le Treuil');
cp(72.5, 4.4, Z, { name: 'Le Treuil' });
hint(74, 4.4, Z, 'Treuil : l\'un monte sur le plateau avant, l\'autre sur celui du fond ; il est hissé vers le rempart, puis tire son partenaire (V)');
plat(77, 4.4, Z + 0.7, 2.6, 2.6, { mat: 'wood', cw: { id: 'treuil', side: 1, d: 2.2, k: 2 } });
plat(77, 4.4, Zr, 2.6, 2.6, { mat: 'wood', cw: { id: 'treuil', side: -1, d: 2.2 } });
block(80.5, -1, 9.5, Zr, 4, 4, { mat: 'stone', coop: 1 });

/* ------------------------- zone 5 — Les Remparts : chemin de ronde suspendu ------------------------- */
zone(5, 'Le Chemin de ronde');
cp(80.5, 9.5, Zr, { name: 'Le Chemin de ronde' });
plat(86, 9.5, Zr, 5, 0.8, { mat: 'wood', h: 0.4, beam: 1 });
plat(91, 10.3, Zr, 3, 3, { mat: 'stone', h: 1.4 });
K.bridge(92.8, 101.2, 10.3, Zr);
block(104, 3, 10.3, Zr, 5, 5, { mat: 'brick' });
hint(104, 10.3, Zr, 'Le bélier balaie la poutre : passez entre deux coups');
plat(110.5, 10.3, Zr, 8, 1.0, { mat: 'wood', h: 0.5, beam: 1 });
plat(110.5, 11.25, Zr, 1.1, 1.3, { mat: 'metal', h: 1.1, move: { k: 'pend', axis: 'z', len: 5, amp: 0.9, T: 2.8 }, hit: 1, nograb: 1, hammer: 5 });
block(117, 4, 11.2, Zr, 4, 4, { mat: 'stone' });
hint(117, 11.2, Zr, 'La herse du donjon tombe d\'un coup dès qu\'on approche : attendez qu\'elle se relève et passez à deux');
K.herse(119.2, 11.2, Zr, 3.4, 4, { mode: 'trigger', zone: [114.5, 121.5], fall: 'slam', warn: 0.45, hold: 2.4, rise: 2.2, rearm: 2.5 });
block(122.4, 4, 11.2, Zr, 6.4, 4, { mat: 'brick' });
K.cam(113, 6, -8, 126, 20, 6, { mode: 'three', yaw: 0.65, pitch: 0.28 });
K.cam(155, 18, -8, 172, 32, 6, { mode: 'three', yaw: 0.65, pitch: 0.3 });

/* ------------------------- zone 6 — Le Donjon : escalade intérieure ------------------------- */
zone(6, 'Le Donjon');
cp(122.4, 11.2, Zr, { name: 'Le Donjon' });
block(127.1, 8, 18, Zr, 3, 4, { mat: 'rock', climb: 1, climbFaces: [1] });
plat(131.5, 18.8, Zr, 3, 3, { mat: 'stone', h: 1.2 });
K.bars(134.8, 140.2, 20.9, Zr, 4);
plat(143.4, 19.6, Zr, 3, 3, { mat: 'stone', h: 1.2 });
plat(147, 20.4, Zr, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
plat(150.6, 21.2, Zr, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
plat(154.2, 22.0, Zr, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
block(159.5, 14, 22.8, Zr, 6, 5, { mat: 'brick' });
hint(159.5, 22.8, Zr, 'Dernière herse : elle reste levée tant que les deux plaques sont pressées. Lâchez-les et courez ensemble');
plat(157.4, 22.85, Zr - 1.4, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'D1' } });
plat(161.4, 22.85, Zr + 1.4, 1.4, 1.4, { mat: 'metal', h: 0.1, plate: { id: 'D2' } });
K.herse(162.5, 22.8, Zr, 3.4, 5, { mode: 'switch', open: ['D1', 'D2'], start: 'shut', warn: 0.7, speed: 1.2, rise: 1.8 });

/* ------------------------- le sommet du donjon ------------------------- */
zone(7, 'Le Sommet du donjon');
block(167.5, 14, 22.8, Zr, 10, 6, { mat: 'brick', summit: 1, coop: 1 }); // derrière la herse à deux plaques
cp(168, 22.8, Zr, { name: 'Le Sommet du donjon', finish: true, r: 4 });

// falaise derrière tout le parcours
block(80, -50, 70, -14, 220, 14, { mat: 'cliff', zone: 0, cliff: 1, nograb: 1 });

/* rouleaux à pics des remparts : un balayeur sur le chemin de ronde, un autre devant le donjon */
K.roller(27, 9.5, -4.4, 3.6, 0.5, { axis: 'z', spin: 3, zone: 2, move: { k: 'lin', ax: 5.5, T: 9 } });
K.roller(168, 23.3, -1.9, 5, 0.5, { axis: 'z', spin: -3, zone: 7, move: { k: 'lin', ax: 3.5, T: 8 } });
export default K.done({ abyss: -24 });
