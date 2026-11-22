// The problem: the teaser route on Unreal + six generators, raw and + NoPeWorld in the same tile with a draggable wipe
// (user 11-22: "让对比的直接同时出现… 同一个视频中间有一条可以拉动的分割线"), one clock, top view in sync.
// One wipe position is shared by all six tiles: drag any of them and they all follow.
import { $, $$, GEN, GEN_NAME, GEN_SHORT, getBench, getClips, chip, onVisible, whenNear, lowData, reduceMotion } from './util.js';
// half a tile is narrow: short verdict words (the full category stays in the chip's tooltip)
const SHORT = { violation_through: 'Through', violation_vanished: 'Erased it', violation_past: 'Walked past', reversed: 'Reversed', retreated: 'Backed away',
  no_response: 'No motion', wrong_direction: 'Wrong way', turned_away: 'Turned away', still_moving: 'Not there yet', early_stop: 'Stopped early',
  stopped: 'Stopped', stopped_not_slid: 'Stopped', slid: 'Slid' };
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { TopView, loadTop } from './topview.js';

export async function initProblem() {
  const B = await getBench(), C = await getClips();
  // the paper's Fig. 1: its own clips (ids F.prefix__<generator>__<mode>), verdicts and top view
  const F = B.figures.fig1, route = F.case;
  const g = new SyncGroup({ fps: 16 });
  const grid = $('#prob-grid');
  const raw = {}, ours = {};
  const unreal = makeTile(g, { label: 'Unreal Engine · ground truth', dot: 'unreal' });
  $('#prob-unreal').append(unreal.root);
  for (const m of GEN) {
    raw[m] = makeTile(g, { label: GEN_SHORT[m], dot: 'raw' });
    ours[m] = makeTile(g, { label: '+ NoPeWorld', dot: 'ours', cls: 'wipe-top' });
    const cut = document.createElement('div'); cut.className = 'wipe-cut'; cut.setAttribute('aria-hidden', 'true'); cut.innerHTML = '<span></span>';
    const duo = document.createElement('div'); duo.className = 'duo-w'; duo.append(raw[m].root, ours[m].root, cut);
    grid.append(duo);
  }
  // ---------- the shared wipe: --cut is the share of the tile that shows the raw model (left)
  let cut = 1;
  const setCut = (v) => { cut = Math.max(0, Math.min(1, v)); grid.style.setProperty('--cut', (cut * 100).toFixed(2) + '%'); };
  setCut(1);
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const glide = (to, ms = 900) => { if (reduceMotion) { setCut(to); return; } const from = cut, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); setCut(from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
  let drag = null;
  grid.addEventListener('pointerdown', (e) => { const d = e.target.closest('.duo-w'); if (!d || e.target.closest('.play')) return;
    // low data: a touch on any tile starts the clips, as its play button does
    if (lowData.on && !g.userStarted) g.play(true);
    drag = d; d.setPointerCapture(e.pointerId); move(e); setPressed(null); });
  const move = (e) => { if (!drag) return; const r = drag.getBoundingClientRect(); setCut((e.clientX - r.left) / r.width); };
  grid.addEventListener('pointermove', move);
  grid.addEventListener('pointerup', () => { drag = null; });
  grid.addEventListener('pointercancel', () => { drag = null; });
  // the mode buttons now jump the wipe: all raw, half and half, all NoPeWorld
  const setPressed = (m) => $$('#prob-mode button').forEach(x => x.setAttribute('aria-pressed', x.dataset.m === m));
  $$('#prob-mode button').forEach(b => b.addEventListener('click', () => { setPressed(b.dataset.m); glide(b.dataset.m === 'raw' ? 1 : b.dataset.m === 'collision' ? 0 : 0.5, 700); }));

  const top = new TopView($('#prob-top canvas'));
  const tv = await loadTop(F.top);
  // the 3D map replaces the flat top view once three.js has loaded (not in low-data mode; the 2D view stays as fallback)
  let map3 = null;
  const keys3 = GEN.flatMap(m => [{ key: `${m}|raw`, color: '#d33a2c', width: 1.6, alpha: 0.85 }, { key: `${m}|collision`, color: '#1e9e5a', width: 2 }]);
  whenNear($('#prob-top'), async () => {
    if (lowData.on || /[?&]no3d\b/.test(location.search)) return;     // ?no3d: the flat view only (debugging, slow GPUs)
    try {
      const { Map3D } = await import('./map3d.js');
      map3 = Map3D.create($('#prob-3d'), tv);
      if (!map3) return;
      $('#prob-3d').hidden = false; $('#prob-3d-tag').hidden = false; $('#prob-top canvas').style.visibility = 'hidden';
      map3.setKeys(keys3); map3.setTime(g.time);
    } catch (e) { console.warn('3D map unavailable', e); }
  }, '700px');
  const ov = $('#prob-ov');
  const all = () => [unreal, ...Object.values(raw), ...Object.values(ours)];
  unreal.setClip(`${route}__unreal`, 'hi', `media/posters/${route}.webp`, C[`${route}__unreal`]?.track);
  unreal.setVerdict(null);
  for (const m of GEN) {
    for (const [t, mode] of [[raw[m], 'raw'], [ours[m], 'collision']]) {
      const id = `${F.prefix}__${m}__${mode}`;
      t.setClip(C[id] ? id : null, 'hi', `media/posters/${route}.webp`, C[id]?.track);
      const r = F.res[m]?.[mode];
      const c = r ? chip(r[0], B.categories) : null; if (c) { c.title = `${B.categories[r[0]]?.label || r[0]} (Task 2 evaluator)`; c.textContent = SHORT[r[0]] || c.textContent; }
      t.setVerdict(c);
    }
    const duo = raw[m].root.parentElement;
    duo.onmouseenter = () => { top.highlight(`${m}|collision`); map3?.highlight(`${m}|collision`); };
    duo.onmouseleave = () => { top.highlight(null); map3?.highlight(null); };
  }
  top.set(tv, keys3);
  all().forEach(t => t.overlay.setOn(ov.checked));
  ov.addEventListener('change', () => { all().forEach(t => { t.overlay.setOn(ov.checked); t.overlay.draw(g.frameOf(t.video.currentTime)); }); });
  g.on((t) => { top.setTime(t); if (map3) map3.setTime(t); });
  wirePlayer(g, { button: $('#prob-play'), scrub: $('#prob-scrub'), time: $('#prob-time') });
  let shown = false;
  onVisible($('#prob-grid'), (v) => { g.setVisible(v); if (v && !shown) { shown = true; setTimeout(() => glide(0.5, 1100), 350); } }, 0.05);
  setPressed('split');
  g.play();
}
