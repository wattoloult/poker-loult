// OUTIL (hors jeu) : un fichier de décor par monde (assets/props/<monde>.glb) à partir des modèles CC0 téléchargés depuis poly.pizza
// (dossier contenant les .glb nommés « Titre__id.glb » + _index.txt « fichier|titre|auteur|page|requête »).
//   node tools/import-world-assets.mjs <dossier>
// Écrit aussi assets/props/manifest.json (clés des scènes, dans l'ordre) et la section correspondante des crédits (assets/props/credits.json).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), SRC = process.argv[2];
if (!SRC) throw new Error('usage : node tools/import-world-assets.mjs <dossier>');
const gt = (a) => execSync(`npx --yes @gltf-transform/cli@4 ${a}`, { stdio: ['ignore', 'ignore', 'inherit'] });
const q = (p) => `"${p}"`, TMP = path.join(SRC, '_tmp'); fs.mkdirSync(TMP, { recursive: true });
const index = fs.readFileSync(path.join(SRC, '_index.txt'), 'utf8').trim().split('\n').map((l) => { const [file, title, who, page, query] = l.split('|'); return { file, title, who, page, query, id: file.split('__')[1].replace('.glb', '') }; });
// clé -> identifiant poly.pizza ; une clé par modèle utilisé, regroupés par monde
const PICK = {
  jungle: { palm: 'Palm_Tree', palms: 'Palm_Trees', leaf: 'Big_Leaf_Plant', vines: 'Vines', pothosL: 'Pothos_Vine_Large_A', pothosM: 'Pothos_Vine_Medium_A', fern: 'Fern', torch: 'Wooden_Torch', rockA: 'Rock_Large#0', rockB: 'Rock_Large#1', rockC: 'Rock_Large#2', tree: 'Twisted_Tree#0' },
  japan: { torii: 'Torii_Gate', shoji: 'Shoji_Interior', door: 'Japanese_Door', bamboo: 'Bamboo', bambooM: 'Bamboo_Mid', mapleA: 'Twisted_Tree#1', mapleB: 'Twisted_Tree#2', mapleC: 'Twisted_Tree#3', maples: 'Maple_Trees', autumn: 'Autumn_Tree', lantern: 'Lantern', postLantern: 'Post_Lantern', hangLantern: 'Hanging_Lantern', archBridge: 'Small_Bridge', tower: 'Wodden_Temple' },
  deep: { crystalA: 'Crystal#0', crystalB: 'Crystal#1', crystalC: 'Crystal#2', crystalD: 'Crystal#3', crystalE: 'Crystal#6', crystalF: 'Crystal#10', crystalG: 'Crystal#14', bigCrystal: 'Big_Crystal', minecart: 'minecart', cart: 'Cart', rail: 'Rail_Straight', railCorner: 'Rail_Corner', support: 'Support', torch: 'Torch', rocks: 'Rocks#0', rockL: 'Rock_Large#0' },
  sky: { column: 'Column', columnRound: 'Column_Round', archRound: 'Arch_Round', archA: 'Arch#0', archB: 'Arch#1', pedestal: 'Pedestal', island: 'Floating_Island', fortress: 'Fortress', swing: 'Bridge', tower: 'Stone_Tower' },
  mech: { gear: 'Collectible_Gear', mill: 'Mill', pipesA: 'Pipes#0', pipesB: 'Pipes#1', pipesC: 'Pipes#2', panel: 'Pipes_Panel', connector: 'Connector', tank: 'Tank', cable: 'Cable', support: 'Support' },
  ice: { rockSnow: 'Rock_Snow', pine: 'Pine_Tree_with_Snow', bush: 'Bush_Snow', deadTree: 'Dead_Tree_with_Snow', birch: 'Birch_Tree_with_Snow', iceBlock: 'Ice_Block', crystal: 'Crystal#4', crystalB: 'Crystal#5' },
};
const byTitle = {}; for (const e of index) (byTitle[e.title] ||= []).push(e);
const manifest = {}, credits = [];
for (const [world, keys] of Object.entries(PICK)) {
  const files = [], names = [];
  for (const [key, ref] of Object.entries(keys)) {
    const [title, n] = ref.split('#'), e = byTitle[title]?.[+(n || 0)];
    if (!e) { console.warn('absent', world, key, ref); continue; }
    files.push(path.join(SRC, e.file)); names.push(key);
    if (!credits.some((c) => c.page === e.page)) credits.push({ title: e.title.replace(/_/g, ' '), who: e.who, page: e.page, worlds: [world] }); else credits.find((c) => c.page === e.page).worlds.push(world);
  }
  const a = path.join(TMP, world + '_a.glb'), b = path.join(TMP, world + '_b.glb'), c = path.join(TMP, world + '_c.glb'), dst = path.join(ROOT, 'assets', 'props', world + '.glb');
  gt(`merge ${files.map(q).join(' ')} ${q(a)}`); gt(`dedup ${q(a)} ${q(b)}`); gt(`resize ${q(b)} ${q(c)} --width 512 --height 512`);
  const d = path.join(TMP, world + '_d.glb'); gt(`webp ${q(c)} ${q(d)} --quality 82`); gt(`quantize ${q(d)} ${q(dst)}`);
  manifest[world] = names;
  console.log(world, names.length, 'modèles', (fs.statSync(dst).size / 1e6).toFixed(2), 'Mo');
}
fs.writeFileSync(path.join(ROOT, 'assets', 'props', 'manifest.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(ROOT, 'assets', 'props', 'credits.json'), JSON.stringify(credits, null, 1));
fs.rmSync(TMP, { recursive: true, force: true });
