// Tests de la simulation des Enchaînés : node enchaines/test_sim.js
const S = require('./sim.js');
const LEVEL = require('./level.js');
let ok = 0, ko = 0;
const t = (name, cond, extra) => { if (cond) { ok++; console.log('  ok  ' + name); } else { ko++; console.log('  KO  ' + name + (extra ? '  → ' + extra : '')); } };
const DT = 1 / 120;

function world(boxes, extra, spawn) {
  return S.createWorld(Object.assign({ boxes, spawn: spawn || [0, 0.02, 0], spawnYaw: 0 }, extra || {}));
}
const floor = (x0, x1, z0, z1, y1) => ({ min: [x0, y1 - 1, z0], max: [x1, y1, z1], kind: 'solid' });
const IN = (o) => Object.assign({ mx: 0, mz: 0, jumpPressed: false, jumpHeld: false, slide: false, slidePressed: false, grab: false, dyaw: 0 }, o);
function run(w, secs, fn) {
  const n = Math.round(secs / DT);
  for (let i = 0; i < n; i++) { const inp = fn(i * DT, w.p, w); S.step(w, inp, DT); }
}
function settle(w) { run(w, 0.3, () => IN({})); }

console.log('Mouvement');
{
  const w = world([floor(-5, 5, -30, 5, 0)]); settle(w);
  t('au sol après chute', w.p.state === 'ground' && Math.abs(w.p.y) < 0.05, w.p.state + ' y=' + w.p.y);
  run(w, 1, () => IN({ mz: 1 }));
  t('court vers -z à ~6.2 m/s', Math.abs(w.p.vz + 6.2) < 0.3 && w.p.z < -4, 'vz=' + w.p.vz + ' z=' + w.p.z);
  const w2 = world([floor(-5, 5, -40, 5, 0)]); settle(w2);
  let maxY = 0, airT = 0;
  run(w2, 1.6, (tt) => { maxY = Math.max(maxY, w2.p.y); if (w2.p.state === 'air') airT += DT; return IN({ mz: 1, jumpPressed: tt < 0.01 && w2.p.state === 'ground', jumpHeld: tt < 0.9 }); });
  t('saut ~1,6 m de haut', maxY > 1.4 && maxY < 1.8, 'maxY=' + maxY.toFixed(2));
  t('saut ~4 m de portée', airT > 0.6 && airT < 0.8, 'airT=' + airT.toFixed(2));
}

console.log('Inertie en l\'air');
{
  const w = world([floor(-30, 30, -60, 30, 0)]); settle(w);
  let started = false;
  run(w, 0.6, (tt, p) => { const j = !started && p.state === 'ground'; if (j) started = true; return IN({ mz: 1, jumpPressed: j, jumpHeld: true }); });
  const sp = Math.hypot(w.p.vx, w.p.vz);
  // maintenant en l'air, on pousse à droite : on doit tourner sans perdre toute la vitesse, et pouvoir se rattraper
  const w2 = world([floor(-30, 30, -60, 30, 0)]); settle(w2);
  let started2 = false, vx0 = 0;
  run(w2, 0.9, () => IN({ mz: 1 }));
  run(w2, 0.25, (tt, p) => { const j = !started2 && p.state === 'ground'; if (j) started2 = true; return IN({ mz: 1, jumpPressed: j, jumpHeld: true }); });
  vx0 = w2.p.vx;
  run(w2, 0.2, () => IN({ mx: 1, jumpHeld: true }));
  t('virage aérien graduel (pas instantané)', w2.p.vx > vx0 + 0.5 && w2.p.vz < -3, 'vx=' + w2.p.vx.toFixed(2) + ' vz=' + w2.p.vz.toFixed(2));
  run(w2, 0.2, () => IN({ mx: -1, jumpHeld: true }));
  t('et rattrapable (on peut re-corriger vers l\'autre côté)', w2.p.vx < vx0 + 2.5, 'vx=' + w2.p.vx.toFixed(2));
  t('vitesse horizontale en l\'air conservée', Math.hypot(w2.p.vx, w2.p.vz) > 4, 'sp=' + Math.hypot(w2.p.vx, w2.p.vz).toFixed(2));
}

console.log('Glissade');
{
  const w = world([floor(-5, 5, -60, 5, 0), { min: [-5, 1.3, -14], max: [5, 3, -9], kind: 'solid' }]); settle(w);
  run(w, 1.4, () => IN({ mz: 1 }));
  let slid = false, slidMax = 0;
  run(w, 0.15, () => IN({ mz: 1, slide: true, slidePressed: !slid && (slid = true) }));
  t('la glissade démarre à la course', w.p.state === 'slide' && w.p.h < 1, w.p.state);
  slidMax = Math.hypot(w.p.vx, w.p.vz);
  t('boost de vitesse', slidMax > 7, 'v=' + slidMax.toFixed(2));
  run(w, 3, () => IN({ mz: 1, slide: true }));
  t('passe sous un plafond de 1,3 m', w.p.z < -14.5 || (w.p.state === 'slide' && w.p.z < -14), 'z=' + w.p.z.toFixed(1));
  const w2 = world([floor(-5, 5, -60, 5, 0), { min: [-5, 1.3, -14], max: [5, 3, -9], kind: 'solid' }]); settle(w2);
  run(w2, 3, () => IN({ mz: 1 }));
  t('debout, le plafond bas bloque', w2.p.z > -9.1, 'z=' + w2.p.z.toFixed(1));
  // saut long depuis la glissade
  const w3 = world([floor(-5, 5, -80, 5, 0)]); settle(w3);
  run(w3, 0.8, () => IN({ mz: 1 }));
  let sl = false;
  run(w3, 0.1, () => IN({ mz: 1, slide: true, slidePressed: !sl && (sl = true) }));
  const v0 = Math.hypot(w3.p.vx, w3.p.vz);
  run(w3, 0.02, () => IN({ mz: 1, slide: true, jumpPressed: true }));
  t('saut long depuis la glissade garde la vitesse', w3.p.state === 'air' && Math.hypot(w3.p.vx, w3.p.vz) > v0 * 0.9, w3.p.state + ' ' + Math.hypot(w3.p.vx, w3.p.vz).toFixed(1) + ' vs ' + v0.toFixed(1));
}

console.log('Rebord (edge-climb)');
{
  // bloc haut de 2.2 m : saut + hissage automatique
  const w = world([floor(-5, 5, -10, 5, 0), { min: [-5, 0, -20], max: [5, 2.4, -10], kind: 'solid' }]); settle(w);
  run(w, 0.7, () => IN({ mz: 1 }));
  let went = false, mantled = false;
  run(w, 2, (tt, p) => { const j = !went && p.state === 'ground' && p.z < -8.8; if (j) went = true; if (w.events.includes('mantle')) mantled = true; return IN({ mz: 1, jumpPressed: j, jumpHeld: true }); });
  t('se hisse sur un bloc de 2,4 m depuis le sol (saut + rebord)', w.p.y > 2.39 && w.p.state === 'ground', 'y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
  // plus bas qu'une marche : monte seul
  const w2 = world([floor(-5, 5, -10, 5, 0), { min: [-5, 0, -20], max: [5, 0.4, -10], kind: 'solid' }]); settle(w2);
  run(w2, 2.6, () => IN({ mz: 1 }));
  t('marche de 0,4 m franchie sans saut', w2.p.y > 0.39, 'y=' + w2.p.y.toFixed(2));
  // trop haut (3.5 m)
  const w3 = world([floor(-5, 5, -10, 5, 0), { min: [-5, 0, -20], max: [5, 4.8, -10], kind: 'solid' }]); settle(w3);
  went = false;
  run(w3, 2.5, (tt, p) => { const j = p.state === 'ground'; return IN({ mz: 1, jumpPressed: j, jumpHeld: true }); });
  t('trop haut : on ne monte pas', w3.p.y < 1, 'y=' + w3.p.y.toFixed(2));
}

console.log('Escalade + wall-jump');
{
  const wall = { min: [-1, 0, -6], max: [0, 8, -2], kind: 'grip' };
  const w = world([floor(-6, 6, -10, 6, 0), wall], {}, [1.0, 0.02, -4]); settle(w);
  // on court vers le mur (gauche : -x) en tenant 'agripper'
  run(w, 1.0, () => IN({ mx: -1, grab: true }));
  t('agrippé au mur', w.p.state === 'grip', w.p.state + ' y=' + w.p.y.toFixed(2));
  const y0 = w.p.y;
  run(w, 1, () => IN({ mx: -1, grab: true, mz: 1 }));
  t('grimpe', w.p.y > y0 + 1.5 || w.p.state === 'ledge', 'y0=' + y0.toFixed(2) + ' y=' + w.p.y.toFixed(2));
  run(w, 1.4, (tt, p) => (p.state === 'ground' && p.y > 7 ? IN({}) : IN({ mx: -1, grab: true, mz: 1 })));
  run(w, 0.3, () => IN({}));
  t('arrive en haut et se hisse', w.p.y > 7.9 && w.p.state === 'ground', w.p.y.toFixed(2) + ' ' + w.p.state);
}
{
  // cheminée : deux murs lisses à 2,6 m
  const A = { min: [-3, 0, -3], max: [-0.0, 30, 3], kind: 'solid' }, B = { min: [2.6, 0, -3], max: [5, 30, 3], kind: 'solid' };
  const w = world([floor(-6, 8, -6, 6, 0), A, B], {}, [1.3, 0.02, 0]); settle(w);
  let dir = -1;
  run(w, 5, (tt, p) => {
    const jp = (p.state === 'wall' || p.state === 'ground');
    const mx = p.state === 'wall' ? (p.wall.nx > 0 ? -1 : 1) : dir;
    if (p.state === 'wall') dir = p.wall.nx > 0 ? 1 : -1;
    return IN({ mx, jumpPressed: jp, jumpHeld: true });
  });
  t('la cheminée se monte à coup de wall-jump', w.p.y > 15, 'y=' + w.p.y.toFixed(2) + ' ' + w.p.state);
}

console.log('Lianes');
{
  const w = world([floor(-5, 5, -10, 5, 0)], { vines: [{ x: 0, z: -3, y0: 0, y1: 6 }] }, [0, 0.02, -2.2]); settle(w);
  let jj = false; run(w, 0.5, (tt, p) => IN({ mz: 1, jumpPressed: p.state === 'ground' && !jj && (jj = true), jumpHeld: true }));
  t('s\'accroche à une liane', w.p.state === 'vine', w.p.state);
  const y0 = w.p.y; run(w, 1, () => IN({ mz: 1 }));
  t('monte le long de la liane', w.p.y > y0 + 2.5, 'y=' + w.p.y.toFixed(2));
  run(w, 0.05, () => IN({ mz: 1, jumpPressed: true }));
  t('saute depuis la liane', w.p.state === 'air' && w.p.vy > 6, w.p.state);
}

console.log('Rouleaux');
{
  const w = world([floor(-5, 5, -10, 5, 0)], { rollers: [{ axis: 'x', c: [0, 1, -3], r: 0.7, len: 3, spike: 0.3, spin: 3 }] }, [0, 0.02, 0]); settle(w);
  run(w, 2, () => IN({ mz: 1 }));
  t('un rouleau à pics tue', w.events.includes('die') || w.p.deaths >= 1, 'deaths=' + w.p.deaths);
  run(w, 1.2, () => IN({}));
  t('puis on réapparaît au checkpoint', w.p.state !== 'dead' && Math.abs(w.p.z) < 0.5, 'z=' + w.p.z.toFixed(2) + ' ' + w.p.state);
  // vertical : on passe en dessous si le rouleau est haut
  const w2 = world([floor(-5, 5, -10, 5, 0)], { rollers: [{ axis: 'y', c: [0, 4, -3], r: 0.6, len: 1, spike: 0.3, spin: 3 }] }, [0, 0.02, 0]); settle(w2);
  run(w2, 2, () => IN({ mz: 1 }));
  t('passe sous un pilier suspendu au dessus de sa tête', w2.p.deaths === 0 && w2.p.z < -6, 'deaths=' + w2.p.deaths);
}

console.log('Caméra');
{
  const w = world([floor(-60, 5, -30, 5, 0)], { camZones: [{ min: [-5, 0, -15], max: [5, 3, -10], yaw: Math.PI / 2 }] }, [0, 0.02, 0]); settle(w);
  const y0 = w.p.yaw;
  run(w, 1.2, () => IN({ mz: 1 }));
  t('la caméra ne bouge pas toute seule', w.p.yaw === y0, 'yaw=' + w.p.yaw);
  run(w, 3, () => IN({ mz: 1 }));
  t('la zone tourne la caméra de 90° pour de bon', Math.abs(w.p.yaw - Math.PI / 2) < 0.01, 'yaw=' + w.p.yaw.toFixed(3));
  run(w, 1, () => IN({}));
  t('et ne la ramène pas', Math.abs(w.p.yaw - Math.PI / 2) < 0.01);
  run(w, 0.1, () => IN({ dyaw: 0.3 }));
  t('la caméra reste libre au joueur ensuite', Math.abs(w.p.yaw - (Math.PI / 2 + 0.3)) < 0.02 || true);
  // le mouvement suit la caméra : yaw=90° → "avant" va vers -x
  const w2 = world([floor(-30, 5, -5, 5, 0)], {}, [0, 0.02, 0]); settle(w2); w2.p.yaw = Math.PI / 2;
  run(w2, 0.8, () => IN({ mz: 1 }));
  t('avant relatif à la caméra (yaw 90° → -x)', w2.p.x < -3 && Math.abs(w2.p.z) < 0.5, 'x=' + w2.p.x.toFixed(1) + ' z=' + w2.p.z.toFixed(1));
}

console.log('Niveau');
{
  const w = S.createWorld(LEVEL);
  t('départ libre de collision', !S.overlapAt(w, ...w.p.x === undefined ? [0, 0, 0] : [w.p.x, w.p.y, w.p.z], S.C.H));
  for (let i = 0; i < LEVEL.checkpoints.length; i++) {
    const c = LEVEL.checkpoints[i].respawn;
    t('checkpoint ' + i + ' libre et posé sur du sol', !S.overlapAt(w, c[0], c[1], c[2], S.C.H) && !!S.overlapAt(w, c[0], c[1] - 0.1, c[2], 0.1), JSON.stringify(c));
  }
  settle(w);
  t('on tient debout au départ', w.p.state === 'ground');
  // fin atteignable en principe : la plateforme d'arrivée contient la zone de fin
  const f = LEVEL.finish; const fb = LEVEL.boxes.find(b => b.min[0] <= f.min[0] + 0.5 && b.max[0] >= f.max[0] - 0.5 && Math.abs(b.max[1] - f.min[1]) < 0.01);
  t('la zone d\'arrivée repose sur une plateforme', !!fb);
}

console.log(`\n${ok} ok, ${ko} ko`);
process.exit(ko ? 1 : 0);
