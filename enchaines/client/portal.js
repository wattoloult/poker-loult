// LES ENCHAÎNÉS — portail de fin de parcours : une arche (Quaternius Wall_Arch, CC0) au dernier point de passage, fermée par un voile
// de lumière qui tourbillonne, à la couleur du monde suivant. Il s'embrase quand les deux grimpeurs arrivent (fin du parcours, côté sim.js),
// puis main.js enchaîne sur le parcours suivant (fondu + son).
import * as THREE from 'three';
import { S, LIB, sprite } from './scene.js';
import { place } from './levelview.js';

export const COLOR = { medieval: 0xffc46a, jungle: 0x8dffb0, japan: 0xff9cc4, deep: 0x7adcff, sky: 0xd6f0ff, mech: 0xffa448, ice: 0xb0ecff, summit: 0xfff4e0 };
let P = null;
export function build(L, grp, nextWorld) {
  P = null;
  const c = L.checkpoints.find((k) => k.finish); if (!c) return;
  const g = new THREE.Group(); g.position.set(c.x + (c.portalX ?? 1.5), c.y, c.z + (c.portalZ ?? -1.2)); g.rotation.y = c.portalYaw ?? 0; grp.add(g);
  const arch = place(LIB.Wall_Arch, g, 5.2);
  const col = new THREE.Color(COLOR[nextWorld] || COLOR.medieval);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uC: { value: col }, uK: { value: 0.55 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vU; uniform float uT, uK; uniform vec3 uC;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        vec2 p = (vU - vec2(.5, .42)) * vec2(1., 1.3); float r = length(p), a = atan(p.y, p.x);
        float sw = n(vec2(a * 2.2 + r * 6. - uT * 1.6, r * 5. - uT * .7)) + .5 * n(vec2(a * 5. - uT * 2.4, r * 11.));
        float edge = smoothstep(.62, .2, r) * smoothstep(0., .08, vU.y);
        float core = smoothstep(.45, 0., r);
        gl_FragColor = vec4(uC * (0.6 + sw * .9) + core * .35, edge * (0.35 + sw * .45) * uK + core * .25 * uK);
      }` });
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), mat); veil.position.y = 1.8; g.add(veil);
  const glow = sprite(col.getHex(), 6); glow.position.y = 2; glow.material.opacity = 0.35; g.add(glow);
  const light = new THREE.PointLight(col, 12, 14, 1.8); light.position.set(0, 2, 1); g.add(light);
  P = { g, mat, glow, light, arch, fire: 0 };
}
export function update(W, dt, t) {
  if (!P) return;
  P.mat.uniforms.uT.value = t;
  const k = W.done ? 1 : 0; P.fire += (k - P.fire) * Math.min(1, dt * 2.5);
  P.mat.uniforms.uK.value = 0.55 + P.fire * 0.9; P.glow.material.opacity = 0.3 + P.fire * 0.6; P.light.intensity = 12 + P.fire * 40;
  P.glow.scale.setScalar(6 + Math.sin(t * 2) * 0.3 + P.fire * 4);
}
