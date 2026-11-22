// Playground: drive a camera on the teaser route's true map. The ink camera does collide-and-slide against the map
// (disc radius 0.25 m, the benchmark's collision disc); the red ghost ignores geometry like a raw world model.
import { $, $$, getBench, clamp, reduceMotion, json } from './util.js';
import { loadTop } from './topview.js';
import { describe } from './knows.js';
import { ground, solids, obstacle, haloLine, camera, arrowHead, INK } from './mapdraw.js';

const R = 0.25, SPEED = 1.2, MARGIN = 0.051;   // m, m/s: the benchmark's collision disc, walking speed and 5 cm safety margin

function segments(rings) {
  const S = [];
  for (const p of rings) for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; S.push([p[i], p[i + 1], p[j], p[j + 1]]); }
  return S;
}
function inside(rings, x, y) {   // even-odd point in polygon
  let c = false;
  for (const p of rings) for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function closest(S, x, y) {      // nearest point on any segment
  let best = [1e9, 0, 0];
  for (const [ax, ay, bx, by] of S) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1), px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best[0]) best = [d, px, py];
  }
  return best;
}

export async function initPlayground() {
  const B = await getBench();
  const d = await loadTop(B.teaser);
  const box = $('#pg'), c = $('canvas', box), ctx = c.getContext('2d');
  let CANDS = null; json(`data/decisions/${B.teaser}__lingbot__collision.json`).then(x => { CANDS = x; draw(); }).catch(() => {});
  const S = segments(d.map);
  const keys = new Set();
  let cam, ghost, yaw, trailC, trailG, contact = 0;
  const reset = () => { cam = [0, 0]; ghost = [0, 0]; yaw = 0; trailC = [[0, 0]]; trailG = [[0, 0]]; contact = 0; };
  reset();
  // view: fitted at every frame to the start, the input, Unreal's path and both cameras (with a margin), so the start and
  // the cameras never leave the frame; it only zooms out as far as the cameras wander
  const near = (P) => P.filter(([u, v]) => Math.hypot(u, v) < 8);
  const base = [[0, 0], ...near(d.intent.p), ...near(d.unreal.p)];
  const view = { cu: 0, cv: 0, span: 6 };
  const fit = (W, H) => {
    let a = [1e9, -1e9, 1e9, -1e9];
    for (const [u, v] of [...base, cam, ghost]) a = [Math.min(a[0], u), Math.max(a[1], u), Math.min(a[2], v), Math.max(a[3], v)];
    const m = 1.1, w = Math.max(3, a[1] - a[0] + 2 * m), h = Math.max(3, a[3] - a[2] + 2 * m);
    const s = Math.min(W / w, H / h);
    view.cu = (a[0] + a[1]) / 2; view.cv = (a[2] + a[3]) / 2; view.span = W / s;
  };
  const collide = (p) => {
    let touched = false;
    for (let it = 0; it < 4; it++) {
      const [dist, qx, qy] = closest(S, p[0], p[1]);
      const inSolid = inside(d.map, p[0], p[1]);
      if (dist >= R + MARGIN && !inSolid) break;
      let nx = p[0] - qx, ny = p[1] - qy, nl = Math.hypot(nx, ny) || 1e-9; nx /= nl; ny /= nl;
      if (inSolid) { nx = -nx; ny = -ny; }
      const push = inSolid ? dist + R + MARGIN : R + MARGIN - dist;
      p = [p[0] + nx * (push + 1e-4), p[1] + ny * (push + 1e-4)]; touched = true;
    }
    return [p, touched];
  };
  // the training label of the paper, on the true map: each of the 34 candidates (displacement rho * Rot(delta) * u over one
  // chunk, u = 0.9 m, LingBot's chunk at 1.2 m/s) is safe if its swept disc keeps m = 5 cm of clearance; the label is the safe
  // candidate closest to the engine's own collide-and-slide response to u (the intent term, cross-slide part weighted 0.5)
  let lastDir = null; const M = 0.05, CHUNK = 0.9;
  const clearance = (p, dv) => { let g = 1e9; for (let k = 1; k <= 12; k++) { const x = p[0] + dv[0] * k / 12, y = p[1] + dv[1] * k / 12; const dist = closest(S, x, y)[0]; g = Math.min(g, (inside(d.map, x, y) ? -dist : dist) - R); } return g; };
  const response = (p, uv) => { let q = [...p]; for (let k = 0; k < 24; k++) q = collide([q[0] + uv[0] / 24, q[1] + uv[1] / 24])[0]; return [q[0] - p[0], q[1] - p[1]]; };
  const labels = () => {
    if (!lastDir || !CANDS) return null;
    const u = [lastDir[0] * CHUNK, lastDir[1] * CHUNK], v = response(cam, u), U = CHUNK, vn = Math.hypot(v[0], v[1]);
    const ax = vn > 0.05 ? [v[0] / vn, v[1] / vn] : lastDir, t = [ax[1], -ax[0]];   // along / across the engine's response (the slide)
    const out = CANDS.delta.map((dl, i) => {
      const a = dl * Math.PI / 180, r = CANDS.rho[i];
      const dv = [r * (Math.cos(a) * u[0] + Math.sin(a) * u[1]), r * (-Math.sin(a) * u[0] + Math.cos(a) * u[1])];   // + delta turns right (clockwise seen from above)
      const e = [dv[0] - v[0], dv[1] - v[1]], along = (e[0] * ax[0] + e[1] * ax[1]) / U, cross = (e[0] * t[0] + e[1] * t[1]) / U;
      return { dv, safe: clearance(cam, dv) >= M - 1e-3, err: along * along + 0.25 * cross * cross, name: CANDS.names[i] };
    });
    let best = null; out.forEach((c, i) => { if (c.safe && (best == null || c.err < out[best].err)) best = i; });
    return { out, best };
  };
  const step = (dt) => {
    // keys: W forward, S back, A/D strafe (camera frame = page frame: forward is up)
    let f = 0, s = 0;
    if (keys.has('w')) f += 1; if (keys.has('s')) f -= 1; if (keys.has('d')) s += 1; if (keys.has('a')) s -= 1;
    if (drag) { f = drag[1]; s = drag[0]; }
    const n = Math.hypot(f, s); if (n < 1e-3) return false;
    const u = [s / Math.max(1, n) * SPEED * dt, f / Math.max(1, n) * SPEED * dt];
    yaw = Math.atan2(u[0], u[1]);
    ghost = [ghost[0] + u[0], ghost[1] + u[1]];
    // collide-and-slide: move, then push out of every contact along the normal (keeps the tangential part)
    const [p, touched] = collide([cam[0] + u[0], cam[1] + u[1]]);
    cam = p; if (touched) contact = 1;
    lastDir = [u[0] / Math.hypot(u[0], u[1]), u[1] / Math.hypot(u[0], u[1])];
    const last = trailC[trailC.length - 1]; if (Math.hypot(cam[0] - last[0], cam[1] - last[1]) > 0.05) trailC.push([...cam]);
    const lg = trailG[trailG.length - 1]; if (Math.hypot(ghost[0] - lg[0], ghost[1] - lg[1]) > 0.05) trailG.push([...ghost]);
    if (trailC.length > 400) trailC.shift(); if (trailG.length > 400) trailG.shift();
    return true;
  };
  let drag = null;
  const draw = () => {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    fit(W, H); const s = W / view.span; const X = (u) => W / 2 + (u - view.cu) * s, Y = (v) => H / 2 - (v - view.cv) * s;
    ground(ctx, W, H, X, Y, s, dpr, view.cu, view.cv);
    solids(ctx, d.map, X, Y, dpr);
    obstacle(ctx, d.obstacle, X, Y, dpr);
    haloLine(ctx, trailG, X, Y, 'rgba(211,58,44,.7)', 2, dpr, { dash: [5, 5] });
    haloLine(ctx, trailC, X, Y, 'rgba(29,33,41,.75)', 2.6, dpr);
    const heading = -Math.PI / 2 + yaw;
    camera(ctx, X(ghost[0]), Y(ghost[1]), heading, '#d33a2c', R * s, dpr, { alpha: 0.85, fill: 'rgba(255,255,255,.75)' });
    camera(ctx, X(cam[0]), Y(cam[1]), heading, contact ? '#a07a00' : INK, R * s, dpr, { fill: '#ffffff' });
    const L = labels();
    if (L) {
      ctx.lineCap = 'round';
      const x0 = X(cam[0]), y0 = Y(cam[1]);
      L.out.forEach((cd, i) => { if (i === L.best) return; const x1 = X(cam[0] + cd.dv[0]), y1 = Y(cam[1] + cd.dv[1]);
        const col = cd.safe ? '30,158,90' : '211,58,44';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = `rgba(${col},.32)`; ctx.lineWidth = 1.4 * dpr; ctx.stroke();
        ctx.beginPath(); ctx.arc(x1, y1, 2.4 * dpr, 0, 7); ctx.fillStyle = `rgba(${col},.85)`; ctx.fill(); });
      if (L.best != null) { const cd = L.out[L.best], x1 = X(cam[0] + cd.dv[0]), y1 = Y(cam[1] + cd.dv[1]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 7 * dpr; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = INK; ctx.lineWidth = 3.2 * dpr; ctx.stroke();
        arrowHead(ctx, x0, y0, x1 + (x1 - x0) * 0.08, y1 + (y1 - y0) * 0.08, INK, 11 * dpr); }
      const lab = $('#pg-label'); if (lab) lab.textContent = L.best == null ? 'label: no candidate is safe, stop' : `label: ${describe(L.out[L.best].name)} · ${L.out.filter(x => x.safe).length} of 34 safe`;
    }
    if (contact) { ctx.fillStyle = '#8a6a00'; ctx.font = `600 ${12 * dpr}px Inter, sans-serif`; ctx.fillText('contact: sliding', X(cam[0]) + R * s + 6 * dpr, Y(cam[1]) - 6 * dpr); }
  };
  let last = 0, running = false;
  const loop = (t) => { const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t; const moved = step(dt); if (moved) contact = Math.max(0, contact - dt * 0.6) || contact; draw(); if (keys.size || drag) requestAnimationFrame(loop); else running = false; };
  const kick = () => { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } };
  box.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if ('wasd'.includes(k) && k.length === 1) { keys.add(k); e.preventDefault(); kick(); } });
  box.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  box.addEventListener('blur', () => keys.clear());
  // drag: direction from the camera towards the pointer
  const dirFrom = (e) => { const r = c.getBoundingClientRect(); const s = r.width / view.span; const px = (e.clientX - r.left - r.width / 2) / s + view.cu, py = -(e.clientY - r.top - r.height / 2) / s + view.cv;
    const dx = px - cam[0], dy = py - cam[1], n = Math.hypot(dx, dy); return n < 0.15 ? null : [dx / n, dy / n]; };
  box.addEventListener('pointerdown', (e) => { box.focus({ preventScroll: true }); box.setPointerCapture(e.pointerId); drag = dirFrom(e); kick(); });
  box.addEventListener('pointermove', (e) => { if (drag !== null || e.buttons) { drag = dirFrom(e); kick(); } });
  box.addEventListener('pointerup', () => { drag = null; });
  $$('.pad button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(k); b.classList.add('on'); kick(); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { keys.delete(k); b.classList.remove('on'); });
  });
  $('#pg-reset').addEventListener('click', () => { reset(); draw(); });
  addEventListener('nope:theme', () => draw());      // Night View: the map's paper changes (mapdraw.js paper())
  if ('ResizeObserver' in window) new ResizeObserver(draw).observe(c);
  draw();
  // a short demo push when it first scrolls into view: W + A into the wall, as on the route
  if (!reduceMotion) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); keys.add('w'); keys.add('a'); kick(); setTimeout(() => { keys.delete('w'); keys.delete('a'); }, 2600); } }, { threshold: 0.6 });
    io.observe(box);
  }
}
