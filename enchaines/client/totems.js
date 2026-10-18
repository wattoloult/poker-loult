// LES ENCHAÎNÉS — totems des points de passage : un monument propre à chaque monde, posé dans le décor, qui S'ALLUME quand la cordée
// l'atteint (montée de la flamme / de la lueur en 0,8 s, éclat, son) puis respire doucement tant que c'est le point de passage courant.
// Modèles réels : Kenney (Castle Kit, Nature Kit, Survival, Space…) et Quaternius (packs des mondes), voir ASSET_CREDITS.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { S, LIB, sprite } from './scene.js';
import * as Mechs from './mechs.js';
import * as Scatter from './scatter.js';

const W_ = {}; // modèles chargés : W_['monde/fichier']
// recette par monde : corps (modèle + hauteur), feu (couleur, hauteur), décor d'appoint ; spin = pièce qui tourne une fois allumé
const SPEC = {
  medieval: { body: 'castle', h: 2.3, fire: 0xffa040, fy: 2.55, light: 0xffa050, banner: 1 },
  jungle: { file: 'jungle/statue_obelisk', h: 2.8, fire: 0x9dff6a, fy: 3.0, light: 0x9dff80, base: 'jungle/statue_head', bh: 0.9 },
  japan: { pack: 'postLantern', h: 2.2, fire: 0xffc070, fy: 1.55, light: 0xffb060, inner: 1 },
  deep: { pack: 'bigCrystal', h: 1.9, fire: 0x6fe0ff, fy: 1.1, light: 0x60d0ff, base: 'deep/lantern', bh: 0.6, glowBody: 0x2a8ac8 },
  sky: { decor: 'Banner_1', h: 3.0, fire: 0xdff4ff, fy: 3.35, light: 0xbfe8ff }, // mât à fanion (l'ancienne colonne grecque flottante n'avait aucun sens sur une île)
  mech: { file: 'mech/piston-square', h: 1.6, fire: 0xffa448, fy: 2.1, light: 0xff9a40, spin: 'mech/cog-a', sh: 1.2 },
  ice: { file: 'ice/rock_tallA', h: 2.4, fire: 0xffb060, fy: 0.55, light: 0xffa050, base: 'ice/campfire-pit', bh: 0.5, baseX: 0.9 },
  greek: { file: 'greek/column', h: 2.6, fire: 0xffa040, fy: 2.85, light: 0xffa850 }, // colonne dorique et sa flamme (le feu sacré)
  summit: { file: 'summit/statue_ring', h: 2.8, fire: 0xfff1c8, fy: 1.7, light: 0xffe6b0, glowBody: 0x8a6a30 },
};
export async function load(world) {
  const sp = SPEC[world] || SPEC.medieval, ld = new GLTFLoader(), base = new URL('../assets/worlds/', import.meta.url);
  const want = [sp.file, sp.base, sp.spin].filter(Boolean).filter((k) => !W_[k]);
  await Promise.all(want.map(async (k) => { try { const g = await ld.loadAsync(new URL(k + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); W_[k] = g.scene; } catch { W_[k] = null; } }));
  if (sp.body === 'castle') await Mechs.load();
}
function fit(src, parent, height) { // copie d'un modèle, posée au sol, de la hauteur voulue, centrée
  if (!src) return null; const o = src.clone(true), box = new THREE.Box3().setFromObject(src), h = box.max.y - box.min.y || 1, s = height / h;
  o.scale.setScalar(s); o.position.set(-((box.max.x + box.min.x) / 2) * s, -box.min.y * s, -((box.max.z + box.min.z) / 2) * s);
  const g = new THREE.Group(); g.add(o); parent.add(g); return g;
}
const emissives = (o) => { const out = []; o?.traverse((m) => { if (m.isMesh && m.material?.emissive) { m.material = m.material.clone(); out.push(m.material); } }); return out; };

export function make(world, c, i, grp, PACK) {
  const sp = SPEC[world] || SPEC.medieval, g = new THREE.Group(); g.position.set(c.x + (c.flagX ?? -1.8), c.y, c.z - 1.2); grp.add(g);
  let body = null, ban = null;
  if (sp.body === 'castle') { body = Mechs.sized('wall-pillar', 0.75, sp.h, 0.75, S.mat.stone); if (body) g.add(body); }
  else body = fit(sp.decor ? Scatter.get(sp.decor) : sp.file ? W_[sp.file] : PACK?.[sp.pack], g, sp.h);
  if (!body) body = fit(LIB.Torch_Metal, g, 1.6); // repli : le monde n'a pas encore son modèle
  if (sp.banner) { ban = fit(LIB.Banner_1_Cloth, g, 1.7); if (ban) { ban.position.set(0, 0.35, 0.42); ban.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.userData.ban = true; } }); } const t = fit(LIB.Torch_Metal, g, 0.7); if (t) t.position.y = sp.h; }
  if (sp.base) { const b = fit(W_[sp.base], g, sp.bh); if (b) b.position.set(sp.baseX ?? 0, 0, sp.baseX ? 0.3 : 0.6); }
  let spin = null; if (sp.spin) { spin = fit(W_[sp.spin], g, sp.sh); if (spin) { spin.position.y = sp.h; spin.rotation.x = Math.PI / 2; } }
  const fire = sprite(sp.fire, 1.6); fire.position.set(sp.baseX ?? 0, sp.fy, sp.base && sp.baseX ? 0.3 : 0); fire.scale.setScalar(0.01); g.add(fire);
  const halo = sprite(sp.fire, 3.4); halo.position.copy(fire.position); halo.material.opacity = 0; g.add(halo);
  const light = new THREE.PointLight(sp.light, 0, 9, 1.8); light.position.set(fire.position.x, fire.position.y + 0.2, 0.6); g.add(light);
  const glow = sprite(0xffcf70, 3.2); glow.position.set(0, 2.2, 0); glow.material.opacity = 0; g.add(glow); // éclat d'activation (scene.js)
  const mats = sp.glowBody ? emissives(body) : [];
  // les grimpeurs réapparaissent à c.x ± 1,6 m sur l'axe c.z : un modèle large (statue du sommet, rouages, feu de camp) ne doit pas déborder sur ces places
  g.updateMatrixWorld(true); const bb = new THREE.Box3(); g.traverse((o) => { if (o.isMesh) bb.expandByObject(o); });
  if (!bb.isEmpty() && bb.min.x < c.x + 2.2 && bb.max.x > c.x - 2.2 && bb.max.z > c.z - 1.0) g.position.z -= bb.max.z - (c.z - 1.0); // 1 m : corps, bras et flamme du totem ne recouvrent pas le grimpeur
  return { g, ban, glow, tot: { sp, fire, halo, light, spin, mats, a: 0, body } };
}
// image : montée de la flamme à l'activation, respiration du point courant, rotation de la pièce mécanique
export function update(W, dt, t) {
  for (let i = 0; i < (S.cps?.length || 0); i++) {
    const c = S.cps[i], T = c.tot; if (!T) continue;
    const on = i <= W.cpMax, cur = i === W.cp;
    T.a = on ? Math.min(1, T.a + dt / 0.8) : Math.max(0, T.a - dt);
    const e = T.a < 1 ? 1 - (1 - T.a) ** 3 * (1 - 2.2 * T.a) : 1; // petit dépassement : la flamme jaillit puis se pose
    const breathe = cur ? 1 + Math.sin(t * 3 + i) * 0.08 : 0.82;
    T.fire.scale.setScalar(Math.max(0.01, 1.5 * e * breathe * (1 + Math.sin(t * 17 + i * 3) * 0.05)));
    T.halo.material.opacity = 0.32 * e * (cur ? 1 : 0.6); T.light.intensity = 18 * e * breathe;
    if (T.sp.float && T.body) T.body.position.y = Math.sin(t * 1.3 + i) * 0.08 * e;
    if (T.spin) T.spin.rotation.y += dt * 1.6 * e;
    for (const m of T.mats) m.emissive.setHex(T.sp.glowBody).multiplyScalar(e * breathe);
  }
}
