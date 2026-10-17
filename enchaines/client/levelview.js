// LES ENCHAÎNÉS — vue du parcours : plateformes et matériaux du monde, toile de fond (gorge, vallée, caverne, ciel ouvert, machinerie),
// décor propre à chaque monde (modèles CC0 du pack du monde), rendu des mécanismes (lianes, plaques, leviers, herses, contrepoids,
// tremplins, vent, cascades, roue, engrenages), particules d'ambiance. Lit le monde simulé, ne décide rien.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { S, LIB, TEX, NOISE, sprite, boxGeo, linkRow } from './scene.js';
import { themeOf } from './themes.js';
import { windOn } from '../core/sim.js';
import * as Scatter from './scatter.js';
import * as Mechs from './mechs.js';
import * as Portal from './portal.js';
import * as Totems from './totems.js';
import * as Decor from './decor.js';
import { VIEWS } from './worlds/index.js';
import * as Sfx from './sfx.js';
import { HP } from '../core/sim.js';
import { nextCourse } from '../core/worlds.js';

const PACK = {}; // modèles par monde : PACK[monde][clé]
let MANIFEST = null;
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), SC = new THREE.Vector3(1, 1, 1);
const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/* ------------------------------ chargement des décors par monde ------------------------------ */
export async function loadPack(world) {
  if (world === 'medieval' || PACK[world]) return;
  const base = new URL('../assets/props/', import.meta.url);
  MANIFEST ||= await (await fetch(new URL('manifest.json', base))).json();
  const pk = world === 'summit' ? 'ice' : world, keys = MANIFEST[pk]; if (!keys) { PACK[world] = {}; return; }
  const g = await new GLTFLoader().loadAsync(new URL(pk + '.glb', base).href);
  const P = (PACK[world] = {});
  g.scenes.forEach((s, i) => { s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); P[keys[i]] = s; });
  if (world === 'summit') { await loadPack('mech'); Object.assign(P, PACK.mech); }
}
const prop = (world, key) => (world === 'medieval' ? LIB[key] : PACK[world]?.[key]);
export function place(src, parent, height) {
  if (!src) return null;
  const o = src.clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  const box = new THREE.Box3().setFromObject(o), h = box.max.y - box.min.y || 1, s = height / h;
  o.scale.setScalar(s); o.position.y = -box.min.y * s;
  // recentré horizontalement (certains modèles ont leur origine dans un coin)
  o.position.x = -((box.max.x + box.min.x) / 2) * s; o.position.z = -((box.max.z + box.min.z) / 2) * s;
  const g = new THREE.Group(); g.add(o); parent.add(g); return g;
}

/* ------------------------------ ambiance du monde ------------------------------ */
export function applyTheme(th) {
  const sc = S.scene, col = (h) => new THREE.Color(h);
  S.sky.material.uniforms.uTop.value.set(th.sky[0]); S.sky.material.uniforms.uMid.value.set(th.sky[1]); S.sky.material.uniforms.uHor.value.set(th.sky[2]); S.sky.material.uniforms.uLow.value.set(th.sky[3]);
  S.sunDir.set(...th.sun.dir).normalize(); S.sun.color.set(th.sun.color); S.sun.intensity = th.sun.int;
  S.hemi.color.set(th.hemi[0]); S.hemi.groundColor.set(th.hemi[1]); S.hemi.intensity = th.hemi[2];
  sc.fog.color.set(th.fog[0]); sc.fog.near = th.fog[1]; sc.fog.far = th.fog[2];
  sc.environmentIntensity = th.dark ? 0.15 : 0.55;
  for (const c of S.clouds) { c.visible = !!th.clouds; if (th.clouds) { c.material.uniforms.uTint.value.set(th.clouds.tint); c.position.y = th.clouds.y - (c === S.clouds[0] ? 0 : 12); } }
  S.cloudBase.visible = !!th.clouds; if (th.clouds) S.cloudBase.material.color.set(th.fog[0]);
  S.ridges.forEach((r, i) => { r.visible = !!th.ridges; if (th.ridges) r.material.uniforms.uC.value.set(th.ridges[i]); r.material.uniforms.uFog.value.set(th.fog[0]); });
  S.renderer.toneMappingExposure = th.exposure ?? (th.dark ? 1.25 : 1.05);
  S.theme = th;
}
// matériau d'un nom abstrait dans le monde courant
const MATS = {};
export function matFor(th, name, world) {
  const key = world + '/' + name; if (MATS[key]) return MATS[key];
  const d = th.mats[name] || th.mats.stone, base = d.base;
  let m;
  if (base === 'plain') m = new THREE.MeshStandardMaterial({ color: d.color, roughness: d.rough ?? 0.8, metalness: d.metal ?? 0 });
  else { m = S.mat[base].clone(); m.color = new THREE.Color(d.color); if (d.rough != null) m.roughness = d.rough; if (d.metal != null) m.metalness = d.metal; }
  if (d.emissive) { m.emissive = new THREE.Color(d.emissive); m.emissiveIntensity = 1.4; }
  if (d.ice) { m.transparent = true; m.opacity = 0.88; m.envMapIntensity = 1.6; }
  m.userData.tile = S.mat[base]?.userData.tile || [2.6, 2.6];
  return (MATS[key] = m);
}

/* ------------------------------ toiles de fond ------------------------------ */
const hsh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hsh(ix, iy), b = hsh(ix + 1, iy), c = hsh(ix, iy + 1), d = hsh(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
function fbm2(x, y, o = 5) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise(x, y); x *= 2.03; y *= 2.03; a *= 0.5; } return s; }
// roche stylisée calculée (strates, fissures, relief par dérivées, mousse et neige sur ce qui regarde vers le haut), couleurs du monde
function rockMaterial(r) {
  const m = new THREE.MeshStandardMaterial({ color: r.color, roughness: 0.93, envMapIntensity: 0.25 });
  const U = { uLo: { value: new THREE.Vector3(...r.lo) }, uHi: { value: new THREE.Vector3(...r.hi) }, uMoss: { value: new THREE.Vector3(...r.moss) }, uSnowY: { value: r.snowY }, uMossy: { value: r.mossy ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.)).xyz; vWn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying vec3 vWn; uniform vec3 uLo, uHi, uMoss; uniform float uSnowY, uMossy;' + NOISE + `
      float ridge(vec2 p){ return 1. - abs(fbm(p)*2. - 1.); }
      float rockH(vec3 p){ return ridge(p.xy*vec2(0.09,0.05))*0.9 + ridge(p.xy*0.33 + 4.)*0.45 + fbm(p.xy*1.4)*0.22 - pow(ridge(p.xy*vec2(0.55,0.22)+9.), 8.)*0.6; }`)
      .replace('#include <map_fragment>', `
        float hh = rockH(vWp);
        vec3 rk = mix(uLo, uHi, fbm(vec2(vWp.x*0.025, vWp.y*0.06)));
        rk *= 0.5 + 0.6*smoothstep(0.1,1.3,hh);
        float moss = smoothstep(0.25 - uMossy*0.5, 0.75, vWn.y + uMossy*0.3) * smoothstep(0.4 - uMossy*0.25,0.62,fbm(vWp.xz*0.25 + vWp.xy*0.05));
        rk = mix(rk, uMoss, moss*0.85);
        float snow = smoothstep(uSnowY, uSnowY + 10., vWp.y + fbm(vWp.xz*0.2)*6.) * smoothstep(0.05, 0.5, vWn.y + 0.3);
        rk = mix(rk, vec3(0.95,0.95,0.99), snow);
        diffuseColor.rgb *= rk * 1.6;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 pos = -vViewPosition; vec3 dpx = dFdx(pos), dpy = dFdy(pos); float hx = dFdx(hh), hy = dFdy(hh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 g = sign(det) * (hx * r1 + hy * r2); normal = normalize(abs(det) * normal - g * 1.1); }`);
  };
  return m;
}
// paroi en relief derrière le parcours (gorge qui se referme sur les côtés), crête découpée au-dessus du sommet
function wall(L, mat, o = {}) {
  const xs = L.bodies.filter((b) => !b.cliff).map((b) => b.x), x0 = Math.min(...xs) - 50, x1 = Math.max(...xs) + 50, cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
  const zs = L.bodies.filter((b) => !b.cliff).map((b) => b.z - b.d / 2), zBack = Math.min(-7, Math.min(...zs) - 3) - (o.back || 0);
  const NX = Math.round(Math.min(260, (x1 - x0) / 1.1)), NY = 170, Y0 = L.abyss - 25, top0 = (o.top ?? L.top + 10), pos = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const x = x0 + (x1 - x0) * (i / NX), ax = Math.abs(x - cx);
    const top = top0 + fbm2(x * 0.03, 3.1) * 16 - 8 + Math.max(0, ax - hw * 0.6) * 0.12;
    const y = Y0 + (top - Y0) * (j / NY);
    const big = 1 - Math.abs(fbm2(x * 0.045, y * 0.02, 4) * 2 - 1), mid = fbm2(x * 0.16, y * 0.09, 4), ledge = Math.pow(Math.abs(Math.sin(y * 0.21 + fbm2(x * 0.05, y * 0.01) * 4)), 6);
    let z = zBack - 0.4 - big * 10 - mid * 3.4 + ledge * 1.4 - 0.6;
    z += Math.max(0, ax - hw * 0.82) ** 2 * 0.03;
    if (j === NY) z -= 3;
    pos.push(x, y, o.ceiling ? 0 : Math.min(z, ax < hw * 0.8 ? zBack : 999));
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
function backdrop(L, th, grp, world) {
  const kind = L.backdrop || th.backdrop, rock = rockMaterial(th.rock);
  if (kind === 'gorge' || kind === 'jungle' || kind === 'snow' || kind === 'peak') grp.add(wall(L, rock));
  else if (kind === 'valley') { const w = wall(L, rock, { back: 26, top: L.top + 30 }); grp.add(w); }
  else if (kind === 'cave') { // caverne : paroi du fond, voûte au-dessus, fond noir
    grp.add(wall(L, rock));
    const ceil = wall(L, rock, { top: L.top + 40 }); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, L.top + 22, -20); ceil.scale.set(1, 1.6, 1); grp.add(ceil);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshBasicMaterial({ color: 0x050608 })); floor.rotation.x = -Math.PI / 2; floor.position.y = L.abyss - 5; grp.add(floor);
  } else if (kind === 'machine') { // salle des machines : mur de rouages, engrenages géants qui tournent derrière
    grp.add(wall(L, rock));
    const gear = prop('mech', 'gear'); S.bigGears = [];
    if (gear) for (let k = 0; k < 7; k++) {
      const b = L.bodies[Math.floor(rnd(k, 3) * L.bodies.length)], gg = place(gear, grp, 9 + rnd(k, 1) * 8); if (!gg) continue;
      gg.rotation.x = Math.PI / 2; gg.position.set(b.x + (rnd(k, 2) - 0.5) * 14, b.y + 4, -12 - rnd(k, 4) * 6); S.bigGears.push({ g: gg, w: (rnd(k, 5) > 0.5 ? 1 : -1) * (0.08 + rnd(k, 6) * 0.15) });
    }
  } else if (kind === 'none') { // ciel ouvert : îles lointaines
    const isl = prop('sky', 'island');
    if (isl) for (let k = 0; k < 16; k++) { const s = place(isl, grp, 6 + rnd(k, 1) * 14); if (s) { s.position.set(-60 + rnd(k, 2) * 260, -10 + rnd(k, 3) * 60, -60 - rnd(k, 4) * 120); s.rotation.y = rnd(k, 5) * 6; } }
  }
}

/* ------------------------------ construction ------------------------------ */
export function build(W) {
  const L = W.level, world = L.world || 'medieval', th = themeOf(world);
  if (S.level) S.scene.remove(S.level);
  const grp = S.level = new THREE.Group(); S.scene.add(grp);
  applyTheme(th);
  S.bodyMesh = []; S.fires = []; S.hangs = []; S.levers = []; S.plates = []; S.wheels = []; S.gearHubs = []; S.bigGears = []; S.cwViews = []; S.lights = [];
  for (const b of W.bodies) {
    if (b.cliff || b.noMesh || (b.herse && b.look !== 'stone') || b.dbseg) { S.bodyMesh.push(null); continue; } // herses et ponts-levis : modèles de mechs.js
    const o = new THREE.Group(); grp.add(o); S.bodyMesh.push(o);
    if (b.lever) { lever(b, o); continue; }
    const mat = matFor(th, b.mat, world);
    const m = new THREE.Mesh(boxGeo(b.w, b.h, b.d, mat.userData.tile), mat); m.castShadow = !b.deco || b.deco !== 'pagoda'; m.receiveShadow = true; o.add(m);
    if (world === 'medieval') decorMedieval(b, o); else decorWorld(world, th, b, o);
    mechVisual(world, th, b, o);
  }
  Mechs.build(W, grp);
  Decor.build(L, grp);
  S.wv = VIEWS[world] || null; S.wa = { THREE, S, LIB, PACK: PACK[world] || {}, place, matFor: (name) => matFor(th, name, world), sprite, linkRow, boxGeo, Sfx, HP, th };
  try { S.wv?.build?.(W, grp, S.wa); } catch (e) { console.error('monde ' + world, e); }
  Portal.build(L, grp, nextCourse(L.id, true)?.world || world);
  backdrop(L, th, grp, world);
  ropes(L, grp, world);
  winds(L, grp, th);
  checkpoints(L, grp, world);
  particles(th);
  // lumières ponctuelles : seulement les plus utiles (mondes sombres)
  if (th.dark) for (const c of L.checkpoints) { const l = new THREE.PointLight(0xffb070, 30, 22, 1.6); l.position.set(c.x, c.y + 3, c.z + 1); grp.add(l); }
}
function decorMedieval(b, o) {
  const top = b.hh, i = b.i;
  if (b.climb) climbDecor(b, o, ['Prop_Vine1', 'Prop_Vine2', 'Prop_Vine4', 'Prop_Vine5', 'Prop_Vine6', 'Prop_Vine9'].map((k) => LIB[k]), ['Prop_Brick1', 'Prop_Brick2', 'Prop_Brick3', 'Prop_Brick4'].map((k) => LIB[k]));
  if (b.hang || b.hammer) S.hangs.push(b.i);
  if (!b.post && !b.beam && !b.plank && !b.move && !b.climb && b.w * b.d >= 20 && b.zone) {
    const props = ['Crate_Wooden', 'Barrel', 'Bag', 'Bucket_Wooden_1', 'Vase_Rubble_Medium'];
    for (let k = 0; k < 2; k++) { const p = place(LIB[props[(i + k) % props.length]], o, 0.6 + rnd(i, k) * 0.3); if (p) { p.position.set((rnd(i, k + 1) > 0.5 ? 1 : -1) * (b.hw - 0.6), top, -b.hd + 0.6 + k * 0.7); p.rotation.y = rnd(i, k + 3) * 6; } }
  }
  if ((b.mat === 'brick' || b.mat === 'stone') && !b.post && b.w >= 3 && rnd(i, 1) > 0.35) {
    const l = place(LIB.Lantern_Wall, o, 0.55); if (l) l.position.set(b.hw * 0.6 * (rnd(i, 2) > 0.5 ? 1 : -1), top - 0.62, b.hd + 0.02);
    const g = sprite(0xffb15a, 1.6); g.position.set(l ? l.position.x : 0, top - 0.45, b.hd + 0.28); o.add(g);
  }
  if (b.summit) summitDecor(b, o, 'medieval');
  if (b.crumble) o.children[0].material = Object.assign(S.mat.darkwood.clone(), { color: new THREE.Color(0xc89a7a) });
  if (b.hit) o.children[0].material = Object.assign(S.mat.metal.clone(), { color: new THREE.Color(0xff8a6a), emissive: new THREE.Color(0x5a1206) });
}
// paroi escaladable : prises en relief et végétation (ou givre) plaquée
function climbDecor(b, o, vines, holds) {
  const faces = b.climbFaces || [0, 1, 2, 3], i = b.i, top = b.hh;
  for (const f of faces) {
    const [fx, fz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][f], half = fx ? b.hd : b.hw, out = fx ? b.hw : b.hd;
    const n = Math.max(3, Math.round((half * 2 * b.h) / 2.2));
    for (let k = 0; k < n; k++) {
      const src = holds[k % holds.length]; if (!src) continue;
      const u = (rnd(i, k * 3 + f) * 2 - 1) * (half - 0.3), y = -b.hh + 0.6 + rnd(i, k * 7 + f) * (b.h - 1.2);
      const h = place(src, o, 0.22 + rnd(i, k) * 0.14); if (!h) continue;
      h.position.set(fx ? fx * (out + 0.04) : u, y, fx ? u : fz * (out + 0.04)); h.rotation.set(rnd(i, k + 9) * 3, rnd(i, k + 5) * 6, rnd(i, k + 2) * 3);
    }
    for (let k = 0; k < Math.max(1, Math.round(half / 1.6)); k++) {
      const src = vines[(i + k + f) % vines.length]; if (!src) continue;
      const hgt = Math.min(2.6, b.h * 0.45), v = place(src, o, hgt); if (!v) continue;
      const u = (rnd(i, k * 11 + f) * 2 - 1) * (half - 0.6);
      v.scale.z *= 0.35; v.position.set(fx ? fx * (out + 0.05) : u, top - hgt + 0.1, fx ? u : fz * (out + 0.05)); v.rotation.y = Math.atan2(fx, fz);
    }
  }
}
function summitDecor(b, o, world) {
  const top = b.hh;
  const arch = place(world === 'japan' ? prop('japan', 'torii') : world === 'sky' ? prop('sky', 'archRound') : LIB.Wall_Arch, o, 4.4); if (arch) arch.position.set(0, top, -b.hd + 0.8);
  for (const sx of [-1, 1]) {
    const bn = place(LIB.Banner_2_Cloth || LIB.Banner_1_Cloth, o, 3.2); if (bn) bn.position.set(sx * 2.8, top, -b.hd + 0.9);
    const t = place(LIB.Torch_Metal, o, 1.5); if (t) t.position.set(sx * 3.2, top, b.hd - 0.8);
    const f = sprite(0xff9a3c, 1.4); f.position.set(sx * 3.2, top + 1.65, b.hd - 0.8); o.add(f); S.fires.push(f);
  }
  const light = new THREE.PointLight(0xffa860, 18, 14, 1.6); light.position.set(0, top + 2.5, b.hd - 1); o.add(light);
}
// île flottante : la boîte physique est réduite à une dalle d'herbe fine (avant : un cube plein + une mini-île décalée dessous, illisible)
function dressIsland(b, o) {
  const th = Math.min(0.5, b.hh), box = o.children[0];
  if (box) { box.scale.y = th / (2 * b.hh); box.position.y = b.hh - th / 2; } // dalle fine suspendue dans le vide (rien dessous : la roche du modèle rendait mal)
}
// décor des autres mondes, à partir de leur pack de modèles
function decorWorld(world, th, b, o) {
  const top = b.hh, i = b.i, P = PACK[world] || {}, big = b.w * b.d >= 14 && !b.move && !b.deco;
  const at = (src, h, x, z, ry = 0) => { const p = place(src, o, h); if (p) { p.position.set(x, top, z); p.rotation.y = ry; } return p; };
  const edgeSpot = (k) => [(rnd(i, k) > 0.5 ? 1 : -1) * (b.hw - 1.2), -b.hd + 1.0 + rnd(i, k + 7) * 0.6]; // décor posé bien À L'INTÉRIEUR de la plateforme (la cime ne pend pas dans le vide)
  if (b.climb) climbDecor(b, o, world === 'ice' || world === 'summit' ? [] : [P.pothosL, P.pothosM, P.vines, LIB.Prop_Vine2].filter(Boolean), world === 'deep' ? [P.crystalA, P.crystalB, P.rocks].filter(Boolean) : world === 'ice' || world === 'summit' ? [P.crystal, P.rockSnow].filter(Boolean) : ['Prop_Brick1', 'Prop_Brick2', 'Prop_Brick3'].map((k) => LIB[k]));
  if (b.hang || b.hammer) S.hangs.push(b.i);
  if (b.summit) summitDecor(b, o, world);
  Scatter.dress(world, b, o); // décor varié par recette (client/scatter.js)
  if (world === 'jungle') {
    if (b.tree) { const v = place(P.pothosL, o, 2.4); if (v) { v.position.set(b.hw * 0.5, -b.hh - 2.3, b.hd - 0.2); } }
    if (b.mat === 'rock' && rnd(i, 5) > 0.4) at(P.fern, 0.6, 0, 0);
  } else if (world === 'japan') {
    if (big && (b.mat === 'stone' || b.mat === 'path') && !b.summit) { const [x, z] = edgeSpot(1); at([P.mapleA, P.mapleB, P.mapleC, P.autumn][(i % 4)], 4 + rnd(i, 3) * 2, x, z, rnd(i, 4) * 6); at(P.postLantern, 1.4, -x * 0.8, z + 0.4); }
    if (b.roof && b.w >= 3) { const l = place(P.hangLantern, o, 0.9); if (l) l.position.set(b.hw - 0.4, -b.hh - 0.9, b.hd - 0.3); const g = sprite(0xff9a50, 1.3); g.position.set(b.hw - 0.4, -b.hh - 0.5, b.hd - 0.3); o.add(g); }
    if (b.post && b.mat === 'bamboo') { const s = place(P.bamboo, o, 3.2); if (s) s.position.set(0.9, top - 3.2, 0.4); }
    if (b.mat === 'shoji') { const s = place(P.shoji, o, 1.6); if (s) { s.position.set(0, top, -b.hd + 0.05); } }
  } else if (world === 'deep') {
    const cr = [P.crystalA, P.crystalB, P.crystalC, P.crystalD, P.crystalE, P.crystalF, P.crystalG].filter(Boolean);
    if ((b.mat === 'rock' || b.mat === 'crystal') && cr.length) for (let k = 0; k < (big ? 3 : 1); k++) {
      const c = place(cr[(i + k) % cr.length], o, 0.7 + rnd(i, k) * 1.2); if (!c) continue;
      c.position.set((rnd(i, k + 2) - 0.5) * b.w * 0.8, b.mat === 'crystal' ? -b.hh : top, b.mat === 'crystal' ? b.hd * 0.6 : -b.hd + 0.4); c.rotation.y = rnd(i, k) * 6;
      c.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x3a9ae0); m.material.emissiveIntensity = 0.9; } });
      const g = sprite(0x6fd8ff, 2.2); g.position.copy(c.position).add(V.set(0, 0.6, 0)); o.add(g);
    }
    if (b.scaffold) { const s = place(P.support, o, 6); if (s) s.position.set(0, -b.hh - 6, 0); }
    if (b.cart) { const c = place(P.minecart, o, 1.0); if (c) c.position.set(0, top, 0); o.children[0].visible = false; }
  } else if (world === 'sky') {
    if (b.island) dressIsland(b, o);
  } else if (world === 'mech') {
    if (b.deco === 'hub') { const g = place(P.gear, o, 7); if (g) { g.position.set(0, b.hh + 0.1, 0); g.scale.y *= 0.15; S.gearHubs.push({ g, b }); } }
    if (b.wheel && !b.alt) S.wheels.push({ c: b.wheel, ids: [] });
    if (b.wheel) S.wheels[S.wheels.length - 1].ids.push(b.i);
  } else if (world === 'ice' || world === 'summit') {
    if (b.mat === 'ice' && rnd(i, 1) > 0.5) at(P.iceBlock, 0.6, b.hw - 0.5, -b.hd + 0.4);
  }
}
// recolore le feuillage d'un modèle (ex. arbre aux feuilles rouges -> vert jungle)
function tintLeaves(o, color) { o?.traverse((m) => { if (!m.isMesh) return; const c = m.material.color; if (c && c.r > c.g * 1.4) { m.material = m.material.clone(); m.material.color.set(color); } }); return o; }
function lever(b, o) { // socle + manche qui bascule selon l'état
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), S.mat.metal); base.position.y = -b.hh + 0.18; o.add(base);
  const arm = new THREE.Group(); arm.position.y = -b.hh + 0.3; o.add(arm);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a30 })); h.position.y = 0.55; arm.add(h);
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe04a30, emissive: 0x401008 })); k.position.y = 1.1; arm.add(k);
  const g = sprite(0xffc070, 1.2); g.position.y = 0.6; o.add(g);
  S.levers.push({ b, arm, g });
}
function mechVisual(world, th, b, o) {
  const top = b.hh;
  if (b.plate) { // plaque : anneau qui s'allume quand elle est pressée
    const r = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 32), new THREE.MeshBasicMaterial({ color: 0xff6040, transparent: true, opacity: 0.9 })); r.rotation.x = -Math.PI / 2; r.position.y = top + 0.02; o.add(r);
    S.plates.push({ b, r });
  }
  if (b.launch) { // tremplin / piston : chevrons lumineux
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.RingGeometry(0.25 + k * 0.18, 0.32 + k * 0.18, 4, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7af0ff, transparent: true, opacity: 0.8 - k * 0.2, side: THREE.DoubleSide })); c.rotation.x = -Math.PI / 2; c.position.y = top + 0.03; o.add(c); }
  }
  if (b.door) { // herse : barreaux
    const mat = S.mat.metal; for (let k = -3; k <= 3; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, b.h, 0.12), mat); bar.position.set(0.32, 0, k * (b.d / 7)); o.add(bar); }
  }
  if (b.cw) { // contrepoids : chaînes jusqu'à une poulie au-dessus
    S.cwViews.push({ b, top: b.y + b.hh + 6 });
  }
}
function checkpoints(L, grp, world) {
  // totems propres à chaque monde, qui s'allument à l'arrivée de la cordée (client/totems.js)
  S.cps = L.checkpoints.map((c, i) => Totems.make(world, c, i, grp, PACK[world]));
}

/* ------------------------------ lianes, vent, cascades ------------------------------ */
function ropes(L, grp, world) {
  S.ropes = [];
  const n = (L.ropes || []).length; if (!n) return;
  const vine = world === 'jungle' || world === 'summit';
  const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6), mat = new THREE.MeshStandardMaterial({ color: vine ? 0x4a7a2a : 0x8a6a40, roughness: 0.9 });
  S.ropeMesh = new THREE.InstancedMesh(geo, mat, n * 24); S.ropeMesh.castShadow = true; S.ropeMesh.frustumCulled = false; grp.add(S.ropeMesh);
  for (const r of L.ropes) { // point d'attache : une branche ou une poutre
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.3), S.mat[vine ? 'darkwood' : 'wood']); beam.position.set(r.x, r.y + 0.15, r.z); beam.castShadow = true; grp.add(beam);
    if (vine && PACK.jungle?.leaf) { const l = place(PACK.jungle.leaf, grp, 1.4); if (l) l.position.set(r.x, r.y, r.z); }
  }
}
function winds(L, grp, th) {
  S.windViews = [];
  for (const w of L.winds || []) {
    if (w.water) { // cascade : nappe d'eau animée
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
        vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: NOISE + `varying vec2 vU; uniform float uT; void main(){ float n = fbm(vec2(vU.x*6., vU.y*3. + uT*2.6)); float s = smoothstep(0.35, 0.75, n);
          vec3 c = mix(vec3(0.55,0.8,0.95), vec3(0.95,1.,1.), s); float a = (0.45 + s*0.4) * smoothstep(0., 0.08, vU.x) * smoothstep(1., 0.92, vU.x); gl_FragColor = vec4(c, a); }` });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w.hw * 2, w.hh * 2), m); pl.position.set(w.x, w.y, w.z + (w.thin ? w.hd + 0.05 : 0)); grp.add(pl);
      const pl2 = pl.clone(); pl2.rotation.y = Math.PI / 2; pl2.scale.x = (w.hd * 2) / (w.hw * 2); if (!w.thin) grp.add(pl2);
      S.windViews.push({ w, mats: [m] }); continue;
    }
    // vent : traînées qui filent dans la direction du courant (visibles seulement quand il souffle)
    const N = 40, geo = new THREE.PlaneGeometry(0.06, 1), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; grp.add(im);
    const seeds = Array.from({ length: N }, (_, k) => [rnd(k, 1), rnd(k, 2), rnd(k, 3), 0.6 + rnd(k, 4)]);
    S.windViews.push({ w, im, seeds, mat });
  }
}

/* ------------------------------ particules d'ambiance ------------------------------ */
function particles(th) {
  if (S.amb) { S.scene.remove(S.amb); S.amb = null; }
  const kind = th.particles; if (!kind) return;
  const N = kind === 'snow' ? 700 : 260, pos = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) pos[i] = (Math.random() - 0.5) * 40;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const col = { snow: 0xffffff, leaves: 0x8fd060, petals: 0xffb0c8, dust: 0xc8b8a0, motes: 0xfff0c0, embers: 0xffa040, wind: 0xffffff }[kind];
  const m = new THREE.PointsMaterial({ color: col, size: kind === 'snow' ? 0.09 : kind === 'leaves' || kind === 'petals' ? 0.14 : 0.06, transparent: true, opacity: kind === 'wind' ? 0.35 : 0.8, depthWrite: false, map: S.glowTex, blending: kind === 'embers' ? THREE.AdditiveBlending : THREE.NormalBlending });
  S.amb = new THREE.Points(g, m); S.amb.frustumCulled = false; S.amb.userData.kind = kind; S.scene.add(S.amb);
}

/* ------------------------------ image ------------------------------ */
const HA = new THREE.Vector3(), HB = new THREE.Vector3();
export function update(W, dt, t) {
  for (const b of W.bodies) { // corps animés
    const m = S.bodyMesh[b.i]; if (!m) continue;
    m.position.set(b.px, b.py, b.pz); m.rotation.y = b.yaw;
    if (b.crumble) { const k = W.cr[b.i]; m.visible = k.s !== 2; if (k.s === 1) { m.position.x += (Math.random() - 0.5) * 0.06; m.position.z += (Math.random() - 0.5) * 0.06; } }
  }
  // chaînes des poutres suspendues et des contrepoids, rayons de la roue
  let n = 0;
  for (const i of S.hangs) {
    const b = W.bodies[i], len = b.hang || b.hammer, ends = b.hammer ? [0] : [-b.hw + 0.25, b.hw - 0.25];
    for (const ox of ends) { HA.set(b.x + ox, b.y + len, b.z); HB.set(b.px + ox * Math.cos(b.yaw), b.py + b.hh, b.pz); n = linkRow(S.hangLinks, n, HA, HB, i); }
  }
  for (const v of S.cwViews) { const b = W.bodies[v.b.i]; for (const ox of [-b.hw + 0.2, b.hw - 0.2]) { HA.set(b.px + ox, v.top, b.pz); HB.set(b.px + ox, b.py + b.hh, b.pz); n = linkRow(S.hangLinks, n, HA, HB, b.i); } }
  for (const wv of S.wheels) for (const id of wv.ids) { const b = W.bodies[id]; HA.set(wv.c.cx, wv.c.cy, b.pz - 1); HB.set(b.px, b.py, b.pz - 1); n = linkRow(S.hangLinks, n, HA, HB, id); }
  n = Mechs.links(W, n); Mechs.update(W, dt); Portal.update(W, dt, t); Totems.update(W, dt, t); Decor.update(dt);
  if (S.wv) try { n = S.wv.links?.(W, n, S.wa) ?? n; S.wv.update?.(W, dt, t, S.wa); } catch (e) { console.error(e); S.wv = null; } // une erreur d'un monde ne fige pas le jeu
  S.hangLinks.count = n; S.hangLinks.instanceMatrix.needsUpdate = true;
  for (const h of S.gearHubs) { const arm = W.bodies.find((x) => x.move?.k === 'orbit' && Math.abs(x.move.cx - h.b.x) < 0.1); if (arm) h.g.rotation.y = arm.yaw; }
  for (const g of S.bigGears) g.g.rotation.y += g.w * dt;
  for (const l of S.levers) { const on = !!W.sw[l.b.lever.id]; l.arm.rotation.z += ((on ? -0.7 : 0.7) - l.arm.rotation.z) * Math.min(1, dt * 8); l.g.material.color.setHex(on ? 0x80ff90 : 0xffc070); }
  for (const p of S.plates) p.r.material.color.setHex(W.sw[p.b.plate.id] ? 0x60ff80 : 0xff6040);
  // lianes : tendues vers la main de celui qui s'y tient, sinon pendantes avec un léger balancement
  if (S.ropeMesh) {
    let k = 0;
    W.level.ropes.forEach((r, i) => {
      const holder = W.pl.find((p) => p.st === 5 && p.rope?.i === i);
      HA.set(r.x, r.y, r.z);
      if (holder) HB.set(holder.x, holder.y + 1.95, holder.z); else { const a = Math.sin(t * 1.3 + i) * 0.08; HB.set(r.x + Math.sin(a) * r.len, r.y - Math.cos(a) * r.len, r.z); }
      const d = V2.copy(HB).sub(HA), L = d.length(), m = 12; d.normalize(); Q.setFromUnitVectors(UP, d);
      for (let s = 0; s < m; s++) { V.copy(HA).addScaledVector(d, (s + 0.5) * (L / m)); M4.compose(V, Q, SC.set(1, L / m, 1)); S.ropeMesh.setMatrixAt(k++, M4); }
    });
    S.ropeMesh.count = k; S.ropeMesh.instanceMatrix.needsUpdate = true; SC.set(1, 1, 1);
  }
  // vent et cascades
  for (const v of S.windViews) {
    if (v.mats) { for (const m of v.mats) m.uniforms.uT.value = t; continue; }
    const w = v.w, on = windOn(W, w), a = w.acc, al = Math.hypot(...a) || 1, dir = V2.set(a[0] / al, a[1] / al, a[2] / al);
    v.mat.opacity += ((on ? 0.45 : 0) - v.mat.opacity) * Math.min(1, dt * 6);
    Q.setFromUnitVectors(UP, dir);
    v.seeds.forEach((s, k) => {
      const ph = (s[0] + t * s[3] * (w.updraft ? 0.6 : 1.1)) % 1;
      const px = w.x + (s[1] * 2 - 1) * w.hw, py = w.y + (s[2] * 2 - 1) * w.hh, pz = w.z + (s[3] - 1.1) * w.hd;
      V.set(px, py, pz).addScaledVector(dir, (ph - 0.5) * 2 * (Math.abs(dir.x) * w.hw + Math.abs(dir.y) * w.hh + Math.abs(dir.z) * w.hd));
      M4.compose(V, Q, SC.set(1, 1 + al * 0.03, 1)); v.im.setMatrixAt(k, M4);
    });
    v.im.instanceMatrix.needsUpdate = true; SC.set(1, 1, 1);
  }
  // particules d'ambiance autour de la caméra
  if (S.amb) {
    const p = S.amb.geometry.attributes.position, c = S.cam.position, kind = S.amb.userData.kind, fall = kind === 'snow' ? 1.2 : kind === 'leaves' || kind === 'petals' ? 0.7 : kind === 'embers' ? -0.6 : 0.08;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i) - fall * dt, z = p.getZ(i);
      x += Math.sin(t * 0.7 + i) * dt * (kind === 'wind' ? 6 : 0.3);
      if (y < c.y - 20) y += 40; if (y > c.y + 20) y -= 40; if (x < c.x - 20) x += 40; if (x > c.x + 20) x -= 40; if (z < c.z - 30) z += 40; if (z > c.z + 10) z -= 40;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }
  for (const f of S.fires) { f.material.opacity = 0.75 + Math.sin(t * 23 + f.id) * 0.12 + Math.random() * 0.1; f.scale.setScalar(1.2 + Math.sin(t * 17 + f.id) * 0.12); }
}
