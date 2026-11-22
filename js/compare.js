// Comparisons: Unreal / raw / external depth / NoPeWorld on one clock; route picker, generator tabs, mode switch,
// scrub, frame step, speed, contact tick, synced top view; a wipe on head-on straight routes.
import { $, $$, el, GEN, GEN_NAME, GEN_SHORT, getBench, getClips, chip, onVisible } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { infoBox } from './ui.js';
import { TopView, loadTop, keysFor } from './topview.js';
import { wipe } from './hero.js';
import { Overlay, loadTrack } from './overlay.js';

export async function initCompare() {
  const B = await getBench(), C = await getClips();
  const cats = B.categories;
  const R = Object.fromEntries(B.routes.map(r => [r.id, r]));
  // a figure shown here (bench.json figures, where 'compare'): its raw and collision tiles, chips and paths are the paper figure's own
  const figOf = (id) => Object.keys(B.figures || {}).find(k => B.figures[k].where === 'compare' && B.figures[k].case === id) || null;
  // generators with a 'slid' verdict in either NoPeWorld mode on a route (the title of the shared-slide entry follows the data)
  const nSlid = (id) => GEN.filter(x => ['collision', 'prediction'].some(m => R[id].res[x][m]?.[0] === 'slid')).length;
  const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
  // the default is the route where NoPeWorld truly responds like the engine (LingBot's best slide, user 11-22), then the rest
  const slides = GEN.filter(g => B.best_slide[g]).map(g => { const [id, m] = B.best_slide[g]; return { id, gen: g, mode: m, title: `Best slide · ${GEN_SHORT[g]}`, sub: (R[id].name || '').replace(/^(a|an|the) /i, '') }; })
    .filter((c, i, a) => a.findIndex(x => x.id === c.id && x.gen === c.gen) === i);
  const cases = [
    ...slides.slice(0, 1),
    { id: B.teaser, title: 'The teaser route', sub: 'W + A into an oblique wall' },
    { id: B.task2_fig, fig: figOf(B.task2_fig), title: 'A head-on pillar', sub: 'W straight at a stone block' },
    { id: 'ModularGothic_Day__n001', title: `Slides on ${WORD[nSlid('ModularGothic_Day__n001')]} models`, sub: 'W + turn along a balustrade' },
    ...slides.slice(1),
  ];
  const bar = $('#casebar');
  let route = cases[0].id, fig = cases[0].fig || null, gen = cases[0].gen || 'lingbot', mode = cases[0].mode || 'collision';
  cases.forEach((c, i) => bar.append(el('button', { class: 'casebtn', 'aria-pressed': i === 0, onclick: (e) => {
    $$('.casebtn', bar).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); route = c.id; fig = c.fig || null; if (c.gen) { gen = c.gen; mode = c.mode; } apply(); } },
    el('img', { src: `media/posters/${c.id}_s.webp`, alt: '', loading: 'lazy', width: 320, height: 180 }), el('span', {}, el('b', {}, c.title), el('em', {}, c.sub)))));
  const gseg = $('#cmp-gen');
  GEN.forEach(x => gseg.append(el('button', { 'aria-pressed': x === gen, 'data-g': x, onclick: () => { gen = x; apply(); } }, GEN_SHORT[x])));
  $$('#cmp-mode button').forEach(b => b.addEventListener('click', () => { mode = b.dataset.m; apply(); }));
  const g = new SyncGroup({ fps: 16 });
  const grid = $('#cmp-grid');
  const tiles = { unreal: makeTile(g, { label: 'Unreal Engine (ground truth)', dot: 'unreal' }), raw: makeTile(g, { label: 'Raw model', dot: 'raw' }),
    depth: makeTile(g, { label: 'External depth', dot: 'depth' }), ours: makeTile(g, { label: 'NoPeWorld', dot: 'ours' }) };
  Object.values(tiles).forEach(t => grid.append(t.root));
  const top = new TopView($('#cmp-top canvas'));
  // at the moment of contact every tile flashes a thin yellow edge, once per pass (quiet: no movement)
  let lastT = 0;
  g.on((t) => { top.setTime(t); const ct = top.contactTime(); if (ct != null && lastT < ct && t >= ct && g.playing) for (const k in tiles) { const r = tiles[k].root; r.classList.remove('hit'); void r.offsetWidth; r.classList.add('hit'); } lastT = t; });
  wirePlayer(g, { button: $('#cmp-play'), scrub: $('#cmp-scrub'), time: $('#cmp-time'), labelFrames: true });
  $('#cmp-prev').addEventListener('click', () => g.step(-1)); $('#cmp-next').addEventListener('click', () => g.step(1));
  $$('#cmp-speed button').forEach(b => b.addEventListener('click', () => { $$('#cmp-speed button').forEach(x => x.setAttribute('aria-pressed', x === b)); g.setRate(+b.dataset.r); }));
  const sec = $('#compare');
  document.addEventListener('keydown', (e) => {
    const r = sec.getBoundingClientRect(); if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.3) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.type !== 'range') return;
    if (e.key === 'ArrowLeft') { g.step(-1); e.preventDefault(); } else if (e.key === 'ArrowRight') { g.step(1); e.preventDefault(); }
  });
  const ov = $('#cmp-ov');
  ov.addEventListener('change', () => Object.values(tiles).forEach(t => { t.overlay.setOn(ov.checked); t.overlay.draw(g.frameOf(t.video.currentTime)); }));
  // wipe (head-on straight routes only)
  const ws = $('#wipe-stage'), wg = new SyncGroup({ fps: 16 }); const [wl, wr] = $$('video', ws);
  const wov = new Overlay($('canvas.ov', ws), wr); wg.add(wl); wg.add(wr, (f) => wov.draw(f)); wipe(ws, wg);
  onVisible(ws, (v) => wg.setVisible(v));
  async function apply() {
    const t0 = g.time;
    $$('button', gseg).forEach(b => b.setAttribute('aria-pressed', b.dataset.g === gen));
    $$('#cmp-mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode));
    const r = R[route], F = fig ? B.figures[fig] : null;
    const vq = (x, m) => F?.res[x]?.[m] || r.res[x][m];           // the figure's own verdict where it has that tile, else the route's
    const res = Object.fromEntries(['raw', 'depth', 'collision', 'prediction'].map(m => [m, vq(gen, m)]));
    const id = (m) => F?.res[gen]?.[m] ? `${F.prefix}__${gen}__${m}` : `${route}__${gen}__${m}`;
    const P = `media/posters/${route}.webp`;
    tiles.unreal.setClip(C[`${route}__unreal`] ? `${route}__unreal` : null, 'hi', P, C[`${route}__unreal`]?.track);
    for (const [k, m] of [['raw', 'raw'], ['depth', 'depth'], ['ours', mode]]) {
      const x = id(m);
      if (C[x]?.hi) tiles[k].setClip(x, 'hi', P, C[x].track);
      else tiles[k].missing(gen === 'evoke' && m === 'prediction' ? 'Evoke-Turbo keeps no memory between chunks: collision mode only' : 'no clip');
      tiles[k].setVerdict(res[m] ? chip(res[m][0], cats, res[m][0] === 'slid' && res[m][3] != null ? ` ${res[m][3]} m` : '') : null);
    }
    tiles.raw.setLabel(`${GEN_SHORT[gen]} · raw`, 'raw'); tiles.depth.setLabel(`${GEN_SHORT[gen]} · external depth`, 'depth');
    tiles.ours.setLabel(`${GEN_SHORT[gen]} · NoPeWorld (${mode === 'collision' ? 'Coll' : 'Pred'})`, 'ours');
    Object.values(tiles).forEach(t => t.overlay.setOn(ov.checked));
    const d = await loadTop(F ? F.top : route);
    top.set(d, keysFor(gen, ['raw', 'depth', mode]));
    const ct = top.contactTime(), tick = $('#cmp-tick');
    if (ct != null) { tick.hidden = false; tick.style.left = `calc(${(ct / 5.0625) * 100}% - 1px)`; } else tick.hidden = true;
    const info = $('#cmp-info'); info.innerHTML = '';
    const pick = cases.find(c => c.id === route && c.gen === gen);
    info.append(el('h3', {}, `${r.scene.replace(/_/g, ' ')} · ${(r.name || r.obstacle).replace(/^./, c => c.toUpperCase())}`),
      el('p', { class: 'note', style: { fontSize: '15px', color: 'var(--ink-2)' } }, `Input ${r.input}, approach ${r.angle}. Unreal ${r.cls === 'slide' ? 'slides along the obstacle' : 'stops at it'}. `,
        infoBox("Every chip is the Task 2 evaluator's verdict on that exact video, made on the reconstructed camera path and the true map; slide lengths are along the obstacle. The yellow overlay ends when SAM 2 loses the obstacle (no mask for 0.25 s, or the mask collapsing as the camera enters it), also when a camera slides past it or backs away, so it is a guide, not the verdict.", 'How to read the verdicts')));
    const tb = el('table', { class: 'vtable', style: { marginTop: '6px' } });
    tb.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Raw'), el('th', {}, 'Ext. depth'), el('th', {}, 'Coll'), el('th', {}, 'Pred'))));
    const body = el('tbody');
    for (const x of GEN) body.append(el('tr', { class: x === gen ? 'sel' : '', style: { cursor: 'pointer' }, onclick: () => { gen = x; apply(); } }, el('td', {}, GEN_SHORT[x]),
      ...['raw', 'depth', 'collision', 'prediction'].map(m => { const q = vq(x, m); return el('td', {}, q ? chip(q[0], cats) : '–'); })));
    tb.append(body); info.append(el('div', { class: 'tablewrap' }, tb));
    if (pick) info.append(el('p', { class: 'note', style: { marginTop: '8px' } }, `Picked by a fixed rule for ${GEN_NAME[gen]}. `,
      infoBox(`The clean slides with NoPeWorld (no violation, no going back, a slide of at least 0.5 m and at most 1.5× Unreal's), ranked by the raw model passing through, external depth not sliding, and the share of Unreal's slide.`, 'How this route was picked')));
    // wipe only where both cameras start on the same straight line
    const wipeOK = r.input === 'W' && r.angle === '0–15°' && C[id('raw')]?.hi && C[id(mode)]?.hi;
    $('#wipebox').hidden = !wipeOK;
    if (wipeOK) { wg.setSources([[wl, `media/hi/${id('raw')}.mp4`, P], [wr, `media/hi/${id(mode)}.mp4`, P]]); wov.set(C[id(mode)].track ? await loadTrack(id(mode)) : null); wg.play(); }
    else wg.pause();
    g.seek(Math.min(t0, 4.9)); if (g.want) g.play();
  }
  await apply();
  onVisible(grid, (v) => g.setVisible(v), 0.05);
  g.play();
}
