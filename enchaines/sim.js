/* LES ENCHAÎNÉS — simulation PURE (UMD : Node + navigateur). Aucun DOM, aucun rendu.
   Repère : x droite, y haut, le parcours avance vers -z. yaw=0 regarde vers -z, yaw>0 tourne à gauche.
   Pas fixe conseillé : 1/120 s. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EnchSim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const C = {
    R: 0.35, H: 1.8, HS: 0.9,          // demi-largeur, hauteur debout / glissé
    RUN: 6.2, GROUND_ACC: 48, GROUND_FRIC: 42,
    GRAV: 26, JUMP: 9.2, JUMP_CUT: 0.5, MAX_FALL: 30,
    AIR_STEER: 17, AIR_ACC: 10, AIR_BRAKE: 7, AIR_MAX: 11,
    COYOTE: 0.1, JUMP_BUF: 0.12,
    SLIDE_MIN: 3.6, SLIDE_BOOST: 1.28, SLIDE_MAX: 10.5, SLIDE_FRIC: 4.4, SLIDE_END: 2.2, SLIDE_TURN: 1.3,
    STEP: 0.45, CRAWL: 3.0,
    LEDGE_MIN: 0.5, LEDGE_MAX: 2.3, LEDGE_REACH: 0.5, LEDGE_TIME: 0.32,
    CLIMB_UP: 3.0, CLIMB_DOWN: 3.4, CLIMB_SIDE: 2.4,
    WALL_SLIDE: 2.6, WJ_H: 6.6, WJ_V: 9.0, WJ_LOCK: 0.16, WJ_CTRL: 0.45, WJ_REGRAB: 0.18,
    VINE_SPEED: 3.2, VINE_JUMP_H: 5.2, VINE_JUMP_V: 8.0, VINE_COOL: 0.3, VINE_R: 0.55,
    DEATH_Y: -18, RESPAWN: 0.9
  };
  const EPS = 1e-4;

  const len2 = (x, z) => Math.sqrt(x * x + z * z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const ease = t => t * t * (3 - 2 * t);

  function createWorld(level) {
    const w = {
      level, t: 0,
      boxes: level.boxes, rollers: level.rollers || [], vines: level.vines || [],
      checkpoints: level.checkpoints || [], camZones: (level.camZones || []).map(z => ({ z, done: false })),
      finish: level.finish, turn: null, events: []
    };
    w.rollerState = w.rollers.map(() => ({ c: [0, 0, 0], ang: 0 }));
    updateRollers(w);
    w.p = newPlayer(level.spawn, level.spawnYaw || 0);
    w.p.cp = { pos: level.spawn.slice(), yaw: level.spawnYaw || 0 };
    return w;
  }

  function newPlayer(pos, yaw) {
    return {
      x: pos[0], y: pos[1], z: pos[2], vx: 0, vy: 0, vz: 0, h: C.H,
      state: 'air', yaw: yaw || 0, face: yaw || 0,
      coyote: 0, jumpBuf: 0, lock: 0, regrab: 0, vineCool: 0,
      wall: null, ledge: null, vine: null, ground: null,
      deadT: 0, deaths: 0, time: 0, finished: false, finishTime: 0, slideT: 0, cpIdx: -1
    };
  }

  /* ---------- rouleaux ---------- */
  function rollerCenter(r, t) {
    if (!r.move) return r.c.slice();
    const s = Math.sin(r.move.speed * t + (r.move.phase || 0)) * r.move.amp;
    return [r.c[0] + r.move.dir[0] * s, r.c[1] + r.move.dir[1] * s, r.c[2] + r.move.dir[2] * s];
  }
  function updateRollers(w) {
    for (let i = 0; i < w.rollers.length; i++) {
      const r = w.rollers[i], st = w.rollerState[i];
      st.c = rollerCenter(r, w.t);
      st.ang = (r.spin || 2) * w.t;
    }
  }
  function rollerHits(w, p) {
    const x0 = p.x - C.R, x1 = p.x + C.R, y0 = p.y, y1 = p.y + p.h, z0 = p.z - C.R, z1 = p.z + C.R;
    for (let i = 0; i < w.rollers.length; i++) {
      const r = w.rollers[i], c = w.rollerState[i].c;
      const rr = r.r + (r.spike || 0) * 0.6, half = r.len / 2;
      let a0, a1, ax, ay, bx, by, b0, b1, c0, c1;
      // axe : on teste le segment le long de l'axe puis le rect perpendiculaire contre le disque
      let rect, along;
      if (r.axis === 'x') { along = [x0, x1, c[0]]; rect = [y0, y1, c[1], z0, z1, c[2]]; }
      else if (r.axis === 'y') { along = [y0, y1, c[1]]; rect = [x0, x1, c[0], z0, z1, c[2]]; }
      else { along = [z0, z1, c[2]]; rect = [x0, x1, c[0], y0, y1, c[1]]; }
      if (along[1] < along[2] - half || along[0] > along[2] + half) continue;
      const nx = clamp(rect[2], rect[0], rect[1]) - rect[2];
      const ny = clamp(rect[5], rect[3], rect[4]) - rect[5];
      if (nx * nx + ny * ny < rr * rr) return true;
    }
    return false;
  }

  /* ---------- collisions ---------- */
  function overlapAt(w, x, y, z, h, ignore) {
    for (let i = 0; i < w.boxes.length; i++) {
      const b = w.boxes[i];
      if (b === ignore) continue;
      if (x + C.R > b.min[0] && x - C.R < b.max[0] && y + h > b.min[1] && y < b.max[1] && z + C.R > b.min[2] && z - C.R < b.max[2]) return b;
    }
    return null;
  }

  function moveHoriz(w, p, axis, d, canStep) {
    if (d === 0) return;
    if (axis === 0) p.x += d; else p.z += d;
    for (let guard = 0; guard < 4; guard++) {
      const b = overlapAt(w, p.x, p.y, p.z, p.h);
      if (!b) return;
      if (canStep && b.max[1] - p.y <= C.STEP && b.max[1] - p.y > 0 && !overlapAt(w, p.x, b.max[1] + EPS, p.z, p.h)) {
        p.y = b.max[1] + EPS; continue;
      }
      if (axis === 0) { p.x = d > 0 ? b.min[0] - C.R - EPS : b.max[0] + C.R + EPS; p.vx = 0; p.hitX = d > 0 ? 1 : -1; }
      else { p.z = d > 0 ? b.min[2] - C.R - EPS : b.max[2] + C.R + EPS; p.vz = 0; p.hitZ = d > 0 ? 1 : -1; }
      return;
    }
  }

  function moveVert(w, p, d) {
    p.y += d;
    p.ground = null;
    const b = overlapAt(w, p.x, p.y, p.z, p.h);
    if (!b) return false;
    if (d <= 0) { p.y = b.max[1]; p.vy = 0; p.ground = b; return true; }
    p.y = b.min[1] - p.h - EPS; p.vy = 0; return false;
  }

  function onGround(w, p) {
    if (p.vy > 0.01) return null;
    return overlapAt(w, p.x, p.y - 0.06, p.z, 0.06 + 0.001) || overlapAt(w, p.x, p.y - 0.06, p.z, 0.06);
  }

  // Murs adjacents : renvoie { nx, nz, box } (normale = direction qui s'éloigne du mur)
  function wallContact(w, p) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const pad = 0.1;
    for (let i = 0; i < 4; i++) {
      const d = dirs[i];
      const x = p.x + d[0] * pad, z = p.z + d[1] * pad;
      for (let j = 0; j < w.boxes.length; j++) {
        const b = w.boxes[j];
        if (x + C.R > b.min[0] && x - C.R < b.max[0] && p.y + p.h - 0.25 > b.min[1] && p.y + 0.35 < b.max[1] && z + C.R > b.min[2] && z - C.R < b.max[2]) {
          // la boite doit déborder dans la direction testée (pas la boite sur laquelle on se tient)
          if (d[0] !== 0 && !(d[0] > 0 ? p.x + C.R <= b.min[0] + 0.12 : p.x - C.R >= b.max[0] - 0.12)) continue;
          if (d[1] !== 0 && !(d[1] > 0 ? p.z + C.R <= b.min[2] + 0.12 : p.z - C.R >= b.max[2] - 0.12)) continue;
          return { nx: -d[0], nz: -d[1], box: b };
        }
      }
    }
    return null;
  }

  /* ---------- rebord (edge-climb) ---------- */
  function findLedge(w, p, dx, dz) {
    const l = len2(dx, dz);
    if (l < 0.01) return null;
    dx /= l; dz /= l;
    const px = p.x + dx * (C.R + C.LEDGE_REACH * 0.55), pz = p.z + dz * (C.R + C.LEDGE_REACH * 0.55);
    let best = null;
    for (let j = 0; j < w.boxes.length; j++) {
      const b = w.boxes[j];
      const top = b.max[1];
      if (top < p.y + C.LEDGE_MIN || top > p.y + C.LEDGE_MAX) continue;
      if (p.y > top - 0.25) continue;                        // déjà au dessus du rebord
      if (px + 0.12 < b.min[0] || px - 0.12 > b.max[0] || pz + 0.12 < b.min[2] || pz - 0.12 > b.max[2]) continue;
      if (b.min[1] > p.y + p.h) continue;
      const tx = p.x + dx * (C.R + 0.3), tz = p.z + dz * (C.R + 0.3);
      if (overlapAt(w, tx, top + EPS, tz, C.H)) continue;    // pas de place au dessus
      if (!best || top > best.top) best = { top, tx, tz, box: b };
    }
    return best;
  }

  /* ---------- étape de simulation ---------- */
  function step(w, inp, dt) {
    const p = w.p;
    w.t += dt;
    updateRollers(w);
    w.events.length = 0;

    // caméra : demi-tour scripté (définitif) + mouvement libre du joueur
    p.yaw += (inp.dyaw || 0);
    if (w.turn) {
      const t0 = w.turn.t, t1 = Math.min(1, t0 + dt / w.turn.dur);
      p.yaw += w.turn.delta * (ease(t1) - ease(t0));
      w.turn.t = t1;
      if (t1 >= 1) w.turn = null;
    }

    if (p.finished) { p.vx = p.vz = 0; return; }
    p.time += dt;

    if (p.state === 'dead') {
      p.deadT -= dt;
      if (p.deadT <= 0) respawn(w);
      return;
    }

    // entrées
    const mz = inp.mz || 0, mx = inp.mx || 0;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
    let wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
    const wl = len2(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const wmag = Math.min(1, wl);

    if (inp.jumpPressed) p.jumpBuf = C.JUMP_BUF; else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    p.lock = Math.max(0, p.lock - dt);
    p.regrab = Math.max(0, p.regrab - dt);
    p.vineCool = Math.max(0, p.vineCool - dt);
    p.hitX = 0; p.hitZ = 0;

    // ---- rebord en cours ----
    if (p.state === 'ledge') {
      const L = p.ledge;
      L.t = Math.min(1, L.t + dt / C.LEDGE_TIME);
      const e = ease(L.t);
      p.x = L.fx + (L.tx - L.fx) * e;
      p.z = L.fz + (L.tz - L.fz) * e;
      // monte d'abord, puis avance
      const ey = Math.min(1, L.t * 1.6);
      p.y = L.fy + (L.ty - L.fy) * ease(ey);
      p.vx = p.vy = p.vz = 0;
      if (L.t >= 1) {
        p.state = 'ground'; p.ledge = null; p.h = C.H;
        p.vx = L.dx * 2.5; p.vz = L.dz * 2.5; p.regrab = 0.2;
        w.events.push('mantle');
      }
      return;
    }

    // ---- liane ----
    if (p.state === 'vine') {
      const v = p.vine;
      p.x += (v.x - p.x) * Math.min(1, dt * 14); p.z += (v.z - p.z) * Math.min(1, dt * 14);
      p.vx = p.vz = 0; p.vy = mz * C.VINE_SPEED;
      p.y += p.vy * dt;
      p.y = clamp(p.y, v.y0 - 0.2, v.y1 + 0.1);
      if (p.jumpBuf > 0) {
        const hx = wmag > 0.2 ? wx : fx, hz = wmag > 0.2 ? wz : fz;
        p.vx = hx * C.VINE_JUMP_H; p.vz = hz * C.VINE_JUMP_H; p.vy = C.VINE_JUMP_V;
        p.state = 'air'; p.vine = null; p.vineCool = C.VINE_COOL; p.jumpBuf = 0; p.lock = 0.05; p.jumpCut = false;
        w.events.push('vinejump');
      } else if (inp.slide) {
        p.state = 'air'; p.vine = null; p.vineCool = C.VINE_COOL; p.vx = p.vz = 0;
      } else if (p.y >= v.y1 + 0.05 && mz > 0.3) {
        // sommet : on se hisse sur ce qui est juste à côté si possible
        const led = findLedge(w, p, wx || fx, wz || fz);
        if (led) beginLedge(p, led, wx || fx, wz || fz, w);
      }
      finishStep(w, p);
      return;
    }

    // ---- accroche mur / escalade ----
    if (p.state === 'grip') {
      const wc = wallContact(w, p);
      if (!wc || !inp.grab || wc.box.kind !== 'grip') {
        p.state = 'air'; p.wall = null;
      } else {
        p.wall = wc;
        const tx = -wc.nz, tz = wc.nx;                       // tangente
        const lat = wx * tx + wz * tz;
        let vy = 0;
        if (mz > 0.2) vy = C.CLIMB_UP; else if (mz < -0.2) vy = -C.CLIMB_DOWN;
        p.vy = vy;
        const side = lat * C.CLIMB_SIDE * (vy !== 0 ? 0.6 : 1);
        p.vx = tx * side - wc.nx * 1.2; p.vz = tz * side - wc.nz * 1.2;
        p.face = Math.atan2(wc.nx, wc.nz);
        if (p.jumpBuf > 0) { wallJump(w, p, wc, wx, wz, wmag); }
        else {
          // sommet de mur → hissage
          if (vy > 0) {
            const led = findLedge(w, p, -wc.nx, -wc.nz);
            if (led) beginLedge(p, led, -wc.nx, -wc.nz, w);
          }
          if (p.state === 'grip') integrate(w, p, dt, false);
          if (p.state === 'grip' && onGround(w, p) && vy < 0) { p.state = 'ground'; }
        }
      }
      if (p.state !== 'grip') { /* tombé dans la suite */ }
      if (p.state === 'ledge' || p.state === 'grip' || p.state === 'ground') { finishStep(w, p); return; }
    }

    // ---- glissade ----
    if (p.state === 'slide') {
      const sp = len2(p.vx, p.vz);
      p.slideT += dt;
      // petite orientation vers la direction voulue
      if (wmag > 0.2 && sp > 0.1) {
        const cur = Math.atan2(p.vx, p.vz), want = Math.atan2(wx, wz);
        const d = clamp(angDiff(cur, want), -C.SLIDE_TURN * dt, C.SLIDE_TURN * dt);
        const na = cur + d;
        p.vx = Math.sin(na) * sp; p.vz = Math.cos(na) * sp;
      }
      const ns = Math.max(0, sp - C.SLIDE_FRIC * dt);
      if (sp > 0) { p.vx *= ns / sp; p.vz *= ns / sp; }
      p.face = Math.atan2(-p.vx, -p.vz);
      if (p.jumpBuf > 0 && onGround(w, p)) {
        // saut long depuis la glissade (si de la place au dessus)
        if (!overlapAt(w, p.x, p.y, p.z, C.H)) {
          p.h = C.H; p.state = 'air'; p.vy = C.JUMP * 0.92; p.jumpBuf = 0;
          const k = Math.min(C.SLIDE_MAX, ns * 1.08) / Math.max(0.01, ns);
          p.vx *= k; p.vz *= k; p.lock = 0; w.events.push('longjump');
        }
      } else if (!onGround(w, p)) {
        // tombe d'un rebord en glissant
        if (!overlapAt(w, p.x, p.y, p.z, C.H)) { p.h = C.H; p.state = 'air'; }
      } else if (ns < C.SLIDE_END || !inp.slide) {
        if (!overlapAt(w, p.x, p.y, p.z, C.H)) { p.h = C.H; p.state = 'ground'; }
        else {                                                       // coincé sous un plafond bas : on rampe
          const tvx = wx * C.CRAWL * wmag, tvz = wz * C.CRAWL * wmag;
          p.vx += (tvx - p.vx) * Math.min(1, dt * 10); p.vz += (tvz - p.vz) * Math.min(1, dt * 10);
        }
      }
      if (p.state === 'slide') { integrate(w, p, dt, true); finishStep(w, p); return; }
    }

    // ---- sol / air ----
    const grounded = onGround(w, p);
    p.wasAir = p.state === 'air' || p.state === 'wall';
    if (grounded && p.vy <= 0.01) {
      if (p.state === 'air' || p.state === 'wall') w.events.push('land');
      p.state = 'ground'; p.coyote = C.COYOTE; p.ground = grounded;
    } else {
      p.coyote = Math.max(0, p.coyote - dt);
      if (p.state === 'ground') p.state = 'air';
    }

    if (p.state === 'ground' && inp.grab && wmag > 0.2 && p.regrab <= 0) {       // s'agripper depuis le sol : on pousse contre un mur vert
      const wc0 = wallContact(w, p);
      if (wc0 && wc0.box.kind === 'grip' && (wx * -wc0.nx + wz * -wc0.nz) > 0.3) {
        p.state = 'grip'; p.wall = wc0; p.vx = p.vz = 0; p.vy = 0; w.events.push('grip'); finishStep(w, p); return;
      }
    }

    if (p.state === 'ground') {
      // départ de glissade
      const sp = len2(p.vx, p.vz);
      const justLanded = p.wasAir && sp >= C.SLIDE_MIN + 1.4;     // on enchaîne la glissade à l'atterrissage si la touche est tenue
      if (inp.slide && (inp.slidePressed || justLanded) && sp >= C.SLIDE_MIN) {
        const dirx = p.vx / sp, dirz = p.vz / sp;
        const ns = Math.min(C.SLIDE_MAX, Math.max(sp * C.SLIDE_BOOST, C.SLIDE_MIN + 2.2));
        p.vx = dirx * ns; p.vz = dirz * ns; p.state = 'slide'; p.h = C.HS; p.slideT = 0;
        w.events.push('slide');
        integrate(w, p, dt, true); finishStep(w, p); return;
      }
      // accélération au sol
      const tvx = wx * C.RUN * wmag, tvz = wz * C.RUN * wmag;
      const dvx = tvx - p.vx, dvz = tvz - p.vz, dl = len2(dvx, dvz);
      const acc = (wmag > 0.01 ? C.GROUND_ACC : C.GROUND_FRIC) * dt;
      if (dl <= acc) { p.vx = tvx; p.vz = tvz; } else { p.vx += dvx / dl * acc; p.vz += dvz / dl * acc; }
      if (p.jumpBuf > 0) { jump(w, p); }
    } else {
      // air : inertie conservée, direction rattrapable
      if (p.coyote > 0 && p.jumpBuf > 0 && p.state === 'air' && p.vy <= 0) { jump(w, p); }
      airControl(p, wx, wz, wmag, dt);
      // saut coupé quand on relâche
      if (!inp.jumpHeld && p.vy > 0 && p.jumpCut) { p.vy *= C.JUMP_CUT; p.jumpCut = false; }

      // contact mur : accroche / glissade murale / walljump
      const wc = wallContact(w, p);
      p.wall = wc;
      const pressing = wc && (wx * -wc.nx + wz * -wc.nz) > 0.25;
      if (wc && p.regrab <= 0 && wc.box.kind === 'grip' && inp.grab) {
        p.state = 'grip'; p.vy = 0; p.vx = p.vz = 0; w.events.push('grip');
        finishStep(w, p); return;
      }
      if (wc && (pressing || inp.grab) && p.vy <= 0.5) {
        p.state = 'wall';
        if (p.vy < -C.WALL_SLIDE) p.vy = -C.WALL_SLIDE;
        p.face = Math.atan2(wc.nx, wc.nz);
        if (p.jumpBuf > 0) { wallJump(w, p, wc, wx, wz, wmag); }
      } else if (p.state === 'wall') p.state = 'air';

      // lianes
      if (p.state === 'air' && p.vineCool <= 0) {
        for (let i = 0; i < w.vines.length; i++) {
          const v = w.vines[i];
          if (p.y + p.h > v.y0 && p.y + 0.6 < v.y1 + 0.2 && len2(p.x - v.x, p.z - v.z) < C.VINE_R) {
            p.state = 'vine'; p.vine = v; p.vx = p.vz = 0; p.vy = 0; w.events.push('vine');
            finishStep(w, p); return;
          }
        }
      }
      // rebord : on se hisse tout seul si on pousse vers lui (ou si on garde "agripper")
      if ((p.state === 'air' || p.state === 'wall') && p.regrab <= 0) {
        let dx = wx, dz = wz;
        if (wmag < 0.2) { const s = len2(p.vx, p.vz); if (s > 1.5 && inp.grab) { dx = p.vx; dz = p.vz; } else if (p.state === 'wall' && p.wall) { dx = -p.wall.nx; dz = -p.wall.nz; } else { dx = 0; dz = 0; } }
        if ((dx || dz) && p.vy < 7.5) {
          const led = findLedge(w, p, dx, dz);
          if (led) beginLedge(p, led, dx, dz, w);
        }
      }
    }

    if (p.state !== 'ledge') integrate(w, p, dt, true);
    finishStep(w, p);
  }

  function airControl(p, wx, wz, wmag, dt) {
    let ctrl = 1;
    if (p.lock > 0) ctrl = C.WJ_CTRL;
    const sp0 = len2(p.vx, p.vz);
    if (wmag < 0.01) return;
    // composante parallèle / perpendiculaire à la vitesse actuelle
    if (sp0 < 0.5) {
      p.vx += wx * C.AIR_ACC * wmag * dt * ctrl; p.vz += wz * C.AIR_ACC * wmag * dt * ctrl;
    } else {
      const ux = p.vx / sp0, uz = p.vz / sp0;
      const par = wx * ux + wz * uz;
      const perx = wx - ux * par, perz = wz - uz * par;
      // virage (garde la vitesse, ne fait que tourner)
      p.vx += perx * C.AIR_STEER * wmag * dt * ctrl; p.vz += perz * C.AIR_STEER * wmag * dt * ctrl;
      const sp1 = len2(p.vx, p.vz);
      if (sp1 > 0.01) { p.vx *= sp0 / sp1; p.vz *= sp0 / sp1; }
      // accélération / freinage le long de l'axe
      const a = (par >= 0 ? C.AIR_ACC : C.AIR_BRAKE) * par * wmag * dt * ctrl;
      const ns = clamp(sp0 + a, 0, Math.max(sp0, Math.min(C.AIR_MAX, par > 0 ? C.RUN * 1.05 : C.AIR_MAX)));
      const s2 = len2(p.vx, p.vz);
      if (s2 > 0.01) { p.vx *= ns / s2; p.vz *= ns / s2; }
    }
  }

  function jump(w, p) {
    p.vy = C.JUMP; p.jumpBuf = 0; p.coyote = 0; p.state = 'air'; p.jumpCut = true; p.ground = null;
    // légère inertie du sol conservée
    w.events.push('jump');
  }

  function wallJump(w, p, wc, wx, wz, wmag) {
    const keep = 0.3;
    const tx = -wc.nz, tz = wc.nx, tv = p.vx * tx + p.vz * tz;
    p.vx = wc.nx * C.WJ_H + tx * tv * keep + wx * 0.8 * wmag;
    p.vz = wc.nz * C.WJ_H + tz * tv * keep + wz * 0.8 * wmag;
    p.vy = C.WJ_V; p.state = 'air'; p.lock = C.WJ_LOCK; p.regrab = C.WJ_REGRAB;
    p.jumpBuf = 0; p.coyote = 0; p.jumpCut = false; p.wall = null;
    w.events.push('walljump');
  }

  function beginLedge(p, led, dx, dz, w) {
    const l = len2(dx, dz) || 1;
    p.state = 'ledge';
    p.ledge = { t: 0, fx: p.x, fy: p.y, fz: p.z, tx: led.tx, ty: led.top + EPS, tz: led.tz, dx: dx / l, dz: dz / l };
    p.vx = p.vy = p.vz = 0; p.h = C.H;
    p.face = Math.atan2(-dx, -dz);
    w.events.push('ledge');
  }

  function integrate(w, p, dt, canStep) {
    const g = (p.state === 'grip') ? 0 : C.GRAV;
    if (p.state === 'air' || p.state === 'wall' || p.state === 'ground' || p.state === 'slide') {
      p.vy = Math.max(-C.MAX_FALL, p.vy - g * dt);
      if (p.state === 'ground' && onGround(w, p)) p.vy = 0;
    }
    const sub = Math.max(1, Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vz), Math.abs(p.vy)) * dt / 0.18));
    const h = dt / sub;
    const stepOk = canStep && (p.state === 'ground' || p.state === 'slide');
    for (let i = 0; i < sub; i++) {
      moveHoriz(w, p, 0, p.vx * h, stepOk);
      moveHoriz(w, p, 2, p.vz * h, stepOk);
      moveVert(w, p, p.vy * h);
    }
    if (p.state !== 'slide' && p.state !== 'grip' && (Math.abs(p.vx) + Math.abs(p.vz) > 0.3)) p.face = Math.atan2(-p.vx, -p.vz);
  }

  function finishStep(w, p) {
    // dégâts, checkpoints, caméra, arrivée
    if (p.y < C.DEATH_Y) return die(w, p, 'fall');
    if (rollerHits(w, p)) return die(w, p, 'spikes');
    const cx = p.x, cz = p.z, cy = p.y + 0.9;
    for (let i = 0; i < w.checkpoints.length; i++) {
      const c = w.checkpoints[i];
      if (i > p.cpIdx && cx > c.min[0] && cx < c.max[0] && cy > c.min[1] && cy < c.max[1] && cz > c.min[2] && cz < c.max[2]) {
        p.cpIdx = i; p.cp = { pos: c.respawn.slice(), yaw: c.yaw || 0 }; w.events.push('checkpoint');
      }
    }
    for (let i = 0; i < w.camZones.length; i++) {
      const zz = w.camZones[i];
      if (!zz.done) {
        const b = zz.z;
        if (cx > b.min[0] && cx < b.max[0] && cy > b.min[1] && cy < b.max[1] && cz > b.min[2] && cz < b.max[2]) {
          zz.done = true;
          w.turn = { t: 0, dur: 1.2, delta: angDiff(p.yaw, b.yaw) };
          w.events.push('camturn');
        }
      }
    }
    if (w.finish) {
      const f = w.finish;
      if (cx > f.min[0] && cx < f.max[0] && cy > f.min[1] && cy < f.max[1] && cz > f.min[2] && cz < f.max[2]) {
        p.finished = true; p.finishTime = p.time; w.events.push('finish');
      }
    }
  }

  function die(w, p, why) {
    p.state = 'dead'; p.deadT = C.RESPAWN; p.deaths++; p.vx = p.vy = p.vz = 0; p.deathWhy = why;
    w.events.push('die');
  }

  function respawn(w) {
    const p = w.p, cp = p.cp;
    p.x = cp.pos[0]; p.y = cp.pos[1]; p.z = cp.pos[2]; p.vx = p.vy = p.vz = 0;
    p.h = C.H; p.state = 'air'; p.ledge = null; p.vine = null; p.wall = null; p.lock = 0;
    p.yaw = cp.yaw; w.turn = null;
    // une zone de caméra dont le cap est déjà celui du checkpoint reste faite ; les autres se réarment
    for (const zz of w.camZones) zz.done = Math.abs(angDiff(cp.yaw, zz.z.yaw)) < 0.01;
    w.events.push('respawn');
  }

  return { C, createWorld, step, respawn, newPlayer, overlapAt, rollerCenter, rollerHits, wallContact, findLedge, onGround, angDiff };
});
