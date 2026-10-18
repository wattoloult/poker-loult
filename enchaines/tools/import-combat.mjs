// OUTIL (hors jeu) : extrait les clips de combat de la Universal Animation Library 1 (Quaternius, CC0, opengameart.org) -> assets/chars/combat1.glb
//   node tools/import-combat.mjs "<…>/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb"
// Même squelette et même format que assets/chars/anims1.glb (os DEF-…, retouchés par fixClip(c, true) dans scene.js).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const KEEP = ['Punch_Jab', 'Punch_Cross', 'Punch_Enter', 'Hit_Head'];
const SRC = process.argv[2]; if (!SRC) throw new Error('usage : node tools/import-combat.mjs <AnimationLibrary_Godot_Standard.glb>');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'chars', 'combat1.glb');
const b = fs.readFileSync(SRC), jl = b.readUInt32LE(12), j = JSON.parse(b.slice(20, 20 + jl).toString()), bin = b.slice(20 + jl + 8, 20 + jl + 8 + b.readUInt32LE(20 + jl));
j.animations = j.animations.filter((a) => KEEP.includes(a.name));
for (const n of j.nodes) { delete n.mesh; delete n.skin; }
const js = Buffer.from(JSON.stringify(j)), jp = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]), bp = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jp.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); const bh = Buffer.alloc(8); bh.writeUInt32LE(bp.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const tmp = path.join(os.tmpdir(), 'combat1-full.glb'); fs.writeFileSync(tmp, Buffer.concat([head, jh, jp, bh, bp]));
execSync(`npx --yes @gltf-transform/cli@4 prune "${tmp}" "${OUT}" --keep-leaves true`, { stdio: ['ignore', 'ignore', 'inherit'] }); // retire les données des autres clips
console.log('combat1.glb', j.animations.map((a) => a.name).join(' '), Math.round(fs.statSync(OUT).size / 1024) + ' Ko');
