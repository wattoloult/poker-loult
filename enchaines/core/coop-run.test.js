// Replay d'un record à deux : rejouer les entrées enregistrées (séries + retours au point de passage) redonne exactement la même montée.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, IDLE } from './sim.js';
import { replayCoop } from './coop-run.js';

const mk = (a, o) => ({ ...IDLE, mx: a[o], mz: a[o + 1], jump: !!(a[o + 2] & 1), brace: !!(a[o + 2] & 2), jc: a[o + 3], dc: a[o + 4], uc: a[o + 5] });
test('replay à deux : mêmes positions, même temps, même nombre de chutes que la partie d\'origine', () => {
  const A = createWorld({ L: 6.5, course: 'tour' }), run = []; let seed = 11, jc = 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let blk = 0; blk < 150; blk++) {
    if (blk === 70) { A.resetHold[1] = 1.01; run.push(['cp', 1]); } // retour demandé depuis le menu : doit être rejoué au même pas
    const jump = rnd() < 0.3; if (jump) jc++;
    const e = [20, Math.round((rnd() * 2 - 1) * 100) / 100, Math.round((rnd() * 2 - 1) * 100) / 100, jump ? 1 : 0, jc, 0, 0, Math.round((rnd() * 2 - 1) * 100) / 100, 0.5, rnd() < 0.2 ? 2 : 0, 0, 0, 0];
    run.push(e); for (let k = 0; k < 20; k++) stepWorld(A, [mk(e, 1), mk(e, 7)]);
  }
  const B = replayCoop('tour', 6.5, run, createWorld, 1e9).W;
  for (let i = 0; i < 2; i++) for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(A.pl[i][k] - B.pl[i][k]) < 1e-9, `${k} du grimpeur ${i + 1}`);
  assert.equal(A.tick, B.tick); assert.equal(A.falls, B.falls); assert.equal(A.cp, B.cp);
});
