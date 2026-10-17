// Test du serveur : deux clients WebSocket créent / rejoignent un salon, lancent la partie, l'un court ; les deux reçoivent le même monde.
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
  // portail : seul l'hôte enchaîne ; un parcours inconnu ramène au parcours par défaut
  b.send({ t: 'next', course: 'remparts' }); await wait(150); a.last.start = null; a.send({ t: 'next', course: 'remparts' }); await wait(250);
  assert.equal(a.last.start?.course, 'remparts', "l'hôte enchaîne sur le parcours suivant");
  a.last.start = null; a.send({ t: 'next', course: 'inconnu' }); await wait(250); assert.equal(a.last.start?.course, 'tour', 'parcours inconnu : parcours par défaut');
  // reprise après coupure : même jeton = même place
  b.ws.close(); await wait(150);
  const b2 = client('Bravo'); await b2.ready; b2.send({ t: 'join', code }); await wait(250);
  assert.equal(b2.last.start?.seat, 1, 'Bravo retrouve sa place');
  a.ws.close(); b2.ws.close(); stop();
});
