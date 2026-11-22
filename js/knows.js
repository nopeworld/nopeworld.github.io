// "The DiT already knows": LingBot-World 2.0 + NoPeWorld; per chunk the head's real scores for the 34 candidates
// (data/decisions/<route>__lingbot__<mode>.json), shown as a fan (angle to the input, length ratio) while the video plays.
import { $, $$, el, svg, json, getBench, getClips, chip, onVisible } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { Overlay, loadTrack } from './overlay.js';

const ROUTES = [['CourtYard__n017', 'Oblique wall'], ['Desert_ruins__n007', 'Head-on pillar'], ['Hospital__n002', 'A slide']];

export function describe(name) {
  if (name === 'KEEP') return 'keep the input';
  if (name === 'STOP') return 'stop';
  if (name.startsWith('SLOW')) return `slow to ${(+name.slice(4) / 10).toFixed(1).replace('.0', '')}% speed`;
  const side = name[2] === 'R' ? 'right' : 'left', deg = parseFloat(name.slice(3));
  if (name.startsWith('HL')) return `turn ${deg}° ${side}, shorter step`;
  return `slide ${Math.round(deg)}° to the ${side}`;
}

export async function initKnows() {
  const B = await getBench(), C = await getClips();
  const tileEl = $('#knows-tile'), video = $('video', tileEl), ov = new Overlay($('canvas', tileEl), video);
  const g = new SyncGroup({ fps: 16 });
  g.add(video, (f) => ov.draw(f));
  const fan = $('#fan'), strip = $('#pstrip'), read = $('#fan-read'), chunksEl = $('#knows-chunks');
  let D = null, route = ROUTES[0][0], mode = 'collision', cur = -1;
  // fan geometry
  const O = [200, 268], RAD = 230;
  const rays = [], bars = [];
  fan.append(svg('path', { d: `M ${O[0] - RAD} ${O[1]} A ${RAD} ${RAD} 0 0 1 ${O[0] + RAD} ${O[1]}`, fill: 'none', stroke: '#eef1f6', 'stroke-width': 1 }));
  fan.append(svg('path', { d: `M ${O[0] - RAD * .5} ${O[1]} A ${RAD * .5} ${RAD * .5} 0 0 1 ${O[0] + RAD * .5} ${O[1]}`, fill: 'none', stroke: '#eef1f6', 'stroke-width': 1 }));
  const inputRay = svg('line', { x1: O[0], y1: O[1], x2: O[0], y2: O[1] - RAD - 14, stroke: '#22262e', 'stroke-width': 1.3, 'stroke-dasharray': '4 4' });
  fan.append(inputRay, svg('text', { x: O[0] + 6, y: O[1] - RAD - 6, 'font-size': 11, fill: '#7c8394' }, 'input'));
  const gRays = svg('g'); fan.append(gRays);
  const stopDot = svg('circle', { cx: O[0], cy: O[1], r: 7, fill: '#e5604f', stroke: '#fff', 'stroke-width': 2 });
  const pick = svg('line', { x1: O[0], y1: O[1], x2: O[0], y2: O[1], stroke: '#111318', 'stroke-width': 5.5, 'stroke-linecap': 'round' });
  const pickHead = svg('circle', { r: 6, fill: '#111318' });
  const pickLbl = svg('text', { 'font-size': 12.5, 'font-weight': 600, fill: '#111318' });
  fan.append(pick, pickHead, stopDot, svg('circle', { cx: O[0], cy: O[1], r: 4, fill: '#fff', stroke: '#22262e', 'stroke-width': 1.5 }), pickLbl);
  fan.append(svg('text', { x: 8, y: 292, 'font-size': 10.5, fill: '#aab0bd' }, 'each ray: a candidate · angle to the input · length = step · color: P̂ · opacity: Â'));
  const tauLine = el('i'); // in the strip
  const build = (names, delta, rho) => {
    gRays.innerHTML = ''; rays.length = 0; strip.innerHTML = ''; bars.length = 0;
    names.forEach((n, i) => {
      if (n === 'STOP') { rays.push(null); }
      else {
        const a = delta[i] * Math.PI / 180, L = rho[i] * RAD;
        const l = svg('line', { x1: O[0], y1: O[1], x2: O[0] + L * Math.sin(a), y2: O[1] - L * Math.cos(a), stroke: '#ccc', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: .8 });
        l.style.transition = 'stroke .35s, opacity .35s';
        l.append(svg('title', {}, n)); gRays.append(l); rays.push(l);
      }
      const b = el('i', { title: n }); strip.append(b); bars.push(b);
    });
  };
  const show = (k) => {
    if (!D) return;
    const ch = D.chunks[k]; if (!ch) return;
    if (k === cur) return; cur = k;
    const tau = D.selection.tau;
    ch.p.forEach((p, i) => {
      const safe = p >= tau, col = safe ? '#2fa868' : '#e5604f';
      if (rays[i]) { rays[i].setAttribute('stroke', col); rays[i].setAttribute('opacity', (0.25 + 0.75 * ch.a[i]).toFixed(2)); }
      else { stopDot.setAttribute('fill', col); }
      bars[i].style.height = Math.max(3, p * 46) + 'px'; bars[i].className = D.names[i] === ch.choice ? 'pick' : (safe ? 'safe' : 'unsafe');
    });
    const i = D.names.indexOf(ch.choice), a = D.delta[i] * Math.PI / 180, L = D.rho[i] * RAD;
    const x2 = O[0] + L * Math.sin(a), y2 = O[1] - L * Math.cos(a);
    pick.setAttribute('x2', x2); pick.setAttribute('y2', y2); pickHead.setAttribute('cx', x2); pickHead.setAttribute('cy', y2);
    pickHead.setAttribute('r', ch.choice === 'STOP' ? 9 : 6);
    pickLbl.textContent = ch.choice === 'KEEP' ? 'kept' : ch.choice; pickLbl.setAttribute('x', Math.min(330, x2 + 10)); pickLbl.setAttribute('y', Math.max(16, y2 - 8));
    const pk = ch.p[0];
    read.innerHTML = `<b>Chunk ${ch.k}</b> (frames ${ch.f0}–${Math.min(ch.f1, 80)}), decided before they were drawn. ` +
      (ch.choice === 'KEEP' ? `P̂(keep) = ${pk.toFixed(2)} ≥ τ = ${tau}: the input is safe and runs as is.`
        : `P̂(keep) = ${pk.toFixed(2)}${pk < tau ? ` &lt; τ = ${tau}: unsafe.` : `: safe, but a safe candidate keeps more of the intent.`} ` +
          (ch.choice === 'STOP' && Math.max(...ch.p) < tau ? `No candidate reaches τ, so the camera <b>stops</b>.` : `Chosen: <b>${describe(ch.choice)}</b> (P̂ ${ch.p[i].toFixed(2)}).`));
    $$('button', chunksEl).forEach((b, j) => b.classList.toggle('now', j === k));
  };
  const load = async () => {
    D = await json(`data/decisions/${route}__lingbot__${mode}.json`); cur = -1;
    build(D.names, D.delta, D.rho);
    chunksEl.innerHTML = '';
    D.chunks.forEach((ch, j) => chunksEl.append(el('button', { class: ch.choice === 'KEEP' ? 'kept' : 'changed', onclick: () => { g.pause(true); g.seek((ch.f0 + 0.5) / 16); show(j); } },
      el('span', { class: 'k' }, `chunk ${ch.k}`), el('span', { class: 'c' }, ch.choice === 'KEEP' ? 'keep' : ch.choice === 'STOP' ? 'STOP' : ch.choice.startsWith('SLOW') ? ch.choice.replace('SLOW', 'slow ') : describe(ch.choice).replace(' to the ', ' ')))));
    const id = `${route}__lingbot__${mode}`;
    g.setSources([[video, `media/hi/${id}.mp4`, `media/posters/${route}.webp`]]);
    ov.set(C[id]?.track ? await loadTrack(id) : null);
    const r = B.routes.find(x => x.id === route).res.lingbot[mode];
    $('.verdict', tileEl).innerHTML = ''; if (r) $('.verdict', tileEl).append(chip(r[0], B.categories));
    show(0);
  };
  const seg = $('#knows-route');
  ROUTES.forEach(([id, name], j) => seg.append(el('button', { 'aria-pressed': j === 0, onclick: (e) => { $$('button', seg).forEach(b => b.setAttribute('aria-pressed', b === e.currentTarget)); route = id; load().then(() => g.play()); } }, name)));
  $$('#knows-mode button').forEach(b => b.addEventListener('click', () => { $$('#knows-mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); mode = b.dataset.m; load().then(() => g.play()); }));
  $('#knows-slow').addEventListener('change', (e) => g.setRate(e.target.checked ? 0.5 : 1));
  g.on((t) => {
    if (!D) return; const f = Math.round(t * 16);
    let k = D.chunks.findIndex(c => f >= c.f0 && f <= c.f1); if (f < 1) k = 0; if (k < 0) k = D.chunks.length - 1;
    show(k); $('#knows-time').textContent = `${t.toFixed(2)} s · frame ${f}`;
  });
  wirePlayer(g, { button: $('#knows-play') });
  await load();
  onVisible(tileEl, (v) => g.setVisible(v));
  g.play();
}
