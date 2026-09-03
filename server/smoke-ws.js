/* Smoke-test du transport WebSocket — node server/smoke-ws.js
   (lance d'abord le serveur : node server/server.js) */
'use strict';
const net = require('net');
const crypto = require('crypto');

const PORT = process.env.PORT || 8770;
const key = crypto.randomBytes(16).toString('base64');
const sock = net.connect(PORT, '127.0.0.1');
let handshaked = false, buf = Buffer.alloc(0);
const got = [];

sock.on('connect', () => {
  sock.write(
    'GET /?t=smoke&name=Test HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n' +
    'Connection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
});

function maskFrame(str) {
  const payload = Buffer.from(str, 'utf8'), len = payload.length, mask = crypto.randomBytes(4);
  const header = len < 126 ? Buffer.from([0x81, 0x80 | len])
    : (() => { const h = Buffer.allocUnsafe(4); h[0] = 0x81; h[1] = 0x80 | 126; h.writeUInt16BE(len, 2); return h; })();
  const out = Buffer.allocUnsafe(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, out]);
}
function parse(b) {
  const frames = []; let off = 0;
  while (off + 2 <= b.length) {
    const b1 = b[off + 1]; let len = b1 & 0x7f; let p = off + 2;
    if (len === 126) { if (p + 2 > b.length) break; len = b.readUInt16BE(p); p += 2; }
    else if (len === 127) { if (p + 8 > b.length) break; len = Number(b.readBigUInt64BE(p)); p += 8; }
    if (p + len > b.length) break;
    frames.push(b.slice(p, p + len).toString('utf8')); off = p + len;
  }
  return { frames, rest: b.slice(off) };
}

sock.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  if (!handshaked) {
    const i = buf.indexOf('\r\n\r\n');
    if (i < 0) return;
    const head = buf.slice(0, i).toString();
    if (!/101 Switching Protocols/.test(head)) { console.error('✗ pas de handshake 101'); process.exit(1); }
    handshaked = true; buf = buf.slice(i + 4);
  }
  const { frames, rest } = parse(buf); buf = rest;
  for (const f of frames) { try { got.push(JSON.parse(f)); } catch (e) { } }
});

// "Lancer la partie" via le menu : 4 joueurs (1 humain + 3 bots)
setTimeout(() => sock.write(maskFrame(JSON.stringify({ type: 'start', name: 'Test', config: { seats: 4, startStack: 5000, levelDuration: 120 } }))), 400);

setTimeout(() => {
  let ok = 0, fail = 0;
  const A = (l, c) => c ? ok++ : (fail++, console.error('✗ ' + l));
  const hello = got.find(m => m.type === 'hello');
  const lobby = got.find(m => m.type === 'lobby');
  const states = got.filter(m => m.type === 'state');
  const playing = states.reverse().find(m => m.snap.phase === 'playing');
  A('handshake WS ok', handshaked);
  A('reçu hello + token', hello && typeof hello.token === 'string');
  A('reçu lobby (menu)', !!lobby);
  A('lobby non démarré au départ', lobby && lobby.active === false);
  A('partie démarrée après "start"', !!playing);
  A('4 sièges occupés (1 humain + 3 bots)', playing && playing.snap.seats.filter(s => s).length === 4);
  A('config appliquée (tapis 5000)', playing && playing.snap.seats.filter(s => s).every(p => p.stack + p.committed <= 5000));
  console.log(`\n${ok} OK, ${fail} échec(s)`);
  sock.end(); process.exit(fail ? 1 : 0);
}, 1600);
