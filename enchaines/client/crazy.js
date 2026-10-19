// LES ENCHAÎNÉS — mode CRAZY, côté client : visée à la souris, caméra par-dessus l'épaule, fusil à verrou (Kar98k) tenu à deux mains,
// culasse et rechargement animés au rythme exact de la simulation, douilles, balles traçantes, sang, interface de combat.
// Ne décide RIEN : la simulation partagée (core/sim.js) tire, touche, tue ; ce module dessine ce qu'elle annonce (événements) et envoie la visée.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as Scene from './scene.js';
import * as Snd from './audio.js';
import { ST, P, inside, groundBelow, CZ, crazyEye, crazySpread, rightOf } from '../core/sim.js';
import { KAR, aimDir, rayBody } from '../core/weapon.js';

const S = Scene.S, clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k, sm = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const A = { yaw: 0, pitch: 0, scope: 0, zoom: 0 }; // visée du joueur local (la SEULE source de ay / ap envoyés)
export const cfg = { blood: true };
export const dbg = {};
const X = { on: false, W: null, G: null, me: null, rifles: [], aim: [], rec: [], feed: [], hitT: 0, hitHead: false, dmgT: 0, dmgAng: 0, banner: null, bannerT: 0, wasDead: false, camBack: 5.6, fov: 60, droplets: null, decals: [], pools: [], casings: [], tracers: [], puffs: [], mist: [], flashes: [], lastSnd: {} };
// RÉGLAGES DE LA CAMÉRA (une seule source) : la caméra est TOUJOURS sur le rayon de visée du tireur (épaule CZ.SHOULDER à droite, CZ.CAMUP au-dessus des yeux, définis dans
// core/sim.js car la balle part de ce rayon) ; ici : sa distance, son champ de vision et ses transitions.
export const CAM = { dist: 5.6, fov: 60, adsDist: 2.1, adsFov: 32, scopeFov: 15, zoomSpeed: 10, minDist: 1.1, adsSpeed: 9, inSpeed: 18, outSpeed: 2.2, wallMargin: 0.25 };

/* ------------------------------ textures procédurales ------------------------------ */
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
function splatTex(seed) { // éclaboussure : tache irrégulière, gouttes satellites étirées dans une direction, bords plus clairs (sang étalé fin) et cœur sombre
  return canvasTex(128, 128, (g, w, h) => {
    const cx = w / 2, cy = h / 2, dir = rnd(0, Math.PI * 2);
    g.shadowColor = 'rgba(60,0,0,0.9)'; g.shadowBlur = 3;
    const blob = (x, y, r, el, ang, a) => { g.save(); g.translate(x, y); g.rotate(ang); g.scale(1, el); g.beginPath(); const n = 14; for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2, rr = r * rnd(0.72, 1.18); const px = Math.cos(t) * rr, py = Math.sin(t) * rr; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.closePath();
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 1.15); gr.addColorStop(0, `rgba(44,0,2,${a})`); gr.addColorStop(0.6, `rgba(78,4,6,${a})`); gr.addColorStop(1, `rgba(118,10,12,${a * 0.85})`); g.fillStyle = gr; g.fill(); g.restore(); };
    blob(cx, cy, 15 + seed * 2, 0.8, dir, 0.97);
    for (let i = 0; i < 9 + seed; i++) { const d = dir + rnd(-0.55, 0.55), dd = rnd(16, 52); blob(cx + Math.cos(d) * dd, cy + Math.sin(d) * dd, rnd(1.5, 5.5), rnd(0.45, 1), d, rnd(0.8, 1)); }
    // traînées fines (gouttes projetées qui s'étirent)
    g.strokeStyle = 'rgba(70,4,6,0.9)'; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const d = dir + rnd(-0.4, 0.4); g.lineWidth = rnd(0.8, 2.2); g.beginPath(); g.moveTo(cx + Math.cos(d) * 18, cy + Math.sin(d) * 18); g.lineTo(cx + Math.cos(d) * rnd(34, 60), cy + Math.sin(d) * rnd(34, 60)); g.stroke(); }
  });
}
const holeTex = () => canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 1, 32, 32, 15); gr.addColorStop(0, 'rgba(8,6,5,1)'); gr.addColorStop(0.55, 'rgba(18,14,12,0.95)'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 15, 0, 7); g.fill();
  g.strokeStyle = 'rgba(25,22,18,0.7)'; g.lineWidth = 1; for (let i = 0; i < 9; i++) { const a = rnd(0, 7), r = rnd(10, 30); g.beginPath(); g.moveTo(32 + Math.cos(a) * 8, 32 + Math.sin(a) * 8); g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); g.stroke(); } });
const softTex = (rgb) => canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.45, `rgba(${rgb},0.5)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const flashTex = () => canvasTex(128, 128, (g) => { g.translate(64, 64); const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62); gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.25, 'rgba(255,214,120,0.9)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 22 : 62 * (i % 4 === 0 ? 1 : 0.7); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
let TX = null;
function textures() { return TX ||= { splat: [0, 1, 2, 3, 4, 5].map(splatTex), hole: holeTex(), smoke: softTex('210,210,205'), mist: softTex('150,6,8'), flash: flashTex(), spark: softTex('255,214,140') }; }

/* ------------------------------ fusil : modèle procédural (en attendant le Kar98k.glb) ------------------------------ */
// repère du fusil : +z vers la bouche, +y vers le haut, +x vers la GAUCHE du tireur ; origine = axe du canon, au niveau du boîtier de culasse.
// Longueur réelle du Kar98k : 1,11 m (crosse en z = −0,44, bouche en z = +0,67).
export const RIFLE = {
  org: 0.5, butt: -0.44, muzzle: 0.67,
  gripR: new THREE.Vector3(-0.045, -0.07, -0.135),   // main droite : poignée de la crosse, tout près de la détente
  gripL: new THREE.Vector3(0.0, -0.088, 0.28),       // main gauche : SOUS le garde-main de bois, dans sa partie avant, en retrait de la zone nue du canon
  pivot: new THREE.Vector3(0, 0.022, -0.12),         // axe de la culasse
  eject: new THREE.Vector3(-0.035, 0.03, -0.06),     // fenêtre d'éjection (côté droit)
  slideMax: 0.095, handleLen: 0.075,
  // orientation des mains DANS le repère du fusil : direction des doigts (du poignet vers le médius) et normale de la paume (vers l'objet saisi)
  R: { f: new THREE.Vector3(0.62, -0.62, 0.48), n: new THREE.Vector3(0.95, 0.25, 0.1) },
  L: { f: new THREE.Vector3(-0.92, 0.2, 0.34), n: new THREE.Vector3(0.05, 1, 0.05) },
};
// Kar98k réel (assets/weapons/kar98k.glb, en centimètres, canon vers +z, dessus +y, gauche du tireur +x). Même repère que ci-dessus ; origine = axe du canon, milieu du fusil.
// Mesures prises sur le modèle : crosse z −55,5 cm, bouche z +55,5 cm, axe du canon à y = 3,8 cm, poignet de crosse derrière le pontet (z ≈ −31 cm), fût en bois jusqu'à z ≈ +28 cm,
// lunette au-dessus du boîtier (z −28,7 … +6,5 cm), culasse Bolt_2 (tige + poignée) et percuteur Bolt_1 qui coulissent, détente séparée.
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const RIFLE_GLB = { org: 0.52, butt: -0.555, muzzle: 0.555, slideMax: 0.08, handleLen: 0.045,
  gripR: V3(-0.03, -0.083, -0.31), gripL: V3(0.0, -0.05, 0.15), eject: V3(-0.03, 0.0, -0.14), pivot: V3(0, 0, -0.12),
  R: { f: V3(0.6, -0.55, 0.55), n: V3(0.95, 0.2, 0.1) }, L: { f: V3(-0.92, 0.2, 0.3), n: V3(0.05, 1, 0.05) }, glb: true };
let GLB = null; const BORE_CM = { x: 0.17, y: 3.8 };
export async function load() { // appelé AVANT le départ (écran de chargement) : 53 Mo de textures PBR (3 × 4096² + 3 × 2048²), mises en cache par le navigateur
  if (GLB || GLB === false) return GLB;
  // kar98k_web.glb = le même modèle (mêmes 9 767 triangles, mêmes pièces, mêmes matériaux PBR) dont les textures 4096² sont en 2048² WebP (3 Mo au lieu de 53) — tools/lighten_glb.py ; l'original reste dans assets/weapons/kar98k.glb
  for (const f of ['kar98k_web.glb', 'kar98k.glb']) {
    try { const g = await new GLTFLoader().loadAsync(new URL('../assets/weapons/' + f, import.meta.url).href); GLB = g.scene; Object.assign(RIFLE, RIFLE_GLB); break; } catch (e) { console.warn(f + ' indisponible', e); }
  }
  if (!GLB) GLB = false;
  return GLB;
}
let MAT = null;
function mats() {
  return MAT ||= {
    wood: new THREE.MeshStandardMaterial({ color: 0x7b4a26, roughness: 0.52, metalness: 0.0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x4d2c15, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.38, metalness: 0.85 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3, metalness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xcfa13e, roughness: 0.28, metalness: 1.0 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xa65a2c, roughness: 0.35, metalness: 0.9 }),
    blood: new THREE.MeshStandardMaterial({ color: 0x5a0508, roughness: 0.16, metalness: 0.0 }),
  };
}
function buildClip(M) {
  const clip = new THREE.Group(); clip.visible = false;
  clip.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.085), M.steel), { castShadow: true }));
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0068, 0.056, 8), M.brass); c.position.set(0, 0.034, -0.034 + i * 0.017); clip.add(c); const t = new THREE.Mesh(new THREE.ConeGeometry(0.0062, 0.02, 8), M.copper); t.position.set(0, 0.072, -0.034 + i * 0.017); clip.add(t); }
  return clip;
}
// le vrai Kar98k : pièces mobiles repérées par leur nom dans le modèle (Bolt_2 = tige + poignée de culasse, Bolt_1 = percuteur, Trigger = détente)
function buildGlbRifle() {
  const M = mats(), g = new THREE.Group(), model = new THREE.Group(); g.add(model);
  const wrap = new THREE.Group(); wrap.scale.setScalar(0.01); const root = GLB.clone(true); wrap.add(root); model.add(wrap); g.updateMatrixWorld(true);
  const find = (n) => { let r = null; root.traverse((o) => { if (o.isMesh && o.name.startsWith(n)) r = o; }); return r; };
  const b2 = find('Kar98k_Bolt_2'), b1 = find('Kar98k_Bolt_1'), trig = find('Kar98k_Trigger');
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (m[k]) m[k].anisotropy = 8; } });
  const out = { g, model, clip: buildClip(M), boltOpen: 0, handleA: -0.7, ax: 0, ay: 0, ball0: new THREE.Vector3(), lift: 0, slideZ: 0 };
  if (b2 && b1) {
    // axe de la culasse mesuré dans la géométrie : centre des sommets de la tige seule (z ∈ [−12, −6] cm) ; boule de la poignée = sommet le plus éloigné de l'axe
    const pos = b2.geometry.attributes.position, v = new THREE.Vector3(); let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(b2.matrixWorld); if (v.z > -0.12 && v.z < -0.06) { sx += v.x; sy += v.y; n++; } }
    out.ax = n ? sx / n : 0; out.ay = n ? sy / n : 0.048; let best = 0;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(b2.matrixWorld); const d = Math.hypot(v.x - out.ax, v.y - out.ay); if (d > best) { best = d; out.ball0.copy(v); } }
    const slide = new THREE.Group(), rot = new THREE.Group(); model.add(slide); rot.position.set(out.ax, out.ay, 0); slide.add(rot); model.updateMatrixWorld(true); rot.attach(b2); slide.attach(b1);
    out.slide = slide; out.rot = rot;
  }
  if (trig) { const tg = new THREE.Group(); model.add(tg); tg.position.set(0, -0.012, -0.205); model.updateMatrixWorld(true); tg.attach(trig); out.trig = tg; }
  model.position.set(-BORE_CM.x * 0.01, -BORE_CM.y * 0.01, 0); // l'axe du canon passe par l'origine du repère du fusil
  out.clip.position.set(0, 0, 0); g.add(out.clip); g.matrixAutoUpdate = false;
  out.setBolt = (a, s) => { // a : −0,7 (rabattue) … +1,3 (relevée à 90°) ; s : 0 … 1 (course arrière de la culasse)
    out.lift = clamp((a + 0.7) / 2.0, 0, 1) * 1.6; out.slideZ = s; if (out.rot) { out.rot.rotation.z = -out.lift; out.slide.position.z = -s * RIFLE.slideMax; }
  };
  out.ball = (o) => { const dx = out.ball0.x - out.ax, dy = out.ball0.y - out.ay, c = Math.cos(-out.lift), sn = Math.sin(-out.lift);
    return o.set(out.ax + dx * c - dy * sn - BORE_CM.x * 0.01, out.ay + dx * sn + dy * c - BORE_CM.y * 0.01, out.ball0.z - out.slideZ * RIFLE.slideMax); };
  out.trigger = (k) => { if (out.trig) out.trig.position.z = -0.205 - 0.004 * k; };
  return out;
}
function buildRifle() {
  if (GLB) return buildGlbRifle();
  const M = mats(), g = new THREE.Group(), box = (w, h, d, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o; };
  const cyl = (r, len, m, x, y, z, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // crosse et fût (bois)
  box(0.044, 0.118, 0.17, M.wood, 0, -0.05, -0.355, 0.1); box(0.046, 0.012, 0.012, M.steel, 0, -0.05, -0.443, 0).scale.set(1, 9, 1); // plaque de couche
  box(0.04, 0.078, 0.2, M.wood, 0, -0.04, -0.205); box(0.036, 0.072, 0.095, M.wood, 0, -0.07, -0.13, -0.3);
  box(0.04, 0.058, 0.5, M.wood, 0, -0.03, 0.29); box(0.034, 0.022, 0.32, M.dark, 0, 0.012, 0.38); // fût + garde-main supérieur
  // métal : boîtier, canon, hausse, guidon
  box(0.037, 0.042, 0.2, M.steel, 0, 0.004, -0.06); cyl(0.0108, 0.62, M.blue, 0, 0.012, 0.36, 12); cyl(0.0125, 0.03, M.steel, 0, 0.012, 0.66, 12);
  box(0.006, 0.02, 0.006, M.steel, 0, 0.034, 0.655); box(0.022, 0.016, 0.03, M.steel, 0, 0.034, 0.12);
  box(0.03, 0.02, 0.1, M.steel, 0, -0.082, -0.02); // plaque de fond de magasin
  box(0.004, 0.012, 0.075, M.steel, 0, -0.078, -0.115); box(0.004, 0.05, 0.004, M.steel, 0, -0.056, -0.075).rotation.x = 0.3; // pontet + détente
  // culasse : corps cylindrique qui coulisse en z, poignée (tige + boule) qui pivote
  const slide = new THREE.Group(); slide.position.copy(RIFLE.pivot); g.add(slide);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.11, 10), M.steel); bolt.rotation.x = Math.PI / 2; bolt.position.set(0, 0, -0.01); bolt.castShadow = true; slide.add(bolt);
  const handle = new THREE.Group(); handle.position.set(0, 0, -0.045); slide.add(handle);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, RIFLE.handleLen, 8), M.steel); stem.rotation.z = Math.PI / 2; stem.position.x = -RIFLE.handleLen / 2; stem.castShadow = true; handle.add(stem);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 10, 8), M.steel); ball.position.x = -RIFLE.handleLen; ball.castShadow = true; handle.add(ball);
  // lame-chargeur (visible seulement pendant le rechargement) : support laiton + cinq cartouches
  const clip = new THREE.Group(); clip.visible = false; g.add(clip);
  clip.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.085), M.steel), { castShadow: true }));
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0068, 0.056, 8), M.brass); c.position.set(0, 0.034, -0.034 + i * 0.017); clip.add(c); const t = new THREE.Mesh(new THREE.ConeGeometry(0.0062, 0.02, 8), M.copper); t.position.set(0, 0.072, -0.034 + i * 0.017); clip.add(t); }
  g.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  g.matrixAutoUpdate = false;
  const r = { g, slide, handle, clip, boltOpen: 0, handleA: -0.7 };
  r.setBolt = (a, s) => { handleAngle(r, a); r.slide.position.z = RIFLE.pivot.z - s * RIFLE.slideMax; };
  r.ball = (o) => ballLocal(r, o); r.trigger = () => {};
  return r;
}
// la poignée de culasse : angle a (−0,7 = rabattue vers le bas et l'arrière, +1,3 = relevée) ; la tige part vers le côté DROIT (−x)
const handleAngle = (r, a) => { r.handleA = a; r.handle.rotation.z = -a; };
// position fusil-locale de la boule de la poignée
function ballLocal(r, out) { const a = r.handleA; return out.set(RIFLE.pivot.x - Math.cos(a) * RIFLE.handleLen, RIFLE.pivot.y + Math.sin(a) * RIFLE.handleLen, RIFLE.pivot.z - 0.045 + r.slide.position.z - RIFLE.pivot.z); }

/* ------------------------------ entrées ------------------------------ */
export function look(dx, dy, sens = 1) {
  if (Math.abs(dx) > 220 || Math.abs(dy) > 220) return; // saut de souris à la capture du pointeur : ignoré (sinon la visée part d'un coup au plafond)
  const z = 1 - A.scope * 0.4 - A.zoom * 0.5; // plus la visée est serrée, plus la souris est lente
  A.yaw = wrap(A.yaw - dx * 0.0024 * sens * z); A.pitch = clamp(A.pitch - dy * 0.002 * sens * z, -1.25, 1.35);
}
// champs de l'entrée propres au mode : tir (clic gauche), lunette (clic droit), rechargement (R), visée
export function extras(keys) {
  const q = (v) => Math.round(v * 1000) / 1000;
  return { fire: keys.has('Mouse0'), scope: keys.has('Mouse2'), reload: keys.has('KeyR'), ay: q(A.yaw), ap: q(A.pitch) };
}
// direction de déplacement : « avant » = là où l'on vise (le cap de la caméra du jeu est l'opposé du regard)
export const moveYaw = () => A.yaw + Math.PI;

/* ------------------------------ mise en place ------------------------------ */
export function begin(G) {
  stop(); const W = G.W, T = textures();
  X.on = true; X.W = W; X.G = G; X.me = G.me; X.feed = []; X.wasDead = false; X.banner = null; X.hitT = 0; X.dmgT = 0; X.camBack = CAM.dist; X.backS = null;
  const p = W.pl[G.me ?? 0]; if (p) { A.yaw = p.ay ?? p.yaw; A.pitch = 0; } A.scope = 0;
  X.root = new THREE.Group(); S.scene.add(X.root);
  X.rifles = W.pl.map(() => { const r = buildRifle(); X.root.add(r.g); r.g.visible = false; return r; });
  X.aim = W.pl.map((q) => ({ yaw: q.ay ?? q.yaw, pitch: 0 })); X.rec = W.pl.map(() => 0); X.arm = W.pl.map(() => ({ ok: false }));
  // gouttes de sang : une seule maille instanciée (peu coûteuse), physique simple ; décors : plans pré-alloués réutilisés en anneau
  const N = 420; X.drops = { n: N, im: new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), mats().blood, N), v: new Float32Array(N * 3), p: new Float32Array(N * 3), s: new Float32Array(N), life: new Float32Array(N), live: 0 };
  X.drops.im.frustumCulled = false; X.drops.im.count = 0; X.drops.im.castShadow = false; X.root.add(X.drops.im);
  const M4 = new THREE.Matrix4(); for (let i = 0; i < N; i++) { X.drops.life[i] = 0; X.drops.im.setMatrixAt(i, M4.makeScale(0, 0, 0)); }
  X.decalMat = T.splat.map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.2, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  X.holeMat = new THREE.MeshBasicMaterial({ map: T.hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  X.decalGeo = new THREE.PlaneGeometry(1, 1); X.decalI = 0; X.decals = [];
  X.light = new THREE.PointLight(0xffb468, 0, 14, 2); X.light.castShadow = false; X.root.add(X.light); // allumée un instant à chaque tir (existe dès le départ : pas de recompilation des ombres)
  X.hold = { flashes: [] };
  buildHud(G);
  $('#cz').classList.add('on'); $('#cz-keys').classList.add('show'); clearTimeout(X.keysT); X.keysT = setTimeout(() => $('#cz-keys').classList.remove('show'), 9000);
}
export function stop() {
  if (!X.on) return; X.on = false;
  if (X.root) { S.scene.remove(X.root); X.root.traverse((o) => { if (o.geometry && !o.userData.keep) o.geometry.dispose?.(); }); X.root = null; }
  for (const c of X.casings) S.scene.remove(c.o); for (const t of X.tracers) S.scene.remove(t.o); for (const p of X.puffs) S.scene.remove(p.o); for (const p of X.mist) S.scene.remove(p.o);
  X.casings = []; X.tracers = []; X.puffs = []; X.mist = []; X.decals = []; X.pools = []; X.rifles = [];
  if (S.cam) { S.cam.fov = 52; S.cam.updateProjectionMatrix(); }
  for (const c of S.cl || []) { c.g.visible = true; if (!c.charId) for (const b of Object.values(c.bones)) b?.scale.set(1, 1, 1); }
  $('#cz')?.classList.remove('on');
}
export const active = () => X.on;

/* ------------------------------ interface ------------------------------ */
function buildHud(G) {
  let r = $('#cz'); if (!r) { r = document.createElement('div'); r.id = 'cz'; document.body.appendChild(r); }
  r.innerHTML = `
  <div id="cz-vig"></div><div id="cz-low"></div><div id="cz-prot"></div>
  <div id="cz-top"><div id="cz-timer">5:00</div><div id="cz-goal"></div></div>
  <ol id="cz-score"></ol>
  <ul id="cz-feed"></ul>
  <div id="cz-cross"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i><b></b></div>
  <div id="cz-hit"><i></i><i></i><i></i><i></i></div>
  <div id="cz-scope"><svg viewBox="-100 -100 200 200" preserveAspectRatio="xMidYMid meet"><circle r="98" fill="none" stroke="#000" stroke-width="3"/><line x1="-98" y1="0" x2="-6" y2="0"/><line x1="6" y1="0" x2="98" y2="0"/><line x1="0" y1="-98" x2="0" y2="-6"/><line x1="0" y1="6" x2="0" y2="98"/>
    <g class="dots"><circle cx="-20" r=".7"/><circle cx="-40" r=".7"/><circle cx="-60" r=".7"/><circle cx="20" r=".7"/><circle cx="40" r=".7"/><circle cx="60" r=".7"/><circle cy="20" r=".7"/><circle cy="40" r=".7"/><circle cy="60" r=".7"/></g><circle r=".9" fill="#e33"/></svg></div>
  <div id="cz-dmg"><i></i></div>
  <div id="cz-ammo"><div class="rounds"></div><div class="state"></div><div class="bar"><i></i></div></div>
  <div id="cz-hp"><b>100</b><div><i></i></div></div>
  <div id="cz-dead"><small></small><b></b><em></em></div>
  <div id="cz-banner"></div>
  <div id="cz-tags"></div>
  <div id="cz-keys"><b>Mode Crazy</b><span><kbd>Souris</kbd> viser</span><span><kbd>Clic gauche</kbd> tirer</span><span><kbd>Clic droit</kbd> viser · maintenu : lunette ×4</span><span><kbd>R</kbd> recharger</span><span><kbd>Espace</kbd> sauter · contre un mur : re-saut</span><span><kbd>V</kbd> glisser</span><span><kbd>Tab</kbd> scores</span></div>
  <div id="cz-board"></div>`;
  X.tagEls = G.W.pl.map((_, k) => { const e = document.createElement('div'); e.className = 'czt t' + k; $('#cz-tags').appendChild(e); return e; });
  X.rounds = [...Array(KAR.AMMO)].map(() => { const e = document.createElement('i'); $('#cz-ammo .rounds').appendChild(e); return e; });
  if (!$('#cz-css')) { const s = document.createElement('style'); s.id = 'cz-css'; s.textContent = CSS; document.head.appendChild(s); }
}
const CSS = `
#cz{position:fixed;inset:0;pointer-events:none;display:none;z-index:6;font-family:'Grenze','Trebuchet MS',sans-serif;color:#f3e9d2;text-shadow:0 2px 0 #000,0 0 8px rgba(0,0,0,.8)}
#cz.on{display:block}
#cz-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(150,0,0,.0) 60%,rgba(150,0,0,.85) 100%);opacity:0;transition:opacity .08s}
#cz-low{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(120,0,0,.55) 100%);opacity:0}
#cz-prot{position:absolute;inset:0;box-shadow:inset 0 0 90px rgba(80,170,255,.45);opacity:0}
#cz-top{position:absolute;left:50%;top:10px;transform:translateX(-50%);text-align:center}
#cz-timer{font:800 32px 'Grenze';font-variant-numeric:tabular-nums;padding:4px 20px;border-radius:4px;background:rgba(10,8,6,.6)}
#cz-goal{font:700 14px 'Grenze';color:#e8c98a;margin-top:2px}
#cz-score{position:absolute;left:16px;top:12px;margin:0;padding:0;list-style:none;font:700 16px 'Grenze';min-width:190px}
#cz-score li{display:flex;gap:8px;align-items:center;padding:3px 10px;margin-bottom:3px;border-radius:3px;background:rgba(10,8,6,.55)}
#cz-score li.me{background:rgba(120,80,20,.6)} #cz-score li i{width:10px;height:10px;border-radius:50%} #cz-score li span{flex:1} #cz-score li b{font-size:19px;font-variant-numeric:tabular-nums}
#cz-feed{position:absolute;right:16px;top:12px;margin:0;padding:0;list-style:none;font:700 16px 'Grenze';text-align:right}
#cz-feed li{margin-bottom:4px;padding:3px 10px;border-radius:3px;background:rgba(10,8,6,.62);animation:czin .2s;display:flex;gap:8px;justify-content:flex-end;align-items:center}
#cz-feed li.me{outline:1px solid #e0b25a} #cz-feed li em{font-style:normal;color:#ff6b5a} #cz-feed li b{font-weight:800}
@keyframes czin{from{transform:translateX(30px);opacity:0}to{transform:none;opacity:1}}
#cz-cross{position:absolute;left:50%;top:50%;width:0;height:0}
#cz-cross i{position:absolute;background:#fff;box-shadow:0 0 3px #000;opacity:.92} #cz-cross b{position:absolute;left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 3px #000}
#cz-cross .u,#cz-cross .d{width:2px;height:9px;left:-1px} #cz-cross .l,#cz-cross .r{height:2px;width:9px;top:-1px}
#cz-hit{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;transition:opacity .06s}
#cz-hit i{position:absolute;width:3px;height:11px;background:#fff;box-shadow:0 0 4px #000;left:-1.5px;top:-5px} #cz-hit i:nth-child(1){transform:rotate(45deg) translateY(-12px)} #cz-hit i:nth-child(2){transform:rotate(-45deg) translateY(-12px)} #cz-hit i:nth-child(3){transform:rotate(135deg) translateY(-12px)} #cz-hit i:nth-child(4){transform:rotate(-135deg) translateY(-12px)}
#cz-hit.head i{background:#ff3b30}
#cz-scope{position:absolute;inset:0;opacity:0;background:radial-gradient(circle at center,transparent 0,transparent calc(min(50vh,50vw) - 6px),#000 calc(min(50vh,50vw) - 1px));}
#cz-scope svg{position:absolute;left:50%;top:50%;width:min(100vh,100vw);height:min(100vh,100vw);transform:translate(-50%,-50%);stroke:#000;stroke-width:.6;fill:#000;filter:none}
#cz-dmg{position:absolute;left:50%;top:50%;width:0;height:0} #cz-dmg i{position:absolute;left:-60px;top:-150px;width:120px;height:46px;border-radius:50%/100% 100% 0 0;background:radial-gradient(ellipse at 50% 100%,rgba(255,30,20,.85),transparent 70%);opacity:0}
#cz-ammo{position:absolute;right:26px;bottom:24px;text-align:right}
#cz-ammo .rounds{display:flex;gap:5px;justify-content:flex-end} #cz-ammo .rounds i{width:11px;height:44px;border-radius:5px 5px 2px 2px;background:linear-gradient(#e8b45a,#a8742a 55%,#8a5a20);box-shadow:0 2px 0 #000,inset 0 3px 0 #ffe6a8;transition:opacity .1s,transform .1s} #cz-ammo .rounds i.off{opacity:.18;transform:translateY(5px)}
#cz-ammo .state{font:800 15px 'Grenze';margin-top:6px;letter-spacing:.06em;color:#e8c98a;min-height:18px} #cz-ammo .state.warn{color:#ff6b5a}
#cz-ammo .bar{height:5px;width:130px;margin:4px 0 0 auto;background:rgba(0,0,0,.5);border-radius:3px;overflow:hidden} #cz-ammo .bar i{display:block;height:100%;width:0;background:#e8c98a}
#cz-hp{position:absolute;left:26px;bottom:24px;min-width:230px} #cz-hp b{font:800 40px 'Grenze';font-variant-numeric:tabular-nums} #cz-hp div{height:9px;border-radius:5px;background:rgba(0,0,0,.55);overflow:hidden;box-shadow:0 2px 0 #000} #cz-hp i{display:block;height:100%;width:100%;background:linear-gradient(#e5483a,#a31d14)}
#cz-dead{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;opacity:0} #cz-dead small{display:block;font:700 18px 'Grenze';color:#e8c98a;letter-spacing:.2em} #cz-dead b{display:block;font:900 54px 'Grenze Gotisch','Grenze';color:#d83a2c} #cz-dead em{font:700 22px 'Grenze';font-style:normal}
#cz-banner{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%) scale(1);font:900 40px 'Grenze Gotisch','Grenze';letter-spacing:.08em;color:#ffd27a;opacity:0}
#cz-banner.on{animation:czban 1.6s forwards} @keyframes czban{0%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}12%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0}}
#cz-tags .czt{position:absolute;left:0;top:0;font:800 15px 'Grenze';padding:1px 8px;border-radius:3px;background:rgba(10,8,6,.55);white-space:nowrap;display:none}
#cz-tags .czt u{display:block;height:3px;margin-top:2px;background:#e5483a;text-decoration:none;border-radius:2px}
#cz-keys{position:absolute;left:50%;bottom:92px;transform:translateX(-50%);display:none;gap:14px;padding:8px 16px;border-radius:5px;background:rgba(10,8,6,.7);font:600 15px 'Grenze';flex-wrap:wrap;justify-content:center;max-width:90vw}
#cz-keys.show{display:flex} #cz-keys b{color:#ffd27a} #cz-keys kbd{padding:1px 7px;border-radius:3px;background:#3a3026;border:1px solid #8a6a3a;font:700 13px 'Grenze'}
#cz-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:360px;padding:14px 20px;border-radius:6px;background:rgba(10,8,6,.82);display:none} #cz-board.on{display:block} #cz-board table{width:100%;border-collapse:collapse;font:700 18px 'Grenze'} #cz-board td,#cz-board th{padding:4px 10px;text-align:right} #cz-board td:first-child,#cz-board th:first-child{text-align:left}
body.czmode #hud, body.czmode #help{display:none!important}
`;
const colOf = (k) => '#' + (Scene.COL[k] ?? 0xffffff).toString(16).padStart(6, '0');
function pushFeed(html, mine) { X.feed.push({ html, mine, t: 6 }); if (X.feed.length > 6) X.feed.shift(); renderFeed(); }
function renderFeed() { $('#cz-feed').innerHTML = X.feed.map((f) => `<li class="${f.mine ? 'me' : ''}">${f.html}</li>`).join(''); }
const nameOf = (k) => esc(X.G.names[k] || 'Tireur ' + (k + 1));

/* ------------------------------ événements ------------------------------ */
const pan = (x, y, z) => { const s = Scene.project(x, y, z); return clamp((s.x / innerWidth) * 2 - 1, -0.9, 0.9); };
const camDist = (x, y, z) => Math.hypot(S.cam.position.x - x, S.cam.position.y - y, S.cam.position.z - z);
export function onEvent(W, e, G) {
  if (!X.on) return;
  const mine = e.p === X.me, T = textures();
  switch (e.k) {
    case 'shot': {
      const d = mine ? 0 : camDist(e.x, e.y, e.z), r = X.rifles[e.p];
      Snd.gun('shot', { dist: d, pan: mine ? 0 : pan(e.x, e.y, e.z), v: mine ? 1 : 0.95 });
      if (r?.muz) e = { ...e, x: r.muz.x, y: r.muz.y, z: r.muz.z }; // la flamme et la balle partent de la bouche du vrai canon
      muzzleFx(e); tracer(e);
      if (r) X.rec[e.p] = 1;
      if (mine) { A.pitch = clamp(A.pitch + 0.026, -1.25, 1.35); A.yaw = wrap(A.yaw + rnd(-0.003, 0.003)); Scene.shake(0.12); } else if (d < 60) Scene.shake(Math.max(0, 0.05 - d * 0.0008));
      if (e.kind === 1) impactFx(W, e);
      if (!mine) whiz(e);
      break;
    }
    case 'bolt': { const p = W.pl[e.p]; if (e.s !== 'eject' && p) Snd.gun('bolt_' + e.s, { dist: mine ? 0 : camDist(p.x, p.y + 1.4, p.z), pan: mine ? 0 : pan(p.x, p.y + 1.4, p.z), v: 0.8, wet: 0.2 }); break; }
    case 'reload': { const p = W.pl[e.p]; if (p) Snd.gun('rl_' + e.s, { dist: mine ? 0 : camDist(p.x, p.y + 1.4, p.z), pan: mine ? 0 : pan(p.x, p.y + 1.4, p.z), v: 0.85, wet: 0.2 }); break; }
    case 'dry': { const p = W.pl[e.p]; if (p) Snd.gun('dry', { dist: mine ? 0 : camDist(p.x, p.y + 1.4, p.z), pan: mine ? 0 : pan(p.x, p.y + 1.4, p.z), v: 0.8, wet: 0.1 }); break; }
    case 'casing': spawnCasing(e); break;
    case 'dmg': {
      const head = e.zone === 2, v = e.v;
      bloodFx(W, e);
      Snd.gun(head ? 'bone' : 'flesh', { dist: camDist(e.x, e.y, e.z), pan: pan(e.x, e.y, e.z), v: 0.9, wet: 0.1 });
      if (mine) { X.hitT = 0.28; X.hitHead = head; Snd.gun('hitmark', { head, v: 0.8, wet: 0 }); }
      if (v === X.me) {
        X.dmgT = 0.7; const s = W.pl[e.p], me = W.pl[v];
        if (s && me) { const ang = Math.atan2(s.x - me.x, s.z - me.z); X.dmgAng = wrap(ang - A.yaw); }
        Scene.shake(head ? 0.5 : 0.3); if (e.hp > 0 && head) Snd.gun('ringing', { wet: 0, v: 1 });
      }
      break;
    }
    case 'kill': {
      const v = W.pl[e.v]; if (!v) break;
      pushFeed(`<b style="color:${colOf(e.p)}">${e.p >= 0 ? nameOf(e.p) : ''}</b> ${e.p >= 0 ? '<em>⌖</em>' : '<em>☠</em>'}${e.head ? ' <em>◉</em>' : ''} <b style="color:${colOf(e.v)}">${nameOf(e.v)}</b>`, e.p === X.me || e.v === X.me);
      if (e.head) bloodBurst(W, { x: e.x, y: e.y + 0.55, z: e.z, dx: e.dx, dy: e.dy, dz: e.dz, zone: 2 }, 1.4);
      Snd.gun('fall', { dist: camDist(v.x, v.y, v.z), pan: pan(v.x, v.y + 1, v.z), v: 0.9 });
      startPool(W, v, e);
      if (e.p === X.me && e.v !== X.me) { X.banner = e.head ? 'TIR À LA TÊTE' : 'ÉLIMINÉ'; Snd.gun('kill', { wet: 0, v: 1 }); const b = $('#cz-banner'); b.textContent = X.banner; b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); }
      if (e.v === X.me) X.killer = e.p;
      break;
    }
    case 'spawn': {
      if (e.p === X.me) { const p = W.pl[e.p]; A.yaw = p.ay ?? A.yaw; A.pitch = 0; A.scope = 0; }
      for (let i = 0; i < 14; i++) puffAt(e.x + rnd(-0.4, 0.4), e.y + rnd(0.1, 1.8), e.z + rnd(-0.4, 0.4), 0x9fd0ff, 0.5, rnd(0.5, 1), 0.6, rnd(-0.4, 0.4), rnd(0.5, 1.6), rnd(-0.4, 0.4));
      Snd.play('respawn', { pan: mine ? 0 : pan(e.x, e.y + 1, e.z) });
      break;
    }
    case 'jump': if (e.wall) { for (let i = 0; i < 6; i++) puffAt(e.x - (e.nx || 0) * 0.3, e.y + 0.9, e.z - (e.nz || 0) * 0.3, 0xd0c4b0, 0.4, 0.5, 0.7, (e.nx || 0) * rnd(0.5, 2) + rnd(-0.5, 0.5), rnd(0, 1.2), (e.nz || 0) * rnd(0.5, 2) + rnd(-0.5, 0.5)); Snd.play('grab', { pan: mine ? 0 : pan(e.x, e.y + 1, e.z) }); } break;
  }
}
function whiz(e) { // une balle qui passe tout près de la caméra : sifflement
  const c = S.cam.position, dx = e.ex - e.x, dy = e.ey - e.y, dz = e.ez - e.z, L2 = dx * dx + dy * dy + dz * dz || 1;
  const u = clamp(((c.x - e.x) * dx + (c.y - e.y) * dy + (c.z - e.z) * dz) / L2, 0, 1), px = e.x + dx * u, py = e.y + dy * u, pz = e.z + dz * u, d = Math.hypot(c.x - px, c.y - py, c.z - pz);
  if (d < 4.5 && u > 0.05) setTimeout(() => Snd.gun('whiz', { pan: pan(px, py, pz), v: 1 - d / 5, wet: 0.1 }), Math.min(200, camDist(e.x, e.y, e.z) / 4));
}

/* ------------------------------ effets : bouche, balle, impacts, fumée ------------------------------ */
function puffAt(x, y, z, col, size, life, op, vx, vy, vz, grow = 1.6) {
  if (X.puffs.length > 140) { const o = X.puffs.shift(); S.scene.remove(o.o); }
  const T = textures(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, color: col, transparent: true, depthWrite: false, opacity: op })); s.position.set(x, y, z); s.scale.setScalar(size); S.scene.add(s);
  X.puffs.push({ o: s, t: 0, life, op, v: new THREE.Vector3(vx, vy, vz), grow, size });
}
function muzzleFx(e) {
  const T = textures(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flash, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, rotation: rnd(0, 6) }));
  s.position.set(e.x, e.y, e.z); s.scale.setScalar(rnd(0.9, 1.3)); S.scene.add(s); X.flashes.push({ o: s, t: 0, life: 0.07 });
  X.light.position.set(e.x + e.dx * 0.3, e.y + e.dy * 0.3, e.z + e.dz * 0.3); X.lightT = 0.08;
  for (let i = 0; i < 5; i++) puffAt(e.x + e.dx * rnd(0, 0.4), e.y + e.dy * rnd(0, 0.4), e.z + e.dz * rnd(0, 0.4), 0xcfcfca, rnd(0.25, 0.5), rnd(1.2, 2.2), 0.4, e.dx * rnd(0.5, 2.5) + rnd(-0.3, 0.3), rnd(0.1, 0.6), e.dz * rnd(0.5, 2.5) + rnd(-0.3, 0.3));
}
function tracer(e) {
  const len = Math.hypot(e.ex - e.x, e.ey - e.y, e.ez - e.z); if (len < 1) return;
  const g = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 1), new THREE.MeshBasicMaterial({ color: 0xffe3a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.frustumCulled = false; S.scene.add(g);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.x, e.y, e.z), new THREE.Vector3(e.ex, e.ey, e.ez)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false })); S.scene.add(line);
  X.tracers.push({ o: g, line, t: 0, life: len / 900 + 0.02, fade: 0.45, a: new THREE.Vector3(e.x, e.y, e.z), b: new THREE.Vector3(e.ex, e.ey, e.ez), len });
}
function impactFx(W, e) {
  const n = new THREE.Vector3(e.nx, e.ny, e.nz), ex = e.ex + e.nx * 0.01, ey = e.ey + e.ny * 0.01, ez = e.ez + e.nz * 0.01;
  decal(X.holeMat, ex, ey, ez, n, rnd(0.07, 0.1), rnd(0, 6), 1);
  for (let i = 0; i < 6; i++) puffAt(ex, ey, ez, 0xbfb29c, rnd(0.2, 0.4), rnd(0.5, 1), 0.5, e.nx * rnd(0.5, 2) + rnd(-0.8, 0.8), e.ny * rnd(0.5, 2) + rnd(0, 1.2), e.nz * rnd(0.5, 2) + rnd(-0.8, 0.8));
  const T = textures(); for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.spark, color: 0xffd890, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.position.set(ex, ey, ez); s.scale.setScalar(0.12); S.scene.add(s);
    X.mist.push({ o: s, t: 0, life: rnd(0.2, 0.4), v: new THREE.Vector3(e.nx * rnd(1, 5) + rnd(-3, 3), e.ny * rnd(1, 5) + rnd(0, 3), e.nz * rnd(1, 5) + rnd(-3, 3)), g: 12, grow: 0.3, op: 1, spark: true }); }
  const d = camDist(ex, ey, ez); if (d < 80) Snd.gun('impact', { dist: d, pan: pan(ex, ey, ez), v: 0.8, wet: 0.15, metal: Math.random() < 0.3 });
}
function decal(mat, x, y, z, n, size, rot, hole) {
  const m = new THREE.Mesh(X.decalGeo, mat); m.position.set(x, y, z); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); m.rotateZ(rot); m.scale.setScalar(size); m.frustumCulled = false; m.renderOrder = 2;
  X.root.add(m); X.decals.push({ o: m, t: 0 }); const max = 170; if (X.decals.length > max) { const o = X.decals.shift(); X.root.remove(o.o); }
  return m;
}

/* ------------------------------ douilles ------------------------------ */
function spawnCasing(e) {
  const M = mats(), g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.056, 10), M.brass), neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0058, 0.0085, 0.014, 10), M.brass), mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.004, 10), M.steel), rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0108, 0.0108, 0.003, 10), M.brass);
  neck.position.y = 0.035; mouth.position.y = 0.044; rim.position.y = -0.0275; g.add(body, neck, mouth, rim); g.scale.setScalar(1.7); // un peu plus grosse que nature : sinon invisible à trois mètres
  g.position.set(e.x, e.y, e.z); g.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); S.scene.add(g);
  if (X.casings.length > 36) { const o = X.casings.shift(); S.scene.remove(o.o); }
  X.casings.push({ o: g, v: new THREE.Vector3(e.vx, e.vy, e.vz), w: new THREE.Vector3(rnd(-18, 18), rnd(-18, 18), rnd(-18, 18)), t: 0, rest: false, bounces: 0 });
}
function stepCasings(W, dt) {
  for (let i = X.casings.length - 1; i >= 0; i--) {
    const c = X.casings[i], o = c.o; c.t += dt;
    if (c.rest) { if (c.t > 16) { o.scale.multiplyScalar(1 - dt * 3); if (o.scale.x < 0.05) { S.scene.remove(o); X.casings.splice(i, 1); } } continue; }
    c.v.y -= 9.8 * dt; o.position.addScaledVector(c.v, dt); o.rotation.x += c.w.x * dt; o.rotation.y += c.w.y * dt; o.rotation.z += c.w.z * dt;
    const g = groundBelow(W, o.position.x, o.position.y + 0.05, o.position.z, 1.2);
    if (g && o.position.y <= g.y + 0.012 && c.v.y < 0) {
      o.position.y = g.y + 0.012; c.bounces++;
      if (c.bounces === 1 || Math.abs(c.v.y) > 1.2) { const d = camDist(o.position.x, o.position.y, o.position.z); if (d < 40) Snd.gun('casing', { dist: d, pan: pan(o.position.x, o.position.y, o.position.z), v: clamp(Math.abs(c.v.y) / 3, 0.25, 1), wet: 0.15 }); }
      c.v.y *= -0.34; c.v.x *= 0.62; c.v.z *= 0.62; c.w.multiplyScalar(0.55);
      if (Math.abs(c.v.y) < 0.55) { c.rest = true; c.t = 0; o.rotation.set(Math.PI / 2, 0, rnd(0, 6)); o.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), rnd(0, 6)); o.position.y = g.y + 0.0145; } // couchée sur le flanc
    } else if (!g && o.position.y < -30) { S.scene.remove(o); X.casings.splice(i, 1); }
    else if (inside(W, o.position.x, o.position.y, o.position.z, 0) ) { c.v.x *= -0.4; c.v.z *= -0.4; o.position.addScaledVector(c.v, dt * 2); }
  }
}

/* ------------------------------ sang ------------------------------ */
function addDrop(x, y, z, vx, vy, vz, size, life = 3) {
  const D = X.drops; let i = -1; for (let k = 0; k < D.n; k++) if (D.life[k] <= 0) { i = k; break; } if (i < 0) i = (Math.random() * D.n) | 0;
  D.p[i * 3] = x; D.p[i * 3 + 1] = y; D.p[i * 3 + 2] = z; D.v[i * 3] = vx; D.v[i * 3 + 1] = vy; D.v[i * 3 + 2] = vz; D.s[i] = size; D.life[i] = life;
}
function mist(x, y, z, vx, vy, vz, size, life) {
  const T = textures(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.mist, transparent: true, depthWrite: false, opacity: 0.55 })); s.position.set(x, y, z); s.scale.setScalar(size); S.scene.add(s);
  if (X.mist.length > 160) { const o = X.mist.shift(); S.scene.remove(o.o); }
  X.mist.push({ o: s, t: 0, life, v: new THREE.Vector3(vx, vy, vz), g: -0.6, grow: 2.4, op: 0.55 });
}
// coup au but : jet vers l'avant (sortie), brume rouge, éclaboussures vers le tireur (entrée) ; la tête explose en un gros nuage de gouttes
function bloodFx(W, e) { if (!cfg.blood) return; bloodBurst(W, e, e.zone === 2 ? 1.3 : e.zone === 1 ? 1 : 0.7); }
function bloodBurst(W, e, k) {
  const nOut = Math.round(60 * k), nIn = Math.round(16 * k), h = e.zone === 2;
  for (let i = 0; i < nOut; i++) {
    const sp = rnd(2.5, 11) * (h ? 1.15 : 1), ca = rnd(-0.45, 0.45), cb = rnd(-0.45, 0.45), vx = e.dx + ca, vy = e.dy + cb * 0.9 + 0.15, vz = e.dz + rnd(-0.45, 0.45), l = Math.hypot(vx, vy, vz) || 1;
    addDrop(e.x, e.y, e.z, (vx / l) * sp, (vy / l) * sp, (vz / l) * sp, rnd(0.008, 0.028) * (Math.random() < 0.12 ? 2 : 1));
  }
  for (let i = 0; i < nIn; i++) { const sp = rnd(0.8, 4); addDrop(e.x, e.y, e.z, -e.dx * sp + rnd(-1.4, 1.4), -e.dy * sp + rnd(0, 1.6), -e.dz * sp + rnd(-1.4, 1.4), rnd(0.006, 0.02)); }
  const nm = h ? 16 : 9;
  for (let i = 0; i < nm; i++) mist(e.x + rnd(-0.1, 0.1), e.y + rnd(-0.1, 0.1), e.z + rnd(-0.1, 0.1), e.dx * rnd(0.5, 3.4) + rnd(-0.6, 0.6), e.dy * rnd(0.4, 2) + rnd(-0.2, 0.6), e.dz * rnd(0.5, 3.4) + rnd(-0.6, 0.6), rnd(0.18, h ? 0.9 : 0.55), rnd(0.35, h ? 1.3 : 0.9));
  if (h) for (let i = 0; i < 12; i++) { const sp = rnd(1.5, 7); addDrop(e.x, e.y, e.z, e.dx * sp + rnd(-2.5, 2.5), e.dy * sp + rnd(0, 3.5), e.dz * sp + rnd(-2.5, 2.5), rnd(0.035, 0.07), 4); } // fragments plus lourds
}
function stepDrops(W, dt) {
  const D = X.drops; if (!D) return; const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3(); let top = 0;
  for (let i = 0; i < D.n; i++) {
    if (D.life[i] <= 0) { continue; }
    const j = i * 3; D.life[i] -= dt; const ox = D.p[j], oy = D.p[j + 1], oz = D.p[j + 2];
    D.v[j + 1] -= 9.8 * dt; const drag = 1 - 0.35 * dt; D.v[j] *= drag; D.v[j + 2] *= drag;
    const nx = ox + D.v[j] * dt, ny = oy + D.v[j + 1] * dt, nz = oz + D.v[j + 2] * dt; let hitN = null, hx = nx, hy = ny, hz = nz;
    // mur ou sol : le segment parcouru contre les boîtes proches (même précision que les balles)
    const dx = nx - ox, dy = ny - oy, dz = nz - oz, len = Math.hypot(dx, dy, dz);
    if (len > 1e-5) {
      let bt = len, bn = null; const ux = dx / len, uy = dy / len, uz = dz / len;
      for (const b of W.bodies) { if (!b.on || b.ghost || b.ex === undefined) continue; if (Math.abs(ox - b.px) > b.ex + 1.5 || Math.abs(oz - b.pz) > b.ez + 1.5 || Math.abs(oy - b.py) > b.hh + 1.5) continue; const h = rayBody(b, ox, oy, oz, ux, uy, uz, bt); if (h && h.t < bt) { bt = h.t; bn = h; } }
      if (bn) { hitN = bn; hx = ox + ux * bt; hy = oy + uy * bt; hz = oz + uz * bt; }
    }
    if (hitN) {
      D.life[i] = 0; const s = D.s[i], size = clamp(s * rnd(6, 11), 0.05, 0.42), n = new THREE.Vector3(hitN.nx, hitN.ny, hitN.nz);
      if (Math.hypot(D.v[j], D.v[j + 1], D.v[j + 2]) > 1.2 || n.y > 0.5) decal(X.decalMat[(Math.random() * 6) | 0], hx + n.x * 0.01, hy + n.y * 0.01, hz + n.z * 0.01, n, size, rnd(0, 6.3));
      continue;
    }
    D.p[j] = nx; D.p[j + 1] = ny; D.p[j + 2] = nz;
    if (ny < -40) { D.life[i] = 0; continue; }
    // goutte étirée dans le sens du déplacement
    const sp = Math.hypot(D.v[j], D.v[j + 1], D.v[j + 2]), s = D.s[i];
    pp.set(D.v[j], D.v[j + 1], D.v[j + 2]).normalize(); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pp); sc.set(s, s * (1 + Math.min(3, sp * 0.16)), s);
    M4.compose(new THREE.Vector3(nx, ny, nz), q, sc); D.im.setMatrixAt(i, M4); top = i + 1;
  }
  // les emplacements libérés disparaissent
  for (let i = 0; i < D.n; i++) if (D.life[i] <= 0 && D.s[i] !== -1) { D.im.setMatrixAt(i, M4.makeScale(0, 0, 0)); D.s[i] = -1; } else if (D.life[i] > 0 && D.s[i] === -1) D.s[i] = 0.01;
  D.im.count = D.n; D.im.instanceMatrix.needsUpdate = true;
}
// flaque sous le corps : grandit pendant quelques secondes (le cœur bat encore) puis reste jusqu'à la réapparition
function startPool(W, v, e) {
  if (!cfg.blood) return;
  const g = groundBelow(W, v.x, v.y + 0.3, v.z, 4); if (!g) return;
  const m = decal(X.decalMat[0], v.x, g.y + 0.014, v.z, new THREE.Vector3(0, 1, 0), 0.2, rnd(0, 6)); X.pools.push({ m, v: e.v, t: 0, max: rnd(1.3, 1.8), x: v.x, y: v.y, z: v.z, wy: e.y, dx: e.dx, dz: e.dz });
}
function stepPools(W, dt) {
  for (let i = X.pools.length - 1; i >= 0; i--) {
    const p = X.pools[i], v = W.pl[p.v]; p.t += dt;
    m: { if (!p.m.parent) { X.pools.splice(i, 1); break m; } }
    p.m.scale.setScalar(0.2 + (p.max - 0.2) * (1 - Math.exp(-p.t * 0.45)));
    // le blessé saigne encore : petits jets au rythme du cœur pendant deux secondes
    if (v && v.dead > 0 && p.t < 2.6 && Math.sin(p.t * 9) > 0.6 && Math.random() < dt * 40) addDrop(p.x, p.wy, p.z, rnd(-1, 1) + p.dx, rnd(1, 3.2), rnd(-1, 1) + p.dz, rnd(0.008, 0.02), 2);
    if (v && !(v.dead > 0) && p.t > 4) { p.fade = (p.fade || 0) + dt; } // réapparu : la flaque reste mais ne grandit plus
  }
}

/* ------------------------------ pose : fusil, bras, mains ------------------------------ */
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const wpos = (o, v) => { o.updateWorldMatrix(true, false); return v.setFromMatrixPosition(o.matrixWorld); };
// fait tourner un os autour d'un axe MONDE
function rotWorld(bone, axis, ang) {
  bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q1); _q2.setFromAxisAngle(axis, ang); _q1.premultiply(_q2);
  bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q1)); bone.updateMatrixWorld(true);
}
// oriente un os pour que son enfant pointe vers une cible monde
function pointBone(bone, child, target) {
  const bp = wpos(bone, _a), cp = wpos(child, _b); const cur = _c.copy(cp).sub(bp).normalize(), want = _d.copy(target).sub(bp).normalize();
  _q2.setFromUnitVectors(cur, want); bone.getWorldQuaternion(_q1); _q1.premultiply(_q2); bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(_q1)); bone.updateMatrixWorld(true);
}
// bras à deux segments : la main atteint la cible (ou s'en approche au maximum), le coude est repoussé du côté du « pôle »
function ik2(up, lo, ha, T, pole) {
  const S0 = wpos(up, new THREE.Vector3()), E0 = wpos(lo, new THREE.Vector3()), H0 = wpos(ha, new THREE.Vector3()), l1 = S0.distanceTo(E0), l2 = E0.distanceTo(H0);
  const v = new THREE.Vector3().subVectors(T, S0), full = v.length(), d = clamp(full, Math.abs(l1 - l2) + 0.02, l1 + l2 - 0.005), dir = v.normalize();
  const x = (d * d + l1 * l1 - l2 * l2) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pw = pole.clone().addScaledVector(dir, -pole.dot(dir)); if (pw.lengthSq() < 1e-6) pw.set(0, -1, 0); pw.normalize();
  const E = S0.clone().addScaledVector(dir, x).addScaledVector(pw, h);
  pointBone(up, lo, E); pointBone(lo, ha, S0.clone().addScaledVector(dir, d));
  return full - (l1 + l2);
}
// main : doigts dans la direction fW, paume tournée vers nW. Les axes de l'os sont déduits de la géométrie de la main (médius, pouce), côté droit / gauche inclus
function orientHand(c, side, fW, nW) {
  const hand = c.bones['hand_' + side], mid = c.bones['middle_01_' + side], th = c.bones['thumb_01_' + side]; if (!hand || !mid || !th) return;
  const fl = mid.position.clone().normalize(), tl = th.position.clone().normalize(), sgn = side === 'r' ? -1 : 1;
  const nl = new THREE.Vector3().crossVectors(fl, tl).multiplyScalar(sgn).normalize(); nl.addScaledVector(fl, -nl.dot(fl)).normalize();
  const zl = new THREE.Vector3().crossVectors(fl, nl);
  const f = fW.clone().normalize(), n = nW.clone().addScaledVector(f, -nW.dot(f)).normalize(), z = new THREE.Vector3().crossVectors(f, n);
  _m.makeBasis(fl, nl, zl); _m2.makeBasis(f, n, z); _m.invert(); _m2.multiply(_m); // monde = Bw · Bl⁻¹
  _q1.setFromRotationMatrix(_m2); hand.parent.getWorldQuaternion(_q3); hand.quaternion.copy(_q3.invert().multiply(_q1)); hand.updateMatrixWorld(true);
  return n;
}
// doigts qui se referment vers la paume (rotation de chaque phalange autour de f × n)
function curl(c, side, n, amounts) {
  for (const [name, angs] of Object.entries(amounts)) {
    for (let i = 0; i < angs.length; i++) {
      const b = c.bones[`${name}_0${i + 1}_${side}`], ch = c.bones[`${name}_0${i + 2}_${side}`] || c.bones[`${name}_0${i + 2}_leaf_${side}`]; if (!b || !ch) continue;
      const f = wpos(ch, _e).clone().sub(wpos(b, _f)).normalize(), ax = new THREE.Vector3().crossVectors(f, n).normalize();
      rotWorld(b, ax, angs[i]);
    }
  }
}
// ORIENTATION DU CORPS : le bassin (la racine du personnage) suit la direction de DÉPLACEMENT (±75° de la visée ; en reculant il garde le regard devant et la course est jouée à l'envers),
// le buste reprend la différence jusqu'à la visée (torsion répartie sur la colonne, jamais plus de ~70° au total). Rien ne s'accumule : tout est recalculé à chaque image depuis la visée.
const D75 = (75 * Math.PI) / 180, STANCE = 0.55;
export function bodyYaw(c, p, dt) {
  const k = c.k, aim = k === X.me && !(p.dead > 0) ? A.yaw : p.ay ?? p.yaw;
  if (c.legYaw === undefined || !Number.isFinite(c.legYaw)) c.legYaw = aim;
  const vx = p.vx - (p.gvx || 0), vz = p.vz - (p.gvz || 0), sp = Math.hypot(vx, vz); let tgt = c.legYaw; c.czRev = false;
  if (sp > 0.9 && p.st === ST.GROUND) {
    const rel = wrap(Math.atan2(vx, vz) - aim);
    if (Math.abs(rel) <= (105 * Math.PI) / 180) tgt = aim + clamp(rel, -D75, D75);
    else { c.czRev = true; tgt = aim + clamp(wrap(rel + Math.PI), -D75 * 0.7, D75 * 0.7); } // marche arrière : jambes vers l'avant (animation inversée)
  } else if (p.st === ST.AIR) tgt = aim + clamp(wrap(c.legYaw - aim), -D75, D75); // en l'air on garde l'orientation du saut
  else if (Math.abs(wrap(aim - c.legYaw)) > (50 * Math.PI) / 180) tgt = aim; // à l'arrêt : on pivote sur place seulement quand la visée s'éloigne trop
  c.legYaw += clamp(wrap(tgt - c.legYaw), -14 * dt, 14 * dt);
  return c.legYaw;
}
const RBL = new THREE.Vector3();
const AIMK = { yaw: 0, pitch: 0 };
function aimFor(k, p, dt) {
  const a = X.aim[k];
  if (k === X.me && !(p.dead > 0)) { a.yaw = A.yaw; a.pitch = A.pitch; }
  else { a.yaw += wrap((p.ay ?? p.yaw) - a.yaw) * Math.min(1, dt * 16); a.pitch += ((p.ap ?? 0) - a.pitch) * Math.min(1, dt * 16); }
  return a;
}
// keyframes de la main droite pendant le rechargement : [t, repère] avec repère 'g' (poignée), 'h' (poignée de culasse), 'r' (sommet du boîtier : chargeur), 'p' (cartouchière à la ceinture)
const RELOAD_R = [[0, 'g'], [0.12, 'h'], [0.3, 'h'], [0.52, 'p'], [0.86, 'r'], [1.75, 'r'], [2.0, 'h'], [2.3, 'h'], [2.5, 'g'], [2.7, 'g']];
const RPOS = { get g() { return RIFLE.gripR; }, r: new THREE.Vector3(-0.03, 0.05, -0.07), p: new THREE.Vector3(-0.28, -0.4, -0.3) };
function reloadAnim(r, el) { // état visuel de la culasse et de la lame-chargeur à l'instant `el` du rechargement (secondes)
  const up = sm(el / 0.16), back = sm((el - 0.16) / 0.1), fwd = sm((el - 2.02) / 0.16), down = sm((el - 2.2) / 0.1);
  const handle = lerp(-0.7, 1.3, up) , slide = back * (1 - fwd);
  const hd = el < 2.2 ? handle : lerp(1.3, -0.7, down);
  const cl = el > 0.45 && el < 1.85; const cu = el < 0.86 ? sm((el - 0.45) / 0.41) : 1, sink = el > 1.0 ? sm((el - 1.0) / 0.7) : 0;
  return { handle: hd, slide, clip: cl, cu, sink };
}
function cycleAnim(el) { // culasse après un tir : lever (0 → 0,10), reculer (0,10 → 0,22), pause (douille éjectée à 0,42), avancer (0,46 → 0,60), rabattre (0,66 → 0,80)
  const up = sm(el / 0.1), back = sm((el - 0.1) / 0.12), fwd = sm((el - 0.46) / 0.14), down = sm((el - 0.66) / 0.14);
  return { handle: el < 0.66 ? lerp(-0.7, 1.3, up) : lerp(1.3, -0.7, down), slide: back * (1 - fwd), hand: el < 0.05 ? sm(el / 0.05) : el < 0.8 ? 1 : 1 - sm((el - 0.8) / 0.12) };
}
const RIFLE_WORLD = new THREE.Matrix4();
export function pose(cl, W, dt, rp, me) {
  if (!X.on) return;
  X.me = me;
  for (let k = 0; k < W.pl.length; k++) {
    const p = W.pl[k], c = cl[k], r = X.rifles[k]; if (!c || !r) continue;
    const alive = !(p.dead > 0) && (p.st === ST.GROUND || p.st === ST.AIR);
    const hideMe = k === me && A.zoom > 0.6; // vue à travers la lunette : la caméra est dans le fusil, on ne dessine ni le tireur ni son arme
    r.g.visible = alive && !hideMe; c.g.visible = !hideMe;
    c.ring.visible = true;
    if (!alive) { c.czPost = null; continue; }
    // les rotations ci-dessous sont RELATIVES (torsion du buste, tangage, doigts) : si l'animation en cours ne réécrit pas un os à chaque image (clip sans piste pour cet os), la rotation de l'image
    // précédente s'y ajouterait indéfiniment (le buste tourne alors en boucle). On défait donc d'abord nos propres modifications sur les os que l'animation n'a pas réécrits.
    const allB = c.boneList ||= [...new Set(Object.values(c.bones).filter(Boolean))];
    if (c.czPost) { for (const [b, st] of c.czPost) if (b.quaternion.equals(st.after)) b.quaternion.copy(st.before); c.root.updateMatrixWorld(true); }
    const pre = new Map(allB.map((b) => [b, b.quaternion.clone()]));
    const a = aimFor(k, p, dt), d = new THREE.Vector3().copy(aimDirV(a.yaw, a.pitch)), Rv = new THREE.Vector3(rightOf(a.yaw).x, 0, rightOf(a.yaw).z);
    // longueur des bras : les bras de ce modèle sont courts pour un fusil de 1,1 m ; on les allonge un peu (l'échelle suit l'axe de l'os)
    for (const s of ['l', 'r']) for (const n of ['upperarm_', 'lowerarm_']) { const b = c.bones[n + s]; if (b && !c.armScaled && !c.charId) b.scale.y = 1.16; }
    c.armScaled = true;
    // état du fusil : recul, culasse, rechargement
    // dbg : fige l'animation à un instant donné (captures et vérifications) — { cyc: s depuis le tir } ou { rl: s depuis le début du rechargement }
    const rlT = k === me && dbg.rl != null ? dbg.rl : p.rl, cycT = k === me && dbg.cyc != null ? dbg.cyc : p.cyc > 0 ? KAR.CYCLE - p.cyc : -1;
    const rec = X.rec[k] = k === me && dbg.rec != null ? dbg.rec : Math.max(0, X.rec[k] - dt * 7), reloading = rlT >= 0, cyc = cycT;
    let handleA = -0.7, slideZ = 0, tilt = 0, hand = null, clipShow = false, clipU = 0, clipSink = 0;
    if (reloading) { const s = reloadAnim(r, rlT); handleA = s.handle; slideZ = s.slide; clipShow = s.clip; clipU = s.cu; clipSink = s.sink; tilt = 0.32 * Math.sin(Math.min(1, rlT / 0.5) * Math.PI / 2) * (rlT < 2.2 ? 1 : 1 - sm((rlT - 2.2) / 0.4)); }
    else if (cyc >= 0) { const s = cycleAnim(cyc); handleA = s.handle; slideZ = s.slide; hand = s.hand; tilt = 0.12 * Math.sin(Math.min(1, cyc / 0.5) * Math.PI); }
    r.setBolt(handleA, slideZ); r.trigger(p.cd > KAR.FIRE_CD - 0.08 ? 1 : 0);
    r.clip.visible = clipShow;
    // position du fusil : l'axe du canon passe à droite du corps, à hauteur d'épaule ; recul en arrière et léger relèvement
    const eye = crazyEye(p), ex = rp[k].x, ey = rp[k].y + eye, ez = rp[k].z, up = _f.set(0, 1, 0);
    const zA = d.clone(), xA = new THREE.Vector3(-Rv.x, 0, -Rv.z), yA = new THREE.Vector3().crossVectors(zA, xA).normalize();
    const kick = rec * 0.05, ang = rec * 0.04 + (reloading ? 0.06 * Math.sin(Math.min(1, rlT / 0.4) * Math.PI / 2) : 0);
    const org = new THREE.Vector3(ex, ey, ez).addScaledVector(Rv, CZ.BORE).addScaledVector(yA, -0.12).addScaledVector(zA, RIFLE.org - kick);
    // roulis (rechargement : le fusil penche vers la gauche pour ouvrir la culasse) et tangage du recul
    _m.makeBasis(xA, yA, zA); _q1.setFromRotationMatrix(_m); _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ang); _q1.multiply(_q2); _q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt); _q1.multiply(_q2);
    RIFLE_WORLD.compose(org, _q1, new THREE.Vector3(1, 1, 1)); r.muz = (r.muz || new THREE.Vector3()).set(0, 0, RIFLE.muzzle + 0.04).applyMatrix4(RIFLE_WORLD); r.eye = (r.eye || new THREE.Vector3()).set(0, RIFLE.glb ? 0.052 : 0.03, RIFLE.glb ? -0.31 : -0.2).applyMatrix4(RIFLE_WORLD); // oculaire de la lunette r.g.matrix.copy(RIFLE_WORLD); r.g.matrixWorld.copy(RIFLE_WORLD); r.g.matrixWorldNeedsUpdate = true; r.g.updateMatrixWorld(true);
    // buste : il suit la visée (tangage) et tourne un peu vers l'épaule du fusil
    const axisR = new THREE.Vector3(Rv.x, 0, Rv.z).normalize();
    for (const [bn, kf] of [['spine_01', 0.12], ['spine_02', 0.2], ['spine_03', 0.22], ['neck_01', 0.15], ['Head', 0.25]]) { const b = c.bones[bn]; if (b) rotWorld(b, axisR, a.pitch * kf - rec * 0.05); }
    { // torsion du buste = écart entre le bassin (c.yaw, racine rendue) et la visée, répartie sur trois vertèbres
      const Y = _e.set(0, 1, 0), uL = c.bones.upperarm_l, uR = c.bones.upperarm_r;
      // cap voulu du buste = visée tournée de STANCE, jamais à plus de 80° du bassin ; cap actuel mesuré sur la ligne des épaules (l'animation de course tord elle-même le buste : on corrige l'écart réel, on n'ajoute pas une torsion fixe)
      const want = c.yaw + clamp(wrap(a.yaw - STANCE - c.yaw), -1.4, 1.4); let cur = want;
      if (uL && uR) { const pl = wpos(uL, new THREE.Vector3()), pr = wpos(uR, new THREE.Vector3()); cur = Math.atan2(pr.z - pl.z, -(pr.x - pl.x)); }
      const twist = clamp(wrap(want - cur), -1.6, 1.6);
      for (const [bn, kf] of [['spine_01', 0.25], ['spine_02', 0.4], ['spine_03', 0.35]]) { const b = c.bones[bn]; if (b) rotWorld(b, Y, twist * kf); }
      { const dh = clamp(wrap(a.yaw - want), -0.9, 0.9); for (const [bn, kf] of [['neck_01', 0.35], ['Head', 0.45]]) { const b = c.bones[bn]; if (b) rotWorld(b, Y, dh * kf); } } // la tête regarde la visée
    }
    c.root.updateMatrixWorld(true);
    // mains
    const toW = (v) => v.clone().applyMatrix4(RIFLE_WORLD), dirW = (v) => v.clone().transformDirection(RIFLE_WORLD);
    let tR = RIFLE.gripR.clone(), tL = RIFLE.gripL.clone();
    if (reloading) { const el = rlT; let i = 0; while (i < RELOAD_R.length - 2 && el >= RELOAD_R[i + 1][0]) i++; const [t0, k0] = RELOAD_R[i], [t1, k1] = RELOAD_R[i + 1], u = sm((el - t0) / (t1 - t0));
      const pos = (kk) => (kk === 'h' ? r.ball(RBL).clone().add(new THREE.Vector3(0.0, -0.01, 0)) : RPOS[kk].clone()); tR = pos(k0).lerp(pos(k1), u);
      if (clipShow) { // la lame descend de la ceinture vers le sommet du boîtier, puis s'enfonce
        const from = RPOS.p.clone().add(new THREE.Vector3(0.0, 0.0, 0.0)), to = new THREE.Vector3(0, 0.02, -0.07), cp = from.clone().lerp(to, clipU); cp.y += 0.04 - clipSink * 0.05; r.clip.position.copy(cp); r.clip.rotation.set(0, 0, 0); } }
    else if (hand != null && hand > 0) { const bl = r.ball(RBL).clone(); tR = RIFLE.gripR.clone().lerp(bl, hand); }
    const fingR = RIFLE.R, fingL = RIFLE.L;
    const poleR = new THREE.Vector3().addScaledVector(Rv, 0.55).addScaledVector(up, -0.9).addScaledVector(zA, -0.25), poleL = new THREE.Vector3().addScaledVector(Rv, -0.3).addScaledVector(up, -0.95).addScaledVector(zA, -0.1);
    const B = c.bones;
    if (B.upperarm_r && B.lowerarm_r && B.hand_r) {
      const wR = toW(tR), wL = toW(tL);
      c.armMiss = [ik2(B.upperarm_l, B.lowerarm_l, B.hand_l, wL, poleL), ik2(B.upperarm_r, B.lowerarm_r, B.hand_r, wR, poleR)];
      const handHoldingBolt = (reloading && rlT < 2.4 && rlT > 0.05 && (rlT < 0.45 || (rlT > 1.75 && rlT < 2.4))) || (hand != null && hand > 0.3);
      const nR = orientHand(c, 'r', dirW(fingR.f), dirW(handHoldingBolt ? new THREE.Vector3(0.1, 0.9, 0.3) : fingR.n)), nL = orientHand(c, 'l', dirW(fingL.f), dirW(fingL.n));
      if (nR) { const trig = p.cd > KAR.FIRE_CD - 0.06 ? 0.7 : 0.18; curl(c, 'r', nR, { index: [trig, trig, trig * 0.5], middle: [1.15, 1.25, 0.9], ring: [1.2, 1.25, 0.9], pinky: [1.25, 1.25, 0.9], thumb: [0.45, 0.4, 0.2] }); }
      if (nL) curl(c, 'l', nL, { index: [0.95, 1.1, 0.7], middle: [1.1, 1.2, 0.9], ring: [1.15, 1.2, 0.9], pinky: [1.2, 1.2, 0.9], thumb: [0.25, 0.3, 0.15] });
    }
    c.czPost = new Map(); for (const [b, q0] of pre) if (!b.quaternion.equals(q0)) c.czPost.set(b, { before: q0, after: b.quaternion.clone() });
  }
}
const aimDirV = (yaw, pitch) => { const o = aimDir(yaw, pitch); return new THREE.Vector3(o.x, o.y, o.z); };

/* ------------------------------ caméra ------------------------------ */
export function camera(W, rp, me, dt, cam) {
  if (!X.on || S.debugCam) return false; // caméra libre (tests, captures)
  let f = me; if (f == null || !W.pl[f]) { f = X.spec ?? 0; if (W.pl[f]?.dead > 0) { f = W.pl.findIndex((q) => !(q.dead > 0)); if (f < 0) f = 0; } X.spec = f; }
  const p = W.pl[f], r = rp[f], dead = p.dead > 0, own = f === me;
  const aim = own ? A : X.aim[f] || { yaw: p.ay ?? 0, pitch: 0 };
  // visée (clic droit) : la caméra se rapproche de l'épaule en douceur, le champ se resserre ; impossible mort ou en rechargement
  const want = own && !dead && p.scope ? 1 : 0; A.scope += (want - A.scope) * Math.min(1, dt * CAM.adsSpeed);
  if (own && want && A.scope < 0.3 && !X.scopeSnd) { X.scopeSnd = true; Snd.gun('scope', { wet: 0 }); } if (!want) X.scopeSnd = false;
  const wantZ = own && !dead && p.zm ? 1 : 0; A.zoom += (wantZ - A.zoom) * Math.min(1, dt * CAM.zoomSpeed); if (A.zoom < 0.002 && !wantZ) A.zoom = 0;
  const sc = own ? sm(A.scope) : 0, zk = own ? sm(A.zoom) : 0, R = rightOf(aim.yaw), d = aimDirV(aim.yaw, aim.pitch);
  let px, py, pz, lx, ly, lz;
  if (dead && own) { // caméra de mort : tourne autour du corps
    const cy = r.y + 1.0, dist = 5.2, ch = Math.cos(0.45); px = r.x - Math.sin(A.yaw) * dist * ch; pz = r.z - Math.cos(A.yaw) * dist * ch; py = cy + Math.sin(0.45) * dist; lx = r.x; ly = cy; lz = r.z;
  } else {
    const eyeY = r.y + crazyEye(p) + CZ.CAMUP; X.eyeS = X.eyeS === undefined ? eyeY : X.eyeS + (eyeY - X.eyeS) * Math.min(1, dt * 10); // les yeux montent / descendent doucement (glissade)
    const bx = r.x + R.x * CZ.SHOULDER, by = X.eyeS, bz = r.z + R.z * CZ.SHOULDER;
    const want2 = lerp(CAM.dist, CAM.adsDist, sc);
    // le décor ne doit pas boucher la vue : premier mur sur le rayon arrière ; on s'en approche vite, on s'en éloigne lentement (jamais de va-et-vient)
    let t = want2; for (const b of W.bodies) { if (!b.on || b.ghost || b.ex === undefined) continue; if (Math.abs(bx - b.px) > b.ex + want2 || Math.abs(bz - b.pz) > b.ez + want2 || Math.abs(by - b.py) > b.hh + want2) continue; const h = rayBody(b, bx, by, bz, -d.x, -d.y, -d.z, t); if (h && h.t < t) t = Math.max(CAM.minDist * 0.6, h.t - CAM.wallMargin); }
    if (X.backS == null) X.backS = t; else X.backS += (t - X.backS) * Math.min(1, dt * (t < X.backS ? CAM.inSpeed : CAM.outSpeed));
    const back = Math.min(X.backS, t < X.backS ? t : X.backS); X.backS = back; // jamais derrière un mur
    px = bx - d.x * back; py = by - d.y * back; pz = bz - d.z * back;
    const eyeP = X.rifles[f]?.eye; if (zk > 0 && eyeP) { px = lerp(px, eyeP.x, zk); py = lerp(py, eyeP.y, zk); pz = lerp(pz, eyeP.z, zk); } // lunette : la caméra glisse jusqu'à l'oculaire
    lx = px + d.x * 40; ly = py + d.y * 40; lz = pz + d.z * 40;
    if (py < r.y + 0.3) py = r.y + 0.3; // ne passe pas sous le sol quand on vise vers le haut
  }
  const sh = S.shake || 0; S.shake = Math.max(0, sh - dt * 1.6);
  cam.position.set(px + (Math.random() - 0.5) * sh * 0.3, py + (Math.random() - 0.5) * sh * 0.3, pz); cam.lookAt(lx, ly, lz);
  const fov = lerp(lerp(CAM.fov, CAM.adsFov, sc), CAM.scopeFov, zk); if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  S.sun.position.set(r.x + S.sunDir.x * 60, r.y + S.sunDir.y * 60, r.z + S.sunDir.z * 60); S.sun.target.position.set(r.x, r.y, r.z);
  return true;
}

/* ------------------------------ mise à jour : effets animés ------------------------------ */
export function update(W, dt) {
  if (!X.on) return;
  for (let i = X.flashes.length - 1; i >= 0; i--) { const f = X.flashes[i]; f.t += dt; f.o.material.opacity = 1 - f.t / f.life; f.o.scale.multiplyScalar(1 + dt * 8); if (f.t >= f.life) { S.scene.remove(f.o); f.o.material.dispose(); X.flashes.splice(i, 1); } }
  X.lightT = Math.max(0, (X.lightT || 0) - dt); X.light.intensity = X.lightT > 0 ? 30 * (X.lightT / 0.08) : 0;
  for (let i = X.tracers.length - 1; i >= 0; i--) {
    const t = X.tracers[i]; t.t += dt; const u = t.t * 900, head = Math.min(t.len, u), tail = Math.max(0, u - 6), seg = head - tail;
    if (seg > 0.01 && u < t.len + 6) { t.o.visible = true; _a.copy(t.b).sub(t.a).normalize(); t.o.position.copy(t.a).addScaledVector(_a, (head + tail) / 2); t.o.scale.set(1, 1, seg); t.o.lookAt(_b.copy(t.o.position).add(_a)); } else t.o.visible = false;
    t.line.material.opacity = 0.22 * Math.max(0, 1 - t.t / t.fade);
    if (t.t > t.fade) { S.scene.remove(t.o); S.scene.remove(t.line); t.o.geometry.dispose(); t.line.geometry.dispose(); X.tracers.splice(i, 1); }
  }
  for (let i = X.puffs.length - 1; i >= 0; i--) { const p = X.puffs[i]; p.t += dt; const u = p.t / p.life; p.o.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.4); p.o.scale.setScalar(p.size * (1 + u * p.grow)); p.o.material.opacity = p.op * (1 - u); if (u >= 1) { S.scene.remove(p.o); p.o.material.dispose(); X.puffs.splice(i, 1); } }
  for (let i = X.mist.length - 1; i >= 0; i--) { const p = X.mist[i]; p.t += dt; const u = p.t / p.life; p.v.y -= (p.g || 0) * dt * (p.spark ? 1 : -1) * (p.spark ? 1 : 1); p.o.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * (p.spark ? 0.5 : 2.2)); if (!p.spark) p.o.scale.setScalar(p.o.scale.x * (1 + dt * p.grow)); p.o.material.opacity = p.op * (1 - u); if (u >= 1) { S.scene.remove(p.o); p.o.material.dispose(); X.mist.splice(i, 1); } }
  stepCasings(W, dt); stepDrops(W, dt); stepPools(W, dt);
  // décors de sang : s'effacent très lentement
  const me = W.pl[X.me];
  if (me) { if (X.wasDead && !(me.dead > 0)) { A.yaw = me.ay ?? A.yaw; A.pitch = 0; } X.wasDead = me.dead > 0; }
}

/* ------------------------------ interface : mise à jour ------------------------------ */
export function hud(W, dt, G) {
  if (!X.on) return;
  const me = W.pl[G.me ?? 0], tmax = W.tmax || CZ.TIME, left = Math.max(0, tmax - W.time), m = Math.floor(left / 60);
  $('#cz-timer').textContent = `${m}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('#cz-goal').textContent = `Premier à ${W.limit}`;
  const rows = W.pl.map((p, k) => ({ k, p })).sort((a, b) => b.p.kills - a.p.kills || a.p.deaths - b.p.deaths);
  $('#cz-score').innerHTML = rows.map((r) => `<li class="${r.k === G.me ? 'me' : ''}"><i style="background:${colOf(r.k)}"></i><span>${nameOf(r.k)}</span><b>${r.p.kills}</b></li>`).join('');
  for (const f of X.feed) f.t -= dt; if (X.feed.some((f) => f.t <= 0)) { X.feed = X.feed.filter((f) => f.t > 0); renderFeed(); }
  if (!me) return;
  const dead = me.dead > 0;
  // viseur : l'écart des traits suit la dispersion réelle du tir ; remplacé par la lunette
  const spread = crazySpread(me), gap = (Math.tan(spread) / Math.tan((S.cam.fov * Math.PI) / 360)) * (innerHeight / 2), sc = sm(A.scope);
  const cr = $('#cz-cross'); cr.style.opacity = dead || A.zoom > 0.3 ? 0 : 1;
  cr.querySelector('.u').style.top = `${-gap - 11}px`; cr.querySelector('.d').style.top = `${gap + 2}px`; cr.querySelector('.l').style.left = `${-gap - 11}px`; cr.querySelector('.r').style.left = `${gap + 2}px`;
  $('#cz-scope').style.display = A.zoom > 0.02 ? 'block' : 'none'; $('#cz-scope').style.opacity = clamp(A.zoom * 1.4, 0, 1); // vue à travers la lunette du Kar98k (zoom ×4)
  X.hitT = Math.max(0, X.hitT - dt); const hm = $('#cz-hit'); hm.style.opacity = X.hitT > 0 ? Math.min(1, X.hitT / 0.12) : 0; hm.classList.toggle('head', X.hitHead);
  X.dmgT = Math.max(0, X.dmgT - dt); $('#cz-vig').style.opacity = Math.min(1, X.dmgT * 1.8);
  const di = $('#cz-dmg i'); di.style.opacity = X.dmgT > 0 ? Math.min(1, X.dmgT * 2) : 0; di.style.transform = `rotate(${(-X.dmgAng * 180) / Math.PI}deg)`; di.style.transformOrigin = '60px 150px';
  const hp = Math.max(0, me.hp); $('#cz-hp b').textContent = Math.ceil(hp); $('#cz-hp i').style.width = `${hp}%`; $('#cz-low').style.opacity = hp < 40 && !dead ? (0.5 + 0.5 * Math.sin(performance.now() / 180)) * (1 - hp / 40) : 0;
  $('#cz-prot').style.opacity = me.prot > 0 && !dead ? Math.min(1, me.prot) * 0.8 : 0;
  X.rounds.forEach((e, i) => e.classList.toggle('off', i >= me.ammo)); const st = $('#cz-ammo .state'), bar = $('#cz-ammo .bar i');
  if (me.rl >= 0) { st.textContent = 'RECHARGEMENT'; st.className = 'state'; bar.style.width = `${(me.rl / KAR.RELOAD) * 100}%`; }
  else if (me.cyc > 0) { st.textContent = 'CULASSE'; st.className = 'state'; bar.style.width = `${(1 - me.cyc / KAR.CYCLE) * 100}%`; }
  else if (me.ammo <= 0) { st.textContent = 'RECHARGER  [R]'; st.className = 'state warn'; bar.style.width = '0'; }
  else { st.textContent = ''; bar.style.width = '0'; }
  const dd = $('#cz-dead'); dd.style.opacity = dead ? 1 : 0;
  if (dead) { dd.querySelector('small').textContent = X.killer != null && X.killer >= 0 && X.killer !== G.me ? 'ABATTU PAR' : ''; dd.querySelector('b').textContent = X.killer != null && X.killer >= 0 && X.killer !== G.me ? G.names[X.killer] || '' : 'ÉLIMINÉ'; dd.querySelector('em').textContent = `Retour dans ${Math.ceil(me.dead)}`; }
  // noms au-dessus des adversaires visibles
  const cam = S.cam.position; W.pl.forEach((p, k) => {
    const el = X.tagEls[k]; if (!el) return;
    if (k === G.me || p.dead > 0) { el.style.display = 'none'; return; }
    const s = Scene.project(p.x, p.y + 2.1, p.z); let seen = s.vis;
    if (seen) { const dx = p.x - cam.x, dy = p.y + 1.7 - cam.y, dz = p.z - cam.z, L = Math.hypot(dx, dy, dz); for (const b of W.bodies) { if (!b.on || b.ghost || b.ex === undefined) continue; if (Math.abs(cam.x - b.px) > b.ex + L && Math.abs(cam.z - b.pz) > b.ez + L) continue; const h = rayBody(b, cam.x, cam.y, cam.z, dx / L, dy / L, dz / L, L - 0.5); if (h) { seen = false; break; } } }
    el.style.display = seen ? 'block' : 'none'; if (seen) { el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`; el.style.color = colOf(k); el.innerHTML = `${nameOf(k)}<u style="width:${Math.max(0, p.hp)}%"></u>`; }
  });
  $('#cz-board').classList.toggle('on', !!G.keysHeld?.has('Tab'));
  if (G.keysHeld?.has('Tab')) $('#cz-board').innerHTML = `<table><tr><th>Joueur</th><th>Éliminations</th><th>Morts</th></tr>${rows.map((r) => `<tr style="color:${colOf(r.k)}"><td>${nameOf(r.k)}</td><td>${r.p.kills}</td><td>${r.p.deaths}</td></tr>`).join('')}</table>`;
}
