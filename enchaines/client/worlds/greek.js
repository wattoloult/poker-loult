// LES ENCHAÎNÉS — rendu du monde « L'Odyssée » : la mer Égée (eau animée), le navire d'Ulysse posé sur la plateforme qui navigue,
// colonnes doriques (les colonnes à escalader), temple et Parthénon en toile de fond, oliviers, amphores, buste et cheval sur l'Olympe.
// Modèles (assets/worlds/greek) : poly.pizza — Greek Temple (Alexandre Thomas), Parthenon (Nick Kramer), Doric Greek Column (Victor Vi),
// Amphora (Bruno Oliveira), Olive tree (Poly by Google), Bust (Anna M) : CC-BY 3.0 ; Sail Ship, Horse Statue (Quaternius) : CC0.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const M = {}; let loading = null, V = null;
function load() {
  if (loading) return loading;
  const ld = new GLTFLoader(), base = new URL('../../assets/worlds/greek/', import.meta.url);
  loading = Promise.all(['temple', 'parthenon', 'column', 'amphora', 'olive', 'ship', 'horse', 'bust'].map(async (n) => {
    try { const g = await ld.loadAsync(new URL(n + '.glb', base).href); g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); M[n] = g.scene; } catch { M[n] = null; }
  }));
  return loading;
}
const hash = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export default {
  build(W, grp, A) {
    const T = A.THREE, me = (V = { ship: null, sea: null });
    // la mer : grande nappe animée sous tout le parcours (c'est elle, l'abîme)
    const mat = new T.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec2 vW; uniform float uT;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ vec2 p = vW * .18; float w = n(p + vec2(uT * .25, uT * .1)) * .6 + n(p * 2.3 - vec2(uT * .3, 0.)) * .4;
          vec3 c = mix(vec3(.05, .32, .48), vec3(.18, .62, .72), w); c += smoothstep(.72, .9, w) * .35; gl_FragColor = vec4(c, 1.); }` });
    const sea = new T.Mesh(new T.PlaneGeometry(900, 260), mat); sea.rotation.x = -Math.PI / 2; sea.position.set(120, -0.9, 40); grp.add(sea); me.sea = mat; // niveau de la mer : juste sous la plage
    load().then(() => {
      if (V !== me || A.S.level !== grp) return;
      const fit = (src, par, h) => A.place(src, par, h);
      const box = (o) => new T.Box3().setFromObject(o).getSize(new T.Vector3());
      for (const b of W.bodies) {
        const o = A.S.bodyMesh[b.i], top = b.hh, i = b.i;
        if (b.column && o) { // colonne dorique à escalader : le modèle remplace la boîte
          if (o.children[0]) o.children[0].visible = false; const c = fit(M.column, o, b.h); if (c) { const s = box(c); c.scale.x *= (b.w * 1.25) / (s.x || 1); c.scale.z *= (b.d * 1.25) / (s.z || 1); c.position.y = -b.hh; }
          continue;
        }
        if (b.ship) { const s = fit(M.ship, grp, 6.5); if (s) { const sz = box(s); s.scale.multiplyScalar(12 / Math.max(sz.x, sz.z)); if (sz.z > sz.x) s.rotation.y = Math.PI / 2; me.ship = { s, b, h: box(s).y }; } continue; }
        if (!o || b.move || b.cliff || b.herse || b.plank || b.post || b.bar || b.crumble || b.sink) continue;
        const big = b.w * b.d >= 20;
        if (big && (b.mat === 'marble' || b.mat === 'rock' || b.mat === 'sand') && hash(i, 1) > 0.35) { const t = fit(M.olive, o, 3.4 + hash(i, 2) * 1.4); if (t) t.position.set((hash(i, 3) > 0.5 ? 1 : -1) * (b.hw - 1.1), top, -b.hd + 1); }
        if (b.w * b.d >= 12 && hash(i, 4) > 0.45) { const a = fit(M.amphora, o, 0.8); if (a) a.position.set((hash(i, 5) - 0.5) * (b.w - 1.2), top, -b.hd + 0.5); }
        if (b.summit) { const h = fit(M.horse, o, 2.6); if (h) { h.position.set(-b.hw + 1.6, top, -b.hd + 1.4); h.rotation.y = 0.5; } const bu = fit(M.bust, o, 1.4); if (bu) bu.position.set(b.hw - 1.4, top, -b.hd + 1.2); }
      }
      // toiles de fond : le temple derrière les colonnes, le Parthénon qui domine l'arrivée
      const tp = fit(M.temple, grp, 14); if (tp) { tp.position.set(201, 12, -10.5); }
      const pa = fit(M.parthenon, grp, 13); if (pa) { const s = box(pa); if (s.z > s.x) pa.rotation.y = Math.PI / 2; pa.position.set(246, 34.5, -10.5); }
    });
  },
  update(W, dt, t) {
    if (!V) return; if (V.sea) V.sea.uniforms.uT.value = t;
    const sh = V.ship; if (sh) { const b = W.bodies[sh.b.i]; sh.s.position.set(b.px, -1.5, b.pz); sh.s.rotation.z = Math.sin(t * 0.9) * 0.025; } // le navire tangue un peu
  },
};
