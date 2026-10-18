// REPLAY d'une montée à DEUX : le serveur (autorité) garde les entrées des deux grimpeurs pas à pas ; le client les rejoue avec la même physique.
// run = suite d'entrées : [n, mx, mz, bits, jc, dc, uc, mx, mz, bits, jc, dc, uc] = n pas identiques d'affilée (grimpeur 1 puis grimpeur 2),
//   ou ['cp', siège] = retour au point de passage demandé depuis le menu (appliqué avant le pas suivant). Module sans dépendance navigateur ni Node.
import { stepWorld } from './sim.js';

const num = (v) => (Number.isFinite(+v) ? Math.max(-1, Math.min(1, +v)) : 0);
const cnt = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);
const dec = (a, o) => ({ mx: num(a[o]), mz: num(a[o + 1]), jump: !!(a[o + 2] & 1), brace: !!(a[o + 2] & 2), reset: !!(a[o + 2] & 4), pull: !!(a[o + 2] & 8), cup: !!(a[o + 2] & 16), punch: !!(a[o + 2] & 32), kick: !!(a[o + 2] & 64), jc: cnt(a[o + 3]), dc: cnt(a[o + 4]), uc: cnt(a[o + 5]) });
// curseur de lecture : R = { i, k } ; renvoie false quand la montée est finie
export function stepCoop(W, run, R) {
  let e = run[R.i];
  while (e && e[0] === 'cp') { if (W.resetHold) W.resetHold[e[1] === 1 ? 1 : 0] = 1.01; R.i++; e = run[R.i]; }
  if (!e) return false;
  stepWorld(W, [dec(e, 1), dec(e, 7)]);
  if (++R.k >= e[0]) { R.i++; R.k = 0; }
  return true;
}
export function replayCoop(course, L, run, createWorld, max = 120 * 60 * 30) {
  const W = createWorld({ L, course }), R = { i: 0, k: 0 }; let n = 0;
  while (stepCoop(W, run, R)) { if (++n > max) return { ok: false, why: 'trop long', W }; if (W.done) break; }
  return { ok: !!W.done, W, steps: n };
}
