// LES ENCHAÎNÉS — chat vocal entre les deux grimpeurs d'un salon : WebRTC direct (l'audio ne passe pas par le serveur, qui ne relaie que
// la négociation, message 'rtc'). Négociation « parfaite » : le grimpeur 2 est poli (il cède en cas d'offres croisées).
// Le micro n'est demandé qu'au clic sur le bouton (jamais d'office) ; on entend son partenaire même micro coupé.
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const V = { pc: null, net: null, polite: false, making: false, ignore: false, mic: null, on: false, audio: null, level: 0, meLevel: 0, an: null, anMe: null, state: 'off', onChange: null };
const safe = async (f) => { try { return await f(); } catch (e) { console.info('[vocal]', e?.message || e); } };
const sig = (d) => V.net?.send({ t: 'rtc', d });

// ouvre la liaison avec le partenaire (appelé quand le salon a deux grimpeurs) ; seat = notre place
export function start(net, seat) {
  if (V.pc) return; V.net = net; V.polite = seat === 1;
  const pc = (V.pc = new RTCPeerConnection({ iceServers: ICE }));
  pc.addTransceiver('audio', { direction: 'sendrecv' }); // canal audio prêt d'avance : activer le micro = remplacer la piste, sans renégocier
  pc.onicecandidate = (e) => e.candidate && sig({ c: e.candidate });
  pc.onnegotiationneeded = () => safe(async () => { V.making = true; await pc.setLocalDescription(); sig({ s: pc.localDescription }); V.making = false; });
  pc.ontrack = (e) => {
    const st = e.streams[0] || new MediaStream([e.track]);
    if (!V.audio) { V.audio = new Audio(); V.audio.autoplay = true; }
    V.audio.srcObject = st; V.audio.play().catch(() => {});
    V.an = meter(st);
  };
  pc.onconnectionstatechange = () => { V.state = pc.connectionState; V.onChange?.(); };
  if (V.mic) setMicTrack();
}
export async function onSignal(d) {
  const pc = V.pc; if (!pc) return;
  await safe(async () => {
    if (d.s) {
      const clash = d.s.type === 'offer' && (V.making || pc.signalingState !== 'stable');
      V.ignore = !V.polite && clash; if (V.ignore) return;
      await pc.setRemoteDescription(d.s);
      if (d.s.type === 'offer') { await pc.setLocalDescription(); sig({ s: pc.localDescription }); }
    } else if (d.c) { try { await pc.addIceCandidate(d.c); } catch (e) { if (!V.ignore) throw e; } }
  });
}
export function stop() { safe(() => V.pc?.close()); V.pc = null; V.state = 'off'; V.an = null; if (V.audio) V.audio.srcObject = null; V.onChange?.(); }
// micro : premier clic = autorisation du navigateur ; ensuite on coupe / rouvre (la piste reste, elle est simplement désactivée)
export async function toggleMic(fake) {
  if (!V.mic) {
    const st = await safe(() => (fake ? fakeStream() : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })));
    if (!st) return { ok: false, why: 'micro refusé ou absent' };
    V.mic = st; V.anMe = meter(st); V.on = true; setMicTrack();
  } else { V.on = !V.on; for (const t of V.mic.getAudioTracks()) t.enabled = V.on; }
  V.onChange?.(); return { ok: true, on: V.on };
}
function setMicTrack() { const tr = V.pc?.getTransceivers().find((t) => t.receiver.track.kind === 'audio'); if (tr && V.mic) safe(() => tr.sender.replaceTrack(V.mic.getAudioTracks()[0])); }
export function setVolume(v) { if (V.audio) V.audio.volume = Math.max(0, Math.min(1, v)); }
// niveau sonore (0..1) : qui parle (pastille sur l'étiquette du grimpeur)
let AC = null;
function meter(st) { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); const a = AC.createAnalyser(); a.fftSize = 256; AC.createMediaStreamSource(st).connect(a); return a; } catch { return null; } }
const BUFV = new Uint8Array(128);
function lvl(a) { if (!a || !a.getByteTimeDomainData) return 0; a.getByteTimeDomainData(BUFV); let s = 0; for (const v of BUFV) s += ((v - 128) / 128) ** 2; return Math.min(1, Math.sqrt(s / BUFV.length) * 6); }
export function levels() { if (AC?.state === 'suspended') AC.resume(); return { partner: lvl(V.an), me: V.on ? lvl(V.anMe) : 0 }; }
export const status = () => ({ link: V.state, mic: !!V.mic, on: V.on });
export const onChange = (f) => { V.onChange = f; };
// test sans micro : un son synthétique sert de micro (vérification de la liaison dans deux onglets)
function fakeStream() { AC ||= new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), d = AC.createMediaStreamDestination(); o.frequency.value = 330; o.connect(d); o.start(); return d.stream; }
