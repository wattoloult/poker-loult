// Vérifie que le choix d'avatars (Pokémon / personnalités) fait par l'hôte à la création de la room
// est bien appliqué à la table, et que les avatars distribués sont uniques. Pas de framework : assert.
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const room = require('./room.js');

// pool Pokémon (défaut / choix explicite)
const rp = room.createRoom({ seats: 4, avatarKind: 'pokemon' });
room.seatHuman(rp, 'tok1', 'Alice');
room.seatHuman(rp, 'tok2', 'Bob');
assert.strictEqual(rp.table.avatarKind, 'pokemon');
const avatarsP = rp.table.seats.filter(Boolean).map(p => p.avatar);
assert(avatarsP.every(a => typeof a === 'number'), 'avatars Pokémon = numéros');
assert.strictEqual(new Set(avatarsP).size, avatarsP.length, 'avatars uniques à la table');

// pool personnalités (choix explicite de l'hôte)
const manifestExists = fs.existsSync(path.join(__dirname, '../avatars/people/manifest.json'));
const rh = room.createRoom({ seats: 4, avatarKind: 'people' });
room.seatHuman(rh, 'tok1', 'Alice');
room.seatHuman(rh, 'tok2', 'Bob');
if (manifestExists) {
  assert.strictEqual(rh.table.avatarKind, 'people', 'choix "people" appliqué (manifest présent)');
  const avatarsH = rh.table.seats.filter(Boolean).map(p => p.avatar);
  assert(avatarsH.every(a => typeof a === 'string'), 'avatars personnalités = slugs (string)');
  assert.strictEqual(new Set(avatarsH).size, avatarsH.length, 'avatars uniques à la table');
} else {
  console.log('(manifest people pas encore généré -> fallback Pokémon vérifié à la place)');
  assert.strictEqual(rh.table.avatarKind, 'pokemon');
}

console.log('test_avatar_pool.js : OK — choix hôte Pokémon/personnalités appliqué + avatars uniques par table');
