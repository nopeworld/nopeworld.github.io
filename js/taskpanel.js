// NoPeBench's three tasks, one panel each (user 11-22): what goes in and what comes out, what is tested, how it is scored
// (the paper's definitions, Secs. 4.1-4.2 and S1.3-S1.4) and one real case. One <dialog> (#taskpanel): static in index.html,
// so main.js gives it data-lenis-prevent at boot, with the text written there; this module builds each task's case on first
// open. A card opens its task; a metric chip opens it at that metric's definition, briefly highlighted. Clips load only while
// their task is open (SyncGroup.setVisible) and pause when it closes or another task is shown; low data keeps the posters
// until play.
//   Task 1: the teaser route on Unreal's true map; the 34 candidates of two decisions colored by the label rule (a disc of
//   r = 0.25 m swept along each must keep m = 5 cm, as in playground.js); the head's real choices (data/decisions, the
//   closed-loop collision run: its first chunk sees only true frames, its second follows one generated chunk).
//   Task 2: LingBot-World 2.0's best slide (bench.json best_slide.lingbot): Unreal, raw and NoPeWorld clips on one clock,
//   the evaluator's verdicts and the reconstructed paths on the true map. Task 3: one static and one moving case of the
//   paper's Task 3 figure (bench.json task3): the first frame with the paper's outline, both clips, the judge counts.
import { $, $$, el, svg, json, clamp, chip, GEN_NAME, getBench, getClips } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { TopView, loadTop, keysFor } from './topview.js';
import { ground, solids, obstacle, haloLine, camera, arrowHead, scaleBar, INK } from './mapdraw.js';
import { describe } from './knows.js';

const R = 0.25, MARGIN = 0.05, FPS = 16, CHUNK = 12 / 16;   // m, m: the label's disc and margin; LingBot's chunk: 12 frames at 16 fps
const T3 = [['wbench_case69', 'lingbot'], ['wbench_dyn047', 'echo']];   // static, moving: two of the paper's Task 3 figure (8 s clips)
const WORD = { through: 'passes through', stops: 'stops', avoids: 'avoids it', 'stops early': 'stops early' };   // as open.js
const PERSON = { fp: 'first person', tp: 'third person' };

const at = (path, t) => {            // position on a timed path at time t (clamped)
  const T = path.t, P = path.p;
  if (t <= T[0]) return P[0];
  for (let i = 1; i < T.length; i++) if (T[i] >= t) { const a = (t - T[i - 1]) / Math.max(1e-6, T[i] - T[i - 1]); return [P[i - 1][0] + a * (P[i][0] - P[i - 1][0]), P[i - 1][1] + a * (P[i][1] - P[i - 1][1])]; }
  return P[P.length - 1];
};
// candidate i's displacement over one chunk: rho_i * Rot(delta_i) * u, + delta turns right (clockwise seen from above), as playground.js
const disp = (u, deg, rho) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [rho * (c * u[0] + s * u[1]), rho * (-s * u[0] + c * u[1])]; };

// the swept clearance g of the disc moved by dv from p, on the map's rings (sampled every 1/24 of the step); safe iff g >= m
function clearanceOn(rings) {
  const S = [];
  for (const p of rings) for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; S.push([p[i], p[i + 1], p[j], p[j + 1]]); }
  const inside = (x, y) => {
    let c = false;
    for (const p of rings) for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const near = (x, y) => {
    let b = 1e9;
    for (const [ax, ay, bx, by] of S) { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-9, t = clamp(((x - ax) * dx + (y - ay) * dy) / L, 0, 1); b = Math.min(b, Math.hypot(x - ax - t * dx, y - ay - t * dy)); }
    return b;
  };
  return (p, dv) => { let g = 1e9; for (let k = 0; k <= 24; k++) { const x = p[0] + dv[0] * k / 24, y = p[1] + dv[1] * k / 24, q = near(x, y); g = Math.min(g, (inside(x, y) ? -q : q) - R); } return g; };
}

// a canvas that shows another video's current frame (the strip's "output"), the poster until that video has a frame
function mirror(cv, video) {
  const ctx = cv.getContext('2d'), img = new Image(); let last = -1;
  const draw = (force) => {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; force = true; }
    const live = video.readyState >= 2, src = live ? video : (img.complete && img.naturalWidth ? img : null);
    if (!src) return;
    if (live && !force && video.currentTime === last) return;
    last = live ? video.currentTime : -1;
    const sw = live ? video.videoWidth : img.naturalWidth, sh = live ? video.videoHeight : img.naturalHeight, k = Math.max(W / sw, H / sh);
    ctx.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
  };
  video.addEventListener('loadeddata', () => draw(true));
  video.addEventListener('seeked', () => draw(true));
  return { draw, poster(url) { last = -1; img.onload = () => draw(true); img.src = url; } };
}

export async function initTaskPanel() {
  const dlg = $('#taskpanel'); if (!dlg) return;
  const B = await getBench(), C = await getClips(), cats = B.categories;
  const tabs = $$('.tp-tabs [role="tab"]', dlg), title = $('#tp-title'), tag = $('#tp-tag');
  const groups = {}, built = {}, redraw = {};
  let cur = 1, opener = null, lenis = null;
  import('./main.js').then(m => { lenis = m.getLenis ? m.getLenis() : null; }).catch(() => {});

  // ---------- Task 1: two decisions on the teaser route's true map
  async function build1() {
    const route = B.teaser;
    const [T, D] = await Promise.all([loadTop(route), json(`data/decisions/${route}__lingbot__collision.json`)]);
    const clear = clearanceOn(T.map);
    const states = D.chunks.slice(0, 2).map((ch, j) => {
      const t0 = (ch.f0 - 1) / FPS;            // the chunk follows frame f0 - 1 (the hand-off is frame 0)
      const p = at(T.unreal, t0), a = at(T.intent, t0), b = at(T.intent, t0 + CHUNK), u = [b[0] - a[0], b[1] - a[1]];
      const cands = D.names.map((n, i) => { const dv = disp(u, D.delta[i], D.rho[i]); return { n, dv, safe: clear(p, dv) >= MARGIN }; });
      return { j, t0, p, u, cands, safe: cands[0].safe, choice: ch.choice, cv: el('canvas', { 'aria-hidden': 'true' }) };
    });
    // one scale for both maps: each shows its camera, every candidate's end point and the route's first contact
    const pad = 0.5;
    const boxes = states.map(s => { let a = [1e9, -1e9, 1e9, -1e9];
      for (const q of [s.p, T.contact || s.p, ...s.cands.map(c => [s.p[0] + c.dv[0], s.p[1] + c.dv[1]])]) a = [Math.min(a[0], q[0]), Math.max(a[1], q[0]), Math.min(a[2], q[1]), Math.max(a[3], q[1])];
      return a; });
    const vw = Math.max(...boxes.map(a => a[1] - a[0])) + 2 * pad, vh = Math.max(...boxes.map(a => a[3] - a[2])) + 2 * pad;
    const draw = (s) => {
      const c = s.cv, ctx = c.getContext('2d'), r = c.getBoundingClientRect(); if (!r.width) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const bx = boxes[s.j], cu = (bx[0] + bx[1]) / 2, cv = (bx[2] + bx[3]) / 2, sc = Math.min(W / vw, H / vh);
      const X = (x) => W / 2 + (x - cu) * sc, Y = (y) => H / 2 - (y - cv) * sc;
      ground(ctx, W, H, X, Y, sc, dpr, cu, cv); solids(ctx, T.map, X, Y, dpr); obstacle(ctx, T.obstacle, X, Y, dpr);
      haloLine(ctx, T.unreal.p, X, Y, 'rgba(29,33,41,.16)', 8, dpr, { halo: false });          // Unreal's true path
      const [px, py] = s.p, x0 = X(px), y0 = Y(py), end = (dv) => [X(px + dv[0]), Y(py + dv[1])];
      // the input's swept disc (r = 0.25 m), tinted by its label
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 2 * R * sc;
      ctx.strokeStyle = s.safe ? 'rgba(30,158,90,.16)' : 'rgba(211,58,44,.2)';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(...end(s.u)); ctx.stroke(); ctx.restore();
      // the candidates (the stop is the camera itself), unsafe under safe
      ctx.save(); ctx.lineCap = 'round';
      for (const want of [false, true]) for (const cd of s.cands) {
        if (cd.n === 'KEEP' || cd.n === 'STOP' || cd.safe !== want) continue;
        const [x1, y1] = end(cd.dv), col = cd.safe ? '30,158,90' : '211,58,44';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = `rgba(${col},.34)`; ctx.lineWidth = 1.3 * dpr; ctx.stroke();
        ctx.beginPath(); ctx.arc(x1, y1, 2.5 * dpr, 0, 7); ctx.fillStyle = `rgba(${col},.9)`; ctx.fill();
      }
      ctx.restore();
      // the input: dashed, with its head
      const [ix, iy] = end(s.u);
      haloLine(ctx, [s.p, [px + s.u[0], py + s.u[1]]], X, Y, INK, 1.6, dpr, { dash: [4, 4] });
      arrowHead(ctx, x0, y0, ix, iy, INK, 8 * dpr);
      // the head's choice: a heavy ink arrow (on the input when it keeps it)
      const i = D.names.indexOf(s.choice), dv = s.choice === 'STOP' ? null : s.cands[i].dv;
      if (dv) {
        const [cx1, cy1] = end(dv), ext = [cx1 + (cx1 - x0) * 0.06, cy1 + (cy1 - y0) * 0.06];
        ctx.save(); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx1, cy1); ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 7 * dpr; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(cx1, cy1); ctx.strokeStyle = INK; ctx.lineWidth = 3.2 * dpr; ctx.stroke();
        ctx.restore();
        arrowHead(ctx, x0, y0, ext[0], ext[1], INK, 11 * dpr);
      }
      camera(ctx, x0, y0, Math.atan2(-s.u[1], s.u[0]), INK, 5 * dpr, dpr, { fill: '#ffffff' });
      scaleBar(ctx, W, H, sc, dpr, 10 * dpr);
    };
    const box = $('#tp1-decs');
    for (const s of states) {
      const kept = s.choice === 'KEEP', right = kept === s.safe;
      box.append(el('figure', { class: 'tp-dec' }, el('div', { class: 'tp-map' }, s.cv),
        el('figcaption', {},
          el('b', {}, s.j ? `Chunk 2 · ${s.t0.toFixed(2)} s later, on Unreal's path` : 'Chunk 1 · at the hand-off'),
          el('span', { class: 'tp-row' }, el('span', { class: `chip ${s.safe ? 'ok' : 'viol'}` }, `label: ${s.safe ? 'keep' : 'change'}`),
            s.safe ? 'its disc keeps the 5 cm margin' : 'its disc enters the wall'),
          el('span', { class: 'tp-row' }, 'head: ', el('b', {}, kept ? 'kept' : s.choice === 'STOP' ? 'stop' : describe(s.choice)), right ? ' ✓' : ' ✗',
            el('span', { class: 'tp-dim' }, s.safe ? '· a change here counts as False' : '· a keep here counts as Missed')))));
    }
    redraw[1] = () => states.forEach(draw);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { if (cur === 1 && dlg.open) redraw[1](); }); states.forEach(s => ro.observe(s.cv)); }
  }

  // ---------- Task 2: one route, three synced clips, verdicts, top view
  async function build2() {
    const [id] = B.best_slide.lingbot, r = B.routes.find(x => x.id === id), gen = 'lingbot', v = r.res[gen];
    const g = new SyncGroup({ fps: 16 }); groups[2] = g;
    const tiles = [makeTile(g, { label: 'Unreal (reference)', dot: 'unreal' }), makeTile(g, { label: 'Raw', dot: 'raw' }), makeTile(g, { label: '+ NoPeWorld (Coll)', dot: 'ours' })];
    const box = $('#tp2-tiles'); tiles.forEach(t => box.append(t.root));
    box.addEventListener('click', (e) => { if (!e.target.closest('.play')) g.toggle(); });
    const ids = [`${id}__unreal`, `${id}__${gen}__raw`, `${id}__${gen}__collision`];
    ids.forEach((cid, k) => tiles[k].setClip(C[cid] ? cid : null, C[cid]?.lo ? 'lo' : 'hi', `media/posters/${id}_s.webp`, C[cid]?.track));
    tiles[0].setVerdict(el('span', { class: 'chip slide', title: "Unreal Engine's own execution of the input, the reference" }, r.cls === 'slide' ? 'Slides along' : 'Stops'));
    tiles[1].setVerdict(v.raw ? chip(v.raw[0], cats) : null);
    tiles[2].setVerdict(v.collision ? chip(v.collision[0], cats, v.collision[0] === 'slid' && v.collision[3] != null ? ` ${v.collision[3]} m` : '') : null);
    wirePlayer(g, { button: $('#tp2-play'), time: $('#tp2-time') });
    const m = mirror($('#tp2-mirror'), tiles[2].video); m.poster(`media/posters/${id}_s.webp`); g.on(() => m.draw());
    const top = new TopView($('#tp2-top')); g.on((t) => top.setTime(t));
    loadTop(id).then(d => { top.set(d, keysFor(gen, ['raw', 'collision'])); top.setTime(g.time); });
    redraw[2] = () => { m.draw(true); top.draw(); };
  }

  // ---------- Task 3: a static and a moving case, first frame with its outline, raw and NoPeWorld, judge counts
  async function build3() {
    const g = new SyncGroup({ fps: 16 }); groups[3] = g;
    const a = makeTile(g, { label: 'Raw', dot: 'raw' }), b = makeTile(g, { label: '+ NoPeWorld (Coll)', dot: 'ours' });
    const firstSvg = svg('svg', { class: 'tp-firstsvg', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
    const first = el('div', { class: 'tile tp-first' }, firstSvg, el('div', { class: 'lbl' }, 'First frame'));
    const box = $('#tp3-tiles'); box.append(first, a.root, b.root);
    [a.root, b.root].forEach(t => t.addEventListener('click', (e) => { if (!e.target.closest('.play')) g.toggle(); }));
    wirePlayer(g, { button: $('#tp3-play'), time: $('#tp3-time') });
    const m = mirror($('#tp3-mirror'), b.video); g.on(() => m.draw());
    const caseEl = $('#tp3-case'), input = $('#tp3-in');
    const pick = (k) => {
      const [cs, gen] = T3[k], t = B.task3.find(x => x.case === cs && x.generator === gen); if (!t) return;
      const idA = `t3_${cs}__${gen}__raw`, idB = `t3_${cs}__${gen}__collision`, pA = `media/posters/${idA}.webp`;
      a.setClip(idA, 'hi', pA, C[idA]?.track); b.setClip(idB, 'hi', `media/posters/${idB}.webp`, C[idB]?.track); g.seek(0);
      const said = ([w, n], cls) => el('span', { class: `chip ${cls}`, title: `${n} of the four VLM judges` }, `${WORD[w] || w} · ${n}/4`);
      a.setVerdict(said(t.raw_word, 'viol')); b.setVerdict(said(t.ours_word, 'ok'));
      const [w, h] = t.first_size, d = (t.outline || []).map(ring => 'M' + ring.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join('L') + 'Z').join('');
      firstSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      firstSvg.replaceChildren(svg('image', { href: pA, width: w, height: h, preserveAspectRatio: 'none' }),
        svg('path', { d, fill: 'rgba(242,194,0,.3)', 'fill-rule': 'evenodd', stroke: 'rgba(20,22,28,.45)', 'stroke-width': 4, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }),
        svg('path', { d, fill: 'none', stroke: '#f2c200', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
      caseEl.textContent = `${GEN_NAME[gen]} · ${PERSON[t.person]} · ${t.block === 'static' ? 'static obstacle' : 'moving obstacle'}`;
      input.src = pA; input.alt = `The input image: ${t.block === 'static' ? 'a static' : 'a moving'} obstacle, ${PERSON[t.person]}`;   // the strip follows the case
      m.poster(`media/posters/${idB}.webp`);
      $$('#tp3-pick button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.k === k)));
    };
    $$('#tp3-pick button').forEach(x => x.addEventListener('click', () => pick(+x.dataset.k)));
    pick(0);
    redraw[3] = () => m.draw(true);
  }

  const BUILD = { 1: build1, 2: build2, 3: build3 };
  const ensure = (n) => (built[n] ||= BUILD[n]().catch(err => console.error('task panel', n, err)));

  // ---------- open, switch, close
  function select(n) {
    cur = n;
    tabs.forEach(t => { const on = +t.dataset.task === n; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    $$('.tp-task', dlg).forEach(p => { p.hidden = +p.dataset.task !== n; });
    const panel = $(`#tp-${n}`);
    title.textContent = panel.dataset.title; tag.textContent = `Task ${n}`;
    $$('img[data-src]', panel).forEach(i => { if (!i.getAttribute('src')) i.src = i.dataset.src; });
    for (const k in groups) groups[k].setVisible(+k === n && dlg.open);
    return ensure(n).then(() => {
      if (cur !== n || !dlg.open) return;
      if (groups[n]) groups[n].setVisible(true);
      requestAnimationFrame(() => redraw[n] && redraw[n]());
    });
  }
  let flashT = 0;
  function jump(metric, again) {         // again: only re-place it (the case above it got its height), no second flash
    const m = metric && $(`#tp-m-${metric}`, dlg);
    if (!m) { dlg.scrollTop = 0; title.focus({ preventScroll: true }); return; }
    const head = $('.tp-head', dlg).getBoundingClientRect().height;
    dlg.scrollTop += m.getBoundingClientRect().top - dlg.getBoundingClientRect().top - head - 14;
    if (again) return;
    $$('.tp-m.flash', dlg).forEach(x => x.classList.remove('flash'));
    void m.offsetWidth; m.classList.add('flash');
    clearTimeout(flashT); flashT = setTimeout(() => m.classList.remove('flash'), 2400);
    m.focus({ preventScroll: true });
  }
  async function open(n, metric, from) {
    opener = from || document.activeElement;
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    try { lenis && lenis.stop(); } catch (e) { /* smooth scroll off */ }
    const ready = select(n);
    dlg.scrollTop = 0;
    jump(metric);
    await ready;
    if (metric && cur === n) requestAnimationFrame(() => { if (dlg.open && cur === n) jump(metric, true); });
  }
  // the clips stop at once: on the close button and backdrop before closing, on Esc in 'cancel' (which comes first), and
  // again on 'close' (queued as a task, so it can come late on a busy page)
  const stopAll = () => { for (const k in groups) groups[k].setVisible(false); };
  const close = () => { stopAll(); if (dlg.open) dlg.close(); else dlg.removeAttribute('open'); };
  dlg.addEventListener('cancel', stopAll);
  dlg.addEventListener('close', () => {
    stopAll();
    try { lenis && lenis.start(); } catch (e) { /* ignore */ }
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  $('#tp-close').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });          // the backdrop
  tabs.forEach(t => t.addEventListener('click', () => { dlg.scrollTop = 0; select(+t.dataset.task); }));
  $('.tp-tabs', dlg).addEventListener('keydown', (e) => {          // arrow keys move between the tabs
    const d = { ArrowRight: 1, ArrowLeft: -1, Home: -9, End: 9 }[e.key]; if (!d) return;
    e.preventDefault(); const n = clamp(Math.abs(d) === 9 ? (d < 0 ? 1 : 3) : ((cur - 1 + d + 3) % 3) + 1, 1, 3);
    dlg.scrollTop = 0; select(n); tabs[n - 1].focus();
  });
  // keep the focus inside (showModal makes the page inert; this also keeps Tab off the browser's own controls)
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && typeof dlg.showModal !== 'function') { close(); return; }
    if (e.key !== 'Tab') return;
    const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dlg)
      .filter(x => !x.disabled && x.getClientRects().length && !x.closest('[hidden]') && getComputedStyle(x).visibility !== 'hidden');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !f.includes(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !f.includes(a))) { e.preventDefault(); first.focus(); }
  });
  addEventListener('nope:theme', () => { if (dlg.open && redraw[cur]) redraw[cur](); });

  // ---------- the cards and their chips
  $$('#bench .task-open').forEach(b => b.addEventListener('click', () => open(+b.dataset.task, null, b)));
  $$('#bench .tchip').forEach(b => b.addEventListener('click', () => open(+b.dataset.task, b.dataset.metric, b)));
}
