/* LES ENCHAÎNÉS — rendu three.js + entrées. Toute la physique est dans sim.js (pure, testée). */
import * as THREE from './lib/three.module.min.js';

const Sim = window.EnchSim, LEVEL = window.EnchLevel;
const C = Sim.C;
const DT = 1 / 120;
const $ = id => document.getElementById(id);

/* ---------------------------------------------------------------- textures procédurales */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(size, paint, seed) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); paint(g, size, rng(seed || 1));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function speckle(g, n, r, colors, S) {
  for (let i = 0; i < n; i++) { g.fillStyle = colors[(r() * colors.length) | 0]; g.globalAlpha = 0.08 + r() * 0.18; const s = 1 + r() * 4; g.fillRect(r() * S, r() * S, s, s); }
  g.globalAlpha = 1;
}
const PAINT = {
  stone(g, S, r) {
    g.fillStyle = '#8b8499'; g.fillRect(0, 0, S, S);
    speckle(g, 1400, r, ['#a59fb3', '#6e687d', '#9a93a8', '#5e5870'], S);
    g.strokeStyle = 'rgba(40,30,60,.55)'; g.lineWidth = 3;
    const h = S / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { g.strokeRect(i * h + (j ? h / 2 : 0) % S + 1.5, j * h + 1.5, h - 3, h - 3); }
    g.strokeStyle = 'rgba(30,20,50,.35)'; g.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) { g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  },
  brick(g, S, r) {
    g.fillStyle = '#4a3140'; g.fillRect(0, 0, S, S);
    const rows = 8, bh = S / rows, bw = S / 4;
    for (let j = 0; j < rows; j++) for (let i = -1; i < 5; i++) {
      const x = i * bw + (j % 2 ? bw / 2 : 0), c = 150 + ((r() * 30) | 0);
      g.fillStyle = `rgb(${c},${(c * 0.5) | 0},${(c * 0.42) | 0})`; g.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, j * bh + 2, bw - 4, 3);
    }
    speckle(g, 600, r, ['#2b1620', '#d08a70'], S);
  },
  wood(g, S, r) {
    g.fillStyle = '#7a4f2d'; g.fillRect(0, 0, S, S);
    const planks = 5, pw = S / planks;
    for (let i = 0; i < planks; i++) {
      const c = 105 + ((r() * 35) | 0);
      g.fillStyle = `rgb(${c},${(c * .64) | 0},${(c * .36) | 0})`; g.fillRect(i * pw + 1, 0, pw - 2, S);
      g.strokeStyle = 'rgba(40,20,5,.35)'; g.lineWidth = 1;
      for (let k = 0; k < 9; k++) { const x = i * pw + 4 + r() * (pw - 8); g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, S * .3, x - 4, S * .6, x + 2, S); g.stroke(); }
      g.fillStyle = 'rgba(30,15,5,.7)'; g.beginPath(); g.arc(i * pw + pw / 2, 10, 2.2, 0, 7); g.arc(i * pw + pw / 2, S - 10, 2.2, 0, 7); g.fill();
    }
  },
  moss(g, S, r) {
    PAINT.stone(g, S, r);
    for (let i = 0; i < 38; i++) {
      const x = r() * S, y = r() * S, rad = 8 + r() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(86,150,64,.85)'); gr.addColorStop(1, 'rgba(86,150,64,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  },
  vines(g, S, r) {      // mur agrippable : lierre vif, bien lisible
    g.fillStyle = '#1f4a2a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#6b4a2b'; g.lineWidth = 5;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * S / 4, 0); g.lineTo(i * S / 4, S); g.stroke(); g.beginPath(); g.moveTo(0, i * S / 4); g.lineTo(S, i * S / 4); g.stroke(); }
    for (let i = 0; i < 260; i++) {
      const x = r() * S, y = r() * S, a = r() * 6.28, l = 6 + r() * 9;
      g.fillStyle = ['#47a447', '#68c85a', '#2f7d3a', '#8bdc6b'][(r() * 4) | 0];
      g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, l, l * .5, 0, 0, 7); g.fill(); g.restore();
    }
  },
  metal(g, S, r) {
    g.fillStyle = '#6c7280'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 4) { g.fillStyle = `rgba(255,255,255,${.04 + r() * .05})`; g.fillRect(0, i, S, 2); }
    g.fillStyle = '#31343c'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(S / 8 + i * S / 4, S / 8 + j * S / 4, 3.5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(140,60,30,.35)'; for (let i = 0; i < 12; i++) g.fillRect(r() * S, r() * S, 8 + r() * 20, 3 + r() * 6);
  },
  grass(g, S, r) {
    g.fillStyle = '#4c8f3e'; g.fillRect(0, 0, S, S);
    speckle(g, 1600, r, ['#69b54f', '#376d2d', '#7cc860'], S);
  }
};
const texCache = {};
function tex(name) { return texCache[name] || (texCache[name] = canvasTex(256, PAINT[name] || PAINT.stone, name.length * 97 + 11)); }
const matCache = {};
function mat(name, extra) {
  const k = name + JSON.stringify(extra || {});
  return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ map: tex(name), roughness: 0.92, metalness: name === 'metal' ? 0.45 : 0.02 }, extra || {})));
}

function worldUV(geo, dx, dy, dz, tile) {
  // une répétition de texture tous les `tile` mètres, quelle que soit la taille de la boîte
  const uv = geo.attributes.uv, dims = [[dz, dy], [dz, dy], [dx, dz], [dx, dz], [dx, dy], [dx, dy]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  uv.needsUpdate = true; return geo;
}

/* ---------------------------------------------------------------- scène */
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const SKY = new THREE.Color('#3a2a6e');
scene.background = SKY; scene.fog = new THREE.Fog(SKY, 40, 160);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xcfc4ff, 0x3a2a4e, 1.05));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
sun.position.set(30, 60, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 160 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);

// étoiles / poussière de fond (décor, ne sert à rien d'autre)
{
  const n = 500, pos = new Float32Array(n * 3), r = rng(5);
  for (let i = 0; i < n; i++) { pos[i * 3] = -120 + r() * 160; pos[i * 3 + 1] = -10 + r() * 80; pos[i * 3 + 2] = -140 + r() * 180; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, fog: false })));
}

/* ---------------------------------------------------------------- géométrie du niveau */
const level = LEVEL;
function addBox(b) {
  const dx = b.max[0] - b.min[0], dy = b.max[1] - b.min[1], dz = b.max[2] - b.min[2];
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  const g = new THREE.Group(); g.position.set(cx, cy, cz);
  const shape = b.shape || 'slab';
  const core = new THREE.Mesh(worldUV(new THREE.BoxGeometry(dx, dy, dz), dx, dy, dz, 3), mat(b.tex));
  core.castShadow = core.receiveShadow = true; g.add(core);
  const trim = new THREE.MeshStandardMaterial({ color: b.tex === 'wood' ? 0x4a2d16 : b.tex === 'vines' ? 0x2c5a2a : 0x4a4258, roughness: 0.95 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

  if (shape === 'slab') {
    // chanfrein : un liseré plus large en haut, une base en retrait, un tapis d'herbe sur la mousse
    add(new THREE.BoxGeometry(dx + 0.14, 0.14, dz + 0.14), trim, 0, dy / 2 - 0.09, 0);
    if (b.tex === 'moss') add(worldUV(new THREE.BoxGeometry(dx + 0.05, 0.12, dz + 0.05), dx, 0.12, dz, 2), mat('grass'), 0, dy / 2 + 0.02, 0);
    if (dy > 0.8) add(new THREE.BoxGeometry(dx * 0.82, 0.5, dz * 0.82), trim, 0, -dy / 2 - 0.25, 0);   // socle qui s'effile vers le bas
    if (dy > 0.8 && dx > 3) add(new THREE.BoxGeometry(dx * 0.5, 0.7, dz * 0.5), trim, 0, -dy / 2 - 0.85, 0);
  } else if (shape === 'beam') {
    // poutre/pont : planches, rebords et petits contreforts en bois
    add(new THREE.BoxGeometry(dx + 0.1, 0.1, 0.12), trim, 0, dy / 2 + 0.01, dz / 2 + 0.01);
    add(new THREE.BoxGeometry(dx + 0.1, 0.1, 0.12), trim, 0, dy / 2 + 0.01, -dz / 2 - 0.01);
    add(new THREE.BoxGeometry(0.12, 0.1, dz + 0.1), trim, dx / 2 + 0.01, dy / 2 + 0.01, 0);
    add(new THREE.BoxGeometry(0.12, 0.1, dz + 0.1), trim, -dx / 2 - 0.01, dy / 2 + 0.01, 0);
    const long = dx > dz, span = long ? dx : dz, nb = Math.max(2, Math.floor(span / 3));
    for (let i = 0; i < nb; i++) {
      const t = (i + 0.5) / nb - 0.5;
      const st = add(new THREE.BoxGeometry(long ? 0.18 : dx * 0.9, 0.9, long ? dz * 0.9 : 0.18), trim, long ? t * span : 0, -dy / 2 - 0.45, long ? 0 : t * span);
      st.rotation[long ? 'z' : 'x'] = 0;
    }
  } else if (shape === 'pillar') {
    // pilier/mur : anneaux de pierre/bois tous les 2 m, chapeau arrondi
    const nb = Math.floor(dy / 2.2);
    for (let i = 1; i <= nb; i++) add(new THREE.BoxGeometry(dx + 0.12, 0.16, dz + 0.12), trim, 0, -dy / 2 + i * (dy / (nb + 1)), 0);
    add(new THREE.BoxGeometry(dx + 0.2, 0.2, dz + 0.2), trim, 0, dy / 2 - 0.1, 0);
    if (b.kind === 'grip') {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(dx + 0.02, dy, dz + 0.02), new THREE.MeshBasicMaterial({ color: 0x9cff7a, wireframe: false, transparent: true, opacity: 0.0 }));
      g.add(edge);
    }
  }
  scene.add(g);
}
level.boxes.forEach(addBox);

/* rouleaux à pics */
const rollerObjs = level.rollers.map(r => {
  const grp = new THREE.Group(), spin = new THREE.Group(); grp.add(spin);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r.r, r.r, r.len, 20), mat('metal'));
  body.castShadow = true; spin.add(body);
  const capM = new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.5, metalness: 0.6 });
  [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r.r * 1.12, r.r * 1.12, 0.12, 20), capM); c.position.y = s * r.len / 2; c.castShadow = true; spin.add(c); });
  const spM = new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.3, metalness: 0.8 });
  const rows = Math.max(2, Math.round(r.len / 0.7)), per = 8;
  const cone = new THREE.ConeGeometry(0.11, r.spike || 0.35, 8); cone.translate(0, (r.spike || 0.35) / 2, 0);
  const inst = new THREE.InstancedMesh(cone, spM, rows * per); let k = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < rows; i++) for (let j = 0; j < per; j++) {
    const a = j / per * Math.PI * 2 + (i % 2) * Math.PI / per, y = -r.len / 2 + (i + 0.5) * r.len / rows;
    v3.set(Math.cos(a) * r.r, y, Math.sin(a) * r.r); e.set(0, 0, 0); q.setFromEuler(e);
    // cône orienté vers l'extérieur
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
    m4.compose(v3, q, one); inst.setMatrixAt(k++, m4);
  }
  inst.castShadow = true; spin.add(inst);
  // le cylindre est vertical (axe y) par défaut ; on le couche selon l'axe voulu
  if (r.axis === 'x') grp.rotation.z = Math.PI / 2; else if (r.axis === 'z') grp.rotation.x = Math.PI / 2;
  const holder = new THREE.Group(); holder.add(grp); scene.add(holder);
  return { holder, spin, r };
});

/* lianes */
level.vines.forEach(v => {
  const h = v.y1 - v.y0, g = new THREE.Group();
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 8), new THREE.MeshStandardMaterial({ color: 0x5b3b1f, roughness: 1 }));
  rope.position.set(v.x, v.y0 + h / 2, v.z); rope.castShadow = true; g.add(rope);
  const lm = new THREE.MeshStandardMaterial({ color: 0x59b84a, roughness: 0.9, side: THREE.DoubleSide });
  const r = rng(9);
  for (let i = 0; i < h * 3; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), lm);
    leaf.position.set(v.x + (r() - .5) * 0.3, v.y0 + 0.2 + (i / (h * 3)) * (h - 0.3), v.z + (r() - .5) * 0.3);
    leaf.rotation.set(r() * 3, r() * 6, r() * 3); g.add(leaf);
  }
  scene.add(g);
});

/* checkpoints + arrivée */
const cpObjs = level.checkpoints.map((c, i) => {
  const g = new THREE.Group(); g.position.set(c.respawn[0], c.respawn[1], c.respawn[2]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xcfc6e6 }));
  pole.position.set(0.9, 1.2, 0.9); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0x777777, side: THREE.DoubleSide, emissive: 0x000000 }));
  flag.position.set(1.35, 2.1, 0.9); g.add(flag);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0x777777 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  scene.add(g); return { flag, ring, i };
});
{
  const f = level.finish, cx = (f.min[0] + f.max[0]) / 2, cz = (f.min[2] + f.max[2]) / 2, y = f.min[1];
  const m = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const a = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.14, 10, 40), m); a.position.set(cx, y + 2.1, cz); a.rotation.y = Math.PI / 2; scene.add(a);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.set(cx, y + 15, cz); scene.add(beam);
}

/* le joueur : un Métamorph */
const player = new THREE.Group(); scene.add(player);
const body = new THREE.Group(); player.add(body);
{
  const skin = new THREE.MeshStandardMaterial({ color: 0xc7a3ff, roughness: 0.55 });
  const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), skin); blob.scale.set(0.74, 0.9, 0.74); blob.position.y = 0.9; blob.castShadow = true; body.add(blob);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), skin); foot.scale.set(0.9, 0.26, 0.9); foot.position.y = 0.12; foot.castShadow = true; body.add(foot);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x1b1030 });
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), eyeM); e.position.set(s * 0.15, 1.08, -0.34); body.add(e); });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 6, 14, Math.PI), eyeM); mouth.position.set(0, 0.92, -0.35); mouth.rotation.z = Math.PI; body.add(mouth);
}
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
shadowBlob.rotation.x = -Math.PI / 2; scene.add(shadowBlob);

/* ---------------------------------------------------------------- entrées */
const keys = new Set();
const press = { jump: false, slide: false };
let world = Sim.createWorld(level);
let pitch = 0.42, camDist = 7.2, locked = false, running = false, paused = false;
let dragging = false, rightDown = false;
let camPos = new THREE.Vector3(), camInit = false;
let accDyaw = 0, accPitch = 0;
const FREE_YAW = 1.9, FREE_PITCH = 1.2;

const code = e => e.code;
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (!running) return;
  if (e.code === 'Space') press.jump = true;
  if (e.code === 'KeyC' || e.code === 'ControlLeft' || e.code === 'ControlRight') press.slide = true;
  if (e.code === 'Tab') toggleLock();
  if (e.code === 'KeyR') respawnNow();
  if (e.code === 'Escape' && !locked) setPause(!paused);
  if (DEBUG && e.code.startsWith('Digit')) { const i = +e.code.slice(5) - 1; const c = level.checkpoints[i]; if (c) teleport(c.respawn, c.yaw, i); }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => {
  if (!running || paused) return;
  if (e.button === 2) rightDown = true;
  if (e.button === 0) { if (!locked && !dragging) dragging = true; }
});
addEventListener('mouseup', e => { if (e.button === 2) rightDown = false; if (e.button === 0) dragging = false; });
addEventListener('mousemove', e => {
  if (!running || paused) return;
  if (locked || (dragging && !locked)) { accDyaw -= e.movementX * 0.0026; accPitch += e.movementY * 0.0026; }
});
canvas.addEventListener('wheel', e => { camDist = Math.max(3.5, Math.min(12, camDist + e.deltaY * 0.004)); }, { passive: true });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && running && !paused && wantLock) { /* Échap rend le pointeur : on passe en caméra libre */ wantLock = false; }
  updateCamMode();
});
let wantLock = false;
function toggleLock() {
  if (locked) { document.exitPointerLock(); wantLock = false; }
  else { wantLock = true; try { canvas.requestPointerLock(); } catch (e) { /* ignoré : caméra libre */ } }
}
canvas.addEventListener('click', () => { if (running && !paused && !locked && !dragging) { /* un simple clic ne verrouille plus : Tab seulement */ } });
function updateCamMode() {
  $('cammode').innerHTML = locked ? 'Caméra <b style="color:#f2c14e">verrouillée</b> au pointeur · <kbd>Tab</kbd> pour libérer' : 'Caméra <b style="color:#9fd">libre</b> · flèches ou clic gauche + glisser · <kbd>Tab</kbd> pour verrouiller';
}
function gamepadInput() { return null; }

/* ---------------------------------------------------------------- boucle */
const DEBUG = new URLSearchParams(location.search).has('debug');
const best = (() => { try { return +localStorage.getItem('enchaines_best') || 0; } catch (e) { return 0; } })();
let bestTime = best;
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
$('best').textContent = bestTime ? 'Meilleur temps : ' + fmt(bestTime) : '';

let toastT = 0;
function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 1400); }

function setPause(v) {
  paused = v; $('pause').classList.toggle('hidden', !v);
  if (v && locked) document.exitPointerLock();
}
function respawnNow() { const p = world.p; if (p.state !== 'dead' && !p.finished) Sim.respawn(world); }
function teleport(pos, yaw, idx) {
  const p = world.p; p.x = pos[0]; p.y = pos[1]; p.z = pos[2]; p.vx = p.vy = p.vz = 0; p.yaw = yaw; p.state = 'air'; p.cp = { pos: pos.slice(), yaw }; p.cpIdx = idx;
  for (const zz of world.camZones) zz.done = Math.abs(Sim.angDiff(yaw, zz.z.yaw)) < 0.01;
}
function restart() {
  world = Sim.createWorld(level); camInit = false; $('end').classList.add('hidden'); setPause(false);
  if (running && !locked) { /* la caméra reste libre tant que le joueur ne verrouille pas */ }
}

function readInput() {
  const k = c => keys.has(c);
  const mz = (k('KeyW') || k('KeyZ') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  const mx = (k('KeyD') ? 1 : 0) - (k('KeyA') || k('KeyQ') ? 1 : 0);
  const inp = {
    mx, mz, jumpPressed: press.jump, jumpHeld: k('Space'),
    slide: k('KeyC') || k('ControlLeft') || k('ControlRight'), slidePressed: press.slide,
    grab: k('KeyE') || k('ShiftLeft') || k('ShiftRight') || rightDown, dyaw: 0
  };
  press.jump = false; press.slide = false;
  return inp;
}

let last = performance.now(), acc = 0;
const stateLabel = { ground: 'au sol', air: 'en l\'air', slide: 'glissade', wall: 'mur (wall-jump !)', grip: 'agrippé', vine: 'liane', ledge: 'rebord', dead: '…' };
function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
  if (running && !paused && !world.p.finished) {
    acc += dtReal;
    // rotation libre de la caméra par les flèches (seule façon d'avoir un mouvement caméra "tout seul" : jamais)
    const kyaw = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
    const kpit = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    accDyaw += kyaw * FREE_YAW * dtReal; accPitch += kpit * FREE_PITCH * dtReal;
    pitch = Math.max(-0.15, Math.min(1.35, pitch + accPitch)); accPitch = 0;
    let first = true;
    while (acc >= DT) {
      const inp = readInput();
      if (first) { inp.dyaw = accDyaw; accDyaw = 0; first = false; }
      Sim.step(world, inp, DT);
      for (const ev of world.events) onEvent(ev);
      acc -= DT;
    }
    if (world.p.finished) onFinish();
  }
  render(now);
}
function onEvent(ev) {
  if (ev === 'checkpoint') toast('Checkpoint !');
  if (ev === 'die') toast(world.p.deathWhy === 'spikes' ? 'Aïe, les pics !' : 'Chute !', 900);
  if (ev === 'longjump') toast('Saut long', 500);
}
function onFinish() {
  const t = world.p.finishTime;
  if (!bestTime || t < bestTime) { bestTime = t; try { localStorage.setItem('enchaines_best', String(t)); } catch (e) { /* stockage indisponible */ } }
  $('endtime').textContent = fmt(t) + ' · ' + world.p.deaths + ' chute' + (world.p.deaths > 1 ? 's' : '');
  $('endbest').textContent = 'Meilleur temps : ' + fmt(bestTime);
  $('end').classList.remove('hidden'); if (locked) document.exitPointerLock();
}

const tmpV = new THREE.Vector3();
function camBlocked(x, y, z) {
  for (const b of world.boxes) if (x > b.min[0] - 0.25 && x < b.max[0] + 0.25 && y > b.min[1] - 0.25 && y < b.max[1] + 0.25 && z > b.min[2] - 0.25 && z < b.max[2] + 0.25) return true;
  return false;
}
function render(now) {
  const p = world.p, t = world.t;
  // rouleaux
  rollerObjs.forEach((o, i) => {
    const st = world.rollerState[i]; o.holder.position.set(st.c[0], st.c[1], st.c[2]); o.spin.rotation.y = st.ang;
  });
  // checkpoints
  cpObjs.forEach(c => {
    const on = p.cpIdx >= c.i, col = on ? 0x66ff99 : 0x777777;
    c.flag.material.color.setHex(col); c.flag.material.emissive.setHex(on ? 0x114422 : 0); c.ring.material.color.setHex(col);
    c.flag.rotation.y = Math.sin(t * 3 + c.i) * 0.2;
  });
  // joueur
  player.visible = p.state !== 'dead';
  player.position.set(p.x, p.y, p.z);
  let sy = p.h < 1.2 ? 0.55 : 1, sxz = p.h < 1.2 ? 1.25 : 1;
  if (p.state === 'ledge') sy = 0.85;
  body.scale.set(sxz, sy, sxz);
  body.rotation.y = p.face;
  body.rotation.x = p.state === 'slide' ? -0.25 : p.state === 'grip' ? 0.15 : 0;
  // petite ombre au sol
  shadowBlob.position.set(p.x, p.y - 0.01, p.z); shadowBlob.visible = player.visible;
  {
    // projette sur la plateforme sous les pieds
    let gy = -1e9;
    for (const b of world.boxes) if (p.x + C.R > b.min[0] && p.x - C.R < b.max[0] && p.z + C.R > b.min[2] && p.z - C.R < b.max[2] && b.max[1] <= p.y + 0.3 && b.max[1] > gy) gy = b.max[1];
    if (gy > -1e8) { shadowBlob.position.y = gy + 0.02; const k = Math.max(0.35, 1 - (p.y - gy) / 8); shadowBlob.scale.setScalar(k); shadowBlob.material.opacity = 0.32 * k; } else shadowBlob.visible = false;
  }
  // caméra : orbite autour du joueur, la rotation n'est JAMAIS pilotée par le mouvement (sim.js gère le cap scripté)
  const ty = p.y + (p.h < 1.2 ? 0.8 : 1.35);
  // collision de caméra : on rapproche d'abord, puis on baisse un peu l'élévation (tunnels bas), jamais le cap
  let ox, oy, oz, d = 0;
  for (const k of [1, 0.6, 0.3, 0]) {
    const pt = pitch * k, cx = Math.sin(p.yaw) * Math.cos(pt), cy = Math.sin(pt), cz = Math.cos(p.yaw) * Math.cos(pt);
    let dd = camDist;
    for (let s = 0.12; s <= 1.0001; s += 0.08) { if (camBlocked(p.x + cx * camDist * s, ty + cy * camDist * s, p.z + cz * camDist * s)) { dd = Math.max(0.8, camDist * (s - 0.12)); break; } }
    if (dd > d) { d = dd; ox = cx; oy = cy; oz = cz; }
    if (dd >= camDist * 0.75) break;
  }
  tmpV.set(p.x + ox * d, ty + oy * d, p.z + oz * d);
  if (!camInit) { camPos.copy(tmpV); camInit = true; } else camPos.lerp(tmpV, 1 - Math.exp(-14 * Math.min(0.05, 1 / 60)));
  camera.position.copy(camPos); camera.lookAt(p.x, ty, p.z);
  sun.position.set(p.x + 30, p.y + 60, p.z + 20); sun.target.position.set(p.x, p.y, p.z);
  // HUD
  $('time').textContent = fmt(p.finished ? p.finishTime : p.time);
  $('deaths').textContent = p.deaths;
  $('state').innerHTML = 'État : <b>' + (stateLabel[p.state] || p.state) + '</b>' + (DEBUG ? ' · x ' + p.x.toFixed(1) + ' y ' + p.y.toFixed(1) + ' z ' + p.z.toFixed(1) : '');
  const sw = innerWidth, sh = innerHeight;
  if (renderer.domElement.width !== Math.floor(sw * renderer.getPixelRatio())) { renderer.setSize(sw, sh, false); camera.aspect = sw / sh; camera.updateProjectionMatrix(); }
  renderer.render(scene, camera);
}

/* ---------------------------------------------------------------- menus */
function start() {
  $('menu').classList.add('hidden'); running = true; paused = false; restart(); updateCamMode(); last = performance.now();
  toast('Les Enchaînés', 1200);
}
$('play').addEventListener('click', start);
$('resume').addEventListener('click', () => setPause(false));
$('restart').addEventListener('click', restart);
$('again').addEventListener('click', restart);
updateCamMode();
requestAnimationFrame(frame);

// accès pour les tests automatisés / le debug
window.__ench = { get world() { return world; }, Sim, THREE, scene, renderer, camera, start, teleport };
