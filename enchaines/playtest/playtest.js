// LES ENCHAÎNÉS — MODE PLAYTEST PRIVÉ. Ce fichier n'est JAMAIS servi comme fichier statique : le serveur de jeu le remet seulement
// au client qui présente la clé ENCH_PT_KEY (?pt=CLÉ dans l'adresse). Il reçoit l'API du client (pas d'import : chargé depuis un Blob).
// Fonctions : panneau (F9) — tous les mondes et parcours (même non publiés), points de passage, IA du partenaire, échange des commandes,
// téléporter / faire sauter / s'arc-bouter le partenaire, anti-chute, ralenti, collisions et infos physiques, état musique et caméra.
// Pour le retirer : supprimer ENCH_PT_KEY du service (le serveur refuse alors toute demande) et ce fichier. Voir CLAUDE.md.
export default function install(API) {
  const { G, Sim, Worlds, Scene, Music, toast, startLocal, keys, fmt, Mechs, Sfx } = API;
  const { ST, groundBelow, windAt, layChain, spawnAt, IDLE } = Sim;
  const T = (G.pt = Object.assign(G.pt || {}, { ai: true, swap: false, speed: 1, hold: false, alone: new URLSearchParams(location.search).has('solo') })); // ?pt=CLÉ&solo : mode solo d'emblée

  /* ---------------- IA du partenaire : suit, saute avec vous, vous retient, remonte la chaîne ---------------- */
  const mem = { jc: 0, dc: 0, uc: 0, stuck: 0, lastX: 0 };
  function ai(W, k, lead) {
    const me = W.pl[k], other = W.pl[1 - k];
    if (T.hold) return { ...IDLE, jc: mem.jc, dc: mem.dc, uc: mem.uc, brace: true };
    const dx = other.x - me.x, dz = other.z - me.z, d = Math.hypot(dx, dz), dy = other.y - me.y;
    let mx = 0, mz = 0, jump = false, brace = false;
    // le meneur pend dans le vide : on s'arc-boute
    if (other.dangling && me.st === ST.GROUND) return { ...IDLE, brace: true, jc: mem.jc, dc: mem.dc, uc: mem.uc };
    // on pend soi-même : on remonte la chaîne en poussant vers le meneur
    if (me.dangling) return { ...IDLE, mx: dx / (d || 1), mz: dz / (d || 1), brace: true, jc: mem.jc, dc: mem.dc, uc: mem.uc };
    if (me.st === ST.ROPE) { if (d < 3 || dy > 1) mem.jc++; return { ...IDLE, mx: dx / (d || 1), mz: dz / (d || 1), jc: mem.jc, dc: mem.dc, uc: mem.uc, jump: true }; }
    if (me.st === ST.HANG || me.st === ST.CLIMB) { const w = { ...IDLE, mx: dx / (d || 1), mz: dz / (d || 1), jc: mem.jc, dc: mem.dc, uc: mem.uc }; if (me.st === ST.HANG && me.stT > 0.4) { mem.jc++; w.jc = mem.jc; w.jump = true; } return w; }
    // rafale au sol : on tient
    const wa = windAt(W, me.x, me.y + 1, me.z); if (me.st === ST.GROUND && wa.g >= 1 && Math.hypot(wa.x, wa.z) > 10) return { ...IDLE, brace: true, jc: mem.jc, dc: mem.dc, uc: mem.uc };
    if (d > 1.8 || dy > 1.2) { mx = dx / (d || 1); mz = dz / (d || 1); }
    if (me.st === ST.GROUND) {
      const ahead = groundBelow(W, me.x + mx * 0.5, me.y + 0.05, me.z + mz * 0.5, 0.5);
      const leaderJumped = other.st === ST.AIR && other.vy > 2 && other.stT < 0.25;
      if ((!ahead && (mx || mz)) || (dy > 0.6 && d < 3.5) || (leaderJumped && d > 1.5)) { mem.jc++; jump = true; }
      // coincé contre un obstacle : on saute
      if (Math.abs(me.x - mem.lastX) < 0.002 && (mx || mz)) { if (++mem.stuck > 50) { mem.jc++; jump = true; mem.stuck = 0; } } else mem.stuck = 0;
      mem.lastX = me.x;
    } else jump = me.vy > 0;
    return { mx, mz, jump, brace, jc: mem.jc, dc: mem.dc, uc: mem.uc, reset: false };
  }
  // entrées du mode local : le clavier 1 pilote le grimpeur choisi, l'autre est l'IA (ou le clavier 2 si l'IA est coupée)
  T.inputs = (W, inA, inB) => {
    if (G.mode !== 'local') return [inA, inB];
    if (W.alone) return [inA, IDLE]; // mode solo : le clavier 1 pilote le seul grimpeur
    const human = T.swap ? 1 : 0, bot = 1 - human, mine = inA;
    const other = T.ai ? ai(W, bot, human) : inB;
    return human === 0 ? [mine, other] : [other, mine];
  };

  /* ---------------- panneau ---------------- */
  const css = document.createElement('style'); css.textContent = `
    #pt { position: fixed; right: 12px; top: 64px; z-index: 30; width: 330px; max-height: calc(100vh - 80px); overflow: auto; background: rgba(24,18,40,.92); color: #fff; border-radius: 14px; padding: 10px 12px; font: 700 13px Nunito, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,.4); display: none; }
    #pt.on { display: block; } #pt h4 { margin: 8px 0 4px; font: 900 12px Nunito; letter-spacing: .1em; text-transform: uppercase; color: #b9a6ff; }
    #pt button { font: 800 12px Nunito; padding: 4px 8px; margin: 2px; border-radius: 8px; border: 0; background: #fff; color: #2a1d18; cursor: pointer; box-shadow: none; }
    #pt button.on { background: #7be08c; } #pt .row2 { display: flex; flex-wrap: wrap; } #pt pre { white-space: pre-wrap; font: 11px ui-monospace, monospace; margin: 4px 0 0; color: #dcd4ff; }
    #ptbadge { position: fixed; left: 50%; top: 4px; transform: translateX(-50%); z-index: 31; background: #6a3cff; color: #fff; font: 900 12px Nunito; padding: 2px 10px; border-radius: 0 0 10px 10px; letter-spacing: .15em; pointer-events: none; }`;
  document.head.appendChild(css);
  const badge = document.createElement('div'); badge.id = 'ptbadge'; badge.textContent = 'PLAYTEST · F9'; document.body.appendChild(badge);
  const P = document.createElement('div'); P.id = 'pt'; document.body.appendChild(P);
  const btn = (label, fn, on) => { const b = document.createElement('button'); b.textContent = label; if (on) b.classList.add('on'); b.onclick = (e) => { e.stopPropagation(); fn(); render(); }; return b; };
  const sec = (title) => { const h = document.createElement('h4'); h.textContent = title; P.appendChild(h); const r = document.createElement('div'); r.className = 'row2'; P.appendChild(r); return r; };
  function render() {
    P.innerHTML = '';
    let r = sec('Parcours (tous, publiés ou non)');
    for (const c of Worlds.courseList(true)) r.appendChild(btn(`${c.name}${c.published ? '' : ' •'}`, () => { G.course = c.id; if (G.mode) { G.mode = null; } startLocal(); }, G.course === c.id));
    if (G.W && G.mode === 'local') {
      r = sec('Points de passage');
      G.W.level.checkpoints.forEach((c, i) => r.appendChild(btn(`${i + 1}. ${c.name || ''}`, () => G.tp(i), G.W.cp === i)));
      r = sec('Mode solo');
      r.appendChild(btn(T.alone ? 'Solo SANS chaîne : activé (retour à deux)' : 'Jouer seul, sans chaîne ni partenaire', () => { T.alone = !T.alone; G.W.alone = T.alone; if (!T.alone) { const [A, B] = G.W.pl; Object.assign(B, { x: A.x - 1, y: A.y + 0.3, z: A.z, vx: 0, vy: 0, vz: 0, st: ST.AIR }); layChain(G.W); } toast(T.alone ? 'Mode solo : un seul grimpeur, sans chaîne (les plaques comptent pour deux)' : 'Retour à deux'); }, T.alone));
      r = sec('Partenaire');
      r.appendChild(btn('IA ' + (T.ai ? 'activée' : 'coupée (clavier 2)'), () => { T.ai = !T.ai; }, T.ai));
      r.appendChild(btn('Je joue J' + (T.swap ? 2 : 1) + ' (Tab)', () => { T.swap = !T.swap; }, T.swap));
      r.appendChild(btn('Le téléporter près de moi (T)', tpMate));
      r.appendChild(btn('Le faire sauter (J)', () => { mem.jc++; }));
      r.appendChild(btn('Le figer arc-bouté (K)', () => { T.hold = !T.hold; }, T.hold));
      // mécanismes du parcours : chaque herse / porte / pilon et chaque pont-levis, testables dans tous leurs états
      const hs = G.W.bodies.filter((b) => b.herse), brs = [...new Set(G.W.bodies.filter((b) => b.dbseg).map((b) => b.dbseg.id))];
      if (hs.length || brs.length) {
        r = sec('Mécanismes');
        const go = (x, y, z) => { const W = G.W, [A, B] = W.pl; Object.assign(A, { x: x - 2, y: y + 0.5, z, vx: 0, vy: 0, vz: 0, st: ST.AIR }); Object.assign(B, { x: x - 3.6, y: y + 0.5, z, vx: 0, vy: 0, vz: 0, st: ST.AIR }); layChain(W); };
        const name = (b) => ({ iron: 'Herse', wood: 'Porte', stone: 'Pilon' }[b.look] || 'Herse') + ' x' + Math.round(b.px) + ' (' + b.herse.mode + ')';
        for (const b of hs) {
          const set = (ph, o) => { G.W.hs[b.i] = { ph, t: 0, v: 0, jam: 0 }; G.W.dr[b.i] = o; };
          const row = document.createElement('div'); row.className = 'row2'; row.append(Object.assign(document.createElement('b'), { textContent: name(b) + ' ', style: 'width:100%;font-size:12px' }));
          row.append(btn('aller', () => go(b.px, b.y - b.hh, b.pz)), btn('ouvrir', () => set(Sim.HP.OPEN, 1)), btn('fermer', () => set(Sim.HP.SHUT, 0)), btn('déclencher', () => set(Sim.HP.WARN, G.W.dr[b.i] ?? 1)), btn('remonter', () => set(Sim.HP.RISE, G.W.dr[b.i] ?? 0)));
          P.appendChild(row);
        }
        for (const id of brs) {
          const s0 = G.W.bodies.find((b) => b.dbseg?.id === id), ids = s0.dbseg.ctl.open;
          const row = document.createElement('div'); row.className = 'row2'; row.append(Object.assign(document.createElement('b'), { textContent: 'Pont-levis « ' + id + ' » ', style: 'width:100%;font-size:12px' }));
          row.append(btn('aller', () => go(s0.dbseg.hx - s0.dbseg.side * 2.5, s0.dbseg.top, s0.pz)), btn('abaisser', () => ids.forEach((i) => (G.W.sw[i] = true))), btn('relever', () => ids.forEach((i) => (G.W.sw[i] = false))),
            btn('à plat tout de suite', () => { ids.forEach((i) => (G.W.sw[i] = true)); G.W.db[id].a = 0; }));
          P.appendChild(row);
        }
        r = sec(''); r.appendChild(btn('Réinitialiser tous les mécanismes', () => Sim.resetMechanisms(G.W)));
      }
      r = sec('Physique');
      r.appendChild(btn('Anti-chute ' + (G.W.noAbyss ? 'ON' : 'OFF'), () => { G.W.noAbyss = !G.W.noAbyss; }, G.W.noAbyss));
      r.appendChild(btn('Ralenti x0,25', () => { T.speed = T.speed === 1 ? 0.25 : 1; }, T.speed !== 1));
      r.appendChild(btn('Collisions (F3)', () => { G.debug = !G.debug; }, G.debug));
      r.appendChild(btn('Réapparaître ici', () => { spawnAt(G.W, G.W.cp); Scene.onEvent(G.W, { k: 'respawn' }); }));
      r.appendChild(btn('Relancer le parcours', () => startLocal()));
      r.appendChild(btn('Finir le parcours', () => { const f = G.W.level.checkpoints.length - 1; G.tp(f); }));
    }
    const pre = document.createElement('pre'); pre.id = 'ptinfo'; P.appendChild(pre);
  }
  function tpMate() {
    const W = G.W; if (!W) return; const human = T.swap ? 1 : 0, me = W.pl[human], o = W.pl[1 - human];
    Object.assign(o, { x: me.x + 0.8, y: me.y + 0.3, z: me.z, vx: 0, vy: 0, vz: 0, st: ST.AIR, hang: null, climb: null, rope: null, mantle: null }); layChain(W);
  }
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'F9') { e.preventDefault(); P.classList.toggle('on'); render(); }
    if (!G.W || G.mode !== 'local') return;
    if (e.code === 'Tab') { T.swap = !T.swap; toast('Vous jouez le grimpeur ' + (T.swap ? 2 : 1)); render(); }
    if (e.code === 'KeyT' && !e.repeat) tpMate();
    if (e.code === 'KeyJ' && !e.repeat) mem.jc++;
    if (e.code === 'KeyK' && !e.repeat) { T.hold = !T.hold; render(); }
  });
  setInterval(() => {
    const el = document.getElementById('ptinfo'); if (!el || !P.classList.contains('on') || !G.W) return;
    const W = G.W, ms = Music.state();
    el.textContent = `${W.level.name} · monde ${W.level.world} · temps ${fmt(W.time)}\ncaméra : ${Scene.camMode()} · musique : ${ms.music || '—'} (vol ${ms.vol.toFixed(2)})\n` +
      W.pl.map((p, k) => `J${k + 1} ${['sol', 'air', 'rebord', 'paroi', 'hisse', 'liane'][p.st]} x${p.x.toFixed(1)} y${p.y.toFixed(1)} z${p.z.toFixed(1)} v${Math.hypot(p.vx, p.vz).toFixed(1)} end ${p.sta.toFixed(2)}${p.dangling ? ' PEND' : ''}${p.brace ? ' ARC' : ''}`).join('\n') +
      `\nchaîne ${W.Lc.toFixed(2)}/${W.L} tension ${W.ten.toFixed(2)} · chutes ${W.falls} · sauvetages ${W.saves}\nleviers/plaques ${JSON.stringify(W.sw)}` +
      `\n${Mechs?.describe(W) || ''}\nsons enregistrés chargés : ${Sfx?.ready() ?? 0}`;
  }, 250);
  T.onStart = () => { if (G.W && T.alone) G.W.alone = true; render(); };
  render();
}
