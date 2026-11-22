// Results: the paper's main table as an interactive dot chart (one row per generator, one marker per method, 95% CI
// whiskers where the result file has them), a table view, Task 1, open paths; plus the hero's headline bars.
import { $, $$, el, svg, json, showTip, hideTip, GEN_NAME, GEN_SHORT } from './util.js';
import { BarChart, legend } from './barchart.js';

const METRICS = [
  { k: 'viol', ci: 'viol_ci', name: 'Task 2 violation', short: 'Viol. ↓', low: true, note: 'Share of the 100 routes whose generated video penetrates, tunnels through or erases the obstacle (VGGT-Ω evaluator, rule v3.1). Hover a bar for its 95% CI.' },
  { k: 'sis', ci: 'sis_ci', name: 'Safe-Intent Score', short: 'SIS ↑', low: false, note: 'Zero unless the video is safe and moves with the input; otherwise penalises early stops and lost slide (mirrors R = P·A). Hover a bar for its 95% CI.' },
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
  const gens = R.generators;
  const row = (g, m) => R.rows.find(r => r.generator === g && r.method === m);
  // the main chart: one group of bars per generator, one bar per method; the metric tabs switch what the bars show
  const SERIES = [{ key: 'raw', name: 'Raw model', color: '#d33a2c' }, { key: 'text', name: 'Text prompt', color: '#8b5cf6', soft: true },
    { key: 'depth', name: 'External depth', color: '#3b6bff', soft: true }, { key: 'collision', name: 'NoPeWorld (Coll)', color: '#1e9e5a' },
    { key: 'prediction', name: 'NoPeWorld (Pred)', color: '#7cc79f' }];
  const groups = gens.map(g => ({ id: g.id, name: g.name + (g.concurrent ? ' †' : '') }));
  const chart = new BarChart($('#chart'), groups, SERIES, { bar: 10, gap: 3, pad: 14 });
  legend($('#mlegend'), SERIES);
  let metric = METRICS[0];
  const val = (r, k) => k === 'viol' ? r.viol_p : k === 'sis' ? r.sis_p : k === 'slide' ? r.slide_p : r[k];
  const show = () => {
    const m = metric;
    chart.set((g, k) => { const r = row(g, k); return r ? val(r, m.k) : null; }, (v) => m.k === 'overall' ? v.toFixed(1) : `${v}%`,
      (g, s) => { const r = row(g.id, s.key); if (!r) return ''; const c = m.ci && r[m.ci]; return `<b>${g.name}</b><br>${s.name}: ${m.k === 'overall' ? val(r, m.k).toFixed(1) : val(r, m.k) + '%'}${c ? ` <span style="opacity:.7">[${c[0].toFixed(0)}, ${c[1].toFixed(0)}]</span>` : ''}`; });
    $('#metric-note').textContent = `${m.name} (${m.low ? 'lower is better' : 'higher is better'}). ${m.note} † concurrent work.`;
  };
  const seg = $('#metric');
  METRICS.forEach((m, i) => seg.append(el('button', { 'aria-pressed': i === 0, onclick: (e) => { $$('button', seg).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); metric = m; show(); } }, m.short)));
  show();
  // table view
  const tb = $('#tablebox');
  const cols = [['sis', 'SIS ↑', false], ['viol', 'Viol. ↓', true], ['slide', 'Slide ↑', false], ['t3_static', 'Static ↓', true], ['t3_dynamic', 'Dynamic ↓', true], ['overall', 'Overall ↑', false]];
  // two tables side by side (three generators each), so the whole table fits one screen
  const table = (gs) => {
    const t = el('table', { class: 'maintable' });
    t.append(el('thead', {}, el('tr', {}, el('th', {}, 'Method'), el('th', { colspan: 3, style: { textAlign: 'center' } }, 'Task 2: generated video'), el('th', { colspan: 2, style: { textAlign: 'center' } }, 'Task 3: violation'), el('th', {}, '')),
      el('tr', {}, el('th', {}, ''), ...cols.map(c => el('th', {}, c[1])))));
    const body = el('tbody');
    for (const g of gs) {
      body.append(el('tr', { class: 'g' }, el('td', { colspan: 7 }, g.name + (g.concurrent ? ' †' : ''))));
      const rs = R.rows.filter(r => r.generator === g.id);
      const rank = {};
      for (const [k, , low] of cols) { const vs = [...new Set(rs.map(r => val(r, k)))].sort((a, b) => low ? a - b : b - a); rank[k] = vs; }
      for (const r of rs) body.append(el('tr', { class: r.method === 'collision' || r.method === 'prediction' ? 'ours' : '' }, el('td', {}, M[r.method][0]),
        ...cols.map(([k]) => { const v = val(r, k); const i = rank[k].indexOf(v); return el('td', { class: i === 0 ? 'best' : i === 1 ? 'second' : '' }, k === 'overall' ? v.toFixed(1) : String(v)); })));
    }
    t.append(body); return t;
  };
  tb.append(el('div', { class: 'tables2' }, table(gens.slice(0, 3)), table(gens.slice(3))),
    el('p', { class: 'note', style: { marginTop: '8px' } }, 'Bold: best, underlined: second per generator (as in the paper). † concurrent work.'));
  $$('#rview button').forEach(b => b.addEventListener('click', () => { $$('#rview button').forEach(x => x.setAttribute('aria-pressed', x === b)); const tab = b.dataset.v === 'table'; tb.hidden = !tab; $('#chartbox').hidden = tab; $('#metric').style.visibility = tab ? 'hidden' : ''; }));
  // Task 1: the decision on the true history, as bars: raw model vs the two modes, one metric at a time
  const T1S = [{ key: 'raw', name: 'Raw model', color: '#d33a2c' }, { key: 'collision', name: 'NoPeWorld (Coll)', color: '#1e9e5a' }, { key: 'prediction', name: 'NoPeWorld (Pred)', color: '#7cc79f' }];
  const T1M = [
    { k: 'missed', short: 'Missed ↓', note: 'Unsafe commands let through (kept although they would penetrate). The raw model lets every one through.' },
    { k: 'score', short: 'Decision score ↑', note: 'Decision score: 100 at the reward-optimal motion (100 × (1 − regret)).' },
    { k: 'false', short: 'False ↓', note: 'Safe commands changed for no reason. The raw model changes none.' }];
  const t1 = new BarChart($('#t1chart'), gens.map(g => ({ id: g.id, name: g.name })), T1S, { bar: 9, gap: 3, pad: 12, label: 150 });
  legend($('#t1legend'), T1S);
  const T1 = Object.fromEntries(R.task1.map(r => [r.generator, r]));
  const t1v = (g, k, m) => { const r = T1[g]; if (!r) return null; if (k === 'raw') return m === 'missed' ? 100 : m === 'false' ? 0 : r.raw_score; const x = r.modes[k]; return x ? x[m] : null; };
  let t1m = T1M[0];
  const t1show = () => { t1.set((g, k) => t1v(g, k, t1m.k), (v) => t1m.k === 'score' ? v.toFixed(1) : `${v.toFixed(1)}%`); $('#t1note').textContent = t1m.note; };
  const t1seg = $('#t1metric');
  T1M.forEach((m, i) => t1seg.append(el('button', { 'aria-pressed': i === 0, onclick: (e) => { $$('button', t1seg).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); t1m = m; t1show(); } }, m.short)));
  t1show();
  // open paths: share of the 50 open-path videos that neither stop early nor go back (the paper's measure), both modes
  const OPS = [{ key: 'collision', name: 'NoPeWorld (Coll)', color: '#1e9e5a' }, { key: 'prediction', name: 'NoPeWorld (Pred)', color: '#7cc79f' }];
  const op = new BarChart($('#openchart'), gens.map(g => ({ id: g.id, name: g.name })), OPS, { bar: 9, gap: 3, pad: 12, label: 150 });
  legend($('#openlegend'), OPS);
  op.set((g, k) => { const r = row(g, k); return r && r.open_no_stop_back != null ? r.open_no_stop_back : null; }, (v) => `${Math.round(v)}%`);
  const hn = row('hynomas', 'collision'), hr = row('hynomas', 'raw');
  const viol = (r) => { const oc = r.open_categories || {}; const n = Object.values(oc).reduce((a, b) => a + b, 0) || 1; return Math.round(100 * Object.entries(oc).filter(([k]) => k.startsWith('violation')).reduce((a, [, v]) => a + v, 0) / n); };
  $('#opennote').textContent = `Only Hy-Nomas violates where nothing is in the way: ${viol(hr)}% raw, ${viol(hn)}% with NoPeWorld (Coll).`;
}
