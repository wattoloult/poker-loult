// LES ENCHAÎNÉS — identité visuelle de chaque monde : ciel, soleil, brume, toile de fond, couleurs de roche, matériaux, particules.
// Les parcours ne parlent que de matériaux abstraits (stone, wood, moss, tile…) : c'est ici qu'ils deviennent une texture et une teinte.
// base : stone | brick | wood | darkwood | metal | plain (couleur unie) ; emissive = matériau lumineux (cristaux, braises)
const C = (base, color, o = {}) => ({ base, color, ...o });
const COMMON = {
  stone: C('stone', 0xf2e6d6), brick: C('brick', 0xf6dcc4), wood: C('wood', 0xfff1e0), rock: C('stone', 0xa9b48a), metal: C('metal', 0xe8e2d8),
  plank: C('wood', 0xd8b48c), log: C('darkwood', 0xc49a72), cliff: C('plain', 0x806050),
};
export const THEMES = {
  // fin de journée sous un ciel lourd : soleil bas et chaud qui découpe la tour, ombres longues, gorge sombre en contrebas ;
  // les lanternes et les braseros des totems font les seules taches de lumière chaude (lisibilité : dessus des plateformes éclairés de biais)
  medieval: {
    sky: [0x1b2645, 0x4c5577, 0xd0835a, 0x5a4038], sun: { dir: [-0.82, 0.34, 0.42], color: 0xffb27a, int: 2.0 }, hemi: [0x8796c0, 0x3a2a20, 0.55],
    fog: [0x6e5248, 42, 250], clouds: { y: -22, tint: 0xb08474 }, ridges: [0x434a63, 0x564852, 0x6c5148], backdrop: 'gorge', exposure: 0.98,
    rock: { lo: [0.22, 0.17, 0.15], hi: [0.44, 0.34, 0.27], moss: [0.27, 0.35, 0.17], snowY: 84, color: 0x7a6b62 }, particles: 'motes',
    mats: { ...COMMON, stone: C('stone', 0xd9cbb8), brick: C('brick', 0xdcb89e), wood: C('wood', 0xe8d0b0) }, props: 'medieval',
  },
  jungle: {
    sky: [0x3f8fc0, 0x9fd3c8, 0xfff0b0, 0xc8e0a0], sun: { dir: [0.4, 0.75, 0.5], color: 0xfff2c0, int: 2.1 }, hemi: [0xcfe9ff, 0x3e5a2a, 0.95],
    fog: [0xbfdcb0, 40, 260], clouds: { y: -26, tint: 0xe8f4e8 }, ridges: [0x6f9a78, 0x86ad7e, 0x9fbf86], backdrop: 'gorge',
    rock: { lo: [0.2, 0.19, 0.15], hi: [0.42, 0.4, 0.3], moss: [0.22, 0.4, 0.14], snowY: 999, color: 0x7f8a6a }, particles: 'leaves',
    mats: { ...COMMON, moss: C('stone', 0x9fbf7a), log: C('darkwood', 0xa98a5c), rock: C('stone', 0x9aa588), bark: C('darkwood', 0x8c7a52, { climbTint: 1 }),
      leaf: C('plain', 0x6fb24a, { rough: 0.7 }), temple: C('stone', 0xd8d0a0), wood: C('wood', 0xe8d8b0) }, props: 'jungle',
  },
  japan: {
    sky: [0x6a86c8, 0xe8b8c8, 0xffd6b0, 0xf0c8c0], sun: { dir: [-0.5, 0.45, 0.6], color: 0xffd0b0, int: 2.2 }, hemi: [0xf0d8ff, 0x6a4a50, 0.85],
    fog: [0xf1cfd2, 22, 170], clouds: { y: -20, tint: 0xffe6ea }, ridges: [0x8c7aa8, 0xa98fb4, 0xc6a6c0], backdrop: 'valley',
    rock: { lo: [0.3, 0.27, 0.3], hi: [0.55, 0.5, 0.52], moss: [0.4, 0.5, 0.3], snowY: 999, color: 0x8a7f88 }, particles: 'petals',
    mats: { ...COMMON, path: C('stone', 0xe0d6c8), tile: C('brick', 0x5a6a86, { rough: 0.6 }), lacquer: C('plain', 0xb8382e, { rough: 0.5 }), pagoda: C('darkwood', 0xa0503a),
      bamboo: C('plain', 0x9fbf5a, { rough: 0.6, bamboo: 1 }), shoji: C('wood', 0xfff4e0), stone: C('stone', 0xe8e0d8) }, props: 'japan',
  },
  deep: {
    sky: [0x0c0f18, 0x141826, 0x1a1e2c, 0x0a0c12], sun: { dir: [0.2, 0.9, 0.3], color: 0x8fa8ff, int: 0.55 }, hemi: [0x40507a, 0x1a1210, 0.55],
    fog: [0x0e1018, 18, 120], clouds: null, ridges: null, backdrop: 'cave', dark: 1,
    rock: { lo: [0.12, 0.11, 0.12], hi: [0.3, 0.27, 0.27], moss: [0.15, 0.2, 0.18], snowY: 999, color: 0x5c5458 }, particles: 'dust',
    mats: { ...COMMON, rock: C('stone', 0x8c8488), plank: C('wood', 0xc8a07a), cart: C('metal', 0xb08060), crystal: C('plain', 0x6fd8ff, { emissive: 0x2a8ac8, rough: 0.2, metal: 0.1 }),
      metal: C('metal', 0xb8b0a8) }, props: 'deep',
  },
  sky: {
    sky: [0x2f6fe0, 0x8cc6ff, 0xe8f4ff, 0xbfe0ff], sun: { dir: [0.5, 0.7, 0.4], color: 0xfff8e8, int: 2.4 }, hemi: [0xd8ecff, 0x7a8aa0, 1.0],
    fog: [0xd8ecff, 80, 420], clouds: { y: -18, tint: 0xffffff, thick: 1 }, ridges: null, backdrop: 'none',
    rock: { lo: [0.4, 0.36, 0.32], hi: [0.68, 0.62, 0.55], moss: [0.4, 0.6, 0.3], snowY: 999, color: 0xa09080 }, particles: 'wind',
    mats: { ...COMMON, grass: C('stone', 0xb8d088, { grassTop: 1 }), stone: C('stone', 0xf4f0e8) }, props: 'sky',
  },
  mech: {
    sky: [0x2a2a30, 0x4a4438, 0x8a6a40, 0x3a3028], sun: { dir: [-0.3, 0.8, 0.5], color: 0xffd090, int: 1.6 }, hemi: [0xa89878, 0x302418, 0.75],
    fog: [0x4a3a2a, 30, 180], clouds: null, ridges: null, backdrop: 'machine',
    rock: { lo: [0.2, 0.17, 0.14], hi: [0.4, 0.33, 0.26], moss: [0.3, 0.3, 0.2], snowY: 999, color: 0x6a5a4a }, particles: 'embers',
    mats: { ...COMMON, metal: C('metal', 0xc8bca8), brass: C('metal', 0xe0b060, { metal: 0.6, rough: 0.35 }), iron: C('metal', 0x7a7a80, { metal: 0.6 }),
      grate: C('metal', 0x9a8a70) }, props: 'mech',
  },
  ice: {
    sky: [0x5a7cb8, 0xbad0ee, 0xeaf2ff, 0xd0dcee], sun: { dir: [-0.6, 0.35, 0.5], color: 0xfff0e0, int: 2.0 }, hemi: [0xd8e8ff, 0x8090a8, 1.0],
    fog: [0xdce8f6, 45, 280], clouds: { y: -22, tint: 0xf4f8ff }, ridges: [0xa8b8d0, 0xc0cce0, 0xd8e0ee], backdrop: 'gorge',
    rock: { lo: [0.3, 0.32, 0.38], hi: [0.55, 0.58, 0.66], moss: [0.85, 0.88, 0.95], snowY: -40, color: 0x9aa4b4, snowy: 1 }, particles: 'snow',
    mats: { ...COMMON, snow: C('plain', 0xf2f6ff, { rough: 0.9, snow: 1 }), ice: C('plain', 0x9fd4f0, { rough: 0.12, metal: 0.05, ice: 1 }),
      frost: C('plain', 0xd4e8f6, { rough: 0.5 }), snowbridge: C('wood', 0xe8eef8), icicle: C('plain', 0xbfe6ff, { rough: 0.1, ice: 1 }), rock: C('stone', 0xb0b8c8) }, props: 'ice',
  },
  summit: {
    // haute montagne : granit gris-bleu, neige sur chaque replat, ciel profond ; client/worlds/summit.js le fait évoluer avec l'ascension
    // (matin clair -> orage plombé -> éclaircie -> or du couchant au sommet)
    sky: [0x14306e, 0x5f8ad0, 0xd8e4f4, 0xb8c8dc], sun: { dir: [-0.62, 0.42, 0.5], color: 0xfff0dc, int: 2.5 }, hemi: [0xd0e0ff, 0x4a5262, 0.85],
    fog: [0xc4d2e4, 60, 360], clouds: { y: -14, tint: 0xf4f7ff, thick: 1 }, ridges: [0x6a7894, 0x8a98b4, 0xaab6cc], backdrop: 'valley',
    rock: { lo: [0.16, 0.18, 0.22], hi: [0.42, 0.46, 0.52], moss: [0.93, 0.95, 0.99], snowY: 6, color: 0x9aa2b2, snowy: 1, mossy: 1 }, particles: 'snow',
    mats: { ...COMMON, stone: C('stone', 0xd6dbe4), rock: C('stone', 0xa8b0c0), wood: C('wood', 0xd8c8b4), snow: C('plain', 0xf2f6ff, { rough: 0.9, snow: 1 }), ice: C('plain', 0x9fd4f0, { rough: 0.12, ice: 1 }), frost: C('plain', 0xd4e8f6),
      snowbridge: C('wood', 0xe8eef8), icicle: C('plain', 0xbfe6ff, { rough: 0.1, ice: 1 }), brass: C('metal', 0xe0b060, { metal: 0.6, rough: 0.35 }) }, props: 'summit',
  },
};
export const themeOf = (world) => THEMES[world] || THEMES.medieval;
