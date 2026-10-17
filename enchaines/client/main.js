// LES ENCHAÎNÉS — client : écrans, commandes, boucle à pas fixe (120 Hz), mode local à deux sur un clavier,
// mode en ligne (serveur qui fait autorité ; ici prédiction de tout le monde avec ses propres entrées, rejouées à chaque instantané).
import { createWorld, stepWorld, snapWorld, applySnap, spawnAt, DT, ST, P, CH, IDLE } from '../core/sim.js';
import { WORLDS, courseList, getCourse, nextCourse, DEFAULT_COURSE } from '../core/worlds.js';
import * as Scene from './scene.js';
import * as Music from './music.js';
import * as Snd from './audio.js';
import * as Sfx from './sfx.js';
import { createNet } from './net.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const qs = new URLSearchParams(location.search);
const safe = (f, d) => { try { return f(); } catch { return d; } };
const G = { course: safe(() => localStorage.getItem('ch-course'), null) || DEFAULT_COURSE, pt: null, mode: null, W: null, me: null, acc: 0, paused: false, debug: qs.has('debug'), ct: 0, pend: [], partnerIn: IDLE, names: ['Grimpeur 1', 'Grimpeur 2'], L: CH.L, hintT: 0, last: performance.now(), stepT: [0, 0], done: false, room: null };
window.__ch = G; // tests
const LV = () => G.W?.level || getCourse(G.course);
G.play = (id) => { G.course = id; return startLocal(); }; // tests / mode test
G.tp = (i) => { if (G.mode !== 'local') return; G.W.cp = i; G.W.cpMax = Math.max(G.W.cpMax, i); spawnAt(G.W, i); Scene.onEvent(G.W, { k: 'respawn' }); };

/* ------------------------------ réglages persistants ------------------------------ */
const CFG = Object.assign({ name: '', vol: 0.8, sens: 1, invert: false }, safe(() => JSON.parse(localStorage.getItem('ch-cfg')), {}));
const saveCfg = () => safe(() => localStorage.setItem('ch-cfg', JSON.stringify(CFG)));

/* ------------------------------ entrées ------------------------------ */
const keys = new Set(), pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code); Snd.unlock(); Music.unlock(); Sfx.load();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' && G.mode) togglePause();
  if (e.code === 'F3' || (e.code === 'KeyB' && e.ctrlKey)) { e.preventDefault(); G.debug = !G.debug; }
  if (e.code === 'KeyH' && G.mode) $('#help').classList.toggle('show');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const SCHEMES = {
  k1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], jump: ['Space'], brace: ['ShiftLeft'], pull: ['KeyV'], drop: ['KeyC'], use: ['KeyF'], reset: ['KeyR'] },
  k2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['Numpad0', 'ControlRight', 'Enter'], brace: ['ShiftRight', 'Numpad1'], pull: ['Numpad4', 'Slash'], drop: ['Numpad2', 'End'], use: ['Numpad5', 'Period'], reset: ['Numpad3', 'Backspace'] },
};
const anyKey = (l) => l.some((k) => keys.has(k)), anyPress = (l) => l.some((k) => pressed.has(k));
const slot = [{ jc: 0, dc: 0, uc: 0 }, { jc: 0, dc: 0, uc: 0 }];
function readInput(k, schemes, pads) {
  let ax = 0, ay = 0, jump = false, brace = false, pull = false, reset = false, jp = false, dp = false, up = false;
  for (const s of schemes) {
    const S = SCHEMES[s];
    ax += (anyKey(S.right) ? 1 : 0) - (anyKey(S.left) ? 1 : 0); ay += (anyKey(S.up) ? 1 : 0) - (anyKey(S.down) ? 1 : 0);
    jump ||= anyKey(S.jump); brace ||= anyKey(S.brace); pull ||= anyKey(S.pull); reset ||= anyKey(S.reset); jp ||= anyPress(S.jump); dp ||= anyPress(S.drop); up ||= anyPress(S.use);
  }
  for (const i of pads) {
    const gp = safe(() => navigator.getGamepads()[i], null); if (!gp) continue;
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, dz = Math.hypot(lx, ly) > 0.2;
    if (dz) { ax += lx; ay -= ly; }
    const b = (n) => !!gp.buttons[n]?.pressed;
    const st = (G.padPrev ||= {})[i] ||= {};
    if (b(0) && !st.a) jp = true; if (b(1) && !st.b) dp = true; if (b(2) && !st.x) up = true; st.a = b(0); st.b = b(1); st.x = b(2);
    jump ||= b(0); brace ||= b(5) || b(7) || b(4); pull ||= b(6); reset ||= b(3); // gâchette gauche = tirer
    const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0; if (Math.abs(rx) > 0.2 || Math.abs(ry) > 0.2) Scene.camInput(-rx * 0.04 * CFG.sens, ry * 0.025, 0);
  }
  if (jp) slot[k].jc++; if (dp) slot[k].dc++; if (up) slot[k].uc++;
  const l = Math.hypot(ax, ay); if (l > 1) { ax /= l; ay /= l; }
  // déplacement relatif à la caméra
  const yaw = Scene.camYaw(), c = Math.cos(yaw), s = Math.sin(yaw);
  return { mx: ax * c - ay * s, mz: -ax * s - ay * c, jump, brace, pull, reset, jc: slot[k].jc, dc: slot[k].dc, uc: slot[k].uc };
}
// souris : glisser = tourner la caméra, molette = recul
let drag = null;
addEventListener('pointerdown', (e) => { Music.unlock(); Snd.unlock(); Sfx.load(); if (e.target.id === 'gl') drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', (e) => { if (!drag) return; Scene.camInput(-(e.clientX - drag.x) * 0.006 * CFG.sens, (e.clientY - drag.y) * 0.004 * (CFG.invert ? -1 : 1), 0); drag = { x: e.clientX, y: e.clientY }; });
addEventListener('pointerup', () => { drag = null; });
addEventListener('contextmenu', (e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }); // pas de menu du clic droit dans le jeu
addEventListener('wheel', (e) => { if (G.mode) Scene.camInput(0, 0, Math.sign(e.deltaY) * 1.2); }, { passive: true });
function camKeys(dt) { const r = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0); if (r) Scene.camInput(-r * 1.8 * dt * CFG.sens, 0, 0); }

/* ------------------------------ écrans ------------------------------ */
function show(id) { for (const s of $$('.screen')) s.classList.toggle('on', s.id === id); document.body.dataset.screen = id || 'game'; }
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), ms); }
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
// fond du menu : la vraie montagne, caméra qui longe lentement la paroi (les grimpeurs attendent au pied)
async function backdrop() {
  await ensureScene(true);
  if (G.mode) return;
  const W = createWorld({ course: 'tour' }); await Scene.buildLevel(W); if (G.mode) return; G.demo = W; Scene.setRoster(); document.body.classList.add('live'); Music.playWorld('medieval');
}
function demoFrame(dt) {
  const t = (G.demoT = (G.demoT || 0) + dt), u = (Math.sin(t * 0.045 - 1.4) + 1) / 2, y = 4 + u * 82;
  Scene.S.debugCam = { pos: [Math.sin(t * 0.07) * 14 + 4, y + 6, 30 + Math.cos(t * 0.05) * 4], look: [Math.sin(t * 0.07) * 6 - 2, y + 2, -6] };
  Scene.frame(G.demo, dt, {});
  $('#m-alt').textContent = Math.round(y * 14.3).toLocaleString('fr-FR'); // la caméra grimpe : l'altitude défile
}
async function startLocal() {
  await ensureScene();
  show('loading');
  G.mode = 'local'; G.me = null; G.demo = null; G.W = createWorld({ L: G.L, course: G.course }); G.names = ['Grimpeur 1', 'Grimpeur 2'];
  await Scene.buildLevel(G.W); Scene.setRoster(); G.acc = 0; G.done = false; Music.playWorld(G.W.level.world);
  G.pt?.onStart?.();
  show(null); $('#hud').classList.add('on'); $('#help').classList.add('show'); setTimeout(() => $('#help').classList.remove('show'), 9000);
  $('#hud').dataset.mode = 'local';
}
function stopGame() { if (G.mode) setTimeout(backdrop, 0); G.mode = null; G.W = null; $('#hud').classList.remove('on'); G.paused = false; $('#pause').classList.remove('on'); }
function togglePause(v) {
  G.paused = v ?? !G.paused; $('#pause').classList.toggle('on', G.paused);
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
  if (G.mode === 'local') { const W = createWorld({ L: G.L, course: G.course }); G.W = W; Scene.buildLevel(W).then(() => Scene.setRoster()); G.done = false; $('#end').classList.remove('on'); }
  else net?.send({ t: 'restart' });
  togglePause(false);
}
function toCheckpoint() {
  if (G.mode === 'local') { G.W.resets++; spawnAt(G.W, G.W.cp); Scene.onEvent(G.W, { k: 'respawn' }); Snd.play('respawn'); }
  else net?.send({ t: 'cp' });
  togglePause(false);
}

/* ------------------------------ événements -> sons et effets ------------------------------ */
const GLOBAL = new Set(['checkpoint', 'respawn', 'finish', 'collapse', 'restore', 'save', 'abyss', 'reset']);
function handleEvents(W, list, fromServer) {
  for (const e of list) {
    if (G.mode === 'online' && GLOBAL.has(e.k) !== !!fromServer) continue; // en ligne : le serveur annonce les événements communs, la prédiction les gestes
    Scene.onEvent(W, e);
    const p = e.p != null ? W.pl[e.p] : null, pan = p ? panOf(p) : 0;
    switch (e.k) {
      case 'jump': Snd.play('jump', { pan }); break;
      case 'land': if (e.v > 3) Snd.play('land', { pan, v: e.v }); break;
      case 'grab': Snd.play('grab', { pan }); break;
      case 'mantle': Snd.play('mantle', { pan }); break;
      case 'jerk': { const n = W.ch[6], v = Math.min(1, 0.35 + e.v / 9); if (Sfx.chain('jerk', n.x, n.y, n.z, { v, rate: 0.92 + Math.random() * 0.16 })) Sfx.chain('clink', n.x, n.y, n.z, { v: v * 0.6, key: 'j' }); else Snd.play('jerk', { v: e.v }); break; }
      case 'slack': { const n = W.ch[6]; Sfx.chain('drop', n.x, n.y, n.z, { v: 0.35, gap: 0.5 }); break; } // la chaîne retombe, détendue
      case 'hit': Snd.play('hit', { pan }); break;
      case 'crack': Snd.play('crack'); break;
      case 'collapse': Snd.play('collapse'); break;
      case 'checkpoint': Snd.play('checkpoint'); { const t = Scene.S.cps?.[e.cp]?.g.position; if (t) Sfx.one('totem_ignite', t.x, t.y + 2, t.z, { v: 0.9 }); } // le totem s'embrase toast('Point de passage : ' + (LV().checkpoints[e.cp].name || 'zone ' + e.cp)); flashZone(e.cp); break;
      case 'save': Snd.play('save'); toast('Sauvetage !', 1500); break;
      case 'respawn': Snd.play('respawn'); break;
      case 'abyss': toast('Chute dans le vide… retour au point de passage', 2200); break;
      case 'finish': Snd.play('finish'); break;
    }
  }
}
function panOf(p) { const s = Scene.project(p.x, p.y + 1, p.z); return Math.max(-0.8, Math.min(0.8, (s.x / innerWidth) * 2 - 1)); }
// pas et cliquetis de la chaîne (déduits de l'état à l'écran)
function footsteps(W, dt) {
  for (let k = 0; k < 2; k++) {
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
  G.raf = now;
  const dt = Math.min(0.1, (now - G.last) / 1000) * (G.pt?.speed || 1); G.last = now;
  if (!G.mode && G.demo && Scene.S.ready) demoFrame(dt);
  if (G.mode && G.W && !Scene.S.building) {
    camKeys(dt);
    if (!G.paused || G.mode === 'online') {
      G.acc += dt; let n = 0;
      while (G.acc >= DT && n++ < 24) { if (G.mode === 'local') stepLocal(); else stepOnline(); G.acc -= DT; }
      if (G.acc > DT * 4) G.acc = 0;
    } else pressed.clear();
    footsteps(G.W, dt);
    Scene.frame(G.W, dt, { me: G.me });
    Scene.debugDraw(G.W, G.debug);
    hud(G.W, dt);
    if (G.W.done && !G.done) { G.done = true; setTimeout(() => showEnd(G.W), 4500); }
  }
}
function rafLoop(now) { loop(now); requestAnimationFrame(rafLoop); }
requestAnimationFrame(rafLoop);
// repli si requestAnimationFrame est gelé (onglet en arrière-plan / aperçu) : la partie en ligne continue d'envoyer ses entrées
setInterval(() => { const n = performance.now(); if (n - (G.raf || 0) > 120) loop(n); }, 16);

/* ------------------------------ interface en jeu ------------------------------ */
function hud(W, dt) {
  const [a, b] = W.pl;
  const top = Math.max(a.y, b.y), C = LV().checkpoints, cur = C[W.cp] || C[0], nx = C[W.cp + 1], low = Math.min(a.y, b.y) + 0.5;
  const z = nx && nx.y > cur.y + 3 && low >= nx.y - 0.5 ? nx.zone : cur.zone; // zone du dernier point de passage (ou la suivante, déjà atteinte en hauteur)
  $('#h-zone').textContent = `${z}. ${LV().zones[z]}`;
  $('#h-alt').textContent = `sommet à ${Math.round(LV().top)} m`; $('#h-altbig').textContent = Math.max(0, Math.round(top));
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
  for (const h of LV().hints) for (const p of W.pl) if (Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z) < 4.5) hint = h.txt;
  const resetting = Math.max(...W.resetHold);
  if (resetting > 0.05) hint = `Retour au point de passage… ${Math.ceil((1 - resetting) * 10) / 10}`;
  else if (Math.max(a.y, b.y) < LV().checkpoints[W.cp].y - 10 && a.st === ST.GROUND && b.st === ST.GROUND) hint = 'Tombés bien bas ? Maintenez R pour revenir au point de passage';
  $('#h-hint').textContent = hint; $('#h-hint').classList.toggle('on', !!hint);
  // débogage : états, tension, longueur
  if (G.debug) $('#dbg').textContent = W.pl.map((p, k) => `J${k + 1} ${['sol', 'air', 'rebord', 'paroi', 'hisse'][p.st]} y=${p.y.toFixed(2)} v=${Math.hypot(p.vx, p.vz).toFixed(1)}/${p.vy.toFixed(1)} end=${p.sta.toFixed(2)} ${p.brace ? 'ARC' : ''} ${p.dangling ? 'PEND' : ''}`).join('\n') + `\nchaîne ${W.Lc.toFixed(2)}/${W.L} tension ${W.ten.toFixed(2)}  tick ${W.tick}  ${G.mode === 'online' ? 'rtt ' + Math.round(net.rtt) + ' ms, en attente ' + G.pend.length : ''}`;
  $('#dbg').style.display = G.debug ? 'block' : 'none';
}
function flashZone(cp) { const el = $('#zonecard'); const c = LV().checkpoints[cp]; el.innerHTML = `<small>Zone ${c.zone}</small><b>${c.name}</b>`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
/* ------------------------------ records et médailles (par parcours, sur cet appareil) ------------------------------ */
const BEST = safe(() => JSON.parse(localStorage.getItem('ch-best')), null) || {};
function medalOf(c, time) { const m = c.medals || {}; return time <= m.gold ? 'gold' : time <= m.silver ? 'silver' : time <= m.bronze ? 'bronze' : null; }
const MEDAL = { gold: 'Or', silver: 'Argent', bronze: 'Bronze' };
function record(W) {
  const c = W.level, prev = BEST[c.id], medal = medalOf(c, W.time), clean = W.falls === 0;
  const rec = !prev || W.time < prev.time;
  if (rec) BEST[c.id] = { time: W.time, falls: W.falls, medal: medal || prev?.medal || null, clean: clean || !!prev?.clean };
  else { if (medal && (!prev.medal || ['gold', 'silver', 'bronze'].indexOf(medal) < ['gold', 'silver', 'bronze'].indexOf(prev.medal))) prev.medal = medal; if (clean) prev.clean = true; }
  safe(() => localStorage.setItem('ch-best', JSON.stringify(BEST)));
  return { medal, clean, rec };
}
function showEnd(W) {
  const r = record(W);
  $('#e-medal').innerHTML = (r.medal ? `<i class="${r.medal}">Médaille ${MEDAL[r.medal]}</i>` : '') + (r.clean ? '<i class="clean">Sans chute</i>' : '') + (r.rec ? '<i class="rec">Record personnel</i>' : '');
  $('#e-time').textContent = fmt(W.time); $('#e-falls').textContent = W.falls; $('#e-saves').textContent = W.saves; $('#e-resets').textContent = W.resets;
  $('#e-names').textContent = G.names.join(' & ');
  $('#end').classList.add('on');
  const lead = G.mode === 'local' || (G.room && G.room.host === G.room.you), nx = nextCourse(G.course, !!G.pt);
  $('#e-again').style.display = lead ? '' : 'none';
  $('#e-next').style.display = lead && nx ? '' : 'none'; if (nx) $('#e-next').textContent = 'Franchir le portail › ' + nx.name;
  if (G.mode === 'local') renderBoard(null);
}
function renderBoard(list, mine) {
  const el = $('#e-board');
  if (!list) { el.innerHTML = '<li class="muted">Le classement est réservé aux parties en ligne.</li>'; return; }
  el.innerHTML = list.length ? list.map((r, i) => `<li class="${mine === i ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.names.join(' & '))}</b><em>${fmt(r.time)}</em><small>${r.falls} chutes</small></li>`).join('') : '<li class="muted">Personne n\'a encore atteint le sommet.</li>';
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------ en ligne ------------------------------ */
let net = null;
const encIn = (ct, I) => [ct, Math.round(I.mx * 100) / 100, Math.round(I.mz * 100) / 100, (I.jump ? 1 : 0) | (I.brace ? 2 : 0) | (I.reset ? 4 : 0) | (I.pull ? 8 : 0), I.jc, I.dc, I.uc || 0];
const decIn = (a) => (a ? { mx: a[1], mz: a[2], jump: !!(a[3] & 1), brace: !!(a[3] & 2), reset: !!(a[3] & 4), pull: !!(a[3] & 8), jc: a[4], dc: a[5], uc: a[6] || 0 } : IDLE);
function getNet() {
  if (net) return net;
  net = createNet(() => CFG.name || 'Grimpeur');
  net.onState = (up) => { $('#netstate').textContent = up ? '' : 'Connexion au serveur…'; };
  net.on('room', (m) => { G.room = m; net.setRoom(m.code); renderRoom(m); if (m.phase === 'lobby' && !G.mode) show('room'); });
  net.on('rooms', (m) => renderRooms(m.list));
  net.on('hi', () => { if (G.pt?.key) net.send({ t: 'pt', key: G.pt.key }); if (document.body.dataset.screen === 'board') net.send({ t: 'board', course: $('#b-course').value }); if (document.body.dataset.screen === 'online') net.send({ t: 'list' }); });
  net.on('err', (m) => toast(m.m));
  net.on('left', () => { net.setRoom(null); G.room = null; stopGame(); show('online'); });
  net.on('start', async (m) => {
    await ensureScene();
    G.mode = 'online'; G.demo = null; G.me = m.seat; G.names = m.names; G.L = m.L;
    G.course = m.course || DEFAULT_COURSE; setTimeout(() => $('#fade').classList.remove('on'), 400);
    G.W = applySnap(createWorld({ L: m.L, course: G.course }), m.s); G.ct = 0; G.pend = []; G.out = []; G.partnerIn = IDLE; G.done = false; slot[0].jc = slot[0].dc = slot[0].uc = 0;
    await Scene.buildLevel(G.W); Scene.setRoster(); Music.playWorld(G.W.level.world);
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
    if (m.e?.length) handleEvents(W, m.e, true);
  });
  net.on('end', (m) => { renderBoard(m.board, m.rank); });
  net.on('board', (m) => { $('#b-list').innerHTML = m.list.length ? m.list.map((r, i) => `<li><span>${i + 1}</span><b>${esc(r.names.join(' & '))}</b><em>${fmt(r.time)}</em><small>${r.falls} chutes</small></li>`).join('') : '<li class="muted">Personne n\'a encore atteint le sommet.</li>'; });
  return net;
}
function renderRoom(m) {
  $('#r-code').textContent = m.code;
  $('#r-link').value = location.origin + location.pathname + '?r=' + m.code;
  const host = m.host === m.you;
  $('#r-players').innerHTML = [0, 1].map((i) => { const p = m.players[i]; return `<li class="${p ? '' : 'empty'}"><i style="background:${['#ff9a3c', '#46b8ff'][i]}"></i>${p ? esc(p.name) + (p.id === m.host ? ' <small>hôte</small>' : '') + (p.id === m.you ? ' <small>toi</small>' : '') + (p.offline ? ' <small>déconnecté</small>' : '') : 'En attente d\'un partenaire…'}</li>`; }).join('');
  $$('#r-len button').forEach((b) => { b.classList.toggle('on', +b.dataset.l === m.cfg.L); b.disabled = !host; });
  fillCourseSelects(); $('#r-course').value = m.cfg.course; $('#r-course').disabled = !host;
  $('#r-start').disabled = !host || m.players.length < 2;
  $('#r-start').textContent = host ? (m.players.length < 2 ? 'En attente du 2e grimpeur' : 'Lancer l\'ascension') : 'L\'hôte lance la partie';
}
function renderRooms(list) {
  $('#o-list').innerHTML = list.length ? list.map((r) => `<li><b>${esc(r.host)}</b><span>${r.n}/2</span><button data-code="${r.code}">Rejoindre</button></li>`).join('') : '<li class="muted">Aucun salon ouvert pour l\'instant.</li>';
}

/* ------------------------------ choix du parcours ------------------------------ */
const WCOL = { medieval: '#b0743c', jungle: '#3f8f4a', japan: '#c4486a', deep: '#3a4a7a', sky: '#3d8fe0', mech: '#8a6a3a', ice: '#5aa0d0', summit: '#6a5ab0' };
const visible = () => courseList(!!G.pt); // en playtest : tous les parcours, sinon seulement ceux publiés
function showCourses(mode) {
  G.pick = mode; $('#c-mode').textContent = mode === 'local' ? '· à deux sur ce clavier' : '· pour ton salon';
  const list = visible();
  // la tour des mondes : un étage par monde, le sommet en haut (column-reverse), une plaque par parcours
  $('#c-list').innerHTML = WORLDS.map((w, i) => {
    const cs = list.filter((c) => c.world === w.id);
    if (!cs.length) return `<div class="floor none" style="--wc:${WCOL[w.id]}"><span class="lvl">${i + 1}</span><span class="w"><small>Étage ${i + 1} · ${esc(w.name)}</small><b>Bientôt…</b><i>${esc(w.blurb)}</i></span></div>`;
    return cs.map((c) => { const b = BEST[c.id], d = c.diff || 1;
      return `<button class="floor${c.id === G.course ? ' sel' : ''}" data-course="${c.id}" style="--wc:${WCOL[w.id]}"><span class="lvl">${i + 1}</span>
        <span class="w"><small>Étage ${i + 1} · ${esc(w.name)}</small><b>${esc(c.name)}${c.published ? '' : '<span class="tag-pt">test</span>'}</b><i>${esc(c.short || w.blurb)}</i></span>
        <span class="side"><span class="notch">${[1, 2, 3, 4, 5].map((k) => `<u class="${k <= d ? 'on' : ''}"></u>`).join('')}</span>
        <span class="rec">${b ? (b.medal ? `<span class="coin ${b.medal}">${MEDAL[b.medal][0]}</span> ` : '') + fmt(b.time) : 'pas encore gravi'}</span></span></button>`; }).join('');
  }).join('');
  show('courses'); ($('.floor.sel') || $('.floor:not(.none)'))?.scrollIntoView({ block: 'center' });
}
function fillCourseSelects() {
  const opts = visible().map((c) => `<option value="${c.id}">${esc(c.name)}${c.published ? '' : ' (test)'}</option>`).join('');
  $('#r-course').innerHTML = opts; $('#b-course').innerHTML = courseList(true).filter((c) => c.published || G.pt).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}
$('#r-course').addEventListener('change', (e) => net?.send({ t: 'cfg', course: e.target.value }));
$('#b-course').addEventListener('change', (e) => { $('#b-list').innerHTML = '<li class="muted">Chargement…</li>'; getNet().send({ t: 'board', course: e.target.value }); });

/* ------------------------------ boutons ------------------------------ */
document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; Snd.unlock(); Snd.play('ui');
  const id = b.id;
  if (id === 'm-local') showCourses('local');
  else if (b.dataset.course) { G.course = b.dataset.course; safe(() => localStorage.setItem('ch-course', G.course)); if (G.pick === 'local') startLocal(); }
  else if (id === 'm-online') { show('online'); $('#o-name').value = CFG.name; getNet().send({ t: 'list' }); }
  else if (id === 'm-help' || id === 'p-help') $('#help').classList.add('show');
  else if (id === 'help-close') $('#help').classList.remove('show');
  else if (id === 'm-board') { fillCourseSelects(); show('board'); $('#b-course').value = G.course; $('#b-list').innerHTML = '<li class="muted">Chargement…</li>'; getNet().send({ t: 'board', course: $('#b-course').value }); }
  else if (id === 'back' || b.classList.contains('back')) show('home');
  else if (id === 'o-create') { if (!nameOk()) return; getNet().send({ t: 'create', L: G.L, course: G.course }); }
  else if (id === 'o-join') { if (!nameOk()) return; const c = $('#o-code').value.trim().toUpperCase(); if (c) getNet().send({ t: 'join', code: c }); }
  else if (b.dataset.code) { if (!nameOk()) return; getNet().send({ t: 'join', code: b.dataset.code }); }
  else if (id === 'o-refresh') getNet().send({ t: 'list' });
  else if (b.closest('#r-len')) net?.send({ t: 'cfg', L: +b.dataset.l });
  else if (b.closest('#l-len')) { G.L = +b.dataset.l; $$('#l-len button').forEach((x) => x.classList.toggle('on', x === b)); }
  else if (id === 'r-start') net?.send({ t: 'start' });
  else if (id === 'r-leave') { net?.send({ t: 'leave' }); net?.setRoom(null); G.room = null; show('online'); }
  else if (id === 'r-copy') { safe(() => navigator.clipboard.writeText($('#r-link').value)); toast('Lien copié : envoie-le à ton partenaire'); }
  else if (id === 'p-resume') togglePause(false);
  else if (id === 'p-cp') toCheckpoint();
  else if (id === 'e-next') toNext();
  else if (id === 'p-restart' || id === 'e-again') { $('#end').classList.remove('on'); restartFromStart(); }
  else if (id === 'p-debug') G.debug = !G.debug;
  else if (id === 'p-quit' || id === 'e-menu') { if (G.mode === 'online') { net?.send({ t: 'leave' }); net?.setRoom(null); } stopGame(); $('#end').classList.remove('on'); show('home'); }
});
function nameOk() {
  const n = $('#o-name').value.replace(/[<>]/g, '').trim().slice(0, 16);
  if (!n) { toast('Choisis d\'abord un pseudo'); $('#o-name').focus(); return false; }
  if (n !== CFG.name) { CFG.name = n; saveCfg(); net?.send({ t: 'hello', name: n, token: safe(() => sessionStorage.getItem('ch-token'), '') }); }
  return true;
}
$('#p-vol').value = CFG.vol; Snd.setVolume(CFG.vol); Music.setMaster(CFG.vol);
$('#p-vol').addEventListener('input', (e) => { CFG.vol = +e.target.value; Snd.setVolume(CFG.vol); Music.setMaster(CFG.vol); saveCfg(); });
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
backdrop();
// lien d'invitation : ?r=CODE ouvre directement le salon
// (avec un pseudo déjà choisi, on rejoint dès que la connexion est ouverte ; sinon on attend le bouton « Rejoindre »)
if (qs.get('r')) { const c = qs.get('r').toUpperCase().slice(0, 6); show('online'); $('#o-code').value = c; $('#o-name').value = CFG.name; const n = getNet(); if (CFG.name) n.setRoom(c); }
if (qs.has('local')) startLocal();
