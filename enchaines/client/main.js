// LES ENCHAÎNÉS — client : écrans, commandes, boucle à pas fixe (120 Hz), mode local à deux sur un clavier,
// mode en ligne (serveur qui fait autorité ; ici prédiction de tout le monde avec ses propres entrées, rejouées à chaque instantané).
import { createWorld, stepWorld, snapWorld, applySnap, spawnAt, DT, ST, P, CH, IDLE } from '../core/sim.js';
import { WORLDS, courseList, getCourse, nextCourse, DEFAULT_COURSE } from '../core/worlds.js';
import * as Scene from './scene.js';
import * as Music from './music.js';
import * as Snd from './audio.js';
import * as Sfx from './sfx.js';
import * as Voice from './voice.js';
import * as Pings from './pings.js';
import { createNet } from './net.js';
import { stepCoop } from '../core/coop-run.js';
import { t as tr, LANG, setLang, applyDom } from './i18n.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const qs = new URLSearchParams(location.search);
const safe = (f, d) => { try { return f(); } catch { return d; } };
const G = { course: safe(() => localStorage.getItem('ch-course'), null) || DEFAULT_COURSE, pt: null, mode: null, W: null, me: null, acc: 0, paused: false, debug: qs.has('debug'), ct: 0, pend: [], partnerIn: IDLE, names: ['Grimpeur 1', 'Grimpeur 2'], L: CH.L, hintT: 0, last: performance.now(), stepT: [0, 0], done: false, room: null };
window.__ch = G; // tests
const LV = () => G.W?.level || getCourse(G.course);
G.play = (id) => { G.course = id; return startLocal(); }; // tests / mode test
G.tp = (i) => { if (G.mode !== 'local') return; G.W.cp = i; G.W.cpMax = Math.max(G.W.cpMax, i); spawnAt(G.W, i); Scene.onEvent(G.W, { k: 'respawn' }); };

/* ------------------------------ réglages persistants ------------------------------ */
const CFG = Object.assign({ name: '', vol: 0.8, sens: 1, invert: false, camLock: 0, camAuto: 0, vMusic: 1, vSfx: 1, vChain: 1, vVoice: 1, vMic: 1, devIn: '', devOut: '', keys: {} }, safe(() => JSON.parse(localStorage.getItem('ch-cfg')), {}));
const saveCfg = () => safe(() => localStorage.setItem('ch-cfg', JSON.stringify(CFG)));

/* ------------------------------ entrées ------------------------------ */
const keys = new Set(), pressed = new Set();
addEventListener('keydown', (e) => {
  if (G.capturing) { e.preventDefault(); e.stopImmediatePropagation(); endCapture(e.code === 'Escape' ? null : e.code); return; }
  if (e.target.tagName === 'INPUT') return;
  // chat du salon : Entrée pour écrire (en ligne), M pour couper / ouvrir le micro
  if (G.room && (e.code === 'Enter' || e.code === 'NumpadEnter') && G.mode !== 'local') { e.preventDefault(); keys.clear(); $('#chat-in').focus(); return; }
  if (G.room && e.code === 'KeyM' && G.mode !== 'local') { micToggle(); return; }
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code); Snd.unlock(); Music.unlock(); Sfx.load();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && $('#settings').classList.contains('on')) { $('#settings').classList.remove('on'); return; }
  if (e.code === 'Escape' && G.mode) togglePause();
  if (e.code === 'F3' || (e.code === 'KeyB' && e.ctrlKey)) { e.preventDefault(); G.debug = !G.debug; }
  if (e.code === 'KeyH' && G.mode) $('#help').classList.toggle('show');
  if (e.code === 'Delete' && (G.solo || G.replay) && G.mode) restartFromStart(); // speedrun : recommencer d'une touche
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// touches du grimpeur 1 (réglables : clavier ou boutons de souris « Mouse0..4 ») ; défauts : E = tirer la chaîne, Z / X = tourner la caméra
const KEYDEF = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], brace: ['ShiftLeft'], pull: ['KeyE'], cup: ['KeyG'], punch: ['Mouse0'], kick: ['KeyQ'], slide: ['KeyV'], drop: ['KeyC'], use: ['KeyF'], reset: ['KeyR'], camL: ['KeyZ'], camR: ['KeyX'] };
const BIND = {}; const rebuildBind = () => { for (const a in KEYDEF) BIND[a] = CFG.keys?.[a] ?? KEYDEF[a]; };
rebuildBind();
const SCHEMES = {
  k1: BIND,
  k2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Numpad0', 'ControlRight', 'Enter'], brace: ['ShiftRight', 'Numpad1'], pull: ['Numpad4', 'Slash'], cup: ['Numpad6', 'Quote'], punch: ['Numpad7', 'Semicolon'], kick: ['Numpad9', 'BracketRight'], drop: ['Numpad2', 'End'], use: ['Numpad5', 'Period'], reset: ['Numpad3', 'Backspace'] },
};
const anyKey = (l) => l.some((k) => keys.has(k)), anyPress = (l) => l.some((k) => pressed.has(k));
const slot = [{ jc: 0, dc: 0, uc: 0 }, { jc: 0, dc: 0, uc: 0 }];
function readInput(k, schemes, pads) {
  let ax = 0, ay = 0, jump = false, brace = false, pull = false, cup = false, punch = false, kick = false, slide = false, reset = false, jp = false, dp = false, up = false;
  for (const s of schemes) {
    const S = SCHEMES[s];
    ax += (anyKey(S.right) ? 1 : 0) - (anyKey(S.left) ? 1 : 0); ay += (anyKey(S.up) ? 1 : 0) - (anyKey(S.down) ? 1 : 0);
    jump ||= anyKey(S.jump); brace ||= anyKey(S.brace); pull ||= anyKey(S.pull); cup ||= anyKey(S.cup || []); punch ||= anyKey(S.punch || []); kick ||= anyKey(S.kick || []); slide ||= anyKey(S.slide || []); reset ||= anyKey(S.reset); jp ||= anyPress(S.jump); dp ||= anyPress(S.drop); up ||= anyPress(S.use);
  }
  for (const i of pads) {
    const gp = safe(() => navigator.getGamepads()[i], null); if (!gp) continue;
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, dz = Math.hypot(lx, ly) > 0.2;
    if (dz) { ax += lx; ay -= ly; }
    const b = (n) => !!gp.buttons[n]?.pressed;
    const st = (G.padPrev ||= {})[i] ||= {};
    if (b(0) && !st.a) jp = true; if (b(1) && !st.b) dp = true; if (b(2) && !st.x) up = true; st.a = b(0); st.b = b(1); st.x = b(2);
    jump ||= b(0); brace ||= b(5) || b(7) || b(4); pull ||= b(6); reset ||= b(3); cup ||= b(12); punch ||= b(14); kick ||= b(15); // gâchette gauche = tirer, croix haut = courte échelle, croix gauche / droite = poing / pied
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0; if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) Scene.camInput(-rx * 0.04 * CFG.sens, ry * 0.025, 0);
  }
  if (jp) slot[k].jc++; if (dp) slot[k].dc++; if (up) slot[k].uc++;
  const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
  // déplacement relatif à la caméra
  const yaw = Scene.controlYaw(k, G.W?.pl[G.mode === 'online' ? G.me ?? 0 : k], l > 0.2), c = Math.cos(yaw), s = Math.sin(yaw);
  return { mx: ax * c - ay * s, mz: -ax * s - ay * c, jump, brace, pull, cup, punch, kick, slide, reset, jc: slot[k].jc, dc: slot[k].dc, uc: slot[k].uc };
}
// souris : glisser = tourner la caméra, molette = recul
let drag = null;
addEventListener('pointerdown', (e) => {
  Music.unlock(); Snd.unlock(); Sfx.load();
  if (G.capturing && G.capturing.armed) { e.preventDefault(); endCapture('Mouse' + e.button); return; }
  if (e.button === 1 && e.target.id === 'gl' && G.mode && G.W && !Object.values(BIND).some((l) => l.includes('Mouse1'))) { e.preventDefault(); pingDown(e); return; } // molette : pings (sauf si une action y est réglée)
  if (e.target.id === 'gl' && CFG.camLock && G.mode && !G.paused && !document.pointerLockElement) e.target.requestPointerLock?.(); // caméra verrouillée au pointeur : le premier clic dans le jeu capture la souris
  if (e.target.id === 'gl') { if (!Object.values(BIND).some((l) => l.includes('Mouse' + e.button))) drag = { x: e.clientX, y: e.clientY }; // caméra : un bouton qui n'est pas une action (clic droit par défaut)
    const k = 'Mouse' + e.button; if (!keys.has(k)) pressed.add(k); keys.add(k); }
});
addEventListener('mousedown', (e) => { if (e.button > 0 && (e.target.id === 'gl' || G.capturing)) e.preventDefault(); }); // clic molette / boutons latéraux : pas de défilement ni de navigation
// boutons latéraux de la souris (précédent / suivant) : le navigateur navigue au RELÂCHEMENT (et à auxclick), pas seulement à l'appui. On bloque les quatre événements
// tant qu'on joue, dans le jeu ou pendant le réglage d'une touche ; ils restent utilisables comme actions (« Souris 4 / 5 » dans les réglages).
for (const ev of ['mousedown', 'mouseup', 'auxclick', 'click']) addEventListener(ev, (e) => { if ((e.button === 3 || e.button === 4) && (e.target.id === 'gl' || G.mode || G.capturing)) { e.preventDefault(); e.stopPropagation(); } }, true);
addEventListener('pointerup', (e) => { keys.delete('Mouse' + e.button); if (e.button === 1 && PW.down) pingUp(e); });
addEventListener('pointercancel', () => { for (let b = 0; b < 5; b++) keys.delete('Mouse' + b); });
addEventListener('pointermove', (e) => { if (PW.open) wheelHover(e); if (document.pointerLockElement) { Scene.camInput(-e.movementX * 0.0032 * CFG.sens, e.movementY * 0.0022 * (CFG.invert ? -1 : 1), 0); return; } if (!drag) return; Scene.camInput(-(e.clientX - drag.x) * 0.006 * CFG.sens, (e.clientY - drag.y) * 0.004 * (CFG.invert ? -1 : 1), 0); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('contextmenu', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }); // pas de menu du clic droit dans le jeu
addEventListener('wheel', (e) => { if (G.mode) Scene.camInput(0, 0, Math.sign(e.deltaY) * 1.2); }, { passive: true });
function camKeys(dt) { const r = (anyKey(BIND.camR) ? 1 : 0) - (anyKey(BIND.camL) ? 1 : 0); if (r) Scene.camInput(-r * 1.8 * dt * CFG.sens, 0, 0); }

/* ------------------------------ pings (client/pings.js) : clic molette = « Ici ! » ; molette maintenue = roue ------------------------------ */
const PW = { down: false, open: false, x: 0, y: 0, t: null, pt: null, sel: null };
const WHEEL = ['here', 'go', 'stop', 'come']; // haut, droite, bas, gauche
const mySeat = () => (G.mode === 'online' ? G.me : 0);
function pingDown(e) {
  if (mySeat() == null) return; // spectateur
  PW.down = true; PW.x = e.clientX; PW.y = e.clientY; PW.pt = Pings.pickPoint(e.clientX, e.clientY, G.W, mySeat());
  clearTimeout(PW.t); PW.t = setTimeout(() => { if (!PW.down) return; PW.open = true; PW.sel = null; const w = $('#wheel'); w.style.left = PW.x + 'px'; w.style.top = PW.y + 'px'; w.classList.add('on'); w.querySelectorAll('[data-k]').forEach((x) => x.classList.remove('sel')); }, 220);
}
function wheelHover(e) {
  const dx = e.clientX - PW.x, dy = e.clientY - PW.y;
  PW.sel = Math.hypot(dx, dy) < 26 ? null : WHEEL[(Math.round(Math.atan2(dx, -dy) / (Math.PI / 2)) + 4) % 4];
  $('#wheel').querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('sel', x.dataset.k === PW.sel));
}
function pingUp(e) {
  clearTimeout(PW.t); PW.down = false;
  const k = PW.open ? PW.sel : 'here'; PW.open = false; $('#wheel').classList.remove('on');
  if (k && PW.pt) sendPing(k, PW.pt);
}
function sendPing(k, p) {
  const seat = mySeat(); if (seat == null || !G.W) return;
  const at = k === 'stop' || k === 'come' ? G.W.pl[seat] : p;
  Pings.show(k, seat, at.x, at.y, at.z);
  if (G.mode === 'online') net?.send({ t: 'mark', k, x: Math.round(at.x * 100) / 100, y: Math.round(at.y * 100) / 100, z: Math.round(at.z * 100) / 100 });
}

/* ------------------------------ écrans ------------------------------ */
function show(id) { for (const s of $$('.screen')) s.classList.toggle('on', s.id === id); document.body.dataset.screen = id || 'game'; }
function toast(msg, ms = 2600) { const el = $('#toast'); el.textContent = tr(msg); el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; }

/* ------------------------------ partie ------------------------------ */
let loading = null;
async function ensureScene(quiet) {
  if (!Scene.S.renderer) Scene.init($('#gl'));
  if (!Scene.S.ready) {
    if (!quiet) show('loading');
    loading ||= Scene.load((k) => { $('#loadbar i').style.width = Math.round(k * 100) + '%'; $('#m-load').style.width = Math.round(k * 100) + '%'; });
    await loading;
  }
  Scene.S.debugCam = null;
}
const setLoad = (k, msg) => { $('#loadbar i').style.width = Math.round(k * 100) + '%'; if (msg) $('#load-msg').textContent = tr(msg); };
// tout charger AVANT le départ : décor (déjà construit), textures + géométries de TOUTE la montagne envoyées au GPU, sons communs et du monde, musique du monde.
// Rien ne doit arriver en cours de partie (à-coups, sons absents les premières secondes). La simulation attend (G.prep) ; l'écran de chargement reste affiché.
async function prepare(W) {
  const cap = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  setLoad(0.35, 'Textures et décor…'); await Scene.warm((k) => setLoad(0.35 + k * 0.3));
  setLoad(0.68, 'Sons…'); await cap(Sfx.load() || Promise.resolve(), 8000);
  for (let i = 0; i < 4; i++) { Scene.frame(W, 0.016, { me: G.me }); await new Promise((r) => setTimeout(r, 30)); } // quelques images : les mondes demandent leurs sons à ce moment
  await cap(Sfx.idle(), 8000);
  setLoad(0.88, 'Musique…'); await Music.ready(6000);
  setLoad(1, 'Prêt !'); await new Promise((r) => setTimeout(r, 150));
}
// fond du menu : la vraie montagne, caméra qui longe lentement la paroi (les grimpeurs attendent au pied)
async function backdrop() {
  await ensureScene(true);
  if (G.mode) return;
  const W = createWorld({ course: 'tour' }); await Scene.buildLevel(W); if (G.mode) return; G.demo = W; Scene.setRoster(); document.body.classList.add('live'); Music.playWorld('medieval');
}
function demoFrame(dt) {
  const t = (G.demoT = (G.demoT || 0) + dt), u = (Math.sin(t * 0.045 - 1.4) + 1) / 2, y = 4 + u * 82;
  Scene.S.debugCam = { pos: [Math.sin(t * 0.07) * 14 + 4, y + 6, 30 + Math.cos(t * 0.05) * 4], look: [Math.sin(t * 0.07) * 6 - 2, y + 2, -6] };
  Scene.frame(G.demo, dt, {}); Scene.homeChain(t, true); document.body.classList.add('chain3d');
  $('#m-alt').textContent = Math.round(y * 14.3).toLocaleString('fr-FR'); // la caméra grimpe : l'altitude défile
}
async function startLocal() {
  await ensureScene();
  show('loading');
  G.prep = true; setLoad(0.05, 'Construction du décor…');
  G.mode = 'local'; G.me = null; G.demo = null; G.W = freshWorld(); G.names = G.solo ? [CFG.name || tr('Toi'), ''] : ['Grimpeur 1', 'Grimpeur 2'];
  await Scene.buildLevel(G.W); Scene.setRoster(); G.acc = 0; G.done = false; Music.playWorld(G.W.level.world);
  await prepare(G.W); G.prep = false; G.last = performance.now();
  G.pt?.onStart?.();
  show(null); $('#hud').classList.add('on'); $('#help').classList.add('show'); setTimeout(() => $('#help').classList.remove('show'), 9000);
  $('#hud').dataset.mode = G.solo ? 'solo' : 'local';
}
// SPEEDRUN SOLO : un seul grimpeur sans chaîne (W.alone : second saut, une plaque suffit) ; chaque pas d'entrée est enregistré (G.run, par séries
// identiques) pour que le serveur rejoue la partie et la chronomètre lui-même (core/replay.js) ; temps de passage comparés au record de l'appareil.
function freshWorld() { const W = createWorld({ L: G.L, course: G.course }); if (G.solo) { W.alone = true; G.run = []; G.splits = []; G.forceReset = 0; } if (G.replay) { G.replay.i = 0; G.replay.k = 0; } return W; }
const quant = (I) => decIn(encIn(0, I)); // entrées arrondies comme celles envoyées au serveur : le rejeu est identique au pas près
function recStep(I) { const e = encIn(0, I), l = G.run[G.run.length - 1]; if (l && l.every((v, k) => k === 0 || v === e[k])) l[0]++; else { e[0] = 1; G.run.push(e); } }
function stopGame() { Pings.clear(); if (G.replay?.prevL) G.L = G.replay.prevL; G.replay = null; $('#h-replay').classList.remove('on'); if (G.mode) setTimeout(backdrop, 0); G.mode = null; G.solo = false; G.W = null; $('#hud').classList.remove('on'); G.paused = false; $('#pause').classList.remove('on'); }
function togglePause(v) {
  G.paused = v ?? !G.paused; if (G.paused) document.exitPointerLock?.(); $('#pause').classList.toggle('on', G.paused);
  $('#p-restart').style.display = G.mode === 'online' && G.room && G.room.host !== G.room.you ? 'none' : '';
}
// portail : fondu lumineux, puis parcours suivant (en ligne, l'hôte relance le salon sur ce parcours)
function toNext() {
  const nx = nextCourse(G.course, !!G.pt); if (!nx) return;
  Snd.play('portal'); $('#fade').classList.add('on'); $('#end').classList.remove('on');
  setTimeout(async () => {
    if (G.mode === 'online') net?.send({ t: 'next', course: nx.id });
    else { G.course = nx.id; safe(() => localStorage.setItem('ch-course', G.course)); await startLocal(); }
    setTimeout(() => $('#fade').classList.remove('on'), 300);
  }, 900);
}
function restartFromStart() {
  if (G.mode === 'local') { const W = freshWorld(); G.W = W; Scene.buildLevel(W).then(() => Scene.setRoster()); G.done = false; $('#end').classList.remove('on'); }
  else net?.send({ t: 'restart' });
  togglePause(false);
}
function toCheckpoint() {
  if (G.solo) G.forceReset = 20; // solo : comme appuyer sur R (une entrée enregistrée, donc rejouée par le serveur)
  else if (G.mode === 'local') { G.W.resets++; spawnAt(G.W, G.W.cp); Scene.onEvent(G.W, { k: 'respawn' }); Snd.play('respawn'); }
  else net?.send({ t: 'cp' });
  togglePause(false);
}

/* ------------------------------ événements -> sons et effets ------------------------------ */
const GLOBAL = new Set(['lost', 'punch', 'down', 'checkpoint', 'respawn', 'finish', 'collapse', 'restore', 'save', 'abyss', 'reset']);
function handleEvents(W, list, fromServer) {
  for (const e of list) {
    if (G.mode === 'online' && GLOBAL.has(e.k) !== !!fromServer) continue; // en ligne : le serveur annonce les événements communs, la prédiction les gestes
    Scene.onEvent(W, e);
    const p = e.p != null ? W.pl[e.p] : null, pan = p ? panOf(p) : 0;
    switch (e.k) {
      case 'slide': Snd.play('slide', { pan }); break;
      case 'jump': if (!p || !Sfx.jump(p.x, p.y + 1.5, p.z, { key: e.p, rate: 0.97 + Math.random() * 0.06 })) Snd.play('jump', { pan }); break; // la voix du propriétaire
      case 'land': if (e.v > 3) Snd.play('land', { pan, v: e.v }); break;
      case 'grab': Snd.play('grab', { pan }); break;
      case 'mantle': Snd.play('mantle', { pan }); break;
      case 'jerk': { const n = W.ch[6], v = Math.min(1, 0.35 + e.v / 9); if (Sfx.chain('jerk', n.x, n.y, n.z, { v, rate: 0.92 + Math.random() * 0.16 })) Sfx.chain('clink', n.x, n.y, n.z, { v: v * 0.6, key: 'j' }); else Snd.play('jerk', { v: e.v }); break; }
      case 'slack': { const n = W.ch[6]; Sfx.chain('drop', n.x, n.y, n.z, { v: 0.35, gap: 0.5 }); break; } // la chaîne retombe, détendue
      case 'hit': Snd.play('hit', { pan }); break;
      case 'swing': Snd.play('swing', { pan }); break;
      case 'punch': Snd.play('punch', { pan: e.v != null ? panOf(W.pl[e.v]) : 0 }); break;
      case 'down': Snd.play('thud', { pan }); break;
      case 'crack': Snd.play('crack'); break;
      case 'collapse': Snd.play('collapse'); break;
      case 'checkpoint': Snd.play('checkpoint'); { const t = Scene.S.cps?.[e.cp]?.g.position; if (t) Sfx.one('totem_ignite', t.x, t.y + 2, t.z, { v: 0.9 }); } // le totem s'embrase
        if (G.solo) splitToast(W, e.cp); else toast('Point de passage : ' + (LV().checkpoints[e.cp].name || 'zone ' + e.cp)); flashZone(e.cp); break;
      case 'save': Snd.play('save'); toast('Sauvetage !', 1500); break;
      case 'respawn': Snd.play('respawn'); break;
      case 'abyss': toast('Chute dans le vide… retour au point de passage', 2200); break;
      case 'lost': toast('Tombés trop bas… retour au point de passage', 2200); break;
      case 'finish': Snd.play('finish'); break;
    }
  }
}
function panOf(p) { const s = Scene.project(p.x, p.y + 1, p.z); return Math.max(-0.8, Math.min(0.8, (s.x / innerWidth) * 2 - 1)); }
// pas et cliquetis de la chaîne (déduits de l'état à l'écran)
function footsteps(W, dt) {
  for (let k = 0; k < (W.alone ? 1 : 2); k++) { // solo : l'ombre du partenaire ne fait pas de bruit de pas
    const p = W.pl[k]; if (p.st !== ST.GROUND) { G.stepT[k] = 0; continue; }
    const v = Math.hypot(p.vx - p.gvx, p.vz - p.gvz); if (v < 0.8) continue;
    G.stepT[k] += dt * (v / 6.2) * 3.4;
    if (G.stepT[k] > 1) { G.stepT[k] = 0; const b = W.bodies[p.gb]; Snd.play('step', { k, pan: panOf(p), v: Math.min(1, v / 6), wood: b && (b.mat === 'wood' || b.mat === 'darkwood') }); }
  }
  const a = W.pl[0], b = W.pl[1], mv = Math.hypot(a.vx - b.vx, a.vy - b.vy, a.vz - b.vz);
  if (W.alone) return Snd.fall(-a.vy);
  // chaîne : maillons qui s'entrechoquent quand elle bouge (léger : cliquetis ; vif : frottements), grincement sous forte tension,
  // tractions main sur main quand on tire (V) ou qu'on remonte la chaîne — vrais enregistrements, placés sur la chaîne
  const n6 = W.ch[6], real = Sfx.chainReady();
  if (W.ten < 0.5 && mv > 1.5 && Math.random() < dt * mv * 2) { const v = Math.min(1, mv / 6); if (!real) Snd.play('rattle', { v }); else Sfx.chain(mv > 4 ? 'rattle' : 'clink', n6.x, n6.y, n6.z, { v: 0.25 + v * 0.55, rate: 0.9 + Math.random() * 0.25 }); }
  if (W.ten > 0.85 && Math.random() < dt * 5) { if (!real) Snd.play('creak'); else Sfx.chain('rattle', n6.x, n6.y, n6.z, { v: 0.3, rate: 0.7, gap: 0.3, key: 't' }); }
  for (const p of W.pl) if (p.haul || p.ropeUp) { p._pullT = (p._pullT || 0) - dt; if (p._pullT <= 0) { p._pullT = p.haul ? 0.5 : 0.62; Sfx.chain('pull', p.x, p.y + 1.2, p.z, { v: p.haul ? 0.85 : 0.6, key: 'p' + p.id, gap: 0.3 }); } }
  Snd.fall(Math.max(-a.vy, -b.vy));
}

/* ------------------------------ boucle ------------------------------ */
function stepLocal() {
  const W = G.W;
  if (G.replay?.coop) { pressed.clear(); stepCoop(W, G.replay.run, G.replay); handleEvents(W, W.ev, false); return; } // replay d'un record à deux : les entrées des deux grimpeurs, enregistrées par le serveur
  if (G.solo) { // un seul grimpeur : les deux côtés du clavier et toutes les manettes le pilotent
    if (G.replay) { const R = G.replay, e = R.run[R.i]; pressed.clear(); const I = e ? decIn(e) : IDLE; if (e && ++R.k >= e[0]) { R.i++; R.k = 0; } stepWorld(W, [I, IDLE]); handleEvents(W, W.ev, false); return; }
    const I = quant({ ...readInput(0, ['k1', 'k2'], [0, 1, 2, 3]), ...(G.forceReset > 0 ? { reset: true } : {}) }); pressed.clear();
    if (G.forceReset > 0) G.forceReset--;
    if (!W.done) recStep(I);
    stepWorld(W, [I, IDLE]); handleEvents(W, W.ev, false); return;
  }
  let inA = readInput(0, ['k1'], [0]), inB = readInput(1, ['k2'], [1]);
  if (G.pt?.inputs) [inA, inB] = G.pt.inputs(G.W, inA, inB); // mode test : IA du partenaire, échange des commandes
  pressed.clear();
  stepWorld(W, [inA, inB]); handleEvents(W, W.ev, false);
}
function stepOnline() {
  const W = G.W, me = G.me;
  if (me == null) { pressed.clear(); stepWorld(W, G.specIn || [IDLE, IDLE]); handleEvents(W, W.ev, false); return; } // spectateur : on prolonge avec les dernières entrées connues
  const my = readInput(0, ['k1', 'k2'], [0, 1]); pressed.clear();
  G.ct++; G.pend.push([G.ct, my]); if (G.pend.length > 240) G.pend.shift();
  G.out.push(encIn(G.ct, my));
  if (G.out.length >= 2) { net.send({ t: 'i', a: G.out }); G.out = []; }
  const ins = me === 0 ? [my, G.partnerIn] : [G.partnerIn, my];
  stepWorld(W, ins); handleEvents(W, W.ev, false);
}
function loop(now) {
  G.raf = now; if (!(!G.mode && G.demo)) Scene.homeChain(0, false);
  const dt = Math.min(0.1, (now - G.last) / 1000) * (G.mode === 'online' ? 1 : G.pt?.speed || 1); G.last = now;
  if (!G.mode && G.demo && Scene.S.ready) demoFrame(dt);
  if (G.mode && G.W && !Scene.S.building) {
    camKeys(dt);
    if (!G.paused || G.mode === 'online') {
      G.acc += dt; let n = 0;
      if (G.prep) G.acc = 0; // chargement : la simulation attend
      while (!G.prep && G.acc >= DT && n++ < 24) { if (G.mode === 'local') stepLocal(); else stepOnline(); G.acc -= DT; }
      if (G.acc > DT * 4) G.acc = 0;
    } else pressed.clear();
    footsteps(G.W, dt);
    Scene.frame(G.W, dt, { me: G.me });
    Scene.debugDraw(G.W, G.debug);
    hud(G.W, dt); Pings.update(G.W, dt, G.mode === 'online' ? G.me : 0);
    if (G.W.done && !G.done) { G.done = true; setTimeout(() => showEnd(G.W), 4500); }
  }
}
// une exception dans une image ne doit JAMAIS figer le jeu : on replanifie d'abord, on signale l'erreur (une fois par message) au serveur
const SEEN = new Set();
function oops(e) { const m = String(e?.message || e); console.error(e); if (SEEN.size < 20 && !SEEN.has(m)) { SEEN.add(m); try { net?.send({ t: 'err', m, at: String(e?.stack || '').split('\n').slice(0, 3).join(' / ') }); } catch { } } }
addEventListener('error', (e) => oops(e.error || e.message)); addEventListener('unhandledrejection', (e) => oops(e.reason));
function rafLoop(now) { requestAnimationFrame(rafLoop); try { loop(now); } catch (e) { oops(e); } }
requestAnimationFrame(rafLoop);
// repli si requestAnimationFrame est gelé (onglet en arrière-plan / aperçu) : la partie en ligne continue d'envoyer ses entrées
setInterval(() => { const n = performance.now(); if (n - (G.raf || 0) > 120) try { loop(n); } catch (e) { oops(e); } }, 16);

/* ------------------------------ interface en jeu ------------------------------ */
function hud(W, dt) {
  $('#h-fps').textContent = Scene.S.fps ? Scene.S.fps + ' FPS' : ''; // compteur d'images par seconde
  if (G.mode === 'online') { const lv = Voice.levels(); for (let k = 0; k < 2; k++) $('#tag' + k).classList.toggle('talk', (k === G.me ? lv.me : lv.partner) > 0.12); } // qui parle
  const [a, b] = W.pl;
  const top = Math.max(a.y, b.y), C = LV().checkpoints, cur = C[W.cp] || C[0], nx = C[W.cp + 1], low = Math.min(a.y, b.y) + 0.5;
  const z = nx && nx.y > cur.y + 3 && low >= nx.y - 0.5 ? nx.zone : cur.zone; // zone du dernier point de passage (ou la suivante, déjà atteinte en hauteur)
  $('#h-zone').textContent = `${z}. ${tr(LV().zones[z])}`;
  $('#h-alt').textContent = tr('sommet à {0} m', Math.round(LV().top)); $('#h-altbig').textContent = Math.max(0, Math.round(top));
  $('#h-time').textContent = fmt(W.time);
  $('#h-falls').textContent = W.falls; $('#h-saves').textContent = W.saves; $('#h-cp').textContent = `${W.cp + 1}/${LV().checkpoints.length}`;
  // jauge de hauteur : un point par grimpeur
  for (let k = 0; k < 2; k++) $('#h-dot' + k).style.bottom = (Math.max(0, Math.min(1, W.pl[k].y / LV().top)) * 100) + '%';
  // tension de la chaîne
  const t = W.ten; $('#h-ten i').style.width = Math.round(t * 100) + '%'; $('#h-ten').classList.toggle('hot', t > 0.8);
  $('#h-len').textContent = W.Lc < W.L - 0.1 ? `${W.Lc.toFixed(1)} m` : '';
  // endurance près de chaque grimpeur quand elle baisse
  for (let k = 0; k < 2; k++) {
    const p = W.pl[k], el = $('#sta' + k), s = Scene.project(p.x, p.y + 2.35, p.z), low = p.sta < 0.995 && p.st !== ST.GROUND;
    el.style.opacity = low && s.vis ? 1 : 0; el.style.transform = `translate(${s.x - 16}px, ${s.y - 16}px)`;
    el.style.setProperty('--v', Math.max(0, p.sta)); el.classList.toggle('warn', p.sta < 0.3);
    const tag = $('#tag' + k), s2 = Scene.project(p.x, p.y + 2.1, p.z);
    tag.style.transform = `translate(${s2.x}px, ${s2.y}px)`; tag.style.opacity = s2.vis ? 1 : 0; tag.textContent = G.names[k];
  }
  // astuce du coin
  let hint = '';
  for (const h of LV().hints) for (const p of W.pl) if (Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z) < 4.5) { const t = G.solo ? soloHint(h.txt) : h.txt; if (t) hint = hintKeys(tr(t)); }
  const resetting = Math.max(...W.resetHold);
  if (W.lostT > 0.05) hint = tr('Tombés trop bas : retour au point de passage…');
  else if (resetting > 0.05 && !G.solo) hint = tr('Retour au point de passage… {0}', Math.ceil((1 - resetting) * 10) / 10);
  else if (Math.max(a.y, b.y) < LV().checkpoints[W.cp].y - 10 && a.st === ST.GROUND && b.st === ST.GROUND && !G.solo) hint = hintKeys(tr('Tombés bien bas ? Maintenez R pour revenir au point de passage'));
  else if (G.solo && Math.max(a.y, b.y) < LV().checkpoints[W.cp].y - 6 && a.st === ST.GROUND) hint = hintKeys(tr('R : revenir au point de passage'));
  $('#h-hint').textContent = hint; $('#h-hint').classList.toggle('on', !!hint);
  // débogage : états, tension, longueur
  if (G.debug) $('#dbg').textContent = W.pl.map((p, k) => `J${k + 1} ${['sol', 'air', 'rebord', 'paroi', 'hisse'][p.st]} y=${p.y.toFixed(2)} v=${Math.hypot(p.vx, p.vz).toFixed(1)}/${p.vy.toFixed(1)} end=${p.sta.toFixed(2)} ${p.brace ? 'ARC' : ''} ${p.dangling ? 'PEND' : ''}`).join('\n') + `\nchaîne ${W.Lc.toFixed(2)}/${W.L} tension ${W.ten.toFixed(2)}  tick ${W.tick}  ${G.mode === 'online' ? 'rtt ' + Math.round(net.rtt) + ' ms, en attente ' + G.pend.length : ''}`;
  $('#dbg').style.display = G.debug ? 'block' : 'none';
}
// speedrun solo : les astuces écrites pour deux sont reformulées (pas de partenaire ni de chaîne)
function soloHint(txt) {
  if (/courte échelle/i.test(txt)) return "Seul : saute, puis appuie encore sur Espace en l'air (second saut) pour attraper le rebord";
  if (/balises/i.test(txt)) return "Seul : allume les trois balises d'affilée en courant (F), elles brûlent juste assez longtemps";
  if (/plaque|dalle/i.test(txt)) return 'Seul : une seule plaque suffit à ouvrir, puis cours';
  return /partenaire|chaîne|ensemble|chacun|tous les deux/i.test(txt) ? '' : txt;
}
function flashZone(cp) { const el = $('#zonecard'); const c = LV().checkpoints[cp]; el.innerHTML = `<small>${tr("Zone {0}", c.zone)}</small><b>${esc(tr(c.name))}</b>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
/* ------------------------------ records et médailles (par parcours, sur cet appareil) ------------------------------ */
const BEST = safe(() => JSON.parse(localStorage.getItem('ch-best')), null) || {};
const BEST_SOLO = safe(() => JSON.parse(localStorage.getItem('ch-best-solo')), null) || {}; // speedrun solo : { idParcours: { time, falls, medal, clean, splits: [temps à chaque point de passage] } }
function splitToast(W, cp) {
  G.splits[cp] = W.time; const ref = BEST_SOLO[W.level.id]?.splits?.[cp], el = $('#split'), d = ref == null ? null : W.time - ref;
  el.innerHTML = `<b>${fmt(W.time)}</b>` + (d == null ? '' : `<i class="${d <= 0 ? 'ahead' : 'behind'}">${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(1)} s</i>`);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function medalOf(c, time) { const m = c.medals || {}; return time <= m.gold ? 'gold' : time <= m.silver ? 'silver' : time <= m.bronze ? 'bronze' : null; }
const MEDAL = { gold: 'Or', silver: 'Argent', bronze: 'Bronze' };
function record(W) {
  const BK = G.solo ? BEST_SOLO : BEST, c = W.level, prev = BK[c.id], medal = medalOf(c, W.time), clean = W.falls === 0;
  const rec = !prev || W.time < prev.time;
  if (rec) BK[c.id] = { time: W.time, falls: W.falls, medal: medal || prev?.medal || null, clean: clean || !!prev?.clean, ...(G.solo ? { splits: G.splits } : {}) };
  else { if (medal && (!prev.medal || ['gold', 'silver', 'bronze'].indexOf(medal) < ['gold', 'silver', 'bronze'].indexOf(prev.medal))) prev.medal = medal; if (clean) prev.clean = true; }
  safe(() => localStorage.setItem(G.solo ? 'ch-best-solo' : 'ch-best', JSON.stringify(BK)));
  return { medal, clean, rec };
}
function showEnd(W) {
  if (G.replay) {
    $('#e-medal').innerHTML = `<i class="rec">${tr('Replay')}</i>`; $('#e-time').textContent = fmt(W.time); $('#e-falls').textContent = W.falls; $('#e-resets').textContent = W.resets;
    $('#e-names').textContent = G.replay.name; $('#e-saves').parentElement.style.display = 'none'; $('#e-sub').style.display = 'none'; $('#e-next').style.display = 'none'; $('#e-again').style.display = '';
    $('#e-again').textContent = tr('Revoir'); $('#e-board').innerHTML = `<li class="muted">${tr('Temps du record : {0}', fmt(G.replay.time))}</li>`; $('#end').classList.add('on'); return;
  }
  $('#e-again').textContent = tr('Recommencer');
  const r = record(W);
  $('#e-medal').innerHTML = (r.medal ? `<i class="${r.medal}">${tr('Médaille {0}', tr(MEDAL[r.medal]))}</i>` : '') + (r.clean ? `<i class="clean">${tr('Sans chute')}</i>` : '') + (r.rec ? `<i class="rec">${tr('Record personnel')}</i>` : '');
  $('#e-time').textContent = fmt(W.time); $('#e-falls').textContent = W.falls; $('#e-saves').textContent = W.saves; $('#e-resets').textContent = W.resets;
  $('#e-names').textContent = G.solo ? G.names[0] : G.names.join(' & ');
  $('#e-saves').parentElement.style.display = G.solo ? 'none' : ''; $('#e-sub').style.display = 'none';
  $('#end').classList.add('on');
  const lead = G.mode === 'local' || (G.room && G.room.host === G.room.you), nx = nextCourse(G.course, !!G.pt);
  $('#e-again').style.display = lead ? '' : 'none';
  $('#e-next').style.display = lead && nx ? '' : 'none'; if (nx) $('#e-next').textContent = tr('Franchir le portail › ') + tr(nx.name);
  if (G.solo) { if (W.level.published) submitRun(W); else renderBoard(null); }
  else if (G.mode === 'local') renderBoard(null);
}
// classement solo : le serveur rejoue la partie ; il faut un pseudo (demandé sur l'écran de fin s'il n'y en a pas encore)
let SIMV = ''; // version de la physique au serveur (pour signaler un replay enregistré avec une autre)
// REPLAY d'un record solo : la partie (entrées pas à pas) est rejouée avec la vraie physique, caméra et sons comme en jeu ; Suppr la relance, Échap pour quitter
async function watchReplay(rid) {
  let rep = null; try { const r = await fetch(new URL('/enchaines-ws/replay?id=' + rid, location.origin)); if (r.ok) rep = await r.json(); } catch { }
  if (!rep?.run) { toast('Replay introuvable'); return; }
  if (SIMV && rep.v !== SIMV) toast('Replay enregistré avec une ancienne version du jeu : il peut diverger', 4000);
  $('#end').classList.remove('on'); if (G.mode) stopGame();
  G.course = rep.course;
  if (rep.coop) { G.solo = false; G.replay = { coop: 1, run: rep.run, i: 0, k: 0, name: rep.names.join(' & '), time: rep.time, prevL: G.L }; G.L = rep.L; } // record à deux : même longueur de chaîne que la montée
  else { G.solo = true; G.replay = { run: rep.run, i: 0, k: 0, name: rep.name, time: rep.time }; }
  await startLocal(); G.names = rep.coop ? rep.names : [rep.name, ''];
  $('#h-replay').innerHTML = `<b>${tr('REPLAY')}</b> ${esc(G.replay.name)} · ${fmt(rep.time)}<small>${tr('Suppr : revoir · Échap : quitter')}</small>`; $('#h-replay').classList.add('on'); $('#help').classList.remove('show');
}
async function submitRun(W) {
  if (!CFG.name) { $('#e-sub').style.display = ''; $('#e-board').innerHTML = `<li class="muted">${tr('Choisis un pseudo pour entrer au classement')}</li>`; return; }
  $('#e-board').innerHTML = `<li class="muted">${tr('Le serveur vérifie ta montée…')}</li>`;
  let r = null; try { r = await (await fetch(new URL('/enchaines-ws/solo', location.origin), { method: 'POST', body: JSON.stringify({ course: W.level.id, name: CFG.name, run: G.run }) })).json(); } catch { }
  if (!r?.ok) { $('#e-board').innerHTML = `<li class="muted">${tr('Montée non validée par le serveur')}${r?.why ? ' (' + esc(tr(r.why)) + ')' : ''}</li>`; return; }
  renderBoard(r.board, r.rank >= 0 && r.rank < 5 ? r.rank : null);
  if (r.kept) { const mine = r.board.find((x) => x.names[0].toLowerCase() === CFG.name.toLowerCase()); $('#e-board').insertAdjacentHTML('beforeend', `<li class="muted">${tr("Ton record est meilleur ({0}) : cette montée n'est pas enregistrée.", mine ? fmt(mine.time) : '')}</li>`); }
}
function renderBoard(list, mine) {
  const el = $('#e-board');
  if (!list) { el.innerHTML = `<li class="muted">${tr(G.solo ? 'Parcours en test : pas de classement.' : 'Le classement est réservé aux parties en ligne.')}</li>`; return; }
  el.innerHTML = list.length ? list.map((r, i) => `<li class="${mine === i ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.names.join(' & '))}</b><em>${fmt(r.time)}</em><small>${tr('{0} chutes', r.falls)}</small>${r.rid ? `<button class="mini watch" data-replay="${r.rid}" title="${tr('Revoir la montée')}${r.v && r.v !== SIMV ? ' — ' + tr('enregistrée avec une ancienne version du jeu : peut diverger') : ''}">▶ ${tr('Revoir')}</button>` : ''}</li>`).join('') : `<li class="muted">${tr('Personne n\'a encore atteint le sommet.')}</li>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------ en ligne ------------------------------ */
// la liste des salons ouverts se met à jour toute seule tant qu'on est sur l'écran « Jouer en ligne » (avant : une seule demande à l'ouverture, un salon créé ensuite n'apparaissait qu'après avoir cliqué sur ↻)
setInterval(() => { if (document.body.dataset.screen === 'online' && net?.up) net.send({ t: 'list' }); }, 2500);
let net = null;
const encIn = (ct, I) => [ct, Math.round(I.mx * 100) / 100, Math.round(I.mz * 100) / 100, (I.jump ? 1 : 0) | (I.brace ? 2 : 0) | (I.reset ? 4 : 0) | (I.pull ? 8 : 0) | (I.cup ? 16 : 0) | (I.punch ? 32 : 0) | (I.kick ? 64 : 0) | (I.slide ? 128 : 0), I.jc, I.dc, I.uc || 0];
const decIn = (a) => (a ? { mx: a[1], mz: a[2], jump: !!(a[3] & 1), brace: !!(a[3] & 2), reset: !!(a[3] & 4), pull: !!(a[3] & 8), cup: !!(a[3] & 16), punch: !!(a[3] & 32), kick: !!(a[3] & 64), slide: !!(a[3] & 128), jc: a[4], dc: a[5], uc: a[6] || 0 } : IDLE);
function getNet() {
  if (net) return net;
  net = createNet(() => CFG.name || 'Grimpeur');
  net.onState = (up) => { $('#netstate').textContent = up ? '' : tr('Connexion au serveur…'); };
  net.on('room', (m) => { G.room = m; net.setRoom(m.code); renderRoom(m); if (m.phase === 'lobby' && !G.mode) show('room'); chatShow(true);
    if (m.you != null && m.players.length === 2) Voice.start(net, m.you); else Voice.stop(); }); // chat vocal : liaison directe dès que le salon a ses deux grimpeurs
  net.on('chat', (m) => chatAdd(m));
  net.on('mark', (m) => { if (G.mode === 'online' && m.seat !== G.me) Pings.show(m.k, m.seat, m.x, m.y, m.z); }); // ping du partenaire
  net.on('rtc', (m) => Voice.onSignal(m.d));
  net.on('rooms', (m) => renderRooms(m.list));
  net.on('hi', (m) => { Voice.setIce(m.ice); if (G.pt?.key) net.send({ t: 'pt', key: G.pt.key }); if (document.body.dataset.screen === 'board') askBoard(); if (document.body.dataset.screen === 'online') net.send({ t: 'list' }); });
  net.on('err', (m) => { if (net.auto) { net.auto = false; net.setRoom(null); G.room = null; return; } toast(m.m); }); // reprise automatique sur un salon disparu : silence
  net.on('left', () => { net.setRoom(null); G.room = null; Voice.stop(); chatShow(false); stopGame(); show('online'); });
  net.on('start', async (m) => {
    await ensureScene();
    show('loading'); G.prep = true; setLoad(0.05, 'Construction du décor…');
    G.mode = 'online'; G.demo = null; G.me = m.seat; G.names = m.names; G.L = m.L;
    G.course = m.course || DEFAULT_COURSE; setTimeout(() => $('#fade').classList.remove('on'), 400);
    G.W = applySnap(createWorld({ L: m.L, course: G.course }), m.s); G.ct = 0; G.pend = []; G.out = []; G.partnerIn = IDLE; G.done = false; slot[0].jc = slot[0].dc = slot[0].uc = 0;
    const W = G.W; await Scene.buildLevel(W); if (G.W !== W) return; Scene.setRoster(); Music.playWorld(W.level.world); // partie quittée pendant le chargement : on s'arrête là
    await prepare(W); if (G.W !== W) return; G.prep = false; G.last = performance.now(); G.acc = 0;
    show(null); $('#hud').classList.add('on'); $('#hud').dataset.mode = 'online'; $('#end').classList.remove('on');
    $('#help').classList.add('show'); setTimeout(() => $('#help').classList.remove('show'), 9000);
  });
  net.on('s', (m) => {
    if (G.mode !== 'online' || !G.W) return;
    const W = G.W, me = G.me;
    if (me == null) { const before = W.pl.map((p) => [p.x, p.y, p.z]); applySnap(W, m.w); G.specIn = m.in.map(decIn); W.pl.forEach((p, k) => Scene.addError(k, before[k][0] - p.x, before[k][1] - p.y, before[k][2] - p.z)); if (m.e?.length) handleEvents(W, m.e, true); return; }
    const ack = m.ack[me];
    while (G.pend.length && G.pend[0][0] <= ack) G.pend.shift();
    const before = W.pl.map((p) => [p.x, p.y, p.z]);
    applySnap(W, m.w);
    G.partnerIn = decIn(m.in[1 - me]);
    for (const [, I] of G.pend) stepWorld(W, me === 0 ? [I, G.partnerIn] : [G.partnerIn, I]);
    W.ev.length = 0;
    W.pl.forEach((p, k) => Scene.addError(k, before[k][0] - p.x, before[k][1] - p.y, before[k][2] - p.z));
    desyncWatch(W, me, before, m);
    if (m.e?.length) handleEvents(W, m.e, true);
  });
  net.on('end', (m) => { renderBoard(m.board, m.rank); });
  net.on('board', (m) => { if ((m.solo || 0) !== G.bSolo || m.course !== G.bCourse) return; if (m.simV) SIMV = m.simV; renderRecords(m.list); });
  return net;
}
/* ------------------------------ chat texte et vocal du salon ------------------------------ */
function chatShow(on) { $('#chat').classList.toggle('on', on); }
function chatAdd(m) {
  const li = document.createElement('li'); li.className = 'c' + (m.seat ?? 's');
  const b = document.createElement('b'); b.textContent = m.name + (m.seat == null ? ' ' + tr('(spectateur)') : '') + ' : '; li.append(b, document.createTextNode(m.m)); // textContent : aucun HTML injecté
  const log = $('#chat-log'); log.append(li); while (log.children.length > 30) log.firstChild.remove();
  log.scrollTop = log.scrollHeight; li.dataset.t = Date.now(); Snd.play('ui');
}
$('#chat-in').addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') { const v = e.target.value.trim(); if (v) net?.send({ t: 'chat', m: v }); e.target.value = ''; e.target.blur(); e.preventDefault(); }
  else if (e.code === 'Escape') { e.target.value = ''; e.target.blur(); }
  e.stopPropagation();
});
async function micToggle() {
  const r = await Voice.toggleMic(G.fakeMic); if (!r.ok) toast(tr('Micro indisponible : ') + tr(r.why) + tr(' (autorise le micro dans le navigateur)'), 3500);
  else toast(r.on ? "Micro ouvert : ton partenaire t'entend" : 'Micro coupé', 1500);
  micLabel();
}
function micLabel() { const s = Voice.status(); $('#mic').textContent = !s.mic ? tr('Activer le micro (M)') : s.on ? tr('Micro ouvert (M)') : tr('Micro coupé (M)'); $('#mic').classList.toggle('live', s.mic && s.on); $('#mic-link').textContent = s.link === 'connected' ? 'vocal relié' : s.link === 'off' ? '' : s.link === 'failed' ? 'vocal : échec de la liaison' : 'vocal : connexion…'; }
Voice.onChange(micLabel);
// MOUCHARD : si la prédiction s'écarte nettement de ce que calcule le serveur (> 0,8 m, 4 fois en 3 s), on envoie l'état au serveur (journal
// enchaines-mm, message 'err' déjà enregistré) : de quoi comprendre un « bloqué / sauts infinis » signalé en partie sans pouvoir le reproduire.
const DS = { n: 0, t0: 0, sent: 0 };
function desyncWatch(W, me, before, m) {
  const p = W.pl[me], e = Math.hypot(before[me][0] - p.x, before[me][1] - p.y, before[me][2] - p.z), now = performance.now();
  if (e < 0.8) return; if (now - DS.t0 > 3000) { DS.t0 = now; DS.n = 0; } if (++DS.n < 4 || now - DS.sent < 15000) return; DS.sent = now;
  const f = (q) => `st${q.st} ${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)} v${q.vy.toFixed(1)} jc${q.jc} cup${q.cup ? 1 : 0} mate${q.onMate ? 1 : 0} gb${q.gb}`;
  try { net?.send({ t: 'err', m: `DESYNC ${W.level.id} cp${W.cp} seat${me} e=${e.toFixed(2)} n${DS.n}`, at: `moi(prédit) ${before[me].map((v) => v.toFixed(2)).join(',')} | serveur+rejeu ${f(p)} | partenaire ${f(W.pl[1 - me])} | pend ${G.pend.length} ack ${m.ack[me]} ct ${G.ct} rtt ${Math.round(net?.rtt || 0)} in ${JSON.stringify(m.in[me])} pt ${G.pt ? 1 : 0}` }); } catch { }
}
function renderRoom(m) {
  $('#r-code').textContent = m.code;
  $('#r-link').value = location.origin + location.pathname + '?r=' + m.code;
  const host = m.host === m.you;
  $('#r-players').innerHTML = [0, 1].map((i) => { const p = m.players[i]; return `<li class="${p ? '' : 'empty'}"><i style="background:${['#ff9a3c', '#46b8ff'][i]}"></i>${p ? esc(p.name) + (p.id === m.host ? ` <small>${tr('hôte')}</small>` : '') + (p.id === m.you ? ` <small>${tr('toi')}</small>` : '') + (p.offline ? ` <small>${tr('déconnecté')}</small>` : '') : tr('En attente d\'un partenaire…')}</li>`; }).join('');
  $$('#r-len button').forEach((b) => { b.classList.toggle('on', +b.dataset.l === m.cfg.L); b.disabled = !host; });
  fillCourseSelects(); $('#r-course').value = m.cfg.course; $('#r-course').disabled = !host;
  $('#r-start').disabled = !host || m.players.length < 2;
  $('#r-start').textContent = host ? (m.players.length < 2 ? tr('En attente du 2e grimpeur') : tr('Lancer l\'ascension')) : tr('L\'hôte lance la partie');
}
function renderRooms(list) {
  $('#o-list').innerHTML = list.length ? list.map((r) => `<li><b>${esc(r.host)}</b><span>${r.n}/2</span><button data-code="${r.code}">Rejoindre</button></li>`).join('') : '<li class="muted">Aucun salon ouvert pour l\'instant.</li>';
}

/* ------------------------------ choix du parcours ------------------------------ */
const WCOL = { medieval: '#b0743c', jungle: '#3f8f4a', japan: '#c4486a', deep: '#3a4a7a', sky: '#3d8fe0', mech: '#8a6a3a', ice: '#5aa0d0', greek: '#2fa0b0', summit: '#6a5ab0' };
const visible = () => courseList(!!G.pt); // en playtest : tous les parcours, sinon seulement ceux publiés
function showCourses(mode) {
  G.pick = mode; $('#c-mode').textContent = tr(mode === 'local' ? '· à deux sur ce clavier' : mode === 'solo' ? '· speedrun solo' : '· pour ton salon');
  const list = visible();
  // la tour des mondes : un étage par monde, le sommet en haut (column-reverse), une plaque par parcours
  let n = 0; // numéro de la plaque = rang du parcours (un monde peut en avoir plusieurs : Tour de Loult et Remparts sont tous deux à l'étage 1)
  $('#c-list').innerHTML = WORLDS.map((w, i) => {
    const cs = list.filter((c) => c.world === w.id);
    if (!cs.length) return `<div class="floor none" style="--wc:${WCOL[w.id]}"><span class="lvl">${++n}</span><span class="w"><small>${tr('Étage {0} · {1}', i + 1, esc(tr(w.name)))}</small><b>${tr('Bientôt…')}</b><i>${esc(tr(w.blurb))}</i></span></div>`;
    return cs.map((c) => { const b = (mode === 'solo' ? BEST_SOLO : BEST)[c.id], d = c.diff || 1;
      return `<button class="floor${c.id === G.course ? ' sel' : ''}" data-course="${c.id}" style="--wc:${WCOL[w.id]}"><span class="lvl">${++n}</span>
        <span class="w"><small>${tr('Étage {0} · {1}', i + 1, esc(tr(w.name)))}</small><b>${esc(tr(c.name))}${c.published ? '' : '<span class="tag-pt">test</span>'}</b><i>${esc(tr(c.short || w.blurb))}</i></span>
        <span class="side"><span class="notch">${[1, 2, 3, 4, 5].map((k) => `<u class="${k <= d ? 'on' : ''}"></u>`).join('')}</span>
        <span class="rec">${b ? (b.medal ? `<span class="coin ${b.medal}">${tr(MEDAL[b.medal])[0]}</span> ` : '') + fmt(b.time) : tr('pas encore gravi')}</span></span></button>`; }).join('');
  }).join('');
  show('courses'); ($('.floor.sel') || $('.floor:not(.none)'))?.scrollIntoView({ block: 'center' });
}
function fillCourseSelects() {
  const opts = visible().map((c) => `<option value="${c.id}">${esc(tr(c.name))}${c.published ? '' : ' (test)'}</option>`).join('');
  $('#r-course').innerHTML = opts;
}
$('#r-course').addEventListener('change', (e) => net?.send({ t: 'cfg', course: e.target.value }));
// RECORDS : deux onglets (à deux / speedrun solo), un parcours à la fois ; chaque ligne du top 5 a son bouton « Revoir »
G.bSolo = 0; G.bCourse = null;
function renderRecords(list) {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const r = list?.[i];
    rows.push(r ? `<li class="r${i + 1}"><span>${i + 1}</span><b>${esc(r.names.join(' & '))}</b><em>${fmt(r.time)}</em><small>${tr('{0} chutes', r.falls)}</small>${r.rid ? `<button class="mini watch" data-replay="${r.rid}" title="${tr('Revoir la montée')}${r.v && r.v !== SIMV ? ' — ' + tr('enregistrée avec une ancienne version du jeu : peut diverger') : ''}">▶ ${tr('Revoir')}</button>` : ''}</li>` : `<li class="empty"><span>${i + 1}</span><b>—</b></li>`);
  }
  $('#b-list').innerHTML = rows.join('');
  const mine = (G.bSolo ? BEST_SOLO : BEST)[G.bCourse];
  $('#b-mine').textContent = mine ? tr('Ton meilleur temps sur cet appareil : {0}', fmt(mine.time)) : '';
}
function askBoard() {
  if (!G.bCourse) G.bCourse = G.course || DEFAULT_COURSE;
  for (const b of $$('#board .tabs button')) b.classList.toggle('on', +b.dataset.solo === G.bSolo);
  const list = courseList(true).filter((c) => c.published || G.pt);
  $('#b-courses').innerHTML = list.map((c) => `<button data-course="${c.id}" class="${c.id === G.bCourse ? 'on' : ''}" style="--wc:${WCOL[c.world] || '#888'}">${esc(tr(c.name))}</button>`).join('');
  $('#b-title').textContent = tr(getCourse(G.bCourse)?.name || '') + ' · ' + tr(G.bSolo ? 'Speedrun solo' : 'À deux');
  $('#b-list').innerHTML = `<li class="muted">${tr('Chargement…')}</li>`;
  getNet().send({ t: 'board', course: G.bCourse, solo: G.bSolo });
}
$('#board').addEventListener('click', (e) => {
  const t = e.target.closest('.tabs button'), c = e.target.closest('.chips button');
  if (t) { G.bSolo = +t.dataset.solo; askBoard(); } else if (c) { G.bCourse = c.dataset.course; askBoard(); }
});

/* ------------------------------ boutons ------------------------------ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; Snd.unlock(); Snd.play('ui');
  const id = b.id;
  if (id === 'm-local') showCourses('local');
  else if (id === 'm-solo') showCourses('solo');
  else if (b.dataset.replay) { if (G.mode === 'online' && G.room) window.open(location.pathname + '?replay=' + b.dataset.replay, '_blank'); else watchReplay(b.dataset.replay); } // en salon : le replay s'ouvre dans un autre onglet (la partie en cours n'est pas coupée)
  else if (b.dataset.course) { G.replay = null; G.course = b.dataset.course; safe(() => localStorage.setItem('ch-course', G.course)); if (G.pick === 'local' || G.pick === 'solo') { G.solo = G.pick === 'solo'; startLocal(); } }
  else if (id === 'e-send') { const n = $('#e-name').value.replace(/[<>]/g, '').trim().slice(0, 16); if (!n) return; CFG.name = n; saveCfg(); G.names[0] = n; $('#e-names').textContent = n; $('#e-sub').style.display = 'none'; submitRun(G.W); }
  else if (id === 'm-online') { show('online'); $('#o-name').value = CFG.name; getNet().send({ t: 'list' }); }
  else if (id === 'm-lang') setLang(LANG === 'en' ? 'fr' : 'en');
  else if (id === 'm-help' || id === 'p-help') $('#help').classList.add('show');
  else if (id === 'help-close') $('#help').classList.remove('show');
  else if (id === 'm-board') { G.bCourse = G.course || DEFAULT_COURSE; show('board'); askBoard(); }
  else if (id === 'back' || b.classList.contains('back')) show('home');
  else if (id === 'o-create') { if (!nameOk()) return; getNet().send({ t: 'create', L: G.L, course: G.course }); }
  else if (id === 'o-join') { if (!nameOk()) return; const c = $('#o-code').value.trim().toUpperCase(); if (c) getNet().send({ t: 'join', code: c }); }
  else if (b.dataset.code) { if (!nameOk()) return; getNet().send({ t: 'join', code: b.dataset.code }); }
  else if (id === 'o-refresh') getNet().send({ t: 'list' });
  else if (b.closest('#r-len')) net?.send({ t: 'cfg', L: +b.dataset.l });
  else if (b.closest('#l-len')) { G.L = +b.dataset.l; $$('#l-len button').forEach((x) => x.classList.toggle('on', x === b)); }
  else if (id === 'r-start') net?.send({ t: 'start' });
  else if (id === 'mic') micToggle();
  else if (id === 'r-leave') { net?.send({ t: 'leave' }); net?.setRoom(null); G.room = null; Voice.stop(); chatShow(false); show('online'); }
  else if (id === 'r-copy') { safe(() => navigator.clipboard.writeText($('#r-link').value)); toast('Lien copié : envoie-le à ton partenaire'); }
  else if (id === 'p-resume') togglePause(false);
  else if (id === 'm-settings' || id === 'p-settings') openSettings();
  else if (id === 'set-close') $('#settings').classList.remove('on');
  else if (id === 'p-cp') toCheckpoint();
  else if (id === 'e-next') toNext();
  else if (id === 'p-restart' || id === 'e-again') { $('#end').classList.remove('on'); restartFromStart(); }
  else if (id === 'p-debug') G.debug = !G.debug;
  else if (id === 'p-quit' || id === 'e-menu') { if (G.mode === 'online') { net?.send({ t: 'leave' }); net?.setRoom(null); G.room = null; Voice.stop(); chatShow(false); } stopGame(); $('#end').classList.remove('on'); show('home'); }
});
function nameOk() {
  const n = $('#o-name').value.replace(/[<>]/g, '').trim().slice(0, 16);
  if (!n) { toast('Choisis d\'abord un pseudo'); $('#o-name').focus(); return false; }
  if (n !== CFG.name) { CFG.name = n; saveCfg(); net?.send({ t: 'hello', name: n, token: safe(() => sessionStorage.getItem('ch-token'), '') }); }
  return true;
}
// ---- réglages audio : général, musique, effets (saut, pas, mécanismes), chaîne, voix du partenaire, micro, périphériques ----
const applyMix = () => { Snd.setVolume(CFG.vol); Music.setMaster(CFG.vol, CFG.vMusic); Snd.setMix(CFG.vSfx, CFG.vChain); Voice.setVolume(CFG.vVoice); Voice.setMicGain(CFG.vMic); };
for (const [id, key] of [['#p-vol', 'vol'], ['#s-music', 'vMusic'], ['#s-sfx', 'vSfx'], ['#s-chain', 'vChain'], ['#s-voice', 'vVoice'], ['#s-mic', 'vMic']]) {
  $(id).value = CFG[key]; $(id).addEventListener('input', (e) => { CFG[key] = +e.target.value; applyMix(); saveCfg(); });
}
applyMix(); Snd.setSink(CFG.devOut); Music.setSink(CFG.devOut); Voice.setOutput(CFG.devOut); Voice.setInput(CFG.devIn);
async function fillDevices() {
  const d = await Voice.devices(), fill = (sel, list, cur, first) => { $(sel).innerHTML = `<option value="">${esc(tr(first))}</option>` + list.map((x) => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(x.label)}</option>`).join(''); };
  fill('#s-in', d.inputs, CFG.devIn, 'Par défaut'); fill('#s-out', d.outputs, CFG.devOut, 'Par défaut');
  $('#s-out-row').style.display = Snd.canSink() ? '' : 'none';
}
$('#s-in').addEventListener('change', (e) => { CFG.devIn = e.target.value; Voice.setInput(CFG.devIn); saveCfg(); });
$('#s-out').addEventListener('change', (e) => { CFG.devOut = e.target.value; Snd.setSink(CFG.devOut); Music.setSink(CFG.devOut); Voice.setOutput(CFG.devOut); saveCfg(); });
safe(() => navigator.mediaDevices.addEventListener('devicechange', () => { if ($('#settings').classList.contains('on')) fillDevices(); }));
let LAYOUT = null; safe(() => navigator.keyboard?.getLayoutMap?.().then((l) => { LAYOUT = l; refreshKeys(); }));
const SPECIAL = { Space: 'Espace', ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droit', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droit', Enter: 'Entrée', Escape: 'Échap', Mouse0: 'Clic gauche', Mouse1: 'Clic molette', Mouse2: 'Clic droit', Mouse3: 'Souris 4', Mouse4: 'Souris 5', Tab: 'Tab', Backquote: '²' };
const keyLabel = (code) => !code ? tr('non assignée') : SPECIAL[code] ? tr(SPECIAL[code]) : /^Key[A-Z]$/.test(code) ? (LAYOUT?.get(code) || code.slice(3)).toUpperCase() : /^Digit\d$/.test(code) ? code.slice(5) : LAYOUT?.get(code)?.toUpperCase() || code.replace('Numpad', 'Pavé ').replace('Arrow', 'Flèche ');
const KEYROWS = [['up', 'Haut'], ['down', 'Bas'], ['left', 'Gauche'], ['right', 'Droite'], ['jump', 'Sauter'], ['brace', "S'arc-bouter"], ['pull', 'Tirer la chaîne'], ['slide', 'Glisser'], ['cup', 'Courte échelle'], ['punch', 'Coup de poing'], ['kick', 'Coup de pied'], ['drop', 'Lâcher la prise'], ['use', 'Interagir'], ['reset', 'Retour au point de passage'], ['camL', 'Caméra gauche'], ['camR', 'Caméra droite']];
function refreshKeys() {
  for (const el of $$('[data-bind]')) el.textContent = keyLabel(BIND[el.dataset.bind]?.[0]);
  const box = $('#s-keys'); if (!box) return;
  box.innerHTML = KEYROWS.map(([a, label]) => `<div class="krow"><span>${esc(tr(label))}</span><button data-act="${a}">${esc(keyLabel(BIND[a]?.[0]))}</button></div>`).join('');
}
// capture : on clique sur l'action, puis on appuie sur une touche ou un bouton de souris (Échap annule)
function endCapture(code) {
  const cap = G.capturing; G.capturing = null; if (!cap) return;
  if (code) { for (const a in BIND) if (a !== cap.act && BIND[a].includes(code)) (CFG.keys ||= {})[a] = []; (CFG.keys ||= {})[cap.act] = [code]; saveCfg(); rebuildBind(); }
  refreshKeys();
}
$('#s-keys').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b || G.capturing) return;
  G.capturing = { act: b.dataset.act, armed: false }; b.textContent = tr('Appuie sur une touche ou un bouton de souris…'); b.classList.add('wait'); setTimeout(() => { if (G.capturing) G.capturing.armed = true; }, 150);
});
$('#s-keys-reset').addEventListener('click', () => { CFG.keys = {}; saveCfg(); rebuildBind(); refreshKeys(); });
// astuces à l'écran : les touches citées suivent les réglages (V = tirer, F = interagir, R = retour, Maj = s'arc-bouter, Espace = sauter)
const hintKeys = (txt) => {
  const L = (a) => keyLabel(BIND[a]?.[0]), shift = (c) => (c === 'ShiftLeft' || c === 'ShiftRight' ? (LANG === 'en' ? 'Shift' : 'Maj') : null);
  return txt.replace(/\bV\b/g, L('pull')).replace(/\bF\b/g, L('use')).replace(/\bG\b/g, L('cup')).replace(/\bR\b/g, L('reset')).replace(/\b(Maj|Shift)\b/g, shift(BIND.brace[0]) || L('brace')).replace(/\b(Espace|Space)\b/g, L('jump'));
};
refreshKeys();
$('#s-camlock').value = String(CFG.camLock); $('#s-camlock').addEventListener('change', (e) => { CFG.camLock = +e.target.value; if (!CFG.camLock) document.exitPointerLock?.(); saveCfg(); });
$('#s-camauto').checked = !!CFG.camAuto; Scene.S.camAuto = !!CFG.camAuto; $('#s-camauto').addEventListener('change', (e) => { CFG.camAuto = e.target.checked ? 1 : 0; Scene.S.camAuto = !!CFG.camAuto; saveCfg(); });
const openSettings = () => { fillDevices(); refreshKeys(); $('#settings').classList.add('on'); };
$('#p-sens').value = CFG.sens; $('#p-sens').addEventListener('input', (e) => { CFG.sens = +e.target.value; saveCfg(); });

/* ------------------------------ mode playtest privé (?pt=CLÉ) ------------------------------ */
// Le serveur ne remet le module qu'avec la bonne clé ; il reçoit l'API ci-dessous (aucun import : il est chargé depuis un Blob).
if (qs.get('pt')) {
  G.pt = { key: qs.get('pt') };
  getNet().on('pt', async (msg) => {
    if (!msg.ok) { G.pt = null; toast('Mode test refusé' + (msg.m ? ' (' + msg.m + ')' : '')); return; }
    const url = URL.createObjectURL(new Blob([msg.code], { type: 'text/javascript' }));
    const mod = await import(url);
    mod.default({ G, Sim: await import('../core/sim.js'), Worlds: { WORLDS, courseList, getCourse }, Scene, Music, toast, show, showCourses, startLocal, keys, fmt, Mechs: await import('./mechs.js'), Sfx });
    toast('Mode test actif : F9 pour le panneau');
  });
}

show('home');
{ const lb = $('#m-lang'); if (lb) lb.textContent = LANG === 'en' ? 'Français' : 'English'; }
backdrop();
{ const rp = new URLSearchParams(location.search).get('replay'); if (rp && /^[0-9a-f]{16}$/.test(rp)) setTimeout(() => watchReplay(rp), 300); } // lien de replay (?replay=<id>) : lecture directe
// lien d'invitation : ?r=CODE ouvre directement le salon
// (avec un pseudo déjà choisi, on rejoint dès que la connexion est ouverte ; sinon on attend le bouton « Rejoindre »)
if (qs.get('r')) { const c = qs.get('r').toUpperCase().slice(0, 6); show('online'); $('#o-code').value = c; $('#o-name').value = CFG.name; const n = getNet(); if (CFG.name) n.setRoom(c); }
// rechargement de la page pendant une partie en ligne : le salon est retenu dans l'onglet, on s'y reconnecte tout seul (même jeton = même place, 60 s de grâce)
else if (safe(() => sessionStorage.getItem('ch-room'), null)) getNet();
if (qs.has('local')) startLocal();
