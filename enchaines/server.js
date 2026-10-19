// LES ENCHAÎNÉS — serveur de salons et de parties (2 grimpeurs + spectateurs). AUTORITÉ TOTALE : la physique des deux grimpeurs
// et de la chaîne tourne ici (120 pas/s, core/sim.js) ; chaque client n'envoie que ses entrées et prédit en les rejouant.
// Service : systemd `enchaines-mm`, Caddy route /enchaines-ws* -> PORT (8807). Classement : DATA_DIR/best.json (hors des fichiers servis), lu par le message `board`.
// pings : mark {k, x, y, z} -> relayé {t:'mark', seat, k, x, y, z} ; client -> serveur : hello {name, token} · list · board · create {L} · join {code} · leave · cfg {L} (hôte) · start (hôte) · restart (hôte) · cp · i {a:[[ct,mx,mz,bits,jc,dc],...]} · ping {n}
// speedrun solo : POST /enchaines-ws/solo {course, name, run} ; GET /enchaines-ws/replay?id= (replay d'un record) -> le serveur rejoue la partie (core/replay.js, dans un worker) et la classe ; board {course, solo:1}
// serveur -> client : hi {id} · rooms {list} · board {list} · room {...} · start {seat, names, L, s} · s {w, ack:[a0,a1], in:[i0,i1], e:[...]} (30/s) · end {board, rank} · left · err {m} · pong
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { WebSocketServer } from 'ws';
import { createWorld, stepWorld, snapWorld, DT, IDLE } from './core/sim.js';
import { COURSES, DEFAULT_COURSE } from './core/worlds.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8807, DEV = process.env.ENCH_DEV === '1';
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data'), BEST = path.join(DATA, 'best.json');
// MODE PLAYTEST PRIVÉ : actif seulement si ENCH_PT_KEY est défini ; le module (hors des fichiers servis) n'est envoyé qu'au client qui donne la clé.
// Pour le désactiver : retirer ENCH_PT_KEY du service (et supprimer le fichier). Voir CLAUDE.md.
const PT_KEY = process.env.ENCH_PT_KEY || '', PT_FILE = process.env.ENCH_PT_FILE || path.join(ROOT, 'playtest', 'playtest.js');
const ptOk = (k) => { if (!PT_KEY || typeof k !== 'string') return false; const a = Buffer.from(k), b = Buffer.from(PT_KEY); return a.length === b.length && crypto.timingSafeEqual(a, b); };
// chat vocal : relais TURN (coturn sur la même machine, partagé avec together) pour les liaisons que les box / opérateurs empêchent d'aller en direct.
// Identifiants éphémères « TURN REST » : nom = expiration:client, mot de passe = HMAC-SHA1 du secret partagé avec coturn (ENCH_TURN_SECRET, drop-in systemd).
const TURN_SECRET = process.env.ENCH_TURN_SECRET || '', TURN_HOST = process.env.ENCH_TURN_HOST || 'loultparty.fr';
function iceServers(id) {
  const list = [{ urls: 'stun:' + TURN_HOST + ':3478' }, { urls: 'stun:stun.l.google.com:19302' }];
  if (!TURN_SECRET) return list;
  const username = Math.floor(Date.now() / 1000) + 12 * 3600 + ':ench' + id;
  list.push({ urls: ['turn:' + TURN_HOST + ':3478?transport=udp', 'turn:' + TURN_HOST + ':3478?transport=tcp'], username, credential: crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64') });
  return list;
}
const MAXP = { coop: 2, free: 4 }; // sièges par mode : coop = deux grimpeurs reliés par la chaîne ; free = « mode libre », jusqu'à 4 grimpeurs, SANS chaîne, premier au sommet
const SNAP_EVERY = 4, GRACE = 60, MAX_Q = 36, LENS = [4.5, 6.5, 9];
fs.mkdirSync(DATA, { recursive: true });
// classement par parcours : { idParcours: [ ... ] } (ancien format = liste de la Tour)
let boards = {}; try { const b = JSON.parse(fs.readFileSync(BEST, 'utf8')); boards = Array.isArray(b) ? { tour: b } : b; } catch { boards = {}; }
const boardOf = (id) => (boards[id] ||= []);

const rooms = new Map();
// parcours autorisé : publié, ou n'importe lequel pour un client authentifié en playtest (clé serveur)
const okCourse = (ws, id) => (COURSES[id] && (COURSES[id].published || ws.pt) ? id : DEFAULT_COURSE);
let nextId = 1;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
const cast = (r, o) => { const s = JSON.stringify(o); for (const p of r.people) send(p.ws, s); for (const ws of r.spect) send(ws, s); };
const live = (r) => r.people.filter((p) => !p.gone);
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; } }
const num = (v, a, b) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : 0);
const cnt = (v) => (Number.isInteger(v) && v >= 0 && v < 1e9 ? v : 0);
const decIn = (a) => ({ mx: num(a[1], -1, 1), mz: num(a[2], -1, 1), jump: !!(a[3] & 1), brace: !!(a[3] & 2), reset: !!(a[3] & 4), pull: !!(a[3] & 8), cup: !!(a[3] & 16), punch: !!(a[3] & 32), kick: !!(a[3] & 64), slide: !!(a[3] & 128), jc: cnt(a[4]), dc: cnt(a[5]), uc: cnt(a[6]) });
const encIn = (I) => (I ? [0, I.mx, I.mz, (I.jump ? 1 : 0) | (I.brace ? 2 : 0) | (I.reset ? 4 : 0) | (I.pull ? 8 : 0) | (I.cup ? 16 : 0) | (I.punch ? 32 : 0) | (I.kick ? 64 : 0) | (I.slide ? 128 : 0), I.jc, I.dc, I.uc || 0] : null);

/* ------------------------------ salons ------------------------------ */
function roomView(r, you) {
  return { t: 'room', code: r.code, phase: r.phase, cfg: r.cfg, you, host: r.people.find((x) => x.sid === r.host)?.seat ?? null,
    players: live(r).map((x) => ({ id: x.seat, name: x.name, offline: !!x.offline })), spectators: r.spect.size };
}
function pushRoom(r) { for (const p of r.people) send(p.ws, roomView(r, p.seat)); for (const ws of r.spect) send(ws, roomView(r, null)); }
function seatFree(r) { const used = new Set(live(r).map((p) => p.seat)); for (let s = 0; s < r.max; s++) if (!used.has(s)) return s; }
const canStart = (r) => (r.cfg.mode === 'free' ? live(r).length >= 2 && live(r).length <= 4 : live(r).length === 2);
function create(ws, m) {
  leave(ws);
  const L = LENS.includes(+m.L) ? +m.L : 6.5, course = okCourse(ws, m.course);
  const mode = m.mode === 'free' ? 'free' : 'coop';
  const r = { code: newCode(), phase: 'lobby', mode, max: MAXP[mode], cfg: { L, course, mode, max: MAXP[mode] }, people: [], spect: new Set(), host: ws.id, empty: 0, W: null, acc: 0, k: 0, ev: [] };
  rooms.set(r.code, r); seatIn(r, ws); pushRoom(r);
}
function seatIn(r, ws) {
  const seat = seatFree(r);
  r.people.push({ sid: ws.id, token: ws.token, ws, seat, name: ws.name, q: [], last: null, ack: 0, fresh: true });
  r.spect.delete(ws); ws.room = r;
}
function join(ws, m) {
  const r = rooms.get(clean(m.code, 8).toUpperCase());
  if (!r) return send(ws, { t: 'err', m: 'Salon introuvable.' });
  const back = r.people.find((p) => p.token && p.token === ws.token && !p.gone); // reprise après coupure : même jeton = même place
  if (back) {
    if (back.ws && back.ws !== ws) back.ws.room = null;
    Object.assign(back, { ws, sid: ws.id, offline: false, q: [], fresh: true, ack: 0 }); ws.room = r; // ack à 0 : le client repart de 0 sur le 'start' (sinon le serveur ignorerait ses entrées jusqu'à rattraper l'ancien compteur = grimpeur figé)
    if (r.host === back.oldSid) r.host = ws.id;
    pushRoom(r); if (r.W) send(ws, startMsg(r, back.seat));
    return;
  }
  leave(ws);
  if (live(r).length < r.max && r.phase === 'lobby') { seatIn(r, ws); return pushRoom(r); }
  if (r.spect.size >= 12) return send(ws, { t: 'err', m: 'Salon complet.' });
  r.spect.add(ws); ws.room = r; pushRoom(r); if (r.W) send(ws, startMsg(r, null));
}
function leave(ws) {
  const r = ws.room; if (!r) return; ws.room = null;
  if (r.spect.delete(ws)) return pushRoom(r);
  const p = r.people.find((x) => x.ws === ws); if (!p) return;
  p.gone = true; p.ws = null;
  r.people = r.people.filter((x) => !x.gone);
  if (r.host === ws.id) r.host = r.people[0]?.sid ?? null;
  if (r.phase === 'play' && r.people.length < (r.cfg.mode === 'free' ? 1 : 2)) { r.phase = 'lobby'; r.W = null; cast(r, { t: 'room', ...roomView(r, null), phase: 'lobby' }); }
  if (!r.people.length && !r.spect.size) return closeRoom(r);
  pushRoom(r); send(ws, { t: 'left' });
}
function closeRoom(r) { rooms.delete(r.code); for (const ws of r.spect) ws.room = null; }
function startMsg(r, seat) { return { t: 'start', seat, mode: r.cfg.mode, course: r.cfg.course, names: r.W.pl.map((_, s) => r.people.find((p) => p.seat === s)?.name || 'Grimpeur ' + (s + 1)), L: r.cfg.L, s: snapWorld(r.W) }; }
function startGame(r) {
  const free = r.cfg.mode === 'free'; r.firstT = null;
  if (free) live(r).forEach((p, i) => { p.seat = i; }); // sièges contigus 0..n-1 (un grimpeur de la sim par siège)
  r.W = createWorld({ L: r.cfg.L, course: r.cfg.course, free, players: free ? live(r).length : undefined }); r.phase = 'play'; r.acc = 0; r.k = 0; r.ev = []; r.saved = false; r.run = free ? null : []; // r.run : les entrées des deux grimpeurs pas à pas (replay des records)
  for (const p of r.people) { p.q = []; p.last = null; p.ack = 0; p.fresh = true; }
  for (const p of r.people) send(p.ws, startMsg(r, p.seat));
  for (const ws of r.spect) send(ws, startMsg(r, null));
  pushRoom(r);
}
const KEEP = new Set(['lost', 'punch', 'tackle', 'down', 'checkpoint', 'respawn', 'finish', 'collapse', 'restore', 'save', 'abyss', 'reset']);
function update(r, dt) {
  if (r.phase !== 'play' || !r.W) return;
  r.acc += dt; let n = 0;
  while (r.acc >= DT && n++ < 30) {
    r.acc -= DT;
    // une entrée par grimpeur et par pas : file d'attente (rattrapage si elle s'allonge), sinon on répète la dernière
    const ins = r.W.pl.map(() => IDLE);
    for (const p of r.people) {
      if (p.q.length > MAX_Q) p.q.splice(0, p.q.length - 8);
      const e = p.q.shift();
      if (e) { p.last = decIn(e); p.ack = e[0]; }
      if (p.offline) p.last = { ...(p.last || IDLE), mx: 0, mz: 0, jump: false };
      if (p.rstT > 0) { p.rstT -= DT; p.last = { ...(p.last || IDLE), reset: true }; } // retour au point de passage demandé depuis le menu (mode libre)
      if (p.seat < ins.length) ins[p.seat] = p.last || IDLE;
    }
    recTick(r, ins); stepWorld(r.W, ins);
    for (const e of r.W.ev) if (KEEP.has(e.k)) r.ev.push(e);
    if (++r.k % SNAP_EVERY === 0) snap(r, ins);
    if (r.cfg.mode === 'free' && !r.W.done && r.W.rank.length) { if (r.firstT == null) r.firstT = r.W.time; else if (r.W.time - r.firstT > 120) r.W.done = true; } // 2 minutes de grâce après le premier arrivé
    if (r.W.done && !r.saved) { r.saved = true; if (r.cfg.mode === 'free') endFree(r); else record(r); }
  }
}
// enregistre le pas : séries d'entrées identiques regroupées (voir core/coop-run.js) ; au-delà de 300 000 séries on abandonne l'enregistrement
function recTick(r, ins) {
  if (!r.run || r.W.done) return;
  const a = encIn(ins[0]), b = encIn(ins[1]), e = [1, ...a.slice(1), ...b.slice(1)], l = r.run[r.run.length - 1];
  if (l && l.length === 13 && l.every((v, k) => k === 0 || v === e[k])) l[0]++; else { r.run.push(e); if (r.run.length > 300000) r.run = null; }
}
function snap(r, ins) {
  const w = snapWorld(r.W), ack = ins.map(() => 0);
  for (const p of r.people) if (p.seat < ack.length) ack[p.seat] = p.ack;
  const msg = JSON.stringify({ t: 's', w, ack, in: ins.map(encIn), e: r.ev });
  r.ev = [];
  for (const p of r.people) send(p.ws, msg); for (const ws of r.spect) send(ws, msg);
}
// mode libre : classement de la course (pas de record enregistré)
function endFree(r) {
  const rank = r.W.rank.map((seat) => ({ seat, name: r.people.find((p) => p.seat === seat)?.name || 'Grimpeur ' + (seat + 1), time: Math.round((r.W.pl[seat]?.finishT || 0) * 100) / 100 }));
  cast(r, { t: 'end', free: 1, course: r.cfg.course, rank });
}
function record(r) { // classement par meilleur temps (le serveur a chronométré lui-même la montée)
  const names = [0, 1].map((s) => r.people.find((p) => p.seat === s)?.name || '?');
  const e = { names, time: Math.round(r.W.time * 100) / 100, falls: r.W.falls, saves: r.W.saves, L: r.cfg.L, date: new Date().toISOString().slice(0, 10) };
  if (r.run?.length) { // replay du record : la montée entière, rejouée chez le client avec la vraie physique
    e.rid = crypto.randomBytes(8).toString('hex'); e.v = SIM_V;
    try { fs.writeFileSync(path.join(REPLAYS, e.rid + '.json'), JSON.stringify({ coop: 1, course: r.cfg.course, L: r.cfg.L, names, time: e.time, falls: e.falls, saves: e.saves, date: e.date, v: SIM_V, run: r.run })); } catch (err) { delete e.rid; console.error('replay non écrit', err.message); }
  }
  let board = boardOf(r.cfg.course); board.push(e); board.sort((a, b) => a.time - b.time);
  for (const x of board.slice(TOP)) dropReplay(x); boards[r.cfg.course] = board = board.slice(0, TOP);
  try { fs.writeFileSync(BEST, JSON.stringify(boards)); } catch (err) { console.error('classement non écrit', err.message); }
  cast(r, { t: 'end', course: r.cfg.course, board, rank: board.indexOf(e) >= 0 ? board.indexOf(e) : null });
}

/* ------------------------------ speedrun solo : rejeu vérifié, un seul temps (le meilleur) par pseudo ------------------------------ */
let worker = null, jobN = 0; const jobs = new Map();
function replay(course, run) {
  if (!worker) { worker = new Worker(new URL('./core/replay.js', import.meta.url)); worker.on('message', ({ id, r }) => { jobs.get(id)?.(r); jobs.delete(id); }); worker.on('error', (e) => { console.error('rejeu', e.message); for (const f of jobs.values()) f({ ok: false, why: 'rejeu' }); jobs.clear(); worker = null; }); worker.unref(); }
  return new Promise((res) => { const id = ++jobN; jobs.set(id, res); worker.postMessage({ id, course, run }); });
}
// REPLAYS des records solo : la partie (entrées pas à pas) est gardée dans DATA_DIR/replays/<rid>.json et rejouée chez le client avec la vraie
// physique. SIM_V = empreinte des fichiers de physique : un replay enregistré avec une autre version peut diverger (le client le signale).
const REPLAYS = path.join(DATA, 'replays'); fs.mkdirSync(REPLAYS, { recursive: true });
const SIM_V = crypto.createHash('md5').update(['core/sim.js', 'core/kit.js', 'core/worlds.js', ...['courses', 'biomes'].flatMap((d) => fs.readdirSync(path.join(ROOT, 'core', d)).filter((f) => f.endsWith('.js')).sort().map((f) => `core/${d}/${f}`))].map((f) => fs.readFileSync(path.join(ROOT, f))).join('|')).digest('hex').slice(0, 10);
// TOP 5 par parcours (à deux et solo séparément) : seuls ces cinq records gardent leur replay (au-delà, on libère le disque)
const TOP = 5;
const dropReplay = (e) => { if (e?.rid) fs.rm(path.join(REPLAYS, e.rid + '.json'), { force: true }, () => {}); };
for (const k of Object.keys(boards)) { for (const x of boards[k].slice(TOP)) dropReplay(x); boards[k] = boards[k].slice(0, TOP); }
async function soloRun(m, rp = replay) { // rp : rejoueur (tests : en direct, sans worker)
  if (!m || !COURSES[m.course]?.published || !Array.isArray(m.run)) return { ok: false, why: 'parcours' };
  if (jobs.size > 8) return { ok: false, why: 'serveur occupé, réessaie' };
  const r = await rp(m.course, m.run); if (!r.ok) return r;
  const name = clean(m.name, 16) || 'Grimpeur', key = 'solo:' + m.course, e = { names: [name], time: r.time, falls: r.falls, date: new Date().toISOString().slice(0, 10) };
  let board = boardOf(key); const old = board.find((x) => x.names[0].toLowerCase() === name.toLowerCase());
  // un ancien record SANS replay (d'avant la fonction) est remplacé par la prochaine montée validée du même joueur, même plus lente : sans cela il resterait à jamais sans bouton « Revoir »
  if (old && old.rid && old.time <= e.time) return { ok: true, time: r.time, rank: board.indexOf(old), board: board.slice(0, TOP), kept: 1 };
  e.rid = crypto.randomBytes(8).toString('hex'); e.v = SIM_V;
  try { fs.writeFileSync(path.join(REPLAYS, e.rid + '.json'), JSON.stringify({ course: m.course, name, time: r.time, falls: r.falls, date: e.date, v: SIM_V, run: m.run })); } catch (err) { delete e.rid; console.error('replay non écrit', err.message); }
  dropReplay(old); board = board.filter((x) => x !== old); board.push(e); board.sort((a, b) => a.time - b.time);
  for (const x of board.slice(TOP)) dropReplay(x); boards[key] = board = board.slice(0, TOP);
  try { fs.writeFileSync(BEST, JSON.stringify(boards)); } catch (err) { console.error('classement non écrit', err.message); }
  return { ok: true, time: r.time, rank: board.indexOf(e), board }; // rank -1 : hors du top
}

/* ------------------------------ HTTP (dev : fichiers ; prod : classement seul, le reste est servi par le hub) ------------------------------ */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/stats') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ rooms: rooms.size, players: [...rooms.values()].reduce((s, r) => s + live(r).length, 0) })); }
  if (u.pathname === '/enchaines-ws/replay' && req.method === 'GET') { // replay d'un record solo : ?id=<rid>
    const id = u.searchParams.get('id') || ''; if (!/^[0-9a-f]{16}$/.test(id)) { res.writeHead(400); return res.end(); }
    return fs.readFile(path.join(REPLAYS, id + '.json'), (err, b) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' }); res.end(b); });
  }
  if (u.pathname === '/enchaines-ws/solo' && req.method === 'POST') { // la partie entière (~20 octets par changement d'entrée), 4 Mo au plus
    let body = '', len = 0;
    req.on('data', (c) => { len += c.length; if (len > 4e6) { res.writeHead(413); res.end(); req.destroy(); } else body += c; });
    req.on('end', async () => { if (res.writableEnded) return; let m = null; try { m = JSON.parse(body); } catch { } const r = await soloRun(m); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(r)); });
    return;
  }
  if (!DEV) { res.writeHead(404); return res.end(); }
  let f = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
  if (!f.startsWith(ROOT) || /server\.js|node_modules|data[\\/]|playtest[\\/]/.test(f)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (err, b) => { if (err) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(b); });
});
const wss = new WebSocketServer({ server, path: '/enchaines-ws', maxPayload: 16384 });
wss.on('connection', (ws) => {
  ws.id = nextId++; ws.name = 'Grimpeur'; ws.alive = true; ws.budget = 400;
  ws.on('pong', () => { ws.alive = true; });
  send(ws, { t: 'hi', id: ws.id, ice: iceServers(ws.id) });
  ws.on('message', (data) => {
    if (--ws.budget < 0) return; // un client fou ne peut pas noyer le serveur
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const r = ws.room, p = r?.people.find((x) => x.ws === ws);
    switch (m.t) {
      case 'hello': ws.name = clean(m.name, 16) || 'Grimpeur'; ws.token = clean(m.token, 40); if (p) { p.name = ws.name; pushRoom(r); } break;
      case 'ping': send(ws, { t: 'pong', n: m.n }); break;
      case 'err': console.error('[client]', String(m.m).slice(0, 300), '|', String(m.at || '').slice(0, 200)); break; // erreur JS signalée par un client (diagnostic)
      case 'chat': { // chat texte du salon (joueurs et spectateurs), 140 caractères, au plus un message toutes les 0,6 s
        const txt = clean(m.m, 140), now = Date.now(); if (!r || !txt || now - (ws.chatT || 0) < 600) break; ws.chatT = now;
        cast(r, { t: 'chat', name: ws.name || 'Grimpeur', seat: p ? p.seat : null, m: txt }); break;
      }
      case 'mark': { // ping d'un grimpeur (Ici, 3-2-1, STOP, Viens) : relayé au partenaire et aux spectateurs, au plus ~3 par seconde
        const now = Date.now(); if (!r || !p || !['here', 'go', 'stop', 'come'].includes(m.k) || now - (ws.markT || 0) < 300) break; ws.markT = now;
        const c = (v) => (Number.isFinite(+v) ? Math.max(-5000, Math.min(5000, +v)) : 0), o = JSON.stringify({ t: 'mark', seat: p.seat, k: m.k, x: c(m.x), y: c(m.y), z: c(m.z) });
        for (const q of r.people) if (q.ws && q.ws !== ws) send(q.ws, o); for (const s of r.spect) send(s, o); break;
      }
      case 'rtc': { // chat vocal : le serveur ne fait que relayer la négociation WebRTC entre les deux grimpeurs (l'audio passe en direct)
        if (!r || !p || typeof m.d !== 'object' || JSON.stringify(m.d).length > 12000) break;
        const o = r.people.find((x) => x.ws && (Number.isInteger(m.to) ? x.seat === m.to : x.seat !== p.seat)); if (o && o !== p) send(o.ws, { t: 'rtc', from: p.seat, d: m.d }); break;
      }
      case 'pt': { // demande du module de test
        if (!ptOk(m.key)) { send(ws, { t: 'pt', ok: 0 }); break; }
        let code = ''; try { code = fs.readFileSync(PT_FILE, 'utf8'); } catch { send(ws, { t: 'pt', ok: 0, m: 'module absent' }); break; }
        ws.pt = true; send(ws, { t: 'pt', ok: 1, code }); break;
      }
      case 'board': { const id = COURSES[m.course] ? m.course : DEFAULT_COURSE; send(ws, { t: 'board', course: id, solo: m.solo ? 1 : 0, simV: SIM_V, list: boardOf(m.solo ? 'solo:' + id : id).slice(0, TOP) }); break; }
      case 'list': send(ws, { t: 'rooms', list: [...rooms.values()].filter((x) => x.phase === 'lobby' && live(x).length < x.max).slice(0, 20).map((x) => ({ code: x.code, host: live(x)[0]?.name || '?', n: live(x).length, max: x.max, mode: x.cfg.mode })) }); break;
      case 'create': create(ws, m); break;
      case 'join': join(ws, m); break;
      case 'leave': leave(ws); break;
      case 'cfg': if (r && r.host === ws.id && r.phase === 'lobby') { if (LENS.includes(+m.L)) r.cfg.L = +m.L; if (m.course) r.cfg.course = okCourse(ws, m.course); if ((m.mode === 'free' || m.mode === 'coop') && live(r).length <= MAXP[m.mode]) { r.cfg.mode = m.mode; r.cfg.max = r.max = MAXP[m.mode]; } pushRoom(r); } break;
      case 'start': if (r && r.host === ws.id && canStart(r)) startGame(r); break;
      case 'next': if (r && r.host === ws.id && r.phase === 'play' && canStart(r)) { r.cfg.course = okCourse(ws, m.course); startGame(r); pushRoom(r); } break; // portail de fin : parcours suivant
      case 'restart': if (r && r.host === ws.id && r.phase === 'play') startGame(r); break;
      case 'cp': if (r && p && r.W) { if (r.cfg.mode === 'free') p.rstT = 0.7; else { r.W.resetHold[p.seat] = 1.01; r.run?.push(['cp', p.seat]); } } break; // retour au point de passage demandé depuis le menu
      case 'i': {
        if (!p || !r.W || !Array.isArray(m.a)) break;
        for (const e of m.a.slice(0, 12)) if (Array.isArray(e) && e.length >= 6 && e.length <= 7 && Number.isInteger(e[0]) && e[0] > p.ack) { if (p.fresh) { p.fresh = false; p.q = []; } p.q.push(e); }
        break;
      }
    }
  });
  ws.on('close', () => {
    const r = ws.room; if (!r) return;
    const p = r.people.find((x) => x.ws === ws);
    if (p && r.phase === 'play') { p.offline = true; p.oldSid = ws.id; p.ws = null; p.offT = 0; pushRoom(r); } // on garde la place un moment
    else leave(ws);
  });
});
let lastTick = process.hrtime.bigint();
const timers = [
  setInterval(() => { for (const ws of wss.clients) ws.budget = 400; }, 1000),
  setInterval(() => { for (const ws of wss.clients) { if (!ws.alive) { ws.terminate(); continue; } ws.alive = false; ws.ping(); } }, 15000),
  setInterval(() => {
    const now = process.hrtime.bigint(), dt = Math.min(0.1, Number(now - lastTick) / 1e9); lastTick = now;
    for (const r of rooms.values()) {
      for (const p of [...r.people]) if (p.offline && (p.offT += dt) > GRACE) { p.gone = true; r.people = r.people.filter((x) => x !== p); if (r.phase === 'play' && r.people.length < (r.cfg.mode === 'free' ? 1 : 2)) { r.phase = 'lobby'; r.W = null; } if (r.host === p.oldSid) r.host = r.people[0]?.sid ?? null; pushRoom(r); }
      if (!r.people.some((p) => p.ws) && !r.spect.size) { if ((r.empty += dt) > 30) { closeRoom(r); continue; } } else r.empty = 0;
      update(r, dt);
    }
  }, 4),
];
server.listen(PORT, DEV ? '0.0.0.0' : '127.0.0.1', () => console.log(`enchaines-mm sur :${PORT}${DEV ? ' (DEV, sert aussi les fichiers)' : ''}`));
export const stop = () => { timers.forEach(clearInterval); for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(); };
export { rooms, server, soloRun, boards };
