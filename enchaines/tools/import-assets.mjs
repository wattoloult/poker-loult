// OUTIL (hors jeu) : fabrique assets/ à partir des packs CC0 de Quaternius (zips décompressés) et des clips d'animation déjà importés.
//   node tools/import-assets.mjs <dossier contenant mco/ ubc/ mv/ fp/>
//   mco = Modular Character Outfits - Fantasy, ubc = Universal Base Characters, mv = Medieval Village MegaKit, fp = Fantasy Props MegaKit
// Animations : Universal Animation Library 1 et 2 (Quaternius, CC0), reprises de galactic/assets/chars (clips seuls, sans le mannequin).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), SRC = process.argv[2];
if (!SRC) throw new Error('usage : node tools/import-assets.mjs <dossier>');
const out = (...p) => { const f = path.join(ROOT, 'assets', ...p); fs.mkdirSync(path.dirname(f), { recursive: true }); return f; };
const gt = (args) => execSync(`npx --yes @gltf-transform/cli@4 ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] });
const ff = (args) => execSync(`ffmpeg -loglevel error -y ${args}`, { stdio: ['ignore', 'ignore', 'inherit'] });
const mo = (f) => (fs.statSync(f).size / 1e6).toFixed(2) + ' Mo';
const find = (dir, name) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const r = find(p, name); if (r) return r; } else if (e.name === name) return p; } return null; };
const q = (p) => `"${p}"`;
const TMP = path.join(SRC, '_tmp'); fs.mkdirSync(TMP, { recursive: true });
// certaines textures sont référencées sous un autre nom que celui du fichier livré (suffixe « _png ») : on crée l'alias manquant
function fixUris(gltf) {
  const j = JSON.parse(fs.readFileSync(gltf, 'utf8')), dir = path.dirname(gltf);
  for (const im of j.images || []) {
    const f = path.join(dir, decodeURIComponent(im.uri)); if (fs.existsSync(f)) continue;
    const alt = [f.replace(/_png\.png$/, '.png'), f.replace(/\.png$/, '_png.png')].find((a) => fs.existsSync(a));
    if (!alt) throw new Error('texture introuvable : ' + f);
    fs.copyFileSync(alt, f);
  }
  return gltf;
}

// textures réduites puis en WebP, sommets quantifiés (lus nativement par GLTFLoader, sans décodeur)
function shrink(src, dst, size) {
  const a = path.join(TMP, 'sh_a.glb'), b = path.join(TMP, 'sh_b.glb');
  gt(`resize ${q(src)} ${q(a)} --width ${size} --height ${size}`); gt(`webp ${q(a)} ${q(b)} --quality 82`); gt(`quantize ${q(b)} ${q(dst)}`);
}
/* ------------------------------ personnages ------------------------------ */
// corps de base (on n'en garde à l'affichage que la tête : la tenue couvre le reste) + tenue de rôdeur + sourcils
const OUT_DIR = path.dirname(find(path.join(SRC, 'mco'), 'Male_Ranger.gltf'));
const BASE_DIR = path.dirname(find(path.join(SRC, 'ubc'), 'Superhero_Male_FullBody.gltf'));
const BROW_DIR = path.dirname(find(path.join(SRC, 'ubc', 'Universal Base Characters[Standard]', 'Hairstyles', 'Rigged to Head Bone'), 'Eyebrows_Regular.gltf'));
for (const [k, base, outfit, brow] of [['m', 'Superhero_Male_FullBody', 'Male_Ranger', 'Eyebrows_Regular'], ['f', 'Superhero_Female_FullBody', 'Female_Ranger', 'Eyebrows_Female']]) {
  const merged = path.join(TMP, `char_${k}.glb`), dst = out('chars', `ranger_${k}.glb`);
  gt(`merge ${q(fixUris(path.join(BASE_DIR, base + '.gltf')))} ${q(fixUris(path.join(OUT_DIR, outfit + '.gltf')))} ${q(fixUris(path.join(BROW_DIR, brow + '.gltf')))} ${q(merged)}`);
  shrink(merged, dst, 1024);
  console.log(path.basename(dst), mo(dst));
}
// clips d'animation seuls (os nommés à la façon Unreal, comme les rôdeurs)
const readGlb = (f) => { const b = fs.readFileSync(f), jl = b.readUInt32LE(12); return { j: JSON.parse(b.subarray(20, 20 + jl)), bin: b.subarray(28 + jl) }; };
function writeGlb(f, j, bin) {
  let js = Buffer.from(JSON.stringify(j)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + js.length + 8 + bin.length, 8); head.writeUInt32LE(js.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(f, Buffer.concat([head, js, bh, bin]));
}
const GAL = path.join(ROOT, '..', 'galactic', 'assets', 'chars');
for (const [src, name] of [['joueur.glb', 'anims2.glb'], ['anims.glb', 'anims1.glb']]) {
  const { j, bin } = readGlb(path.join(GAL, src));
  for (const n of j.nodes) { delete n.mesh; delete n.skin; }
  const tmp = path.join(TMP, name); writeGlb(tmp, j, bin);
  gt(`prune ${q(tmp)} ${q(out('chars', name))} --keep-leaves true`);
  console.log(name, j.animations.map((a) => a.name).join(' '), mo(out('chars', name)));
}

/* ------------------------------ décor ------------------------------ */
const FP = path.dirname(find(path.join(SRC, 'fp'), 'Lantern_Wall.gltf')), MV = path.dirname(find(path.join(SRC, 'mv'), 'Prop_Vine1.gltf'));
const PROPS = [
  ...['Lantern_Wall', 'Banner_1_Cloth', 'Banner_2_Cloth', 'Chain_Coil', 'Rope_1', 'Rope_2', 'Rope_3', 'Crate_Wooden', 'Barrel', 'Torch_Metal', 'Bucket_Wooden_1', 'Pickaxe_Bronze', 'Bag', 'Shield_Wooden', 'Vase_Rubble_Medium'].map((n) => path.join(FP, n + '.gltf')),
  ...['Prop_Vine1', 'Prop_Vine2', 'Prop_Vine4', 'Prop_Vine5', 'Prop_Vine6', 'Prop_Vine9', 'Prop_Support', 'Prop_Brick1', 'Prop_Brick2', 'Prop_Brick3', 'Prop_Brick4', 'Prop_Crate', 'Prop_MetalFence_Simple', 'Prop_WoodenFence_Single', 'Wall_Arch', 'Roof_Support2', 'Prop_Chimney'].map((n) => path.join(MV, n + '.gltf')),
];
const pm = path.join(TMP, 'props.glb'), pd = out('props', 'props.glb');
gt(`merge ${PROPS.map((p) => q(fixUris(p))).join(' ')} ${q(pm)}`);
gt(`dedup ${q(pm)} ${q(path.join(TMP, 'props2.glb'))}`);
shrink(path.join(TMP, 'props2.glb'), pd, 512);
console.log('props.glb', mo(pd));

/* ------------------------------ textures des plateformes ------------------------------ */
const TX = path.dirname(find(path.join(SRC, 'mv'), 'T_UnevenBrick_BaseColor.png')), TM = path.dirname(find(path.join(SRC, 'fp'), 'T_Trim_Metal_BaseColor.png'));
for (const [n, dir] of [['UnevenBrick', TX], ['Brick', TX], ['WoodTrim', TX], ['RockTrim', TX], ['Plaster', TX], ['Trim_Metal', TM]]) {
  ff(`-i ${q(path.join(dir, `T_${n}_BaseColor.png`))} -vf scale=1024:1024 -q:v 3 ${q(out('tex', n.toLowerCase() + '_c.jpg'))}`);
  const nf = path.join(dir, `T_${n}_Normal.png`); if (fs.existsSync(nf)) ff(`-i ${q(nf)} -vf scale=1024:1024 -q:v 2 ${q(out('tex', n.toLowerCase() + '_n.jpg'))}`);
}
ff(`-i ${q(path.join(TX, 'T_VineLeaf_png.png'))} -vf scale=512:-1 ${q(out('tex', 'vineleaf.png'))}`);
console.log('textures ok');
fs.rmSync(TMP, { recursive: true, force: true });
