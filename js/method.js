// Method: the paper's own figure (static), three points and the two modes with their cost. No pinning, no step animation;
// the blocks only fade in (motion.js rises()). This module fills the cost row from data/results.json (the paper's Table 5),
// so the numbers have one source; the HTML carries the same numbers for readers without JavaScript.
import { $, $$, json, onVisible, reduceMotion } from './util.js';

export async function initMethod() {
  const R = await json('data/results.json');
  const C = R && R.cost; if (!C || !C.rows) return;
  const max = Math.max(...C.rows.map(r => r.added_s));
  for (const r of C.rows) {
    const box = $(`#method-modes .mm[data-m="${r.method}"]`); if (!box) continue;
    const pct = Math.round(r.added_s / C.raw_route_s * 100);
    $('.mm-bar i', box).style.width = Math.max(2, r.added_s / max * 100).toFixed(1) + '%';
    $('.mm-v', box).innerHTML = `+${r.added_s}&thinsp;s <em>+${pct}%</em>`;
    box.title = `${r.per_decision} s per decision; +${r.added_s} s per route, ${pct}% of the raw model's ${C.raw_route_s} s`;
  }
}

// ---------- a guided tour over the paper's Fig. 2: a spotlight on one part of the figure at a time, one sentence each.
// Regions are fractions of the figure image (1080 x 314): the training panel, then the three inference rows.
const STEPS = [
  { r: [0.004, 0.01, 0.326, 0.98], cap: "Training: every candidate motion is swept through Unreal's true map and labelled; the head learns to predict the labels from the frozen DiT's states." },
  { r: [0.336, 0.155, 0.662, 0.285], cap: 'Raw model: the frozen generator follows W + ← straight through the wall.' },
  { r: [0.336, 0.44, 0.662, 0.265], cap: "Prediction mode: the head reads chunk k−1's states and changes the command before chunk k is drawn (+1% time)." },
  { r: [0.336, 0.69, 0.662, 0.305], cap: 'Collision mode: the head reads step 0 of chunk k; when it changes the command, only step 0 is rerun (+18% time).' },
];
export function initMethodTour() {
  const fig = $('#method-fig'), spot = $('#method .mfig-spot'), cap = $('#mwalk .mw-cap'), btns = $$('#mwalk .mw-steps button');
  if (!fig || !spot || !btns.length) return;
  let i = 0, timer = 0, manual = false, visible = false;
  // the figure itself is clickable: one large hotspot per part, same regions as the tour
  const box = $('#method .mfig-a');
  const hots = STEPS.map((st, j) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mfig-hot';
    b.setAttribute('aria-label', btns[j].textContent.replace(/^\d/, '').trim()); b.addEventListener('click', () => { manual = true; clearTimeout(timer); go(j); }); box.append(b); return b; });
  const place = () => {
    const [x, y, w, hh] = STEPS[i].r;
    spot.style.left = (fig.offsetLeft + x * fig.offsetWidth) + 'px'; spot.style.top = (fig.offsetTop + y * fig.offsetHeight) + 'px';
    spot.style.width = (w * fig.offsetWidth) + 'px'; spot.style.height = (hh * fig.offsetHeight) + 'px';
    STEPS.forEach((st, j) => { const [a, b2, c, d] = st.r, e = hots[j]; e.style.left = (fig.offsetLeft + a * fig.offsetWidth) + 'px'; e.style.top = (fig.offsetTop + b2 * fig.offsetHeight) + 'px';
      e.style.width = (c * fig.offsetWidth) + 'px'; e.style.height = (d * fig.offsetHeight) + 'px'; e.classList.toggle('cur', j === i); });
  };
  const go = (k) => {
    i = k; place(); spot.classList.add('on');
    btns.forEach((b, j) => b.setAttribute('aria-pressed', j === i));
    cap.classList.remove('in'); void cap.offsetWidth; cap.textContent = STEPS[i].cap; cap.classList.add('in');
  };
  const tick = () => { clearTimeout(timer); if (manual || !visible || reduceMotion) return; timer = setTimeout(() => { go((i + 1) % STEPS.length); tick(); }, 4200); };
  btns.forEach((b, j) => b.addEventListener('click', (e) => { e.preventDefault(); manual = true; clearTimeout(timer); go(j); }));
  $('#method .mfig-a').addEventListener('pointerenter', () => clearTimeout(timer));
  $('#method .mfig-a').addEventListener('pointerleave', () => tick());
  addEventListener('resize', place);
  if (fig.complete) place(); else fig.addEventListener('load', place, { once: true });
  onVisible($('#method .mfig'), (v) => { visible = v; if (v) { go(i); tick(); } else clearTimeout(timer); }, 0.45);
}
