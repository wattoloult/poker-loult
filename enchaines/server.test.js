// Test du serveur : deux clients WebSocket créent / rejoignent un salon, lancent la partie, l'un court ; les deux reçoivent le même monde.
import './core/botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

process.env.PORT = '18807'; process.env.DATA_DIR = path.join(os.tmpdir(), 'enchaines-test-' + process.pid);
const { stop, rooms } = await import('./server.js');
const { layChain } = await import('./core/sim.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client(name) {
  const ws = new WebSocket('ws://127.0.0.1:18807/enchaines-ws'), C = { ws, msgs: [], last: {} };
  ws.on('message', (d) => { const m = JSON.parse(d); C.msgs.push(m); C.last[m.t] = m; });
  C.send = (o) => ws.send(JSON.stringify(o));
  C.ready = new Promise((r) => ws.on('open', () => { C.send({ t: 'hello', name, token: name + '-tok' }); r(); }));
  return C;
}
test('salon à deux, départ, entrées, instantanés identiques', async () => {
  const a = client('Alpha'), b = client('Bravo'); await a.ready; await b.ready;
  a.send({ t: 'create', L: 6.5 }); await wait(150);
  const code = a.last.room.code; assert.match(code, /^[A-Z0-9]{4}$/);
  b.send({ t: 'join', code }); await wait(150);
  assert.equal(a.last.room.players.length, 2);
  b.send({ t: 'start' }); await wait(100); assert.ok(!a.last.start, 'seul l\'hôte lance');
  a.send({ t: 'start' }); await wait(200);
  assert.equal(a.last.start.seat, 0); assert.equal(b.last.start.seat, 1);
  for (let ct = 1; ct <= 120; ct += 2) { a.send({ t: 'i', a: [[ct, 1, 0, 0, 0, 0], [ct + 1, 1, 0, 0, 0, 0]] }); await wait(16); }
  await wait(300);
  const sa = a.last.s, sb = b.last.s;
  assert.ok(sa.w.pl[0].x > 1, 'le grimpeur 1 a avancé : x=' + sa.w.pl[0].x);
  assert.ok(sa.ack[0] >= 100, 'entrées acquittées : ' + sa.ack[0]);
  assert.ok(Math.abs(sa.w.k - sb.w.k) <= 4, 'même pas de simulation');
  // arrivée au sommet : le serveur chronomètre, classe et annonce le classement aux deux
  const W = rooms.get(code).W; W.cp = 7; W.started = true; W.time = 123.4;
  W.pl[0].x = 14; W.pl[1].x = 15.4; for (const p of W.pl) { p.y = 91.25; p.z = 9; p.vx = p.vy = p.vz = 0; } layChain(W);
  await wait(400);
  assert.ok(a.last.end && b.last.end, 'fin annoncée aux deux');
  assert.equal(a.last.end.board[0].names.join('+'), 'Alpha+Bravo');
  assert.equal(a.last.end.rank, 0);
  // replay du record à deux : la montée est gardée au serveur (entrées des deux grimpeurs) et servie par le HTTP
  const rid = a.last.end.board[0].rid; assert.match(rid, /^[0-9a-f]{16}$/, 'le record garde un replay');
  const rep = await (await fetch('http://127.0.0.1:18807/enchaines-ws/replay?id=' + rid)).json();
  assert.ok(rep.coop && Array.isArray(rep.run) && rep.run.length > 0 && rep.names.join('+') === 'Alpha+Bravo' && rep.L === 6.5, 'replay à deux complet');
  // portail : seul l'hôte enchaîne ; un parcours inconnu ramène au parcours par défaut
  b.send({ t: 'next', course: 'remparts' }); await wait(150); a.last.start = null; a.send({ t: 'next', course: 'remparts' }); await wait(250);
  assert.equal(a.last.start?.course, 'remparts', "l'hôte enchaîne sur le parcours suivant");
  a.last.start = null; a.send({ t: 'next', course: 'inconnu' }); await wait(250); assert.equal(a.last.start?.course, 'tour', 'parcours inconnu : parcours par défaut');
  // chat : relayé aux deux, nettoyé (pas de HTML), anti-flood ; vocal : la négociation WebRTC passe à l'autre grimpeur
  a.send({ t: 'chat', m: 'salut <b>toi</b>' }); a.send({ t: 'chat', m: 'flood' }); await wait(150);
  assert.equal(b.last.chat?.m, 'salut btoi/b', 'message relayé et nettoyé'); assert.ok(!b.msgs.some((x) => x.t === 'chat' && x.m === 'flood'), 'anti-flood');
  a.send({ t: 'rtc', d: { s: { type: 'offer', sdp: 'x' } } }); await wait(120); assert.equal(b.last.rtc?.d.s.type, 'offer', 'signal vocal relayé');
  // reprise après coupure : même jeton = même place ; le client repart de ct=1, le serveur doit l'écouter malgré l'ancien compteur
  for (let ct = 1; ct <= 60; ct++) b.send({ t: 'i', a: [[ct, 0, 0, 0, 0, 0]] }); await wait(250);
  const pb = () => rooms.get(code).people.find((x) => x.seat === 1); assert.ok(pb().ack >= 50, 'Bravo avait des entrées acquittées');
  b.ws.close(); await wait(150);
  const b2 = client('Bravo'); await b2.ready; b2.send({ t: 'join', code }); await wait(250);
  assert.equal(b2.last.start?.seat, 1, 'Bravo retrouve sa place');
  b2.send({ t: 'i', a: [[1, 1, 0, 0, 0, 0], [2, 1, 0, 0, 0, 0]] }); await wait(300);
  assert.ok(pb().ack >= 1 && pb().ack < 50, 'après reprise, ses entrées (ct repart de 1) sont acceptées, ack=' + pb().ack);
  a.ws.close(); b2.ws.close(); stop();
});
// speedrun solo : le serveur rejoue la partie (même physique) ; il refuse ce qui n'atteint pas le sommet
test('speedrun solo : rejeu identique au jeu, arrivée chronométrée, partie incomplète refusée', async () => {
  const { replayRun } = await import('./core/replay.js');
  const { createWorld, stepWorld, IDLE } = await import('./core/sim.js');
  const { COURSES } = await import('./core/worlds.js');
  const c0 = COURSES.tour.checkpoints[0];
  COURSES.__t = { ...COURSES.tour, id: '__t', checkpoints: [c0, { ...c0, x: c0.x + 4, finish: true, r: 1.5 }] }; // arrivée à 4 m du départ
  const run = [[30, 0, 0, 0, 0, 0, 0], [240, 1, 0, 0, 0, 0, 0]];
  const W = createWorld({ course: '__t' }); W.alone = true;
  for (const [n, mx, mz] of run) for (let k = 0; k < n && !W.done; k++) stepWorld(W, [{ ...IDLE, mx, mz }, IDLE]);
  const r = replayRun('__t', run);
  assert.ok(W.done && r.ok, 'arrivée atteinte : ' + JSON.stringify(r));
  assert.equal(r.time, Math.round(W.time * 100) / 100, 'même temps que la partie jouée');
  assert.equal(replayRun('tour', run).ok, false, 'sur la vraie tour : sommet non atteint');
  assert.equal(replayRun('tour', [[1, 'x']]).why, 'format');
  // classement : un seul temps par pseudo (le meilleur), trié
  const { soloRun } = await import('./server.js'); COURSES.__t.published = true;
  const slow = [[60, 0, 1, 0, 0, 0, 0], [60, 0, -1, 0, 0, 0, 0], ...run]; // détour (le chrono part au premier mouvement)
  assert.equal((await soloRun({ course: '__t', name: 'Lent', run: slow }, replayRun)).rank, 0);
  const f = await soloRun({ course: '__t', name: 'Rapide', run }, replayRun); assert.equal(f.rank, 0, 'le plus rapide passe devant');
  const again = await soloRun({ course: '__t', name: 'rapide', run: slow }, replayRun); assert.equal(again.kept, 1, 'un temps moins bon ne remplace pas le record du joueur');
  assert.deepEqual(again.board.map((x) => x.names[0]), ['Rapide', 'Lent']);
  // replay : chaque record garde sa partie, rejouable à l'identique ; l'ancien replay d'un joueur qui s'améliore disparaît
  const rid = again.board[0].rid; assert.match(rid, /^[0-9a-f]{16}$/);
  const { server: srv } = await import('./server.js'); if (!srv.listening) srv.listen(18807); await wait(100);
  const rep = await (await fetch('http://127.0.0.1:18807/enchaines-ws/replay?id=' + rid)).json();
  assert.equal(rep.name, 'Rapide'); assert.equal(replayRun('__t', rep.run).time, rep.time, 'le replay rejoue le même temps');
  assert.equal((await fetch('http://127.0.0.1:18807/enchaines-ws/replay?id=../best')).status, 400, 'identifiant refusé');
  delete COURSES.__t;
  const post = (o) => fetch('http://127.0.0.1:18807/enchaines-ws/solo', { method: 'POST', body: JSON.stringify(o) }).then((x) => x.json());
  const { server } = await import('./server.js'); if (!server.listening) server.listen(18807); await wait(100);
  assert.equal((await post({ course: 'tour', name: 'Tricheur', run })).ok, false, 'le serveur rejette une partie qui ne finit pas');
  assert.equal((await post({ course: 'inconnu', run })).why, 'parcours');
  server.close();
});
