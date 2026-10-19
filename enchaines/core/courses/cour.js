// LES ENCHAÎNÉS — mode CRAZY : « La Cour du Dragon », arène en extérieur tirée du pack « Combat Fight Arena PSX » (assets/exports/combat_fight_arena_psx.glb, licence : assets/LICENSE.txt).
// Une cour pavée de 14 × 11 m entourée de neuf pavillons séparés par des ruelles de ~2,7 m, un escalier de 2 m devant le pavillon central. Le décor est le modèle du pack, tel quel ;
// ici seulement les COLLISIONS (boîtes invisibles, `noMesh`) posées d'après les boîtes englobantes réelles du modèle (mesurées sur le GLB), plus les places d'apparition.
// Repère : celui du GLB (x −20,5…20,7 ; z −29,7…5,6 ; sol y = 0). Les murs sont les pavillons (retrait de 0,45 m = le débord des toits) ; leurs toits en pente ne se montent pas (`nograb`).
import { course } from '../kit.js';

const K = course({ id: 'cour', world: 'medieval', name: 'La Cour du Dragon', short: 'Pavillons, ruelles et escalier autour d\'une cour pavée', diff: 2, published: true, crazy: true,
  medals: { gold: 1, silver: 2, bronze: 3 }, backdrop: 'gorge', abyss: -10, envGlb: 'assets/exports/combat_fight_arena_psx.glb', envBackdrop: 'assets/exports/mountains_sky_backdrop.glb' });
const { block, cp } = K;
K.zone(1, 'La Cour');
const solid = { noMesh: 1, nograb: 1 };
// sol (invisible : le dallage est dans le modèle) et enceinte
block(0, -4, 0, -12, 56, 46, solid);
for (const [x, z, w, d] of [[0, 6.4, 50, 1], [0, -30.6, 50, 1], [-21.4, -12, 1, 46], [21.4, -12, 1, 46]]) block(x, -4, 14, z, w, d, solid);
// pavillons : boîtes englobantes du GLB (min x, max x, min z, max z, hauteur du faîte), rétrécies du débord de toit
const M = 0.45;
const B = { B2: [7.0, 20.52, -3.48, 5.55, 8.15], B3: [-20.48, -7.0, -3.52, 5.55, 8.15], B4: [-20.6, -9.4, -17.6, -5.4, 4.98], B5: [9.34, 20.66, -17.7, -5.3, 7.07],
  B6: [6.3, 20.7, -29.66, -19.34, 11.07], B7: [-7.48, 7.48, -29.48, -19.38, 14.84], B8: [-10.31, -6.69, -29.35, -19.65, 6.67], B9: [-20.7, -9.3, -29.66, -19.34, 8.02] };
for (const [x0, x1, z0, z1, h] of Object.values(B)) block((x0 + x1) / 2, 0, h, (z0 + z1) / 2, x1 - x0 - 2 * M, z1 - z0 - 2 * M, solid);
// pavillon central B1 (x ±7,58 ; z −17,54…−5,35) : l'entrée en retrait (escalier, x ±2,5, jusqu'à z = −8) est laissée libre
block(-5.0, 0, 10.45, -11.4, 5.0 - M + 0.1, 12.2 - 2 * M, solid); block(5.0, 0, 10.45, -11.4, 5.0 - M + 0.1, 12.2 - 2 * M, solid);
block(0, 0, 10.45, -12.9, 5.0, 9.2, solid);
// escalier : 2 m de haut sur 2 m de profondeur. Le grimpeur n'enjambe pas de marche : on le remplace par 20 petits ressauts de 10 cm (le dessous de la capsule glisse dessus), qui se montent en marchant
for (let k = 0; k < 20; k++) block(0, 0, 0.1 * (k + 1), -6.05 - 0.1 * k, 4.66, 0.1, { noMesh: 1 });
// liseré surélevé de 12 cm qui entoure le carré central (x ±7, z −6…5) : sans collision, on marchait « dans » le dallage en le traversant (pieds enfoncés de 12 cm)
const RIM = { noMesh: 1 };
block(0, 0, 0.12, 4.5, 14, 1, RIM); block(-6.5, 0, 0.12, -0.5, 1, 9, RIM); block(6.5, 0, 0.12, -0.5, 1, 9, RIM); block(-4.665, 0, 0.12, -5.5, 4.67, 1, RIM); block(4.665, 0, 0.12, -5.5, 4.67, 1, RIM);
// places d'apparition : la cour, les ruelles, le pied de l'escalier
const spawns = [[-5, 3.5, Math.PI], [5, 3.5, Math.PI], [-5, -2.5, 0], [5, -2.5, 0], [0, -4.5, 0], [-14, -4.4, -Math.PI / 2], [14, -4.4, Math.PI / 2], [-8.4, -11, -Math.PI / 2], [8.4, -11, Math.PI / 2], [0, -18.5, Math.PI], [-14, -18.5, 0], [14, -18.5, 0]];
for (const [x, z, yaw] of spawns) cp(x, 0, z, { name: 'Cour', yaw });
export default K.done();
