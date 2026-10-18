// LES ENCHAÎNÉS — pings entre partenaires : clic molette = « Ici ! » à l'endroit visé ; molette maintenue = roue (Ici, 3-2-1, STOP, Viens).
// Chaque ping : colonne de lumière + anneau au sol à la couleur du joueur, étiquette qui reste visible au bord de l'écran ; 3-2-1 = grand
// compte à rebours au centre ; STOP = main levée au-dessus de celui qui l'a lancé. Purement visuel (ne touche jamais à la simulation).
import * as THREE from 'three';
import { S, COL, project } from './scene.js';
import * as Snd from './audio.js';
import { t as tr } from './i18n.js';

export const KINDS = { here: { icon: '◎', txt: 'Ici !', life: 5 }, go: { icon: '3·2·1', txt: 'Top départ', life: 3.4 }, stop: { icon: '✋', txt: 'STOP, attends !', life: 3.5 }, come: { icon: '➜', txt: 'Viens !', life: 4 } };
const css = (k) => '#' + COL[k].toString(16).padStart(6, '0');
const live = [];
const box = () => document.getElementById('pings');
// point visé par le curseur : d'abord le décor du parcours, sinon le plan vertical qui passe par le grimpeur (on vise le vide / le ciel)
const RC = new THREE.Raycaster(), NDC = new THREE.Vector2(), PL = new THREE.Plane(), HIT = new THREE.Vector3();
export function pickPoint(cx, cy, W, me) {
  if (!S.cam) return null;
  NDC.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); RC.setFromCamera(NDC, S.cam);
  const hits = RC.intersectObjects((S.bodyMesh || []).filter(Boolean), true);
  if (hits.length) return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
  const p = W.pl[me ?? 0]; PL.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), new THREE.Vector3(p.x, p.y, p.z));
  return RC.ray.intersectPlane(PL, HIT) ? { x: HIT.x, y: HIT.y, z: HIT.z } : { x: p.x, y: p.y + 2, z: p.z };
}
export function show(k, seat, x, y, z) {
  const K = KINDS[k]; if (!K || !S.scene) return;
  const col = COL[seat] ?? COL[0];

  for (let i = live.length - 1; i >= 0; i--) if (live[i].seat === seat && live[i].k === k) kill(i); // le nouveau ping remplace l'ancien du même type
  const g = new THREE.Group(); g.position.set(x, y, z);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.y = 3.5; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 6; g.add(ring);
  if (k === 'stop' || k === 'come') g.visible = false; // ceux-là suivent le joueur qui les lance (étiquette au-dessus de sa tête)
  S.scene.add(g);
  const el = document.createElement('div'); el.className = 'ping k-' + k; el.style.setProperty('--c', css(seat));
  el.innerHTML = `<i>${K.icon}</i><b>${tr(K.txt)}</b><small></small>`; box()?.append(el);
  live.push({ k, seat, g, beam, ring, el, t: 0, life: K.life, x, y, z });
  if (k === 'go') countdown(seat); else Snd.play(k === 'stop' ? 'stop' : 'ping');
}
function kill(i) { const p = live[i]; S.scene.remove(p.g); p.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); p.el.remove(); live.splice(i, 1); }
// compte à rebours au centre de l'écran, à la couleur de celui qui l'a lancé : 3, 2, 1, GO !
let cdT = null;
function countdown(seat) {
  const el = document.getElementById('countdown'); if (!el) return; clearTimeout(cdT); el.style.setProperty('--c', css(seat));
  const step = (n) => { el.textContent = n > 0 ? n : tr('GO !'); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); Snd.play(n > 0 ? 'tick' : 'go'); if (n > 0) cdT = setTimeout(() => step(n - 1), 800); else cdT = setTimeout(() => el.classList.remove('show'), 900); };
  step(3);
}
export function update(W, dt, me) {
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i]; p.t += dt; if (p.t > p.life || !W) { kill(i); continue; }
    const fade = Math.min(1, (p.life - p.t) / 0.5), pop = Math.min(1, p.t / 0.18);
    let x = p.x, y = p.y, z = p.z;
    if (p.k === 'stop' || p.k === 'come') { const q = W.pl[p.seat]; if (q) { x = q.x; y = q.y + 2.5; z = q.z; } }
    else { p.ring.scale.setScalar(1 + ((p.t * 1.6) % 1) * 1.6); p.ring.material.opacity = 0.9 * (1 - ((p.t * 1.6) % 1)) * fade; p.beam.material.opacity = 0.55 * fade * pop; p.beam.scale.y = pop; y += 1.2; }
    // étiquette : au-dessus du point, ou plaquée au bord de l'écran (avec une flèche) quand le point est hors champ
    const s = project(x, y, z), m = 46; let sx = s.x, sy = s.y, out = !s.vis || sx < m || sx > innerWidth - m || sy < m || sy > innerHeight - m;
    if (!s.vis) { sx = innerWidth - sx; sy = innerHeight - sy; }
    if (out) { const cx = innerWidth / 2, cy = innerHeight / 2, dx = sx - cx, dy = sy - cy, k = Math.min((cx - m) / Math.abs(dx || 1e-3), (cy - m) / Math.abs(dy || 1e-3)); sx = cx + dx * Math.min(1, k); sy = cy + dy * Math.min(1, k); p.el.style.setProperty('--a', Math.atan2(dy, dx) + 'rad'); }
    p.el.classList.toggle('out', out); p.el.style.opacity = fade; p.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scale(${0.6 + 0.4 * pop})`;
    const mp = W.pl[me ?? 0]; if (mp && p.k === 'here') p.el.querySelector('small').textContent = Math.round(Math.hypot(p.x - mp.x, p.y - mp.y, p.z - mp.z)) + ' m';
  }
}
export function clear() { while (live.length) kill(live.length - 1); }
