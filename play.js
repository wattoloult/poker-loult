/* ============================================================
   POKER LOULT — CLIENT (accueil / lobby / rooms / jeu)
   Afficheur mince : le serveur est la source de vérité.
   ============================================================ */
'use strict';
const $ = (s) => document.querySelector(s);
const EV = window.PokerEval;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* identité */
let token = localStorage.getItem('pl_token');
if (!token) { token = 'p-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pl_token', token); }
let pseudo = localStorage.getItem('pl_name') || ('Loult' + Math.floor(Math.random() * 900 + 100));

let snap = null, timeOffset = 0, awaiting = false, ws = null, currentScreen = 'landing', lastPot = 0, lastActionSeq = -1, lastCurrentBet = 0, preAction = null, lastMyTurn = false;
const showCard = [false, false], shownCard = [false, false];   // SHOW par carte : armée / déjà envoyée
const viewerShows = () => showCard[0] || showCard[1] || shownCard[0] || shownCard[1];
const checkedSeats = new Set(); let lastStreet = null, lastCheckHand = -1;   // tag "CHECK" par siège

/* ---------- chat de messages préfaits (identique au serveur) ---------- */
const CHAT_PRESETS = ['Bien joué !', 'GG', 'Bluff ?', 'All-in !', 'Trop fort', 'Chanceux…', 'Allez !', 'Aïe 😬', 'Nice 😎', 'Mdr 😂', 'Bien tenté', 'Merci !'];
const chatTimers = {};
function initChat() {
  const menu = $('#chat-menu');
  CHAT_PRESETS.forEach((txt, i) => { const b = document.createElement('button'); b.textContent = txt; b.onclick = (e) => { e.stopPropagation(); send({ type: 'chat', i }); menu.hidden = true; }; menu.appendChild(b); });
  $('#btn-chat').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
}
function showChat(seat, text) {
  const el = seatEls[seat]; if (!el) return;
  const b = el.querySelector('.chat-bubble'); if (!b) return;
  b.textContent = text; b.hidden = false;
  clearTimeout(chatTimers[seat]); chatTimers[seat] = setTimeout(() => { b.hidden = true; }, 3000);
}

/* ---------- emotes animées (cigare pour l'instant) ---------- */
// 12 réactions Watto : chacune un vrai PNG séparé (assets/emote_<id>.png, découpé par slice_watto.py depuis
// setemojiwatto.png) -> plus simple et plus fiable qu'un sprite-sheet + background-position à calculer.
const EMOTES = [
  { id: 'cigare', label: 'Cigare' },   // vignette = 1ère frame de assets/cigare_frames.png (cas spécial, voir emoteThumb)
  { id: 'cafe', label: 'Café' },       // idem, assets/cafe_frames.png
  { id: 'pistolet', label: 'Pistolet' }, // idem, assets/colt_frames.png ; nécessite une CIBLE (voir initEmote/onSeatClickForPistol)
  { id: 'baffe', label: 'Baffe' },       // idem, assets/baffe_frames.png ; nécessite une CIBLE aussi
  { id: 'gossip', label: 'Ragot' },      // idem, assets/gossip_frames.png
  { id: 'w-relax', label: 'Zen' },
  { id: 'w-cheer', label: 'Hourra' },
  { id: 'w-cool', label: 'Cool' },
  { id: 'w-angry', label: 'Énervé' },
  { id: 'w-sleep', label: 'Dodo' },
  { id: 'w-love', label: 'Love' },
  { id: 'w-think', label: 'Hein ?' },
  { id: 'w-sweat', label: 'Stress' },
  { id: 'w-card', label: 'Carte' },
  { id: 'w-throw', label: 'Jette' },
  { id: 'w-chips', label: 'Jetons' },
  { id: 'w-shrug', label: 'Bof' },
];
let emoteCooldown = 0;
// vignette cliquable de la puce menu : l'ASSET réel, pas juste le texte
function emoteThumb(em) {
  const el = document.createElement('i'); el.className = 'emote-thumb';
  // MÊME boîte pour toutes les vignettes ; réduite sur téléphone, sinon la grille déborde de l'écran.
  // La taille DOIT être décidée ici (et pas en CSS) : background-size en dépend, la forcer ailleurs
  // décalerait le sprite dans sa boîte.
  const BOX = window.matchMedia('(max-width:560px)').matches ? 62 : 88;
  el.style.width = BOX + 'px'; el.style.height = BOX + 'px';
  if (em.id === 'cigare' || em.id === 'cafe' || em.id === 'pistolet' || em.id === 'baffe' || em.id === 'gossip') {
    // 1ère frame mise à l'échelle sur la largeur de la boîte -> lettrboxée verticalement (pas déformée, pas rognée)
    const SHEET = { cigare: [16, 199, 79], cafe: [24, 336, 336], pistolet: [10, 432, 355], baffe: [5, 375, 403], gossip: [16, 484, 356] }[em.id];
    const [FRAMES, FW, FH] = SHEET, s = BOX / FW, fh = FH * s;
    el.style.backgroundImage = `url('assets/${em.id === 'pistolet' ? 'colt' : em.id}_frames.png')`;
    el.style.backgroundSize = (BOX * FRAMES) + 'px ' + fh + 'px';
    el.style.backgroundPosition = '0 ' + Math.round((BOX - fh) / 2) + 'px'; // centrée verticalement dans la boîte
  } else {
    el.style.backgroundImage = `url('assets/emote_${em.id}.png')`;
    el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center';
  }
  return el;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (pistolPicking || pistolPendingTarget != null)) pistolCancel(); });
function initEmote() {
  const menu = $('#emote-menu');
  EMOTES.forEach(em => {
    const b = document.createElement('button'); b.title = em.label; b.appendChild(emoteThumb(em));
    if (TARGETED_EMOTES.has(em.id)) {
      // nécessite une CIBLE : soit déjà pré-sélectionnée (clic joueur -> clic emote), soit on arme le
      // mode "clique sur un joueur" (clic emote -> clic joueur) — voir onSeatClickForPistol.
      b.onclick = (e) => {
        e.stopPropagation(); menu.hidden = true;
        if (pistolPendingTarget != null) { const t = pistolPendingTarget; pistolCancel(); sendTargetedEmote(em.id, t); }
        else { pistolPicking = em.id; toast('Clique sur le joueur à viser…'); }
      };
    } else {
      b.onclick = (e) => { e.stopPropagation(); sendEmote(em.id); menu.hidden = true; };
    }
    menu.appendChild(b);
  });
  $('#btn-emote').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
}
function sendEmote(id) {
  const now = Date.now();
  if (now < emoteCooldown) { toast('Emote en recharge…'); return; }
  emoteCooldown = now + 5000;                 // cooldown 5s (le serveur l'applique aussi)
  console.log('[emote] envoi', id);
  send({ type: 'emote', emote: id });
}
function playEmote(seat, emote, target) {
  console.log('[emote] reçu seat=', seat, 'emote=', emote, 'target=', target);
  if (emote === 'cigare') { playCigare(seat); return; }
  if (emote === 'cafe') { playCafe(seat); return; }
  if (emote === 'gossip') { playGossip(seat); return; }
  if (emote === 'pistolet') { playPistolet(seat, target); return; }
  if (emote === 'baffe') { playBaffe(seat, target); return; }
  if (EMOTES.some(e => e.id === emote)) playWattoEmote(seat, emote);
  else console.log('[emote] id inconnu côté client !', emote);
}
// réaction Watto : INDÉPENDANTE de l'avatar, flotte AU-DESSUS de tout le pod (pas confinée dans le rond de
// l'avatar), entière (contain, pas de recadrage), tient 3s, s'efface
const EMOTE_ASPECT = 440 / 395; // crops slice_watto2.py (canvas commun, voir taille écrite par le script)
function playWattoEmote(seat, id) {
  const seatEl = seatEls[seat]; if (!seatEl) { console.log('[emote] pas de seatEl pour seat', seat); return; }
  const avatar = seatEl.querySelector('.avatar'); if (!avatar) { console.log('[emote] pas de .avatar dans le seat', seat); return; }
  const av = avatar.getBoundingClientRect(); if (!av.width) { console.log('[emote] avatar largeur 0 (pas encore rendu ?), seat', seat); return; }
  console.log('[emote] affichage OK, seat', seat, 'id', id, 'avatar=', av);
  // DEVANT l'avatar du joueur (pas au centre de la table) : ancré sur l'avatar lui-même, pas sur tout le pod
  // (le pod entier remonte trop haut pour le siège du bas -> ça finissait visuellement sur le pot).
  const w = Math.max(66, av.width * 1.5), h = w / EMOTE_ASPECT;
  const el = document.createElement('div'); el.className = 'watto-emote';
  el.style.width = w + 'px'; el.style.height = h + 'px';
  el.style.backgroundImage = `url('assets/emote_${id}.png')`;
  el.style.backgroundSize = 'contain'; el.style.backgroundPosition = 'center';
  el.style.left = (av.left + av.width / 2 - w / 2) + 'px';
  el.style.top = (av.top + av.height * 0.5 - h) + 'px'; // centré sur l'avatar, débordant surtout vers le haut (devant lui, pas au-dessus de tout le pod)
  el.style.opacity = '0'; el.style.transform = 'scale(.6)';
  document.body.appendChild(el);
  void el.offsetWidth; // force le rendu initial avant de transitionner (sinon le navigateur peut fusionner les deux états)
  el.style.transition = 'opacity .22s cubic-bezier(.3,1.6,.5,1), transform .22s cubic-bezier(.3,1.6,.5,1)';
  el.style.opacity = '1'; el.style.transform = 'scale(1)';
  setTimeout(() => {
    el.style.transition = 'opacity .35s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 380);
  }, 3000);
}
// cigare : spawn au centre du plateau -> glisse jusqu'au coin de la bouche (ralenti, penché "de travers"),
// puis se consume frame par frame (~6s) avec un FONDU entre chaque frame (2 calques crossfade -> plus fluide
// que le cru "saut" d'une frame à l'autre, sans avoir besoin de plus d'art source).
function playCigare(seat) {
  const seatEl = seatEls[seat]; if (!seatEl) return;
  const avatar = seatEl.querySelector('.avatar'), board = $('#board'); if (!avatar || !board) return;
  const av = avatar.getBoundingClientRect(), bd = board.getBoundingClientRect();
  if (!av.width || !bd.width) return;
  const FRAMES = 16;                                                 // cigare_frames.png : 16 frames horizontales de 199x79
  const fw = Math.max(28, av.width * 0.6), fh = fw * 79 / 199;       // plus petit : ~60% de l'avatar (pas centré/énorme)
  const bg = "url('assets/cigare_frames.png')", bgSize = (fw * FRAMES) + 'px ' + fh + 'px';
  const el = document.createElement('div'); el.className = 'cigare-emote';
  el.style.width = fw + 'px'; el.style.height = fh + 'px';
  el.style.backgroundImage = bg; el.style.backgroundSize = bgSize; el.style.backgroundPosition = '0 0'; // frame 0 (éteint) pendant le vol
  // pivot = bout "bouche" (bord gauche du sprite, l'autre bout — la braise — est à droite) : la rotation
  // se fait AUTOUR de ce point pour que seule la partie qui dépasse de la bouche s'incline, pas tout le cigare.
  const px = fw * 0.14, py = fh * 0.5;
  el.style.transformOrigin = px + 'px ' + py + 'px';
  const startX = bd.left + bd.width / 2, startY = bd.top + bd.height / 2;               // départ : centre du plateau
  const mouthX = av.left + av.width * 0.56, mouthY = av.top + av.height * 0.63;         // coin de bouche, décalé + plus bas (pas centré sur le visage)
  const rotDeg = -16;                                                                    // penché "de travers" (braise relevée) -> cliché gangster
  el.style.left = (startX - px) + 'px'; el.style.top = (startY - py) + 'px';
  document.body.appendChild(el);
  el.animate([{ transform: `translate(0,0) rotate(${rotDeg}deg)` }, { transform: `translate(${mouthX - startX}px, ${mouthY - startY}px) rotate(${rotDeg}deg)` }],
    { duration: 1500, easing: 'cubic-bezier(.2,.7,.15,1)', fill: 'forwards' });        // arrivée lente au coin de la bouche
  setTimeout(() => { try { const a = $('#cigare-audio'); if (a && a.getAttribute('src')) { a.currentTime = 0; a.volume = volume; a.muted = muted; a.play().catch(() => { }); } } catch (e) { } }, 1000); // son décalé de 1s
  setTimeout(() => {
    el.style.backgroundImage = 'none';                                                // 4s après l'arrivée (le son du briquet qui s'allume dure ~4s au début de l'audio) : 2 calques qui se fondent l'un dans l'autre à chaque frame
    const mk = () => { const l = document.createElement('div'); l.style.position = 'absolute'; l.style.inset = '0'; l.style.backgroundImage = bg; l.style.backgroundSize = bgSize; l.style.backgroundRepeat = 'no-repeat'; return l; };
    const layerA = mk(), layerB = mk(); layerB.style.opacity = '0';
    el.appendChild(layerA); el.appendChild(layerB);
    const per = 3500 / (FRAMES - 1), setFrame = (l, f) => { l.style.backgroundPosition = `${-f * fw}px 0`; };
    setFrame(layerA, 0);
    let f = 0;
    const step = () => {
      if (f >= FRAMES - 1) { setTimeout(() => el.remove(), 400); return; }
      setFrame(layerB, f + 1); layerB.style.opacity = '0';
      layerB.animate([{ opacity: 0 }, { opacity: 1 }], { duration: per, easing: 'linear', fill: 'forwards' }); // fondu frame f -> f+1
      setTimeout(() => { f++; setFrame(layerA, f); layerB.style.opacity = '0'; step(); }, per);
    };
    step();
  }, 1500 + 4000); // 1500 = vol jusqu'à la bouche, +4000 = tenu éteint le temps du briquet avant de commencer à se consumer
}
// café : même traitement que le cigare (vol depuis le centre du plateau -> côté de l'avatar, puis anime les
// 24 frames avec fondu). Pas de rotation "de travers" (la tasse reste droite) ni de délai d'allumage.
function playCafe(seat) {
  const seatEl = seatEls[seat]; if (!seatEl) return;
  const avatar = seatEl.querySelector('.avatar'), board = $('#board'); if (!avatar || !board) return;
  const av = avatar.getBoundingClientRect(), bd = board.getBoundingClientRect();
  if (!av.width || !bd.width) return;
  const FRAMES = 24;                                                 // cafe_frames.png : 24 frames horizontales de 336x336 (carré, cellule nominale + marge fixe)
  const fw = Math.max(38, av.width * 0.8), fh = fw;                  // agrandi (avant 0.55) ; carré donc fh=fw
  const bg = "url('assets/cafe_frames.png')", bgSize = (fw * FRAMES) + 'px ' + fh + 'px';
  const el = document.createElement('div'); el.className = 'cigare-emote'; // même style (position/ombre) que le cigare
  el.style.width = fw + 'px'; el.style.height = fh + 'px';
  el.style.backgroundImage = bg; el.style.backgroundSize = bgSize; el.style.backgroundPosition = '0 0'; // frame 0 (tasse pleine, posée)
  const startX = bd.left + bd.width / 2, startY = bd.top + bd.height / 2;                 // départ : centre du plateau
  const handX = av.left + av.width * 0.72, handY = av.top + av.height * 0.6;              // à côté de la main (décalé, pas centré sur le visage)
  el.style.left = (startX - fw / 2) + 'px'; el.style.top = (startY - fh / 2) + 'px';
  document.body.appendChild(el);
  el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${handX - startX}px, ${handY - startY}px)` }],
    { duration: 1200, easing: 'cubic-bezier(.2,.7,.15,1)', fill: 'forwards' });         // arrivée à côté de la main
  setTimeout(() => { try { const a = $('#cafe-audio'); if (a && a.getAttribute('src')) { a.currentTime = 0; a.volume = volume; a.muted = muted; a.play().catch(() => { }); } } catch (e) { } }, 4000); // son 4s après le début de l'animation
  setTimeout(() => {
    el.style.backgroundImage = 'none';                                                  // à l'arrivée : 2 calques qui se fondent l'un dans l'autre à chaque frame
    const mk = () => { const l = document.createElement('div'); l.style.position = 'absolute'; l.style.inset = '0'; l.style.backgroundImage = bg; l.style.backgroundSize = bgSize; l.style.backgroundRepeat = 'no-repeat'; return l; };
    const layerA = mk(), layerB = mk(); layerB.style.opacity = '0';
    el.appendChild(layerA); el.appendChild(layerB);
    const per = 3000 / (FRAMES - 1), setFrame = (l, f) => { l.style.backgroundPosition = `${-f * fw}px 0`; };
    setFrame(layerA, 0);
    let f = 0;
    const step = () => {
      if (f >= FRAMES - 1) { setTimeout(() => el.remove(), 400); return; }
      setFrame(layerB, f + 1); layerB.style.opacity = '0';
      layerB.animate([{ opacity: 0 }, { opacity: 1 }], { duration: per, easing: 'linear', fill: 'forwards' });
      setTimeout(() => { f++; setFrame(layerA, f); layerB.style.opacity = '0'; step(); }, per);
    };
    step();
  }, 1200);
}
// gossip : même traitement que café/cigare (vol depuis le centre du plateau -> à côté de l'avatar, pas de
// cible), mais plus rapide (16 poses de main qui papote, pas une consumation lente comme le cigare).
function playGossip(seat) {
  const seatEl = seatEls[seat]; if (!seatEl) return;
  const avatar = seatEl.querySelector('.avatar'), board = $('#board'); if (!avatar || !board) return;
  const av = avatar.getBoundingClientRect(), bd = board.getBoundingClientRect();
  if (!av.width || !bd.width) return;
  const FRAMES = 16;                                                 // gossip_frames.png : 16 frames horizontales de 484x356 (slice_gossip.py)
  const fw = Math.max(60, av.width * 1.3), fh = fw * 356 / 484; // 2x (avant 0.65)
  const bg = "url('assets/gossip_frames.png')", bgSize = (fw * FRAMES) + 'px ' + fh + 'px';
  const el = document.createElement('div'); el.className = 'cigare-emote'; // même style (position/ombre) que les autres
  el.style.width = fw + 'px'; el.style.height = fh + 'px';
  el.style.backgroundImage = bg; el.style.backgroundSize = bgSize; el.style.backgroundPosition = '0 0';
  const startX = bd.left + bd.width / 2, startY = bd.top + bd.height / 2;                 // départ : centre du plateau
  const handX = av.left + av.width * 0.7, handY = av.top + av.height * 0.55;              // à côté de la tête, pas dessus
  el.style.left = (startX - fw / 2) + 'px'; el.style.top = (startY - fh / 2) + 'px';
  document.body.appendChild(el);
  el.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${handX - startX}px, ${handY - startY}px)` }],
    { duration: 900, easing: 'cubic-bezier(.2,.7,.15,1)', fill: 'forwards' });
  setTimeout(() => {
    el.style.backgroundImage = 'none';                                                   // à l'arrivée : 2 calques qui se fondent l'un dans l'autre à chaque frame
    const mk = () => { const l = document.createElement('div'); l.style.position = 'absolute'; l.style.inset = '0'; l.style.backgroundImage = bg; l.style.backgroundSize = bgSize; l.style.backgroundRepeat = 'no-repeat'; return l; };
    const layerA = mk(), layerB = mk(); layerB.style.opacity = '0';
    el.appendChild(layerA); el.appendChild(layerB);
    const per = 1000 / (FRAMES - 1), setFrame = (l, f) => { l.style.backgroundPosition = `${-f * fw}px 0`; }; // plus rapide (avant 2400ms) -> geste plus fluide
    setFrame(layerA, 0);
    let f = 0;
    const step = () => {
      if (f >= FRAMES - 1) { setTimeout(() => el.remove(), 400); return; }
      setFrame(layerB, f + 1); layerB.style.opacity = '0';
      layerB.animate([{ opacity: 0 }, { opacity: 1 }], { duration: per, easing: 'linear', fill: 'forwards' });
      setTimeout(() => { f++; setFrame(layerA, f); layerB.style.opacity = '0'; step(); }, per);
    };
    step();
  }, 900);
}
// ---------- Pistolet : tire sur un autre joueur (100% cosmétique, aucun effet sur la partie) ----------
// géométrie mesurée sur colt_frames.png (frame 0, 572x401) : pivot = centre du poing, canon = bout du plus
// long axe dessiné. Le sprite est dessiné en biais (~-24.5°) -> on calcule l'angle SUPPLÉMENTAIRE à
// appliquer (cible - angle naturel) pour que le canon pointe exactement vers la cible, quelle que soit sa
// position autour de la table.
const COLT_FW = 432, COLT_FH = 355, COLT_FRAMES = 10; // re-découpé (slice_colt.py) : grille RÉELLE = 4+3+3=10 poses (pas 3x3=9, la ligne du haut a 4 poses), ancrage bas-gauche fixe (pas de recentrage par bbox -> évite le jitter)
const COLT_PIVOT_X = 119.2 / COLT_FW, COLT_PIVOT_Y = 225.7 / COLT_FH;
const COLT_MUZZLE_DX = 181.8, COLT_MUZZLE_DY = -83.1; // décalage canon->pivot, dans le repère NON tourné (échelle native 432px)
const COLT_MUZZLE_LEN = Math.hypot(COLT_MUZZLE_DX, COLT_MUZZLE_DY);
const COLT_NATURAL_ANGLE = Math.atan2(COLT_MUZZLE_DY, COLT_MUZZLE_DX);
// émotes qui visent un AUTRE joueur (pistolet, baffe) : les 2 sens marchent (emote->joueur ou joueur->emote)
const TARGETED_EMOTES = new Set(['pistolet', 'baffe']);
let pistolPicking = null, pistolPendingTarget = null; // pistolPicking = id de l'émote armée (ou null)
function pistolCancel() { pistolPicking = null; pistolPendingTarget = null; document.querySelectorAll('.seat.pistol-target').forEach(e => e.classList.remove('pistol-target')); }
function pistolSetTarget(seat) {
  document.querySelectorAll('.seat.pistol-target').forEach(e => e.classList.remove('pistol-target'));
  pistolPendingTarget = seat;
  if (seatEls[seat]) seatEls[seat].classList.add('pistol-target');
}
// clic sur un siège : soit on vise directement (mode "picking" déjà armé par le bouton emote), soit on
// mémorise juste ce joueur comme cible pré-sélectionnée (l'autre sens : cible d'abord, emote ensuite)
function onSeatClickForPistol(seat) {
  if (!snap || snap.you < 0 || !snap.seats[seat]) return;
  if (seat === snap.you) { if (pistolPicking) toast('Tu ne peux pas te cibler toi-même.'); return; }
  if (pistolPicking) { const id = pistolPicking; pistolCancel(); sendTargetedEmote(id, seat); return; }
  pistolSetTarget(seat);
}
function sendTargetedEmote(id, target) {
  const now = Date.now();
  if (now < emoteCooldown) { toast('Emote en recharge…'); return; }
  emoteCooldown = now + 5000;
  send({ type: 'emote', emote: id, target });
}
function playPistolet(seat, targetSeat) {
  console.log('[pistolet] playPistolet appelé, seat=', seat, 'target=', targetSeat);
  if (targetSeat == null || targetSeat === seat) { console.log('[pistolet] ABANDON : target null ou = seat'); return; }
  const seatEl = seatEls[seat], targetEl = seatEls[targetSeat]; if (!seatEl || !targetEl) { console.log('[pistolet] ABANDON : seatEl/targetEl manquant'); return; }
  const avatar = seatEl.querySelector('.avatar'), tAvatar = targetEl.querySelector('.avatar'); if (!avatar || !tAvatar) { console.log('[pistolet] ABANDON : avatar manquant'); return; }
  const av = avatar.getBoundingClientRect(), tav = tAvatar.getBoundingClientRect();
  if (!av.width || !tav.width) { console.log('[pistolet] ABANDON : largeur 0', av.width, tav.width); return; }
  const srcX = av.left + av.width / 2, srcY = av.top + av.height * 0.55;   // point d'ancrage PRÈS du tireur (pas au centre de la table)
  const dstX = tav.left + tav.width / 2, dstY = tav.top + tav.height / 2;  // centre de l'avatar ciblé
  const targetAngle = Math.atan2(dstY - srcY, dstX - srcX);                // SOURCE -> TARGET, recalculé à chaque tir
  const extraRotRad = targetAngle - COLT_NATURAL_ANGLE;                    // rotation à appliquer par-dessus l'angle déjà dessiné
  const fw = Math.max(50, av.width * 1.1), scale = fw / COLT_FW, fh = fw * COLT_FH / COLT_FW;
  console.log('[pistolet] src=', srcX, srcY, 'dst=', dstX, dstY, 'angle(deg)=', targetAngle * 180 / Math.PI, 'fw/fh=', fw, fh);
  const px = fw * COLT_PIVOT_X, py = fh * COLT_PIVOT_Y;
  const gunBg = "url('assets/colt_frames.png')", gunBgSize = (fw * COLT_FRAMES) + 'px ' + fh + 'px';
  const el = document.createElement('div'); el.className = 'colt-emote';
  el.style.width = fw + 'px'; el.style.height = fh + 'px';
  el.style.backgroundImage = gunBg; el.style.backgroundSize = gunBgSize; el.style.backgroundPosition = '0 0';
  el.style.left = (srcX - px) + 'px'; el.style.top = (srcY - py) + 'px';
  el.style.transformOrigin = px + 'px ' + py + 'px';
  el.style.transform = `rotate(${extraRotRad}rad)`;                        // arme immédiatement orientée vers la cible (pas d'anim de vol : elle reste près du tireur)
  document.body.appendChild(el);
  const FRAME_MS = 120; // 10 frames -> idle, idle, étincelle, PREMIER flash, flash, flash, fumée x3, retour (~1.2s)
  const FIRE_FRAME = 3; // 1er flash (index 3 sur 10) -> déclenche balle + douilles
  for (let f = 1; f < COLT_FRAMES; f++) {
    setTimeout(() => { el.style.backgroundPosition = (-f * fw) + 'px 0'; }, f * FRAME_MS);
  }
  setTimeout(() => {
    // balle + douilles au bout du canon, dans l'axe EXACT canon->cible (recalculé avec la même formule que le muzzle)
    const muzzleX = srcX + COLT_MUZZLE_LEN * scale * Math.cos(targetAngle), muzzleY = srcY + COLT_MUZZLE_LEN * scale * Math.sin(targetAngle);
    fireBullet(muzzleX, muzzleY, dstX, dstY, targetAngle);
    spawnCasings(srcX, srcY, targetAngle);
    try { const a = $('#colt-audio'); if (a && a.getAttribute('src')) { a.currentTime = 0; a.volume = volume; a.muted = muted; a.play().catch(() => { }); } } catch (e) { } // détonation pile au moment du flash
  }, FIRE_FRAME * FRAME_MS);
  setTimeout(() => el.remove(), COLT_FRAMES * FRAME_MS + 250);
}
function fireBullet(x0, y0, x1, y1, angle) {
  console.log('[pistolet] fireBullet de', x0, y0, 'vers', x1, y1);
  const BW = 70, BH = BW * 137 / 340; // bullet_frames.png : frame ~340x137, 5 frames (garde la frame "avec traînée")
  const b = document.createElement('div'); b.className = 'bullet-emote';
  b.style.width = BW + 'px'; b.style.height = BH + 'px';
  b.style.backgroundImage = "url('assets/bullet_frames.png')"; b.style.backgroundSize = (BW * 5) + 'px ' + BH + 'px'; b.style.backgroundPosition = (-3 * BW) + 'px 0'; // frame 3 = balle + traînée
  b.style.left = (x0 - BW / 2) + 'px'; b.style.top = (y0 - BH / 2) + 'px';
  b.style.transform = `rotate(${angle}rad)`;
  document.body.appendChild(b);
  const dist = Math.hypot(x1 - x0, y1 - y0), dur = Math.min(260, Math.max(90, dist * 0.55)); // rapide, façon arcade
  b.animate([{ transform: `translate(0,0) rotate(${angle}rad)` }, { transform: `translate(${x1 - x0}px, ${y1 - y0}px) rotate(${angle}rad)` }],
    { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => { b.remove(); spawnImpact(x1, y1); };
}
function spawnImpact(x, y) {
  const IW = 100, IH = 100; // impact_frames.png : les 4 premières frames (254x255) sont propres, la suite = fragments -> on n'utilise QUE 0..3
  const el = document.createElement('div'); el.className = 'impact-emote';
  el.style.width = IW + 'px'; el.style.height = IH + 'px';
  el.style.backgroundImage = "url('assets/impact_frames.png')"; el.style.backgroundSize = (IW * 14) + 'px ' + IH + 'px';
  el.style.left = (x - IW / 2) + 'px'; el.style.top = (y - IH / 2) + 'px';
  document.body.appendChild(el);
  const FRAMES = [0, 1, 2, 3], per = 90;
  FRAMES.forEach((f, i) => setTimeout(() => { el.style.backgroundPosition = (-f * IW) + 'px 0'; }, i * per));
  setTimeout(() => { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, FRAMES.length * per);
}
function spawnCasings(x, y, angle) {
  const CW = 26, CH = CW * 188 / 177;
  const idxs = [0, 2, 9]; // quelques frames propres de casing_frames.png (certaines sont juste un effet de mouvement, pas la douille)
  idxs.slice(0, 2).forEach((fi, i) => {
    const c = document.createElement('div'); c.className = 'casing-emote';
    c.style.width = CW + 'px'; c.style.height = CH + 'px';
    c.style.backgroundImage = "url('assets/casing_frames.png')"; c.style.backgroundSize = (CW * 11) + 'px ' + CH + 'px'; c.style.backgroundPosition = (-fi * CW) + 'px 0';
    c.style.left = (x - CW / 2) + 'px'; c.style.top = (y - CH / 2) + 'px';
    document.body.appendChild(c);
    // éjectée perpendiculairement au canon (vers le haut-arrière), tombe en tournant
    const ejectAngle = angle - Math.PI / 2 + (i - 0.5) * 0.5;
    const dx = Math.cos(ejectAngle) * 34, dy = Math.sin(ejectAngle) * 34 - 10;
    c.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${dx}px, ${dy + 40}px) rotate(${220 + i * 60}deg)`, opacity: 0 }],
      { duration: 650, delay: i * 40, easing: 'cubic-bezier(.3,.6,.6,1)', fill: 'forwards' }).onfinish = () => c.remove();
  });
}
// ---------- Baffe : gifle un autre joueur (même logique de ciblage/rotation que le pistolet, mais mêlée
// : pas de projectile, la main reste près du gifleur et "atteint" directement la cible) ----------
// géométrie mesurée sur baffe_frames.png (frame 0, 375x403) : pivot = centre du poignet/manchette,
// contact = bout des doigts (l'autre extrémité). Sprite dessiné avec la main pointant haut-droite ->
// même principe que le colt : angle SUPPLÉMENTAIRE = cible - angle naturel du dessin.
const BAFFE_FW = 375, BAFFE_FH = 403, BAFFE_FRAMES = 5;
const BAFFE_PIVOT_X = 90.4 / BAFFE_FW, BAFFE_PIVOT_Y = 317.5 / BAFFE_FH;
const BAFFE_CONTACT_DX = 43.8, BAFFE_CONTACT_DY = -180.5; // décalage bout-des-doigts -> poignet, repère natif 375px
const BAFFE_CONTACT_LEN = Math.hypot(BAFFE_CONTACT_DX, BAFFE_CONTACT_DY);
const BAFFE_NATURAL_ANGLE = Math.atan2(BAFFE_CONTACT_DY, BAFFE_CONTACT_DX);
// la main TRAVERSE du gifleur jusqu'à l'avatar de la cible (frame 1 = main ouverte pendant le trajet),
// puis UNE FOIS ARRIVÉE l'animation locale démarre (frames 2 à 5) ; le son claque à la frame 5.
function playBaffe(seat, targetSeat) {
  if (targetSeat == null || targetSeat === seat) return;
  const seatEl = seatEls[seat], targetEl = seatEls[targetSeat]; if (!seatEl || !targetEl) return;
  const avatar = seatEl.querySelector('.avatar'), tAvatar = targetEl.querySelector('.avatar'); if (!avatar || !tAvatar) return;
  const av = avatar.getBoundingClientRect(), tav = tAvatar.getBoundingClientRect();
  if (!av.width || !tav.width) return;
  const srcX = av.left + av.width / 2, srcY = av.top + av.height * 0.55;
  const dstX = tav.left + tav.width / 2, dstY = tav.top + tav.height * 0.5;
  const targetAngle = Math.atan2(dstY - srcY, dstX - srcX);
  const extraRotRad = targetAngle - BAFFE_NATURAL_ANGLE; // même rotation gardée tout du long (trajet + swing local)
  const fw = Math.max(46, av.width * 0.95), fh = fw * BAFFE_FH / BAFFE_FW;
  const px = fw * BAFFE_PIVOT_X, py = fh * BAFFE_PIVOT_Y;
  const bg = "url('assets/baffe_frames.png')", bgSize = (fw * BAFFE_FRAMES) + 'px ' + fh + 'px';
  const el = document.createElement('div'); el.className = 'colt-emote'; // même style (position/ombre) que le pistolet
  el.style.width = fw + 'px'; el.style.height = fh + 'px';
  el.style.backgroundImage = bg; el.style.backgroundSize = bgSize; el.style.backgroundPosition = '0 0'; // frame 1 (main ouverte) pendant le trajet
  el.style.left = (srcX - px) + 'px'; el.style.top = (srcY - py) + 'px';
  el.style.transformOrigin = px + 'px ' + py + 'px';
  document.body.appendChild(el);
  const TRAVEL_MS = 260; // trajet rapide du gifleur jusqu'à la cible
  el.animate([
    { transform: `translate(0,0) rotate(${extraRotRad}rad)` },
    { transform: `translate(${dstX - srcX}px, ${dstY - srcY}px) rotate(${extraRotRad}rad)` }
  ], { duration: TRAVEL_MS, easing: 'cubic-bezier(.3,.6,.2,1)', fill: 'forwards' });
  setTimeout(() => {
    // arrivée à l'avatar cible : démarre l'animation locale (frames 2 à 5)
    const FRAME_MS = 90, FIRE_FRAME_LOCAL = 4; // frame 5 -> claque + impact + marque
    for (let f = 1; f < BAFFE_FRAMES; f++) {
      setTimeout(() => { el.style.backgroundPosition = (-f * fw) + 'px 0'; }, f * FRAME_MS);
    }
    setTimeout(() => {
      spawnBaffeImpact(dstX, dstY);
      spawnBaffeMark(dstX, dstY);
      SFX.play('slap');
    }, FIRE_FRAME_LOCAL * FRAME_MS);
    setTimeout(() => el.remove(), BAFFE_FRAMES * FRAME_MS + 250);
    setTimeout(() => spawnBluffLabel(dstX, dstY), BAFFE_FRAMES * FRAME_MS); // juste après la dernière frame, sur l'avatar giflé
  }, TRAVEL_MS);
}
// "BLUFF ?" en rouge brillant sur l'avatar giflé, 2s
function spawnBluffLabel(x, y) {
  const el = document.createElement('div'); el.className = 'bluff-label';
  el.textContent = 'BLUFF ?';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  document.body.appendChild(el);
  void el.offsetWidth; el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2000);
}
function spawnBaffeImpact(x, y) {
  const IW = 90, IH = IW * 261 / 321; // baffe_impact_frames.png : 2 frames de 321x261
  const el = document.createElement('div'); el.className = 'impact-emote';
  el.style.width = IW + 'px'; el.style.height = IH + 'px';
  el.style.backgroundImage = "url('assets/baffe_impact_frames.png')"; el.style.backgroundSize = (IW * 2) + 'px ' + IH + 'px';
  el.style.left = (x - IW / 2) + 'px'; el.style.top = (y - IH / 2) + 'px';
  document.body.appendChild(el);
  setTimeout(() => { el.style.backgroundPosition = (-IW) + 'px 0'; }, 60);
  setTimeout(() => { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, 160);
}
// trace de main qui reste sur l'avatar de la cible, s'estompe progressivement puis disparaît
function spawnBaffeMark(x, y) {
  const MW = 110, MH = MW * 267 / 348; // baffe_mark_frames.png : une seule frame (la plus nette) affichée plus grande et plus longtemps
  const el = document.createElement('div'); el.className = 'impact-emote';
  el.style.width = MW + 'px'; el.style.height = MH + 'px';
  el.style.backgroundImage = "url('assets/baffe_mark_frames.png')"; el.style.backgroundSize = (MW * 5) + 'px ' + MH + 'px'; el.style.backgroundPosition = '0 0';
  el.style.left = (x - MW / 2) + 'px'; el.style.top = (y - MH / 2) + 'px';
  document.body.appendChild(el);
  const hold = 2000; // 1s de plus qu'avant pour bien la voir
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 550); }, hold);
}

/* ---------- sièges (créés une fois) ---------- */
const seatsEl = $('#seats'), seatEls = [];
for (let s = 0; s < 6; s++) {
  const el = document.createElement('div'); el.className = 'seat'; el.dataset.seat = s;
  // bloc "pod" = avatar (derrière) + cartes DEVANT qui le chevauchent + label de main ; puis le tapis dessous
  el.innerHTML = '<div class="pod"><div class="winner-label"></div><div class="loser-label"></div><div class="status-dot"></div><div class="avatar"><div class="ring"></div><div class="avatar-clip"><img class="ava-img" alt=""></div></div>' +
    '<div class="cards"></div><div class="hand-label" hidden></div><div class="eq-badge" hidden></div></div>' +
    '<div class="status"></div>' +
    '<div class="plate"><div class="pname"></div><div class="stack"></div></div>' +
    '<div class="check-tag" hidden>✓ CHECK</div>' +
    '<div class="chips" hidden><img class="chip-ava" alt=""><b class="chip-blind"></b><i class="chip-a">A</i><span>0</span><i class="chip-jeton"></i></div><div class="chat-bubble" hidden></div>' +
    '<button class="show-btn l">SHOW</button><button class="show-btn r">SHOW</button>';
  el.querySelectorAll('.show-btn').forEach(b => b.onclick = () => toggleShow(b.classList.contains('r') ? 1 : 0));
  el.addEventListener('click', (e) => { if (e.target.closest('button')) return; onSeatClickForPistol(s); }); // cible pour l'émote pistolet
  seatsEl.appendChild(el); seatEls.push(el);
}
const SEAT_SLOTS = { 2: [0, 4], 3: [0, 3, 4], 4: [0, 2, 3, 4], 5: [0, 2, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
// avatars : chaque bot porte un nom de Pokémon -> son sprite ; les humains -> Métamorph (Ditto)
const AVATARS = { 'Miaouss': 'meowth', 'Roucool': 'pidgey', 'Évoli': 'eevee', 'Salamèche': 'charmander', 'Rondoudou': 'jigglypuff', 'Magicarpe': 'magikarp' };
const AVATAR_POOL = ['p1', 'p4', 'p6', 'p7', 'p9', 'p16', 'p25', 'p26', 'p39', 'p52', 'p54', 'p58', 'p63', 'p92', 'p94', 'p104', 'p113', 'p129', 'p131', 'p133', 'p143', 'p150', 'p151'];
function avatarSrc(name, id) {
  if (AVATARS[name]) return 'avatars/' + AVATARS[name] + '.png';        // bot -> son Pokémon
  const key = String(id || name || 'x'); let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return 'avatars/' + AVATAR_POOL[Math.abs(h) % AVATAR_POOL.length] + '.png'; // humain -> avatar aléatoire stable
}
// une partie sur deux, le serveur pioche dans le pool "personnalités" (avatarKind) au lieu du pool Pokémon
function avatarImgSrc(p) {
  if (p.avatarKind === 'people' && p.avatar) return 'avatars/people/' + p.avatar + '.jpg';
  return p.avatar ? 'avatars/p' + p.avatar + '.png' : avatarSrc(p.name, p.id);
}
const fmtK = (n) => n >= 10000 ? Math.round(n / 1000) + 'K' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : '' + n; // 10000 -> "10K"

/* ============================================================
   GESTION DES ÉCRANS
   ============================================================ */
// piste par écran : titlescreen.mp3 à l'accueil, songmenu.mp3 dans le lobby/création/salle d'attente
const MENU_MUSIC = { landing: 'sfx/titlescreen.mp3', lobby: 'sfx/songmenu.mp3', create: 'sfx/songmenu.mp3', waiting: 'sfx/songmenu.mp3' };
const MENU_MUSIC_SKIP = { 'sfx/titlescreen.mp3': 3 }; // cet enregistrement a plusieurs secondes de silence au début -> on saute direct dedans pour avoir le son tout de suite
function showScreen(name) {
  currentScreen = name;
  ['landing', 'lobby', 'create', 'waiting'].forEach(s => $('#' + s).hidden = s !== name);
  $('#rules-modal').hidden = true; // ne doit jamais rester ouverte en changeant d'écran (menu, fin de partie...)
  const g = name === 'game';
  $('#stage').hidden = !g; $('#bottombar').hidden = !g;
  document.body.classList.toggle('playing', g); // fond casino masqué en jeu
  const bg = document.getElementById('bgm');     // musique du menu : coupée en jeu, reprise au menu
  if (bg) {
    if (g) bg.pause();
    else {
      const track = MENU_MUSIC[name];
      if (track && bg.getAttribute('src') !== track) {
        bg.src = track;
        const skip = MENU_MUSIC_SKIP[track];
        if (skip) bg.addEventListener('loadedmetadata', () => { bg.currentTime = skip; }, { once: true });
        if (musicStarted) bg.play().catch(() => { });
      }
      else if (musicStarted && bg.getAttribute('src')) bg.play().catch(() => { });
    }
  }
  if (g) fitBoard();
}
let toastTimer = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3000); }
const savePseudo = (v) => { pseudo = (v || '').trim().slice(0, 16) || pseudo; localStorage.setItem('pl_name', pseudo); return pseudo; };

/* ============================================================
   CONNEXION
   ============================================================ */
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/?t=${encodeURIComponent(token)}`);
  ws.onopen = () => setConn('ok', 'En ligne');
  ws.onclose = () => { setConn('lost', 'Reconnexion…'); setTimeout(connect, 1500); };
  ws.onerror = () => { try { ws.close(); } catch (e) { } };
  ws.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    if (m.type === 'hello') { if (m.token) { token = m.token; localStorage.setItem('pl_token', token); } }
    else if (m.type === 'rooms') {
      renderRoomList(m.rooms);
      // reçu la liste des salons = on n'est PLUS dans une partie (serveur redémarré / partie finie)
      if (currentScreen === 'game' || currentScreen === 'waiting') { showScreen('lobby'); toast('Partie interrompue — retour au salon.'); }
    }
    else if (m.type === 'state') { awaiting = false; handleState(m.snap); }
    else if (m.type === 'chat') { showChat(m.seat, m.text); }
    else if (m.type === 'emote') { try { playEmote(m.seat, m.emote, m.target); } catch (err) { console.error('emote', m.emote, err); } }
    else if (m.type === 'error') { toast(m.msg); }
    else if (m.type === 'left') { showScreen('lobby'); send({ type: 'listRooms' }); }
  };
}
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function setConn(cls, txt) { const c = $('#conn'); c.className = cls; c.textContent = txt; }
function sendAction(action) { if (awaiting) return; awaiting = true; hideControls(); send({ type: 'action', action }); }

/* routeur d'état : salle d'attente ou table de jeu */
function handleState(s) {
  snap = s;
  timeOffset = s.now - Date.now();
  document.body.classList.toggle('is-host', !!(s.room && s.room.host));
  if (s.room && s.room.status === 'waiting') { showScreen('waiting'); renderWaiting(s); return; }
  showScreen('game');
  renderGame(s);
}

/* ============================================================
   ACCUEIL
   ============================================================ */
/* --- audio : musique + volume (bas par défaut) + SFX --- */
const bgm = $('#bgm');
let volume = parseFloat(localStorage.getItem('pl_vol')); if (isNaN(volume)) volume = 0.25;
let muted = localStorage.getItem('pl_muted') === '1';
function applyVolume() {
  bgm.volume = volume; bgm.muted = muted;
  SFX.setVolume(volume); SFX.setMuted(muted);
  $('#vol').value = Math.round(volume * 100);
  $('#mute-btn').textContent = (muted || volume === 0) ? '🔇' : '🔊';
}
$('#vol').oninput = function () { volume = (+this.value) / 100; if (volume > 0) muted = false; localStorage.setItem('pl_vol', volume); applyVolume(); };
$('#mute-btn').onclick = () => { muted = !muted; localStorage.setItem('pl_muted', muted ? '1' : '0'); applyVolume(); };
applyVolume();
let musicStarted = false;
function playMusic() { if (bgm.getAttribute('src')) { musicStarted = true; bgm.volume = volume; bgm.muted = muted; bgm.play().catch(() => { }); } }
// autoplay bloqué par le navigateur tant qu'il n'y a pas eu de geste utilisateur : avant, la musique
// n'était liée qu'au clic sur JOUER -> silence total tant qu'on reste sur l'écran de titre. On la lance
// dès la toute première interaction sur la page (clic ou touche), où qu'elle ait lieu.
let firstInteractionDone = false; // un seul clic déclenche PLUSIEURS types d'événements (pointerdown puis click) -> sans ce garde, l'annonce se jouerait 2 fois
function onFirstInteraction() {
  if (firstInteractionDone) return; firstInteractionDone = true;
  SFX.ensure(); playMusic(); if (currentScreen === 'landing') SFX.play('pokerloult'); // annonce une seule fois, seulement si on démarre bien sur l'écran de titre
}
// plusieurs types d'événements (pas juste pointerdown) : certains navigateurs/mobiles ne comptent pas tous
// les mêmes gestes comme une "vraie" interaction utilisateur pour débloquer l'autoplay.
['pointerdown', 'keydown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, onFirstInteraction, { once: true }));

$('#land-name').value = pseudo;
$('#btn-play').onclick = () => { savePseudo($('#land-name').value); SFX.ensure(); playMusic(); $('#lobby-name').textContent = pseudo; showScreen('lobby'); send({ type: 'listRooms' }); };

/* ============================================================
   LOBBY
   ============================================================ */
function renderRoomList(list) {
  const el = $('#room-list'); el.innerHTML = '';
  if (!list || !list.length) { el.innerHTML = '<div class="empty-note">Aucune room publique. Crées-en une !</div>'; return; }
  list.forEach(r => {
    const row = document.createElement('div');
    row.className = 'room-row' + (r.status !== 'waiting' ? ' playing' : '');
    row.innerHTML = `<span class="rname">${escapeHtml(r.name)}</span>` +
      (r.locked ? '<span class="rlock">🔒</span>' : '') +
      `<span class="rmeta">${r.players}/${r.max} ${r.status === 'waiting' ? '· ouverte' : '· en cours'}</span>`;
    row.onclick = () => tryJoin(r.code, r.locked);
    el.appendChild(row);
  });
}
function tryJoin(code, locked) {
  const password = locked ? (prompt('Mot de passe de la room :') || '') : '';
  if (locked && password === '') return;
  send({ type: 'joinRoom', code, password, pseudo });
}
$('#btn-refresh').onclick = () => send({ type: 'listRooms' });
$('#btn-rename').onclick = () => { const v = prompt('Ton pseudo :', pseudo); if (v) { savePseudo(v); $('#lobby-name').textContent = pseudo; $('#land-name').value = pseudo; } };
$('#btn-join-code').onclick = () => { const code = (prompt('Code de la room :') || '').trim().toUpperCase(); if (code) send({ type: 'joinRoom', code, password: prompt('Mot de passe (laisser vide si aucun) :') || '', pseudo }); };
$('#btn-create-open').onclick = () => { initCreate(); showScreen('create'); };

/* ============================================================
   CRÉER UNE ROOM
   ============================================================ */
let crVis = 'public', crBots = 1, crAvatarKind = 'pokemon';
function initCreate() {
  $('#cr-name').value = 'Room de ' + pseudo;
  $('#cr-pass').value = '';
  crVis = 'public'; crAvatarKind = 'pokemon';
  document.querySelectorAll('#cr-vis button').forEach(b => b.classList.toggle('on', b.dataset.v === 'public'));
  document.querySelectorAll('#cr-avatar button').forEach(b => b.classList.toggle('on', b.dataset.v === 'pokemon'));
  buildBotSeg('#cr-bots', crBots, (n) => crBots = n);
}
function buildBotSeg(id, cur, cb) {
  const c = $(id); c.innerHTML = '';
  for (let n = 0; n <= 5; n++) {
    const b = document.createElement('button'); b.textContent = n;
    if (n === cur) b.classList.add('on');
    b.onclick = () => { [...c.children].forEach((x, j) => x.classList.toggle('on', j === n)); cb(n); };
    c.appendChild(b);
  }
}
document.querySelectorAll('#cr-vis button').forEach(b => b.onclick = () => { crVis = b.dataset.v; document.querySelectorAll('#cr-vis button').forEach(x => x.classList.toggle('on', x === b)); });
document.querySelectorAll('#cr-avatar button').forEach(b => b.onclick = () => { crAvatarKind = b.dataset.v; document.querySelectorAll('#cr-avatar button').forEach(x => x.classList.toggle('on', x === b)); });
$('#btn-create-back').onclick = () => showScreen('lobby');
$('#btn-create').onclick = () => {
  savePseudo($('#land-name').value);
  send({ type: 'createRoom', name: $('#cr-name').value, isPrivate: crVis === 'private', password: $('#cr-pass').value.trim(), bots: crBots, avatarKind: crAvatarKind, pseudo });
};

/* ============================================================
   SALLE D'ATTENTE
   ============================================================ */
let waitBotsBuilt = false;
function renderWaiting(s) {
  const r = s.room;
  $('#wait-name').textContent = r.name;
  $('#wait-code').textContent = r.code;
  const humans = s.seats.filter(p => p && !p.isBot);
  const list = $('#wait-players'); list.innerHTML = '';
  humans.forEach(p => {
    const row = document.createElement('div'); row.className = 'pl-row';
    row.innerHTML = `<span class="dot"></span><span class="pn">${escapeHtml(p.name)}</span>` +
      (p.ready ? '<span class="ready-tag">Prêt</span>' : '') +
      `<span class="tag">${p.id === undefined ? '' : ''}${r.host && p.seat === s.you ? 'toi · hôte' : (p.seat === s.you ? 'toi' : '')}</span>`;
    list.appendChild(row);
  });
  for (let i = 0; i < r.bots; i++) {
    const row = document.createElement('div'); row.className = 'pl-row bot';
    row.innerHTML = '<span class="dot"></span><span class="pn">Bot</span><span class="tag">IA</span>';
    list.appendChild(row);
  }
  // contrôle bots (hôte)
  if (!waitBotsBuilt) { buildBotSeg('#wait-bots', r.bots, (n) => send({ type: 'setBots', bots: n })); waitBotsBuilt = true; }
  else [...$('#wait-bots').children].forEach((x, j) => x.classList.toggle('on', j === r.bots));
  const total = humans.length + r.bots;
  $('#btn-ready').classList.toggle('on', !!r.youReady);
  $('#btn-ready').textContent = r.youReady ? '✓ READY CONFIRMÉ' : 'JE SUIS PRÊT';
  if (total < 2) $('#wait-hostnote').textContent = r.host ? 'Ajoute un bot ou attends un ami (2 joueurs minimum).' : 'En attente d\'un autre joueur…';
  else if (r.humans < 2) $('#wait-hostnote').textContent = r.host ? '' : "En attente que l'hôte lance la partie…";
  else $('#wait-hostnote').textContent = `${r.readyCount}/${r.humans} joueur${r.humans > 1 ? 's' : ''} prêt${r.readyCount > 1 ? 's' : ''} — dès que tout le monde l'est, la partie démarre.`;
}
$('#btn-ready').onclick = () => { const s = snap; send({ type: 'toggleReady', ready: !(s && s.room && s.room.youReady) }); };
$('#btn-copy').onclick = () => { const c = $('#wait-code').textContent; navigator.clipboard && navigator.clipboard.writeText(c); toast('Code copié : ' + c); };
$('#btn-start').onclick = () => send({ type: 'startGame' });
$('#btn-leave').onclick = () => send({ type: 'leaveRoom' });
// confirmation maison (remplace confirm() natif du navigateur, qui ressemble à une fenêtre système)
function customConfirm(msg) {
  return new Promise((resolve) => {
    $('#confirm-msg').textContent = msg;
    $('#confirm-modal').hidden = false;
    const cleanup = (r) => { $('#confirm-modal').hidden = true; resolve(r); };
    $('#confirm-ok').onclick = () => cleanup(true);
    $('#confirm-cancel').onclick = () => cleanup(false);
  });
}
$('#btn-leave-game').onclick = async () => { if (await customConfirm('Quitter la partie ?')) send({ type: 'leaveRoom' }); };
$('#btn-quit-game').onclick = () => send({ type: 'leaveRoom' });
$('#btn-newgame').onclick = () => send({ type: 'newGame' });

/* ============================================================
   RENDU DU JEU (table)
   ============================================================ */
function renderGame(s) {
  // sécurité : au début d'une nouvelle main (ou au 1er snapshot, ex. reconnexion), tout élimination déjà
  // connue est forcément "vieille nouvelle" -> plus besoin de suspense, on la révèle tout de suite.
  if (s.handNo !== lastElimHand) { lastElimHand = s.handNo; s.seats.forEach((p, i) => { if (p && p.status === 'eliminated') revealedEliminated.add(i); }); }
  $('#lvl-num').textContent = s.level + 1;
  $('#lvl-sb').textContent = s.blinds.sb; $('#lvl-bb').textContent = s.blinds.bb;
  // pendant l'enchère, s.pot (le vrai total misé) ; à l'abattage il retombe à 0 côté serveur (chips déjà
  // distribués) -> on affiche alors le total figé dans s.pots, qu'on garde de toute façon pour le détail
  // "principal / secondaire" (side pots CALCULÉS par le moteur depuis le début, jamais montrés avant ce jour).
  const potsTotal = s.pots ? s.pots.reduce((a, p) => a + p.amount, 0) : 0;
  $('#pot-amount').textContent = s.pot || potsTotal;
  lastPot = s.pot;
  const sideEl = $('#side-pots');
  if (s.pots && s.pots.length > 1) {
    sideEl.hidden = false;
    sideEl.innerHTML = s.pots.map((p, i) =>
      `<span>${i === 0 ? 'Principal' : 'Side pot ' + i}&nbsp;: <b>${fmtK(p.amount)}</b></span>`).join('');
  } else sideEl.hidden = true;
  // marque "CHECK" persistante : réinitialisée à chaque nouvelle street / main
  if (s.street !== lastStreet || s.handNo !== lastCheckHand) { checkedSeats.clear(); lastStreet = s.street; lastCheckHand = s.handNo; }
  // SFX + tag CHECK selon la dernière action jouée
  if (s.lastAction && s.lastAction.seq !== lastActionSeq) {
    lastActionSeq = s.lastAction.seq;
    const a = s.lastAction.type, seat = s.lastAction.seat, p = s.seats[seat];
    if (a === 'check') { SFX.play('check'); checkedSeats.add(seat); }
    else { checkedSeats.delete(seat); }   // toute autre action retire le tag
    if (a === 'call') { SFX.play('chip'); if (p) sayBet(p, s); }
    else if (a === 'raise') {
      const bb = s.blinds ? s.blinds.bb : 0;
      if (bb > 0 && s.currentBet >= 2 * bb) { SFX.play('wow'); croupierSay('Wow !', 1300); } // mise >= 2x la blinde -> wow (remplace l'ancien crowd)
      else { SFX.play('miser'); if (p) sayBet(p, s); }
    }
  }
  lastCurrentBet = s.currentBet;
  const myTurn = s.toAct === s.you && s.phase === 'playing';   // c'est mon tour -> son yourturn (au passage)
  if (myTurn && !lastMyTurn) SFX.play('yourturn');
  lastMyTurn = myTurn;
  document.querySelectorAll('.card.made,.card.win,.card.dim').forEach(c => c.classList.remove('made', 'made-strong', 'win', 'dim'));
  seatEls.forEach(el => el.classList.remove('winner', 'loser'));
  renderCommunity(s.board);
  renderSeats(s);
  repaintEquity(); // resync du badge % (couvre reconnexion/refresh en plein tapis, en plus du recalcul par carte révélée)
  if (s.phase === 'playing' && s.handNo !== lastDealHand) { if (dealAnimation(s)) lastDealHand = s.handNo; } // nouvelle main -> distribution animée (réessaie si pas prêt)
  renderControls(s);
  updateMyHandInfo(s);
  if (s.phase === 'handComplete' && !winnerShown) {
    // sur un tapis général, plusieurs cartes du board peuvent arriver d'un coup dans CE snapshot (déjà en
    // handComplete) alors que renderCommunity vient tout juste de programmer leur révélation étalée ->
    // on n'annonce le gagnant qu'une fois cette révélation VISUELLEMENT terminée (winnerRevealAt).
    const wait = winnerRevealAt - Date.now();
    if (wait > 0) { if (!winnerTimer) winnerTimer = setTimeout(() => { winnerTimer = null; if (snap && snap.phase === 'handComplete') declareWinners(snap); }, wait); }
    else declareWinners(s);
  }
  updateShowBtn(s);
  detectEvents(s);
  // écran de victoire du tournoi : même souci que le WINNER de main -> ne l'afficher qu'une fois le
  // suspense de la dernière main (révélation du board) VISUELLEMENT terminé, pas dès que le snapshot arrive.
  if (s.phase === 'tournamentOver') {
    if (!victoryShown) {
      const wait = winnerRevealAt - Date.now();
      const reveal = () => {
        victoryShown = true; $('#victory').hidden = false;
        const w = s.seats.find(p => p && p.id === s.winner);
        $('#vtitle').textContent = (w ? w.name : 'Le vainqueur') + ' remporte le tournoi !';
      };
      if (wait > 0) { if (!victoryTimer) victoryTimer = setTimeout(() => { victoryTimer = null; if (snap && snap.phase === 'tournamentOver') reveal(); }, wait); }
      else reveal();
    }
  } else {
    $('#victory').hidden = true; victoryShown = false; clearTimeout(victoryTimer); victoryTimer = null;
  }
  if (($('#bottombar').offsetHeight || 0) !== lastBarH) fitBoard(); // la barre a changé de hauteur (contrôles affichés/masqués) -> re-caler la table
}

function makeCard(c, faceUp) {
  const el = document.createElement('div'); el.className = 'card';
  const front = c ? `url('cards/${c.code}.png')` : 'none';
  el.innerHTML = `<div class="card-inner"><div class="face back"></div><div class="face front" style="background-image:${front}"></div></div>`;
  if (c && faceUp) el.classList.add('flipped');
  if (c) el._code = c.code;
  return el;
}
/* ---------- équité (% de win) recalculée EN TEMPS RÉEL à chaque carte révélée ----------
   exacte par énumération quand il reste peu de cartes (flop/turn/river), Monte-Carlo sinon (préflop). */
let revealedBoardLen = 0;
function equityAt(s, boardLen) {
  if (!s || !s.equity) return null;                                  // le serveur ne signale l'équité qu'au tapis général
  const cont = [];
  for (let i = 0; i < 6; i++) { const p = s.seats[i]; if (p && p.inHand && !p.folded && p.hole && p.hole[0] && p.hole[1]) cont.push(p); }
  if (cont.length < 2) return null;                                  // besoin d'au moins 2 mains connues
  const board = s.board.slice(0, Math.max(0, boardLen));
  const known = new Set(board.map(c => c.code));
  cont.forEach(p => p.hole.forEach(c => known.add(c.code)));
  const deck = EV.makeDeck().filter(c => !known.has(c.code));
  const need = 5 - board.length;
  const win = {}; cont.forEach(p => win[p.seat] = 0); let total = 0;
  const tally = (full) => {
    let best = null, winners = [];
    for (const p of cont) { const sc = EV.bestHand(p.hole.concat(full)).score; const c = best ? EV.cmp(sc, best) : 1; if (c > 0) { best = sc; winners = [p.seat]; } else if (c === 0) winners.push(p.seat); }
    const share = 1 / winners.length; winners.forEach(seat => win[seat] += share); total++;
  };
  let combos = 1; for (let k = 0; k < need; k++) combos = combos * (deck.length - k) / (k + 1);
  if (need === 0) tally(board);                                      // river : résultat exact
  else if (combos <= 3000) {                                         // 1 ou 2 cartes à venir : énumération exacte
    const rec = (start, acc) => { if (acc.length === need) return tally(board.concat(acc)); for (let j = start; j < deck.length; j++) { acc.push(deck[j]); rec(j + 1, acc); acc.pop(); } };
    rec(0, []);
  } else {                                                           // préflop (trop de combinaisons) : Monte-Carlo léger
    const N = 800;
    for (let i = 0; i < N; i++) { const pool = deck.slice(), extra = []; for (let k = 0; k < need; k++) { const j = (Math.random() * pool.length) | 0; extra.push(pool[j]); pool[j] = pool[pool.length - 1]; pool.pop(); } tally(board.concat(extra)); }
  }
  const eq = {}; cont.forEach(p => eq[p.seat] = Math.round(win[p.seat] / total * 100));
  return eq;
}
function paintEquity(eq) {
  for (let seat = 0; seat < 6; seat++) {
    const p = snap && snap.seats[seat], el = seatEls[seat]; if (!el) continue;
    const eqb = el.querySelector('.eq-badge'); if (!eqb) continue;
    const has = eq && eq[seat] != null && p && !p.folded;
    eqb.hidden = !has; if (has) eqb.textContent = eq[seat] + '%';
  }
}
function repaintEquity() { paintEquity(equityAt(snap, revealedBoardLen)); }

let communityDone = 0, winnerRevealAt = 0, winnerTimer = null, winnerShown = false; // #victoire : n'annoncer qu'une fois le board VISUELLEMENT révélé
let victoryTimer = null, victoryShown = false; // écran de victoire du tournoi : même délai que winnerRevealAt
// suspense : un joueur éliminé PENDANT la main en cours ne doit s'afficher grisé/"Éliminé" qu'une fois la
// révélation du board terminée (déclarée par declareWinners) — sinon le badge spoile le résultat direct.
let revealedEliminated = new Set(), lastElimHand = -1;
let communityTimers = []; // setTimeout en attente de renderCommunity : à annuler si une nouvelle main arrive avant qu'ils ne se déclenchent
function renderCommunity(board) {
  const slots = $('#community').children; // 5 emplacements pointillés fixes
  // nouvelle main : annule tout setTimeout de révélation encore en attente de la main PRÉCÉDENTE, sinon il peut
  // se déclencher en retard sur le plateau tout juste vidé et y réinsérer une carte fantôme dans le mauvais slot.
  if (board.length < communityDone) { communityTimers.forEach(clearTimeout); communityTimers = []; [...slots].forEach(s => s.innerHTML = ''); communityDone = 0; revealedBoardLen = 0; }
  const start = communityDone;
  if (board.length <= start) { // filet de sécurité : rattrape toute carte restée face cachée (rien de nouveau à révéler ici)
    for (let i = 0; i < board.length; i++) { const card = slots[i] && slots[i].firstChild; if (card && !card.classList.contains('flipped')) card.classList.add('flipped'); }
    if (revealedBoardLen !== board.length) { revealedBoardLen = board.length; repaintEquity(); }
    // NE PAS remettre winnerRevealAt à "maintenant" ici : un snapshot ultérieur SANS nouvelle carte (ex: le
    // passage en tournamentOver, envoyé après la pause inter-mains) doit rester bloqué par la cible déjà
    // programmée par le DERNIER vrai lot de cartes, sinon l'écran de victoire coupe le suspense en cours.
    if (start === 0 && board.length === 0) winnerRevealAt = Date.now(); // rien n'a jamais été programmé (ex: tout début) -> pas d'attente
    return;
  }
  communityDone = board.length;
  // rivière qui renverse le gagnant : détectée AVANT de programmer les délais, pour pouvoir étirer celui
  // de la dernière carte (le reste de la logique de timing ne change pas pour les 4 premières cartes).
  const decisive = board.length === 5 && detectDecisiveRiver(board);
  const EXTRA = decisive ? 1600 : 0; // pause supplémentaire avant de retourner la river
  // dernière carte : son setTimeout démarre à (n-1)*1000ms + EXTRA, +30ms avant le flip, +650ms de transition CSS
  winnerRevealAt = Date.now() + (board.length - start) * 1000 + EXTRA + 700;
  // révélation une par une DANS son emplacement : carte face cachée puis retournée + son
  for (let i = start; i < board.length; i++) {
    const c = board[i], slot = slots[i], isRiver = decisive && i === 4;
    const id = setTimeout(() => {
      if (isRiver) { $('#board').classList.add('suspense'); SFX.play('tension'); croupierSay('Sur la river…', 1500); }
      const card = makeCard(c, false); slot.appendChild(card);
      void card.offsetWidth; // force le rendu du DOS avant de retourner (sinon le flip est sauté)
      // setTimeout (pas requestAnimationFrame) : le rAF est throttlé/sauté ici, la carte restait face cachée
      setTimeout(() => { card.classList.add('flipped'); SFX.play('flip'); if (isRiver) setTimeout(() => $('#board').classList.remove('suspense'), 1600); }, isRiver ? EXTRA : 30);
      if (snap) updateMyHandInfo(snap);
      revealedBoardLen = i + 1; repaintEquity(); // #10 : % de win recalculé en direct à chaque carte du board
    }, (i - start) * 1000); // révélation plus posée : 1 s entre chaque carte (+ EXTRA géré dans le flip lui-même pour la river)
    communityTimers.push(id);
  }
}
// la river change-t-elle qui mène la main ? comparé aux 4 premières cartes, pour les joueurs encore en jeu
// dont les cartes sont déjà connues (showdown/tapis général -> showAll côté serveur). Purement cosmétique :
// ne touche à AUCUNE règle, juste au rythme de la révélation.
function detectDecisiveRiver(board) {
  if (!snap) return false;
  const contenders = [];
  for (let i = 0; i < 6; i++) { const p = snap.seats[i]; if (p && p.inHand && !p.folded && p.hole && p.hole[0] && p.hole[1]) contenders.push(p); }
  if (contenders.length < 2) return false;
  const leader = (n) => {
    const b = board.slice(0, n); let best = null, seat = -1;
    contenders.forEach(p => { const s = EV.bestHand([...p.hole, ...b]).score; if (!best || EV.cmp(s, best) > 0) { best = s; seat = p.seat; } });
    return seat;
  };
  return leader(4) !== leader(5);
}
function renderSeats(s) {
  const occ = []; for (let i = 0; i < 6; i++) if (s.seats[i]) occ.push(i);
  const n = occ.length;
  const viewer = s.you >= 0 ? s.you : (occ[0] != null ? occ[0] : 0);
  const vIdx = Math.max(0, occ.indexOf(viewer));
  const slots = SEAT_SLOTS[n] || [0, 1, 2, 3, 4, 5];
  // sièges des blindes (pour libeller "SB"/"BB" au préflop) : heads-up -> bouton=SB
  const alive = []; for (let i = 0; i < 6; i++) { const p = s.seats[i]; if (p && p.status !== 'eliminated') alive.push(i); }
  const bi = alive.indexOf(s.button), blind = {};
  if (bi >= 0 && alive.length >= 2) { const hu = alive.length === 2; blind[alive[(bi + (hu ? 0 : 1)) % alive.length]] = 'SB'; blind[alive[(bi + (hu ? 1 : 2)) % alive.length]] = 'BB'; }
  if (s.handNo !== lastShowdownHand) {
    lastShowdownHand = s.handNo; showdownDelays = showdownOrder(s); // 1 seule fois par main -> délais stables
    // le retournement des mains décalé par joueur peut durer plus longtemps que la révélation du board (ex:
    // river déjà affichée depuis un moment, rien de neuf à révéler) -> repousser winnerRevealAt si besoin,
    // sinon le bandeau WINNER peut apparaître avant que tout le monde ait montré ses cartes.
    const seats = Object.keys(showdownDelays);
    if (seats.length) { const maxDelay = Math.max(...seats.map(k => showdownDelays[k])) + 340 + 300; winnerRevealAt = Math.max(winnerRevealAt, Date.now() + maxDelay); }
  }
  let collected = false; // au moins une mise ramenée au pot ce tour -> son "allbets"
  // classement par tapis (éliminés en dernier) -> badge 1er/2e/3e
  const rankMap = {};
  occ.map(i => s.seats[i]).sort((a, b) => {
    const ae = a.status === 'eliminated' && revealedEliminated.has(a.seat), be = b.status === 'eliminated' && revealedEliminated.has(b.seat);
    if (ae !== be) return ae ? 1 : -1;
    return b.stack - a.stack;
  }).forEach((p, i) => { rankMap[p.seat] = i + 1; });
  for (let seat = 0; seat < 6; seat++) {
    const p = s.seats[seat], el = seatEls[seat];
    if (!p) { el.style.display = 'none'; el.className = 'seat'; wasFolded[seat] = false; continue; }
    const elim = p.status === 'eliminated' && revealedEliminated.has(seat); // suspense : cf. revealedEliminated
    el.className = 'seat pos-' + slots[(occ.indexOf(seat) - vIdx + n) % n];
    el.style.display = '';
    if (seat === s.you) el.classList.add('me');
    if (p.folded) el.classList.add('folded');
    if (elim) el.classList.add('eliminated');
    if (!p.connected) el.classList.add('disconnected');
    if (s.toAct === seat && s.phase === 'playing') el.classList.add('active');
    const nameEl = el.querySelector('.pname'); nameEl.textContent = p.name; nameEl.classList.toggle('bot', p.isBot);
    const ava = el.querySelector('.ava-img'), aSrc = avatarImgSrc(p);
    if (ava.getAttribute('src') !== aSrc) ava.src = aSrc; // avatar assigné par le serveur (Pokémon ou personnalité, selon la partie)
    ava.classList.toggle('people', p.avatarKind === 'people');
    el.querySelector('.stack').textContent = elim ? 'Éliminé' : fmtK(p.stack);
    let db = el.querySelector('.dealer-btn');
    if (s.button === seat && !elim) { if (!db) { db = document.createElement('div'); db.className = 'dealer-btn'; db.textContent = 'D'; el.querySelector('.pod').appendChild(db); } }
    else if (db) db.remove();
    let rb = el.querySelector('.rank-badge');
    if (!rb) { rb = document.createElement('div'); rb.className = 'rank-badge'; el.querySelector('.pod').appendChild(rb); }
    const rk = rankMap[seat]; rb.textContent = rk === 1 ? '1er' : rk + 'e'; rb.className = 'rank-badge r' + (rk <= 3 ? rk : 0);
    const st = el.querySelector('.status'); st.textContent = p.allIn ? 'TAPIS' : ''; st.className = 'status' + (p.allIn ? ' allin' : '');
    // tag CHECK (bleu) / FOLD (rouge) sous le bloc
    const tag = el.querySelector('.check-tag');
    if (p.folded) { tag.hidden = false; tag.textContent = '✕ FOLD'; tag.className = 'check-tag fold'; }
    else if (checkedSeats.has(seat)) { tag.hidden = false; tag.textContent = '✓ CHECK'; tag.className = 'check-tag'; }
    else tag.hidden = true;
    const chips = el.querySelector('.chips');
    const prevBet = chips.hidden ? 0 : (+chips.dataset.bet || 0);   // valeur brute (le texte est formaté "3.5K")
    if (prevBet > 0 && !(p.bet > 0) && s.phase === 'playing' && s.handNo === flyHandNo) { flyChipToPot(chips); collected = true; } // fin de tour -> mise vers le pot
    chips.hidden = !(p.bet > 0); chips.dataset.bet = p.bet; chips.classList.toggle('allin', !!p.allIn); chips.querySelector('span').textContent = fmtK(p.bet);
    chips.classList.toggle('big', p.bet >= 2 * (s.blinds ? s.blinds.bb : 1e9) && !blind[seat]); // grosse mise -> doré
    if (p.bet > 0) { const ca = chips.querySelector('.chip-ava'), src = p.avatar ? avatarImgSrc(p) : ''; if (ca.getAttribute('src') !== src) ca.src = src; } // mini-avatar du joueur sur la mise
    chips.querySelector('.chip-blind').textContent = s.street === 'preflop' && blind[seat] ? blind[seat] : ''; // SB/BB au préflop
    if (prevBet === 0 && p.bet > 0) { chips.classList.remove('drop'); void chips.offsetWidth; chips.classList.add('drop'); } // le jeton se pose devant
    // (mise affichée en flux, collée sous le pseudo — voir CSS)
    const cardsEl = el.querySelector('.cards');
    // "montre ses cartes" : le viewer via son état local, les autres dès que le serveur envoie de vraies cartes
    const showing = seat === s.you ? viewerShows() : (p.hole || []).some(c => c);
    // tes propres cartes restent visibles pour toi après un fold (pour pouvoir les montrer) ; les autres mucent
    const shouldMuck = p.folded && !showing && seat !== s.you;
    // badge % de win : peint par repaintEquity() (recalcul en direct, voir renderCommunity) — pas ici
    if (p.folded && !wasFolded[seat] && s.phase === 'playing') SFX.play('fold'); // son de fold (joueur ou toi)
    const justFolded = p.folded && !wasFolded[seat] && cardsEl.children.length;
    if (justFolded && shouldMuck) muckCards(cardsEl);                               // adversaires : cartes jetées + disparaissent
    else if (justFolded && seat === s.you && !showing) { throwClone(cardsEl); renderSeatCards(cardsEl, p, false); } // TOI : copie jetée vers le board, cartes gardées grisées
    else renderSeatCards(cardsEl, p, shouldMuck, showdownDelays[seat]);
    wasFolded[seat] = p.folded;
  }
  if (collected) SFX.play('allbets');   // les jetons se réunissent au pot
  flyHandNo = s.handNo;
}
const wasFolded = [false, false, false, false, false, false];
let flyHandNo = -1, lastDealHand = -1;
// distribution : chaque carte apparait une par une depuis le plateau (deck/Ronflex), rapide.
// Robuste : la carte est cachée (opacity inline) puis RÉVÉLÉE par setTimeout (fiable) -> distribution même si l'anim ne tourne pas.
function dealAnimation(s) {
  const board = $('#board').getBoundingClientRect(); if (!board.width) return false;
  const deckEl = $('#deck'), deck = deckEl && deckEl.getBoundingClientRect();
  const dcx = deck && deck.width ? deck.left + deck.width / 2 : board.left + board.width / 2;
  const dcy = deck && deck.width ? deck.top + deck.height / 2 : board.top + board.height * 0.12;
  const occ = []; for (let i = 0; i < 6; i++) if (s.seats[i] && s.seats[i].inHand) occ.push(i);
  const list = [];
  for (let ci = 0; ci < 2; ci++) for (const seat of occ) { const c = seatEls[seat].querySelectorAll('.cards .card')[ci]; if (c) list.push(c); }
  if (!list.length || !list.some(c => c.getBoundingClientRect().width)) return false; // pas encore prêt -> on réessaiera
  list.forEach(card => { card.style.opacity = '0'; });   // tout caché au départ
  const croupier = $('#croupier'); if (croupier) croupier.classList.add('dealing'); // pose "distribue" le temps du deal
  croupierSay('Distribution…', 2000);
  const TOTAL = 3000, step = TOTAL / list.length; // étalée sur ~3s (avant : ~60ms/carte, quasi instantané)
  list.forEach((card, idx) => setTimeout(() => {
    card.style.opacity = '';                              // révèle la vraie carte (fiable)
    SFX.play('deal');                                      // une "pioche" par carte distribuée
    const r = card.getBoundingClientRect();
    const dx = dcx - (r.left + r.width / 2), dy = dcy - (r.top + r.height / 2);
    card.animate([{ transform: `translate(${dx}px,${dy}px) scale(.4)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 320, easing: 'cubic-bezier(.3,.75,.4,1)' });   // vol depuis le croupier
  }, idx * step));
  dealingUntil = Date.now() + TOTAL + 400; // "au tour de X" (detectEvents) attend la fin de la distribution pour parler
  setTimeout(() => { if (croupier) croupier.classList.remove('dealing'); }, TOTAL + 400); // retour idle une fois la distribution finie
  return true;
}
// TOI qui te couches : une COPIE de tes cartes file (face cachée) vers le plateau ; les vraies restent grisées (pour SHOW)
function throwClone(container) {
  const deck = $('#deck') || $('#community'); const to = deck && deck.getBoundingClientRect();
  [...container.children].forEach((card, i) => {
    const r = card.getBoundingClientRect();
    const c = card.cloneNode(true); c.classList.remove('flipped');
    Object.assign(c.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: 30, pointerEvents: 'none' });
    document.body.appendChild(c);
    let dx = 0, dy = -r.height * 2;
    if (to && to.width) { dx = (to.left + to.width / 2) - (r.left + r.width / 2); dy = (to.top + to.height / 2) - (r.top + r.height / 2); }
    c.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 40 - 20}deg) scale(.35)`, opacity: 0 }],
      { duration: 460, delay: i * 80, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' }).onfinish = () => c.remove();
  });
}
// place la mise sur la ligne siège->pot (à ~42% du chemin) : anneau autour du pot, pas de superposition
function positionBetChip(chips, seatEl) {
  const s = seatEl.getBoundingClientRect(), pot = $('#pot').getBoundingClientRect();
  if (!s.width || !pot.width) return;
  const dx = ((pot.left + pot.width / 2) - (s.left + s.width / 2)) * 0.42;
  const dy = ((pot.top + pot.height / 2) - (s.top + s.height / 2)) * 0.42;
  chips.style.left = '50%'; chips.style.top = '50%'; chips.style.right = 'auto'; chips.style.bottom = 'auto';
  chips.style.transform = `translate(calc(-50% + ${Math.round(dx)}px), calc(-50% + ${Math.round(dy)}px))`;
}
// mise collectée en fin de tour : un jeton vole du siège vers le pot
function flyChipToPot(chipsEl) {
  if (chipsEl.hidden) return;
  const from = chipsEl.getBoundingClientRect(), pot = $('#pot').getBoundingClientRect();
  if (!from.width || !pot.width) return;
  const fly = document.createElement('div'); fly.className = 'fly-chip';
  fly.style.left = (from.left + from.width / 2) + 'px'; fly.style.top = (from.top + from.height / 2) + 'px';
  document.body.appendChild(fly);
  const dx = (pot.left + pot.width / 2) - (from.left + from.width / 2), dy = (pot.top + pot.height / 2) - (from.top + from.height / 2);
  fly.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.5)`, opacity: 0 }],
    { duration: 430, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }).onfinish = () => fly.remove();
}
// le pot se distribue vers le(s) gagnant(s) (un ou plusieurs jetons animés selon le seat) — appelé depuis declareWinners
function flyPotToWinner(seat, amount, bb) {
  const seatEl = seatEls[seat], plate = seatEl && seatEl.querySelector('.plate');
  const pot = $('#pot').getBoundingClientRect();
  if (!plate || !pot.width) return;
  const to = plate.getBoundingClientRect(); if (!to.width) return;
  // plus le pot gagné est gros (donc plusieurs mises accumulées), plus il y a de jetons qui volent
  const N = Math.max(2, Math.min(7, Math.round((amount || 0) / (bb || 1000))));
  for (let i = 0; i < N; i++) {
    setTimeout(() => {
      const fly = document.createElement('div'); fly.className = 'fly-chip';
      fly.style.left = (pot.left + pot.width / 2) + 'px'; fly.style.top = (pot.top + pot.height / 2) + 'px';
      document.body.appendChild(fly);
      const dx = (to.left + to.width / 2) - (pot.left + pot.width / 2), dy = (to.top + to.height / 2) - (pot.top + pot.height / 2);
      fly.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.6)`, opacity: 0 }],
        { duration: 480, easing: 'cubic-bezier(.4,0,.7,.6)', fill: 'forwards' }).onfinish = () => fly.remove();
    }, i * 90);
  }
  SFX.play('chip');
}
// mise au rebut : les cartes filent face cachée vers le plateau du croupier (Ronflex) puis disparaissent
function muckCards(container) {
  const cards = [...container.children];
  if (!cards.length) { container.innerHTML = ''; container.dataset.sig = 'muck'; return; }
  const deck = $('#deck') || $('#community');
  const to = deck && deck.getBoundingClientRect();
  const from = container.getBoundingClientRect();
  let dx = 0, dy = -from.height * 1.8;
  if (to && to.width) { dx = (to.left + to.width / 2) - (from.left + from.width / 2); dy = (to.top + to.height / 2) - (from.top + from.height / 2); }
  cards.forEach((card, i) => {
    card.classList.remove('flipped'); // jetées face cachée
    card.style.zIndex = 9;
    card.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 44 - 22}deg) scale(.32)`, opacity: 0 }
    ], { duration: 460, delay: i * 80, easing: 'cubic-bezier(.55,0,.85,.4)', fill: 'forwards' });
  });
  // pas de son ici : les cartes ne se RETOURNENT pas (elles étaient déjà face cachée, jetées telles quelles)
  // -> le son de fold (joué par l'appelant juste avant) ne doit pas être couvert par un 'flip' hors-sujet.
  setTimeout(() => { container.innerHTML = ''; container.dataset.sig = 'muck'; }, 460 + cards.length * 80 + 60);
}
function statusText(p) { if (p.status === 'eliminated') return ''; if (p.folded) return 'Couché'; if (p.allIn) return 'Tapis'; return ''; }
// ordre d'abattage réel du poker : le dernier agresseur (dernier à avoir misé/relancé) retourne EN PREMIER,
// puis les autres suivent dans le sens horaire ; si personne n'a misé (tout le monde a checké), le 1er
// joueur après le bouton montre en premier. Calculé UNE fois par main (pas par siège) pour un ordre cohérent.
function showdownOrder(s) {
  const live = []; for (let i = 0; i < 6; i++) { const p = s.seats[i]; if (p && p.inHand && !p.folded) live.push(i); }
  if (live.length < 2) return {};
  const start = (s.lastAggressor >= 0 && live.includes(s.lastAggressor)) ? s.lastAggressor
    : live.find(seat => seat > s.button) ?? live[0]; // personne n'a misé -> 1er après le bouton (sens horaire)
  const startIdx = Math.max(0, live.indexOf(start));
  const ordered = [...live.slice(startIdx), ...live.slice(0, startIdx)];
  const delays = {}; ordered.forEach((seat, i) => { delays[seat] = i * 550; });
  return delays;
}
let lastShowdownHand = -1, showdownDelays = {};
function renderSeatCards(container, p, mucked, extraDelay) {
  const hole = p.hole || [];
  // couché sans montrer ses cartes -> tapis vide (elles ont été jetées)
  if (mucked) { if (container.dataset.sig !== 'muck') { container.innerHTML = ''; container.dataset.sig = 'muck'; } return; }
  const sig = hole.map(c => c ? c.code : 'x').join(',');
  if (container.dataset.sig === sig) return;
  const prev = container.dataset.sig || '';
  const wasFaceDown = prev.length && prev.split(',').every(x => x === 'x');
  const revealing = wasFaceDown && hole.length && hole.every(c => c) && container.children.length === hole.length;
  if (revealing) {
    // ABATTAGE : on RETOURNE les cartes existantes (dos -> face) une par une + son, décalé par joueur
    // (extraDelay, voir showdownOrder) pour respecter l'ordre réel : dernier agresseur d'abord, puis sens horaire.
    [...container.children].forEach((card, i) => {
      card.querySelector('.front').style.backgroundImage = `url('cards/${hole[i].code}.png')`;
      card._code = hole[i].code;
      setTimeout(() => { card.classList.add('flipped'); SFX.play('flip'); }, (extraDelay || 0) + i * 340);
    });
  } else {
    container.innerHTML = '';
    hole.forEach(c => container.appendChild(makeCard(c, !!c)));
  }
  container.dataset.sig = sig;
}
function highlight(codes, cls) { const parts = cls.split(' '); document.querySelectorAll('.card').forEach(c => { if (c._code && codes.has(c._code)) c.classList.add(...parts); }); }
// détail textuel d'une main FAITE (au-delà du simple nom de catégorie) : pour double paire/quinte/full,
// donne les rangs qui la composent ("As et 4", "Quinte hauteur Roi", "Rois par les 4"), comme demandé.
// Les autres catégories (carte haute/paire/brelan/carré) sont déjà assez explicites via made.name.
// texte détaillé + "Force" (plus haut rang RÉELLEMENT représentatif) d'une main faite. Les deux sortent de
// la MÊME fonction pour la quinte : la roue (A-2-3-4-5) doit compter comme hauteur 5 dans les DEUX cas,
// sinon la Force afficherait 14 (l'As) pour la pire quinte possible -> contradiction visible à l'écran.
function handDetail(made) {
  const rl = EV.rankLabel, maxRank = Math.max(...made.cards.map(c => c.r));
  if (made.cat === 2) { // double paire
    const ranks = [...new Set(made.cards.map(c => c.r))].sort((a, b) => b - a);
    return { text: rl(ranks[0], false) + ' et ' + rl(ranks[1], false), force: maxRank };
  }
  if (made.cat === 4 || made.cat === 8) { // quinte / quinte flush (gère la roue A-2-3-4-5 -> hauteur 5, pas As)
    const rs = made.cards.map(c => c.r);
    const high = (rs.includes(14) && rs.includes(5) && rs.includes(2)) ? 5 : maxRank;
    return { text: (made.cat === 4 ? 'Quinte hauteur ' : made.name + ' hauteur ') + rl(high, false), force: high };
  }
  if (made.cat === 5) return { text: 'Couleur hauteur ' + rl(made.cards[0].r, false), force: maxRank }; // couleur
  if (made.cat === 6) return { text: rl(made.cards[0].r, true) + ' par les ' + rl(made.cards[3].r, false), force: made.cards[0].r }; // full : cards[0..2]=brelan, [3..4]=paire
  return { text: made.name, force: maxRank };
}
function updateMyHandInfo(s) {
  document.querySelectorAll('.card.made').forEach(c => c.classList.remove('made', 'made-strong'));
  // GARDE-FOU : masque la boîte "MAIN DE DÉPART / Force" sur TOUS les autres sièges à chaque appel. Sans ça,
  // si TON siège change d'une partie à l'autre (tu étais siège 1 avant, un autre joueur occupe ce siège
  // maintenant), le DOM du siège 1 gardait ta VIEILLE main affichée -> ça ressemble à "je vois les cartes
  // de l'adversaire" (signalé en jeu réel), alors que le serveur, lui, ne renvoie jamais les vraies cartes
  // adverses avant l'abattage (vérifié). Défense en profondeur : ne fait confiance qu'au siège s.you.
  for (let i = 0; i < 6; i++) { if (i !== s.you && seatEls[i]) { const other = seatEls[i].querySelector('.hand-label'); if (other) other.hidden = true; } }
  const me = s.you >= 0 ? s.seats[s.you] : null;
  const hl = s.you >= 0 && seatEls[s.you] ? seatEls[s.you].querySelector('.hand-label') : null;
  if (!hl || !me || s.phase === 'tournamentOver' || me.folded || !me.hole || !me.hole[0]) { if (hl) hl.hidden = true; setOuts(null); return; }
  // IMPORTANT : on évalue sur les cartes VISUELLEMENT révélées (revealedBoardLen), pas s.board brut. Au
  // tapis général, le serveur envoie le board COMPLET d'un coup (5 cartes) mais le client les retourne une
  // par une à l'écran (renderCommunity) -> évaluer sur s.board directement affichait "Paire de Rois" avant
  // même que le Roi soit visible sur le tapis (signalé en jeu réel : "on voit Paire de Rois, 0 carte tirée").
  const board = s.board.slice(0, revealedBoardLen);
  if (board.length === 0) { // préflop : "carte haute"/"paire" ne veut rien dire avant le board -> Chen Score
    const [c0, c1] = me.hole, chen = EV.chenScore(me.hole);
    hl.innerHTML = `<b>MAIN DE DÉPART</b><span class="hl-cards">${EV.rankCode(c0.r)}${SUIT_SYM[c0.s]} ${EV.rankCode(c1.r)}${SUIT_SYM[c1.s]}</span><span class="hl-sub">Chen Score&nbsp;: ${chen}</span>`;
    hl.className = 'hand-label box' + (chen >= 10 ? ' strong' : chen < 5 ? ' weak' : '');
    hl.hidden = false;
    setOuts(null);
    return;
  }
  const made = EV.evalMade([...me.hole, ...board]);
  const strong = made.cat >= 3;                          // brelan+ -> doré ; carte haute/paire/double -> bleu
  if (made.cat >= 1) highlight(new Set(made.cards.map(c => c.code)), strong ? 'made made-strong' : 'made');
  // rang de catégorie 1-10 (demande explicite) = cat interne (0-9) + 1 ; "Force" = plus haut rang RÉEL
  // -> distingue Paire de 4 (Force 4) de Paire d'As (Force 14) au sein d'une même catégorie
  // (comparaison OFFICIELLE inchangée : ce nombre est un AFFICHAGE, le vrai départage du pot reste EV.cmp).
  const rank10 = made.cat + 1, detail = handDetail(made);
  hl.innerHTML = `<b>${EV.HAND_NAMES[made.cat].toUpperCase()}<span class="hl-rank">${rank10}/10</span></b><span class="hl-sub">${detail.text}</span><span class="hl-sub">Force&nbsp;: ${detail.force}</span>`;
  hl.className = 'hand-label box' + (strong ? ' strong' : '');
  hl.hidden = false;
  setOuts(drawInfo(me.hole, board), board.length);
}
const SUIT_SYM = { h: '♥', d: '♦', c: '♣', s: '♠' };
// tirage : catégorie + % + puces "Any" (par couleur si tirage couleur, sinon par rang)
function drawInfo(hole, board) {
  const outs = EV.computeOuts(hole, board);
  if (!outs.length) return null;
  const cat = outs[0].cat, known = new Set([...hole, ...board].map(c => c.code));
  const deck = EV.makeDeck().filter(c => !known.has(c.code));
  const outCards = deck.filter(c => EV.evalMade([...hole, ...board, c]).cat >= cat);
  const u = deck.length, no = u - outCards.length;
  const pct = Math.round((board.length === 4 ? outCards.length / u : 1 - (no * (no - 1)) / (u * (u - 1))) * 100);
  const suits = new Set(outCards.map(c => c.s)), ranks = new Set(outCards.map(c => c.r));
  const chips = (suits.size === 1 && ranks.size > 1)          // toutes les outs d'une même couleur -> tirage couleur
    ? [{ suit: [...suits][0] }]
    : [...ranks].sort((a, b) => b - a).slice(0, 2).map(r => ({ rank: r }));
  return { cat, pct, chips };
}
// boîte OUTS ("Any ♣" / "Any A") + % du tirage, posée sur le prochain emplacement vide (turn/river)
function setOuts(d, boardLen) {
  const box = $('#outs-box');
  if (!d) { box.hidden = true; return; }
  box.hidden = false;
  box.querySelector('.outs-pct').textContent = `${d.pct}%`;
  const wrap = box.querySelector('.outs-cards'); wrap.innerHTML = '';
  d.chips.forEach(ch => { const el = document.createElement('div'); el.className = 'out-chip';
    const val = ch.suit ? SUIT_SYM[ch.suit] : EV.rankCode(ch.rank);
    const red = ch.suit === 'h' || ch.suit === 'd';
    el.innerHTML = `<span class="out-any">Any</span><span class="out-rank${red ? ' red' : ''}">${val}</span>`; wrap.appendChild(el); });
  const bd = $('#board').getBoundingClientRect(), slot = document.querySelectorAll('#community .slot')[Math.min(boardLen || 3, 4)];
  if (bd.width && slot) { const r = slot.getBoundingClientRect();
    box.style.left = ((r.left + r.width / 2 - bd.left) / bd.width * 100) + '%';
    box.style.top = ((r.top + r.height / 2 - bd.top) / bd.height * 100) + '%'; }
}
// nb réel de cartes atteignant >= targetCat + proba de toucher (flop -> 2 cartes à venir, turn -> 1)
function outsInfo(hole, board, targetCat) {
  const known = new Set([...hole, ...board].map(c => c.code));
  const deck = EV.makeDeck().filter(c => !known.has(c.code));
  let outs = 0;
  for (const c of deck) { if (EV.evalMade([...hole, ...board, c]).cat >= targetCat) outs++; }
  const u = deck.length, no = u - outs;                    // cartes inconnues / non-outs
  // ponytail: proba de TOUCHER le tirage (pas l'équité réelle vs adversaires)
  const pct = board.length === 4 ? outs / u : 1 - (no * (no - 1)) / (u * (u - 1));
  return { outs, pct: Math.round(pct * 100) };
}
// clic sur UN bouton SHOW (idx 0=gauche, 1=droite) : révèle CETTE carte tout de suite en fin de main, sinon l'arme
function toggleShow(idx) {
  if (!snap) return;
  if (snap.phase === 'handComplete') { send({ type: 'show', card: idx }); shownCard[idx] = true; }
  else showCard[idx] = !showCard[idx];
  updateShowBtn(snap);
}
function updateShowBtn(s) {
  const me = s.you >= 0 ? s.seats[s.you] : null;
  const canShow = !!(me && me.folded && me.inHand && (s.phase === 'playing' || s.phase === 'handComplete'));
  $('#btn-show').hidden = true;                              // remplacé par les 2 boutons SHOW (un par carte)
  const seatEl = s.you >= 0 ? seatEls[s.you] : null;
  if (seatEl) seatEl.querySelectorAll('.show-btn').forEach(b => {
    const idx = b.classList.contains('r') ? 1 : 0;
    b.style.display = (canShow && !shownCard[idx]) ? 'block' : 'none';
    b.classList.toggle('on', showCard[idx]);
  });
  // fin de main : on envoie les cartes armées non encore envoyées
  if (s.phase === 'handComplete' && me && me.folded && me.inHand) {
    [0, 1].forEach(idx => { if (showCard[idx] && !shownCard[idx]) { send({ type: 'show', card: idx }); shownCard[idx] = true; } });
  }
}
function highlightWinners(s) {
  const winners = (s.results || []).filter(r => r.won > 0);
  if (!winners.length) return;
  const winCodes = new Set();
  winners.forEach(r => { const p = s.seats[r.seat]; if (p && p.hole && p.hole[0] && s.board.length >= 3) { const bh = EV.bestHand([...p.hole, ...s.board]); if (bh) bh.cards.forEach(c => winCodes.add(c.code)); } }); // >=3 cartes board sinon bestHand (5 cartes) renvoie null (gain preflop par fold)
  // 5 cartes du combo surélevées + brillantes ; toutes les autres grisées
  document.querySelectorAll('.card').forEach(c => { if (!c._code) return; c.classList.add(winCodes.has(c._code) ? 'win' : 'dim'); });
  const winSeats = new Set(winners.map(r => r.seat));
  winners.forEach(r => { // label "WINNER !" + pseudo, tout en haut du pod
    const el = seatEls[r.seat]; if (!el) return;
    el.classList.add('winner');
    const p = s.seats[r.seat], wl = el.querySelector('.winner-label');
    if (wl && p) wl.innerHTML = '<b>WINNER !</b><span>' + escapeHtml(p.name) + '</span>';
  });
  // "PERDU" en rouge sur les joueurs allés à l'abattage (cartes révélées, pas couchés) mais pas gagnants
  for (let seat = 0; seat < 6; seat++) {
    const p = s.seats[seat]; if (!p || !p.inHand || p.folded || winSeats.has(seat)) continue;
    const el = seatEls[seat]; if (!el) continue;
    el.classList.add('loser');
    const ll = el.querySelector('.loser-label');
    if (ll) ll.innerHTML = '<b>PERDU</b><span>' + escapeHtml(p.name) + '</span>';
  }
}
// annonce complète du gagnant (highlight + son + bannière combo) — appelée une seule fois par main,
// seulement une fois le board VISUELLEMENT révélé en entier (voir winnerRevealAt dans renderCommunity)
function declareWinners(s) {
  if (winnerShown) return; winnerShown = true;
  highlightWinners(s);
  // le board vient de finir de se révéler visuellement : les éliminations de CETTE main peuvent enfin s'afficher
  let newlyRevealed = false;
  s.seats.forEach((p, i) => { if (p && p.status === 'eliminated' && !revealedEliminated.has(i)) { revealedEliminated.add(i); newlyRevealed = true; } });
  if (newlyRevealed) renderSeats(s);
  const winners = (s.results || []).filter(r => r.won > 0);
  if (winners.length) {
    SFX.play('win');
    croupierBravo(); // pose "bravo" du croupier
    winners.forEach((r, i) => setTimeout(() => flyPotToWinner(r.seat, r.won, s.blinds && s.blinds.bb), i * 120)); // les jetons du pot filent vers CHAQUE gagnant (partage compris), plus nombreux si le pot est gros
    const banner = $('#combo-banner');
    if (winners.length >= 2) { banner.textContent = 'PARTAGE'; banner.classList.add('split'); banner.hidden = false; } // égalité -> "PARTAGE" en violet
    else {
      banner.classList.remove('split');
      const p = s.seats[winners[0].seat];
      if (p && p.hole && p.hole[0]) showComboBanner(EV.evalMade([...p.hole, ...s.board]).name);
    }
  }
}

function hideControls() { ['#btn-fold', '#btn-check', '#btn-call', '#btn-allin'].forEach(x => $(x).hidden = true); $('#raise-box').hidden = true; }
// --- pré-actions (cocher son coup à l'avance quand ce n'est pas son tour) ---
function paSet(active) { ['checkfold', 'check', 'callany'].forEach(a => $('#pa-' + a).classList.toggle('on', a === active)); }
function togglePre(a) { preAction = preAction === a ? null : a; paSet(preAction); }
function resolvePreAction(la) {           // exécute le coup pré-armé s'il est encore valide ; sinon rend la main
  const a = preAction; preAction = null; paSet(null);
  if (a === 'checkfold') { sendAction(la.canCheck ? { type: 'check' } : { type: 'fold' }); return true; }
  if (a === 'check' && la.canCheck) { sendAction({ type: 'check' }); return true; }
  if (a === 'callany') { if (la.canCall) { sendAction({ type: 'call' }); return true; } if (la.canCheck) { sendAction({ type: 'check' }); return true; } }
  return false;                           // ex: "check" mais une mise est arrivée -> le joueur décide
}
function renderControls(s) {
  const la = s.legal, me = s.you >= 0 ? s.seats[s.you] : null;
  const inHand = me && !me.folded && !me.allIn && me.inHand && s.phase === 'playing';
  if (!la || s.toAct !== s.you || !inHand) {          // pas mon tour
    hideControls();
    const pa = $('#preactions');
    if (inHand && s.toAct >= 0 && s.toAct !== s.you) { // encore dans le coup -> proposer les pré-actions
      pa.hidden = false;
      $('#pa-check').disabled = s.currentBet > (me.bet || 0);   // pas de check si une mise est en cours
      if (preAction === 'check' && $('#pa-check').disabled) { preAction = null; }
      paSet(preAction);
    } else { pa.hidden = true; preAction = null; }
    return;
  }
  $('#preactions').hidden = true;                     // c'est mon tour
  if (preAction && resolvePreAction(la)) return;      // un coup était pré-armé
  const fold = $('#btn-fold'), check = $('#btn-check'), call = $('#btn-call'), allin = $('#btn-allin'), box = $('#raise-box');
  fold.hidden = false; fold.disabled = false;
  check.hidden = !la.canCheck; check.disabled = false;
  call.hidden = !la.canCall; call.disabled = false;
  call.textContent = la.callAmount >= me.stack ? `All-in (${me.stack})` : `Suivre ${la.callAmount}`;
  allin.hidden = !la.canAllIn || la.maxRaiseTo <= s.currentBet; allin.disabled = false;
  if (la.canRaise && la.maxRaiseTo > la.minRaiseTo) {
    box.hidden = false; const sl = $('#raise-slider');
    sl.min = la.minRaiseTo; sl.max = la.maxRaiseTo; sl.step = Math.max(10, s.blinds.sb);
    sl.value = la.minRaiseTo; $('#raise-amount').textContent = la.minRaiseTo;
  } else box.hidden = true;
}
function wireControls() {
  $('#btn-fold').onclick = () => sendAction({ type: 'fold' });
  $('#btn-check').onclick = () => sendAction({ type: 'check' });
  $('#btn-call').onclick = () => sendAction({ type: 'call' });
  $('#btn-allin').onclick = () => sendAction({ type: 'allin' });
  $('#btn-raise').onclick = () => sendAction({ type: 'raise', amount: +$('#raise-slider').value });
  document.querySelectorAll('.quick').forEach(b => b.onclick = () => quickRaise(+b.dataset.mult));
  $('#raise-slider').oninput = function () { $('#raise-amount').textContent = (+this.value === +this.max ? this.value + ' (tapis)' : this.value); };
  ['checkfold', 'check', 'callany'].forEach(a => $('#pa-' + a).onclick = () => togglePre(a));
}
// mise rapide ×N : relance à N fois la mise en cours (ou la BB si personne n'a misé), clampée
function quickRaise(mult) {
  const la = snap && snap.legal;
  if (!la || !la.canRaise || snap.toAct !== snap.you) return;
  const base = snap.currentBet > 0 ? snap.currentBet : (snap.blinds ? snap.blinds.bb : 0);
  const amt = Math.max(la.minRaiseTo, Math.min(la.maxRaiseTo, Math.round(base * mult)));
  sendAction({ type: 'raise', amount: amt });
}

/* bulle Ronflex */
let bubbleTimer = null, lastHandNo = -1, lastPhase = '', croupierBravoTimer = null, lastAnnouncedToAct = -2, gameStartSaid = false, headsUpSaid = false;
let dealingUntil = 0, toActAnnounceTimer = null; // "au tour de X" attend la fin de la distribution (voir dealAnimation)
let betAnnouncedUntil = 0; // idem : "au tour de X" attend aussi la fin d'une annonce de mise toute fraîche (même bulle du croupier, une seule à la fois)
function croupierSay(msg, ms = 1500) { const b = $('#ronflex-bubble'); b.textContent = msg; b.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => b.classList.remove('show'), ms); }
function croupierBravo() { const c = $('#croupier'); if (!c) return; c.classList.remove('bravo'); void c.offsetWidth; c.classList.add('bravo'); clearTimeout(croupierBravoTimer); croupierBravoTimer = setTimeout(() => c.classList.remove('bravo'), 3200); }
let allInSeen = new Set(), allInTimer = null;
function flashAllIn(s) {
  const b = $('#allin-banner'); b.innerHTML = `ALL IN<em>${s.pot}</em>`;
  b.hidden = false; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); SFX.play('allin'); croupierSay('Wow !', 1300); // son dédié all-in (avant : réutilisait 'wow')
  clearTimeout(allInTimer); allInTimer = setTimeout(() => { b.hidden = true; }, 2200);
}
// onde brillante qui sort de l'avatar et s'efface, au moment du tapis
function rippleAllIn(seat) {
  const av = seatEls[seat] && seatEls[seat].querySelector('.avatar'); if (!av) return;
  av.classList.remove('ripple'); void av.offsetWidth; av.classList.add('ripple');
  setTimeout(() => av.classList.remove('ripple'), 900);
}
function detectEvents(s) {
  if (s.phase === 'playing' && s.handNo !== lastHandNo) {
    SFX.play('deal'); $('#combo-banner').hidden = true; $('#allin-banner').hidden = true; // (les règles restent ouvertes : un joueur qui les lit ne doit pas les voir se fermer à chaque main)
    allInSeen.clear(); showCard[0] = showCard[1] = shownCard[0] = shownCard[1] = false; preAction = null; lastHandNo = s.handNo;
    winnerShown = false; clearTimeout(winnerTimer); winnerTimer = null; victoryShown = false; clearTimeout(victoryTimer); victoryTimer = null;
    lastAnnouncedToAct = -2; // réarme l'annonce "au tour de X" pour cette nouvelle main
    const alive = s.seats.filter(p => p && p.status !== 'eliminated').length;
    if (!gameStartSaid) { gameStartSaid = true; croupierSay('Bonne partie !', 1800); }
    else if (alive === 2 && !headsUpSaid) { headsUpSaid = true; croupierSay('Tête à tête !', 1800); } // une seule fois (évident dès qu'on y est, pas la peine de le répéter à chaque main)
    if (alive > 2) headsUpSaid = false; // réarme si le duel se termine (rejoin/nouvelle partie à plus de 2)
  }
  if (s.phase === 'playing') for (let i = 0; i < 6; i++) { const p = s.seats[i]; if (p && p.allIn && !allInSeen.has(i)) { allInSeen.add(i); flashAllIn(s); rippleAllIn(i); } }
  // "au tour de X" à chaque changement de joueur actif — attend la fin de la distribution (dealingUntil,
  // voir dealAnimation) pour ne pas parler par-dessus le "Distribution…" pendant que les cartes volent encore.
  if (s.phase === 'playing' && s.toAct >= 0 && s.toAct !== lastAnnouncedToAct) {
    lastAnnouncedToAct = s.toAct;
    const p = s.seats[s.toAct];
    const wait = Math.max(dealingUntil, betAnnouncedUntil) - Date.now(); // laisse le temps de voir "X a misé Y" avant de la remplacer
    if (p && wait > 0) { clearTimeout(toActAnnounceTimer); const seatAtCall = s.toAct; toActAnnounceTimer = setTimeout(() => { if (snap && snap.toAct === seatAtCall) croupierSay(seat_toAct_msg(snap, snap.seats[seatAtCall]), 1200); }, wait); }
    else if (p) croupierSay(seat_toAct_msg(s, p), 1200);
  }
  // annonce du gagnant (highlight + son + bannière) : voir declareWinners(), appelé depuis renderGame une fois le board révélé
  if (s.phase === 'tournamentOver' && lastPhase !== 'tournamentOver') { $('#combo-banner').hidden = true; $('#rules-modal').hidden = true; } // ne doit pas rester ouverte par-dessus l'écran de victoire
  lastPhase = s.phase;
}
function seat_toAct_msg(s, p) { return (p.seat === s.you ? 'À toi de jouer' : 'Au tour de ' + p.name); }
// annonce du croupier après une mise/suivi (pas les checks/folds, "misé" implique des jetons engagés) ;
// p.bet = déjà la mise TOTALE de ce joueur sur la street en cours (état post-action du snapshot).
function betAnnounce(p, s) { return (p.seat === s.you ? 'Tu as misé ' : p.name + ' a misé ') + fmtK(p.bet); }
function sayBet(p, s) { const ms = 1400; croupierSay(betAnnounce(p, s), ms); betAnnouncedUntil = Date.now() + ms; }
function showComboBanner(name) { const b = $('#combo-banner'); b.textContent = name.toUpperCase(); b.hidden = false; }

/* timers (temps serveur) */
let lastTickSec = -1, lastTickToAct = -2; // tic-tac : une fois par seconde entière, dans les dernières secondes du tour de CHACUN
function tick() {
  requestAnimationFrame(tick);
  if (!snap || currentScreen !== 'game') return;
  const serverNow = Date.now() + timeOffset, total = (snap.actionTime || 10) * 1000;
  if (snap.toAct !== lastTickToAct) { lastTickToAct = snap.toAct; lastTickSec = -1; } // nouveau joueur actif -> réarme le compteur
  seatEls.forEach((el) => {
    if (!el.classList.contains('active')) return;
    const remain = Math.max(0, snap.deadline - serverNow), frac = Math.max(0, Math.min(1, remain / total));
    const ring = el.querySelector('.ring');
    ring.style.setProperty('--frac', frac.toFixed(3));
    ring.style.setProperty('--ring-col', frac < 0.2 ? '#ff5145' : frac < 0.45 ? '#ffb14a' : '#37d472'); // vert, puis orange/rouge en fin de temps
    const remainSec = Math.ceil(remain / 1000);
    if (remainSec <= 5 && remainSec >= 1 && remainSec !== lastTickSec) { lastTickSec = remainSec; SFX.play('tick'); }
  });
  const remainLvl = Math.max(0, (snap.levelEndsAt || 0) - serverNow);
  const mm = Math.floor(remainLvl / 60000), ss = Math.floor((remainLvl % 60000) / 1000);
  const clk = $('#lvl-clock'); clk.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); clk.classList.toggle('low', remainLvl < 30000);
}

let lastBarH = -1;
function fitBoard() {
  const board = $('#board'); if ($('#stage').hidden) return;
  const R = 16 / 9; // plateau 16:9
  lastBarH = $('#bottombar').offsetHeight || 0; // réserver la barre d'action (fixed) : sinon elle cache le siège du bas (pseudo + tapis)
  const availH = window.innerHeight - lastBarH, availW = window.innerWidth;
  const bw = Math.min(availW, availH * R);
  board.style.width = bw + 'px'; board.style.height = bw / R + 'px';
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* boot */
wireControls();
/* ---------- panneau de règles (3 onglets), ouvert depuis le menu ET en jeu ---------- */
function openRules(tab) {
  showRulesTab(tab || 'but');
  $('#rules-modal').hidden = false;
}
function showRulesTab(t) {
  document.querySelectorAll('#rules-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.rules-body section').forEach(s => { s.hidden = s.dataset.p !== t; });
}
document.querySelectorAll('#rules-tabs button').forEach(b => b.onclick = () => showRulesTab(b.dataset.t));
$('#rules-close').onclick = () => { $('#rules-modal').hidden = true; };
$('#rules-modal').onclick = (e) => { if (e.target.id === 'rules-modal') $('#rules-modal').hidden = true; }; // clic sur le fond = fermer
$('#btn-combos').onclick = (e) => { e.stopPropagation(); openRules(); };
$('#btn-rules-land').onclick = () => openRules();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#rules-modal').hidden) $('#rules-modal').hidden = true; });
$('#btn-show').onclick = () => toggleShow(0); // (bouton du bas, non utilisé - remplacé par les SHOW par carte)
initChat();
initEmote();
window.addEventListener('resize', fitBoard);
window.addEventListener('orientationchange', () => setTimeout(fitBoard, 200));
requestAnimationFrame(tick);
showScreen('landing');
connect();
