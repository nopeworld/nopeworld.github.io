// Hero: Platform 9 3/4 wipe, raw (left) vs + NoPeWorld (right), one clock; drag the wall to wipe.
import { $, $$, clamp, onVisible, getClips } from './util.js';
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
  const setSeed = async (s) => {
    const was = g.playing;
    g.setSources([[vl, `media/hero/p934__lingbot__raw__s${s}.mp4`, `media/posters/p934__lingbot__raw__s${s}.webp`],
                  [vr, `media/hero/p934__lingbot__collision__s${s}.mp4`, `media/posters/p934__lingbot__collision__s${s}.webp`]]);
    const C = await getClips(), a = `p934__lingbot__raw__s${s}`, b = `p934__lingbot__collision__s${s}`;
    trL = C[a]?.track ? await loadTrack(a) : null; trR = C[b]?.track ? await loadTrack(b) : null;
    $('#hero-ov').disabled = !(trL && trR);
    $('#hero-ov').parentElement.title = trL && trR ? '' : 'Tracking for this seed is still being computed';
    if (was) g.play();
    draw();
  };
  $$('#hero-seeds button').forEach(b => b.addEventListener('click', () => {
    $$('#hero-seeds button').forEach(x => x.setAttribute('aria-pressed', x === b)); setSeed(b.dataset.seed);
  }));
  $('#hero-ov').addEventListener('change', (e) => { show = e.target.checked; draw(); });
  const setCut = wipe(stage, g);
  new MutationObserver(draw).observe(stage, { attributes: true, attributeFilter: ['style'] });
  wirePlayer(g, { button: $('#hero-play') });
  setSeed(1);
  onVisible(stage, (v) => g.setVisible(v));
  g.play();
  heroApi.group = g; heroApi.setCut = setCut; resolveHero(heroApi);
  return { group: g, setCut };
}
