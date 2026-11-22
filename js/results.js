// Results: the paper's main table as an interactive dot chart (one row per generator, one marker per method, 95% CI
// whiskers where the result file has them), a table view, Task 1, open paths; plus the hero's headline bars.
import { $, $$, el, svg, json, showTip, hideTip, GEN_NAME, GEN_SHORT } from './util.js';

const METRICS = [
  { k: 'viol', ci: 'viol_ci', name: 'Task 2 violation', short: 'Viol. ↓', low: true, note: 'Share of the 100 routes whose generated video penetrates, tunnels through or erases the obstacle (VGGT-Ω evaluator, rule v3.1). Whiskers: 95% CI.' },
  { k: 'sis', ci: 'sis_ci', name: 'Safe-Intent Score', short: 'SIS ↑', low: false, note: 'Zero unless the video is safe and moves with the input; otherwise penalises early stops and lost slide (mirrors R = P·A). Whiskers: 95% CI.' },
  { k: 'slide', ci: null, name: 'Slide', short: 'Slide ↑', low: false, note: 'Share of the engine\'s own wall slide that the video reproduces, on the 65 routes where Unreal slides.' },
  { k: 't3_static', ci: null, name: 'Task 3 static', short: 'T3 static ↓', low: true, note: 'Violation rate on 81 open-domain WBench images with static obstacles (mean of the two VLM judges closest to people).' },
  { k: 't3_dynamic', ci: null, name: 'Task 3 moving', short: 'T3 moving ↓', low: true, note: 'Violation rate on 50 open-domain images with moving obstacles, first and third person (VLM judges).' },
  { k: 'overall', ci: null, name: 'Overall', short: 'Overall ↑', low: false, note: 'Mean of the Task 2 SIS and the Task 3 share of videos that are safe and follow the input.' },
];
const M = { raw: ['Raw model', '#d33a2c', 'circle'], text: ['Text prompt', '#8b5cf6', 'diamond'], depth: ['External depth', '#3b6bff', 'square'], collision: ['Ours (Coll)', '#1e9e5a', 'circle'], prediction: ['Ours (Pred)', '#1e9e5a', 'ring'] };

function marker(shape, color, r = 7) {
  if (shape === 'square') return svg('rect', { x: -r * .85, y: -r * .85, width: r * 1.7, height: r * 1.7, rx: 2, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
  if (shape === 'diamond') return svg('path', { d: `M0 ${-r} L${r} 0 L0 ${r} L${-r} 0Z`, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
  if (shape === 'ring') return svg('circle', { r: r - 1, fill: '#fff', stroke: color, 'stroke-width': 3 });
  return svg('circle', { r, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
}

export async function initHeadline() {
  const R = await json('data/results.json');
  const box = $('#num-bars'); if (!box || box.childElementCount) return;
  for (const g of R.generators) {
    const raw = R.rows.find(r => r.generator === g.id && r.method === 'raw'), col = R.rows.find(r => r.generator === g.id && r.method === 'collision');
    box.append(el('div', { class: 'b', 'data-tip': `${g.name}: ${raw.viol_p}% → ${col.viol_p}%`, 'data-raw': raw.viol, 'data-ours': col.viol, title: `${g.name}: raw ${raw.viol_p}%, + NoPeWorld ${col.viol_p}%` },
      el('i', { class: 'r', style: { height: raw.viol + '%' } }), el('i', { class: 'o', style: { height: Math.max(1.2, col.viol) + '%' } }),
      el('span', { class: 'v vr', style: { bottom: raw.viol + '%' } }, String(raw.viol_p)), el('span', { class: 'v vo', style: { bottom: Math.max(1.2, col.viol) + '%' } }, String(col.viol_p)),
      el('em', {}, (GEN_SHORT[g.id] || g.name).replace(' 2.0', ''))));
  }
}

export async function initResults() {
  const R = await json('data/results.json');
  const S = $('#chart');
  const gens = R.generators;
  let metric = METRICS[0];
  const seg = $('#metric');
  METRICS.forEach((m, i) => seg.append(el('button', { 'aria-pressed': i === 0, onclick: (e) => { $$('button', seg).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); metric = m; draw(); } }, m.short)));
  const lg = $('#mlegend');
  for (const [k, [name, col, shape]] of Object.entries(M)) { const s = svg('svg', { width: 16, height: 16, viewBox: '-8 -8 16 16' }); s.append(marker(shape, col, 6)); lg.append(el('span', {}, s, name)); }
  // layout: wide (labels left of the rows) or narrow (labels above the rows), rebuilt when the box crosses 640 px
  let L = null, nodes = {}, link = {}, axis, rows, marks, H;
  function fmt(r, m) { const v = m.k === 'viol' ? r.viol_p : m.k === 'sis' ? r.sis_p : m.k === 'slide' ? r.slide_p : r[m.k]; return m.k === 'overall' ? v.toFixed(1) : `${v}%`; }
  function ciTxt(r, m) { return m.ci && r[m.ci] ? ` <span style="opacity:.7">[${r[m.ci][0].toFixed(0)}, ${r[m.ci][1].toFixed(0)}]</span>` : ''; }
  function build() {
    const narrow = $('#chartbox').clientWidth < 640;
    L = narrow ? { W: 420, rowH: 74, top: 40, left: 16, right: 16, lab: 18, dy: 46, fs: 13.5 } : { W: 900, rowH: 64, top: 44, left: 168, right: 30, lab: null, dy: 32, fs: 14 };
    S.innerHTML = ''; nodes = {}; link = {};
    H = L.top + L.rowH * gens.length + 30;
    S.setAttribute('viewBox', `0 0 ${L.W} ${H}`);
    axis = svg('g'); rows = svg('g'); marks = svg('g'); S.append(axis, rows, marks);
    gens.forEach((g, i) => {
      const y = L.top + i * L.rowH;
      rows.append(svg('rect', { x: 0, y: y + 4, width: L.W, height: L.rowH - 8, rx: 12, fill: i % 2 ? '#fff' : '#f8f9fb' }));
      rows.append(svg('text', { x: 14, y: L.lab ? y + L.lab + 4 : y + L.rowH / 2 + 4, 'font-size': L.fs, 'font-weight': 600, fill: '#111318' }, g.name + (g.concurrent ? ' †' : '')));
    });
    for (const g of gens) for (const m of Object.keys(M)) {
      const r = R.rows.find(x => x.generator === g.id && x.method === m); if (!r) continue;
      const grp = svg('g', { class: 'mk' }); grp.style.transition = 'transform .8s cubic-bezier(0.16,1,0.3,1)';
      const ci = svg('line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: M[m][1], 'stroke-width': 2, opacity: .35, 'stroke-linecap': 'round' });
      const lab = svg('text', { y: -12, 'font-size': 11.5, 'font-weight': 650, fill: M[m][1], 'text-anchor': 'middle' });
      grp.append(ci, marker(M[m][2], M[m][1]), lab);
      grp.addEventListener('pointermove', (e) => showTip(`<b>${g.name}</b><br>${M[m][0]}: ${fmt(r, metric)}${ciTxt(r, metric)}`, e.clientX, e.clientY));
      grp.addEventListener('pointerleave', hideTip);
      marks.append(grp); nodes[`${g.id}|${m}`] = { grp, ci, lab, r };
    }
    gens.forEach(g => { link[g.id] = svg('line', { stroke: '#1e9e5a', 'stroke-width': 3, opacity: .25, 'stroke-linecap': 'round' }); marks.prepend(link[g.id]); link[g.id].style.transition = 'all .8s cubic-bezier(0.16,1,0.3,1)'; });
    L.narrow = narrow;
  }
  function draw() {
    const { W, rowH, top, left, right } = L;
    const X = (v) => left + (W - left - right) * v / 100;
    axis.innerHTML = '';
    for (let v = 0; v <= 100; v += 25) { axis.append(svg('line', { x1: X(v), x2: X(v), y1: top - 6, y2: top + rowH * gens.length, stroke: '#eef1f6' }), svg('text', { x: X(v), y: top - 14, 'font-size': 11.5, fill: '#7c8394', 'text-anchor': v === 0 && L.narrow ? 'start' : v === 100 && L.narrow ? 'end' : 'middle' }, `${v}${metric.k === 'overall' ? '' : '%'}`)); }
    axis.append(svg('text', { x: metric.low ? X(0) : X(100), y: H - 6, 'font-size': 12, fill: '#7c8394', 'text-anchor': metric.low ? 'start' : 'end' }, metric.low ? '← better' : 'better →'));
    if (!L.narrow) axis.append(svg('text', { x: left, y: 16, 'font-size': 13, 'font-weight': 650, fill: '#111318' }, metric.name));
    gens.forEach((g, i) => {
      const y = top + i * rowH + (L.lab ? L.dy : rowH / 2);
      let best = null;
      for (const m of Object.keys(M)) {
        const n = nodes[`${g.id}|${m}`]; if (!n) continue;
        const v = n.r[metric.k];
        n.grp.style.transform = `translate(${X(v)}px, ${y}px)`;
        const c = metric.ci && n.r[metric.ci];
        n.ci.setAttribute('x1', c ? X(c[0]) - X(v) : 0); n.ci.setAttribute('x2', c ? X(c[1]) - X(v) : 0);
        n.lab.textContent = (m === 'collision' || m === 'prediction' || m === 'raw') ? fmt(n.r, metric) : '';
        n.lab.setAttribute('y', m === 'prediction' || m === 'raw' ? 22 : -12);
        if (m === 'collision' || m === 'prediction') { if (best == null || (metric.low ? v < best : v > best)) best = v; }
      }
      const raw = nodes[`${g.id}|raw`].r[metric.k];
      link[g.id].setAttribute('x1', X(raw)); link[g.id].setAttribute('x2', X(best)); link[g.id].setAttribute('y1', y); link[g.id].setAttribute('y2', y);
    });
    $('#metric-note').textContent = (L.narrow ? metric.name + '. ' : '') + metric.note + ' † concurrent work. Task 3 cells are as printed in the paper.';
  }
  build();
  if ('ResizeObserver' in window) new ResizeObserver(() => { const w = $('#chartbox').clientWidth; if (L && w > 0 && (w < 640) !== L.narrow) { build(); draw(); } }).observe($('#chartbox'));
  draw();
  // table view
  const tb = $('#tablebox');
  const cols = [['sis', 'SIS ↑', false], ['viol', 'Viol. ↓', true], ['slide', 'Slide ↑', false], ['t3_static', 'Static ↓', true], ['t3_dynamic', 'Dynamic ↓', true], ['overall', 'Overall ↑', false]];
  const t = el('table', { class: 'maintable' });
  t.append(el('thead', {}, el('tr', {}, el('th', {}, 'Method'), el('th', { colspan: 3, style: { textAlign: 'center' } }, 'Task 2: generated video'), el('th', { colspan: 2, style: { textAlign: 'center' } }, 'Task 3: violation'), el('th', {}, '')),
    el('tr', {}, el('th', {}, ''), ...cols.map(c => el('th', {}, c[1])))));
  const body = el('tbody');
  const val = (r, k) => k === 'viol' ? r.viol_p : k === 'sis' ? r.sis_p : k === 'slide' ? r.slide_p : r[k];
  for (const g of gens) {
    body.append(el('tr', { class: 'g' }, el('td', { colspan: 7 }, g.name + (g.concurrent ? ' †' : ''))));
    const rs = R.rows.filter(r => r.generator === g.id);
    const rank = {};
    for (const [k, , low] of cols) { const vs = [...new Set(rs.map(r => val(r, k)))].sort((a, b) => low ? a - b : b - a); rank[k] = vs; }
    for (const r of rs) body.append(el('tr', { class: r.method === 'collision' || r.method === 'prediction' ? 'ours' : '' }, el('td', {}, M[r.method][0]),
      ...cols.map(([k]) => { const v = val(r, k); const i = rank[k].indexOf(v); return el('td', { class: i === 0 ? 'best' : i === 1 ? 'second' : '' }, k === 'overall' ? v.toFixed(1) : String(v)); })));
  }
  t.append(body); tb.append(t, el('p', { class: 'note', style: { marginTop: '8px' } }, 'Bold: best, underlined: second per generator (as in the paper). † concurrent work.'));
  $$('#rview button').forEach(b => b.addEventListener('click', () => { $$('#rview button').forEach(x => x.setAttribute('aria-pressed', x === b)); const tab = b.dataset.v === 'table'; tb.hidden = !tab; $('#chartbox').hidden = tab; }));
  // Task 1
  const t1 = $('#t1table');
  t1.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', { colspan: 2 }, 'Missed ↓'), el('th', { colspan: 2 }, 'False ↓'), el('th', { colspan: 3 }, 'Score ↑')),
    el('tr', {}, el('th', {}, ''), ...['Coll', 'Pred', 'Coll', 'Pred', 'Raw', 'Coll', 'Pred'].map(s => el('th', {}, s)))));
  const tb1 = el('tbody');
  for (const r of R.task1) {
    const c = r.modes.collision, p = r.modes.prediction, f = (x) => x == null ? '–' : x.toFixed(1);
    const better = (a, b, low) => (b == null ? 'best' : (low ? a <= b : a >= b) ? 'best' : '');
    tb1.append(el('tr', {}, el('td', {}, GEN_NAME[r.generator]),
      el('td', { class: p ? better(c.missed, p.missed, true) : '' }, f(c.missed)), el('td', { class: p ? better(p.missed, c.missed, true) : '' }, f(p?.missed)),
      el('td', { class: p ? better(c.false, p.false, true) : '' }, f(c.false)), el('td', { class: p ? better(p.false, c.false, true) : '' }, f(p?.false)),
      el('td', {}, f(r.raw_score)), el('td', { class: p ? better(c.score, p.score) : '' }, f(c.score)), el('td', { class: p ? better(p.score, c.score) : '' }, f(p?.score))));
  }
  t1.append(tb1);
  // open paths: share of the 50 open-path videos that neither stop early nor go back (the paper's measure), Coll · Pred
  const ob = $('#open-bars');
  for (const g of gens) {
    const c = R.rows.find(r => r.generator === g.id && r.method === 'collision'), p = R.rows.find(r => r.generator === g.id && r.method === 'prediction');
    const v = (r) => r && r.open_no_stop_back != null ? r.open_no_stop_back : null;
    ob.append(el('div', { class: 'cost' }, el('span', {}, g.name), el('div', { class: 'bar' }, el('i', { style: { width: v(c) + '%', background: '#1e9e5a' } })), el('span', { class: 'v' }, `${Math.round(v(c))}%${p && v(p) != null ? ' · ' + Math.round(v(p)) + '%' : ''}`)));
  }
  const hn = R.rows.find(r => r.generator === 'hynomas' && r.method === 'collision'), hr = R.rows.find(r => r.generator === 'hynomas' && r.method === 'raw');
  const viol = (r) => { const oc = r.open_categories || {}; const n = Object.values(oc).reduce((a, b) => a + b, 0) || 1; return Math.round(100 * Object.entries(oc).filter(([k]) => k.startsWith('violation')).reduce((a, [, v]) => a + v, 0) / n); };
  ob.append(el('p', { class: 'note', style: { margin: '4px 0 0' } }, `Coll · Pred. Only Hy-Nomas violates where nothing is in the way: ${viol(hr)}% raw, ${viol(hn)}% with NoPeWorld (Coll).`));
}
