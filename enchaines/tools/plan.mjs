// Plan vu du dessus d'une arène, dessiné à partir de ses VRAIES collisions (core) : hauteur du dessus des boîtes en niveaux de gris (rouge = hors d'atteinte),
// rebords saisissables en jaune, places d'apparition en cyan, points d'accroche des cordes en magenta, accessoires en orange.
//   node tools/plan.mjs quartier plan.png [pixels par mètre]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { COURSES } from '../core/worlds.js';

const L = COURSES[process.argv[2] || 'quartier'], out = process.argv[3] || 'plan.png', S = +(process.argv[4] || 12);
const bodies = L.bodies.filter((b) => !b.bound && b.h < 30 && b.y + b.h / 2 > 0.05);
const xs = L.bodies.flatMap((b) => [b.x - b.w / 2, b.x + b.w / 2]).filter((v) => Math.abs(v) < 60), zs = L.bodies.flatMap((b) => [b.z - b.d / 2, b.z + b.d / 2]).filter((v) => Math.abs(v) < 80);
const X0 = Math.floor(Math.min(...xs)) - 1, Z0 = Math.floor(Math.min(...zs)) - 1, W = Math.ceil((Math.max(...xs) + 1 - X0) * S), H = Math.ceil((Math.max(...zs) + 1 - Z0) * S);
const px = new Uint8Array(W * H * 3), top = new Float32Array(W * H).fill(-1), kind = new Uint8Array(W * H);
const inBox = (b, x, z) => { const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), dx = x - b.x, dz = z - b.z; return Math.abs(c * dx - s * dz) <= b.w / 2 && Math.abs(s * dx + c * dz) <= b.d / 2; };
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  const x = X0 + (i + 0.5) / S, z = Z0 + (j + 0.5) / S, k = j * W + i;
  for (const b of bodies) { const t = b.y + b.h / 2; if (t > top[k] && inBox(b, x, z)) { top[k] = t; kind[k] = b.prop ? 3 : b.high ? 2 : 1; } }
  const t = top[k]; let r, g, bl;
  if (t < 0) { r = 92; g = 98; bl = 108; } // sol de la rue
  else if (kind[k] === 3) { r = 205; g = 130; bl = 60; }
  else { const v = Math.max(40, Math.min(250, 250 - t * 14)); if (kind[k] === 2) { r = v + 30; g = v * 0.45; bl = v * 0.45; } else { r = g = bl = v; } }
  px[k * 3] = r; px[k * 3 + 1] = g; px[k * 3 + 2] = bl;
}
const dot = (x, z, rad, c) => { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) if (i * i + j * j <= rad * rad) { const a = Math.round((x - X0) * S) + i, b = Math.round((z - Z0) * S) + j; if (a >= 0 && b >= 0 && a < W && b < H) px.set(c, (b * W + a) * 3); } };
// rebords saisissables : arêtes des boîtes accrochables (balcons, auvents, égouts)
for (const b of L.bodies) if (!b.nograb && !b.bound && (b.ledge || b.roof || b.prop)) {
  const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), hw = b.w / 2, hd = b.d / 2;
  for (const [ax, az, bx, bz] of [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]]) for (let t = 0; t <= 1; t += 0.5 / S / Math.hypot(bx - ax, bz - az)) {
    const lx = ax + (bx - ax) * t, lz = az + (bz - az) * t; dot(b.x + c * lx + s * lz, b.z - s * lx + c * lz, 1, [250, 215, 40]);
  }
}
for (let g = Math.ceil(X0 / 5) * 5; g < X0 + W / S; g += 5) for (let j = 0; j < H; j += 2) { const i = Math.round((g - X0) * S); px.set(g === 0 ? [200, 40, 40] : [60, 60, 70], (j * W + i) * 3); }
for (let g = Math.ceil(Z0 / 5) * 5; g < Z0 + H / S; g += 5) for (let i = 0; i < W; i += 2) { const j = Math.round((g - Z0) * S); px.set(g === 0 ? [200, 40, 40] : [60, 60, 70], (j * W + i) * 3); }
for (const c of L.checkpoints) dot(c.x, c.z, 4, [40, 230, 240]);
for (const a of L.anchors || []) dot(a.x, a.z, 4, [240, 60, 220]);
// PNG
const crc = (b) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((W * 3 + 1) * H); for (let j = 0; j < H; j++) { raw[j * (W * 3 + 1)] = 0; Buffer.from(px.buffer, j * W * 3, W * 3).copy(raw, j * (W * 3 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(`${out} : ${W}×${H} px, x ${X0}…${(X0 + W / S).toFixed(1)}, z ${Z0}…${(Z0 + H / S).toFixed(1)}, ${bodies.length} boîtes`);
