// LES ENCHAÎNÉS — monde « Royaume médiéval », parcours 1 : « La Tour de Loult ». Ascension d'une falaise couverte de ruines,
// 8 zones (~92 m) : apprentissage, précision, vide, escalade, mécanismes, chaîne, épreuve, sommet. Premier parcours du jeu.
import { course } from '../kit.js';

const K = course({ id: 'tour', world: 'medieval', name: 'La Tour de Loult', short: 'Ascension de la falaise en ruine', diff: 1, published: true,
  medals: { gold: 360, silver: 600, bronze: 900 }, backdrop: 'gorge' });
const { plat, block, cp, hint } = K, zone = K.zone;

/* ------------------------- zone 1 — Le Pied de la tour (apprentissage) ------------------------- */
zone(1, "Le Pied de la tour");
block(0, -6, 0, 2.5, 16, 11, { mat: 'stone', name: 'départ' });
cp(0, 0, 3, { name: 'Le Pied de la tour', yaw: Math.PI });
hint(4, 0, 3, 'Saute de pierre en pierre : maintiens Espace pour sauter plus haut');
plat(11.5, 0.9, 1, 4, 5, { mat: 'wood' });
plat(17, 1.9, 1, 4, 4, { mat: 'wood' });
plat(17, 2.9, -4.2, 5, 3.4, { mat: 'wood' });
block(11, -2, 5.8, -4.8, 4, 4, { mat: 'stone' });
hint(16, 3, -4, 'Saute vers le rebord en poussant vers lui : tu t\'y accroches. Espace = se hisser, côtés = longer le bord');
plat(5, 6.6, -4.5, 5, 4, { mat: 'wood' });
plat(-2, 6.6, -4.5, 4, 4, { mat: 'stone', h: 1.2 });
hint(-2, 6.6, -4.5, 'Si ton partenaire tombe, maintiens Maj : tu t\'arc-boutes et tu le retiens ; puis V pour le remonter (recule d\'abord du bord)');
plat(-8, 7.4, -4.5, 4, 4, { mat: 'stone', h: 1.2 });
plat(-12, 8.4, 0.5, 4, 4, { mat: 'wood' });
/* ------------------------- zone 2 — Les Piquets (précision) ------------------------- */
zone(2, "Les Piquets");
block(-10, 3, 9.6, 6, 10, 6, { mat: 'brick' });
cp(-10, 9.6, 6, { name: 'Les Piquets' });
plat(-3.6, 10.2, 6, 2.8, 2.8, { mat: 'wood', h: 4, post: 1 });
plat(0.6, 10.8, 5.2, 2.8, 2.8, { mat: 'wood', h: 4, post: 1 });
plat(4.6, 11.4, 3.8, 2.6, 2.6, { mat: 'wood', h: 4, post: 1 });
plat(8.4, 12.0, 2, 2.6, 2.6, { mat: 'wood', h: 4, post: 1 });
plat(11.6, 12.0, -1.6, 1.8, 6, { mat: 'wood', h: 0.4, beam: 1 });
plat(9, 13.2, -5, 3, 2.5, { mat: 'stone' });
plat(4.6, 14.0, -5, 3, 3, { mat: 'stone' });
plat(0.6, 14.8, -4.6, 3, 3, { mat: 'stone' });
plat(-3.4, 15.6, -5, 3, 3, { mat: 'stone' });
plat(-8, 16.4, -4.2, 3, 3, { mat: 'wood' });
plat(-9.5, 17.3, 0.5, 3, 3, { mat: 'wood' });
/* ------------------------- zone 3 — Le Vide (hauteur) ------------------------- */
zone(3, "Le Vide");
block(-4, 13, 18.4, 5, 8, 5, { mat: 'brick' });
cp(-4, 18.4, 5, { name: 'Le Vide' });
plat(4.5, 18.4, 5, 3, 3, { mat: 'stone' });
plat(10, 18.9, 5, 3.4, 2.4, { mat: 'wood', h: 0.5, move: { k: 'pend', axis: 'x', len: 6, amp: 0.28, T: 3.8 }, hang: 6 });
hint(5, 18.4, 5, 'Les poutres suspendues se balancent : saute quand elle vient vers toi');
plat(16.5, 19.4, 5, 3, 3, { mat: 'stone' });
plat(16.5, 20.4, -0.5, 1.6, 4, { mat: 'wood', h: 0.45, beam: 1 });
plat(16.5, 21.2, -5.5, 3, 3, { mat: 'stone' });
plat(11, 21.2, -5.5, 3, 3, { mat: 'stone' });
plat(4.4, 21.6, -5.2, 3, 3, { mat: 'stone' });
plat(-2.2, 22.4, -5.2, 3.4, 2.4, { mat: 'wood', h: 0.5, move: { k: 'pend', axis: 'x', len: 7, amp: 0.3, T: 4.0, ph: 1.4 }, hang: 7 });
plat(-8.5, 22.6, -5, 3, 3, { mat: 'stone' });
block(-13, 15, 25.8, -5, 4, 4, { mat: 'stone' });
plat(-12, 26.6, 2, 7, 6, { mat: 'brick', h: 1.4 });
/* ------------------------- zone 4 — La Paroi (escalade) ------------------------- */
zone(4, "La Paroi");
cp(-12, 26.6, 2, { name: 'La Paroi' });
block(-4, 22, 34.6, 0, 4, 4, { mat: 'rock', climb: 1, climbFaces: [1] });
hint(-8.5, 26.6, 1, 'Les parois couvertes de prises s\'escaladent : saute dessus et pousse vers elles. Attention à l\'endurance');
plat(2.6, 37.4, -1, 3, 3, { mat: 'stone', h: 1.4 });
block(9, 31, 45, -6, 6, 2, { mat: 'rock', climb: 1, climbFaces: [2] });
plat(9, 45.6, -1.5, 6, 4, { mat: 'brick', h: 1.2 });
/* ------------------------- zone 5 — Les Rouages (mobilité) ------------------------- */
zone(5, "Les Rouages");
cp(9, 45.6, -1.5, { name: 'Les Rouages' });
plat(17, 45.6, -1.5, 3, 3, { mat: 'metal', move: { k: 'lin', ax: 3, T: 4.2 } });
plat(24.5, 46.4, -1.5, 3, 3, { mat: 'stone' });
plat(24.5, 50.4, 3.5, 3, 3, { mat: 'metal', move: { k: 'lin', ay: 3, T: 7, pause: 0.6, ph: -Math.PI / 2 }, lift: 1 });
hint(24.5, 46.4, -1, 'L\'ascenseur monte et descend : montez ensemble');
plat(19, 54.0, 3.5, 3, 3, { mat: 'stone' });
plat(12, 54.0, 3.5, 4.4, 4.4, { mat: 'metal', move: { k: 'rot', w: 0.45 } });
// barre balayeuse : 3,2 m (la plateforme en fait 4,4 : les bords restent sûrs), passe toutes les ~3 s, à hauteur de tibia (on peut la sauter)
plat(12, 54.75, 3.5, 3.2, 0.4, { mat: 'metal', h: 0.4, move: { k: 'rot', w: -0.6 }, hit: 1, nograb: 1 });
hint(19, 54, 3.5, 'Plateau tournant : la barre passe toutes les 3 secondes. Restez sur le bord, ou sautez-la');
plat(6.5, 54.6, 3.5, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
plat(2, 55.2, 3.5, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
plat(-2.5, 55.8, 3.5, 2.5, 2.5, { mat: 'wood', crumble: { t: 0.75, back: 4.5 } });
hint(6.5, 54.6, 3.5, 'Planches pourries : elles cèdent peu après qu\'on s\'y pose');
/* ------------------------- zone 6 — La Chaîne (balancements et sauvetages) ------------------------- */
zone(6, "La Chaîne");
block(-8, 50, 56.6, 3, 6, 5, { mat: 'brick' });
cp(-8, 56.6, 3, { name: 'La Chaîne' });
hint(-10, 56.6, 3, 'Saut risqué : l\'un s\'arc-boute (Maj), l\'autre saute vers le rebord ; s\'il le rate, il se balance jusqu\'à la paroi et grimpe');
block(-17.8, 44, 54, 3, 4, 5, { mat: 'rock', climb: 1, climbFaces: [0], coop: 1 });
block(-18.4, 54, 56.6, 3, 3.2, 5, { mat: 'stone' });
for (let i = 0; i < 7; i++) plat(-22.6 - i * 1.75, 56.6, 3, 1.4, 2.6, { mat: 'wood', h: 0.35, sink: { d: 0.45, k: 38, max: 1.5 }, plank: 1 });
plat(-37.5, 57.4, 3, 5, 5, { mat: 'stone', h: 1.4 });
hint(-37.5, 57.4, 3, "Courte échelle : l'un tient G au bord (mains jointes), l'autre saute dedans pour attraper le rebord"); // (ou monter sur sa tête)
block(-37.5, 52, 62.6, -3.5, 5, 5, { mat: 'stone', coop: 1 });
/* ------------------------- zone 7 — L'Épreuve (difficulté avancée) ------------------------- */
zone(7, "L'Épreuve");
cp(-37.5, 62.6, -3.5, { name: 'L\'Épreuve' });
plat(-29, 62.6, -3.5, 2.5, 2.5, { mat: 'metal', move: { k: 'lin', ax: 3.5, T: 5 } });
block(-21, 60, 72, -3.5, 2, 2, { mat: 'rock', climb: 1 });
plat(-15, 72.6, -3.5, 4.4, 4.4, { mat: 'metal', move: { k: 'rot', w: 0.6 } });
plat(-15, 73.35, -3.5, 3.4, 0.4, { mat: 'metal', h: 0.4, move: { k: 'rot', w: -0.8, ph: 1 }, hit: 1, nograb: 1 }); // version plus vive, même principe
plat(-9.5, 73.4, -2, 1.6, 1.6, { mat: 'wood', h: 4, post: 1 });
plat(-5.5, 74.2, -4.5, 1.2, 1.2, { mat: 'wood', h: 4, post: 1 });
plat(-1.5, 75.0, -2, 1.2, 1.2, { mat: 'wood', h: 4, post: 1 });
plat(3, 75.6, -2, 4, 0.8, { mat: 'wood', h: 0.4, crumble: { t: 0.6, back: 4 }, beam: 1 });
plat(10.25, 76.4, -2, 7.5, 5, { mat: 'brick', h: 1.4 });
/* ------------------------- zone 8 — Le Sommet ------------------------- */
zone(8, "Le Sommet");
cp(11.5, 76.4, -2, { name: 'Le Sommet' });
block(17, 70, 79.2, -3, 3, 3, { mat: 'stone' });
block(22, 72, 82.0, -1, 3, 3, { mat: 'stone' });
plat(22, 82.0, 5, 1.2, 9, { mat: 'wood', h: 0.5, beam: 1 });
plat(22, 82.95, 5, 1.3, 1.1, { mat: 'metal', h: 1.1, move: { k: 'pend', axis: 'x', len: 5, amp: 0.9, T: 2.6 }, hit: 1, nograb: 1, hammer: 5 });
hint(22, 82, 1, 'Le marteau balaie la passerelle : passez entre deux coups');
block(22, 78, 90, 11.5, 4, 2, { mat: 'rock', climb: 1, climbFaces: [3] });
block(14, 84, 91.2, 9, 8, 8, { mat: 'brick', summit: 1 });
cp(14, 91.2, 9, { name: 'Le Sommet', finish: true, r: 4 });

/* ------------------------- décor composé (sans collision) ------------------------- */
// LA TOUR : elle monte derrière toute l'ascension, à moitié prise dans la falaise ; on la longe d'étage en étage jusqu'à son toit
K.deco('tower', 4, -12, -9.8, { size: 6.2, y1: 92 });
K.deco('tower', -30, 30, -10.5, { size: 4.2, y1: 70 }); // tourelle voisine, plus basse : la silhouette du château
// 1. le pied : une porte en ruine et des murs écroulés, l'entrée du château (zone calme, quelques lanternes)
K.deco('arch', -5.2, 0, -4.6, { h: 5.4 }); K.deco('ruin', 5.5, 0, -4.9, { w: 4.4, h: 3.2 }); K.deco('lantern', 1.2, 2.6, -6.5, { light: 1 });
K.deco('banner', -7.4, 0, -4.8, { h: 3.4 }); K.deco('banner', 9.2, 2.2, -6.4, { h: 2.6, style: 2 });
// 2. les piquets : un échafaudage abandonné, des chaînes tendues entre la tour et les poteaux
K.deco('scaffold', -6.4, 3, 9.4, { h: 6.4 }); K.deco('chain', 1, 19, -6.8, { to: [8.4, 13.8, 2], sag: 1.6 });
// 3. le vide : de grosses chaînes traversent le gouffre (les poutres y sont suspendues)
K.deco('chain', 7, 27.5, -6.8, { to: [17.5, 25, -6.2], sag: 2.2 }); K.deco('chain', -8, 28, -6.8, { to: [1, 30, -6.8], sag: 1.4 });
// 4. la paroi : un treuil abandonné sur la falaise, une lanterne pour repérer le haut de la paroi
K.deco('wheel', -1.5, 41, -6.6, { r: 2.2, spin: 0.08 }); K.deco('lantern', 2.6, 39.6, -2.6);
// 5. les rouages : les roues qui entraînent le plateau tournant tournent avec lui
K.deco('wheel', 12, 59.5, -6.6, { r: 2.8, spin: -0.45 }); K.deco('wheel', 17.4, 57.2, -6.6, { r: 1.6, spin: 0.8 }); K.deco('wheel', 24.5, 56, -6.4, { r: 1.2, spin: -1.1 });
// 6. la chaîne : la grande chaîne du château pend au-dessus du passage risqué, bannières sur le mur
K.deco('chain', -14, 66, -6.6, { to: [-36, 68, -6.6], sag: 3.4 }); K.deco('banner', -8.4, 56.6, 0.4, { h: 3, style: 2 }); K.deco('banner', -37.5, 57.4, 0.4, { h: 3 });
// 7. l'épreuve : ruines sur la crête, un fanion qui indique le chemin
K.deco('ruin', -37.5, 62.6, -5.8, { w: 4, h: 2.4 }); K.deco('flag', 10.25, 76.4, -4.2, { h: 4.5 });
// 8. le sommet : les couleurs de Loult flottent au sommet de la tour
K.deco('flag', 10.6, 91.2, 6, { h: 5.5 }); K.deco('flag', 17.4, 91.2, 12, { h: 5.5, color: 0xd8a020 }); K.deco('banner', 14, 91.2, 5.2, { h: 3.4, style: 2 });
K.deco('lantern', 22, 84, -0.6, { light: 1 });

// falaise derrière tout le parcours (collision plate ; le relief est dessiné par le client, toujours derrière z = -7)
block(0, -50, 110, -14, 100, 14, { mat: 'cliff', zone: 0, cliff: 1, nograb: 1 });

export default K.done({ abyss: -30 });
