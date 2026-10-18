// LES ENCHAÎNÉS — rendu Three.js : falaise, ciel et mer de nuages, plateformes texturées et décor, deux rôdeurs animés, chaîne à maillons,
// caméra coopérative, effets. Ne décide RIEN du jeu : lit l'état du monde (core/sim.js) et le dessine.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ST, P, groundBelow } from '../core/sim.js';
import * as LV from './levelview.js';
import * as Mechs from './mechs.js';
import * as Sfx from './sfx.js';

export const S = { ready: false };
export const LIB = {}, TEX = {};
const CLIPS = {};
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
export const COL = [0xff9a3c, 0x46b8ff]; // couleurs des deux grimpeurs (interface, marqueurs)

/* ------------------------------ démarrage ------------------------------ */
export function init(canvas) {
  const r = S.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = S.scene = new THREE.Scene();
  sc.fog = new THREE.Fog(0xe9c7a6, 60, 330);
  S.cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 900);
  S.cam.position.set(0, 6, 16);
  // lumière de fin d'après-midi : soleil chaud de côté, ciel bleu, rebond chaud de la falaise
  S.hemi = new THREE.HemisphereLight(0xbcd7ff, 0x7a5a3e, 0.8); sc.add(S.hemi);
  const sun = S.sun = new THREE.DirectionalLight(0xffe0b8, 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sh = sun.shadow.camera; sh.left = -26; sh.right = 26; sh.top = 26; sh.bottom = -26; sh.near = 1; sh.far = 140;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  sc.add(sun); sc.add(sun.target);
  S.sunDir = new THREE.Vector3(-0.78, 0.55, 0.32).normalize();
  makeSky(); makeClouds(); makeRidges();
  // éclairage d'ambiance tiré du ciel (reflets doux sur le métal, la pierre et les tenues)
  { const pm = new THREE.PMREMGenerator(r), tmp = new THREE.Scene(); tmp.add(S.scene.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry').clone()); sc.environment = pm.fromScene(tmp, 0.04).texture; sc.environmentIntensity = 0.55; }
  addEventListener('resize', resize); resize();
  S.fx = []; S.debris = [];
  return S;
}
function resize() { const w = innerWidth || 1280, h = innerHeight || 720; S.renderer.setSize(w, h, false); S.cam.aspect = w / h; S.cam.updateProjectionMatrix(); }

/* ------------------------------ ciel, nuages, montagnes ------------------------------ */
function makeSky() {
  const g = new THREE.SphereGeometry(800, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: S.sunDir }, uTop: { value: new THREE.Color(0x3d73c4) }, uMid: { value: new THREE.Color(0x9ebde8) }, uHor: { value: new THREE.Color(0xffc995) }, uLow: { value: new THREE.Color(0xeeb894) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 uSun, uTop, uMid, uHor, uLow;
      void main(){ float h = vD.y; vec3 top = uTop, mid = uMid, hor = uHor, low = uLow;
        vec3 c = h > 0. ? mix(mix(hor, mid, smoothstep(0.0,0.18,h)), top, smoothstep(0.18,0.75,h)) : mix(hor, low, smoothstep(0.,-0.3,h));
        float s = max(dot(normalize(vD), uSun), 0.); c += vec3(1.,0.8,0.5) * pow(s, 9.) * 0.45 + vec3(1.,0.95,0.85) * smoothstep(0.9975,0.999,s) * 2.;
        gl_FragColor = vec4(c,1.); }` });
  S.sky = new THREE.Mesh(g, m); S.scene.add(S.sky);
}
export const NOISE = `
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`;
function makeClouds() { // mer de nuages sous le parcours : c'est elle qui donne la sensation de vide
  const g = new THREE.PlaneGeometry(1600, 1600, 1, 1); g.rotateX(-Math.PI / 2);
  const m = S.cloudMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uT: { value: 0 }, uSun: { value: S.sunDir }, uTint: { value: new THREE.Color(0xffffff) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: NOISE + `varying vec3 vW; uniform float uT; uniform vec3 uSun, uTint;
      void main(){ vec2 p = vW.xz*0.012 + vec2(uT*0.004, uT*0.0016); float n = fbm(p) * 0.65 + fbm(p*2.7 - uT*0.01) * 0.35;
        float d = length(vW.xz) / 800.; float a = smoothstep(0.32, 0.62, n) * (1. - smoothstep(0.75, 1., d));
        vec3 c = mix(vec3(0.86,0.78,0.78), vec3(1.0,0.95,0.9), smoothstep(0.4,0.8,n)); c = mix(c, vec3(1.,0.8,0.62), 0.25*(1.-uSun.y));
        c *= uTint; gl_FragColor = vec4(mix(c, vec3(0.98,0.83,0.68)*uTint, smoothstep(0.2,0.9,d)), a*0.97); }` });
  for (const [y, s] of [[-22, 1], [-34, 1.4]]) { const mm = s === 1 ? m : m.clone(); if (s !== 1) mm.uniforms = { uT: m.uniforms.uT, uSun: m.uniforms.uSun, uTint: m.uniforms.uTint }; const c = new THREE.Mesh(g, mm); c.position.y = y; c.scale.setScalar(s); c.renderOrder = 1; S.scene.add(c); (S.clouds ||= []).push(c); }
  // fond opaque très bas (rien ne doit laisser voir « sous » le monde)
  const base = S.cloudBase = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xd9b9a8, fog: false })); base.position.y = -45; S.scene.add(base);
}
function makeRidges() { // crêtes lointaines peintes, en couches dans la brume
  const layers = [[520, 0.55, 0x9aa3b8, 0.0], [430, 0.75, 0xb39a96, 3.1], [360, 0.4, 0xc8a090, 6.7]];
  for (const [rad, hk, col, seed] of layers) {
    const g = new THREE.CylinderGeometry(rad, rad, 300, 96, 1, true);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, uniforms: { uC: { value: new THREE.Color(col) }, uS: { value: seed }, uH: { value: hk }, uFog: { value: new THREE.Color(0xfad6b3) } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: NOISE + `varying vec2 vU; uniform vec3 uC, uFog; uniform float uS, uH;
        void main(){ float x = vU.x * 40. + uS; float ridge = 0.32 + uH * (0.55*fbm(vec2(x*0.35, uS)) + 0.25*abs(sin(x*0.9+uS)) * fbm(vec2(x*1.7,uS+3.)));
          if (vU.y > ridge) discard; float k = smoothstep(ridge-0.25, ridge, vU.y); vec3 c = mix(uC*0.92, uC*1.08, k);
          gl_FragColor = vec4(mix(c, uFog, 0.35 + 0.4*(1.-vU.y)), 1.); }` });
    const c = new THREE.Mesh(g, m); c.position.y = 60; S.scene.add(c); (S.ridges ||= []).push(c);
  }
}

/* ------------------------------ chargement ------------------------------ */
export async function load(onProgress) {
  if (S.ready) return;
  const L = new GLTFLoader(), base = new URL('../assets/', import.meta.url);
  const tl = new THREE.TextureLoader();
  const jobs = [];
  let done = 0; const step = (p) => p.then((v) => { onProgress?.(++done / jobs.length); return v; });
  const tex = (n, srgb = true) => step(tl.loadAsync(new URL('tex/' + n, base).href)).then((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; TEX[n] = t; return t; });
  for (const n of ['unevenbrick', 'brick', 'woodtrim', 'trim_metal', 'rocktrim']) { jobs.push(tex(n + '_c.jpg')); jobs.push(tex(n + '_n.jpg', false)); }
  jobs.push(step(L.loadAsync(new URL('chars/ranger_m.glb', base).href)).then((g) => { LIB.m = g; }));
  jobs.push(step(L.loadAsync(new URL('chars/ranger_f.glb', base).href)).then((g) => { LIB.f = g; }));
  jobs.push(step(L.loadAsync(new URL('chars/anims1.glb', base).href)).then((g) => { for (const c of g.animations) { fixClip(c, true); CLIPS[c.name] = c; } }));
  jobs.push(step(L.loadAsync(new URL('chars/anims2.glb', base).href)).then((g) => { for (const c of g.animations) { fixClip(c, false); CLIPS[c.name] = c; } }));
  jobs.push(step(L.loadAsync(new URL('props/props.glb', base).href)).then((g) => { for (const s of g.scenes) for (const o of s.children) LIB[o.name] = o; }));
  await Promise.all(jobs);
  makeMaterials(); makeCharTemplates(); makeChainGeo();
  S.ready = true;
}
// noms d'os de la 1re bibliothèque (Godot) -> convention Unreal des rôdeurs ; on retire l'échelle et la translation des os (sauf le bassin)
function boneName(n) {
  n = n.replace(/^DEF-/, ''); let m;
  if (n === 'hips') return 'pelvis'; if (n === 'neck') return 'neck_01'; if (n === 'head') return 'Head';
  if ((m = n.match(/^spine00(\d)$/))) return 'spine_0' + m[1];
  if ((m = n.match(/^(shoulder|upper_arm|forearm|hand|thigh|shin|foot|toe)([LR])$/))) return { shoulder: 'clavicle', upper_arm: 'upperarm', forearm: 'lowerarm', hand: 'hand', thigh: 'thigh', shin: 'calf', foot: 'foot', toe: 'ball' }[m[1]] + '_' + m[2].toLowerCase();
  if ((m = n.match(/^f_(index|middle|ring|pinky)0(\d)([LR])$/))) return m[1] + '_0' + m[2] + '_' + m[3].toLowerCase();
  if ((m = n.match(/^thumb0(\d)([LR])$/))) return 'thumb_0' + m[1] + '_' + m[2].toLowerCase();
  return n;
}
function fixClip(c, rename) {
  c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || /pelvis|hips|root/.test(t.name)));
  for (const t of c.tracks) { const i = t.name.lastIndexOf('.'); if (rename) t.name = boneName(t.name.slice(0, i)) + t.name.slice(i); }
  // racine fixe : le déplacement vient de la physique, pas de l'animation
  for (const t of c.tracks) if (/^root\.position/.test(t.name)) t.values.fill(0);
}

/* ------------------------------ matériaux ------------------------------ */
// bande d'un atlas « trim » recopiée en texture répétable (ex. les planches claires du haut de woodtrim)
function band(img, v0, v1, copies = 2) {
  const w = 1024, hb = Math.round((v1 - v0) * img.height * (w / img.width)), c = document.createElement('canvas'); c.width = w; c.height = hb * copies;
  const g = c.getContext('2d'); for (let k = 0; k < copies; k++) g.drawImage(img, 0, v0 * img.height, img.width, (v1 - v0) * img.height, 0, k * hb, w, hb);
  return c;
}
function canvasTex(c, srgb) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function makeMaterials() {
  const M = S.mat = {};
  const std = (c, n, o = {}) => new THREE.MeshStandardMaterial({ map: c, normalMap: n, roughness: 0.88, metalness: 0, ...o });
  M.stone = std(TEX['unevenbrick_c.jpg'], TEX['unevenbrick_n.jpg'], { color: 0xf2e6d6 });
  M.brick = std(TEX['brick_c.jpg'], TEX['brick_n.jpg'], { color: 0xf6dcc4 });
  M.rock = std(TEX['unevenbrick_c.jpg'], TEX['unevenbrick_n.jpg'], { color: 0xa9b48a }); // paroi d'escalade : pierre moussue (+ lierre et prises posés dessus)
  const wc = band(TEX['woodtrim_c.jpg'].image, 0.0, 0.29), wn = band(TEX['woodtrim_n.jpg'].image, 0.0, 0.29);
  M.wood = std(canvasTex(wc, true), canvasTex(wn, false), { color: 0xfff1e0 });
  const dc = band(TEX['woodtrim_c.jpg'].image, 0.3, 0.6), dn = band(TEX['woodtrim_n.jpg'].image, 0.3, 0.6);
  M.darkwood = std(canvasTex(dc, true), canvasTex(dn, false));
  M.metal = std(TEX['trim_metal_c.jpg'], TEX['trim_metal_n.jpg'], { roughness: 0.45, metalness: 0.35, color: 0xe8e2d8 });
  M.chain = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.32, metalness: 0.9 });
  for (const k of ['stone', 'brick', 'rock', 'wood', 'darkwood', 'metal']) M[k].userData.tile = k === 'wood' || k === 'darkwood' ? [3.2, 1.8] : [2.6, 2.6];
}
// boîte dont les UV suivent les dimensions réelles (la texture garde la même échelle partout)
export function boxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const a = nx > 0.5 ? d : w, b = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * a / tile[0], uv.getY(i) * b / tile[1]);
  }
  return g;
}

/* ------------------------------ personnages ------------------------------ */
function makeCharTemplates() {
  S.tpl = {};
  for (const k of ['m', 'f']) {
    const g = LIB[k], root = g.scenes[0];
    const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    // la tenue (2e scène) est rebranchée sur le squelette du corps
    for (const o of [...g.scenes[1].children[0]?.children || []]) {
      o.traverse((m) => {
        if (!m.isSkinnedMesh) return;
        // GLTFLoader suffixe les noms en double d'un fichier à plusieurs scènes (« Head_1 ») : on retrouve l'os d'origine
        const pick = (n) => bones[n] || bones[n.replace(/_\d+$/, '')];
        const miss = m.skeleton.bones.filter((b) => !pick(b.name)); if (miss.length) { console.warn('os absents', miss.map((b) => b.name)); return; }
        const sk = new THREE.Skeleton(m.skeleton.bones.map((b) => pick(b.name)), m.skeleton.boneInverses);
        const nm = new THREE.SkinnedMesh(m.geometry, m.material); nm.name = m.name; nm.bind(sk, m.bindMatrix);
        root.children[0].add(nm);
      });
    }
    // corps de base : on n'affiche que la tête (le reste est sous la tenue)
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
      if (/^SuperHero/i.test(o.name)) headOnly(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mt of mats) { mt.roughness = Math.max(0.55, mt.roughness ?? 0.8); if (mt.name === 'MI_Ranger') mt.userData.ranger = true; }
    });
    S.tpl[k] = root;
  }
}
function headOnly(mesh) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
  const keep = new Set(['Head', 'neck_01']), ok = new Uint8Array(si.count);
  for (let i = 0; i < si.count; i++) {
    let wsum = 0; for (let c = 0; c < 4; c++) { const b = mesh.skeleton.bones[si.getComponent(i, c)]; if (b && keep.has(b.name)) wsum += sw.getComponent(i, c); }
    ok[i] = wsum > 0.5 ? 1 : 0;
  }
  const out = []; for (let t = 0; t < idx.count; t += 3) { const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2); if (ok[a] && ok[b] && ok[c]) out.push(a, b, c); }
  const ng = g.clone(); ng.setIndex(out); ng.clearGroups(); mesh.geometry = ng;
}
const ANIMS = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Crouch_Idle_Loop', 'NinjaJump_Idle_Loop', 'Hit_Knockback', 'Dance_Loop', 'Yes', 'Roll', 'Death01', 'LayToIdle'];
function makeClimber(k) {
  const root = cloneSkinned(S.tpl[k ? 'f' : 'm']);
  const tint = new THREE.Color(k ? 0xc4dcff : 0xffe2c4), glow = new THREE.Color(k ? 0x06213f : 0x3a1800);
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => { if (!m.userData.ranger) return m; const c = m.clone(); c.color.copy(tint); c.emissive = glow; return c; });
    o.material = mats.length > 1 ? mats : mats[0];
  });
  const g = new THREE.Group(); g.add(root);
  const mixer = new THREE.AnimationMixer(root), acts = {};
  for (const n of ANIMS) if (CLIPS[n]) { const a = mixer.clipAction(CLIPS[n]); a.enabled = true; a.setEffectiveWeight(0); a.play(); acts[n] = a; }
  for (const n of ['Jump_Start', 'Jump_Land', 'Hit_Knockback', 'Yes', 'Roll', 'Death01', 'LayToIdle']) if (acts[n]) { acts[n].setLoop(THREE.LoopOnce, 1); acts[n].clampWhenFinished = true; }
  const bones = {}; root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // repère de couleur au sol + marqueur de réception
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 40), new THREE.MeshBasicMaterial({ color: COL[k], transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3; S.scene.add(ring);
  const mark = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.44, 32), new THREE.MeshBasicMaterial({ color: COL[k], transparent: true, opacity: 0.0, depthWrite: false, depthTest: false }));
  mark.rotation.x = -Math.PI / 2; mark.renderOrder = 4; S.scene.add(mark);
  S.scene.add(g);
  const c = { k, g, root, mixer, acts, bones, cur: null, w: {}, ring, mark, lastSt: -1, phase: 0, sm: new THREE.Vector3(), yaw: 0, err: new THREE.Vector3(), scale: 1 };
  // échelle : les rôdeurs mesurent ~1,8 m comme la capsule
  setAnim(c, 'Idle_Loop', 0);
  return c;
}
function setAnim(c, name, fade = 0.15, restart = false) {
  if (!c.acts[name]) return;
  if (c.cur === name && !restart) return;
  const a = c.acts[name];
  if (restart || c.cur !== name) { a.reset(); a.play(); }
  for (const [n, act] of Object.entries(c.acts)) if (n !== name) act.fadeOut(fade); else act.setEffectiveWeight(1).fadeIn(fade);
  c.cur = name;
}
// oriente un os pour que son enfant pointe vers une cible monde (IK « à la visée », sans connaître les axes des os)
function aim(bone, child, target, k = 1) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(true, false);
  const bp = V.setFromMatrixPosition(bone.matrixWorld), cp = V2.setFromMatrixPosition(child.matrixWorld);
  const cur = cp.sub(bp).normalize(), want = V3.copy(target).sub(bp).normalize();
  Q.setFromUnitVectors(cur, want);
  if (k < 1) Q.slerp(Q2.identity(), 1 - k);
  bone.getWorldQuaternion(Q2); const parentQ = new THREE.Quaternion(); bone.parent.getWorldQuaternion(parentQ);
  // nouvelle orientation monde = Q * actuelle ; locale = parent^-1 * monde
  const nw = Q.multiply(Q2); bone.quaternion.copy(parentQ.invert().multiply(nw));
}
function armTo(c, side, target, k = 1) {
  const b = c.bones, s = side === 'l' ? 'l' : 'r';
  const up = b['upperarm_' + s], lo = b['lowerarm_' + s], ha = b['hand_' + s];
  if (!up || !lo || !ha) return;
  aim(up, lo, target, k); aim(lo, ha, target, k);
}
function legTo(c, side, target, k = 1) {
  const b = c.bones, s = side === 'l' ? 'l' : 'r';
  const th = b['thigh_' + s], ca = b['calf_' + s], fo = b['foot_' + s];
  if (!th || !ca || !fo) return;
  aim(th, ca, target, k); aim(ca, fo, target, k);
}

/* ------------------------------ chaîne ------------------------------ */
const LINKS = 60;
function makeChainGeo() {
  const g = new THREE.TorusGeometry(0.075, 0.022, 6, 12); g.scale(1, 1.55, 1);
  S.chain = new THREE.InstancedMesh(g, S.mat.chain, LINKS); S.chain.castShadow = true; S.chain.frustumCulled = false; S.scene.add(S.chain);
  // la même chaîne en silhouette, visible à travers le décor : quand le partenaire pend derrière une plateforme, on voit toujours la chaîne
  S.chainGhost = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false }), LINKS);
  S.chainGhost.frustumCulled = false; S.chainGhost.renderOrder = 5; S.scene.add(S.chainGhost);
  S.hangLinks = new THREE.InstancedMesh(g, S.mat.chain, 600); S.hangLinks.castShadow = true; S.hangLinks.count = 0; S.scene.add(S.hangLinks);
  S.curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, () => new THREE.Vector3()), false, 'centripetal');
}
const M4 = new THREE.Matrix4(), UPV = new THREE.Vector3(0, 1, 0), TV = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1);
// chaîne de maillons entre deux points (droite), pour les poutres suspendues et le marteau
export function linkRow(mesh, i0, a, b, phase = 0) {
  const d = TV.copy(b).sub(a), L = d.length(), n = Math.max(2, Math.round(L / 0.2)); d.normalize();
  Q.setFromUnitVectors(UPV, d);
  for (let i = 0; i < n; i++) {
    V.copy(a).addScaledVector(d, (i + 0.5) * (L / n));
    Q2.setFromAxisAngle(d, (i + phase) % 2 ? Math.PI / 2 : 0); const q = Q2.multiply(Q);
    M4.compose(V, q, SC); mesh.setMatrixAt(i0 + i, M4);
  }
  return i0 + n;
}

/* ------------------------------ niveau (voir levelview.js) ------------------------------ */
export async function buildLevel(W) { S.building = true; try { await LV.loadPack(W.level.world || 'medieval'); if (Mechs.needs(W.level)) await Mechs.load(); await (await import('./totems.js')).load(W.level.world || 'medieval'); await (await import('./scatter.js')).load(W.level.world || 'medieval'); LV.build(W); collectLights(); } finally { S.building = false; } }
// préchauffage : envoie TOUT le niveau au GPU avant le départ (textures + géométries de toute la montagne, même hors champ), compile les shaders
export async function warm(report) {
  const r = S.renderer; if (!r || !S.scene) return;
  const seen = new Set(), texs = [];
  S.scene.traverse((o) => { for (const m of [].concat(o.material || [])) for (const k in m) { const t = m[k]; if (t && t.isTexture && !seen.has(t)) { seen.add(t); texs.push(t); } } });
  for (let i = 0; i < texs.length; i++) { try { r.initTexture(texs[i]); } catch { } if (i % 6 === 5) { report?.(i / texs.length); await new Promise((f) => setTimeout(f)); } }
  const meshes = []; S.scene.traverse((o) => { if (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) meshes.push([o, o.frustumCulled]); });
  for (const [o] of meshes) o.frustumCulled = false;
  try { r.compile(S.scene, S.cam); r.render(S.scene, S.cam); } catch { }
  for (const [o, f] of meshes) o.frustumCulled = f;
}
// chaîne de l'écran d'accueil : de VRAIS maillons 3D en métal (tores allongés, un sur deux tourné d'un quart de tour), suspendus devant la caméra,
// qui ondulent doucement. Elle suit la caméra (le fond défile) ; hors de l'accueil elle est masquée.
let HC = null;
export function homeChain(t, on) {
  if (!HC) {
    if (!on || !S.cam || !S.scene) return;
    const geo = new THREE.TorusGeometry(0.21, 0.058, 16, 40); geo.scale(1.45, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9d968c, metalness: 0.95, roughness: 0.36, envMapIntensity: 1.8 });
    const im = new THREE.InstancedMesh(geo, mat, 160); im.frustumCulled = false; im.castShadow = false;
    const g = new THREE.Group(); g.add(im);
    const L1 = new THREE.PointLight(0xffd7a0, 22, 24, 1.3); L1.position.set(-3, 2.5, 5); g.add(L1);
    const L2 = new THREE.PointLight(0x8fb0ff, 9, 24, 1.3); L2.position.set(4, -2, 4); g.add(L2); L1.userData.keep = L2.userData.keep = true;
    S.scene.add(g); HC = { g, im, f: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), p: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1), ax: new THREE.Vector3(1, 0, 0), az: new THREE.Vector3(0, 0, 1) };
  }
  HC.g.visible = !!on; if (!on) return;
  const cam = S.cam, d = 2.6, k = d / 9, halfH = Math.tan((cam.fov * Math.PI) / 360) * 9, halfW = halfH * cam.aspect, L = halfW + 1.4;
  HC.g.position.copy(cam.position).add(HC.f.set(0, 0, -1).applyQuaternion(cam.quaternion).multiplyScalar(d)); HC.g.quaternion.copy(cam.quaternion); HC.g.scale.setScalar(k);
  const y0 = 0.24 * halfH, yAt = (x) => y0 - 0.55 * (1 - (x / L) ** 2) + Math.sin(t * 0.5) * 0.03 * x + Math.sin(t * 0.9) * 0.05 + 0.045 * Math.sin(x * 1.3 - t * 1.6);
  let x = -L, n = 0;
  while (x < L && n < 160) {
    const y = yAt(x), a = Math.atan2(yAt(x + 0.05) - yAt(x - 0.05), 0.1);
    HC.q.setFromAxisAngle(HC.az, a); if (n % 2) { HC.q2.setFromAxisAngle(HC.ax, Math.PI / 2); HC.q.multiply(HC.q2); }
    HC.m.compose(HC.p.set(x, y, 0), HC.q, HC.one); HC.im.setMatrixAt(n++, HC.m); x += 0.47 * Math.cos(a);
  }
  HC.im.count = n; HC.im.instanceMatrix.needsUpdate = true;
}
export function sprite(color, size) {
  if (!S.glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); S.glowTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: S.glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

/* ------------------------------ grimpeurs : pose ------------------------------ */
const ST_ANIM = (p, spd) => {
  if (p.st === ST.GROUND) return p.brace || p.haul || p.cup || p.pushT > 0 ? 'Crouch_Idle_Loop' : spd < 0.35 ? 'Idle_Loop' : spd < 2.6 ? 'Walk_Loop' : 'Jog_Fwd_Loop';
  if (p.st === ST.AIR) return p.knock > 0 ? 'Hit_Knockback' : p.vy > 2 && p.stT < 0.35 ? 'Jump_Start' : 'Jump_Loop';
  return 'Jump_Loop';
};
function poseClimber(c, p, mate, W, dt, rp) {
  const spd = Math.hypot(p.vx - p.gvx, p.vz - p.gvz);
  let a = ST_ANIM(p, spd);
  if (p.st === ST.AIR && p.dangling) a = 'NinjaJump_Idle_Loop';
  if (W.done) a = c.k ? 'Dance_Loop' : 'Yes';
  if (p.downT > 0) {
    const want = p.downT > 0.95 ? 'Death01' : 'LayToIdle';
    if (c.cur !== want) { setAnim(c, want, 0.1, true); const ac = c.acts[want]; if (ac) { if (want === 'Death01') { ac.time = 1.45; ac.timeScale = 1.5; } else ac.timeScale = 1.53 / 0.95; } }
  } else if (p.land > 0.15 && c.lastSt === ST.AIR && p.st === ST.GROUND && c.lastVy < -11) setAnim(c, 'Jump_Land', 0.06, true);
  else if (c.cur !== 'Jump_Land' || c.acts.Jump_Land.time > 0.35) setAnim(c, a, a === 'Jump_Start' ? 0.05 : 0.16);
  if (c.cur === 'Jog_Fwd_Loop') c.acts.Jog_Fwd_Loop.timeScale = Math.max(0.7, spd / 5.4);
  if (c.cur === 'Walk_Loop') c.acts.Walk_Loop.timeScale = Math.max(0.6, spd / 1.8);
  c.lastSt = p.st; c.lastVy = p.vy;
  c.mixer.update(S.hitstop > 0 ? dt * 0.08 : dt); // arrêt sur image de l'impact
  // position et orientation (lissées : le rendu ne doit jamais trembler même si la physique corrige)
  c.g.position.set(rp.x, rp.y, rp.z);
  const koFly = p.ko && p.st === ST.AIR && Math.hypot(p.vx, p.vz) > 1;
  const wantYaw = koFly ? Math.atan2(-p.vx, -p.vz) : p.downT > 0 ? c.yaw : p.yaw;
  let dy = wantYaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * (koFly ? 30 : 16));
  // COUP DE POING : armé (bras ramené en arrière, buste qui pivote à l'opposé), frappe (bras tendu vers le visage, buste qui tourne
  // dans le coup, pas en avant), tenue, retour. sd = +1 main droite, -1 main gauche (tirée au hasard par la simulation)
  let twist = 0, lunge = 0; const pt = p.pT;
  if (pt != null) {
    const sd = p.pSide ? 1 : -1, sm = (x) => x * x * (3 - 2 * x);
    if (pt < 0.09) { const k = sm(pt / 0.09); twist = -sd * 0.42 * k; lunge = -0.06 * k; }
    else if (pt < 0.16) { const k = sm((pt - 0.09) / 0.07); twist = sd * (-0.42 + 0.8 * k); lunge = -0.06 + 0.32 * k; }
    else if (pt < 0.26) { twist = sd * 0.38; lunge = 0.26; }
    else { const k = sm(Math.min(1, (pt - 0.26) / 0.24)); twist = sd * 0.38 * (1 - k); lunge = 0.26 * (1 - k); }
  }
  c.g.rotation.y = c.yaw + twist;
  c.g.position.x += Math.sin(c.yaw) * lunge; c.g.position.z += Math.cos(c.yaw) * lunge;
  if (koFly) c.root.rotation.x = Math.max(-1.5, c.root.rotation.x - dt * 7.5 * (S.hitstop > 0 ? 0.1 : 1)); // vrille vers l'arrière, jusqu'à l'horizontale
  else if (p.st !== ST.ROPE && c.root.rotation.x) c.root.rotation.x *= Math.max(0, 1 - dt * 10); // fin du balancement de liane / de la vrille
  { const a = c.root.rotation.x, h = 0.95; if (p.st !== ST.ROPE && a) c.root.position.set(0, h - h * Math.cos(a), -h * Math.sin(a)); else c.root.position.set(0, 0, 0); }
  // poses procédurales : bras vers le bord, le mur ou la chaîne
  c.root.updateMatrixWorld(true);
  // droite DU GRIMPEUR (face à fwd) : sans ce bon sens, la main gauche visait la droite (bras et jambes croisés à l'escalade)
  const fwd = V3.set(Math.sin(c.yaw), 0, Math.cos(c.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const at = (dx, dy2, dz) => new THREE.Vector3(rp.x + fwd.x * dz + right.x * dx, rp.y + dy2, rp.z + fwd.z * dz + right.z * dx);
  if (p.st === ST.HANG) {
    const sh = Math.sin(c.phase += dt * 6 * Math.abs(p.lat || 0)) * 0.12;
    armTo(c, 'l', at(-0.28 + sh, 2.05, 0.3)); armTo(c, 'r', at(0.28 + sh, 2.05, 0.3));
    legTo(c, 'l', at(-0.15, -0.05, 0.12), 0.7); legTo(c, 'r', at(0.15, 0.0, 0.18), 0.7);
  } else if (p.st === ST.CLIMB) {
    c.phase += dt * 5.5 * (Math.abs(p.climbV || 0) + Math.abs(p.lat || 0) * 0.8);
    const s = Math.sin(c.phase), s2 = Math.cos(c.phase);
    armTo(c, 'l', at(-0.32, 1.75 + s * 0.28, 0.32)); armTo(c, 'r', at(0.32, 1.75 - s * 0.28, 0.32));
    legTo(c, 'l', at(-0.2, 0.25 - s * 0.22, 0.36 + s2 * 0.05), 0.8); legTo(c, 'r', at(0.2, 0.25 + s * 0.22, 0.36 - s2 * 0.05), 0.8);
  } else if (p.st === ST.ROPE && p.rope) { // liane : les deux mains serrent la corde au-dessus de la tête, jambes serrées, le corps suit le balancement
    const r = W.level.ropes[p.rope.i], d = new THREE.Vector3(r.x - rp.x, r.y - (rp.y + 1.1), r.z - rp.z).normalize();
    const w = new THREE.Vector3(rp.x, rp.y + 1.1, rp.z);
    armTo(c, 'l', w.clone().addScaledVector(d, 1.05).addScaledVector(right, -0.04), 0.95); armTo(c, 'r', w.clone().addScaledVector(d, 0.82).addScaledVector(right, 0.04), 0.95);
    legTo(c, 'l', at(-0.08, -0.05, 0.1), 0.8); legTo(c, 'r', at(0.08, -0.02, 0.16), 0.8);
    const tilt = Math.max(-0.6, Math.min(0.6, Math.atan2(-(r.x - rp.x) * fwd.x - (r.z - rp.z) * fwd.z, r.y - rp.y)));
    c.root.rotation.x += (tilt - c.root.rotation.x) * Math.min(1, dt * 8);
  } else if (p.st === ST.MANTLE) {
    const k = Math.min(1, (p.mantle?.t || 0) / P.MANTLE_T);
    armTo(c, 'l', at(-0.3, 2.0 - k * 1.2, 0.35 + k * 0.1)); armTo(c, 'r', at(0.3, 2.0 - k * 1.2, 0.35 + k * 0.1));
  } else if (p.dangling || (p.st === ST.AIR && W.taut > 0.6 && mate.y > p.y + 1)) {
    // pendu à la chaîne : les deux mains serrent les maillons au-dessus de la ceinture
    const n = W.ch[p.id ? W.ch.length - 2 : 1]; const tgt = new THREE.Vector3(n.x, n.y, n.z);
    armTo(c, 'l', tgt.clone().add(right.clone().multiplyScalar(-0.08)), 0.9); armTo(c, 'r', tgt.clone().add(right.clone().multiplyScalar(0.08)), 0.9);
  } else if (p.st === ST.GROUND && (p.cup || p.pushT > 0)) { // courte échelle : mains jointes en coupe devant les genoux ; la poussée les lève au-dessus de la tête
    const k = p.pushT > 0 ? Math.sin(Math.min(1, (0.4 - p.pushT) / 0.25) * Math.PI / 2) : 0, y = 0.72 + k * 1.25, z = 0.42 - k * 0.1;
    armTo(c, 'l', at(-0.05, y, z), 0.95); armTo(c, 'r', at(0.05, y, z), 0.95);
  } else if (p.st === ST.GROUND && (p.brace || p.haul) && W.taut > 0.4) {
    const n = W.ch[p.id ? W.ch.length - 2 : 1]; const tgt = new THREE.Vector3(n.x, n.y, n.z);
    armTo(c, 'l', tgt, 0.8); armTo(c, 'r', tgt, 0.8);
  }
  if (pt != null && pt < 0.5 && (p.st === ST.GROUND || p.st === ST.AIR)) {
    const sd = p.pSide ? 1 : -1, s = sd > 0 ? 'r' : 'l', o = sd > 0 ? 'l' : 'r';
    const fist = pt < 0.09 ? at(sd * 0.34, 1.2, -0.32) : pt < 0.26 ? at(sd * 0.05, 1.5, 1.0) : at(sd * 0.3, 1.25 - (pt - 0.26), 0.25);
    const k = pt < 0.26 ? 1 : Math.max(0, 1 - (pt - 0.26) / 0.24);
    armTo(c, s, fist, k); armTo(c, o, at(-sd * 0.14, 1.45, 0.32), 0.8 * k); // l'autre poing en garde devant le menton
  }
  // repère au sol et marqueur de réception (là où l'on va retomber)
  const gr = groundBelow(W, p.x, p.y + 0.05, p.z, 60);
  c.ring.position.set(rp.x, (gr ? gr.y : rp.y) + 0.03, rp.z);
  c.ring.material.opacity = p.st === ST.GROUND ? 0.75 : 0.0;
  if (p.st === ST.AIR && gr && p.y - gr.y > 0.8) { c.mark.position.set(p.x, gr.y + 0.04, p.z); const h = p.y - gr.y; c.mark.scale.setScalar(0.8 + Math.min(2, h * 0.08)); c.mark.material.opacity = Math.min(0.9, 0.3 + h * 0.08); }
  else c.mark.material.opacity = 0;
}

/* ------------------------------ effets ------------------------------ */
function puff(x, y, z, n = 8, col = 0xd8c3a5, size = 0.5, up = 1) {
  for (let i = 0; i < n; i++) {
    const s = sprite(col, size); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.55; s.position.set(x, y + 0.1, z);
    const a = (i / n) * Math.PI * 2 + Math.random(); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 0.6 + Math.random() * 0.3, v: new THREE.Vector3(Math.cos(a) * 2.2, up * (0.5 + Math.random()), Math.sin(a) * 2.2), grow: 1.8 });
  }
}
const CONF = [0xff9a3c, 0x46b8ff, 0xffd27a, 0xff5d8f, 0x7be08c];
function confetti(x, y, z) {
  for (let i = 0; i < 6; i++) {
    const s = sprite(CONF[(Math.random() * CONF.length) | 0], 0.32); s.material.blending = THREE.NormalBlending; s.position.set(x, y, z); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 1.6 + Math.random(), v: new THREE.Vector3((Math.random() - 0.5) * 8, 5 + Math.random() * 5, (Math.random() - 0.5) * 8), g: 9, grow: 0 });
  }
}
function sparks(x, y, z, n = 10) {
  for (let i = 0; i < n; i++) {
    const s = sprite(0xffd890, 0.22); s.position.set(x, y, z); S.scene.add(s);
    S.fx.push({ o: s, t: 0, life: 0.35 + Math.random() * 0.25, v: new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 5, (Math.random() - 0.5) * 7), g: 14, grow: 0.3 });
  }
}
export function onEvent(W, e) {
  if (!S.ready) return;
  const p = e.p != null ? W.pl[e.p] : null;
  if (e.k === 'land' && p && e.v > 6) { puff(e.x, e.y, e.z, Math.min(14, 4 + e.v * 0.6), 0xd8c3a5, 0.45 + e.v * 0.03); if (e.v > 14) shake(Math.min(0.5, e.v * 0.02)); }
  else if (e.k === 'jump' && p && !e.wall) puff(p.x, p.y, p.z, 4, 0xd8c3a5, 0.35, 0.4);
  else if (e.k === 'jerk') { sparks(e.x, e.y, e.z, Math.min(18, 4 + e.v * 1.5)); shake(Math.min(0.35, e.v * 0.03)); }
  else if (e.k === 'grab' && p) sparks(p.x, p.y + 2, p.z, 3);
  else if (e.k === 'hit' && p) { sparks(e.x, e.y, e.z, 14); shake(0.3); }
  else if (e.k === 'punch') { S.hitstop = 0.085; shake(0.55); impact(e.x, e.y, e.z, e.ux, e.uz); sparks(e.x, e.y, e.z, 10); }
  else if (e.k === 'down' && p) { puff(e.x, e.y, e.z, 12, 0xd8c3a5, 0.55, 0.6); shake(0.18); stars(e.p); }
  else if (e.k === 'collapse') { const m = S.bodyMesh[e.b]; if (m) dropDebris(m); puff(e.x, e.y, e.z, 10, 0xb08a66, 0.6, -0.5); }
  else if (e.k === 'checkpoint') { const c = S.cps[e.cp]; if (c) { c.on = true; c.flash = 1.2; } puff(e.x, e.y, e.z, 16, 0xffd27a, 0.6, 2); }
  else if (e.k === 'respawn') { S.camSnap = true; for (const c of S.cl || []) c.err.set(0, 0, 0); }
}
// éclat blanc + onde de choc dans le sens du coup (sprites additifs, très courts)
function impact(x, y, z, ux = 0, uz = 0) {
  const f = sprite(0xffffff, 1.6); f.position.set(x, y, z); S.scene.add(f); S.fx.push({ o: f, t: 0, life: 0.14, v: new THREE.Vector3(), grow: 6 });
  const r = sprite(0xffe0a0, 0.8); r.position.set(x, y, z); S.scene.add(r); S.fx.push({ o: r, t: 0, life: 0.32, v: new THREE.Vector3(ux * 6, 0.5, uz * 6), grow: 9 });
  for (let i = 0; i < 6; i++) { const s = sprite(0xfff4d0, 0.18); s.position.set(x, y, z); S.scene.add(s); const a = (i / 6) * Math.PI * 2; S.fx.push({ o: s, t: 0, life: 0.28, v: new THREE.Vector3(ux * 7 + Math.cos(a) * 3, Math.sin(a) * 3 + 1, uz * 7 + Math.sin(a) * 3), g: 6, grow: 0 }); }
}
// étoiles qui tournent au-dessus de la tête du grimpeur sonné, le temps qu'il se relève
function stars(k) { S.stars ||= []; for (let i = 0; i < 3; i++) { const s = sprite(0xffe066, 0.32); S.scene.add(s); S.stars.push({ o: s, k, a: (i / 3) * Math.PI * 2, t: 0 }); } }
function stepStars(W, dt) {
  if (!S.stars?.length) return;
  for (let i = S.stars.length - 1; i >= 0; i--) {
    const s = S.stars[i], p = W.pl[s.k], c = S.cl[s.k]; s.t += dt; s.a += dt * 6;
    if (!p || !(p.downT > 0) || s.t > 2) { S.scene.remove(s.o); S.stars.splice(i, 1); continue; }
    const hd = c.bones.Head; if (hd) hd.getWorldPosition(V); else V.set(p.x, p.y + 1.7, p.z);
    s.o.position.set(V.x + Math.cos(s.a) * 0.35, V.y + 0.3 + Math.sin(s.a * 2) * 0.05, V.z + Math.sin(s.a) * 0.35);
  }
}
function dropDebris(m) { const d = m.clone(true); S.scene.add(d); d.position.copy(m.position); S.debris.push({ o: d, t: 0, v: 0, r: (Math.random() - 0.5) * 2 }); }
export function shake(a) { S.shake = Math.max(S.shake || 0, a); }
function stepFx(dt) {
  for (let i = S.fx.length - 1; i >= 0; i--) {
    const f = S.fx[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { S.scene.remove(f.o); f.o.material.dispose(); S.fx.splice(i, 1); continue; }
    if (f.g) f.v.y -= f.g * dt; f.v.multiplyScalar(1 - dt * 2.5); f.o.position.addScaledVector(f.v, dt);
    f.o.scale.setScalar(f.o.scale.x * (1 + f.grow * dt)); f.o.material.opacity = (f.o.material.blending === THREE.AdditiveBlending ? 1 : 0.55) * (1 - k);
  }
  for (let i = S.debris.length - 1; i >= 0; i--) {
    const d = S.debris[i]; d.t += dt; d.v += 22 * dt; d.o.position.y -= d.v * dt; d.o.rotation.z += d.r * dt; d.o.rotation.x += d.r * 0.6 * dt;
    if (d.t > 2.5) { S.scene.remove(d.o); S.debris.splice(i, 1); }
  }
}

/* ------------------------------ caméra coopérative ------------------------------ */
// suit le milieu des deux grimpeurs (en ligne : penche vers soi), recule quand ils s'écartent, regarde un peu au-dessus (on grimpe),
// tourne avec la souris ; amortie (ressort critique) pour ne jamais trembler ; ne lâche pas un grimpeur qui tombe tant que l'autre est visible
// cadrages par zone (données du parcours : cams) : side = profil (défaut), three = trois-quarts, behind = derrière, far = recul pour les
// grandes structures, tunnel = rapproché ; on y glisse en douceur. La souris ajoute un décalage personnel qui revient peu à peu à zéro.
const MODES = { side: { yaw: 0, pitch: 0.24, dist: 0 }, three: { yaw: 0.5, pitch: 0.3, dist: 0 }, behind: { yaw: 0, pitch: 0.38, dist: -4 }, far: { yaw: 0, pitch: 0.2, dist: 5 }, tunnel: { yaw: 0, pitch: 0.16, dist: -3.5 } };
const CAM = { yaw: 0, pitch: 0.24, dist: 14, uyaw: 0, upitch: 0, zyaw: 0, zpitch: 0.24, zdist: 0, tgt: new THREE.Vector3(), vel: new THREE.Vector3(), init: false, mode: 'side' };
export function camInput(dyaw, dpitch, zoom) { CAM.uyaw += dyaw; CAM.upitch = Math.max(-0.4, Math.min(0.6, CAM.upitch + dpitch)); CAM.lastUser = performance.now(); if (zoom) CAM.zoom = Math.max(-4, Math.min(8, (CAM.zoom || 0) + zoom)); }
export const camMode = () => CAM.mode;
function camZone(L, x, y, z) {
  for (const c of L.cams || []) if (x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && z >= c.min[2] && z <= c.max[2]) return c;
  return null;
}
export const camYaw = () => CAM.yaw;
// direction des commandes d'un grimpeur : l'angle VISÉ par le cadrage (pas l'angle en cours de rotation), et FIGÉ tant qu'il n'est pas
// au sol — un saut part droit et reste droit même si la caméra tourne pendant le vol (sinon « tout droit » dérive en diagonale)
CAM.ctrl = [0, 0];
// … et figé aussi tant qu'on TIENT une direction : la caméra qui bascule seule (zone, retour du cadrage) ne dévie plus une course « tout droit »
// (on suit la caméra si le joueur la tourne lui-même) ; à moins de 0,3 rad du cadrage de la zone, on prend l'axe exact (2,2 m de pont = aucune dérive permise).
export function controlYaw(k, p, held) {
  const user = performance.now() - (CAM.lastUser || 0) < 300;
  if ((!p || p.st === 0) && (!held || user)) { let y = CAM.nomYaw ?? CAM.yaw; const b = CAM.baseYaw ?? 0; if (Math.abs(Math.atan2(Math.sin(y - b), Math.cos(y - b))) < 0.3) y = b; CAM.ctrl[k] = y; }
  return CAM.ctrl[k];
}
function camera(W, rp, me, dt) {
  const [a, b] = rp, wMe = me == null ? 0.5 : me === 0 ? 0.68 : 0.32;
  const sep = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  // un grimpeur qui chute très bas : on garde l'autre au centre (la chute reste lisible sans perdre celui qui tient)
  let wa = wMe; if (a.y < b.y - 14) wa = Math.max(0.15, wa - 0.35); if (b.y < a.y - 14) wa = Math.min(0.85, wa + 0.35);
  const tx = a.x * wa + b.x * (1 - wa), ty = a.y * wa + b.y * (1 - wa) + 2.2, tz = a.z * wa + b.z * (1 - wa);
  const want = V.set(tx, ty, tz);
  if (!CAM.init || S.camSnap) { CAM.tgt.copy(want); CAM.vel.set(0, 0, 0); CAM.init = true; S.camSnap = false; }
  // ressort amorti (pas de saccades), plus raide à la verticale pour suivre les chutes
  const kx = 22, ky = 30, dx = want.x - CAM.tgt.x, dyy = want.y - CAM.tgt.y, dz = want.z - CAM.tgt.z;
  CAM.vel.x += (dx * kx - CAM.vel.x * 2 * Math.sqrt(kx)) * dt; CAM.vel.y += (dyy * ky - CAM.vel.y * 2 * Math.sqrt(ky)) * dt; CAM.vel.z += (dz * kx - CAM.vel.z * 2 * Math.sqrt(kx)) * dt;
  CAM.tgt.addScaledVector(CAM.vel, dt);
  // cadrage de la zone où se trouve la cordée
  // la zone ne change qu'après 0,4 s passées dans la nouvelle (pas de bascule d'avant en arrière à la limite de deux zones)
  const cand = camZone(W.level, CAM.tgt.x, CAM.tgt.y - 2.2, CAM.tgt.z);
  if (cand !== CAM.zone) { if (cand === CAM.cand) CAM.candT += dt; else { CAM.cand = cand; CAM.candT = 0; } if (CAM.candT > 0.4 || !CAM.seen) CAM.zone = cand; }
  CAM.seen = true;
  const zc = CAM.zone, md = MODES[zc?.mode || 'side'] || MODES.side; CAM.mode = zc?.mode || 'side';
  const k = Math.min(1, dt * 0.9);
  CAM.baseYaw = zc?.yaw ?? md.yaw; CAM.nomYaw = CAM.baseYaw + CAM.uyaw;
  CAM.zyaw += ((zc?.yaw ?? md.yaw) - CAM.zyaw) * k; CAM.zpitch += ((zc?.pitch ?? md.pitch) - CAM.zpitch) * k; CAM.zdist += ((md.dist + (zc?.dist || 0) * (zc?.mode === 'far' ? 1 : 0)) - CAM.zdist) * k;
  if (performance.now() - (CAM.lastUser || 0) > 4000) { CAM.uyaw *= 1 - dt * 0.4; CAM.upitch *= 1 - dt * 0.4; } // le cadrage revient au réglage de la zone
  CAM.yaw = CAM.zyaw + CAM.uyaw; CAM.pitch = Math.max(-0.15, Math.min(0.85, CAM.zpitch + CAM.upitch));
  const dist = Math.max(7, Math.min(30, 13 + sep * 0.8 + (CAM.zoom || 0) + CAM.zdist));
  CAM.dist += (dist - CAM.dist) * Math.min(1, dt * 2.5);
  const yaw = CAM.yaw, pitch = CAM.pitch;
  const cx = CAM.tgt.x + Math.sin(yaw) * Math.cos(pitch) * CAM.dist, cy = CAM.tgt.y + Math.sin(pitch) * CAM.dist, cz = CAM.tgt.z + Math.cos(yaw) * Math.cos(pitch) * CAM.dist;
  let px = cx, py = cy, pz = cz;
  // la caméra ne passe jamais derrière la falaise
  if (pz < -5) pz = -5;
  if (S.debugCam) { // caméra libre (fond du menu, tests)
    const [lx, ly, lz] = S.debugCam.look; S.cam.position.set(...S.debugCam.pos); S.cam.lookAt(lx, ly, lz);
    S.sun.position.set(lx + S.sunDir.x * 60, ly + S.sunDir.y * 60, lz + S.sunDir.z * 60); S.sun.target.position.set(lx, ly, lz); return;
  }
  const sh = S.shake || 0; S.shake = Math.max(0, sh - dt * 1.6);
  S.cam.position.set(px + (Math.random() - 0.5) * sh * 0.4, py + (Math.random() - 0.5) * sh * 0.4, pz);
  S.cam.lookAt(CAM.tgt.x, CAM.tgt.y + 0.6, CAM.tgt.z);
  // l'ombre du soleil suit la zone de jeu
  S.sun.position.set(CAM.tgt.x + S.sunDir.x * 60, CAM.tgt.y + S.sunDir.y * 60, CAM.tgt.z + S.sunDir.z * 60); S.sun.target.position.copy(CAM.tgt);
}

/* ------------------------------ performances ------------------------------ */
// 1) lumières ponctuelles : chaque lumière alourdit le calcul de TOUS les pixels ; on n'allume que les PL_MAX plus proches de la cordée
//    (nombre constant d'une image à l'autre : pas de recompilation des shaders). 2) qualité adaptative : si la moyenne passe sous 45 puis
//    35 images/s, on baisse la résolution interne, puis les ombres. 3) compteur d'images/s (S.fps) affiché par le HUD.
let PL = [], plT = 0, PL_MAX = 4;
const PV = new THREE.Vector3();
export function collectLights() { PL = []; S.scene.traverse((o) => { if (o.isPointLight && !o.userData.keep) PL.push(o); }); plT = 0; }
const QP = { t: 0, n: 0, lvl: 0, hold: 0 };
function perf(dt) {
  if ((plT -= dt) <= 0 && PL.length) {
    plT = 0.25; const c = CAM.tgt;
    for (const l of PL) { l.getWorldPosition(PV); l.userData.d = PV.distanceToSquared(c); }
    PL.sort((a, b) => a.userData.d - b.userData.d);
    PL.forEach((l, i) => { l.visible = i < PL_MAX; });
  }
  QP.t += dt; QP.n++;
  if (QP.t >= 1) {
    S.fps = Math.round(QP.n / QP.t); QP.t = 0; QP.n = 0;
    if (S.fps < (QP.lvl === 0 ? 45 : 35) && QP.lvl < 3) { if (++QP.hold >= 3) { QP.hold = 0; lower(++QP.lvl); } } else QP.hold = 0;
  }
}
function lower(lvl) { // paliers : résolution, puis ombres plus petites, puis moins de lumières et ombres coupées
  const r = S.renderer;
  if (lvl === 1) { r.setPixelRatio(Math.min(1, devicePixelRatio || 1)); resize(); }
  if (lvl === 2) { r.setPixelRatio(0.8); resize(); S.sun.shadow.mapSize.set(1024, 1024); S.sun.shadow.map?.dispose(); S.sun.shadow.map = null; PL_MAX = 2; plT = 0; }
  if (lvl === 3) { S.sun.castShadow = false; PL_MAX = 1; plT = 0; }
  console.info('[perf] qualité réduite, palier', lvl, '(', S.fps, 'images/s )');
}

/* ------------------------------ image ------------------------------ */
export function setRoster(n = 2) {
  for (const c of S.cl || []) { S.scene.remove(c.g); S.scene.remove(c.ring); S.scene.remove(c.mark); }
  S.cl = [makeClimber(0), makeClimber(1)];
  CAM.init = false; CAM.seen = false; CAM.zone = null;
}
const PO = { x: 0, y: 0, z: 0, yaw: 0 }, HA = new THREE.Vector3(), HB = new THREE.Vector3();
export function frame(W, dt, view = {}) {
  if (!S.ready || !S.cl || S.building) return;
  { const w = innerWidth || 1280, h = innerHeight || 720; if (w !== S.w || h !== S.h) { S.w = w; S.h = h; resize(); } } // taille de la fenêtre (aussi quand l'événement resize n'arrive pas)
  const t = (S.t = (S.t || 0) + dt);
  S.cloudMat.uniforms.uT.value = t;
  LV.update(W, dt, t); Sfx.listen(S.cam);
  // grimpeurs (positions de rendu lissées)
  const rp = W.pl.map((p, k) => { const c = S.cl[k]; c.err.multiplyScalar(Math.max(0, 1 - dt * 12)); return { x: p.x + c.err.x, y: p.y + c.err.y, z: p.z + c.err.z }; });
  S.hitstop = Math.max(0, (S.hitstop || 0) - dt);
  for (let k = 0; k < 2; k++) poseClimber(S.cl[k], W.pl[k], W.pl[1 - k], W, dt, rp[k]);
  stepStars(W, dt);
  // chaîne : courbe passant par les maillons de la simulation, attachée aux ceintures
  // maillons de rendu lissés : en ligne, l'instantané du serveur recale la chaîne 30 fois par seconde ; on la rejoint en douceur au lieu de sauter
  const C = W.ch, pts = S.curve.points, kc = S.chainInit ? Math.min(1, dt * 22) : 1; S.chainInit = true;
  for (let i = 0; i < C.length; i++) { const p = pts[i]; if (p.distanceToSquared(V.set(C[i].x, C[i].y, C[i].z)) > 9) p.copy(V); else p.lerp(V, kc); }
  for (const k of [0, 1]) { const c = S.cl[k], belt = c.bones.pelvis; if (belt) { belt.getWorldPosition(V); pts[k ? C.length - 1 : 0].copy(V).add(V2.set(0, 0.02, 0)); } }
  const len = S.curve.getLength(), n = Math.min(LINKS, Math.max(8, Math.round(len / 0.13)));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n; S.curve.getPointAt(u, V); S.curve.getTangentAt(u, V2);
    Q.setFromUnitVectors(UPV, V2); Q2.setFromAxisAngle(V2, i % 2 ? Math.PI / 2 : 0); M4.compose(V, Q2.multiply(Q), SC); S.chain.setMatrixAt(i, M4);
  }
  S.chain.count = W.alone ? 0 : n; S.chain.instanceMatrix.needsUpdate = true; // mode test solo : ni chaîne ni partenaire
  S.cl[1].g.visible = !W.alone; S.cl[1].ring.visible = !W.alone;
  S.chainGhost.instanceMatrix = S.chain.instanceMatrix; S.chainGhost.count = W.alone ? 0 : n;
  // tension : la chaîne chauffe un peu (lisibilité)
  S.mat.chain.emissive.setRGB(W.ten * 0.35, W.ten * 0.12, 0);
  // points de passage
  for (let i = 0; i < S.cps.length; i++) {
    const c = S.cps[i], on = i <= W.cpMax;
    if (c.ban) c.ban.traverse((o) => { if (o.isMesh && o.userData.ban) o.material.color.setHex(on ? 0xffd27a : 0x8a9bb0); });
    c.flash = Math.max(0, (c.flash || 0) - dt); c.glow.material.opacity = c.flash > 0 ? c.flash : on && i === W.cp ? 0.35 + Math.sin(t * 3) * 0.1 : 0;
  }
  // arrivée au sommet : confettis et caméra qui tourne lentement autour de la cordée
  if (W.done) {
    if (Math.random() < dt * 14) { const p = W.pl[Math.random() < 0.5 ? 0 : 1]; confetti(p.x, p.y + 2.5, p.z); }
    CAM.uyaw += dt * 0.35; CAM.lastUser = performance.now();
  }
  stepFx(dt);
  camera(W, rp, view.me, dt);
  perf(dt);
  S.renderer.render(S.scene, S.cam);
}
// recalage doux : écart entre l'état prédit et l'état corrigé, absorbé visuellement
export function addError(k, dx, dy, dz) { const c = S.cl?.[k]; if (c) { c.err.x += dx; c.err.y += dy; c.err.z += dz; if (c.err.length() > 3) c.err.set(0, 0, 0); } }
export function project(x, y, z) { V.set(x, y, z).project(S.cam); return { x: (V.x * 0.5 + 0.5) * innerWidth, y: (-V.y * 0.5 + 0.5) * innerHeight, vis: V.z < 1 }; }
// débogage : boîtes de collision, faces escaladables, maillons
export function debugDraw(W, on) {
  if (!on) { if (S.dbg) { S.scene.remove(S.dbg); S.dbg = null; } return; }
  if (!S.dbg) {
    S.dbg = new THREE.Group(); S.scene.add(S.dbg); S.dbgBoxes = [];
    for (const b of W.bodies) {
      if (b.cliff) { S.dbgBoxes.push(null); continue; }
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, b.h, b.d)), new THREE.LineBasicMaterial({ color: b.climb ? 0x44ff88 : b.hit ? 0xff3333 : b.crumble ? 0xffaa00 : 0x66ccff, depthTest: false }));
      e.renderOrder = 9; S.dbg.add(e); S.dbgBoxes.push(e);
    }
    S.dbgNodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false }), 13); S.dbgNodes.renderOrder = 10; S.dbg.add(S.dbgNodes);
  }
  for (const b of W.bodies) { const e = S.dbgBoxes[b.i]; if (!e) continue; e.position.set(b.px, b.py, b.pz); e.rotation.y = b.yaw; e.visible = b.on; }
  W.ch.forEach((n, i) => { M4.makeTranslation(n.x, n.y, n.z); S.dbgNodes.setMatrixAt(i, M4); }); S.dbgNodes.instanceMatrix.needsUpdate = true;
}
