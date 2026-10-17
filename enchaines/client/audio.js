// Sons du jeu, synthétisés en Web Audio (maquettes en attendant de vrais enregistrements CC0) :
// pas, saut, réception, maillons qui cliquettent, chaîne qui se tend / claque, prise, effondrement, point de passage, sommet.
// Aucun bruit continu : le souffle de chute n'existe que pendant une chute rapide. Un son ne peut jamais casser le jeu (try/catch).
let C = null, OUT = null, VOL = 0.8, NB = null;
const safe = (f) => { try { f(); } catch { /* son ignoré */ } };
export function unlock() {
  safe(() => {
    if (!C) {
      C = new (window.AudioContext || window.webkitAudioContext)();
      OUT = C.createGain(); OUT.gain.value = VOL;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; OUT.connect(comp).connect(C.destination);
      const len = C.sampleRate * 1.5; NB = C.createBuffer(1, len, C.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      wind();
    }
    if (C.state === 'suspended') C.resume();
  });
}
export function setVolume(v) { VOL = v; if (OUT) OUT.gain.value = v; }
export const ctxState = () => C?.state || 'none';
export const ctx = () => (C && C.state === "running" ? C : null), bus = () => OUT; // pour les sons enregistrés spatialisés (sfx.js)
const pan = (x) => { const p = C.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x || 0)); p.connect(OUT); return p; };
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
    switch (name) {
      case 'step': if (gap('step' + (o.k || 0), 0.11)) { noise(t, 0.07, o.wood ? 900 : 1500, 1.4, 0.12 * v, 'bandpass', p); noise(t, 0.05, 260, 0.9, 0.09 * v, 'lowpass', p); } break;
      case 'jump': noise(t, 0.16, 700, 0.8, 0.12, 'bandpass', p, 2200); noise(t, 0.05, 300, 1, 0.1, 'lowpass', p); break;
      case 'land': { const g = Math.min(0.5, 0.12 + v * 0.025); noise(t, 0.16 + v * 0.01, 180, 0.8, g, 'lowpass', p); noise(t, 0.08, 1100, 1.2, g * 0.5, 'bandpass', p); if (v > 16) tone(t, 70, 0.3, g * 0.7, 'sine', p, 40); break; }
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
      case 'portal': noise(t, 1.4, 300, 0.7, 0.25, 'bandpass', 0, 4200); [0, 5, 9, 12, 17].forEach((s, i) => tone(t + 0.1 + i * 0.08, 330 * 2 ** (s / 12), 1.6, 0.06, 'sine')); break;
    }
  });
}
// souffle de chute : un seul nœud, muet sauf pendant une chute rapide (pas de fond sonore permanent)
let WG = null, WF = null;
function wind() { const s = C.createBufferSource(); s.buffer = NB; s.loop = true; WF = C.createBiquadFilter(); WF.type = 'bandpass'; WF.Q.value = 0.6; WF.frequency.value = 500; WG = C.createGain(); WG.gain.value = 0; s.connect(WF).connect(WG).connect(OUT); s.start(); }
export function fall(speed) { safe(() => { if (!WG) return; const k = Math.max(0, Math.min(1, (speed - 13) / 14)); WG.gain.setTargetAtTime(k * 0.22, C.currentTime, 0.12); WF.frequency.setTargetAtTime(400 + k * 900, C.currentTime, 0.2); }); }
