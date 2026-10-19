// LES ENCHAÎNÉS — personnages 3D riggés fournis par le propriétaire (assets/characters). Chargés à la demande, jamais décimés : maillage, textures et matériaux d'origine
// (seule différence : les textures 4096² des versions *_web.glb sont en 2048² WebP — tools/lighten_glb.py ; les originaux restent dans le dossier).
// Les animations du jeu (Quaternius UAL : course, saut, glissade, mort…) sont RECIBLÉES sur chaque squelette au chargement : pour chaque image et chaque os principal, on mesure où
// pointe l'os dans l'animation d'origine (direction vers son enfant, en repère monde) et on oriente l'os du personnage vers la même direction, avec la même torsion autour de son axe ;
// le bassin suit la rotation du bassin d'origine et son déplacement, mis à l'échelle de la longueur des jambes. Les deux squelettes n'ont donc pas besoin d'avoir la même pose de repos
// (T, A…) ni les mêmes axes locaux. Les os de cheveux, de vêtements et d'accessoires restent à leur pose de repos.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const HEIGHT = 1.75; // la capsule du joueur fait 1,75 m : tous les personnages sont mis à cette taille
const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

// noms canoniques (ceux du squelette du jeu) -> noms d'os de chaque modèle, côté gauche (l) et droit (r) ; `{s}` = L / R, `{k}` = _l / _r
const side = (tpl) => (s) => tpl.replace(/\{s\}/g, s === 'l' ? 'L' : 'R');
function mixamo() {
  const m = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head' };
  const out = {}; for (const [k, v] of Object.entries(m)) out[k] = 'mixamorig:' + v;
  for (const s of ['l', 'r']) { const S = s === 'l' ? 'Left' : 'Right', P = 'mixamorig:' + S;
    Object.assign(out, { ['clavicle_' + s]: P + 'Shoulder', ['upperarm_' + s]: P + 'Arm', ['lowerarm_' + s]: P + 'ForeArm', ['hand_' + s]: P + 'Hand', ['thigh_' + s]: P + 'UpLeg', ['calf_' + s]: P + 'Leg', ['foot_' + s]: P + 'Foot', ['ball_' + s]: P + 'ToeBase' });
    for (const [f, F] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) { for (let i = 1; i <= 3; i++) out[`${f}_0${i}_${s}`] = `${P}Hand${F}${i}`; out[`${f}_04_leaf_${s}`] = `${P}Hand${F}4`; } }
  return out;
}
function rigify() {
  const out = { pelvis: 'spine', spine_01: 'spine.001', spine_02: 'spine.002', spine_03: 'spine.003', neck_01: 'neck', Head: 'head' };
  for (const s of ['l', 'r']) { const S = s === 'l' ? 'L' : 'R';
    Object.assign(out, { ['clavicle_' + s]: `shoulder.${S}`, ['upperarm_' + s]: `upper_arm.${S}`, ['lowerarm_' + s]: `forearm.${S}`, ['hand_' + s]: `hand.${S}`, ['thigh_' + s]: `thigh.${S}`, ['calf_' + s]: `shin.${S}`, ['foot_' + s]: `foot.${S}`, ['ball_' + s]: `toe.${S}` });
    out[`thumb_01_${s}`] = `thumb_0.${S}`; out[`thumb_02_${s}`] = `thumb_1.${S}`; out[`thumb_03_${s}`] = `thumb_2.${S}`; out[`thumb_04_leaf_${s}`] = `thumb_2.${S}_end`;
    for (const f of ['index', 'middle', 'ring', 'pinky']) { for (let i = 1; i <= 3; i++) out[`${f}_0${i}_${s}`] = `${f}_${i}.${S}`; out[`${f}_04_leaf_${s}`] = `${f}_3.${S}_end`; } }
  return out;
}
function valorant() {
  const out = { pelvis: 'Pelvis', spine_01: 'Spine1', spine_02: 'Spine2', spine_03: 'Spine3', neck_01: 'Neck', Head: 'Head' };
  for (const s of ['l', 'r']) { const S = s === 'l' ? 'L' : 'R';
    Object.assign(out, { ['clavicle_' + s]: `${S}_Clavicle`, ['upperarm_' + s]: `${S}_Shoulder`, ['lowerarm_' + s]: `${S}_Elbow`, ['hand_' + s]: `${S}_Hand`, ['thigh_' + s]: `${S}_Hip`, ['calf_' + s]: `${S}_Knee`, ['foot_' + s]: `${S}_Foot`, ['ball_' + s]: `${S}_Toe` });
    for (const [f, F] of [['thumb', 'Thumb'], ['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Pinky']]) for (let i = 1; i <= 3; i++) out[`${f}_0${i}_${s}`] = `${S}_${F}${i}`; }
  return out;
}
export const CHARS = [
  { id: 'anime', label: 'Anime (cheveux roses)', file: 'anime_girl_character_free_gameready_animated_web.glb', map: mixamo(), skinnedOnly: true },
  { id: 'cyber', label: 'Cyber', file: 'cyber_girl_web.glb', map: rigify(), skinnedOnly: true },
  { id: 'deadlock', label: 'Deadlock', file: 'deadlock__valorant_web.glb', map: valorant(), skinnedOnly: true },
];
const BYID = Object.fromEntries(CHARS.map((c) => [c.id, c]));
// chaînes d'os : chaque os est orienté vers son « enfant » canonique ; twist : on recopie aussi la torsion autour de l'axe ; delta : os sans enfant (bassin, tête), on recopie sa rotation
const CHILD = { spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head', clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r', upperarm_l: 'lowerarm_l', upperarm_r: 'lowerarm_r', lowerarm_l: 'hand_l', lowerarm_r: 'hand_r',
  hand_l: 'middle_01_l', hand_r: 'middle_01_r', thigh_l: 'calf_l', thigh_r: 'calf_r', calf_l: 'foot_l', calf_r: 'foot_r', foot_l: 'ball_l', foot_r: 'ball_r' };
for (const s of ['l', 'r']) for (const f of ['thumb', 'index', 'middle', 'ring', 'pinky']) { CHILD[`${f}_01_${s}`] = `${f}_02_${s}`; CHILD[`${f}_02_${s}`] = `${f}_03_${s}`; CHILD[`${f}_03_${s}`] = `${f}_04_leaf_${s}`; }
const TWIST = new Set(['spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r']);
const DELTA = ['pelvis', 'Head'];

const LOADED = {}; // id -> { scene, scale, dy, restQ, clips }
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const dirOf = (a, b, out) => out.copy(b).sub(a).normalize();

// os canoniques d'un modèle : { canonique -> Object3D }
// les noms d'os des fichiers portent un numéro d'ordre (« mixamorig:Hips_01 », « L_Hand_37 ») : on compare sans lui
const base = (n) => n.replace(/_\d+$/, '');
function bonesOf(root, map) { const by = {}; root.traverse((o) => { if (o.isBone) { const k = base(o.name); if (!by[k]) by[k] = o; } }); const out = {}; for (const [c, raw] of Object.entries(map)) { const b = by[san(raw)]; if (b) out[c] = b; } return out; }
const wpos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const wquat = (o) => o.getWorldQuaternion(new THREE.Quaternion());

export async function load(id) {
  const def = BYID[id]; if (!def) return null; if (LOADED[id]) return LOADED[id];
  const g = await new GLTFLoader().loadAsync(new URL('../assets/characters/' + def.file, import.meta.url).href);
  const scene = g.scene;
  // éléments qui ne sont pas le personnage (affiche promotionnelle, décor du fichier d'origine) : maillages SANS peau, retirés de l'instance ; le personnage lui-même n'est pas touché
  if (def.skinnedOnly) { const drop = []; scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) drop.push(o); }); for (const o of drop) o.parent?.remove(o); }
  scene.updateMatrixWorld(true);
  // hauteur réelle du corps (centiles des sommets déformés, pour ignorer d'éventuels éléments égarés) -> échelle et décalage pour que les pieds touchent le sol
  const ys = [], xs = [], zs = []; scene.traverse((o) => { if (o.isSkinnedMesh) { const p = o.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i += 3) { o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld); ys.push(v.y); xs.push(v.x); zs.push(v.z); } } });
  // certains fichiers (Deadlock : nœud du squelette à 355 m de l'origine) posent le corps loin de l'origine : on le recentre en x/z (sinon le joueur est invisible, à des centaines de mètres de sa capsule)
  const med = (a) => { a.sort((p, q) => p - q); return a[a.length >> 1]; }; let cx = med(xs), cz = med(zs); if (Math.hypot(cx, cz) < 2) { cx = 0; cz = 0; }
  ys.sort((a, b) => a - b); const lo = ys[Math.floor(ys.length * 0.0005)], hi = ys[Math.floor(ys.length * 0.9995)];
  const scale = HEIGHT / (hi - lo);
  scene.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; o.receiveShadow = false; for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m[k]) m[k].anisotropy = 8; } });
  return (LOADED[id] = { def, scene, scale, cx, cz, dy: -lo * scale, clips: {}, ready: false });
}

// recible les clips (CLIPS) du squelette du jeu (tpl = modèle de référence) sur le personnage ; names = clips voulus
export function retarget(id, tpl, CLIPS, names) {
  const L = LOADED[id]; if (!L || L.ready) return L;
  const map = L.def.map, tgt = bonesOf(L.scene, map);
  const srcMap = {}; tpl.traverse((o) => { if (o.isBone) srcMap[o.name] = o; });
  const canon = Object.keys(map), srcBones = {}; for (const c of canon) if (srcMap[c]) srcBones[c] = srcMap[c];
  const use = canon.filter((c) => tgt[c] && srcBones[c]);
  // repos : positions et orientations monde, côté personnage (dans son propre repère, avant mise à l'échelle) et côté jeu
  const T = L.scene; T.updateMatrixWorld(true); tpl.updateMatrixWorld(true);
  const rest = { t: {}, s: {} };
  for (const c of use) { rest.t[c] = { q: wquat(tgt[c]), p: wpos(tgt[c]) }; rest.s[c] = { q: wquat(srcBones[c]), p: wpos(srcBones[c]) }; }
  const dirRest = (side_, c) => { const ch = CHILD[c]; if (!ch || !rest[side_][ch]) return null; return dirOf(rest[side_][c].p, rest[side_][ch].p, new THREE.Vector3()); };
  const legT = tgt.thigh_l && tgt.foot_l ? rest.t.thigh_l.p.distanceTo(rest.t.foot_l.p) : 1, legS = rest.s.thigh_l && rest.s.foot_l ? rest.s.thigh_l.p.distanceTo(rest.s.foot_l.p) : 1, ratio = legT / legS;
  // nœuds du modèle en ordre hiérarchique (parents d'abord) et leurs rotations locales de repos
  const order = []; T.traverse((o) => order.push(o)); const restLocal = new Map(order.map((o) => [o, o.quaternion.clone()])); const restWorld = new Map(order.map((o) => [o, wquat(o)]));
  const boneToCanon = new Map(); for (const c of use) boneToCanon.set(tgt[c], c);
  const srcRoot = cloneSkinned(tpl); const srcB = {}; srcRoot.traverse((o) => { if (o.isBone) srcB[o.name] = o; });
  const FPS = 30; let made = 0;
  for (const name of names) {
    const clip = CLIPS[name]; if (!clip) continue;
    const mixer = new THREE.AnimationMixer(srcRoot), act = mixer.clipAction(clip); act.play();
    const n = Math.max(2, Math.ceil(clip.duration * FPS) + 1), times = new Float32Array(n), qv = new Map(), pv = new Float32Array(n * 3);
    for (const b of boneToCanon.keys()) qv.set(b, new Float32Array(n * 4));
    for (let f = 0; f < n; f++) {
      const t = Math.min(clip.duration, f / FPS); times[f] = t; mixer.setTime(t); srcRoot.updateMatrixWorld(true);
      const sp = {}, sq = {}; for (const c of use) { const b = srcB[srcBones[c].name]; sp[c] = wpos(b); sq[c] = wquat(b); }
      const wq = new Map();
      for (const o of order) {
        const par = o.parent && wq.get(o.parent), base = par ? par.clone().multiply(restLocal.get(o)) : restWorld.get(o).clone();
        const c = boneToCanon.get(o); let world = base;
        if (c) {
          const ch = CHILD[c];
          if (DELTA.includes(c) || !ch || !rest.t[ch] || !sp[ch]) { // rotation d'origine recopiée (monde)
            if (DELTA.includes(c)) world = sq[c].clone().multiply(rest.s[c].q.clone().invert()).multiply(rest.t[c].q);
          } else {
            const dT = dirRest('t', c), dS = dirRest('s', c), cur = dirOf(sp[c], sp[ch], _v2).clone();
            const swing = _q.setFromUnitVectors(dT, cur).clone(); world = swing.clone().multiply(rest.t[c].q);
            if (TWIST.has(c) && dS) { // torsion : rotation de l'os d'origine autour de sa direction, que la rotation minimale vers cette direction ne reproduit pas
              const minS = _q2.setFromUnitVectors(dS, cur).clone().multiply(rest.s[c].q), tw = sq[c].clone().multiply(minS.invert()); world = tw.multiply(world);
            }
          }
          // rotation locale = (monde du parent)^-1 · monde voulu
          const pw = par || new THREE.Quaternion(); const local = pw.clone().invert().multiply(world); const a = qv.get(o); a[f * 4] = local.x; a[f * 4 + 1] = local.y; a[f * 4 + 2] = local.z; a[f * 4 + 3] = local.w;
          world = pw.clone().multiply(local); // (réinjecté : identique, évite la dérive numérique)
          if (c === 'pelvis') { // déplacement du bassin : écart d'origine mis à l'échelle de la longueur des jambes, converti dans le repère du parent
            const d = sp.pelvis.clone().sub(rest.s.pelvis.p).multiplyScalar(ratio), target = rest.t.pelvis.p.clone().add(d), parM = o.parent ? o.parent.matrixWorld.clone().invert() : new THREE.Matrix4(), lp = target.applyMatrix4(parM);
            pv[f * 3] = lp.x; pv[f * 3 + 1] = lp.y; pv[f * 3 + 2] = lp.z;
          }
        }
        wq.set(o, world);
      }
    }
    const tracks = []; for (const bone of boneToCanon.keys()) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, qv.get(bone)));
    const pelvis = tgt.pelvis; if (pelvis) tracks.push(new THREE.VectorKeyframeTrack(`${pelvis.name}.position`, times, pv));
    L.clips[name] = new THREE.AnimationClip(name, clip.duration, tracks); made++;
  }
  L.ready = true; L.canon = Object.keys(tgt); L.info = { os: use.length, clips: made, absents: canon.filter((c) => !tgt[c]), ratioJambes: +ratio.toFixed(3), echelle: +L.scale.toFixed(4) }; (window.__chars ||= {})[id] = L.info; return L;
}

// une instance par joueur : { root (groupe animé par le jeu), model, bones (alias canoniques), clips }
export function instance(id) {
  const L = LOADED[id]; if (!L || !L.ready) return null;
  const model = cloneSkinned(L.scene); model.scale.setScalar(L.scale); model.position.set(-L.cx * L.scale, L.dy, -L.cz * L.scale);
  const root = new THREE.Group(); root.add(model); root.updateMatrixWorld(true);
  const tgt = bonesOf(model, L.def.map), bones = { ...tgt };
  // alias des noms que le code de pose attend : Head / head, pelvis…
  bones.head = tgt.Head;
  const rest = {}; for (const n of ['neck_01', 'Head']) if (tgt[n]) rest[n] = tgt[n].quaternion.clone(); // pose de repos (tête et cou) : le mode crazy y ramène la tête, la foulée de course ne la balance plus
  return { root, model, bones, clips: L.clips, def: L.def, rest };
}
export const ids = () => CHARS.map((c) => c.id);
