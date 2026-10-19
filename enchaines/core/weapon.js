// LES ENCHAÎNÉS — mode CRAZY : balistique pure (aucun état, aucun DOM). Tir « hitscan » : un rayon de l'œil du tireur, le premier obstacle (décor ou grimpeur) l'arrête.
// Repère du jeu : y = haut ; un corps (boîte) a un centre (px, py, pz), des demi-tailles (hw, hh, hd) et un cap `yaw` (b.c = cos, b.s = sin, voir sim.js `local`).

export const KAR = {
  RANGE: 260,            // portée (m)
  AMMO: 5,               // capacité (chargeur de 5 cartouches, comme le Kar98k)
  FIRE_CD: 0.18,         // délai mini entre deux tirs (la culasse impose de toute façon son cycle)
  CYCLE: 0.92,           // cycle de culasse après un tir : déverrouillage, recul (éjection de la douille), avance, verrouillage
  CYCLE_EJECT: 0.42,     // instant d'éjection de la douille dans le cycle
  RELOAD: 2.7,           // rechargement complet par lame-chargeur
  DMG_HEAD: 100, DMG_BODY: 60, DMG_LEG: 40,
  HP: 100,
  EYE: 1.5, EYE_SLIDE: 0.72,   // hauteur de l'œil (debout / en glissade)
  HEAD_FROM: 0.82,       // au-dessus de cette fraction de la hauteur du corps = tête
  LEG_TO: 0.42,          // en dessous = jambes
};

// rayon (o + t·d, t dans [0, max]) contre une boîte tournée autour de y ; renvoie { t, nx, ny, nz } ou null
export function rayBody(b, ox, oy, oz, dx, dy, dz, max) {
  // passage dans le repère local de la boîte (rotation d'axe y, comme sim.js `local`)
  const px = ox - b.px, pz = oz - b.pz;
  const lox = b.c * px - b.s * pz, loz = b.s * px + b.c * pz, loy = oy - b.py;
  const ldx = b.c * dx - b.s * dz, ldz = b.s * dx + b.c * dz;
  let t0 = 0, t1 = max, nlx = 0, nly = 0, nlz = 0, hit = false;
  const slab = (o, d, h, ax) => {
    if (Math.abs(d) < 1e-9) return o >= -h && o <= h;
    let ta = (-h - o) / d, tb = (h - o) / d, s = -1; if (ta > tb) { const q = ta; ta = tb; tb = q; s = 1; }
    if (ta > t0) { t0 = ta; nlx = ax === 0 ? s : 0; nly = ax === 1 ? s : 0; nlz = ax === 2 ? s : 0; hit = true; }
    if (tb < t1) t1 = tb;
    return t0 <= t1;
  };
  if (!slab(lox, ldx, b.hw, 0) || !slab(loy, dy, b.hh, 1) || !slab(loz, ldz, b.hd, 2)) return null;
  if (!hit) return null; // le rayon part de l'intérieur de la boîte : on l'ignore (le tireur n'est jamais « dans » le décor)
  // normale locale -> monde (rotation inverse)
  return { t: t0, nx: b.c * nlx + b.s * nlz, ny: nly, nz: -b.s * nlx + b.c * nlz };
}

// rayon contre une capsule verticale (axe x,z fixe, de y0 à y1, rayon r) : on teste le cylindre puis les deux calottes ; renvoie t ou -1
export function rayCapsule(ox, oy, oz, dx, dy, dz, cx, y0, y1, cz, r, max) {
  let best = -1;
  const consider = (t) => { if (t >= 0 && t <= max && (best < 0 || t < best)) best = t; };
  // cylindre infini d'axe vertical
  const ax = ox - cx, az = oz - cz, a = dx * dx + dz * dz;
  if (a > 1e-12) {
    const b = 2 * (ax * dx + az * dz), c = ax * ax + az * az - r * r, disc = b * b - 4 * a * c;
    if (disc >= 0) { const s = Math.sqrt(disc); for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) { const y = oy + dy * t; if (y >= y0 && y <= y1) consider(t); } }
  }
  // calottes : sphères aux deux extrémités
  for (const cy of [y0, y1]) {
    const qx = ox - cx, qy = oy - cy, qz = oz - cz, b = 2 * (qx * dx + qy * dy + qz * dz), c = qx * qx + qy * qy + qz * qz - r * r, disc = b * b - 4 * c;
    if (disc >= 0) { const s = Math.sqrt(disc); for (const t of [(-b - s) / 2, (-b + s) / 2]) { const y = oy + dy * t; if ((cy === y0 && y <= y0) || (cy === y1 && y >= y1)) consider(t); } }
  }
  return best;
}

// direction unitaire depuis un cap et une hauteur de visée : le cap suit la convention du jeu (avant = (sin yaw, cos yaw)), pitch > 0 = vers le haut
export function aimDir(yaw, pitch) { const cp = Math.cos(pitch); return { x: Math.sin(yaw) * cp, y: Math.sin(pitch), z: Math.cos(yaw) * cp }; }
