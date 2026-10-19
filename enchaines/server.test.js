// Test du serveur : deux clients WebSocket créent / rejoignent un salon, lancent la partie, l'un court ; les deux reçoivent le même monde.
import './core/botmode.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

process.env.ENCH_VOTE_MS = '700'; process.env.PORT = '18807'; process.env.DATA_DIR = path.join(os.tmpdir(), 'enchaines-test-' + process.pid);
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
  a.ws.close(); b2.ws.close();
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
  // top 5 : au-delà, ni classement ni replay gardé
  let last = null; for (let i = 1; i <= 5; i++) last = await soloRun({ course: '__t', name: 'S' + i, run: [[60, 0, 1, 0, 0, 0, 0], [60, 0, -1, 0, 0, 0, 0], ...Array.from({ length: i }, () => [[40, 0, 1, 0, 0, 0, 0], [40, 0, -1, 0, 0, 0, 0]]).flat(), ...run] }, replayRun); // i détours de plus = i fois plus lent
  assert.equal(last.board.length, 5, 'top 5 seulement'); assert.equal(last.rank, -1, 'le plus lent est hors du top 5'); assert.deepEqual(last.board.map((x) => x.names[0]), ['Rapide', 'Lent', 'S1', 'S2', 'S3']);
  const again2 = await soloRun({ course: '__t', name: 'rapide', run: slow }, replayRun); assert.equal(again2.board[0].names[0], 'Rapide');
  // ancien record sans replay (d'avant la fonction) : la prochaine montée validée du même joueur le remplace, même plus lente
  const { boards: bd } = await import('./server.js'); bd['solo:__t'] = [{ names: ['Ancien'], time: 1.5, falls: 0, date: '2026-01-01' }];
  const mig = await soloRun({ course: '__t', name: 'ancien', run: slow }, replayRun);
  assert.ok(mig.ok && mig.board[0].rid && mig.board[0].time > 1.5, 'le record sans replay est remplacé par une montée avec replay');
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

test('mode libre : 3 grimpeurs sans chaîne, entrées de chacun, arrivée classée, fin annoncée à tous', async () => {
  const { server: srv } = await import('./server.js'); if (!srv.listening) srv.listen(18807); await wait(100); // le test précédent a fermé le serveur
  const a = client('Ana'), b = client('Ben'), c = client('Cat'), d = client('Dan'); await a.ready; await b.ready; await c.ready; await d.ready;
  a.send({ t: 'create', L: 6.5, mode: 'free' }); await wait(150);
  const code = a.last.room.code; assert.equal(a.last.room.cfg.mode, 'free'); assert.equal(a.last.room.cfg.max, 4);
  b.send({ t: 'join', code }); c.send({ t: 'join', code }); await wait(200);
  assert.equal(a.last.room.players.length, 3);
  d.send({ t: 'list' }); await wait(100); assert.ok(d.last.rooms.list.some((r) => r.code === code && r.mode === 'free' && r.max === 4), 'salon libre listé');
  a.send({ t: 'start' }); await wait(250);
  assert.equal(a.last.start.mode, 'free'); assert.equal(a.last.start.names.length, 3); assert.equal(c.last.start.seat, 2);
  assert.equal(a.last.start.s.pl.length, 3); assert.equal(a.last.start.s.ch.length, 0, 'aucune chaîne');
  for (let ct = 1; ct <= 100; ct += 2) { c.send({ t: 'i', a: [[ct, 0, 1, 0, 0, 0], [ct + 1, 0, 1, 0, 0, 0]] }); await wait(16); }
  await wait(300);
  const s = a.last.s; assert.equal(s.ack.length, 3); assert.ok(s.ack[2] >= 80, 'entrées du 3e acquittées : ' + s.ack[2]); assert.equal(s.in.length, 3);
  const z0 = a.last.start.s.pl[2].z; assert.ok(s.w.pl[2].z - z0 > 3, 'le 3e a avancé seul : ' + (s.w.pl[2].z - z0)); assert.ok(Math.abs(s.w.pl[0].z - a.last.start.s.pl[0].z) < 0.5, 'les autres restent là');
  // chat vocal : la négociation WebRTC est relayée à la place visée (`to`), avec l'expéditeur (`from`) ; les autres ne la reçoivent pas
  a.send({ t: 'rtc', to: 2, d: { s: { type: 'offer', sdp: 'x' } } }); await wait(150);
  assert.equal(c.last.rtc?.from, 0, 'le 3e reçoit la négociation du 1er'); assert.ok(!b.last.rtc, 'pas le 2e');
  b.send({ t: 'rtc', to: 0, d: { c: { candidate: 'y' } } }); await wait(150); assert.equal(a.last.rtc?.from, 1);
  // arrivées : Ben puis les autres
  const W = rooms.get(code).W, top = W.level.checkpoints[W.level.checkpoints.length - 1];
  for (const k of [1, 0, 2]) { const p = W.pl[k]; Object.assign(p, { x: top.x, y: top.y, z: top.z, vx: 0, vy: 0, vz: 0, cp: W.level.checkpoints.length - 2 }); await wait(120); }
  await wait(400);
  const end = a.last.end; assert.ok(end && end.free, 'classement annoncé'); assert.deepEqual(end.rank.map((r) => r.name), ['Ben', 'Ana', 'Cat']);
  assert.ok(b.last.end && c.last.end, 'à tous');
  // vote de la carte suivante : ouvert pour tous, 2 votes différents = égalité = tirage au sort entre les deux ; la partie suivante démarre toute seule
  await wait(100); assert.ok(a.last.vote && a.last.vote.list.length >= 2 && c.last.vote, 'le vote est ouvert pour tous');
  const [X, Y] = a.last.vote.list, starts = () => a.msgs.filter((m) => m.t === 'start').length, k0 = starts();
  a.send({ t: 'vote', course: X }); b.send({ t: 'vote', course: Y }); await wait(150);
  assert.equal(c.last.vote.votes[0], X); assert.equal(c.last.vote.votes[1], Y);
  await wait(1200); assert.equal(starts(), k0 + 1, 'la partie suivante est lancée');
  assert.ok([X, Y].includes(a.last.start.course), 'carte tirée parmi les ex æquo : ' + a.last.start.course); assert.equal(a.last.vote.done, a.last.start.course);
  assert.equal(a.last.start.s.pl.length, 3, 'les 3 grimpeurs sont repartis');
  // sans aucun vote : une carte au hasard parmi toutes
  const W2 = rooms.get(code).W, top2 = W2.level.checkpoints[W2.level.checkpoints.length - 1];
  for (const k of [0, 1, 2]) { Object.assign(W2.pl[k], { x: top2.x, y: top2.y, z: top2.z, vx: 0, vy: 0, vz: 0, cp: W2.level.checkpoints.length - 2 }); await wait(120); }
  await wait(300); const list2 = a.last.vote?.list; assert.ok(list2 && !a.last.vote.done, 'nouveau vote ouvert'); const k1 = starts();
  await wait(1200); assert.equal(starts(), k1 + 1, 'sans vote : la partie suivante démarre quand même'); assert.ok(list2.includes(a.last.start.course));
  for (const x of [a, b, c, d]) x.ws.close();
});

test('mode crazy : tir sur un adversaire, mort annoncée à tous, vote entre arènes uniquement', async () => {
  const { server: srv } = await import('./server.js'); if (!srv.listening) srv.listen(18807); await wait(100);
  const a = client('Ana'), b = client('Ben'); await a.ready; await b.ready;
  a.send({ t: 'create', L: 6.5, mode: 'crazy' }); await wait(150);
  const code = a.last.room.code; assert.equal(a.last.room.cfg.mode, 'crazy'); assert.equal(a.last.room.cfg.max, 4); assert.ok(rooms.get(code).cfg.course === 'depot' || rooms.get(code).cfg.course === 'toits');
  b.send({ t: 'join', code }); await wait(150); a.send({ t: 'start' }); await wait(250);
  assert.equal(a.last.start.mode, 'crazy'); assert.equal(a.last.start.s.pl.length, 2); assert.equal(a.last.start.s.ch.length, 0);
  const W = rooms.get(code).W; assert.ok(W.crazy);
  // Ana en (0, ., -20) vise Ben posé à 12 m : tête (hauteur 1,68 m ; la caméra est décalée de 0,75 m à droite)
  Object.assign(W.pl[0], { x: -20, y: 0, z: -2, prot: 0, ay: 0 }); Object.assign(W.pl[1], { x: -20 - 0.75, y: 0, z: 10, prot: 0 });
  W.level.bodies; // la carte du Dépôt a des conteneurs : on dégage le couloir de tir
  for (const bd of W.bodies) if (bd.i > 0 && bd.mat === 'metal' && Math.abs(bd.px + 20) < 8) bd.on = false;
  const ap = Math.atan2(1.68 - 1.85, 12), bits = 256; // le rayon de la caméra part de l'épaule (0,75 m à droite), 0,35 m au-dessus des yeux
  for (let ct = 1; ct <= 30; ct += 2) { a.send({ t: 'i', a: [[ct, 0, 0, bits, 0, 0, 0, 0, ap], [ct + 1, 0, 0, bits, 0, 0, 0, 0, ap]] }); await wait(16); }
  await wait(300);
  const evs = [...a.msgs, ...b.msgs].filter((m) => m.t === 's').flatMap((m) => m.e);
  assert.ok(evs.some((e) => e.k === 'kill' && e.p === 0 && e.v === 1 && e.head), 'la mort est annoncée'); assert.equal(W.pl[0].kills, 1);
  assert.ok(b.msgs.some((m) => m.t === 's' && m.e.some((e) => e.k === 'kill')), 'Ben le reçoit aussi');
  W.pl[0].kills = W.limit; await wait(300);
  const end = a.last.end; assert.ok(end && end.crazy && end.rank[0].name === 'Ana' && end.rank[0].kills >= 15, 'classement');
  await wait(100); assert.ok(a.last.vote.list.length >= 2 && a.last.vote.list.every((id) => ['depot', 'toits'].includes(id)), 'le vote ne propose que des arènes');
  for (const x of [a, b]) x.ws.close(); stop();
});
