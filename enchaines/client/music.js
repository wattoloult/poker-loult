// LES ENCHAÎNÉS — musique et ambiance de chaque monde, en fondu enchaîné (jamais de coupure brutale).
// Fichiers configurables ci-dessous (CC0, voir ASSET_CREDITS.md) ; un fichier absent est simplement ignoré (silence, message en console).
const TRACKS = {
  medieval: { music: 'music/medieval.mp3', amb: 'amb/medieval.mp3' }, jungle: { music: 'music/jungle.mp3', amb: 'amb/jungle.mp3' },
  japan: { music: 'music/japan.mp3', amb: 'amb/japan.mp3' }, deep: { music: 'music/deep.mp3', amb: 'amb/deep.mp3' },
  sky: { music: 'music/sky.mp3', amb: 'amb/sky.mp3' }, mech: { music: 'music/mech.mp3', amb: 'amb/mech.mp3' },
  ice: { music: 'music/ice.mp3', amb: 'amb/ice.mp3' }, summit: { music: 'music/summit.mp3', amb: 'amb/summit.mp3' },
};
const BASE = new URL('../assets/', import.meta.url), FADE = 2.5;
const M = { cur: null, music: null, amb: null, vMusic: 0.45, vAmb: 0.5, k: 1, unlocked: false, want: null };
function el(src, loop = true) { const a = new Audio(new URL(src, BASE).href); a.loop = loop; a.volume = 0; a.preload = 'auto'; a.onerror = () => console.info('[musique] fichier absent :', src); return a; }
function fadeTo(a, v, sec, done) {
  if (!a) return; clearInterval(a._f); const v0 = a.volume, t0 = performance.now();
  a._f = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 1000 / sec); try { a.volume = Math.max(0, Math.min(1, v0 + (v - v0) * k)); } catch { } if (k >= 1) { clearInterval(a._f); done?.(); } }, 50);
}
// passe en douceur à la musique et à l'ambiance d'un monde (ou au silence avec null)
export function playWorld(world) {
  M.want = world; if (!M.unlocked || M.cur === world) return;
  const old = [M.music, M.amb]; for (const a of old) if (a) fadeTo(a, 0, FADE, () => a.pause());
  M.cur = world; M.music = M.amb = null;
  const t = TRACKS[world]; if (!t) return;
  M.music = el(t.music); M.amb = el(t.amb);
  for (const [a, v] of [[M.music, M.vMusic], [M.amb, M.vAmb]]) { a.play().then(() => fadeTo(a, v * M.k, FADE)).catch(() => {}); }
}
// résolu quand musique et ambiance du monde sont jouables sans coupure (ou après ms)
export function ready(ms = 6000) {
  const els = [M.music, M.amb].filter(Boolean);
  const all = Promise.all(els.map((a) => (a.readyState >= 3 ? 1 : new Promise((r) => { a.addEventListener('canplaythrough', r, { once: true }); a.addEventListener('error', r, { once: true }); }))));
  return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}
export function unlock() { if (M.unlocked) return; M.unlocked = true; if (M.want) { const w = M.want; M.cur = null; playWorld(w); } }
// curseur Volume des options (0.8 = réglage d'origine) : s'applique aussi à la musique et à l'ambiance (éléments <audio>, hors du bus Web Audio)
export function setMaster(vol) { M.k = vol / 0.8; if (M.music) fadeTo(M.music, M.vMusic * M.k, 0.2); if (M.amb) fadeTo(M.amb, M.vAmb * M.k, 0.2); }
export const state = () => ({ world: M.cur, music: M.music && !M.music.paused ? M.music.src.split('/').pop() : null, vol: M.music?.volume ?? 0 });
