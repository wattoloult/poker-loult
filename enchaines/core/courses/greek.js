// LES ENCHAÎNÉS — monde « L'Odyssée » (Grèce antique), parcours : « Le Retour d'Ulysse ». Huit étapes du voyage, du rivage d'Ithaque
// au Parthénon : la plage (apprentissage), le NAVIRE d'Ulysse qui traverse la mer (plateforme qui navigue), l'île des Cyclopes (rochers
// lâchés d'en haut, paroi), Éole (rafales sur le pont), les Sirènes (falaises étroites, passerelle qui s'enfonce, bélier), Charybde (le
// tourbillon : îlots qui tournent) et Scylla (pilons), le temple d'Athéna (colonnes à escalader, barres entre les chapiteaux, marches qui
// s'effondrent) et le Parthénon au sommet. Décor et modèles : client/worlds/greek.js.
import { course } from '../kit.js';

const K = course({ id: 'odyssee', world: 'greek', name: 'Le Retour d\'Ulysse', short: 'Navire, Cyclopes, Éole, Charybde et le Parthénon', diff: 3, published: true,
  medals: { gold: 600, silver: 900, bronze: 1300 }, backdrop: 'valley' });
const { plat, block, cp, hint, cam, wind, bars, bridge } = K;
const Z = 0;

/* ---------------- 1. Ithaque : le rivage (apprentissage, appuis larges) ---------------- */
K.zone(1, 'Ithaque');
block(0, -8, 0, Z, 14, 9, { mat: 'sand', name: 'plage' });
cp(-3, 0, Z, { name: 'Ithaque', yaw: Math.PI });
hint(2, 0, Z, 'Le rivage d\'Ithaque : sautez de rocher en rocher jusqu\'au port');
plat(10.5, 0.8, Z, 4, 4.5, { mat: 'rock' });
plat(15.8, 1.6, Z + 0.6, 4, 4, { mat: 'rock' });
plat(21, 2.4, Z - 0.4, 4.4, 4, { mat: 'marble' });
block(27.5, -8, 2.8, Z, 7, 7, { mat: 'marble', name: 'quai' });

/* ---------------- 2. La traversée : le navire d'Ulysse fait la navette jusqu'à l'île suivante ---------------- */
K.zone(2, 'La Traversée');
cp(27.5, 2.8, Z, { name: 'Le Port' });
hint(29, 2.8, Z, 'Le navire d\'Ulysse accoste puis repart : montez à bord tous les deux et attendez l\'autre rive');
// le pont du navire : il fait la navette entre le quai (x 31) et l'île (x 54), avec une pause à chaque bout ; le modèle est posé dessus
plat(42.25, 1.0, Z, 7, 3.4, { mat: 'wood', h: 0.6, ship: 1, noMesh: 1, move: { k: 'lin', ax: 7.25, T: 16, pause: 0.8, ph: -Math.PI / 2 } });
block(57, -8, 2.1, Z, 6, 7, { mat: 'rock', name: 'ile' });
cam(30, -2, -8, 60, 14, 9, { mode: 'far', dist: 6, pitch: 0.2 });

/* ---------------- 3. L'île des Cyclopes : rochers lâchés depuis la falaise, puis la paroi ---------------- */
K.zone(3, 'L\'Île des Cyclopes');
cp(57, 2.1, Z, { name: 'L\'Île des Cyclopes' });
hint(58, 3.2, Z, 'Le Cyclope lâche des rochers : écoutez le grondement, passez entre deux chutes');
block(63.5, -8, 3.2, Z, 7, 4.4, { mat: 'rock' });
K.herse(63.5, 3.2, Z, 1.8, 4.4, { look: 'stone', w: 2.2, crush: 1, fall: 'slam', lift: 4.2, open: 2, warn: 0.8, hold: 0.7, rise: 1.6 }); // rocher
block(70.5, -8, 3.2, Z, 7, 4.4, { mat: 'rock' });
K.herse(70.5, 3.2, Z, 1.8, 4.4, { look: 'stone', w: 2.2, crush: 1, fall: 'slam', lift: 4.2, open: 2, warn: 0.8, hold: 0.7, rise: 1.6, ph: 1.3 });
block(77.5, -8, 3.2, Z, 7, 5, { mat: 'rock' });
block(82, 2, 11.4, Z - 1, 2, 5, { mat: 'rock', climb: 1, climbFaces: [1] });
hint(78, 3.2, Z, 'La paroi de la caverne s\'escalade : sautez dessus et grimpez (attention à l\'endurance)');
plat(85.5, 11.4, Z - 1, 5, 5, { mat: 'rock', h: 1.2 });

/* ---------------- 4. Éole : les vents s'échappent de l'outre, rafales sur le pont ---------------- */
K.zone(4, 'Éole');
cp(85.5, 11.4, Z - 1, { name: 'Éole' });
hint(87, 11.4, Z - 1, 'Les vents d\'Éole soufflent par rafales : arc-boutez-vous (Maj) quand ça souffle, avancez entre deux');
bridge(88.6, 101.4, 11.4, Z - 1, { w: 1.3 });
wind(95, 12.4, Z - 1, 12, 3, 8, [0, 0, 34], { pulse: 3.2, ground: 1, gust: 1 });
block(104.5, 4, 12.2, Z - 1, 5, 5, { mat: 'marble' });

/* ---------------- 5. Les Sirènes : falaises étroites, passerelle qui s'enfonce, bélier ---------------- */
K.zone(5, 'Les Sirènes');
cp(104.5, 12.2, Z - 1, { name: 'Les Sirènes' });
hint(106, 12.2, Z - 1, 'Le chant des Sirènes : ne traînez pas sur les planches, elles s\'enfoncent');
plat(109.6, 13, Z - 1, 2.6, 2.6, { mat: 'rock', h: 3, post: 1 });
plat(113.4, 13.8, Z, 2.6, 2.6, { mat: 'rock', h: 3, post: 1 });
for (let i = 0; i < 5; i++) plat(117.4 + i * 1.8, 13.8, Z, 1.5, 2.6, { mat: 'wood', h: 0.35, sink: { d: 0.45, k: 36, max: 1.4 }, plank: 1 });
block(128, 6, 14.6, Z, 4, 4, { mat: 'marble' });
plat(133.6, 14.6, Z, 6, 1.4, { mat: 'wood', h: 0.5, beam: 1 });
plat(133.6, 15.55, Z, 1.2, 1.3, { mat: 'bronze', h: 1.1, move: { k: 'pend', axis: 'z', len: 5, amp: 0.85, T: 3 }, hit: 1, nograb: 1, hammer: 5 });
hint(130, 14.6, Z, 'Le bélier balaie la poutre : attendez qu\'il reparte, puis traversez');
block(139.5, 7, 15.4, Z, 5, 5, { mat: 'marble' });

/* ---------------- 6. Charybde et Scylla : le tourbillon (îlots qui tournent), puis les pilons ---------------- */
K.zone(6, 'Charybde et Scylla');
cp(139.5, 15.4, Z, { name: 'Charybde et Scylla' });
hint(141, 15.4, Z, 'Charybde : les îlots tournent autour du gouffre. Sautez quand le suivant passe près de vous');
for (let k = 0; k < 3; k++) plat(149.5, 15.6, Z, 3, 3, { mat: 'rock', h: 1.6, move: { k: 'circ', r: 3.2, T: 10, ph: (k * 2 * Math.PI) / 3 }, alt: k > 0 ? 1 : 0 });
block(159, 8, 16.4, Z, 5, 5, { mat: 'marble' });
cam(140, 10, -8, 162, 26, 8, { mode: 'far', dist: 5, pitch: 0.32 });
block(165.5, 8, 16.4, Z, 7, 4.4, { mat: 'marble' });
K.herse(165.5, 16.4, Z, 1.6, 4.4, { look: 'stone', w: 1.8, crush: 1, fall: 'slam', lift: 2.6, open: 1.4, warn: 0.55, hold: 0.6, rise: 1.2 }); // Scylla
block(172.5, 8, 16.4, Z, 7, 4.4, { mat: 'marble' });
K.herse(172.5, 16.4, Z, 1.6, 4.4, { look: 'stone', w: 1.8, crush: 1, fall: 'slam', lift: 2.6, open: 1.4, warn: 0.55, hold: 0.6, rise: 1.2, ph: 1.1 });
block(179, 8, 16.4, Z, 6, 5, { mat: 'marble' });

/* ---------------- 7. Le temple d'Athéna : colonnes, chapiteaux, marches qui s'effondrent ---------------- */
K.zone(7, 'Le Temple d\'Athéna');
cp(179, 16.4, Z, { name: 'Le Temple d\'Athéna' });
hint(180, 16.4, Z, 'Les colonnes cannelées s\'escaladent ; d\'un chapiteau, sautez de barre en barre');
block(184, 10, 23.6, Z - 1, 1.6, 1.6, { mat: 'marble', climb: 1, column: 1 });
plat(187.4, 24.2, Z - 1, 3, 3, { mat: 'marble', h: 1 });
bars(190.6, 196.6, 26.2, Z - 1, 4);
plat(199.8, 25, Z - 1, 3, 3, { mat: 'marble', h: 1 });
for (let i = 0; i < 3; i++) plat(203.6 + i * 3.6, 25.8 + i * 0.8, Z - 1, 2.6, 2.6, { mat: 'marble', crumble: { t: 0.8, back: 4.5 } });
block(217, 14, 28.2, Z - 1, 5, 5, { mat: 'marble' });
block(221.2, 18, 33.8, Z - 1, 1.6, 1.6, { mat: 'marble', climb: 1, column: 1 });

/* ---------------- 8. Le Parthénon ---------------- */
K.zone(8, 'Le Parthénon');
plat(226, 34.4, Z - 1, 7, 6, { mat: 'marble', h: 1.2 });
cp(225.5, 34.4, Z - 1, { name: 'Le Parthénon' });
plat(232.5, 35.2, Z - 1, 3, 3, { mat: 'marble' });
block(240, 20, 36, Z - 1, 9, 7, { mat: 'marble', summit: 1 });
cp(239, 36, Z - 1, { name: 'L\'Olympe', finish: true, r: 4 });

// falaise derrière tout le parcours (côte rocheuse)
block(120, -60, 60, -14, 280, 14, { mat: 'cliff', zone: 0, cliff: 1, nograb: 1 });

export default K.done({ abyss: -4 }); // tomber à la mer = retour au point de passage
