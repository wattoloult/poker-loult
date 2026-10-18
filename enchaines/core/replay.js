// SPEEDRUN SOLO : le serveur rejoue la partie entrée par entrée avec la vraie physique (déterministe) pour la chronométrer lui-même.
// run = [[n, mx, mz, bits, jc, dc, uc], ...] : n pas identiques d'affilée (bits : 1 saut, 2 arc-bouté, 4 retour, 8 tirer, 16 courte échelle).
// Lancé comme worker (server.js) : reçoit { course, run }, renvoie le résultat ; sinon replayRun() s'importe directement (tests).
import { isMainThread, parentPort } from 'node:worker_threads';
import { createWorld, stepWorld, IDLE } from './sim.js';

export const MAX_STEPS = 120 * 60 * 30; // 30 min de jeu au plus
const num = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
const cnt = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);
export const decRun = (a) => ({ mx: num(a[1]), mz: num(a[2]), jump: !!(a[3] & 1), brace: !!(a[3] & 2), reset: !!(a[3] & 4), pull: !!(a[3] & 8), cup: !!(a[3] & 16), jc: cnt(a[4]), dc: cnt(a[5]), uc: cnt(a[6]) });
export function replayRun(course, run) {
  const W = createWorld({ course }); W.alone = true;
  let steps = 0;
  for (const e of run) {
    if (!Array.isArray(e) || e.length !== 7 || !Number.isInteger(e[0]) || e[0] < 1) return { ok: false, why: 'format' };
    const I = decRun(e);
    for (let k = 0; k < e[0]; k++) {
      if (++steps > MAX_STEPS) return { ok: false, why: 'trop long' };
      stepWorld(W, [I, IDLE]);
      if (W.done) return { ok: true, time: Math.round(W.time * 100) / 100, falls: W.falls, resets: W.resets };
    }
  }
  const A = W.pl[0];
  return { ok: false, why: 'sommet non atteint', cp: W.cp, x: A.x, y: A.y, z: A.z, time: W.time };
}
if (!isMainThread && parentPort) parentPort.on('message', ({ id, course, run }) => { let r; try { r = replayRun(course, run); } catch (e) { r = { ok: false, why: String(e.message) }; } parentPort.postMessage({ id, r }); });
