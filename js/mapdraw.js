// Shared look of the 2D maps (top views and the playground): Unreal's occupancy rings drawn smooth, a 1 m dot grid,
// soft shadows, haloed paths and camera markers with a view cone.
//
// The rings come from a 5 cm occupancy grid, so their edges are staircases. smoothRings() removes the stairs only:
// Douglas-Peucker with a 4 cm tolerance, then two rounds of corner cutting that never move a corner by more than 6 cm
// (the cut is capped in metres, so long straight walls and real corners keep their shape). Geometry is otherwise unchanged.

const cache = new WeakMap();

function simplify(pts, eps) {            // Douglas-Peucker on an open polyline of [u, v]
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let best = -1, bd = eps;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > bd) { bd = d; best = i; } }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function cut(ring, cap) {                // one round of corner cutting on a closed ring, at most `cap` metres from a corner
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
    const L = Math.hypot(bx - ax, by - ay); if (L < 1e-9) continue;
    const c = Math.min(0.25, cap / L);
    out.push([ax + c * (bx - ax), ay + c * (by - ay)], [bx - c * (bx - ax), by - c * (by - ay)]);
  }
  return out;
}

export function smoothRings(rings) {
  if (!rings) return [];
  let s = cache.get(rings); if (s) return s;
  s = rings.map((flat) => {
    const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    if (pts.length < 4) return pts;
    let r = simplify([...pts, pts[0]], 0.04); r.pop();
    if (r.length < 3) return pts;
    r = cut(cut(r, 0.06), 0.03);
    return r;
  });
  cache.set(rings, s);
  return s;
}

export const INK = '#1d2129';
// the paper the maps are drawn on: white by day, dimmed parchment in Night View (js/theme.js sets <html data-theme>);
// the ink, the paths and the obstacle keep their colours
export const paper = () => (document.documentElement.dataset.theme === 'night'
  ? { ground: '#d9d0bc', dot: '#bcb29c', solid: '#c8bea8', edge: '#8a806b' } : { ground: '#ffffff', dot: '#d7dce4', solid: '#e1e5ec', edge: '#a3abb9' });

// white ground and a 1 m dot grid
export function ground(ctx, W, H, X, Y, s, dpr, cu, cv) {
  const P = paper(); ctx.fillStyle = P.ground; ctx.fillRect(0, 0, W, H);
  if (s < 14 * dpr) return;
  ctx.fillStyle = P.dot;
  const r = Math.max(1, 1.1 * dpr);
  for (let g = Math.floor(cu - W / 2 / s) - 1; g < cu + W / 2 / s + 1; g++)
    for (let h = Math.floor(cv - H / 2 / s) - 1; h < cv + H / 2 / s + 1; h++) { ctx.beginPath(); ctx.arc(X(g), Y(h), r, 0, 7); ctx.fill(); }
}

function path(ctx, rings, X, Y) {
  ctx.beginPath();
  for (const p of rings) { p.forEach(([u, v], i) => i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))); ctx.closePath(); }
}

// the scene's solid geometry: soft slate with a shadow, then a crisp edge
export function solids(ctx, rings, X, Y, dpr) {
  const R = smoothRings(rings); ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(30, 40, 60, .16)'; ctx.shadowBlur = 10 * dpr; ctx.shadowOffsetY = 2 * dpr;
  const P = paper(); path(ctx, R, X, Y); ctx.fillStyle = P.solid; ctx.fill('evenodd');
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = P.edge; ctx.lineWidth = 1.1 * dpr; ctx.stroke();
  ctx.restore();
}

// the route's obstacle: the page's yellow, with fine diagonal hatching so it reads as solid
export function obstacle(ctx, rings, X, Y, dpr) {
  if (!rings || !rings.length) return;
  const R = smoothRings(rings); ctx.save();
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(160, 120, 0, .25)'; ctx.shadowBlur = 8 * dpr; ctx.shadowOffsetY = 1.5 * dpr;
  path(ctx, R, X, Y); ctx.fillStyle = '#f7d23e'; ctx.fill('evenodd');
  ctx.shadowColor = 'transparent';
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(176, 132, 0, .28)'; ctx.lineWidth = 1 * dpr;
  const W = ctx.canvas.width, H = ctx.canvas.height, step = 6 * dpr;
  ctx.beginPath(); for (let x = -H; x < W; x += step) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); } ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.lineJoin = 'round'; path(ctx, R, X, Y); ctx.strokeStyle = '#c99700'; ctx.lineWidth = 1.5 * dpr; ctx.stroke(); ctx.restore();
}

// a polyline with a white halo under it, so paths stay readable over the map
export function haloLine(ctx, pts, X, Y, color, width, dpr, { dash = null, alpha = 1, halo = true } = {}) {
  if (!pts || pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const trace = () => { ctx.beginPath(); pts.forEach(([u, v], i) => i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))); };
  if (halo) { trace(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.globalAlpha = alpha; ctx.lineWidth = (width + 3) * dpr; ctx.setLineDash([]); ctx.stroke(); }
  trace(); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width * dpr; ctx.setLineDash(dash ? dash.map(x => x * dpr) : []); ctx.stroke();
  ctx.restore();
}

// a camera: view cone, white ring, filled dot
export function camera(ctx, x, y, ang, color, r, dpr, { alpha = 1, fill = null } = {}) {
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, r, x, y, r * 4.2);
  g.addColorStop(0, color + '40'); g.addColorStop(1, color + '00');
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 4.2, ang - 0.5, ang + 0.5); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'rgba(20, 24, 32, .25)'; ctx.shadowBlur = 4 * dpr; ctx.shadowOffsetY = 1 * dpr;
  ctx.beginPath(); ctx.arc(x, y, r + 1.6 * dpr, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = fill || color; ctx.fill();
  if (fill) { ctx.strokeStyle = color; ctx.lineWidth = 2 * dpr; ctx.stroke(); }
  ctx.restore();
}

// an arrow head at the end of a segment
export function arrowHead(ctx, x0, y0, x1, y1, color, size) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - size * Math.cos(a - 0.42), y1 - size * Math.sin(a - 0.42)); ctx.lineTo(x1 - size * Math.cos(a + 0.42), y1 - size * Math.sin(a + 0.42)); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

// a scale bar in a soft pill
export function scaleBar(ctx, W, H, s, dpr, pad) {
  const bx = W - pad - s, by = H - pad;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - 8 * dpr, by - 20 * dpr, s + 16 * dpr, 26 * dpr, 8 * dpr); else ctx.rect(bx - 8 * dpr, by - 20 * dpr, s + 16 * dpr, 26 * dpr); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * dpr; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx, by - 2 * dpr); ctx.lineTo(bx + s, by - 2 * dpr); ctx.moveTo(bx, by - 5 * dpr); ctx.lineTo(bx, by + 1 * dpr); ctx.moveTo(bx + s, by - 5 * dpr); ctx.lineTo(bx + s, by + 1 * dpr); ctx.stroke();
  ctx.fillStyle = '#4a4f5c'; ctx.font = `500 ${10.5 * dpr}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('1 m', bx + s / 2, by - 8 * dpr);
  ctx.restore();
}
