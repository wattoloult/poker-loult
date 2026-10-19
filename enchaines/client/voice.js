// LES ENCHAÎNÉS — chat vocal du salon : WebRTC DIRECT entre les grimpeurs (l'audio ne passe pas par le serveur, qui ne relaie que la négociation, message 'rtc {to}').
// À deux (coop) : une liaison. En mode libre (jusqu'à 4) : un MAILLAGE, une liaison par autre grimpeur. Négociation « parfaite » : dans chaque paire, le grimpeur
// de la place la plus haute est poli (il cède en cas d'offres croisées). Le micro n'est demandé qu'au clic sur le bouton (jamais d'office) ; on entend les autres même micro coupé.
let ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
export const setIce = (l) => { if (Array.isArray(l) && l.length) ICE = l; }; // relais TURN du serveur (message 'hi') : indispensable derrière certaines box / en 4G
const V = { net: null, seat: -1, peers: new Map(), mic: null, on: false, anMe: null, onChange: null };
const safe = async (f) => { try { return await f(); } catch (e) { console.info('[vocal]', e?.message || e); } };
const sig = (to, d) => V.net?.send({ t: 'rtc', to, d });
const SET = { gain: 1, vol: 1, inId: '', outId: '' }; // réglages : gain du micro, volume des autres, périphériques

function closePeer(j) { const P = V.peers.get(j); if (!P) return; safe(() => P.pc.close()); if (P.audio) P.audio.srcObject = null; V.peers.delete(j); V.onChange?.(); }
function addPeer(j) {
  if (j === V.seat || !Number.isInteger(j)) return null;
  if (V.peers.has(j)) return V.peers.get(j);
  const pc = new RTCPeerConnection({ iceServers: ICE }), P = { j, pc, polite: V.seat > j, making: false, ignore: false, audio: null, an: null, state: 'new' };
  V.peers.set(j, P);
  pc.addTransceiver('audio', { direction: 'sendrecv' }); // canal audio prêt d'avance : activer le micro = remplacer la piste, sans renégocier
  pc.onicecandidate = (e) => e.candidate && sig(j, { c: e.candidate });
  pc.onnegotiationneeded = () => safe(async () => { P.making = true; await pc.setLocalDescription(); sig(j, { s: pc.localDescription }); P.making = false; });
  pc.ontrack = (e) => {
    const st = e.streams[0] || new MediaStream([e.track]);
    if (!P.audio) { P.audio = new Audio(); P.audio.autoplay = true; P.audio.volume = SET.vol; if (SET.outId && P.audio.setSinkId) P.audio.setSinkId(SET.outId).catch(() => {}); }
    P.audio.srcObject = st; P.audio.play().catch(() => {});
    P.an = meter(st);
  };
  pc.onconnectionstatechange = () => { P.state = pc.connectionState; V.onChange?.(); };
  micTrackFor(P);
  return P;
}
// ouvre / ajuste les liaisons (appelé à chaque mise à jour du salon) ; seat = notre place, seats = les places occupées
export function start(net, seat, seats = [0, 1]) {
  V.net = net; V.seat = seat;
  const want = new Set(seats.filter((s) => s !== seat));
  for (const j of [...V.peers.keys()]) if (!want.has(j)) closePeer(j);
  for (const j of want) addPeer(j);
}
export async function onSignal(d, from) {
  const P = V.peers.get(from) || (Number.isInteger(from) && V.net ? addPeer(from) : V.peers.size === 1 ? [...V.peers.values()][0] : null);
  if (!P) return; const pc = P.pc;
  await safe(async () => {
    if (d.s) {
      const clash = d.s.type === 'offer' && (P.making || pc.signalingState !== 'stable');
      P.ignore = !P.polite && clash; if (P.ignore) return;
      await pc.setRemoteDescription(d.s);
      if (d.s.type === 'offer') { await pc.setLocalDescription(); sig(P.j, { s: pc.localDescription }); }
    } else if (d.c) { try { await pc.addIceCandidate(d.c); } catch (e) { if (!P.ignore) throw e; } }
  });
}
export function stop() { for (const j of [...V.peers.keys()]) closePeer(j); V.seat = -1; V.onChange?.(); }
// micro : premier clic = autorisation du navigateur ; ensuite on coupe / rouvre (la piste reste, elle est simplement désactivée)
async function openMic(fake) {
  const raw = fake ? fakeStream() : await navigator.mediaDevices.getUserMedia({ audio: { deviceId: SET.inId ? { exact: SET.inId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume();
  const src = AC.createMediaStreamSource(raw), dest = AC.createMediaStreamDestination(), g = AC.createGain(); g.gain.value = SET.gain; src.connect(g).connect(dest);
  V.raw?.getTracks().forEach((t) => t.stop()); V.raw = raw; V.gain = g; V.mic = dest.stream; V.fake = !!fake;
}
export async function toggleMic(fake) {
  if (!V.mic) {
    const ok = await safe(async () => { await openMic(fake); return true; });
    if (!ok) return { ok: false, why: 'micro refusé ou absent' };
    V.anMe = meter(V.mic); V.on = true; setMicTrack();
  } else { V.on = !V.on; for (const t of V.mic.getAudioTracks()) t.enabled = V.on; }
  V.onChange?.(); return { ok: true, on: V.on };
}
// réglages audio du vocal
export function setMicGain(g) { SET.gain = g; if (V.gain) V.gain.gain.value = g; }
export async function setInput(id) {
  SET.inId = id || ''; if (!V.mic) return;
  const on = V.on; await safe(async () => { await openMic(V.fake); V.anMe = meter(V.mic); for (const t of V.mic.getAudioTracks()) t.enabled = on; setMicTrack(); });
}
export function setOutput(id) { SET.outId = id || ''; for (const P of V.peers.values()) if (P.audio?.setSinkId) P.audio.setSinkId(SET.outId).catch(() => {}); }
export async function devices() {
  const l = (await safe(() => navigator.mediaDevices.enumerateDevices())) || [];
  const pick = (k) => l.filter((d) => d.kind === k).map((d, i) => ({ id: d.deviceId, label: d.label || (k === 'audioinput' ? 'Microphone ' : 'Haut-parleurs ') + (i + 1) }));
  return { inputs: pick('audioinput'), outputs: pick('audiooutput') };
}
function micTrackFor(P) { const tr = P.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio'); if (tr && V.mic) safe(() => tr.sender.replaceTrack(V.mic.getAudioTracks()[0])); }
function setMicTrack() { for (const P of V.peers.values()) micTrackFor(P); }
export function setVolume(v) { SET.vol = Math.max(0, Math.min(1, v)); for (const P of V.peers.values()) if (P.audio) P.audio.volume = SET.vol; }
// niveau sonore (0..1) : qui parle (pastille sur l'étiquette du grimpeur)
let AC = null;
function meter(st) { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); const a = AC.createAnalyser(); a.fftSize = 256; AC.createMediaStreamSource(st).connect(a); return a; } catch { return null; } }
const BUFV = new Uint8Array(128);
function lvl(a) { if (!a || !a.getByteTimeDomainData) return 0; a.getByteTimeDomainData(BUFV); let s = 0; for (const v of BUFV) s += ((v - 128) / 128) ** 2; return Math.min(1, Math.sqrt(s / BUFV.length) * 6); }
export function levels() { // seats[j] : niveau de la place j (pastille « parle » de chaque grimpeur) ; partner : le plus fort des autres
  if (AC?.state === 'suspended') AC.resume();
  const seats = {}; let partner = 0; for (const [j, P] of V.peers) { seats[j] = lvl(P.an); partner = Math.max(partner, seats[j]); }
  return { partner, seats, me: V.on ? lvl(V.anMe) : 0 };
}
export const status = () => { const st = [...V.peers.values()].map((P) => P.state); return { link: st.includes('connected') ? 'connected' : st[0] || 'off', mic: !!V.mic, on: V.on, peers: st.length }; };
export const onChange = (f) => { V.onChange = f; };
// test sans micro : un son synthétique sert de micro (vérification de la liaison dans deux onglets)
function fakeStream() { AC ||= new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), d = AC.createMediaStreamDestination(); o.frequency.value = 330; o.connect(d); o.start(); return d.stream; }
