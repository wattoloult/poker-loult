// LES ENCHAÎNÉS — registre des mondes et des parcours (données partagées serveur / client).
// Ajouter un parcours = créer core/courses/<id>.js (kit.js) puis l'importer ici. `published: false` = visible seulement en playtest.
import tour from './courses/tour.js';
import remparts from './courses/remparts.js';
import canopee, * as M_jungle from './courses/jungle.js';
import torii, * as M_japan from './courses/japan.js';
import mine, * as M_deep from './courses/deep.js';
import iles, * as M_sky from './courses/sky.js';
import horloge, * as M_mech from './courses/mech.js';
import col, * as M_ice from './courses/ice.js';
import toit, * as M_summit from './courses/summit.js';
import odyssee from './courses/greek.js';

export const WORLDS = [
  { id: 'medieval', name: 'Le Royaume médiéval', blurb: 'Remparts, tours, ponts de pierre et villages suspendus', music: 'medieval' },
  { id: 'jungle', name: 'La Jungle oubliée', blurb: 'Lianes, canopée, cascades et temples envahis', music: 'jungle' },
  { id: 'japan', name: 'Les Sanctuaires', blurb: 'Toits de temples, torii, bambous et ponts sur la vallée', music: 'japan' },
  { id: 'deep', name: 'Les Profondeurs', blurb: 'Cavernes, mines abandonnées et cristaux lumineux', music: 'deep' },
  { id: 'sky', name: 'Les Ruines célestes', blurb: 'Îles flottantes, vents et ponts au-dessus des nuages', music: 'sky' },
  { id: 'mech', name: 'Les Rouages anciens', blurb: 'Engrenages, pistons, leviers et contrepoids', music: 'mech' },
  { id: 'ice', name: 'Les Passages glacés', blurb: 'Glace vive, crevasses et ponts gelés', music: 'ice' },
  { id: 'greek', name: "L'Odyssée", blurb: "Temples de marbre, mer Égée et le navire d'Ulysse", music: 'greek' },
  { id: 'summit', name: 'Le Sommet du monde', blurb: 'L\'ascension finale : tout ce que vous avez appris', music: 'summit' },
];
export const COURSES = {};
// un fichier de monde peut exporter d'autres parcours : export const more = [ ... ] (ajoutés juste après le sien)
const MORE = { canopee: M_jungle, torii: M_japan, mine: M_deep, iles: M_sky, horloge: M_mech, col: M_ice, toit: M_summit };
for (const c of [tour, remparts, canopee, torii, mine, iles, horloge, col, odyssee, toit]) { COURSES[c.id] = c; for (const x of MORE[c.id]?.more || []) COURSES[x.id] = x; }
export const courseList = (all = false) => Object.values(COURSES).filter((c) => all || c.published);
export const getCourse = (id) => COURSES[id] || tour;
// parcours suivant (ordre des mondes) : celui où mène le portail de fin
export const nextCourse = (id, all = false) => { const l = courseList(all), i = l.findIndex((c) => c.id === id); return i >= 0 ? l[i + 1] || null : null; };
export const DEFAULT_COURSE = 'tour';
