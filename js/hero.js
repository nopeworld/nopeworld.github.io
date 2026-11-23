// Hero: raw (left) vs + NoPeWorld (right) on one clock; drag the wall to wipe. Two scenes (js/hero_scenes.js): Platform 9 3/4
// in Day and Night, the GTA VI streets in the GTA look; the look switch brings its scene, the stage's own switch changes the scene alone.
import { $, $$, el, clamp, onVisible, getClips } from './util.js';
import { SCENES } from './hero_scenes.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { Overlay, loadTrack } from './overlay.js';

// the motion layer slides the wipe in once the hero exists
let resolveHero;
export const heroApi = { ready: new Promise((r) => { resolveHero = r; }) };

export function wipe(stage, group) {
  const handle = $('.handle', stage);
  let cut = 50;
  const set = (p) => { cut = clamp(p, 2, 98); stage.style.setProperty('--cut', cut + '%'); handle.setAttribute('aria-valuenow', Math.round(cut)); };
  const fromEvent = (e) => { const r = stage.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100); };
  let drag = false;
  handle.addEventListener('pointerdown', (e) => { drag = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
  handle.addEventListener('pointermove', (e) => { if (drag) fromEvent(e); });
  handle.addEventListener('pointerup', () => { drag = false; });
  stage.addEventListener('click', (e) => { if (e.target === stage || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') fromEvent(e); });
  handle.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { set(cut - 5); e.preventDefault(); } if (e.key === 'ArrowRight') { set(cut + 5); e.preventDefault(); } });
  set(50);
  return set;
}

export function initHero() {
  const d = document.documentElement;
  const stage = $('#hero-stage');
  const g = new SyncGroup({ fps: 16 });
  const [vl, vr] = $$('video', stage);
  const ovc = $('canvas.ov', stage);
  // the overlay is drawn for both halves: left half from the raw track, right half from the NoPeWorld track
  const ovL = new Overlay(ovc, vl), ovR = new Overlay(document.createElement('canvas'), vr);
  let trL = null, trR = null, show = false;
  const draw = () => {
    const ctx = ovc.getContext('2d');
    const [w, h] = ovL.fit(); ctx.clearRect(0, 0, w, h);
    if (!show) return;
    const cut = parseFloat(getComputedStyle(stage).getPropertyValue('--cut')) / 100 || 0.5;
    for (const [ov, tr, v, x0, x1] of [[ovL, trL, vl, 0, cut], [ovR, trR, vr, cut, 1]]) {
      if (!tr) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 * w, 0, (x1 - x0) * w, h); ctx.clip();
      ov.track = tr; ov.on = true; ov.last = -1; ov.ctx = ctx; ov.c = ovc;
      const f = g.frameOf(v.currentTime);
      const fr = (tr.e != null && f >= tr.e) ? [] : (tr.f[Math.min(f, tr.f.length - 1)] || []);
      if (fr.length) {          // same drawing as Overlay.draw, without clearing the other half
        const vw = v.videoWidth || 16, vh = v.videoHeight || 9, s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
        ctx.beginPath();
        for (const p of fr) { for (let i = 0; i < p.length; i += 2) { const x = ox + p[i] / 1000 * dw, y = oy + p[i + 1] / 1000 * dh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); }
        ctx.fillStyle = 'rgba(242,194,0,.30)'; ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(20,22,28,.45)'; ctx.lineWidth = 4; ctx.stroke(); ctx.strokeStyle = '#f2c200'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }
  };
  g.add(vl, draw); g.add(vr, draw);
  // scenes and their items; an item without clips (still being generated) shows only with ?draft, as its real first frame
  const draft = /(^\?|&)draft(=|&|$)/.test(location.search);
  const scenes = SCENES.map(sc => ({ ...sc, items: sc.items.filter(it => it.raw || draft) })).filter(sc => sc.items.length);
  const seeds = $('#hero-seeds'), sceneSeg = $('#hero-scene'), cap = $('.stage-controls .cap'), pop = $('.stage-controls .info-pop'), hud = $('.hud', stage);
  const ovBox = $('#hero-ov'), playBtn = $('#hero-play');
  let scene = null, item = null, token = 0;
  const tagL = $('.tag.l', stage), tagR = $('.tag.r', stage), TAGS = [tagL.lastChild.textContent, tagR.lastChild.textContent];
  const setItem = async (it) => {
    const my = ++token, resume = g.playing || (item && !item.raw);
    item = it;
    $$('button', seeds).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.item === it.id)));
    hud.replaceChildren(...[...it.keys].map(k => el('span', { class: 'key on', text: k })), ...(it.hold ? [el('span', { text: it.hold })] : []));
    stage.classList.toggle('pending', !it.raw); playBtn.disabled = !it.raw;
    const c = it.cap ?? scene.cap; cap.innerHTML = c || ''; cap.hidden = !c;      // no caption line at all where there is none
    stage.setAttribute('aria-label', it.model ? `${scene.aria}: ${it.model}` : scene.aria);
    if (!it.raw) {            // the real first frame on both sides, nothing to play
      g.pause(); trL = trR = null; ovBox.disabled = true; ovBox.checked = false; show = false; ovBox.parentElement.hidden = true;
      const p = `${scene.media}posters/${it.poster}.webp`;
      g.setSources([[vl, null, p], [vr, null, p]]); vl.poster = p; vr.poster = p;
      draw(); return;
    }
    const M = scene.media;
    g.setSources([[vl, `${M}hero/${it.raw}.mp4`, `${M}posters/${it.raw}.webp`], [vr, `${M}hero/${it.ours}.mp4`, `${M}posters/${it.ours}.webp`]]);
    const C = await getClips();
    const tl = C[it.raw]?.track ? await loadTrack(it.raw) : null, tr = C[it.ours]?.track ? await loadTrack(it.ours) : null;
    if (my !== token) return;
    trL = tl; trR = tr;
    ovBox.disabled = !(trL && trR);
    if (ovBox.disabled) { ovBox.checked = false; show = false; }
    ovBox.parentElement.hidden = !(trL && trR);           // the obstacle toggle only where there is a track (no dead control, no small text)
    if (resume) g.play();
    draw();
  };
  const setScene = (sc) => {
    if (!sc || sc === scene) return;
    scene = sc; d.dataset.scene = sc.id;
    $$('button', sceneSeg).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.scene === sc.id)));
    seeds.setAttribute('aria-label', sc.id === 'p934' ? 'Seed' : 'Place');
    seeds.replaceChildren(...sc.items.map(it => {
      const b = el('button', { 'aria-pressed': 'false', 'data-item': it.id, 'data-seed': it.seed, text: it.label });
      b.addEventListener('click', () => setItem(it)); return b;
    }));
    pop.innerHTML = sc.info; stage.setAttribute('aria-label', sc.aria);
    tagL.lastChild.textContent = (sc.tags || TAGS)[0]; tagR.lastChild.textContent = (sc.tags || TAGS)[1];
    setItem(sc.items[0]);
  };
  sceneSeg.replaceChildren(...scenes.map(sc => {
    const b = el('button', { 'aria-pressed': 'false', 'data-scene': sc.id, text: sc.label });
    b.addEventListener('click', () => setScene(sc)); return b;
  }));
  sceneSeg.hidden = scenes.length < 2;
  const forTheme = (t) => scenes.find(sc => sc.looks.includes(t)) || scenes[0];
  addEventListener('nope:theme', (e) => setScene(forTheme(e.detail)));
  $('#hero-ov').addEventListener('change', (e) => { show = e.target.checked; draw(); });
  const setCut = wipe(stage, g);
  new MutationObserver(draw).observe(stage, { attributes: true, attributeFilter: ['style'] });
  wirePlayer(g, { button: $('#hero-play') });
  setScene(forTheme(d.dataset.theme));
  onVisible(stage, (v) => g.setVisible(v));
  g.play();
  heroApi.group = g; heroApi.setCut = setCut; resolveHero(heroApi);
  return { group: g, setCut };
}
