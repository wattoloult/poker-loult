// LES ENCHAÎNÉS — décor varié des plateformes : chaque plateforme tire une « scène » parmi plusieurs recettes propres à son monde
// (prairie fleurie, camp, éboulis, atelier…) et la compose avec des modèles Quaternius CC0 (assets/decor/nature.glb et props.glb : arbres,
// buissons, fleurs, roches, tonneaux, caisses, bannières, outils…). Tout reste À L'INTÉRIEUR de la plateforme (rien ne flotte), les
// grands objets contre le bord du fond (la caméra regarde depuis l'avant), seuls les petits traînent au milieu.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PACKS = {};
function loadPack(name) {
  return (PACKS[name] ||= new GLTFLoader().loadAsync(new URL('../assets/decor/' + name + '.glb', import.meta.url).href).then((g) => {
    const m = {};
    for (const c of g.scene.children) { c.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const mt of [].concat(o.material)) if (mt.alphaTest === 0 && mt.transparent) mt.alphaTest = 0.4; } }); m[c.name] = c; }
    return m;
  }).catch((e) => { console.info('[décor]', name, e?.message || e); return {}; }));
}
let LIB = {};
export const get = (name) => LIB[name] || null; // modèle brut du décor (totems)
export async function load(world) { if (!RECIPES[world] && world !== 'sky') return; const [n, p] = await Promise.all([loadPack('nature'), loadPack('props')]); LIB = { ...n, ...p }; }

// recette : [modèle(s), hauteur min, hauteur max, zone, nombre]
//   zone : back (contre le fond), corner (coins), any (n'importe où, petits objets), front (bord avant, bas objets)
const T = (...a) => a; // lisibilité
const RECIPES = {
  sky: [
    // prairie : un arbre, un buisson fleuri, des fleurs et de l'herbe haute
    [T(['CommonTree_1', 'CommonTree_2', 'CommonTree_3'], 3.2, 4.8, 'back', 1), T(['Bush_Common_Flowers'], 0.9, 1.3, 'corner', 1), T(['Flower_3_Group', 'Flower_4_Group'], 0.45, 0.7, 'any', 2), T(['Grass_Common_Tall'], 0.5, 0.8, 'any', 3), T(['Clover_1', 'Clover_2'], 0.25, 0.4, 'any', 2)],
    // verger tordu
    [T(['TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3'], 3.0, 4.2, 'back', 1), T(['Flower_4_Group'], 0.4, 0.6, 'any', 3), T(['Mushroom_Common', 'Mushroom_Laetiporus'], 0.3, 0.5, 'any', 2), T(['Bench'], 0.8, 0.9, 'corner', 1), T(['Grass_Wispy_Short'], 0.4, 0.6, 'any', 3)],
    // avant-poste : caisses, tonneau, fanion au vent, torche
    [T(['Banner_1', 'Banner_2'], 2.6, 3.2, 'back', 1), T(['Crate_Wooden'], 0.7, 0.9, 'corner', 1), T(['Barrel', 'Barrel_Apples'], 0.9, 1.1, 'corner', 1), T(['Torch_Metal'], 1.5, 1.7, 'corner', 1), T(['Rope_2', 'Rope_3'], 0.3, 0.45, 'any', 1), T(['Grass_Common_Short'], 0.3, 0.45, 'any', 2)],
    // éboulis : roches, cailloux, arbre mort
    [T(['DeadTree_1', 'DeadTree_2'], 2.6, 3.6, 'back', 1), T(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], 0.9, 1.5, 'corner', 2), T(['Pebble_Round_1', 'Pebble_Square_1', 'Pebble_Round_3'], 0.2, 0.35, 'any', 3), T(['Grass_Wispy_Short'], 0.35, 0.5, 'any', 2)],
    // jardin : fleurs partout, pot, banc
    [T(['Bush_Common'], 0.9, 1.2, 'back', 2), T(['Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single'], 0.4, 0.65, 'any', 4), T(['Vase_2', 'Vase_4'], 0.5, 0.7, 'corner', 1), T(['Stool'], 0.5, 0.6, 'corner', 1)],
  ],
  jungle: [
    [T(['CommonTree_1', 'CommonTree_2', 'CommonTree_3'], 4.2, 6.0, 'back', 1), T(['Plant_1_Big', 'Plant_7_Big'], 1.2, 1.8, 'corner', 2), T(['Fern_1'], 0.6, 0.9, 'any', 3), T(['Mushroom_Common'], 0.3, 0.5, 'any', 2)],
    [T(['CommonTree_4', 'CommonTree_5'], 4.0, 5.5, 'back', 1), T(['Bush_Common'], 1.0, 1.4, 'corner', 1), T(['Plant_1', 'Plant_7'], 0.7, 1.1, 'any', 3), T(['Flower_3_Group'], 0.4, 0.6, 'any', 2), T(['Grass_Wispy_Tall'], 0.6, 0.9, 'any', 3)],
    [T(['Plant_7_Big', 'Plant_1_Big'], 1.4, 2.0, 'back', 2), T(['Mushroom_Laetiporus'], 0.35, 0.55, 'corner', 1), T(['Rock_Medium_1', 'Rock_Medium_3'], 0.7, 1.1, 'corner', 1), T(['Fern_1'], 0.6, 0.9, 'any', 4)],
    [T(['DeadTree_3', 'DeadTree_4'], 3.0, 4.2, 'back', 1), T(['Plant_1'], 0.8, 1.2, 'corner', 2), T(['Fern_1', 'Clover_1'], 0.4, 0.8, 'any', 3), T(['Pebble_Round_1', 'Pebble_Round_3'], 0.2, 0.3, 'any', 2)],
  ],
  ice: [
    [T(['Pine_1', 'Pine_2', 'Pine_3'], 4.0, 6.0, 'back', 1), T(['Rock_Medium_1', 'Rock_Medium_2'], 0.8, 1.3, 'corner', 1), T(['Pebble_Round_1', 'Pebble_Square_3'], 0.2, 0.3, 'any', 3)],
    [T(['DeadTree_1', 'DeadTree_3', 'DeadTree_5'], 2.8, 4.0, 'back', 1), T(['Rock_Medium_3'], 0.8, 1.2, 'corner', 2), T(['Grass_Wispy_Short'], 0.3, 0.45, 'any', 3)],
    [T(['Pine_4', 'Pine_5'], 3.4, 5.0, 'back', 2), T(['Barrel', 'Crate_Wooden'], 0.8, 1.0, 'corner', 1), T(['Torch_Metal'], 1.5, 1.7, 'corner', 1)],
    [T(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], 1.0, 1.8, 'back', 2), T(['Pebble_Round_3', 'Pebble_Square_1'], 0.2, 0.3, 'any', 4)],
  ],
  summit: [
    [T(['Pine_2', 'Pine_4'], 4.4, 6.4, 'back', 1), T(['Rock_Medium_2'], 0.9, 1.4, 'corner', 1), T(['Banner_1', 'Banner_2'], 2.6, 3.2, 'corner', 1), T(['Pebble_Round_1', 'Pebble_Square_3'], 0.2, 0.3, 'any', 3)],
    [T(['DeadTree_2', 'DeadTree_4'], 3.0, 4.4, 'back', 1), T(['Rock_Medium_1', 'Rock_Medium_3'], 1.0, 1.6, 'corner', 2), T(['Grass_Wispy_Short'], 0.3, 0.45, 'any', 2)],
    [T(['Rock_Medium_1', 'Rock_Medium_2'], 1.2, 2.0, 'back', 2), T(['Crate_Metal', 'Crate_Wooden'], 0.7, 0.9, 'corner', 1), T(['Chain_Coil', 'Rope_1'], 0.3, 0.45, 'any', 1), T(['Pebble_Round_3'], 0.2, 0.3, 'any', 3)],
  ],
  deep: [
    // outillage : pioche, seau, établi
    [T(['Workbench'], 0.9, 1.1, 'back', 1), T(['Pickaxe_Bronze', 'Axe_Bronze'], 0.9, 1.1, 'corner', 1), T(['Bucket_Metal', 'Bucket_Wooden_1'], 0.45, 0.6, 'corner', 1), T(['Whetstone'], 0.3, 0.4, 'any', 1), T(['Pebble_Square_1', 'Pebble_Round_1'], 0.15, 0.25, 'any', 3)],
    // réserve : caisses, tonneaux, sacs
    [T(['Crate_Wooden', 'FarmCrate_Empty'], 0.7, 1.0, 'back', 2), T(['Barrel', 'Barrel_Holder'], 0.9, 1.2, 'corner', 1), T(['Bag', 'Pouch_Large'], 0.35, 0.5, 'any', 2), T(['Torch_Metal'], 1.5, 1.7, 'corner', 1)],
    // éboulis : roches, champignons des cavernes
    [T(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], 0.9, 1.6, 'back', 2), T(['Mushroom_Laetiporus', 'Mushroom_Common'], 0.35, 0.6, 'corner', 2), T(['Pebble_Square_1', 'Pebble_Round_3'], 0.15, 0.3, 'any', 4)],
    // campement du mineur : marmite, chaîne, lampe
    [T(['Cauldron'], 0.8, 1.0, 'corner', 1), T(['Chain_Coil'], 0.35, 0.5, 'any', 1), T(['Torch_Metal', 'CandleStick_Triple'], 1.2, 1.7, 'corner', 1), T(['Stool'], 0.5, 0.6, 'corner', 1), T(['Chest_Wood'], 0.6, 0.8, 'back', 1)],
  ],
  mech: [
    [T(['Anvil'], 0.7, 0.9, 'corner', 1), T(['Workbench'], 0.9, 1.1, 'back', 1), T(['Bucket_Metal'], 0.45, 0.6, 'any', 1), T(['Pot_1'], 0.4, 0.6, 'any', 1)],
    [T(['Cauldron'], 0.9, 1.2, 'corner', 1), T(['Barrel', 'Barrel_Holder'], 0.9, 1.2, 'back', 2), T(['Chain_Coil'], 0.35, 0.5, 'any', 2), T(['Whetstone'], 0.3, 0.4, 'any', 1)],
    [T(['Crate_Metal'], 0.7, 1.0, 'back', 2), T(['Chain_Coil', 'Rope_1'], 0.3, 0.45, 'any', 2), T(['Torch_Metal'], 1.5, 1.7, 'corner', 1), T(['Shield_Wooden'], 0.7, 0.9, 'corner', 1)],
  ],
};
const FROST = { ice: 0.55, summit: 0.35 }; // sapins et roches poudrés de neige : on éclaircit les couleurs

const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const geo = new THREE.Box3(), V = new THREE.Vector3();
// place un modèle à la hauteur voulue, base sur y = 0, centré
function put(name, h, parent, x, y, z, ry, frost) {
  const src = LIB[name]; if (!src) return null;
  const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
  // hauteur visée, mais emprise au sol plafonnée (les fleurs et touffes plates devenaient immenses et cachaient la dalle)
  geo.setFromObject(c); const sz = geo.getSize(V), s = Math.min(h / (sz.y || 1), Math.max(0.7, h * 2.2) / (Math.max(sz.x, sz.z) || 1));
  c.scale.setScalar(s); c.position.set(-((geo.max.x + geo.min.x) / 2) * s, -geo.min.y * s, -((geo.max.z + geo.min.z) / 2) * s);
  const g = new THREE.Group(); g.add(c); g.position.set(x, y, z); g.rotation.y = ry; g.userData.r = Math.max(sz.x, sz.z) * s * 0.5; parent.add(g);
  if (frost) c.traverse((m) => { if (m.isMesh) { m.material = [].concat(m.material).map((mt) => { const q = mt.clone(); if (q.color) q.color.lerp(new THREE.Color(0xeef4fa), frost); return q; }); if (m.material.length === 1) m.material = m.material[0]; } });
  return g;
}
// habille une plateforme b (o = son groupe) pour le monde donné
export function dress(world, b, o) {
  const rec = RECIPES[world]; if (!rec || !Object.keys(LIB).length) return;
  if (b.move || b.deco || b.climb || b.crumble || b.plank || b.beam || b.post || b.bar || b.ghost || b.cloud || b.summit || b.sink || b.tatami || b.hang || b.hammer) return;
  const i = b.i, hw = b.hw, hd = b.hd, top = b.hh, area = b.w * b.d;
  if (area < 5 || b.w < 2.2 || b.d < 2) return;
  const r = rec[Math.floor(rnd(i, 31 + (b.zone || 0)) * rec.length)], frost = FROST[world] || 0, small = area < 12 || b.w < 4;
  let used = 0;
  for (const [names, hmin, hmax, where, n] of r) {
    const count = small ? Math.min(n, where === 'any' ? 2 : 1) : n;
    if (small && hmax > 2.2) continue;                    // pas d'arbre sur un petit îlot
    for (let k = 0; k < count; k++) {
      const key = i * 7 + used++, name = names[Math.floor(rnd(key, 3) * names.length)], h = hmin + rnd(key, 4) * (hmax - hmin), ry = rnd(key, 5) * 6.283;
      const m = Math.max(0.5, h * 0.18); // marge au bord : le modèle tient sur la plateforme
      let x, z;
      if (where === 'back') { x = (rnd(key, 6) - 0.5) * (b.w - 2 * m - 0.8); z = -hd + m + rnd(key, 7) * 0.6; }
      else if (where === 'corner') { const sx = rnd(key, 8) > 0.5 ? 1 : -1, back = hmax <= 1.4 ? rnd(key, 9) > 0.5 : true; x = sx * (hw - m - 0.3); z = back ? -hd + m + 0.2 + rnd(key, 7) * 0.5 : hd - m - 0.2; }
      else if (where === 'front') { x = (rnd(key, 6) - 0.5) * (b.w - 2); z = hd - 0.6 - rnd(key, 7) * 0.4; }
      else { x = (rnd(key, 6) - 0.5) * (b.w - 1.4); z = (rnd(key, 7) - 0.5) * (b.d - 1.4); }
      if (Math.abs(x) > hw - 0.3) x = Math.sign(x) * (hw - 0.3);
      const g = put(name, h, o, x, top, z, ry, /Pine|Dead|Rock|Pebble|Bush|Barrel|Crate/.test(name) ? frost : 0);
      if (g) { const rr = Math.min(g.userData.r * 0.85, Math.min(hw, hd) - 0.25); g.position.x = Math.max(-hw + rr + 0.1, Math.min(hw - rr - 0.1, g.position.x)); g.position.z = Math.max(-hd + rr + 0.1, Math.min(hd - rr - 0.1, g.position.z)); }
    }
  }
}
