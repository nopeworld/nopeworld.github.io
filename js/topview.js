// Top view of a route on Unreal's true map (site/data/topview/<case>.json): map polygons, the route's obstacle, the input,
// Unreal's executed path and each method's VGGT-Omega camera path, animated to the video time.
import { json, METH_COLOR } from './util.js';
import { ground, solids, obstacle, haloLine, camera, arrowHead, scaleBar, INK, paper } from './mapdraw.js';

export const loadTop = (c) => json(`data/topview/${c}.json`);

function interp(path, t) {          // position on a timed path at time t (clamped)
  const T = path.t, P = path.p; if (!T.length) return null;
  if (t <= T[0]) return [P[0][0], P[0][1], 0];
  for (let i = 1; i < T.length; i++) if (T[i] >= t) { const a = (t - T[i - 1]) / Math.max(1e-6, T[i] - T[i - 1]); return [P[i - 1][0] + a * (P[i][0] - P[i - 1][0]), P[i - 1][1] + a * (P[i][1] - P[i - 1][1]), i]; }
  return [P[P.length - 1][0], P[P.length - 1][1], P.length - 1];
}

export class TopView {
  constructor(canvas, { mini = false } = {}) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.d = null; this.keys = []; this.mini = mini; this.t = 1e9; this.hl = null;
    if (!mini && 'ResizeObserver' in window) new ResizeObserver(() => this.draw()).observe(canvas);
    addEventListener('nope:theme', () => this.draw()); }
  // keys: [{ key: 'lingbot|raw', color, width, dash, alpha, label }]
  set(data, keys) { this.d = data; this.keys = keys || []; this.view = this.fitView(); this.draw(); }
  fitView() {
    const d = this.d; let [u0, u1, v0, v1] = d.extent;
    const pts = [[0, 0], ...d.unreal.p, ...d.intent.p];
    for (const k of this.keys) if (d.paths[k.key]) pts.push(...d.paths[k.key].p);
    let a = [1e9, -1e9, 1e9, -1e9];
    for (const [u, v] of pts) { if (Math.hypot(u, v) > 14) continue; a = [Math.min(a[0], u), Math.max(a[1], u), Math.min(a[2], v), Math.max(a[3], v)]; }
    const m = this.mini ? 0.9 : 1.2;
    u0 = Math.max(u0, a[0] - m); u1 = Math.min(u1, a[1] + m); v0 = Math.max(v0, a[2] - m); v1 = Math.min(v1, a[3] + m);
    return [u0, u1, v0, v1];
  }
  setTime(t) { this.t = t; this.draw(); }
  highlight(key) { this.hl = key; this.draw(); }
  draw() {
    const { c, ctx, d } = this; if (!d) return;
    const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    let [u0, u1, v0, v1] = this.view;
    const pad = (this.mini ? 4 : 14) * dpr;
    const s = Math.min((W - 2 * pad) / (u1 - u0), (H - 2 * pad) / (v1 - v0));
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    const X = (u) => W / 2 + (u - cu) * s, Y = (v) => H / 2 - (v - cv) * s;
    ctx.clearRect(0, 0, W, H);
    if (this.mini) { ctx.fillStyle = paper().ground; ctx.fillRect(0, 0, W, H); } else ground(ctx, W, H, X, Y, s, dpr, cu, cv);
    solids(ctx, d.map, X, Y, dpr);
    obstacle(ctx, d.obstacle, X, Y, dpr);
    // Unreal: a wide soft band (where the camera should go)
    haloLine(ctx, d.unreal.p, X, Y, 'rgba(29,33,41,.16)', this.mini ? 4 : 8, dpr, { halo: false });
    // the input: dashed, with an arrow head
    haloLine(ctx, d.intent.p, X, Y, INK, 1.3, dpr, { dash: [4, 4], halo: false });
    const ip = d.intent.p, n = ip.length;
    if (n > 3) { const a = ip[n - 4], b = ip[n - 1]; arrowHead(ctx, X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), INK, 8 * dpr); }
    const t = this.t;
    const cams = [];
    for (const k of this.keys) {
      const p = d.paths[k.key]; if (!p) continue;
      const dim = this.hl && this.hl !== k.key;
      const q = interp(p, t), a = (k.alpha ?? 1) * (dim ? 0.25 : 1);
      haloLine(ctx, p.p, X, Y, k.color, (k.width || 2) * 0.6, dpr, { alpha: a * 0.3, halo: false });            // the whole path, faint
      const done = q ? [...p.p.slice(0, q[2]), [q[0], q[1]]] : p.p;                                               // drawn so far, solid
      haloLine(ctx, done, X, Y, k.color, k.width || 2, dpr, { alpha: a, dash: k.dash ? [3, 3] : null, halo: !this.mini });
      if (q) cams.push([q, k, dim, p]);
    }
    // Unreal camera at t
    const qu = interp(d.unreal, t);
    if (qu && !this.mini) cams.unshift([qu, { color: '#22262e' }, false, d.unreal]);
    for (const [q, k, dim, p] of cams) {
      const i = Math.max(1, Math.min(q[2], p.p.length - 1));
      let du = p.p[i][0] - p.p[i - 1][0], dv = p.p[i][1] - p.p[i - 1][1];
      if (Math.hypot(du, dv) < 1e-4) { du = 0; dv = 1; }
      camera(ctx, X(q[0]), Y(q[1]), Math.atan2(-dv, du), k.color, (this.mini ? 3 : 5) * dpr, dpr, { alpha: dim ? 0.3 : 1 });
    }
    // the hand-off camera: an open ring
    ctx.save(); ctx.beginPath(); ctx.arc(X(0), Y(0), (this.mini ? 3 : 5.5) * dpr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8 * dpr; ctx.stroke(); ctx.restore();
    if (!this.mini) scaleBar(ctx, W, H, s, dpr, pad);
  }
  contactTime() {     // when Unreal's executed path first leaves the input (the export's contact point): for the scrubber tick
    const d = this.d; if (!d || !d.contact) return null;
    let best = null, bd = 1e9;
    d.unreal.p.forEach((p, i) => { const e = Math.hypot(p[0] - d.contact[0], p[1] - d.contact[1]); if (e < bd) { bd = e; best = d.unreal.t[i]; } });
    return best;
  }
}

export function keysFor(gen, methods, { width = 2.2 } = {}) {
  return methods.map(m => ({ key: `${gen}|${m}`, color: METH_COLOR[m], width, dash: m === 'prediction', alpha: m === 'prediction' ? 0.9 : 1 }));
}
