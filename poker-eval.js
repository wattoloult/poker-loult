/* ============================================================
   POKER LOULT — logique pure d'évaluation des mains
   Partagé entre le client (navigateur) et le serveur (Node).
   Aucun DOM, aucun réseau. Déterministe et testable.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / serveur
  else root.PokerEval = api;                                                 // navigateur
})(typeof self !== 'undefined' ? self : this, function () {

  const SUITS = ['h', 'd', 's', 'c'];
  const HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte',
    'Couleur', 'Full', 'Carré', 'Quinte flush', 'Quinte flush royale'];

  function rankCode(r) { return r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : '' + r; }
  function rankLabel(r, plural) {
    if (r === 14) return 'As';
    if (r === 13) return plural ? 'Rois' : 'Roi';
    if (r === 12) return plural ? 'Dames' : 'Dame';
    if (r === 11) return plural ? 'Valets' : 'Valet';
    return '' + r;
  }
  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ r, s, code: s + rankCode(r) });
    return d;
  }

  /* ---- score comparable de 5 cartes ---- */
  function rank5(cards) {
    const ranks = cards.map(c => c.r).sort((a, b) => b - a);
    const flush = cards.every(c => c.s === cards[0].s);
    const uniq = [...new Set(ranks)].sort((a, b) => b - a);
    let straightHigh = 0;
    if (uniq.length === 5) {
      if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
      else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
    }
    const cnt = {}; ranks.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
    const groups = Object.entries(cnt).map(([r, c]) => [c, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const counts = groups.map(g => g[0]);
    const byCount = groups.map(g => g[1]);
    if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
    if (counts[0] === 4) return [7, ...byCount];
    if (counts[0] === 3 && counts[1] === 2) return [6, ...byCount];
    if (flush) return [5, ...ranks];
    if (straightHigh) return [4, straightHigh];
    if (counts[0] === 3) return [3, ...byCount];
    if (counts[0] === 2 && counts[1] === 2) return [2, ...byCount];
    if (counts[0] === 2) return [1, ...byCount];
    return [0, ...byCount];
  }
  function cmp(a, b) { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
  function combos5(cards) {
    const res = [], n = cards.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
      for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++)
        res.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
    return res;
  }
  function bestHand(cards) {
    let best = null;
    for (const combo of combos5(cards)) { const s = rank5(combo); if (!best || cmp(s, best.score) > 0) best = { score: s, cards: combo }; }
    return best;
  }

  /* ---- main "faite" (catégorie + cartes clés) : 2 à 7 cartes ---- */
  function findStraight(cards) {
    const have = {}; cards.forEach(c => { if (!have[c.r]) have[c.r] = c; });
    for (let high = 14; high >= 5; high--) {
      const seq = [];
      for (let k = 0; k < 5; k++) { let r = high - k; seq.push(r === 1 ? 14 : r); }
      if (seq.every(r => have[r])) return { high, cards: seq.map(r => have[r]) };
    }
    return null;
  }
  function nameFor(cat, cards) {
    const top = Math.max(...cards.map(c => c.r));
    switch (cat) {
      case 9: return 'Quinte flush royale';
      case 8: return 'Quinte flush';
      case 7: return 'Carré de ' + rankLabel(cards[0].r, true);
      case 6: return 'Full';
      case 5: return 'Couleur';
      case 4: return 'Quinte';
      case 3: return 'Brelan de ' + rankLabel(cards[0].r, true);
      case 2: return 'Double paire';
      case 1: return 'Paire de ' + rankLabel(cards[0].r, true);
      default: return 'Hauteur ' + rankLabel(top, false);
    }
  }
  function evalMade(cards) {
    const byRank = {}; cards.forEach(c => (byRank[c.r] = byRank[c.r] || []).push(c));
    const bySuit = {}; cards.forEach(c => (bySuit[c.s] = bySuit[c.s] || []).push(c));
    const ranksDesc = [...new Set(cards.map(c => c.r))].sort((a, b) => b - a);
    const mk = (cat, cs) => ({ cat, cards: cs, name: nameFor(cat, cs) });
    for (const s in bySuit) if (bySuit[s].length >= 5) { const sf = findStraight(bySuit[s]); if (sf) return mk(sf.high === 14 ? 9 : 8, sf.cards); }
    const quad = ranksDesc.find(r => byRank[r].length === 4);
    if (quad) return mk(7, byRank[quad].slice(0, 4));
    const trips = ranksDesc.filter(r => byRank[r].length >= 3);
    const pairs = ranksDesc.filter(r => byRank[r].length >= 2);
    if (trips.length && pairs.some(r => r !== trips[0])) {
      const p = pairs.find(r => r !== trips[0]);
      return mk(6, [...byRank[trips[0]].slice(0, 3), ...byRank[p].slice(0, 2)]);
    }
    for (const s in bySuit) if (bySuit[s].length >= 5) return mk(5, bySuit[s].slice().sort((a, b) => b.r - a.r).slice(0, 5));
    const st = findStraight(cards); if (st) return mk(4, st.cards);
    if (trips.length) return mk(3, byRank[trips[0]].slice(0, 3));
    if (pairs.length >= 2) return mk(2, [...byRank[pairs[0]].slice(0, 2), ...byRank[pairs[1]].slice(0, 2)]);
    if (pairs.length) return mk(1, byRank[pairs[0]].slice(0, 2));
    const hi = cards.slice().sort((a, b) => b.r - a.r)[0];
    return mk(0, [hi]);
  }
  /* ---- formule de Chen : qualité d'une main de départ (2 cartes SEULES, avant flop) ----
     Spécification suivie à la lettre (pas la formule "classique" avec bonus connecteur — volontairement
     omis, non demandé) : valeur de la carte haute, ×2 si paire (mini 5), +2 si assortie, pénalité d'écart,
     arrondi à l'entier supérieur. */
  const CHEN_HIGH = { 14: 10, 13: 8, 12: 7, 11: 6, 10: 5, 9: 4.5, 8: 4, 7: 3.5, 6: 3, 5: 2.5, 4: 2, 3: 1.5, 2: 1 };
  function chenScore(hole) {
    const [a, b] = [hole[0].r, hole[1].r].sort((x, y) => y - x);
    const isPair = a === b;
    let score = CHEN_HIGH[a];
    if (isPair) score = Math.max(5, score * 2);
    if (!isPair && hole[0].s === hole[1].s) score += 2;
    if (!isPair) {
      const gap = a - b; // écart entre les 2 valeurs (ex: Roi-Dame = 1)
      const penalty = gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : gap >= 4 ? 5 : 0;
      score -= penalty;
    }
    return Math.ceil(score);
  }
  function computeOuts(hole, community) {
    if (community.length < 3 || community.length >= 5) return [];
    const known = new Set([...hole, ...community].map(c => c.code));
    const cur = evalMade([...hole, ...community]).cat;
    const byCat = {};
    for (const c of makeDeck()) {
      if (known.has(c.code)) continue;
      const cat = evalMade([...hole, ...community, c]).cat;
      if (cat > cur && cat >= 2) (byCat[cat] = byCat[cat] || new Set()).add(c.r);
    }
    return Object.keys(byCat).map(Number).sort((a, b) => b - a).map(cat => ({ cat, ranks: [...byCat[cat]].sort((a, b) => b - a) }));
  }

  return { SUITS, HAND_NAMES, rankCode, rankLabel, makeDeck, rank5, cmp, combos5, bestHand, findStraight, nameFor, evalMade, computeOuts, chenScore };
});
