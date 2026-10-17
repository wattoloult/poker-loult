// LES ENCHAÎNÉS — monde « Profondeurs », parcours : « La Mine engloutie ». Dix zones, de l'entrée du puits à la sortie par le haut.
// On descend par des échafaudages (des étais qui ne portent qu'un seul grimpeur), on traverse en wagonnet (le levier lance l'impulsion), on court
// devant un éboulement qui effondre le sol derrière lui, on passe les cristaux, une galerie plongée dans le noir (la lampe à manivelle), la cage
// d'un treuil, la herse à deux plaques, puis on remonte le grand puits : échelles, étais, liane, contrepoids.
// Mécanismes propres aux mines : voir core/biomes/deep.js (leviers à impulsion, étais, éboulement poursuivant) ; le reste est dans le moteur commun.
import { course } from '../kit.js';

const K = course({ id: 'mine', world: 'deep', name: 'La Mine engloutie', short: 'Wagonnets, éboulement, treuil et herse à deux', diff: 3, published: true,
  medals: { gold: 540, silver: 780, bronze: 1100 }, backdrop: 'cave' });
const { plat, block, cp, hint, rope, cam, bridge } = K;
// étai : planche qui ne porte que `max` grimpeurs (le suivant la fait gémir puis céder) ; dark = visible seulement quand la lampe est allumée
const etai = (x, top, z, w, d, o = {}) => plat(x, top, z, w, d, { mat: 'plank', h: 0.4, ext: 'deep', deep: { k: 'prop', max: 1, ...o.deep }, nograb: 0, ...o.rest });
// wagonnet : va-et-vient sur rails (position de départ x - ax, dessus à `top` au départ), lancé par le levier `id` (impulsion = un cycle complet)
const wagon = (cx, top, z, ax, ay, id, T, ph = 0) => plat(cx, top, z, 2.8, 2.2, { mat: 'cart', h: 0.5, cart: 1, deep: { cart: 1 }, move: { k: 'lin', ax, ay, T, pause: 0.6, ph: -Math.PI / 2 + ph, gate: id } });
const levier = (x, top, z, id, pulse, o = {}) => plat(x, top, z, 0.4, 0.4, { lever: { id }, ghost: 1, deep: { pulse, ...o } });

/* ---------------- 1. L'Entrée ---------------- */
K.zone(1, 'L\'Entrée');
block(0, -8, 0, 0, 10, 8, { mat: 'rock' });
cp(0, 0, 0, { name: 'L\'Entrée de la mine', yaw: Math.PI });
hint(3, 0, 0, 'On descend par les échafaudages : un étai ne porte qu\'UN grimpeur à la fois, s\'il gémit, l\'autre doit déjà avoir sauté');
plat(8, -1.5, 0, 3, 3, { mat: 'plank', scaffold: 1 });
etai(12.2, -3, 1, 3.4, 3);
plat(16.4, -4.5, -0.5, 3, 3, { mat: 'plank', scaffold: 1 });
etai(20.6, -6, 0, 3.4, 3);
bridge(22.6, 33.4, -6, 0, { d: 2 });
plat(36, -6, 0, 5, 5, { mat: 'rock', h: 2 });

/* ---------------- 2. Les Rails ---------------- */
K.zone(2, 'Les Rails');
cp(36, -6, 0, { name: 'Les Rails' });
hint(37.5, -6, 0, 'Levier (F) : le wagonnet fait un aller-retour, montez dedans avant qu\'il parte et descendez au quai d\'en face');
plat(40.2, -6, 0, 3, 3, { mat: 'rock', h: 2 });
levier(39.6, -5, 1.3, 'c1', 16);
wagon(51, -6, 0, 7, 0, 'c1', 16);
plat(63, -6, 0, 5, 3.6, { mat: 'rock', h: 2 });
etai(68.6, -5.6, 0.3, 3.2, 3);
plat(73.1, -5.2, 0, 3, 3, { mat: 'plank', scaffold: 1 });
hint(72, -5.2, 0, 'Le wagonnet de la descente : levier, puis on se laisse porter jusqu\'en bas');
plat(76.5, -5.2, 0, 3, 3, { mat: 'rock', h: 2 });
levier(75.8, -4.2, 1.3, 'c2', 18);
wagon(85.5, -8.2, 0, 6, -3, 'c2', 18);
plat(95.5, -11.2, 0, 4.4, 3, { mat: 'rock', h: 2 });
hint(98, -11.2, 0, 'Galerie instable : des pierres tombent du plafond, passez entre deux chutes');
plat(103.5, -11.2, 0, 12, 3, { mat: 'rock', h: 2 });
for (const [x, ph] of [[100.4, 0], [104.4, 0.33], [108.2, 0.66]]) plat(x, -4.2, 0, 1.4, 1.4, { mat: 'rock', h: 1.4, hit: 1, nograb: 1, move: { k: 'drop', fall: 7, T: 3, wait: 1.7, ph } });
plat(111.6, -11.2, 0, 4, 3, { mat: 'rock', h: 2 });

/* ---------------- 3. L'Éboulement ---------------- */
K.zone(3, 'L\'Éboulement');
cp(111.6, -11.2, 0, { name: 'L\'Éboulement' });
hint(113, -11.2, 0, 'Dès que vous entrez dans la galerie, la voûte cède : courez ! Le sol s\'effondre derrière le mur de gravats');
const cave = (x, top, w) => plat(x, top, 0, w, 3, { mat: 'rock', h: 1.2, ext: 'deep', deep: { k: 'cave', of: 'ebl' } });
// mur de gravats : avance de x0 à x1, projette qui le touche
block(100, -16, -2, 0, 4, 7, { mat: 'rock', hit: 1, nograb: 1, ext: 'deep', deep: { k: 'chase', id: 'ebl', x0: 100, x1: 163, v: 4.2, trig: [114, 123] } });
cave(117, -11, 4); cave(122.8, -10.6, 3.6); cave(128.2, -10.1, 3); cave(133.4, -9.4, 3.2); cave(139.2, -8.6, 4.4);
cave(145.2, -8.6, 2.8); cave(150.4, -8, 3); cave(156, -7.4, 4); cave(162.4, -7.4, 3.4);
cam(112, -14, -8, 166, -3, 8, { mode: 'three', yaw: -0.5, pitch: 0.22 });

/* ---------------- 4. Les Cristaux ---------------- */
K.zone(4, 'Les Cristaux');
plat(170, -7.4, 0, 8, 4, { mat: 'rock', h: 2 });
cp(170, -7.4, 0, { name: 'La Salle des cristaux' });
hint(172, -7.4, 0, 'Les cristaux éclairent les prises : suivez leur lumière');
plat(175, -6.6, -1, 2.2, 2.2, { mat: 'crystal', h: 1.6 });
plat(178.8, -5.8, 1, 2.2, 2.2, { mat: 'crystal', h: 1.6 });
plat(182.6, -5, -1, 2.2, 2.2, { mat: 'crystal', h: 1.6 });
const r1 = rope(188.2, 3.9, -0.5, 7);
plat(194.8, -5, 0, 4, 4, { mat: 'rock', h: 2, via: { ropes: [r1] } });
plat(199.6, -4.4, 0, 2.6, 2.6, { mat: 'rock', h: 1, crumble: { t: 0.6, back: 4 }, rubble: 1 });
plat(203.8, -3.8, 0.5, 2.6, 2.6, { mat: 'rock', h: 1, crumble: { t: 0.6, back: 4 }, rubble: 1 });
plat(208.6, -3.2, 0, 4, 4, { mat: 'rock', h: 2 });

/* ---------------- 5. La Galerie noire ---------------- */
K.zone(5, 'La Galerie noire');
cp(208.6, -3.2, 0, { name: 'La Galerie noire' });
hint(210, -3.2, 0, 'Plus aucune lumière : la lampe à manivelle (F) éclaire la galerie 45 secondes, et les étais ne portent qu\'un seul grimpeur');
levier(210.6, -2.2, 1.3, 'lamp', 45);
const noir = { dark: 'lamp' };
plat(214.2, -3, 0, 2.2, 2.2, { mat: 'rock', h: 1.2, deep: noir });
etai(218.4, -2.8, 0, 2.4, 2.4, { deep: noir });
plat(222.8, -3.2, 0.5, 2.2, 2.2, { mat: 'rock', h: 1.2, deep: noir });
etai(227.2, -2.6, -0.5, 2.4, 2.4, { deep: noir });
plat(231.4, -2.8, 0, 2.2, 2.2, { mat: 'rock', h: 1.2, deep: noir });
plat(235.6, -2.6, 0, 4, 4, { mat: 'rock', h: 2 });

/* ---------------- 6. Le Treuil ---------------- */
K.zone(6, 'Le Treuil');
cp(235.6, -2.6, 0, { name: 'Le Treuil' });
hint(237, -2.6, 0, 'La cage du treuil : levier, montez dedans, elle remonte (10 m) puis redescend toute seule : sautez sur la corniche');
levier(234.4, -1.6, 1.3, 'lift', 14);
plat(240.4, 2.4, 0, 2.8, 3, { mat: 'metal', h: 0.5, lift: 1, deep: { cart: 1 }, move: { k: 'lin', ay: 5, T: 14, pause: 0.5, ph: -Math.PI / 2, gate: 'lift' } });
plat(245.4, 7.4, 0, 4, 4, { mat: 'rock', h: 2 });
cam(236, -5, -8, 250, 10, 8, { mode: 'three', yaw: 0.5, pitch: 0.2 });

/* ---------------- 7. La Herse ---------------- */
K.zone(7, 'La Herse');
block(254.5, -0.6, 7.4, 0, 12, 8, { mat: 'rock' });
cp(252, 7.4, 0, { name: 'La Herse' });
hint(250, 7.4, 0, 'Une plaque chacun : la herse ne se lève que si vous êtes tous les deux dessus, puis elle redescend doucement');
plat(251, 7.5, -2.6, 1.8, 1.8, { mat: 'metal', h: 0.2, plate: { id: 'p1' } });
plat(256.4, 7.5, -2.6, 1.8, 1.8, { mat: 'metal', h: 0.2, plate: { id: 'p2' } });
block(262.3, 7.4, 12.4, 0, 0.6, 8, { mat: 'metal', door: { open: ['p1', 'p2'], close: 0.22 }, nograb: 1 });
block(268, -0.6, 7.4, 0, 11, 8, { mat: 'rock', coop: 1 });

/* ---------------- 8. Les Étais ---------------- */
K.zone(8, 'Les Étais');
cp(268, 7.4, 0, { name: 'Les Étais' });
hint(270, 7.4, 0, 'Le puits remonte : échelle, étais qui ne portent qu\'un grimpeur, liane');
cam(262, 4, -8, 312, 40, 8, { mode: 'tunnel', pitch: 0.38 });
block(274.9, 5, 13, 0, 1.6, 3.2, { mat: 'rock', climb: 1, climbFaces: [1], deep: { ladder: 1 } });
etai(278.8, 13, 0, 3.2, 3);
etai(283.4, 13.8, 0.5, 3.2, 3);
plat(288, 14.6, 0, 3, 3, { mat: 'plank', scaffold: 1 });
const r2 = rope(294.5, 23.5, 0, 7.5);
plat(301.6, 14.6, 0, 6, 3.4, { mat: 'rock', h: 2, via: { ropes: [r2] } });
block(305.4, 12, 21, 0, 1.6, 3.2, { mat: 'rock', climb: 1, climbFaces: [1], deep: { ladder: 1 } });

/* ---------------- 9. Le Contrepoids ---------------- */
K.zone(9, 'Le Contrepoids');
plat(309.2, 21, 0, 4, 3.4, { mat: 'plank', scaffold: 1 });
cp(309.2, 21, 0, { name: 'Le Contrepoids' });
hint(309.4, 21, 0, 'Les bennes du treuil : l\'un se tient sur la plus lourde, l\'autre monte avec la plus légère, puis tire la chaîne pour hisser son partenaire');
plat(315, 21, 0.7, 2.6, 2.6, { mat: 'plank', cw: { id: 'benne', side: 1, d: 2.2, k: 2 } });
plat(315, 21, -1.9, 2.6, 2.6, { mat: 'plank', cw: { id: 'benne', side: -1, d: 2.2 } });
block(319, 12, 26.1, -1.9, 4, 4, { mat: 'rock', coop: 1 });

/* ---------------- 10. La Sortie ---------------- */
K.zone(10, 'La Sortie');
block(326, 12, 26.1, 0, 8, 8, { mat: 'rock', summit: 1 });
cp(326, 26.1, 0, { name: 'La Sortie', finish: true, r: 4 });

export default K.done({ abyss: -30 });
