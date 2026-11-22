// Method: the architecture redrawn as an SVG that builds up step by step (scroll-scrubbed and pinned on wide screens,
// tap or scroll the step cards otherwise), the two read-out modes on a chunk timeline, and the cost per route.
import { $, $$, svg, el, json, reduceMotion } from './util.js';

const INK = '#111318', GRAY = '#8a90a0', FROZEN = '#eef1f6', FROZEN_E = '#c9cfda', HEAD = '#e3f5ea', HEAD_E = '#1e9e5a', WALL = '#f2c200';

function T(x, y, s, o = {}) { return svg('text', { x, y, 'font-size': o.size || 13, 'font-weight': o.w || 500, fill: o.fill || INK, 'text-anchor': o.anchor || 'start', ...o.attrs }, s); }
function TS(x, y, main, sub, rest = '', o = {}) {   // text with a subscript (tspan), e.g. TS(.., 'u', 'k')
  const t = svg('text', { x, y, 'font-size': o.size || 13, 'font-weight': o.w || 500, fill: o.fill || INK, 'text-anchor': o.anchor || 'start' }, main);
  t.append(svg('tspan', { 'baseline-shift': 'sub', 'font-size': (o.size || 13) * 0.72 }, sub));
  if (rest) t.append(svg('tspan', {}, rest));
  return t;
}
function box(x, y, w, h, o = {}) { return svg('rect', { x, y, width: w, height: h, rx: o.rx ?? 12, fill: o.fill || '#fff', stroke: o.stroke || FROZEN_E, 'stroke-width': o.sw || 1.3, 'stroke-dasharray': o.dash }); }
function arrow(d, o = {}) { return svg('path', { d, fill: 'none', stroke: o.stroke || INK, 'stroke-width': o.sw || 1.6, 'marker-end': 'url(#ah)', class: o.flow ? 'flow' : null, 'stroke-linecap': 'round' }); }

function buildArch(root) {
  root.innerHTML = '';
  root.append(svg('defs', {}, svg('marker', { id: 'ah', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: INK })),
    svg('marker', { id: 'ahg', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: HEAD_E }))));
  const G = (step, ...kids) => { const g = svg('g', { class: 'blk', 'data-step': step }); kids.forEach(k => g.append(k)); root.append(g); return g; };
  // step 0: memory + command -> frozen DiT -> (chunk k comes at step 4)
  const mem = G(0,
    ...[0, 1, 2].map(i => box(18 + i * 8, 40 + i * 8, 92, 56, { rx: 8, fill: '#f6f7fa', stroke: '#c9cfda' })),
    T(70, 132, 'memory M', { anchor: 'middle', size: 12.5, fill: GRAY }), T(70, 147, 'past chunks', { anchor: 'middle', size: 11, fill: '#aab0bd' }),
    box(30, 176, 80, 40, { rx: 10 }), TS(70, 202, 'u', 'k', '', { anchor: 'middle', size: 16, w: 650 }),
    T(70, 233, 'user command', { anchor: 'middle', size: 11.5, fill: GRAY }),
    arrow('M 132 84 L 196 110'), arrow('M 114 196 L 196 160'),
    box(204, 34, 200, 200, { fill: FROZEN, stroke: FROZEN_E, rx: 16 }),
    TS(304, 58, 'frozen video DiT  f', 'θ', '', { anchor: 'middle', size: 13.5, w: 650 }),
    ...Array.from({ length: 12 }, (_, i) => box(224, 72 + i * 12.4, 160, 8, { rx: 3, fill: '#fff', stroke: '#d4d9e3', sw: 1 })),
    // snowflake: frozen
    svg('g', { transform: 'translate(384 50)', stroke: '#7c8394', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svg('path', { d: 'M0 -7V7M-6 -3.5L6 3.5M-6 3.5L6 -3.5' })),
  );
  // step 1: tap blocks -> projector
  const taps = [7, 9, 10];
  const tap = G(1,
    ...taps.map(i => box(224, 72 + i * 12.4, 160, 8, { rx: 3, fill: WALL, stroke: '#d9ad00', sw: 1 })),
    T(314, 262, 'hidden states H, every token', { size: 11.5, fill: GRAY }),
    arrow('M 304 236 L 304 286', { flow: true }),
    box(214, 290, 180, 44, { fill: HEAD, stroke: HEAD_E }), TS(304, 317, 'projector ψ', 'H', '  → 128 per token', { anchor: 'middle', size: 12.5, w: 600 }),
  );
  // step 2: candidates + cross-attention + outputs
  const cands = svg('g', { transform: 'translate(70 330)' });
  const C = [[0, 1], [0, .5], [30, .43], [-30, .43], [18, .99], [-18, .99], [44, .95], [-44, .95], [61, .79], [-61, .79], [78, .37], [-78, .37], [88, .07]];
  C.forEach(([d, r]) => { const a = d * Math.PI / 180; cands.append(svg('line', { x1: 0, y1: 0, x2: 44 * r * Math.sin(a), y2: -44 * r * Math.cos(a), stroke: HEAD_E, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: .75 })); });
  cands.append(svg('circle', { r: 3.5, fill: '#fff', stroke: INK, 'stroke-width': 1.3 }));
  const head = G(2,
    cands, TS(70, 352, '34 candidates c', 'i', '', { anchor: 'middle', size: 12, fill: GRAY }),
    T(70, 368, 'keep · stop · slow · slide', { anchor: 'middle', size: 11, fill: '#aab0bd' }),
    arrow('M 116 320 L 206 316', { stroke: HEAD_E }),
    T(150, 306, 'E (frozen)', { anchor: 'middle', size: 11, fill: GRAY }),
    arrow('M 394 312 L 446 312', { flow: true, stroke: HEAD_E }),
    box(452, 262, 150, 100, { fill: HEAD, stroke: HEAD_E }),
    T(527, 290, 'head  φ  (<2M)', { anchor: 'middle', size: 13, w: 650 }),
    T(527, 312, 'query q →', { anchor: 'middle', size: 11.5, fill: GRAY }), T(527, 330, '2 × cross-attention', { anchor: 'middle', size: 12 }),
    T(527, 350, 'per candidate', { anchor: 'middle', size: 11, fill: GRAY }),
    arrow('M 602 312 L 640 312', { stroke: HEAD_E }),
    T(648, 296, 'P̂  safety', { size: 12.5, w: 600 }), T(648, 316, 'ĝ  clearance', { size: 12.5, w: 600 }), T(648, 336, 'Â  intent', { size: 12.5, w: 600 }),
  );
  // step 3: select
  const sel = G(3,
    box(452, 132, 230, 92, { stroke: INK, rx: 14 }),
    TS(567, 158, 'select  a*', 'k', '', { anchor: 'middle', size: 13.5, w: 650 }),
    T(567, 180, 'safe input → keep it', { anchor: 'middle', size: 12 }),
    T(567, 199, 'unsafe → safe candidate with max Â', { anchor: 'middle', size: 12 }),
    T(567, 216, 'none safe → stop', { anchor: 'middle', size: 11, fill: GRAY }),
    arrow('M 724 290 C 748 262 742 214 690 196'),
    arrow('M 452 178 C 430 178 420 178 410 178', { stroke: INK }),
  );
  // step 4: draw chunk k
  const out = G(4,
    ...[0, 1, 2].map(i => box(470 + i * 10, 26 + i * 8, 96, 62, { rx: 8, fill: '#fff', stroke: INK })),
    svg('rect', { x: 540, y: 44, width: 7, height: 50, fill: WALL, rx: 2 }),
    svg('circle', { cx: 530, cy: 72, r: 6, fill: '#fff', stroke: INK, 'stroke-width': 1.5 }),
    T(610, 62, 'chunk k', { size: 13.5, w: 650 }), TS(610, 80, 'drawn with a*', 'k', '', { size: 12, fill: GRAY }),
    arrow('M 404 72 L 462 60', { flow: true }),
    T(610, 98, '→ memory, next chunk', { size: 11.5, fill: '#aab0bd' }),
  );
  return [mem, tap, head, sel, out];
}

let shown = -1;
function setStep(groups, s) {
  groups.forEach((g, i) => g.classList.toggle('dim', i > s));
  const gs = window.gsap;
  if (gs && window.DrawSVGPlugin && !reduceMotion && s > shown) {     // the parts of the new step draw themselves in
    for (let i = shown + 1; i <= s; i++) {
      const parts = groups[i].querySelectorAll('rect, path, line, circle');
      gs.fromTo(parts, { drawSVG: '0%' }, { drawSVG: '100%', duration: .7, stagger: .012, ease: 'power2.out', overwrite: true });
      gs.fromTo(groups[i].querySelectorAll('text'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .5, stagger: .02, ease: 'power2.out', delay: .15, overwrite: true });
    }
  }
  shown = Math.max(shown, s);
  $$('#steps .step').forEach((e, i) => e.classList.toggle('on', i === s));
}

function timeline(mode) {
  // the paper's inference panel: three rows at chunk k (frozen model, + prediction mode, + collision mode)
  const S = $('#timeline'); S.innerHTML = '';
  S.setAttribute('viewBox', '0 0 900 300');
  S.append(svg('defs', {}, svg('marker', { id: 'ah2', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0 0L10 5L0 10z', fill: INK }))));
  const A = (d, o = {}) => svg('path', { d, fill: 'none', stroke: o.stroke || INK, 'stroke-width': o.sw || 1.5, 'marker-end': 'url(#ah2)', 'stroke-dasharray': o.dash, 'stroke-linecap': 'round' });
  const dit = (x, y, w, label, sub) => [box(x, y - 20, w, 40, { rx: 10, fill: FROZEN, stroke: FROZEN_E }), T(x + w / 2, y + (sub ? -2 : 4), label, { anchor: 'middle', size: 12.5, w: 650 }),
    sub ? T(x + w / 2, y + 12, sub, { anchor: 'middle', size: 10.5, fill: GRAY }) : null].filter(Boolean);
  const head = (x, y) => [box(x, y - 18, 64, 36, { rx: 10, fill: HEAD, stroke: HEAD_E }), T(x + 32, y + 4, 'head', { anchor: 'middle', size: 12.5, w: 650 })];
  const toks = (x, y) => { const g = svg('g'); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.append(svg('rect', { x: x + i * 7, y: y - 7 + j * 7, width: 6, height: 6, rx: 1, fill: '#8a90a0' })); return g; };
  // column guides
  S.append(svg('rect', { x: 150, y: 18, width: 128, height: 274, rx: 14, fill: '#f8f9fb' }), svg('rect', { x: 292, y: 18, width: 470, height: 274, rx: 14, fill: '#f8f9fb' }),
    T(214, 36, 'chunk k − 1', { anchor: 'middle', size: 12, w: 600, fill: GRAY }), T(527, 36, 'chunk k', { anchor: 'middle', size: 12, w: 600, fill: GRAY }));
  const rows = [['raw', 'frozen model', 80], ['prediction', '+ prediction mode', 170], ['collision', '+ collision mode', 255]];
  for (const [m, label, y] of rows) {
    const on = m === mode || m === 'raw';
    const g = svg('g', { opacity: on ? 1 : 0.28 }); g.style.transition = 'opacity .4s';
    g.append(T(10, y + 4, label, { size: 12.5, w: 650, fill: m === 'raw' ? INK : '#157a44' }));
    g.append(...dit(170, y, 88, 'DiT'));
    if (m === 'raw') {
      g.append(A(`M 258 ${y} L 452 ${y}`), ...dit(456, y, 112, 'DiT', 'steps 0–3'), A(`M 568 ${y} L 776 ${y}`));
      g.append(svg('rect', { x: 780, y: y - 13, width: 112, height: 26, rx: 13, fill: '#fde9e6', stroke: '#f6c9c2' }), T(836, y + 4, 'through the wall', { anchor: 'middle', size: 11.5, w: 600, fill: '#b4271b' }));
    } else if (m === 'prediction') {
      g.append(toks(266, y), A(`M 290 ${y} L 318 ${y}`, { stroke: HEAD_E }), ...head(322, y), A(`M 386 ${y} L 452 ${y}`, { stroke: HEAD_E }),
        T(419, y - 8, '✓ / ⇄', { anchor: 'middle', size: 11.5, fill: '#157a44' }), ...dit(456, y, 112, 'DiT', 'steps 0–3'), A(`M 568 ${y} L 776 ${y}`));
    } else {
      g.append(A(`M 258 ${y} L 306 ${y}`), ...dit(310, y, 74, 'DiT', 'step 0'), toks(390, y), A(`M 414 ${y} L 438 ${y}`, { stroke: HEAD_E }), ...head(442, y),
        A(`M 506 ${y} L 588 ${y}`, { stroke: HEAD_E }), T(547, y - 8, '✓ keep', { anchor: 'middle', size: 11.5, fill: '#157a44' }), ...dit(592, y, 112, 'DiT', 'steps 1–3'), A(`M 704 ${y} L 776 ${y}`),
        A(`M 474 ${y - 18} C 474 ${y - 44} 347 ${y - 44} 347 ${y - 22}`, { stroke: '#c0392b', dash: '4 3' }), T(410, y - 40, '⇄ change: rerun step 0', { anchor: 'middle', size: 11, fill: '#b4271b' }));
    }
    if (m !== 'raw') g.append(svg('rect', { x: 780, y: y - 13, width: 112, height: 26, rx: 13, fill: '#e3f5ea', stroke: '#bfe6cf' }), T(836, y + 4, 'stops or slides', { anchor: 'middle', size: 11.5, w: 600, fill: '#157a44' }));
    S.append(g);
  }
  $('#tl-note').textContent = mode === 'prediction'
    ? 'Reads the cached commit pass of chunk k−1: no step rerun, no extra DiT pass (+0.7 s per route).'
    : 'Reads the first denoising step of chunk k; a changed command reruns only step 0 (+9.9 s per route). Evoke-Turbo has this mode only.';
}

export async function initMethod() {
  const groups = buildArch($('#arch'));
  let cur = 0; setStep(groups, 0);
  const steps = $$('#steps .step');
  steps.forEach((e, i) => e.addEventListener('click', () => { cur = i; setStep(groups, i); }));
  const wide = matchMedia('(min-width: 961px)').matches;
  if (wide && window.gsap && window.ScrollTrigger && !reduceMotion) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.create({ trigger: '#method-pin', start: 'top top+=70', end: '+=1500', pin: true, scrub: true,
      onUpdate: (s) => { const k = Math.min(4, Math.floor(s.progress * 5.0)); if (k !== cur) { cur = k; setStep(groups, k); } } });
  } else {
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { const i = steps.indexOf(e.target); cur = i; setStep(groups, i); } }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => io.observe(s));
    if (reduceMotion) setStep(groups, 4);
  }
  let mode = 'collision'; timeline(mode);
  $$('#tl-mode button').forEach(b => b.addEventListener('click', () => { $$('#tl-mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); mode = b.dataset.m; timeline(mode); }));
  const R = await json('data/results.json');
  const box2 = $('#cost-bars');
  const rows = [['Ours (Pred)', 'prediction', '#1e9e5a'], ['Ours (Coll)', 'collision', '#1e9e5a'], ['External depth', 'depth', '#3b6bff']];
  const max = Math.max(...R.cost.rows.map(r => r.added_s));
  for (const [name, m, col] of rows) {
    const r = R.cost.rows.find(x => x.method === m);
    const pct = Math.round(r.added_s / R.cost.raw_route_s * 100);
    box2.append(el('div', { class: 'cost' }, el('span', {}, name), el('div', { class: 'bar' }, el('i', { style: { width: (r.added_s / max * 100) + '%', background: col, opacity: m === 'prediction' ? 1 : .8 } })),
      el('span', { class: 'v' }, `+${r.added_s} s`)));
    box2.lastChild.title = `${r.per_decision} s per decision; +${pct}% of the raw route`;
  }
  box2.append(el('p', { class: 'note', style: { margin: '4px 0 0' } }, `Pred +1%, Coll +18%, external depth +27% (decode + DA3 every chunk).`));
}
