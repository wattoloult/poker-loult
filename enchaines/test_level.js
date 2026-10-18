// Faisabilité du vrai parcours : un petit bot glouton (court vers -z, saute avant les vides/murs, glisse sous les plafonds bas)
const S = require('./sim.js'), LEVEL = require('./level.js');
const DT = 1 / 120; let ok = 0, ko = 0;
const t = (n, c, e) => { if (c) { ok++; console.log('  ok  ' + n); } else { ko++; console.log('  KO  ' + n + (e ? '  → ' + e : '')); } };
const IN = o => Object.assign({ mx: 0, mz: 1, jumpPressed: false, jumpHeld: false, slide: false, slidePressed: false, grab: false, dyaw: 0 }, o);

function groundAhead(w, p, d) { return !!S.overlapAt(w, p.x, p.y - 0.4, p.z - d, 0.3); }
function bot(w, secs, stopAt) {
  let slideHeld = false, n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) {
    const p = w.p; const inp = IN({});
    const roofAhead = !!S.overlapAt(w, p.x, p.y + 1.0, p.z - 1.6, 0.6) && !S.overlapAt(w, p.x, p.y, p.z - 1.6, 0.8);
    if (p.state === 'ground') {
      const speed = Math.hypot(p.vx, p.vz);
      if (roofAhead && speed > 4) { inp.slide = true; inp.slidePressed = !slideHeld; slideHeld = true; }
      else if (!groundAhead(w, p, 0.55)) { inp.jumpPressed = true; inp.jumpHeld = true; }
      else { const wall = S.overlapAt(w, p.x, p.y + 0.6, p.z - 0.6, 0.5); if (wall && wall.max[1] > p.y + 0.5) { inp.jumpPressed = true; inp.jumpHeld = true; } }
    } else if (p.state === 'slide') { inp.slide = true; }
    else { inp.jumpHeld = p.vy > 0; }
    S.step(w, inp, DT);
    if (stopAt && stopAt(w)) return i * DT;
  }
  return -1;
}

const w = S.createWorld(LEVEL);
const tt = bot(w, 40, w => w.p.z < -36.5 && w.p.y > 3.5 || w.p.deaths > 0);
t('départ → fin du tunnel sans mourir', w.p.deaths === 0 && w.p.z < -36, 'z=' + w.p.z.toFixed(1) + ' y=' + w.p.y.toFixed(1) + ' deaths=' + w.p.deaths + ' t=' + tt.toFixed(1));
console.log('     temps ~' + tt.toFixed(1) + 's');

// ---- scénarios ciblés sur la vraie géométrie (rouleaux retirés : on teste les chemins, pas le timing) ----
const calm = Object.assign({}, LEVEL, { rollers: [] });
function at(pos, yaw) { const w = S.createWorld(Object.assign({}, calm, { spawn: pos, spawnYaw: yaw })); w.p.yaw = yaw; for (let i = 0; i < 40; i++) S.step(w, IN({ mz: 0 }), DT); return w; }
function go(w, secs, fn, stop) { for (let i = 0; i < secs / DT; i++) { S.step(w, IN(fn(w.p, i * DT)), DT); if (stop && stop(w.p)) return true; } return false; }
const HALF = Math.PI / 2;

// 1) mur d'escalade G1 : on le prend de face (caméra vers -x) en tenant 'agripper'
{
  const w = at([-17.0, 3.62, -53], HALF);
  go(w, 1.0, () => ({ mz: 1, grab: false }));
  go(w, 8, p => ({ mz: 1, grab: true }), p => p.y > 12.5 && p.state === 'ground');
  t('G1 : le mur d\'escalade mène à la passerelle haute (y 12,6)', w.p.y > 12.5 && w.p.state === 'ground', w.p.state + ' y=' + w.p.y.toFixed(2));
  // puis on court sur la passerelle jusqu'à son extrémité (-x) : aucun trou
  go(w, 1.5, () => ({ mx: 1 }), p => p.z < -55);
  go(w, 5, () => ({ mz: 1 }), p => p.x < -36);
  t('G1 : passerelle continue jusqu\'à x≈-37', w.p.x < -36 && w.p.y > 12.5, 'x=' + w.p.x.toFixed(1) + ' y=' + w.p.y.toFixed(2));
}
// 2) face extérieure agrippable WRG depuis la passerelle → sommet 19,6
{
  const w = at([-37.0, 12.62, -55], HALF);
  let jumped = false;
  go(w, 1.5, p => { const j = !jumped && p.state === 'ground'; if (j) jumped = true; return { mz: 1, grab: true, jumpPressed: j, jumpHeld: true }; }, p => p.state === 'grip');
  t('WRG : on s\'agrippe à la face extérieure depuis la passerelle', w.p.state === 'grip', w.p.state + ' x=' + w.p.x.toFixed(2));
  go(w, 8, () => ({ mz: 1, grab: true }), p => p.y > 19.5 && p.state === 'ground');
  t('WRG : on grimpe jusqu\'au sommet (19,6)', w.p.y > 19.5 && w.p.state === 'ground', w.p.state + ' y=' + w.p.y.toFixed(2));
  // saut vers WL (x -46..-43), écart ~2,4 m
  go(w, 3, p => ({ mz: 1, jumpPressed: p.state === 'ground' && p.x > -41.2, jumpHeld: true }), p => p.x < -43.3 && p.state === 'ground' && p.y > 19.5);
  t('WRG→WL : le saut de 2,4 m entre les sommets passe', w.p.x < -43.3 && w.p.y > 19.5, 'x=' + w.p.x.toFixed(2) + ' y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
}
// 3) cheminée à wall-jump (voie normale)
{
  const w = at([-41.7, 7.62, -54], 0);
  let dir = -1;
  go(w, 14, p => { const jp = (p.state === 'wall' || p.state === 'ground'); const mx = p.state === 'wall' ? (p.wall.nx > 0 ? -1 : 1) : dir; if (p.state === 'wall') dir = p.wall.nx > 0 ? 1 : -1; return { mx, mz: 0, jumpPressed: jp, jumpHeld: true }; }, p => p.y > 19.4);
  t('cheminée : se monte à coups de wall-jump jusqu\'en haut', w.p.y > 19, 'y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
}
// 4) liane → passerelle haute
{
  const w = at([-21, 3.62, -57.0], 0);
  go(w, 1.0, () => ({ mz: 0 }));
  let n = 0; go(w, 2, p => ({ mz: 1, jumpPressed: p.state === 'ground' && n++ === 0, jumpHeld: true }), p => p.state === 'vine');
  t('liane : on s\'y accroche depuis la base de la tour', w.p.state === 'vine', w.p.state);
  go(w, 5, () => ({ mz: 1 }), p => p.y > 12.55);
  go(w, 0.0, () => ({}));
  S.step(w, IN({ mz: -1, jumpPressed: true }), DT);          // saute vers +z (caméra yaw 0 : arrière = +z)
  go(w, 2.0, () => ({ mz: -1 }), p => p.state === 'ground');
  t('liane : on retombe sur la passerelle haute (z -56..-54)', w.p.state === 'ground' && w.p.y > 12.5, w.p.state + ' y=' + w.p.y.toFixed(2) + ' z=' + w.p.z.toFixed(2));
}
// 5) marches de la voie principale (1 m d'écart, 1 m de haut), caméra vers -x
{
  const w = at([-21.2, 3.62, -54], HALF);
  go(w, 8, p => { const ahead = !!S.overlapAt(w, p.x - 0.55, p.y - 0.4, p.z, 0.3); return { mz: 1, jumpPressed: p.state === 'ground' && !ahead, jumpHeld: true }; }, p => p.x < -36.5 && p.y > 7.5);
  t('marches M1→M4 : on arrive sur le sol de la cheminée (y 7,6)', w.p.y > 7.5 && w.p.x < -36.4, 'x=' + w.p.x.toFixed(1) + ' y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
}
// 6) gauntlet : poutre puis saut vers l'arrivée
{
  const w = at([-49, 19.62, -54], HALF);
  go(w, 8, p => { const ahead = !!S.overlapAt(w, p.x - 0.55, p.y - 0.4, p.z, 0.3); return { mz: 1, jumpPressed: p.state === 'ground' && !ahead, jumpHeld: true }; }, p => p.finished);
  t('gauntlet : la ligne d\'arrivée est atteignable (hors rouleaux)', w.p.finished, 'x=' + w.p.x.toFixed(1) + ' y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
}

console.log(`\n${ok} ok, ${ko} ko`); process.exit(ko ? 1 : 0);
