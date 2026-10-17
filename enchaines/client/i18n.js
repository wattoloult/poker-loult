// LES ENCHAÎNÉS — langues : français (source) et anglais. Les textes du jeu sont écrits en français ; l'anglais est un dictionnaire
// client/i18n-en.js indexé par le texte français exact. t(fr, ...args) renvoie la version dans la langue choisie ({0}, {1}… = arguments) ;
// un texte absent du dictionnaire reste en français (jamais de clé brute à l'écran). La page statique est traduite en parcourant le DOM.
import { EN } from './i18n-en.js';

const safe = (f, d) => { try { return f(); } catch { return d; } };
const stored = safe(() => localStorage.getItem('ch-lang'), null);
export const LANG = stored || (/^fr/i.test(navigator.language || 'fr') ? 'fr' : 'en');
export const t = (fr, ...a) => {
  let s = LANG === 'en' ? (EN[fr] ?? fr) : fr;
  if (a.length) s = s.replace(/\{(\d+)\}/g, (_, i) => a[+i] ?? '');
  return s;
};
export const setLang = (l) => { safe(() => localStorage.setItem('ch-lang', l)); location.reload(); };

const norm = (s) => s.replace(/\s+/g, ' ').trim();
// traduit les nœuds texte et les attributs (title, placeholder, aria-label, alt) d'une zone de la page
export function applyDom(root = document.body) {
  if (LANG !== 'en') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 3) {
      const p = n.parentNode; if (!p || /^(SCRIPT|STYLE)$/.test(p.tagName)) continue;
      const k = norm(n.nodeValue); if (k && EN[k] != null) n.nodeValue = n.nodeValue.replace(k, EN[k]);
    } else for (const a of ['title', 'placeholder', 'aria-label', 'alt']) { const v = n.getAttribute?.(a); if (v && EN[norm(v)] != null) n.setAttribute(a, EN[norm(v)]); }
  }
}
if (LANG === 'en') {
  document.documentElement.lang = 'en';
  document.title = t('Les Enchaînés — Loult Party');
  document.querySelector('meta[name=description]')?.setAttribute('content', t('Deux grimpeurs, une chaîne, un sommet. Jeu de plateforme coopératif en 3D.'));
  applyDom();
}
