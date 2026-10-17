// Connexion au serveur de salons : WebSocket JSON, reconnexion automatique avec le même jeton (le serveur rend sa place au joueur).
const safe = (f, d) => { try { return f(); } catch { return d; } };
const mem = {};
// jeton propre à l'onglet (sessionStorage) : deux onglets = deux joueurs, un rechargement garde sa place
function token() {
  let t = safe(() => sessionStorage.getItem('ch-token'), null) || mem.t;
  if (!t) { t = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); mem.t = t; safe(() => sessionStorage.setItem('ch-token', t)); }
  return t;
}
export function createNet(getName) {
  const url = new URLSearchParams(location.search).get('ws') || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/enchaines-ws';
  const N = { ws: null, up: false, rtt: 0, room: safe(() => sessionStorage.getItem('ch-room'), null), handlers: {}, tries: 0, closed: false, onState: null };
  N.on = (type, fn) => { N.handlers[type] = fn; };
  N.send = (o) => { if (N.ws && N.ws.readyState === 1) N.ws.send(JSON.stringify(o)); };
  N.setRoom = (c) => { N.room = c; safe(() => (c ? sessionStorage.setItem('ch-room', c) : sessionStorage.removeItem('ch-room'))); };
  function open() {
    const ws = N.ws = new WebSocket(url);
    ws.onopen = () => { N.up = true; N.tries = 0; N.send({ t: 'hello', name: getName(), token: token() }); N.onState?.(true); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'pong') { const r = performance.now() - m.n; N.rtt = N.rtt ? N.rtt * 0.7 + r * 0.3 : r; return; }
      if (m.t === 'hi' && N.room) { N.auto = true; N.send({ t: 'join', code: N.room }); } // reprise après une coupure (si le salon n'existe plus : on l'oublie sans message d'erreur)
      if (m.t === 'room' || m.t === 'start') N.auto = false;
      N.handlers[m.t]?.(m);
    };
    ws.onclose = () => { N.up = false; N.onState?.(false); if (N.closed) return; setTimeout(open, Math.min(4000, 400 * 2 ** N.tries++)); };
    ws.onerror = () => ws.close();
  }
  open();
  setInterval(() => N.send({ t: 'ping', n: performance.now() }), 2000);
  return N;
}
