// Registre des modules de physique par monde (core/biomes/<monde>.js) : chacun ajoute ses mécanismes sans toucher au moteur commun.
import jungle from './jungle.js';
import japan from './japan.js';
import deep from './deep.js';
import sky from './sky.js';
import mech from './mech.js';
import ice from './ice.js';
import summit from './summit.js';
export const BIOMES = [jungle, japan, deep, sky, mech, ice, summit];
export const EXT = Object.fromEntries(BIOMES.map((m) => [m.id, m]));
