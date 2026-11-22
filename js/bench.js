// NoPeBench explorer: all 150 Task 2 routes; filters; live violation rates on the filtered routes; cards with the hand-off
// frame and a mini top view; a viewer with synced clips (Unreal, raw, collision mode), the top view of every method and
// every generator's verdicts.
import { $, $$, el, GEN, GEN_NAME, GEN_SHORT, getBench, getClips, chip, whenNear, METH_COLOR, reduceMotion } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { TopView, loadTop, keysFor } from './topview.js';

const PAGE = 24;

export async function initBench() {
  const B = await getBench(), C = await getClips();
  const cats = B.categories;
  const routes = B.routes;
  // the marquee above the heading: every route's hand-off frame, two rows; a click opens that route
  $$('#marquee .mq-row').forEach((row, k) => {
    const half = routes.filter((_, i) => i % 2 === k), capm = (s) => s.replace(/^(a|an|the) /i, '').replace(/^./, c => c.toUpperCase());
    for (let rep = 0; rep < 2; rep++) for (const r of half) row.append(el('button', { tabindex: '-1', 'data-name': `${r.name ? capm(r.name) : r.track === 'control' ? 'Open path' : r.obstacle} · ${r.scene.replace(/_/g, ' ')}`, onclick: () => openViewer(r) },
      el('img', { src: `media/posters/${r.id}_s.webp`, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 })));
  });
  const st = { gen: 'lingbot', set: 'critical', obstacle: new Set(), input: new Set(), angle: new Set(), outcome: new Set(), shown: PAGE };
  const F = $('#filters');
  const count = (pred) => routes.filter(pred).length;
  const row = (label, items, key, multi = true) => {
    const r = el('div', { class: 'frow' }, el('span', { class: 'fl' }, label));
    for (const [v, text, n] of items) {
      const b = el('button', { class: 'fchip', 'aria-pressed': multi ? 'false' : String(st[key] === v), 'data-v': v }, text, n != null ? el('span', { class: 'n' }, n) : null);
      b.addEventListener('click', () => {
        if (multi) { st[key].has(v) ? st[key].delete(v) : st[key].add(v); b.setAttribute('aria-pressed', st[key].has(v)); }
        else { st[key] = v; $$('.fchip', r).forEach(x => x.setAttribute('aria-pressed', x === b)); }
        st.shown = PAGE; render();
      });
      r.append(b);
    }
    F.append(r);
  };
  row('Generator', GEN.map(g => [g, GEN_SHORT[g]]), 'gen', false);
  row('Routes', [['critical', 'Into an obstacle', 100], ['control', 'Open path', 50]], 'set', false);
  const crit = routes.filter(r => r.track === 'critical');
  const uniq = (k) => [...new Set(crit.map(r => r[k]))];
  row('Obstacle', uniq('obstacle').sort().map(o => [o, o, crit.filter(r => r.obstacle === o).length]), 'obstacle');
  row('Input', uniq('input').map(o => [o, o.replace('turn', ' turn'), crit.filter(r => r.input === o).length]), 'input');
  row('Approach', ['0–15°', '15–45°', '≥45°'].map(o => [o, o, crit.filter(r => r.angle === o).length]), 'angle');
  row('NoPeWorld', [['viol', 'violates'], ['back', 'goes back'], ['ok', 'stops'], ['slide', 'slides'], ['early', 'stops early'], ['idle', 'other']], 'outcome');
  const outcomeRow = F.lastChild;
  const statsEl = $('#bench-stats'), cardsEl = $('#cards'), more = $('#more');
  const cache = new Map(); let lastGen = null;
  const filtered = () => routes.filter(r => r.track === st.set
    && (!st.obstacle.size || st.obstacle.has(r.obstacle)) && (!st.input.size || st.input.has(r.input)) && (!st.angle.size || st.angle.has(r.angle))
    && (!st.outcome.size || (r.res[st.gen].collision && st.outcome.has(cats[r.res[st.gen].collision[0]].group))));
  const rate = (rs, m) => { const v = rs.map(r => r.res[st.gen][m]).filter(Boolean); return v.length ? [Math.round(100 * v.filter(x => x[1]).length / v.length), v.length] : null; };
  function render() {
    for (const r of $$('.frow', F)) if (r !== outcomeRow && r !== F.firstChild && r !== F.children[1]) r.style.opacity = st.set === 'control' ? .45 : 1;
    const rs = filtered();
    statsEl.innerHTML = '';
    statsEl.append(el('div', { class: 'stat' }, el('div', { class: 'v' }, String(rs.length)), el('div', { class: 'l' }, 'routes')));
    for (const [m, name, cls] of [['raw', 'raw model', 'raw'], ['depth', 'external depth', 'depth'], ['collision', 'NoPeWorld (Coll)', 'ours'], ['prediction', 'NoPeWorld (Pred)', 'ours']]) {
      const v = rate(rs, m); if (!v) continue;
      statsEl.append(el('div', { class: `stat ${cls}` }, el('div', { class: 'v' }, `${v[0]}%`), el('div', { class: 'l' }, `violate · ${name}`)));
    }
    statsEl.append(el('div', { class: 'stat wide', style: { flex: 1, minWidth: '200px' }, title: 'Task 2 evaluator verdicts on the routes shown.' },
      el('div', { class: 'l' }, `${GEN_NAME[st.gen]} · verdicts on the routes shown`)));
    // cards are kept per route and generator, so a filter change can move them (FLIP) instead of rebuilding them
    const gs = window.gsap, F2 = window.Flip, animate = gs && F2 && !reduceMotion && lastGen === st.gen && cardsEl.childElementCount;
    const state = animate ? F2.getState(cardsEl.children) : null;
    const list = rs.slice(0, st.shown).map(r => { const k = `${r.id}|${st.gen}`; if (!cache.has(k)) cache.set(k, card(r)); return cache.get(k); });
    cardsEl.replaceChildren(...list);
    if (state) F2.from(state, { duration: .6, ease: 'power3.inOut', absolute: true, onEnter: (els) => gs.fromTo(els, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: .45, ease: 'power2.out' }) });
    else if (gs && !reduceMotion && lastGen != null) gs.fromTo(list.slice(0, 16), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .5, stagger: .02, ease: 'power2.out', clearProps: 'transform' });
    lastGen = st.gen;
    more.hidden = rs.length <= st.shown;
    more.textContent = `Show more routes (${rs.length - st.shown} left)`;
  }
  more.addEventListener('click', () => { st.shown += PAGE; render(); });
  function card(r) {
    const cv = el('canvas');
    const raw = r.res[st.gen].raw, col = r.res[st.gen].collision;
    const b = el('button', { class: 'rcard', 'aria-label': `Open route ${r.id}` },
      el('div', { class: 'pics' }, el('img', { src: `media/posters/${r.id}_s.webp`, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 }), cv),
      el('div', { class: 'body' }, el('div', { class: 't' }, r.name ? cap(r.name) : (r.track === 'control' ? 'Open path' : r.obstacle)),
        el('div', { class: 's' }, `${r.scene.replace(/_/g, ' ')} · ${r.track === 'control' ? r.template : `${r.input} · ${r.angle}`}`),
        el('div', { class: 'v' }, raw ? chip(raw[0], cats, '') : null, col ? chip(col[0], cats, '') : null)));
    if (raw) b.querySelector('.v').firstChild.title = 'raw model: ' + raw[0];
    if (col) b.querySelector('.v').lastChild.title = 'NoPeWorld (Coll): ' + col[0];
    b.addEventListener('click', () => openViewer(r));
    whenNear(cv, async () => { const d = await loadTop(r.id); const tv = new TopView(cv, { mini: true }); tv.set(d, keysFor(st.gen, ['raw', 'collision'], { width: 1.6 })); }, '200px');
    return b;
  }
  const cap = (s) => s.replace(/^(a|an|the) /i, '').replace(/^./, c => c.toUpperCase());
  render();

  // ---------- viewer
  const dlg = $('#viewer'), g = new SyncGroup({ fps: 16 });
  const tiles = [makeTile(g, { label: 'Unreal (ground truth)', dot: 'unreal' }), makeTile(g, { label: 'Raw', dot: 'raw' }), makeTile(g, { label: 'NoPeWorld (Coll)', dot: 'ours' })];
  tiles.forEach(t => $('#v-tiles').append(t.root));
  const top = new TopView($('#v-top canvas'));
  g.on((t) => top.setTime(t));
  const setPlay = wirePlayer(g, { button: $('#v-play'), scrub: $('#v-scrub'), time: $('#v-time') });
  let cur = null, vgen = st.gen;
  const vg = $('#v-gen');
  GEN.forEach(x => vg.append(el('button', { 'aria-pressed': 'false', 'data-g': x, onclick: () => { vgen = x; fill(); } }, GEN_SHORT[x])));
  async function fill() {
    const r = cur;
    $$('button', vg).forEach(b => b.setAttribute('aria-pressed', b.dataset.g === vgen));
    $('#v-title').textContent = `${r.scene.replace(/_/g, ' ')} · ${r.name ? cap(r.name) : 'open path'}`;
    const id0 = `${r.id}__unreal`, id1 = `${r.id}__${vgen}__raw`, id2 = `${r.id}__${vgen}__collision`;
    const res = (id) => C[id]?.lo ? 'lo' : C[id]?.hi ? 'hi' : null;
    tiles[0].setClip(C[id0] ? id0 : null, res(id0), `media/posters/${r.id}_s.webp`, false);
    if (r.track === 'control') tiles[1].missing('open paths: only collision-mode clips are included');
    else tiles[1].setClip(C[id1] ? id1 : null, res(id1), `media/posters/${r.id}_s.webp`, C[id1]?.track);
    tiles[2].setClip(C[id2] ? id2 : null, res(id2), `media/posters/${r.id}_s.webp`, C[id2]?.track);
    const v = r.res[vgen];
    tiles[1].setVerdict(v.raw ? chip(v.raw[0], cats) : null); tiles[2].setVerdict(v.collision ? chip(v.collision[0], cats) : null);
    tiles[1].setLabel(`${GEN_SHORT[vgen]} · raw`, 'raw'); tiles[2].setLabel(`${GEN_SHORT[vgen]} · NoPeWorld (Coll)`, 'ours');
    const d = await loadTop(r.id);
    top.set(d, keysFor(vgen, ['raw', 'depth', 'collision', 'prediction']));
    const dropped = Object.keys(d.dropped).filter(k => k.startsWith(vgen + '|'));
    $('#v-desc').textContent = `${r.track === 'control' ? 'Open path: nothing blocks the input for its whole length.' : `Input ${r.input} into ${r.name || r.obstacle}, approach ${r.angle}; Unreal ${r.cls === 'slide' ? 'slides along the obstacle' : 'stops at the obstacle'}.`} Clips: 320-px previews of the judged videos.` + (dropped.length ? ` Not drawn on the map (history misfit > 15 cm): ${dropped.map(k => k.split('|')[1]).join(', ')}.` : '');
    // verdict table: every generator x method
    const T = $('#v-table'); T.innerHTML = '';
    const ms = ['raw', 'depth', 'collision', 'prediction'];
    T.append(el('thead', {}, el('tr', {}, el('th', {}, 'Generator'), ...ms.map(m => el('th', {}, { raw: 'Raw', depth: 'External depth', collision: 'NoPeWorld (Coll)', prediction: 'NoPeWorld (Pred)' }[m])))));
    const tb = el('tbody');
    for (const x of GEN) tb.append(el('tr', { class: x === vgen ? 'sel' : '' }, el('td', {}, GEN_NAME[x]),
      ...ms.map(m => { const q = r.res[x][m]; return el('td', {}, q ? chip(q[0], cats, q[3] != null && q[0] === 'slid' ? ` ${q[3]} m` : '') : el('span', { class: 'small' }, '–')); })));
    T.append(tb);
    g.seek(0); g.play(true); setTimeout(setPlay, 50);
  }
  function openViewer(r) { cur = r; vgen = st.gen; if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); fill(); }
  const close = () => { g.pause(true); if (dlg.open) dlg.close(); };
  $('#v-close').addEventListener('click', close);
  dlg.addEventListener('close', () => g.pause(true));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
}
