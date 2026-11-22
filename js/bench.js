// NoPeBench in two screens. Screen A (static HTML): the head, one row of every route's hand-off frame, the three tasks.
// Screen B: all 150 Task 2 routes; compact filters (generator and route set as buttons, the rest as selects); live
// violation rates on the filtered routes; two rows of route cards at a time (hand-off frame with a play button, a mini top
// view, the raw and NoPeWorld verdicts) with Prev / Next paging; a viewer that plays the route's synced clips (Unreal,
// raw, collision mode) at once, with the top view of every method and every generator's verdicts.
import { $, $$, el, clamp, GEN, GEN_NAME, GEN_SHORT, ICON, getBench, getClips, chip, whenNear, lowData, reduceMotion } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { TopView, loadTop, keysFor } from './topview.js';

const PAGE = 8;           // two rows of four on desktop (four rows of two on phones)
// autoplay gate for the cards' clips: >= 4 cores, deviceMemory unknown or >= 4 GB, no Save-Data, no reduced motion, Low data off
const autoplayOn = () => (navigator.hardwareConcurrency || 0) >= 4 && (navigator.deviceMemory == null || navigator.deviceMemory >= 4)
  && !(navigator.connection && navigator.connection.saveData) && !reduceMotion && !lowData.on;
const OUTCOMES = [['viol', 'violates'], ['back', 'goes back'], ['ok', 'stops'], ['slide', 'slides'], ['early', 'stops early'], ['idle', 'other']];
const cap = (s) => s.replace(/^(a|an|the) /i, '').replace(/^./, c => c.toUpperCase());
const nameOf = (r) => r.name ? cap(r.name) : (r.track === 'control' ? 'Open path' : r.obstacle);
const sceneOf = (r) => r.scene.replace(/_/g, ' ');

export async function initBench() {
  const B = await getBench(), C = await getClips();
  const cats = B.categories;
  const routes = B.routes;
  // ---------- screen A: two rows of hand-off frames (each twice, for the loop), drifting in opposite directions; a click opens that route
  $$('#marquee .mq-row').forEach((mq, k) => { const half = routes.filter((_, i) => i % 2 === k);
  for (let rep = 0; rep < 2; rep++) for (const r of half) mq.append(el('button', { tabindex: '-1', 'data-name': `${nameOf(r)} · ${sceneOf(r)}`, onclick: () => openViewer(r) },
    el('img', { src: `media/posters/${r.id}_s.webp`, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 })));
  });

  // ---------- screen B: filters
  const st = { gen: 'lingbot', set: 'critical', obstacle: '', input: '', angle: '', outcome: '', page: 0 };
  const F = $('#filters');
  const crit = routes.filter(r => r.track === 'critical');
  const uniq = (k) => [...new Set(crit.map(r => r[k]))];
  const seg = (label, id, key, items, showLabel = true) => {
    const g = el('div', { class: 'seg', role: 'group', 'aria-label': label, id });
    for (const [v, text, n] of items) g.append(el('button', { 'aria-pressed': String(st[key] === v), 'data-v': v, onclick: () => {
      if (st[key] === v) return;
      st[key] = v; $$('button', g).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); changed();
    } }, text, n != null ? el('span', { class: 'n' }, n) : null));
    return el('div', { class: 'fgroup' }, showLabel ? el('span', { class: 'fl' }, label) : null, g);
  };
  const sels = {};
  const select = (label, id, key, items) => {
    const s = el('select', { id }, el('option', { value: '' }, 'All'), ...items.map(([v, text, n]) => el('option', { value: v }, n != null ? `${text} (${n})` : text)));
    s.addEventListener('change', () => { st[key] = s.value; changed(); });
    sels[key] = s;
    return el('label', { class: 'fsel' }, el('span', { class: 'fl' }, label), s);
  };
  const clear = el('button', { class: 'freset', type: 'button', hidden: true, onclick: () => { for (const k in sels) { sels[k].value = ''; st[k] = ''; } changed(); } }, 'Clear filters');
  F.append(
    el('div', { class: 'frow' },
      seg('Generator', 'f-gen', 'gen', GEN.map(g => [g, GEN_SHORT[g]])),
      seg('Routes', 'f-set', 'set', [['critical', 'Into an obstacle', 100], ['control', 'Open path', 50]], false)),
    el('div', { class: 'frow' },
      select('Obstacle', 'f-obstacle', 'obstacle', uniq('obstacle').sort().map(o => [o, o, crit.filter(r => r.obstacle === o).length])),
      select('Input', 'f-input', 'input', uniq('input').map(o => [o, o.replace('turn', ' turn'), crit.filter(r => r.input === o).length])),
      select('Approach', 'f-angle', 'angle', ['0–15°', '15–45°', '≥45°'].map(o => [o, o, crit.filter(r => r.angle === o).length])),
      select('NoPeWorld', 'f-outcome', 'outcome', OUTCOMES),
      clear));
  const okOption = $('option[value="ok"]', sels.outcome);
  function changed() {
    // open paths have no obstacle, input template or approach angle of the critical set: those selects are cleared and off
    const open = st.set === 'control';
    for (const k of ['obstacle', 'input', 'angle']) { if (open) { sels[k].value = ''; st[k] = ''; } sels[k].disabled = open; sels[k].closest('.fsel').classList.toggle('off', open); }
    okOption.textContent = open ? 'follows the input' : 'stops';
    for (const k in sels) sels[k].classList.toggle('on', !!st[k]);
    clear.hidden = !Object.keys(sels).some(k => st[k]);
    st.page = 0; render();
  }

  // ---------- rates, cards, pager
  const statsEl = $('#bench-stats'), cardsEl = $('#cards'), prev = $('#pg-prev'), next = $('#pg-next'), status = $('#pg-status');
  const cache = new Map();
  const filtered = () => routes.filter(r => r.track === st.set
    && (!st.obstacle || st.obstacle === r.obstacle) && (!st.input || st.input === r.input) && (!st.angle || st.angle === r.angle)
    && (!st.outcome || (r.res[st.gen].collision && st.outcome === cats[r.res[st.gen].collision[0]].group)));
  const rate = (rs, m) => { const v = rs.map(r => r.res[st.gen][m]).filter(Boolean); return v.length ? [Math.round(100 * v.filter(x => x[1]).length / v.length), v.length] : null; };
  let reserved = 0;
  const reserve = () => {   // the grid keeps the height of a full page, so the pager stays under the pointer on a short last page
    const c = cardsEl.querySelector('.rcard'); if (!c) return;
    const cols = getComputedStyle(cardsEl).gridTemplateColumns.split(' ').length || 1, rows = Math.ceil(PAGE / cols);
    const gap = parseFloat(getComputedStyle(cardsEl).rowGap) || 0;
    reserved = Math.ceil(rows * c.getBoundingClientRect().height + (rows - 1) * gap);
    cardsEl.style.minHeight = reserved + 'px';
  };
  function render() {
    const rs = filtered();
    statsEl.innerHTML = '';
    statsEl.append(el('div', { class: 'stat' }, el('div', { class: 'v' }, String(rs.length)), el('div', { class: 'l' }, 'routes')));
    for (const [m, name, cls] of [['raw', 'raw model', 'raw'], ['depth', 'external depth', 'depth'], ['collision', 'NoPeWorld (Coll)', 'ours'], ['prediction', 'NoPeWorld (Pred)', 'ours']]) {
      const v = rate(rs, m); if (!v) continue;
      statsEl.append(el('div', { class: `stat ${cls}` }, el('div', { class: 'v' }, `${v[0]}%`), el('div', { class: 'l' }, `violate · ${name}`)));
    }
    statsEl.append(el('div', { class: 'stat wide', title: "Task 2 evaluator verdicts on the routes shown. With no filter the rates equal the paper's table." },
      el('div', { class: 'l' }, `${GEN_NAME[st.gen]} · verdicts on the routes shown`)));
    const pages = Math.max(1, Math.ceil(rs.length / PAGE));
    st.page = clamp(st.page, 0, pages - 1);
    const a = st.page * PAGE, shown = rs.slice(a, a + PAGE);
    const list = shown.map(r => { const k = `${r.id}|${st.gen}`; if (!cache.has(k)) cache.set(k, card(r)); return cache.get(k); });
    for (const c of onPage) if (!list.includes(c)) clipOff(c, true);
    onPage = list;
    cardsEl.replaceChildren(...(list.length ? list : [el('p', { class: 'empty' }, 'No route matches these filters.')]));
    list.forEach(c => c._map());
    watch();
    cardsEl.classList.remove('turn'); void cardsEl.offsetWidth; cardsEl.classList.add('turn');     // a short fade, nothing moves
    status.textContent = rs.length ? `Routes ${a + 1}–${a + shown.length} of ${rs.length}` : 'No routes';
    prev.disabled = st.page === 0; next.disabled = st.page >= pages - 1;
    const left = rs.length - (a + PAGE);
    next.innerHTML = left > 0 ? `Next ${Math.min(PAGE, left)} &rsaquo;` : 'Next &rsaquo;';
    if (list.length === PAGE || !reserved) reserve();
  }
  const turn = (d) => {
    st.page += d; render();
    const top = cardsEl.getBoundingClientRect().top;       // phones: a page taller than the screen starts at its first card
    if (top < 70) window.scrollBy(0, top - 80);
  };
  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  // ---------- card clips: muted, inline, looping; fetched when a card first comes on screen, playing only while it is on
  // screen and no viewer is open. Only the cards of the current page exist, so at most one page (8 clips, 320 x 178) plays.
  let onPage = [];
  const hint = $('.cards-hint');
  const clipOn = (c) => {
    const v = c._clip; if (!v || !autoplayOn() || $('#viewer').open) return;
    if (!v.getAttribute('src')) { v.src = v.dataset.src; }
    v.play().catch(() => {});
  };
  const clipOff = (c, unload) => {
    const v = c._clip; if (!v) return;
    v.pause();
    if (unload && v.getAttribute('src')) { vio?.unobserve(v); v.removeAttribute('src'); v.load(); c.classList.remove('live'); }
  };
  const vio = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach(e => {
    const c = e.target.closest('.rcard'); if (c) e.isIntersecting ? clipOn(c) : clipOff(c);
  }), { threshold: 0.35 }) : null;
  const watch = () => {                // (re)observe the page's clips: observing reports the current visibility at once
    const on = autoplayOn();
    if (hint) hint.lastChild.textContent = on ? 'Click a route to open all its clips and the top view.' : 'Click a route to play its videos.';
    cardsEl.classList.toggle('autoplay', on);
    for (const c of onPage) if (c._clip && vio) { vio.unobserve(c._clip); if (on) vio.observe(c._clip); }
  };
  lowData.listen((on) => { if (on) onPage.forEach(c => clipOff(c, true)); watch(); });
  const pauseCards = () => onPage.forEach(c => clipOff(c));
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { cardsEl.style.minHeight = ''; reserved = 0; reserve(); onPage.forEach(c => c._map()); }, 150); });

  function card(r) {
    const cv = el('canvas', { 'aria-hidden': 'true' }), gen = st.gen;
    const v = r.res[gen], raw = v.raw, col = v.collision;
    const verdict = (who, cls, q, name) => {
      if (!q) return [];
      const c = chip(q[0], cats, ''); c.title = `${name}: ${q[0]}`;
      return [el('span', { class: `who ${cls}` }, who), c];
    };
    const cid = `${r.id}__${gen}__collision`, cres = C[cid]?.lo ? 'lo' : C[cid]?.hi ? 'hi' : null;
    const clip = cres ? el('video', { preload: 'none', loop: true, muted: true, playsinline: true, disablepictureinpicture: true, 'aria-hidden': 'true', 'data-src': `media/${cres}/${cid}.mp4` }) : null;
    if (clip) { clip.muted = true; clip.playsInline = true; clip.addEventListener('playing', () => b.classList.add('live')); }
    const b = el('button', { class: 'rcard', type: 'button', 'aria-label': `Play route ${r.id}: ${nameOf(r)}, ${sceneOf(r)}` },
      el('div', { class: 'pics' },
        el('div', { class: 'ph' }, el('img', { src: `media/posters/${r.id}_s.webp`, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180 }),
          clip, clip ? el('span', { class: 'rtag', 'aria-hidden': 'true' }, el('i'), 'NoPeWorld') : null,
          el('span', { class: 'rplay', 'aria-hidden': 'true', html: ICON.play })),
        el('div', { class: 'tv' }, cv)),
      el('div', { class: 'body' }, el('div', { class: 't' }, nameOf(r)),
        el('div', { class: 's' }, `${sceneOf(r)} · ${r.track === 'control' ? r.template : `${r.input} · ${r.angle}`}`),
        el('div', { class: 'v' }, ...verdict('Raw', 'raw', raw, 'raw model'), ...verdict('NoPeWorld', 'ours', col, 'NoPeWorld (Coll)'))));
    b._clip = clip;
    b.addEventListener('click', () => openViewer(r));
    // the mini top view is drawn only on a card that is on the page with a laid-out box (a map that arrives after its card
    // left the page waits until the card is back: render() calls _map again)
    let data = null, tv = null;
    b._map = () => {
      if (!data || tv || !cv.isConnected || !cv.getBoundingClientRect().width) return;
      tv = new TopView(cv, { mini: true }); tv.set(data, keysFor(gen, ['raw', 'collision'], { width: 1.6 }));
    };
    whenNear(cv, async () => { data = await loadTop(r.id); b._map(); }, '200px');
    return b;
  }
  render();

  // ---------- viewer: plays as soon as it opens; a click on a clip pauses or resumes, a paused clip shows a big play button
  const dlg = $('#viewer'), g = new SyncGroup({ fps: 16 });
  const tiles = [makeTile(g, { label: 'Unreal (ground truth)', dot: 'unreal' }), makeTile(g, { label: 'Raw', dot: 'raw' }), makeTile(g, { label: 'NoPeWorld (Coll)', dot: 'ours' })];
  tiles.forEach(t => $('#v-tiles').append(t.root));
  $('#v-tiles').addEventListener('click', (e) => { if (!e.target.closest('.play')) g.toggle(); });
  const top = new TopView($('#v-top canvas'));
  g.on((t) => top.setTime(t));
  const setPlay = wirePlayer(g, { button: $('#v-play'), scrub: $('#v-scrub'), time: $('#v-time') });
  const stateEl = $('#v-state'); let shownState = '';
  g.on(() => {
    const live = g.live(), wait = g.playing && live.some(it => it.video.readyState < 3 && !it.video.ended);
    const s = !g.playing ? 'Paused' : wait ? 'Loading…' : 'Playing';
    if (s === shownState) return;
    shownState = s; stateEl.textContent = s; dlg.classList.toggle('paused', s === 'Paused');
  });
  let cur = null, vgen = st.gen, token = 0;
  const vg = $('#v-gen');
  GEN.forEach(x => vg.append(el('button', { 'aria-pressed': 'false', 'data-g': x, onclick: () => { vgen = x; fill(); } }, GEN_SHORT[x])));
  async function fill() {
    const r = cur, my = ++token;
    $$('button', vg).forEach(b => b.setAttribute('aria-pressed', b.dataset.g === vgen));
    $('#v-title').textContent = `${sceneOf(r)} · ${r.name ? cap(r.name) : 'open path'}`;
    const id0 = `${r.id}__unreal`, id1 = `${r.id}__${vgen}__raw`, id2 = `${r.id}__${vgen}__collision`;
    const res = (id) => C[id]?.lo ? 'lo' : C[id]?.hi ? 'hi' : null;
    tiles[0].setClip(C[id0] ? id0 : null, res(id0), `media/posters/${r.id}_s.webp`, false);
    if (r.track === 'control') tiles[1].missing('open paths: only collision-mode clips are included');
    else tiles[1].setClip(C[id1] ? id1 : null, res(id1), `media/posters/${r.id}_s.webp`, C[id1]?.track);
    tiles[2].setClip(C[id2] ? id2 : null, res(id2), `media/posters/${r.id}_s.webp`, C[id2]?.track);
    const v = r.res[vgen];
    tiles[1].setVerdict(v.raw ? chip(v.raw[0], cats) : null); tiles[2].setVerdict(v.collision ? chip(v.collision[0], cats) : null);
    tiles[1].setLabel(`${GEN_SHORT[vgen]} · raw`, 'raw'); tiles[2].setLabel(`${GEN_SHORT[vgen]} · NoPeWorld (Coll)`, 'ours');
    // verdict table: every generator x method
    const T = $('#v-table'); T.innerHTML = '';
    const ms = ['raw', 'depth', 'collision', 'prediction'];
    T.append(el('thead', {}, el('tr', {}, el('th', {}, 'Generator'), ...ms.map(m => el('th', {}, { raw: 'Raw', depth: 'External depth', collision: 'NoPeWorld (Coll)', prediction: 'NoPeWorld (Pred)' }[m])))));
    const tb = el('tbody');
    for (const x of GEN) tb.append(el('tr', { class: x === vgen ? 'sel' : '' }, el('td', {}, GEN_NAME[x]),
      ...ms.map(m => { const q = r.res[x][m]; return el('td', {}, q ? chip(q[0], cats, q[3] != null && q[0] === 'slid' ? ` ${q[3]} m` : '') : el('span', { class: 'small' }, '–')); })));
    T.append(tb);
    const base = `${r.track === 'control' ? 'Open path: nothing blocks the input for its whole length.' : `Input ${r.input} into ${r.name || r.obstacle}, approach ${r.angle}; Unreal ${r.cls === 'slide' ? 'slides along the obstacle' : 'stops at the obstacle'}.`} Clips: 320-px previews of the judged videos.`;
    $('#v-desc').textContent = base;
    // the clips start now; the map follows when its file is in
    g.seek(0); g.play(true); setTimeout(setPlay, 50);
    const d = await loadTop(r.id);
    if (my !== token) return;
    top.set(d, keysFor(vgen, ['raw', 'depth', 'collision', 'prediction'])); top.setTime(g.time);
    const dropped = Object.keys(d.dropped).filter(k => k.startsWith(vgen + '|'));
    if (dropped.length) $('#v-desc').textContent = base + ` Not drawn on the map (history misfit > 15 cm): ${dropped.map(k => k.split('|')[1]).join(', ')}.`;
  }
  function openViewer(r) {
    if (cur !== r) { top.d = null; top.ctx.clearRect(0, 0, top.c.width, top.c.height); }      // no old map under the new clips
    cur = r; vgen = st.gen;
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    pauseCards(); fill();
  }
  const close = () => { g.pause(true); if (dlg.open) dlg.close(); };
  $('#v-close').addEventListener('click', close);
  dlg.addEventListener('close', () => { g.pause(true); watch(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
}
