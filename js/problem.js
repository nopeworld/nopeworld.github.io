// The problem: the teaser route on Unreal + six generators, raw or + NoPeWorld, one clock, top view in sync.
import { $, $$, GEN, GEN_NAME, getBench, getClips, chip, onVisible, whenNear, lowData } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { TopView, loadTop } from './topview.js';

export async function initProblem() {
  const B = await getBench(), C = await getClips();
  const route = B.teaser;
  const g = new SyncGroup({ fps: 16 });
  const grid = $('#prob-grid');
  const tiles = {};
  const unreal = makeTile(g, { label: 'Unreal Engine · ground truth', dot: 'unreal' });
  $('#prob-unreal').append(unreal.root);
  for (const m of GEN) { tiles[m] = makeTile(g, { label: GEN_NAME[m], dot: 'raw' }); grid.append(tiles[m].root); }
  const top = new TopView($('#prob-top canvas'));
  const tv = await loadTop(route);
  const R = B.routes.find(r => r.id === route);
  // the 3D map replaces the flat top view once three.js has loaded (not in low-data mode; the 2D view stays as fallback)
  let map3 = null, keys3 = null;
  whenNear($('#prob-top'), async () => {
    if (lowData.on || /[?&]no3d\b/.test(location.search)) return;     // ?no3d: the flat view only (debugging, slow GPUs)
    try {
      const { Map3D } = await import('./map3d.js');
      map3 = Map3D.create($('#prob-3d'), tv);
      if (!map3) return;
      $('#prob-3d').hidden = false; $('#prob-3d-tag').hidden = false; $('#prob-top canvas').style.visibility = 'hidden';
      if (keys3) map3.setKeys(keys3); map3.setTime(g.time);
    } catch (e) { console.warn('3D map unavailable', e); }
  }, '700px');
  let mode = 'raw';
  const ov = $('#prob-ov');
  const apply = async () => {
    unreal.setClip(`${route}__unreal`, 'hi', `media/posters/${route}.webp`, C[`${route}__unreal`]?.track);
    for (const m of GEN) {
      const id = `${route}__${m}__${mode}`;
      tiles[m].setLabel(GEN_NAME[m], mode === 'raw' ? 'raw' : 'ours');
      tiles[m].setClip(C[id] ? id : null, 'hi', `media/posters/${route}.webp`, C[id]?.track);
      const r = R.res[m][mode];
      tiles[m].setVerdict(r ? chip(r[0], B.categories) : null);
      tiles[m].root.onmouseenter = () => { top.highlight(`${m}|${mode}`); map3?.highlight(`${m}|${mode}`); };
      tiles[m].root.onmouseleave = () => { top.highlight(null); map3?.highlight(null); };
    }
    unreal.setVerdict(null);
    keys3 = GEN.map(m => ({ key: `${m}|${mode}`, color: mode === 'raw' ? '#d33a2c' : '#1e9e5a', width: 2 }));
    top.set(tv, keys3); if (map3) map3.setKeys(keys3);
    [unreal, ...Object.values(tiles)].forEach(t => t.overlay.setOn(ov.checked));
  };
  $$('#prob-mode button').forEach(b => b.addEventListener('click', () => {
    $$('#prob-mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); mode = b.dataset.m; const t = g.time; apply().then(() => { g.seek(t); });
  }));
  ov.addEventListener('change', () => { [unreal, ...Object.values(tiles)].forEach(t => { t.overlay.setOn(ov.checked); t.overlay.draw(g.frameOf(t.video.currentTime)); }); });
  g.on((t) => { top.setTime(t); if (map3) map3.setTime(t); });
  wirePlayer(g, { button: $('#prob-play'), scrub: $('#prob-scrub'), time: $('#prob-time') });
  await apply();
  onVisible($('#prob-grid'), (v) => g.setVisible(v), 0.05);
  g.play();
}
