// LES ENCHAÎNÉS — monde « Le Sommet du monde », parcours final : « Le Toit du monde ».
// La finale : onze chapitres qui reprennent tout (piquets de précision, paroi, lianes au-dessus du gouffre, courant ascendant et rafales,
// piston et bras d'engrenage, barres et glace, contrepoids à deux, sauvetage obligé) et y ajoutent les mécanismes du sommet
// (core/biomes/summit.js) : foudre et abris, rochers qui roulent et niches, avalanche qui poursuit, balises à allumer à deux, arche finale.
import { course } from '../kit.js';

const K = course({ id: 'toit', world: 'summit', name: 'Le Toit du monde', short: 'L\'ascension finale : tempête, avalanche et arche', diff: 5, published: true,
  medals: { gold: 840, silver: 1200, bronze: 1700 }, backdrop: 'valley' });
const { plat, block, cp, hint, rope, wind, cam, bridge, bars, herse } = K;
const Z = -0.5;
// décor / porteurs de données : jamais une étape du parcours (deco), jamais saisis
const roof = (x, top, z, w, d) => block(x, top + 2.9, top + 3.9, z, w, d, { mat: 'rock', deco: 'roof', nograb: 1 });
const bolt = (x, top, z, sm) => plat(x, top, z, 0.5, 0.5, { h: 0.1, ghost: 1, noMesh: 1, deco: 1, ext: 'summit', sm: { k: 'bolt', T: 6.5, warn: 1.4, r: 2.1, ...sm } });

/* ---------------- 1. Le Camp de base ---------------- */
K.zone(1, 'Le Camp de base');
block(0, -8, 0, 0, 10, 8, { mat: 'stone' });
cp(0, 0, 0, { name: 'Le Camp de base', yaw: Math.PI });
hint(3, 0, 0, 'Dernière ascension : tout ce que vous avez appris vous servira');
plat(7.6, 0.6, 0, 1.3, 1.3, { mat: 'wood', h: 6, post: 1 });
plat(11.3, 1.3, 1, 1.3, 1.3, { mat: 'wood', h: 6, post: 1 });
plat(15, 2, -0.6, 1.3, 1.3, { mat: 'wood', h: 6, post: 1 });
plat(18.8, 2.7, 0.6, 1.3, 1.3, { mat: 'wood', h: 6, post: 1 });
block(23.6, -8, 3.2, 0, 4, 5, { mat: 'stone' });
block(28.4, -8, 11, -0.5, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1] });
plat(33.6, 11.6, -0.5, 5, 4, { mat: 'stone', h: 1.4 });

/* ---------------- 2. Le Gouffre (deux traversées de lianes) ---------------- */
K.zone(2, 'Le Gouffre');
cp(33.6, 11.6, -0.5, { name: 'Le Gouffre' });
const r1 = rope(40, 19.5, Z, 7.4), r2 = rope(47.8, 20, Z, 7.4);
plat(53.2, 13.6, Z, 2.4, 2.4, { mat: 'wood', h: 0.4, crumble: { t: 0.7, back: 4 }, via: { ropes: [r1, r2] } });
const r3 = rope(58.4, 21.6, Z, 7.4);
plat(65, 14.2, Z, 4, 4, { mat: 'stone', h: 1.4, via: { ropes: [r3] } });
cp(65, 14.2, Z, { name: 'Le second gouffre' });
hint(67, 14.2, Z, 'Un second gouffre, plus large : enchaînez les lianes sans vous arrêter');
const r4 = rope(70.2, 21.8, Z, 7.4), r5 = rope(78, 22.4, Z, 7.4);
plat(83.4, 14.8, Z, 2.4, 2.4, { mat: 'wood', h: 0.4, crumble: { t: 0.7, back: 4 }, via: { ropes: [r4, r5] } });
const r6 = rope(88.6, 22.6, Z, 7.4);
plat(94.6, 15.4, Z, 4, 4, { mat: 'stone', h: 1.4, via: { ropes: [r6] } });

/* ---------------- 3. Le Vent des cimes ---------------- */
K.zone(3, 'Le Vent des cimes');
cp(94.6, 15.4, Z, { name: 'Le Vent des cimes' });
wind(99.6, 23.2, Z, 2.6, 20, 2.6, [0, 46, 0], { updraft: 1 });
plat(104.2, 28.6, Z, 4, 4, { mat: 'stone', h: 1.4 });
plat(113.6, 28.6, Z, 13, 1.4, { mat: 'frost', h: 0.6, beam: 1 });
wind(112.8, 29.8, Z, 11.4, 3, 9, [0, 0, -34], { pulse: 2.8, ground: 1, gust: 1 });
plat(123, 29, Z, 4, 4, { mat: 'stone', h: 1.4 });

/* ---------------- 4. L'Orage (foudre et abris) ---------------- */
K.zone(4, 'L\'Orage');
cp(123, 29, Z, { name: 'L\'Orage' });
hint(125.5, 29, Z, 'La foudre frappe : le sol rougeoie juste avant. Abritez-vous sous une roche !');
plat(129.2, 29.4, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                           // 1 : exposée
bolt(129.2, 29.4, Z, { ph: 0 });
plat(135.6, 29.8, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                           // 2 : abri
roof(136.4, 29.8, Z, 2.4, 3.2);
plat(142, 30.2, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                             // 3
bolt(142, 30.2, Z, { ph: 0.33 });
plat(148.4, 30.6, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                           // 4
bolt(148.4, 30.6, Z, { ph: 0.66 });
plat(154.8, 31, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                             // 5 : abri
roof(155.6, 31, Z, 2.4, 3.2);
plat(161.2, 31.4, Z, 3.4, 3.4, { mat: 'rock', h: 1.2 });                            // 6
bolt(161.2, 31.4, Z, { ph: 0.12, T: 5.8 });
plat(167.2, 31.8, Z, 3.4, 3.4, { mat: 'rock', h: 1.2 });                            // 7
bolt(167.2, 31.8, Z, { ph: 0.55, T: 5.8 });
plat(173.2, 32.2, Z, 3.6, 3.6, { mat: 'stone', h: 1.2 });                           // 8 : abri
roof(174, 32.2, Z, 2.4, 3.2);
block(178.6, 20, 40, Z, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1] });
plat(183.8, 40.6, Z, 4, 4, { mat: 'stone', h: 1.4 });

/* ---------------- 5. La Machinerie (piston, bras d'engrenage, pilons) ---------------- */
K.zone(5, 'La Machinerie');
cp(183.8, 40.6, Z, { name: 'La Machinerie' });
plat(189, 40.6, Z, 2.6, 2.6, { mat: 'brass', h: 1, launch: 13.5, move: { k: 'piston', ay: 1.2, T: 3 } });
plat(193.8, 45.2, -1, 4, 3, { mat: 'metal' });
block(201, 32.8, 44.9, -1, 1.6, 1.6, { mat: 'brass', nograb: 1, deco: 'hub' });
plat(204, 45.2, -1, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 201, cz: -1, w: 0.6 }, gearArm: 1 });
plat(198, 45.2, -1, 3.6, 1.4, { mat: 'brass', h: 0.5, move: { k: 'orbit', cx: 201, cz: -1, w: 0.6 }, gearArm: 1, alt: 1 });
plat(209.6, 45.2, -1, 4, 4, { mat: 'metal' });

/* ---------------- 6. La Grotte de glace ---------------- */
K.zone(6, 'La Grotte de glace');
cp(209.6, 45.2, -1, { name: 'La Grotte de glace' });
bars(214, 223, 47.1, -1, 4, { len: 3 });
cam(208.4, 40.8, -9, 230.4, 52.8, 7, { mode: 'tunnel', pitch: 0.2 });
plat(227.4, 45.2, -1, 3.6, 3, { mat: 'ice', ice: 1, h: 1 });
plat(232.2, 45.6, -1, 3.6, 3, { mat: 'ice', ice: 1, h: 1, crumble: { t: 0.6, back: 4 } });
plat(231.2, 51.4, -1, 0.8, 0.8, { mat: 'icicle', h: 1.6, hit: 1, nograb: 1, move: { k: 'drop', fall: 5.2, T: 3, wait: 1.8 } });
plat(237.4, 46, -1, 4, 4, { mat: 'snow', h: 1.6 });

/* ---------------- 7. Le Treuil (contrepoids à deux) ---------------- */
K.zone(7, 'Le Treuil');
cp(237.4, 46, -1, { name: 'Le Treuil' });
hint(238.9, 46, -1, 'Contrepoids : l\'un charge, l\'autre monte ; puis le premier remonte la chaîne (Maj) ou se fait hisser');
plat(242.6, 46, 0.8, 2.6, 2.6, { mat: 'brass', h: 0.5, cw: { id: 'T', side: 1, d: 2.2, k: 2 } });
plat(242.6, 46, -1.8, 2.6, 2.6, { mat: 'brass', h: 0.5, cw: { id: 'T', side: -1, d: 2.2 } });
block(246.1, 38.8, 51.1, -1.8, 4, 4, { mat: 'stone', coop: 1 });

/* ---------------- 8. Les Éboulis (rochers qui roulent, niches) ---------------- */
K.zone(8, 'Les Éboulis');
cp(246.1, 51.1, -1.8, { name: 'Les Éboulis' });
hint(250, 51.1, -1.8, 'Des rochers dévalent la corniche : sautez-les ou glissez-vous dans une niche');
block(267.1, 49.2, 51.1, -1.8, 38, 2.2, { mat: 'rock' });
for (const x of [254, 260.5, 267, 273.5, 280, 284.5]) block(x, 49.2, 51.1, 0.4, 3, 2.2, { mat: 'rock', deco: 'niche' });
const boulder = (ph) => plat(285.5, 52.6, -1.8, 1.5, 2.2, { h: 1.5, hit: 1, nograb: 1, noMesh: 1, deco: 'boulder', ext: 'summit', sm: { k: 'roll', x0: 285.5, x1: 249.5, T: 9, run: 0.67, ph } });
boulder(0); boulder(0.5);

/* ---------------- 9. L'Arête ---------------- */
K.zone(9, 'L\'Arête');
cp(284.5, 51.1, -1.8, { name: 'L\'Arête' });
hint(286, 51.1, -1.8, 'L\'arête finale : sauts de précision, et le vent s\'en mêle');
plat(289.4, 51.8, -2.2, 1.3, 1.3, { mat: 'rock', h: 4, post: 1 });
plat(293.2, 52.4, -1.4, 1.3, 1.3, { mat: 'rock', h: 4, post: 1 });
plat(297, 53, -2.6, 1.3, 1.3, { mat: 'rock', h: 4, post: 1 });
bridge(298.4, 307.4, 53, -2.6, { d: 1.8, mat: 'snowbridge' });
wind(302.9, 54.6, -2.6, 9.4, 3, 6, [0, 0, -30], { pulse: 3.4, ground: 1, gust: 1 });
block(312.4, 40, 60.2, -2.6, 4, 5, { mat: 'rock', climb: 1, climbFaces: [1] });
cam(296, 50, -10, 322, 72, 8, { mode: 'far', dist: 6 });

/* ---------------- 10. L'Avalanche (course contre le mur de neige) ---------------- */
K.zone(10, 'L\'Avalanche');
block(320.4, 45, 60.8, -2.6, 9, 9, { mat: 'stone' });
cp(320.4, 60.8, -2.6, { name: 'Le Col des neiges' });
hint(320.4, 60.8, -2.6, 'Dès que vous quittez le col, la neige se détache derrière vous : ne vous arrêtez plus !');
plat(320.4, 60.8, -2.6, 0.5, 0.5, { h: 0.1, ghost: 1, noMesh: 1, deco: 1, ext: 'summit', sm: { k: 'avl', id: 'A', x0: 303, x1: 393, v: 3.4, trig: [322.6, 324.6] } });
plat(328.6, 61.4, -2, 2.6, 2.6, { mat: 'stone', h: 0.8 });
plat(333.6, 61.9, -1.2, 2.2, 2.2, { mat: 'wood', h: 0.4, crumble: { t: 0.8, back: 5 } });
plat(338.6, 62.4, -2.2, 2.4, 2.4, { mat: 'stone', h: 0.8 });
bridge(341.4, 350.4, 62.4, -2.2, { d: 1.8, mat: 'snowbridge' });
plat(354.2, 62.9, -2.2, 3, 3, { mat: 'stone', h: 1 });
plat(359.4, 63.2, -1.6, 3.4, 3, { mat: 'ice', ice: 1, h: 1 });
plat(364.4, 63.6, -2.4, 2.2, 2.2, { mat: 'wood', h: 0.4, crumble: { t: 0.8, back: 5 } });
plat(368.4, 64, -1.6, 1.3, 1.3, { mat: 'rock', h: 4, post: 1 });
plat(372.2, 64.6, -2.4, 1.3, 1.3, { mat: 'rock', h: 4, post: 1 });
plat(376.4, 65.2, -2, 3, 3, { mat: 'stone', h: 1 });
bars(380.8, 389.8, 67.1, -2, 4, { len: 3 });
plat(394.2, 65.6, -2, 3.6, 3.6, { mat: 'stone', h: 1.2 });

/* ---------------- 11. L'Arche (balises à allumer à deux, porte du sommet) ---------------- */
K.zone(11, 'L\'Arche');
cp(394.2, 65.6, -2, { name: 'La Corniche' });
block(399.4, 55, 74.6, -2.6, 3, 5, { mat: 'rock', climb: 1, climbFaces: [1] });
bridge(401.9, 413.9, 74.6, -2.6, { d: 1.8, mat: 'snowbridge' });
block(429.5, 60, 75.2, -2.6, 31, 6, { mat: 'stone' });
cp(417.5, 75.2, -2.6, { name: 'Le Sommet' });
hint(421, 75.2, -2.6, 'Trois balises, quelques secondes chacune : allumez-les ENSEMBLE pour ouvrir l\'arche');
for (const [i, x] of [[1, 421.5], [2, 427.5], [3, 433.5]]) plat(x, 76.3, -2.6, 0.5, 0.5, { h: 0.2, ghost: 1, noMesh: 1, deco: 'beacon', lever: { id: 'B' + i }, ext: 'summit', sm: { k: 'beacon', pulse: 2.2 } });
block(438.4, 75.2, 80.6, -2.6, 0.9, 6.4, { mat: 'stone', nograb: 1, noMesh: 1, deco: 'arch', ext: 'summit', sm: { k: 'arch', open: ['B1', 'B2', 'B3'], lift: 5.6, rise: 4 } });
cp(442, 75.2, -2.6, { name: 'Le Toit du monde', finish: true, r: 3.2 });


// falaise derrière tout le parcours + le vide remonte avec l'ascension (au lieu d'une chute de 90 m)
export default K.done({ abyss: -20, sm: { floors: [
  { x0: 30, x1: 125, y: 2 }, { x0: 125, x1: 186, y: 16 }, { x0: 186, x1: 250, y: 28 }, { x0: 250, x1: 330, y: 38 }, { x0: 330, x1: 460, y: 48 } ] } });
