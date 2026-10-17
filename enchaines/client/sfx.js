// LES ENCHAÎNÉS — sons ENREGISTRÉS des mécanismes (assets/sfx, crédits dans ASSET_CREDITS.md), joués DANS L'ESPACE :
// chaque son part de la position du mécanisme (PannerNode, atténuation avec la distance), l'auditeur suit la caméra.
// Deux usages : one(nom, position) = son ponctuel ; voice() = boucle attachée à un mécanisme, qu'on monte / coupe en fondu
// (jamais une boucle relancée à chaque image). Un son ne peut jamais casser le jeu : tout est sous try/catch.
import { Vector3 } from 'three';
import { ctx, bus } from './audio.js';

export const NAMES = ['totem_ignite', 'gate_lower', 'gate_raise', 'gate_move_b', 'gate_slam', 'gate_thud', 'gate_latch', 'gate_rattle', 'chain_loop', 'winch_a', 'winch_b', 'winch_c'];
const BUF = {}, LAST = {};
let ACTIVE = 0; export const active = () => ACTIVE; // boucles en cours (contrôle : aucune ne doit rester bloquée)
let loading = null;
const safe = (f) => { try { return f(); } catch { return null; } };
// chargement (une fois, après le premier geste : le contexte audio doit exister)
export function load() {
  const C = ctx(); if (!C || loading) return loading;
  const base = new URL('../assets/sfx/', import.meta.url);
  add('chain', CHAIN_NAMES); add('voice', ['jump_1', 'jump_2', 'jump_3']);
  loading = Promise.all(NAMES.map(async (n) => { try { const r = await fetch(new URL(n + '.mp3', base)); BUF[n] = await C.decodeAudioData(await r.arrayBuffer()); } catch { /* son absent : ignoré */ } }));
  return loading;
}
export const ready = () => Object.keys(BUF).length;
// chaîne entre les grimpeurs : vrais enregistrements CC0 (assets/sfx/chain), plusieurs variantes par geste, tirées au hasard
export const CHAIN = { jerk: 7, pull: 8, clink: 14, rattle: 8, drop: 2 };
const CHAIN_NAMES = Object.entries(CHAIN).flatMap(([k, n]) => Array.from({ length: n }, (_, i) => k + '_' + (i + 1)));
export const chainReady = () => !!BUF['chain/clink_1'];
// saut : une des trois voix enregistrées par le propriétaire, au hasard, jamais la même deux fois de suite
let lastJump = 0;
export function jump(x, y, z, o = {}) { if (!BUF['voice/jump_1']) return false; let k; do k = 1 + Math.floor(Math.random() * 3); while (k === lastJump); lastJump = k; one('voice/jump_' + k, x, y, z, { gap: 0.08, v: 0.9, ...o, key: 'j' + (o.key ?? '') }); return true; }
export function chain(kind, x, y, z, o = {}) { if (!chainReady()) return false; one('chain/' + kind + '_' + (1 + Math.floor(Math.random() * CHAIN[kind])), x, y, z, { gap: 0.06, ...o, key: 'ch' + kind + (o.key || '') }); return true; }
// sons propres à un monde : assets/sfx/<dir>/<nom>.mp3, joués sous la clé '<dir>/<nom>'
const ADDED = {}, PEND = new Set();
// résolu quand tous les sons demandés (communs + du monde) sont décodés : écran de chargement
export const idle = () => Promise.all([loading, ...PEND]);
export function add(dir, names) {
  const C = ctx(); if (!C) return null; const base = new URL('../assets/sfx/' + dir + '/', import.meta.url);
  const p = Promise.all(names.filter((n) => !ADDED[dir + '/' + n]).map(async (n) => { ADDED[dir + '/' + n] = 1; try { const r = await fetch(new URL(n + '.mp3', base)); BUF[dir + '/' + n] = await C.decodeAudioData(await r.arrayBuffer()); } catch { ADDED[dir + '/' + n] = 0; } }));
  PEND.add(p); p.finally(() => PEND.delete(p)); return p;
}
// auditeur = caméra (position + orientation)
export function listen(cam) {
  safe(() => {
    const C = ctx(); if (!C) return; const L = C.listener, p = cam.position, t = C.currentTime;
    const f = cam.getWorldDirection(TMP), u = cam.up;
    if (L.positionX) { L.positionX.setTargetAtTime(p.x, t, 0.03); L.positionY.setTargetAtTime(p.y, t, 0.03); L.positionZ.setTargetAtTime(p.z, t, 0.03);
      L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = u.x; L.upY.value = u.y; L.upZ.value = u.z; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z); }
  });
}
const TMP = new Vector3();
function panner(C, x, y, z, ref = 6) {
  const p = C.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = 120; p.rolloffFactor = 1.1;
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  p.connect(bus()); return p;
}
// son ponctuel ; gap = intervalle minimal entre deux déclenchements de la même clé (corrections réseau, rebonds)
export function one(name, x, y, z, o = {}) {
  return safe(() => {
    const C = ctx(), b = BUF[name]; if (!C || !b) return;
    const key = (o.key || '') + name, now = C.currentTime; if (LAST[key] && now - LAST[key] < (o.gap ?? 0.2)) return; LAST[key] = now;
    const s = C.createBufferSource(); s.buffer = b; s.playbackRate.value = (o.rate || 1) * (0.96 + Math.random() * 0.08);
    const g = C.createGain(); g.gain.value = o.v ?? 1;
    s.connect(g).connect(panner(C, x, y, z, o.ref)); s.start(now, o.off || 0, o.dur);
  });
}
// boucle attachée à un mécanisme : v.set(volume, débit) chaque image ; volume 0 = fondu puis arrêt
export function voice(name, o = {}) {
  let src = null, g = null, pn = null, on = false;
  const V = {
    at(x, y, z) { if (pn) safe(() => { const t = ctx().currentTime; pn.positionX.setTargetAtTime(x, t, 0.05); pn.positionY.setTargetAtTime(y, t, 0.05); pn.positionZ.setTargetAtTime(z, t, 0.05); }); V.x = x; V.y = y; V.z = z; return V; },
    set(vol, rate = 1) {
      safe(() => {
        const C = ctx(), b = BUF[name]; if (!C || !b) return; const t = C.currentTime;
        if (vol > 0.001 && !on) {
          src = C.createBufferSource(); src.buffer = b; src.loop = true; g = C.createGain(); g.gain.value = 0; pn = panner(C, V.x || 0, V.y || 0, V.z || 0, o.ref);
          src.connect(g).connect(pn); src.start(t, Math.random() * Math.max(0, b.duration - 1)); on = true; ACTIVE++;
        }
        if (!on) return;
        g.gain.setTargetAtTime(vol, t, vol > 0.001 ? (o.fadeIn ?? 0.08) : (o.fadeOut ?? 0.12)); src.playbackRate.setTargetAtTime(rate, t, 0.1);
        if (vol <= 0.001) { const s = src; on = false; src = null; ACTIVE--; setTimeout(() => safe(() => s.stop()), 900); }
      });
      return V;
    },
    stop() { V.set(0); },
  };
  return V;
}
