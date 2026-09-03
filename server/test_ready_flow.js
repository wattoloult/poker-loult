// Vérifie le flux "prêt" : la partie NE démarre PAS tant que tous les humains assis ne sont pas prêts
// (2 mini), démarre dès que le dernier se déclare prêt, et le départ d'un joueur non-prêt peut suffire
// à compléter la condition pour ceux qui restent. Pas de framework : assert.
'use strict';
const assert = require('assert');
const room = require('./room.js');

const fakeScheduler = { setTimeout: () => 0, clearTimeout: () => { }, now: () => Date.now() };

// --- démarrage normal : 2 humains, ready un par un ---
let r = room.createRoom({ seats: 4 }, fakeScheduler);
room.seatHuman(r, 'tokA', 'Alice');
room.seatHuman(r, 'tokB', 'Bob');
assert.strictEqual(room.isActive(r), false, 'pas encore démarré (personne prêt)');

room.setReady(r, 'tokA', true);
assert.strictEqual(room.isActive(r), false, 'un seul des deux prêt -> toujours en attente');

room.setReady(r, 'tokB', true);
assert.strictEqual(room.isActive(r), true, 'les deux prêts -> démarrage automatique');
assert.strictEqual(r.table.phase, 'playing');

// --- un seul joueur ne suffit jamais, même prêt ---
let r2 = room.createRoom({ seats: 4 }, fakeScheduler);
room.seatHuman(r2, 'tokA', 'Alice');
room.setReady(r2, 'tokA', true);
assert.strictEqual(room.isActive(r2), false, '1 seul humain prêt -> jamais de démarrage (2 mini)');

// --- le départ d'un joueur non-prêt peut compléter la condition pour ceux qui restent ---
let r3 = room.createRoom({ seats: 4 }, fakeScheduler);
room.seatHuman(r3, 'tokA', 'Alice');
room.seatHuman(r3, 'tokB', 'Bob');
room.seatHuman(r3, 'tokC', 'Carol');
room.setReady(r3, 'tokA', true);
room.setReady(r3, 'tokB', true); // Carol pas prête -> bloqué encore
assert.strictEqual(room.isActive(r3), false, "Carol n'est pas prête -> pas de démarrage");
room.removePlayer(r3, 'tokC'); // Carol quitte -> il ne reste qu'Alice+Bob, tous deux prêts
assert.strictEqual(room.isActive(r3), true, 'le départ du 3e joueur (non prêt) complète la condition pour les 2 restants');

// --- un joueur non prêt qui rejoint casse la condition tant qu'il n'a pas readé lui aussi ---
let r4 = room.createRoom({ seats: 4 }, fakeScheduler);
room.seatHuman(r4, 'tokA', 'Alice');
room.seatHuman(r4, 'tokB', 'Bob');
room.setReady(r4, 'tokA', true);
room.setReady(r4, 'tokB', true);
assert.strictEqual(room.isActive(r4), true, 'démarré à 2/2 prêts');

// --- restart après tournoi : le prêt-check remet la machine en route sans hôte ---
let r5 = room.createRoom({ seats: 2 }, fakeScheduler);
room.seatHuman(r5, 'tokA', 'Alice');
room.seatHuman(r5, 'tokB', 'Bob');
room.setReady(r5, 'tokA', true);
room.setReady(r5, 'tokB', true);
assert.strictEqual(room.isActive(r5), true);
r5.table.phase = 'tournamentOver'; // simule une fin de tournoi (sans jouer toute une partie)
assert.strictEqual(room.isActive(r5), false, 'tournamentOver -> plus actif, redevient joignable/prêt-able');
room.setReady(r5, 'tokA', true); // le ready() précédent a été remis à zéro par start() -> il faut re-cliquer
room.setReady(r5, 'tokB', true);
assert.strictEqual(room.isActive(r5), true, 'les 2 re-prêts après tournoi -> relance automatique, pas besoin d\'hôte');

console.log('test_ready_flow.js : OK — auto-lancement au "tout le monde prêt", départ/rejoint gèrent bien la condition, relance après tournoi sans hôte');
