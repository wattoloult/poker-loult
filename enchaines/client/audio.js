// Sons du jeu, synthétisés en Web Audio (maquettes en attendant de vrais enregistrements CC0) :
// pas, saut, réception, maillons qui cliquettent, chaîne qui se tend / claque, prise, effondrement, point de passage, sommet.
// Aucun bruit continu : le souffle de chute n'existe que pendant une chute rapide. Un son ne peut jamais casser le jeu (try/catch).
let C = null, OUT = null, VOL = 0.8, NB = null, SFXB = null, CHB = null, MIX = { sfx: 1, chain: 1 }, SINK = '';
const safe = (f) => { try { f(); } catch { /* son ignoré */ } };
export function unlock() {
  safe(() => {
    if (!C) {
      C = new (window.AudioContext || window.webkitAudioContext)();
      OUT = C.createGain(); OUT.gain.value = VOL;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; OUT.connect(comp).connect(C.destination);
      // deux sous-bus : effets (saut, pas, mécanismes…) et chaîne des grimpeurs, chacun avec son curseur
      SFXB = C.createGain(); SFXB.gain.value = MIX.sfx; SFXB.connect(OUT); CHB = C.createGain(); CHB.gain.value = MIX.chain; CHB.connect(OUT);
      if (SINK) safe(() => C.setSinkId?.(SINK));
      const len = C.sampleRate * 1.5; NB = C.createBuffer(1, len, C.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      wind();
    }
    if (C.state === 'suspended') C.resume();
  });
}
export function setVolume(v) { VOL = v; if (OUT) OUT.gain.value = v; }
// niveaux séparés (0..1) : effets et chaîne ; périphérique de sortie (setSinkId, Chrome / Edge)
export function setMix(sfx, chain) { MIX = { sfx, chain }; if (SFXB) SFXB.gain.value = sfx; if (CHB) CHB.gain.value = chain; }
export function setSink(id) { SINK = id || ''; if (C) safe(() => C.setSinkId?.(SINK)); }
export const canSink = () => typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
export const ctxState = () => C?.state || 'none';
export const ctx = () => (C && C.state === "running" ? C : null), bus = (kind) => (kind === 'chain' ? CHB : SFXB) || OUT; // pour les sons enregistrés spatialisés (sfx.js)
let NOW = null; // bus de destination du son synthétisé en cours (play() : chaîne ou effets)
const CHAINY = new Set(['rattle', 'jerk', 'creak']);
const pan = (x) => { const p = C.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x || 0)); p.connect(NOW || SFXB || OUT); return p; };
function noise(t0, dur, f, q, gain, type = 'bandpass', p = 0, f2) {
  const s = C.createBufferSource(); s.buffer = NB; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const bq = C.createBiquadFilter(); bq.type = type; bq.frequency.setValueAtTime(f, t0); if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + dur); bq.Q.value = q;
  const g = C.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bq).connect(g).connect(pan(p)); s.start(t0, Math.random() * 1); s.stop(t0 + dur + 0.05);
}
function tone(t0, f, dur, gain, type = 'sine', p = 0, f2) {
  const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = C.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(pan(p)); o.start(t0); o.stop(t0 + dur + 0.05);
}
// maillon métallique : partiels inharmoniques à décroissance rapide
function clink(t0, gain, p, base = 2400) { for (const [k, d] of [[1, 0.09], [2.76, 0.06], [5.4, 0.04], [8.9, 0.03]]) tone(t0, base * k * (0.96 + Math.random() * 0.08), d * (1 + Math.random() * 0.5), gain / k ** 0.6, 'sine', p); }
const last = {};
const gap = (k, s) => { const n = C.currentTime; if (last[k] && n - last[k] < s) return false; last[k] = n; return true; };
export function play(name, o = {}) {
  safe(() => {
    if (!C || C.state !== 'running') return;
    const t = C.currentTime, p = o.pan || 0, v = o.v ?? 1;
    NOW = CHAINY.has(name) ? CHB : SFXB;
    switch (name) {
      case 'step': if (gap('step' + (o.k || 0), 0.11)) { noise(t, 0.07, o.wood ? 900 : 1500, 1.4, 0.12 * v, 'bandpass', p); noise(t, 0.05, 260, 0.9, 0.09 * v, 'lowpass', p); } break;
      case 'jump': noise(t, 0.16, 700, 0.8, 0.12, 'bandpass', p, 2200); noise(t, 0.05, 300, 1, 0.1, 'lowpass', p); break;
      case 'land': { const g = Math.min(0.5, 0.12 + v * 0.025); noise(t, 0.16 + v * 0.01, 180, 0.8, g, 'lowpass', p); noise(t, 0.08, 1100, 1.2, g * 0.5, 'bandpass', p); if (v > 16) tone(t, 70, 0.3, g * 0.7, 'sine', p, 40); break; }
      case 'slide': noise(t, 0.5, 1200, 0.9, 0.11, 'bandpass', p, 350); noise(t, 0.2, 260, 0.8, 0.08, 'lowpass', p); break;
      case 'grab': noise(t, 0.06, 2600, 2, 0.16, 'bandpass', p); noise(t, 0.09, 500, 1, 0.14, 'lowpass', p); break;
      case 'mantle': noise(t, 0.2, 900, 0.7, 0.07, 'bandpass', p, 500); break;
      case 'rattle': if (gap('rattle', 0.07)) clink(t, 0.035 * v, p, 2000 + Math.random() * 1500); break;
      case 'jerk': { const g = Math.min(0.55, 0.15 + v * 0.04); for (let i = 0; i < 4; i++) clink(t + i * 0.012, g * (1 - i * 0.2), p, 1500 + i * 300); noise(t, 0.12, 900, 0.8, g * 0.5, 'bandpass', p); break; }
      case 'creak': if (gap('creak', 0.16)) { for (let i = 0; i < 3; i++) clink(t + i * 0.035, 0.03, p, 900 + Math.random() * 300); } break;
      case 'hit': noise(t, 0.2, 400, 0.7, 0.4, 'lowpass', p); tone(t, 180, 0.25, 0.25, 'triangle', p, 60); break;
      case 'crack': noise(t, 0.25, 1300, 1.5, 0.18, 'bandpass', p, 400); break;
      case 'collapse': noise(t, 0.6, 300, 0.6, 0.3, 'lowpass', p, 80); noise(t + 0.05, 0.35, 1600, 1, 0.12, 'bandpass', p); break;
      case 'checkpoint': [0, 4, 7, 12].forEach((s, i) => { const f = 523.25 * 2 ** (s / 12); tone(t + i * 0.09, f, 1.2, 0.09, 'sine'); tone(t + i * 0.09, f * 2.01, 0.7, 0.03, 'sine'); }); break;
      case 'save': [0, 7, 12].forEach((s, i) => tone(t + i * 0.07, 659.25 * 2 ** (s / 12), 0.8, 0.08, 'triangle')); break;
      case 'respawn': noise(t, 0.7, 400, 0.6, 0.12, 'bandpass', 0, 3000); tone(t + 0.1, 392, 0.9, 0.06, 'sine'); break;
      case 'finish': [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { const f = 392 * 2 ** (s / 12); tone(t + i * 0.11, f, 1.6, 0.08, 'triangle'); tone(t + i * 0.11, f * 1.5, 1.1, 0.03, 'sine'); }); break;
      case 'ui': tone(t, 880, 0.08, 0.05, 'triangle'); break;
      case 'swing': noise(t, 0.16, 900, 1.6, 0.16, 'bandpass', p, 2600); break; // souffle du poing
      case 'punch': tone(t, 140, 0.22, 0.55, 'sine', p, 42); noise(t, 0.09, 2400, 0.9, 0.5, 'bandpass', p); noise(t, 0.2, 320, 0.7, 0.45, 'lowpass', p); tone(t + 0.005, 520, 0.05, 0.18, 'square', p, 180); break; // impact sourd + claque
      case 'thud': noise(t, 0.28, 160, 0.7, 0.5, 'lowpass', p); tone(t, 90, 0.3, 0.35, 'sine', p, 40); noise(t + 0.09, 0.12, 700, 1, 0.12, 'bandpass', p); break; // corps qui tombe
      case 'ping': tone(t, 1320, 0.18, 0.12, 'sine', p); tone(t + 0.09, 1760, 0.26, 0.11, 'sine', p); break;
      case 'tick': tone(t, 740, 0.12, 0.16, 'triangle', p); break;
      case 'go': tone(t, 988, 0.35, 0.14, 'triangle', p); tone(t, 1480, 0.35, 0.1, 'sine', p); tone(t + 0.06, 1976, 0.3, 0.08, 'sine', p); break;
      case 'stop': tone(t, 330, 0.14, 0.2, 'square', p); tone(t + 0.17, 262, 0.2, 0.2, 'square', p); break;
      case 'portal': noise(t, 1.4, 300, 0.7, 0.25, 'bandpass', 0, 4200); [0, 5, 9, 12, 17].forEach((s, i) => tone(t + 0.1 + i * 0.08, 330 * 2 ** (s / 12), 1.6, 0.06, 'sine')); break;
    }
  });
}
// souffle de chute : un seul nœud, muet sauf pendant une chute rapide (pas de fond sonore permanent)
let WG = null, WF = null;
function wind() { const s = C.createBufferSource(); s.buffer = NB; s.loop = true; WF = C.createBiquadFilter(); WF.type = 'bandpass'; WF.Q.value = 0.6; WF.frequency.value = 500; WG = C.createGain(); WG.gain.value = 0; s.connect(WF).connect(WG).connect(SFXB || OUT); s.start(); }
export function fall(speed) { safe(() => { if (!WG) return; const k = Math.max(0, Math.min(1, (speed - 13) / 14)); WG.gain.setTargetAtTime(k * 0.22, C.currentTime, 0.12); WF.frequency.setTargetAtTime(400 + k * 900, C.currentTime, 0.2); }); }

/* ------------------------------ armes (mode crazy) : fusil à verrou Kar98k ------------------------------ */
// Synthèse en couches (pas d'échantillon) : claquement supersonique, souffle de bouche, coup sourd du grave, écho de l'espace, puis le métal de la culasse,
// la douille qui tinte, les cartouches qui glissent. Chaque son part d'une destination `out()` : distance (filtre passe-bas + atténuation + retard), panoramique, réverbération.
let REV = null;
function reverb() {
  if (REV) return REV;
  const sr = C.sampleRate, len = Math.floor(sr * 2.2), buf = C.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.5;
    // premières réflexions (murs proches) : quelques échos nets avant la queue diffuse
    for (const [ms, a] of [[23, 0.7], [41, 0.5], [67, 0.4], [113, 0.3]]) { const k = Math.floor(sr * (ms + ch * 7) / 1000); d[k] += a; d[k + 1] -= a * 0.5; }
  }
  const cv = C.createConvolver(); cv.buffer = buf; const g = C.createGain(); g.gain.value = 0.6; cv.connect(g).connect(SFXB || OUT); REV = cv; return cv;
}
function out(o = {}) {
  const dist = o.dist || 0, g = C.createGain(); g.gain.value = (o.v ?? 1) / (1 + dist / 16);
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(900, 17000 / (1 + dist / 28));
  const pn = C.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, o.pan || 0));
  g.connect(f).connect(pn).connect(SFXB || OUT);
  if (o.wet !== 0) { const w = C.createGain(); w.gain.value = o.wet ?? Math.min(0.75, 0.25 + dist / 140); f.connect(w).connect(reverb()); }
  return g;
}
function nb(t0, dur, f, q, gain, type, dest, att = 0.001, f2) {
  const s = C.createBufferSource(); s.buffer = NB; s.playbackRate.value = 0.85 + Math.random() * 0.3;
  const bq = C.createBiquadFilter(); bq.type = type; bq.frequency.setValueAtTime(f, t0); if (f2) bq.frequency.exponentialRampToValueAtTime(f2, t0 + dur); bq.Q.value = q;
  const g = C.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bq).connect(g).connect(dest); s.start(t0, Math.random() * 1); s.stop(t0 + dur + 0.05);
}
function tn(t0, f, dur, gain, type, dest, f2, att = 0.001) {
  const o = C.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = C.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
// métal qui cogne : partiels inharmoniques à décroissance rapide + un bruit de contact
function ring(t0, gain, dest, base = 2200, len = 1) {
  for (const [k, d] of [[1, 0.1], [2.32, 0.07], [4.1, 0.05], [6.7, 0.03]]) tn(t0, base * k * (0.97 + Math.random() * 0.06), d * len, gain / k ** 0.5, 'sine', dest);
  nb(t0, 0.012, 4200, 1.2, gain * 0.8, 'bandpass', dest, 0.0005);
}
export function gun(name, o = {}) {
  safe(() => {
    if (!C || C.state !== 'running') return;
    const dist = o.dist || 0, delay = Math.min(0.5, dist / 340), t = C.currentTime + delay, dest = out(o), v = o.v ?? 1;
    switch (name) {
      case 'shot': {
        // 7,92×57 : le claquement sec de l'onde de choc, le souffle large de la bouche, le coup de grave, puis l'écho de l'espace
        nb(t, 0.018, 3200, 0.6, 1.2, 'highpass', dest, 0.0004);
        nb(t, 0.09, 2600, 0.6, 0.8, 'bandpass', dest, 0.0005, 800);
        nb(t, 0.28, 320, 0.5, 1.1, 'lowpass', dest, 0.001, 110);
        tn(t, 180, 0.4, 1.0, 'sine', dest, 38, 0.002);
        nb(t + 0.004, 0.14, 1000, 0.8, 0.55, 'bandpass', dest, 0.002, 280);
        nb(t + 0.01, 0.5, 220, 0.4, 0.4, 'lowpass', dest, 0.02, 70);
        // écho lointain (falaises, entrepôts)
        nb(t + 0.26, 0.45, 700, 0.5, 0.2 * v, 'lowpass', dest, 0.03, 200); nb(t + 0.55, 0.5, 500, 0.5, 0.1 * v, 'lowpass', dest, 0.05, 150);
        break;
      }
      case 'whiz': nb(t, 0.16, 4200, 2.4, 0.4 * v, 'bandpass', dest, 0.02, 1400); nb(t + 0.01, 0.1, 6500, 1.2, 0.15 * v, 'highpass', dest, 0.01); break; // balle qui passe tout près
      case 'dry': ring(t, 0.1, dest, 900, 0.5); nb(t, 0.02, 1500, 1, 0.12, 'bandpass', dest, 0.001); break;
      case 'bolt_up': nb(t, 0.03, 1600, 1.5, 0.22, 'bandpass', dest); ring(t, 0.13, dest, 1700, 0.7); tn(t, 210, 0.05, 0.12, 'triangle', dest, 120); break;
      case 'bolt_back': nb(t - 0.1, 0.1, 2600, 1.4, 0.12, 'bandpass', dest, 0.02, 1100); ring(t, 0.22, dest, 1350); nb(t, 0.05, 700, 1, 0.2, 'lowpass', dest); break;
      case 'bolt_fwd': nb(t - 0.12, 0.12, 1100, 1.2, 0.13, 'bandpass', dest, 0.03, 2600); nb(t, 0.06, 600, 1, 0.24, 'lowpass', dest); ring(t, 0.12, dest, 1500, 0.7); break;
      case 'bolt_down': ring(t, 0.3, dest, 1050); nb(t, 0.05, 900, 0.8, 0.32, 'lowpass', dest); tn(t, 140, 0.07, 0.18, 'triangle', dest, 70); break;
      case 'casing': { // une douille laiton qui rebondit deux fois
        const k = 0.55 + Math.random() * 0.4;
        ring(t, 0.16 * v, dest, 5200 * k, 0.9); ring(t + 0.09, 0.09 * v, dest, 5000 * k, 0.8); ring(t + 0.15, 0.05 * v, dest, 4800 * k, 0.6); break;
      }
      case 'rl_open': gun('bolt_up', o); setTimeout(() => gun('bolt_back', o), 110); break;
      case 'rl_clip': // la lame-chargeur glisse dans les rails : frottement, claquement, ressort
        nb(t, 0.12, 2200, 1.2, 0.14, 'bandpass', dest, 0.02, 900); ring(t + 0.1, 0.15, dest, 2000, 0.8); ring(t + 0.16, 0.1, dest, 2600, 0.6); nb(t + 0.12, 0.05, 500, 1, 0.14, 'lowpass', dest); break;
      case 'rl_push': // le pouce enfonce les cinq cartouches : cinq petits claquements de plus en plus secs
        for (let i = 0; i < 5; i++) { ring(t + i * 0.075, 0.07 + i * 0.012, dest, 2300 + i * 140, 0.35); nb(t + i * 0.075, 0.03, 700, 1, 0.1, 'lowpass', dest); } break;
      case 'rl_close': gun('bolt_fwd', o); setTimeout(() => gun('bolt_down', o), 130); break;
      case 'hitmark': tn(t, 1500, 0.05, 0.22, 'square', dest, 900); if (o.head) { tn(t, 2300, 0.4, 0.28, 'sine', dest); tn(t, 3450, 0.3, 0.12, 'sine', dest); } break; // retour au tireur
      case 'flesh': // balle dans le corps : choc mat et clapotis humide
        nb(t, 0.12, 380, 0.7, 0.55 * v, 'lowpass', dest, 0.002); tn(t, 105, 0.16, 0.4 * v, 'sine', dest, 50); nb(t + 0.01, 0.1, 1500, 1.4, 0.2 * v, 'bandpass', dest, 0.005, 600); break;
      case 'bone': // tête : craquement sec, sourd, plus violent
        nb(t, 0.04, 2400, 0.9, 0.7 * v, 'bandpass', dest, 0.0005); nb(t, 0.14, 300, 0.6, 0.6 * v, 'lowpass', dest, 0.001); tn(t, 130, 0.2, 0.45 * v, 'sine', dest, 45); nb(t + 0.02, 0.08, 1100, 1.2, 0.2 * v, 'bandpass', dest, 0.004); break;
      case 'ringing': tn(t, 3300, 0.9, 0.05, 'sine', dest); break; // acouphène bref quand on est touché
      case 'fall': nb(t, 0.3, 200, 0.7, 0.55 * v, 'lowpass', dest, 0.004, 80); tn(t, 85, 0.35, 0.4 * v, 'sine', dest, 38); nb(t + 0.05, 0.25, 900, 0.6, 0.12 * v, 'bandpass', dest, 0.03, 300); break; // corps qui s'effondre
      case 'impact': nb(t, 0.04, 2800, 1, 0.3 * v, 'bandpass', dest, 0.0005); nb(t, 0.1, 500, 0.8, 0.25 * v, 'lowpass', dest, 0.001); if (o.metal) ring(t, 0.12 * v, dest, 3000, 0.8); break; // balle contre un mur
      case 'scope': ring(t, 0.05, dest, 3000, 0.3); nb(t, 0.08, 1800, 1, 0.05, 'bandpass', dest, 0.03, 600); break;
      case 'kill': tn(t, 440, 0.18, 0.12, 'triangle', dest); tn(t + 0.08, 660, 0.3, 0.12, 'triangle', dest); break;
    }
  });
}
