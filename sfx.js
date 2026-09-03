/* ============================================================
   POKER LOULT — SFX (Web Audio, synthétisés, zéro fichier)
   Sons de cartes / jetons / gains. Volume piloté par le réglage global.
   Remplaçables plus tard par un vrai pack : SFX.play('deal') pourra
   lire un <audio> si on ajoute des fichiers.
   ============================================================ */
window.SFX = (function () {
  let ctx = null, master = 0.25, muted = false;
  function ensure() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function setVolume(v) { master = Math.max(0, Math.min(1, v)); }
  function setMuted(m) { muted = m; }
  function gvol(g) { return (muted ? 0 : master) * g; }

  function noiseBuf(dur) {
    const c = ctx, b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  // glissement de carte : bruit filtré passe-bande
  function deal() {
    const c = ensure(); if (!c) return;
    const s = c.createBufferSource(); s.buffer = noiseBuf(0.16);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600 + Math.random() * 500; bp.Q.value = 0.8;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.5), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.17);
  }
  // jetons : deux petits clics aigus
  function chip() {
    const c = ensure(); if (!c) return;
    [0, 0.045].forEach(off => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 2300 + Math.random() * 500;
      const g = c.createGain(); const t = c.currentTime + off;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.22), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.06);
    });
  }
  // check : petit toc grave
  function check() {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 300;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.25), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.13);
  }
  // gain de main : petit arpège
  function win() {
    const c = ensure(); if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = c.createGain(); const t = c.currentTime + i * 0.085;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.3), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.3);
    });
  }
  // carte qui se retourne : souffle filtré descendant, doux
  function flip() {
    const c = ensure(); if (!c) return;
    const s = c.createBufferSource(); s.buffer = noiseBuf(0.24);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    const t = c.currentTime;
    bp.frequency.setValueAtTime(2700, t); bp.frequency.exponentialRampToValueAtTime(850, t + 0.22);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.42), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.25);
  }
  // tic-tac du timer d'action (dernières secondes) : clic sec et aigu
  function tick() {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1800;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.2), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.05);
  }
  // gifle : claquement sec (bruit filtré passe-bas, très courte attaque/chute)
  function slap() {
    const c = ensure(); if (!c) return;
    const s = c.createBufferSource(); s.buffer = noiseBuf(0.09);
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.5), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(bp); bp.connect(g); g.connect(c.destination); s.start(t); s.stop(t + 0.1);
  }
  // tension : rivière qui renverse le gagnant -> note grave qui descend, tenue, avant le retournement ralenti
  function tension() {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(); o.type = 'sine'; const t = c.currentTime;
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.9);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gvol(0.35), t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 1.05);
  }
  const map = { deal, chip, check, win, flip, tick, slap, tension };

  /* Pack de fichiers optionnel : dépose sfx/deal.mp3, sfx/chip.mp3, sfx/check.mp3,
     sfx/win.mp3 (ou .ogg/.wav) et ils remplaceront automatiquement la synthèse. */
  const files = {}; // name -> HTMLAudioElement prêt (fichiers réels fournis par le user)
  // tous les fichiers réels vivent dans sfx/ (dossier dédié, séparé de assets/ qui ne contient que des images)
  const FILE_SRC = { deal: 'sfx/givecards.mp3', flip: 'sfx/card-flip.mp3', chip: 'sfx/placingchips.mp3', check: 'sfx/check.wav', fold: 'sfx/fold.wav', yourturn: 'sfx/yourturn.wav', miser: 'sfx/miser.wav', allbets: 'sfx/allbets.wav', wow: 'sfx/wow.wav', win: 'sfx/win.mp3', allin: 'sfx/allin.mp3', slap: 'sfx/slap.wav', pokerloult: 'sfx/pokerloult.mp3' }; // 'crowd' (crowd_gasp.mp3) retiré : remplacé partout par 'wow'
  Object.entries(FILE_SRC).forEach(([name, src]) => {
    const a = new Audio(); a.src = src; a.preload = 'auto';
    a.addEventListener('canplaythrough', () => { files[name] = a; }, { once: true });
    a.addEventListener('error', () => { }, { once: true }); // absent -> repli synthèse
  });
  const playing = {}; // name -> true tant qu'une instance est en cours (pour les sons qui ne doivent jamais se chevaucher/relancer)
  const NO_OVERLAP = new Set(['win']); // ex : le son de victoire ne doit pas relancer par-dessus lui-même tant qu'il joue
  // volume natif d'un <audio> plafonné à 1 -> pour aller AU-DELÀ (vraiment fort), on route via un GainNode
  // Web Audio (seul moyen d'amplifier au-dessus de l'unité) au lieu du simple c.volume=master des autres sons.
  const BOOST = { pokerloult: 4 };
  function play(name) {
    if (muted) return;
    if (NO_OVERLAP.has(name) && playing[name]) return; // déjà en cours -> on ne relance pas
    const a = files[name];
    if (a) {
      try {
        const c = a.cloneNode();
        const boost = BOOST[name], c2 = boost && ensure();
        if (c2) { c.volume = 1; const src = c2.createMediaElementSource(c); const g = c2.createGain(); g.gain.value = gvol(boost); src.connect(g); g.connect(c2.destination); }
        else c.volume = master;
        if (NO_OVERLAP.has(name)) { playing[name] = true; c.addEventListener('ended', () => { playing[name] = false; }, { once: true }); }
        c.play().catch(() => { playing[name] = false; });
        return;
      } catch (e) { }
    }
    try { (map[name] || (() => { }))(); } catch (e) { } // repli : synthèse
  }
  return { ensure, setVolume, setMuted, play };
})();
