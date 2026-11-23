// The GTA look's script (motion.js fetches it when the look is GTA; theme.js calls gtaLook() when a reader picks the look).
// Never with reduced motion. Three jobs:
//  1. the GTA intro, once per tab session (the <head> script sets html.intro-gta). One GSAP timeline, window.gtaIntroTl,
//     about 3.2 s with the landing; window.gtaHold before load keeps it paused so it can be stepped frame by frame
//     (after a seek with suppressed events, window.gtaIntroDraw() draws the panels):
//       0.0 s  a loading screen: diagonal panels (already partly open) slide open, each world model's own frame before
//              the obstacle (read from hero_scenes.js) and a title card
//       0.55 s the stage's clip opens to the whole screen and the camera pushes at the obstacle; a W key and a round map
//              (a dot heading for a block) come up
//       1.35 s a fast diagonal cut to the raw model's own frame going through: "Raw model: goes through" (a red ghost
//              goes through the block on the map)
//       1.9 s  NoPe: after a 120 ms colour split on that frame, a hard cut to NoPeWorld's own stopped frame with a jolt;
//              letterbox bars snap in, "NoPeWorld: stops", the dot stops at the block; the clean frame holds, then a
//              small NoPe stamp lands off the obstacle
//       2.45 s the view shrinks into the hero's comparison in 0.45 s (opening.js's landing math; on phones it stays) and a
//              diagonal wipe hands over to the stage; then the key tag drops onto its ring and the title glides in. The
//              comparison's clock is never touched
//     A click, a key, the wheel or a touch move skips it. Only big, plain words; no small print. Only the world models'
//     own frames (stills from the encoded clips; the input screenshot never appears); no second copy of a clip competes
//     with the comparison. The colour split is two tinted copies blended with mix-blend-mode (no SVG filter, so it also
//     works in Safari).
//  2. the look's motion: palms in the margins sway only while their section is on screen; the hero's palms pause off
//     screen.
//  3. a radar in the bottom-left corner: the reader as a dot driving up a street past one stop per section, the obstacle
//     at the end (it stops there). Only where the corner is free of content.
// Contract with motion.js: gtaIntro(heroIn) sets sessionStorage 'nope-intro-gta' and ends with html.intro-gta removed.
import { heroApi } from './hero.js';
import { SCENES, gtaMedia } from './hero_scenes.js';
import { noOrphans } from './ui.js';

const d = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the GTA scene's items (one per world model); GTA media come through gtaMedia (they may live on another origin)
// only items with the intro's three real frames: the raw clip before the obstacle and going through, NoPeWorld stopped
// (the input screenshot, frame 0, never appears in the intro)
const ITEMS = ((SCENES.find(s => s.id === 'gta') || {}).items || []).filter(it => it.raw && it.ours && it.intro).slice(0, 6);
const stillOf = (it, k) => gtaMedia(`posters/${k === 'stop' ? it.ours : it.raw}__${k}.webp`);
const aimOf = (it) => it.aim || '50% 55%';                         // where the camera pushes (an item may say)
const HIT = 1.55, MORPH = 2.2;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

d.classList.add('gta-js');                 // css/gta.css: the key tag's drop is driven from here

// ---------- the look's motion, paused off screen
function sway() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach(e => e.target.classList.toggle('gta-sway', e.isIntersecting)), { rootMargin: '80px 0px' });
  ['#knows', '#method', '#results', '#cite'].forEach(s => { const e = $(s); if (e) io.observe(e); });
  const top = $('#top');
  if (top) new IntersectionObserver((es) => es.forEach(e => top.classList.toggle('hp-paused', !e.isIntersecting))).observe(top);
}

// ---------- the radar: a street with one stop per section, the obstacle at its end
const FREE = 'html, body, main, section, footer, .wrap, .st-pin, .theater, .pin-spacer, .hero-top, .hp-titlerow, .h-media, .abstract-wrap, .promo-wrap';
function radar() {
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const stops = links.map(a => ({ el: $(a.getAttribute('href')) })).filter(s => s.el);
  if (!stops.length) return;
  const N = stops.length, STEP = 46, Y0 = 60;                         // map units; the reader sits at (60, 60)
  const yOf = (k) => Y0 - (k + 1) * STEP;                             // stop k on the map; the hero is the start, at Y0
  const wallY = yOf(N - 1) - 22;
  let blocks = '';
  for (let k = -1; k <= N; k++) {                                     // city blocks either side of the street
    const y = Y0 - (k + 1) * STEP - 30;
    blocks += `<rect x="14" y="${y}" width="32" height="34" rx="3"/><rect x="74" y="${y + 6}" width="34" height="30" rx="3"/>`;
  }
  const el = document.createElement('div'); el.className = 'gta-radar'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span class="gr-disc"><svg viewBox="0 0 120 120">
      <defs><clipPath id="grClip"><circle cx="60" cy="60" r="53"/></clipPath>
        <radialGradient id="grBg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#14233d"/><stop offset="1" stop-color="#0a1222"/></radialGradient></defs>
      <circle cx="60" cy="60" r="57" fill="url(#grBg)" stroke="#2ee6d6" stroke-width="2.5"/>
      <g clip-path="url(#grClip)"><g class="gr-map">
        <g fill="#1c2e4c">${blocks}</g>
        <path d="M60 ${Y0 + 80}V${wallY}" stroke="#2c4470" stroke-width="13" fill="none"/>
        <path d="M60 ${Y0 + 80}V${wallY}" stroke="#4d6a99" stroke-width="1" stroke-dasharray="4 5" fill="none"/>
        ${stops.map((s, k) => `<path d="M0 ${yOf(k)}H120" stroke="#22375c" stroke-width="7"/><circle class="gr-stop" cx="60" cy="${yOf(k)}" r="4.2"/>`).join('')}
        <rect x="38" y="${wallY - 22}" width="44" height="22" rx="3" fill="#f2c200"/>
      </g></g>
      <circle cx="60" cy="60" r="16" fill="none" stroke="rgba(46,230,214,.18)" stroke-width="1"/>
      <path d="M60 51l7 14-7-4-7 4z" fill="#fff" stroke="#0b1322" stroke-width="1.3" stroke-linejoin="round"/>
    </svg></span>`;
  document.body.append(el);
  const map = $('.gr-map', el), dots = [...el.querySelectorAll('.gr-stop')];
  let cur = -2, shown = false, q = 0;
  const update = () => {
    q = 0;
    if (d.dataset.theme !== 'gta' || d.classList.contains('intro-gta') || innerWidth < 1200) { el.classList.remove('on'); shown = false; return; }
    // where the reader is: between two stops (the hero is the start), the last stop by the page's end
    const ref = scrollY + innerHeight * .4, tops = stops.map(s => s.el.getBoundingClientRect().top + scrollY);
    let k = -1; while (k + 1 < N && tops[k + 1] <= ref) k++;
    const a = k < 0 ? 0 : tops[k], b = k + 1 < N ? tops[k + 1] : Math.max(a + 1, document.documentElement.scrollHeight - innerHeight * .6);
    let pos = k + Math.min(1, Math.max(0, (ref - a) / (b - a)));
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
    pos = Math.min(pos, N - 1 + (atEnd ? .55 : .45));                 // the dot stops short of the obstacle
    map.setAttribute('transform', `translate(0 ${((pos + 1) * STEP).toFixed(2)})`);
    if (k !== cur) { cur = k; dots.forEach((c, i) => c.classList.toggle('now', i === k)); }
    // only where the corner is free of content (as night.js keeps its moon to clear sky)
    const r = el.getBoundingClientRect(), pts = [];
    for (const fx of [.08, .5, .92]) for (const fy of [.08, .5, .92]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
    const clear = pts.every(([x, y]) => { const e = document.elementFromPoint(x, y); return !e || e.matches(FREE); });
    if (clear !== shown) { shown = clear; el.classList.toggle('on', clear); }
  };
  const ask = () => { if (!q) q = requestAnimationFrame(update); };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask);
  addEventListener('nope:theme', () => setTimeout(ask, 60)); addEventListener('nope:layout', ask);
  setInterval(() => { if (d.dataset.theme === 'gta') ask(); }, 1500);   // late sections and pins move things under it
  ask();
}

// ---------- the key tag drops onto its ring (also used at the end of the intro)
function keyDrop(tl, at) {
  const sw = $('.gta-keytag .kt-swing'), st = $('.gta-keytag .kt-stamp');
  if (!sw) return;
  tl.fromTo(sw, { yPercent: -75, rotation: -16, opacity: 0 }, { yPercent: 0, rotation: 8, opacity: 1, duration: .36, ease: 'power2.in', immediateRender: false }, at)
    .to(sw, { rotation: 0, duration: 1.2, ease: 'elastic.out(1, .32)' }, at + .36);
  if (st) tl.fromTo(st, { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: .32, ease: 'power4.out', immediateRender: false }, at + .62);
}

// ---------- the intro's pieces (opening.js's grammar, which it does not export)
// every font in (SplitText measures letters; KaTeX's fonts load lazily further down, so wait at most `cap` ms)
if (document.fonts) document.fonts.load('400 1em Anton').catch(() => {});
const fontsIn = (cap) => new Promise((res) => {
  const t0 = performance.now(), F = document.fonts;
  const go = () => { if (!F || F.status === 'loaded' || performance.now() - t0 > cap) res(); else F.ready.then(() => setTimeout(go, 30)); };
  go(); setTimeout(res, cap);
});
const ready = (imgs) => Promise.all([fontsIn(1200), Promise.race([Promise.all(imgs.map(i => (i.complete ? null
  : new Promise(r => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); })))), sleep(1600)])])
  .then(() => { noOrphans('.tagline'); });

function titleIn(tl, at) {
  const SplitText = window.SplitText, title = $('#title');
  if (!SplitText || !title) { title?.classList.add('go'); return; }
  const np = new SplitText($('.np', title), { type: 'chars', charsClass: 'ch' });
  const pen = new SplitText($('.pen', title), { type: 'chars', charsClass: 'ch' });
  const t2 = new SplitText($('.t2', title), { type: 'words', wordsClass: 'ch' });
  title.classList.add('go');
  tl.fromTo(title, { '--bar': 0 }, { '--bar': 1, duration: .6, ease: 'expo.out' }, at)
    .from(np.chars, { x: '-1.4em', opacity: 0, duration: 1, ease: 'expo.out', stagger: { each: .05, from: 'end' } }, at + .05)
    .fromTo(np.chars[np.chars.length - 1], { scaleX: 1 }, { scaleX: .72, transformOrigin: '100% 60%', duration: .08, ease: 'power1.out', yoyo: true, repeat: 1 }, at + .37)
    .from(pen.chars, { yPercent: 70, opacity: 0, duration: .8, ease: 'expo.out', stagger: .022 }, at + .2)
    .from(t2.words, { yPercent: 60, opacity: 0, duration: .9, ease: 'expo.out', stagger: .08 }, at + .32)
    .from('.hero-side > *', { y: 18, opacity: 0, duration: .8, ease: 'expo.out', stagger: .07 }, at + .45);
}

function openWipe(tl, at) {
  const stage = $('#hero-stage');
  tl.fromTo(stage, { '--cut': '2%' }, { '--cut': '50%', duration: 1.7, ease: 'expo.out', immediateRender: false,
    onUpdate: () => heroApi.setCut && heroApi.setCut(parseFloat(stage.style.getPropertyValue('--cut'))) }, at);
}

// the round map: streets, the block ahead (the obstacle's yellow), the dot, a red ghost for the original model
const MAP = `<svg class="gi-map" viewBox="0 0 120 120" aria-hidden="true">
  <defs><clipPath id="giClip"><circle cx="60" cy="60" r="54"/></clipPath></defs>
  <circle cx="60" cy="60" r="57" fill="#0b1322" fill-opacity=".9" stroke="#2ee6d6" stroke-width="3"/>
  <g clip-path="url(#giClip)">
    <g stroke="#26395a" stroke-width="10" fill="none"><path d="M0 30H120M0 88H120M24 0V120M96 0V120M60 44V120"/></g>
    <g stroke="#3d557a" stroke-width="1" stroke-dasharray="3 4" fill="none"><path d="M0 88H120M60 44V120"/></g>
    <rect x="40" y="16" width="40" height="28" rx="2.5" fill="#f2c200"/>
    <path class="gi-ghost" d="M60 98V6" stroke="#ff5a4a" stroke-width="2" stroke-dasharray="3.5 3.5" fill="none" opacity="0"/>
    <circle class="gi-ghostdot" cx="60" cy="98" r="3.8" fill="#ff5a4a" opacity="0"/>
    <circle class="gi-ring" cx="60" cy="50" r="5" fill="none" stroke="#2fd17d" stroke-width="2" opacity="0"/>
    <path class="gi-me" d="M60 90l6.5 12-6.5-3.6-6.5 3.6z" fill="#fff" stroke="#0b1322" stroke-width="1.2" stroke-linejoin="round"/>
  </g>
</svg>`;

// the diagonal panels: slanted strips side by side (landscape) or slanted bands one above the other (portrait).
// poly(i, f, e): panel i narrowed to f of its width about its middle (the panels slide open from there) and opened by e
// toward the whole screen. Built here and set on every frame (GSAP does not tween polygons with negative numbers).
function panels(N, W, H) {
  const port = H > W * 1.05, g = 3, L = port ? H : W, s = (port ? W : H) * .22, E = port ? W : H, o = 40;
  const m = (k) => (k === 0 ? -s : k === N ? L + s : k * L / N);
  const P = ([a, b]) => (port ? `${b.toFixed(1)}px ${a.toFixed(1)}px` : `${a.toFixed(1)}px ${b.toFixed(1)}px`);
  const full = [[0, 0], [L, 0], [L, E], [0, E]];
  // a diagonal edge sweeping across the screen: wipe(p) shows what is behind it (p 0 to 1), away(p) hides the rest
  const edge = (p) => { const x = p * (L + s); return [x, x - s]; };
  const wipe = (p) => { if (p >= 1) return 'none'; const [t, b] = edge(p); return `polygon(${P([-o, -o])}, ${P([t, -o])}, ${P([b, E + o])}, ${P([-o, E + o])})`; };
  const away = (p) => { const [t, b] = edge(p); return `polygon(${P([t, -o])}, ${P([L + s + o, -o])}, ${P([L + s + o, E + o])}, ${P([b, E + o])})`; };
  const poly = (i, f = 1, e = 0, out = 0) => {
    if (out > 0) return away(out);
    let a = m(i) + (i ? g : 0), b = m(i + 1) - (i < N - 1 ? g : 0);
    const c = (a + b) / 2; a = c + (a - c) * f; b = c + (b - c) * f;
    const q = [[a + s / 2, -o], [b + s / 2, -o], [b - s / 2, E + o], [a - s / 2, E + o]];
    return `polygon(${q.map((pt, k) => P([pt[0] + (full[k][0] - pt[0]) * e, pt[1] + (full[k][1] - pt[1]) * e])).join(', ')})`;
  };
  const shift = (i) => (Math.max(m(i), 0) + Math.min(m(i + 1), L)) / 2 - L / 2;
  return { poly, shift, wipe, port };
}

// the item the stage shows (its first, the default, at load)
function stageItem() {
  const v = $('#hero-stage video'), p = v ? (v.dataset.src || v.dataset.poster || v.getAttribute('poster') || '') : '';
  return ITEMS.find(it => p.includes(it.raw)) || ITEMS[0];
}

async function intro() {
  const gsap = window.gsap;
  if (!ITEMS.length) throw new Error('no GTA items');
  try { sessionStorage.setItem('nope-intro-gta', '1'); } catch (e) { /* storage blocked */ }
  scrollTo(0, 0);
  // the stage's own clip decides which panel opens (hero.js sets it as it starts)
  await Promise.race([heroApi.ready, sleep(700)]);
  d.classList.add('hero-go');
  let ended = false;
  const focus = stageItem();
  const cards = ITEMS.slice(); cards.splice(Math.min(2, cards.length), 0, null);   // null: the title card
  const W = innerWidth, H = innerHeight, G = panels(cards.length, W, H), port = G.port;
  // a portrait screen shows the focus frame whole (contain), not blown up; in its band it is scaled to look like cover
  const K = port ? Math.max(1, (H * 16 / 9) / W) : 1;

  // ---- the overlay (big, plain words only; only the world models' own frames, never the input screenshot)
  const ov = document.createElement('div'); ov.className = 'gta-intro' + (port ? ' is-port' : ''); ov.id = 'gta-intro';
  const img = (src, cls = '', pos = '50% 50%') => `<img${cls ? ` class="${cls}"` : ''} src="${src}" alt="" decoding="async" style="object-position:${pos}">`;
  const media = (it) => (!it
    ? `<div class="gi-title"><i class="gi-sun"></i><i class="gi-palm"></i><b>NoPe</b><span>World</span></div>`
    : it === focus
      ? `${img(stillOf(it, 'approach'), 'gi-a', aimOf(it))}${img(stillOf(it, 'through'), 'gi-t', aimOf(it))}`
        + `<div class="gi-split"><div class="gs gb">${img(stillOf(it, 'through'), '', aimOf(it))}<i></i></div><div class="gs r">${img(stillOf(it, 'through'), '', aimOf(it))}<i></i></div></div>`
        + `${img(stillOf(it, 'stop'), 'gi-s', aimOf(it))}`
      : img(stillOf(it, 'approach'), '', aimOf(it)));
  ov.innerHTML = `<div class="gi-cam" aria-hidden="true">${cards.map(it => `<div class="gi-panel${it === focus ? ' is-focus' : ''}">${media(it)}<i class="gi-tint"></i></div>`).join('')}
      <i class="gi-speed"></i><i class="gi-glow"></i><i class="gi-flash"></i><i class="gi-wave"></i></div>
    <i class="gi-bar t" aria-hidden="true"></i><i class="gi-bar b" aria-hidden="true"></i>
    <div class="gi-label raw" aria-hidden="true"><span class="dot"></span><b>Raw model: goes through</b></div>
    <div class="gi-label ours" aria-hidden="true"><span class="dot"></span><b>NoPeWorld: stops</b></div>
    <div class="gi-hud" aria-hidden="true">${MAP}<span class="gi-key">W</span></div>
    <div class="gi-stamp" aria-hidden="true"><span class="gta-stamp">NoPe</span></div>
    <div class="gi-load" aria-hidden="true"><i></i></div>
    <button class="gi-skip" type="button">Skip intro</button>`;
  document.body.append(ov);
  d.classList.add('gta-live');               // the first-paint cover steps aside
  ov.style.animation = 'none';               // the CSS safety timeout is for a page whose scripts failed
  const cam = $('.gi-cam', ov), flash = $('.gi-flash', ov), glow = $('.gi-glow', ov), bars = [...ov.querySelectorAll('.gi-bar')];
  const speed = $('.gi-speed', ov), wave = $('.gi-wave', ov);
  const raw = $('.gi-label.raw', ov), ours = $('.gi-label.ours', ov), hud = $('.gi-hud', ov), stamp = $('.gi-stamp', ov), load = $('.gi-load', ov), skip = $('.gi-skip', ov);
  const me = $('.gi-me', ov), ghost = $('.gi-ghost', ov), ghostDot = $('.gi-ghostdot', ov), ring = $('.gi-ring', ov);
  const pans = [...ov.querySelectorAll('.gi-panel')], fi = cards.indexOf(focus), fp = pans[fi], ftint = $('.gi-tint', fp);
  const fA = $('.gi-a', fp), fT = $('.gi-t', fp), fS = $('.gi-s', fp), fimgs = [...fp.querySelectorAll('img')];
  const split = $('.gi-split', fp), sR = $('.gs.r', fp), sGB = $('.gs.gb', fp);
  const title = $('.gi-title', ov);
  const stage = $('#hero-stage'), kt = $('.gta-keytag .kt-swing'), ktStamp = $('.gta-keytag .kt-stamp');

  // ---- the start: the panels already partly open (0 s is never an empty screen)
  const open = pans.map(() => ({ f: .62, e: 0 }));                  // each panel's opening, drawn on every frame
  const cut = { t: 0, s: 0, out: 0 };                               // diagonal wipes: to the through frame, to the stop frame, away
  const draw = () => {
    pans.forEach((p, i) => { p.style.clipPath = G.poly(i, open[i].f, open[i].e, i === fi ? cut.out : 0); });
    fT.style.clipPath = G.wipe(cut.t); fS.style.clipPath = G.wipe(cut.s);
  };
  pans.forEach((p, i) => {
    gsap.set(p, { zIndex: p === fp ? 2 : 1 });
    const m = p === fp ? fimgs : p.firstElementChild;
    if (m !== title) gsap.set(m, G.port ? { y: G.shift(i), x: 0, scale: 1.16 * (p === fp ? K : 1), transformOrigin: '50% 50%' } : { x: G.shift(i), y: 0, scale: 1.16, transformOrigin: '50% 50%' });
    else gsap.set(m, G.port ? { y: G.shift(i) } : { x: G.shift(i) });
  });
  draw();
  gsap.set(stamp, { xPercent: -50, yPercent: -50, rotation: -16, scale: 2.2, opacity: 0 });
  gsap.set([raw, ours], { y: -8, opacity: 0 });
  gsap.set(bars, { scaleY: 0 });
  gsap.set(split, { opacity: 0 });
  gsap.set(speed, { opacity: 0, scale: 1 });
  gsap.set(wave, { xPercent: -50, yPercent: -50, scale: .15, opacity: 0 });
  gsap.set(cam, { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)' });
  if (kt) gsap.set(kt, { opacity: 0 });
  if (ktStamp) gsap.set(ktStamp, { opacity: 0 });
  heroApi.ready.then(({ setCut }) => { if (!ended) setCut(2); });   // the stage opens on the NoPeWorld side

  // where the view lands: the stage's rectangle (uniform scale, clipped to it with its rounded corners); where the stage
  // is not wholly on screen (phones) the view stays and is wiped away
  let GEO = null;
  const geo = () => GEO || (GEO = (() => {
    const r = stage.getBoundingClientRect(), w = ov.clientWidth, h = ov.clientHeight;
    const R = parseFloat(getComputedStyle(stage).borderTopLeftRadius) || 24;
    if (r.top < 0 || r.top > h * .62 || port) return { x: 0, y: 0, k: 1, fade: true, clip: 'inset(0px 0px 0px 0px round 0px)' };
    const k = Math.max(r.width / w, r.height / h);
    const x = r.left + r.width / 2 - k * w / 2, y = r.top + r.height / 2 - k * h / 2;
    const t = (r.top - y) / k, l = (r.left - x) / k, b = h - (r.bottom - y) / k, rr = w - (r.right - x) / k;
    return { x, y, k, fade: false, clip: `inset(${t.toFixed(2)}px ${rr.toFixed(2)}px ${b.toFixed(2)}px ${l.toFixed(2)}px round ${(R / k).toFixed(2)}px)` };
  })());

  const done = () => {
    if (ended) return; ended = true;
    ['keydown', 'wheel', 'touchmove'].forEach(t => removeEventListener(t, skipIt));
    d.classList.remove('intro-gta', 'gta-live'); ov.remove();
    $('#title')?.classList.add('go');                                // skipped before the title came in: show it at rest
    dispatchEvent(new Event('scroll'));                              // the radar looks again
  };
  const tl = gsap.timeline({ paused: true, onComplete: done, onUpdate: draw });
  const skipIt = () => { if (!ended) { tl.progress(1); done(); } };
  const T = { open: .55, push: .95, through: 1.35, split: 1.78, hit: 1.9, stamp: 2.2, land: 2.45 };

  // 1. the loading screen: the panels slide open on their diagonals, drifting; the title card's neon flickers on
  pans.forEach((p, i) => {
    tl.to(open[i], { f: 1, duration: .45, ease: 'expo.out' }, i * .04)
      .from(p, { [G.port ? 'x' : 'y']: (i % 2 ? 1 : -1) * 24, duration: .7, ease: 'expo.out' }, i * .04);
    if (p !== fp && p.firstElementChild !== title) tl.to(p.firstElementChild, { scale: 1.08, duration: 1.1, ease: 'sine.out' }, 0);
  });
  if (title) tl.fromTo(title, { opacity: .3 }, { keyframes: [{ opacity: 1, duration: .06 }, { opacity: .4, duration: .05 }, { opacity: 1, duration: .08 }] }, .08);
  tl.to(load, { opacity: 0, duration: .25 }, .45)
  // 2. the stage's clip opens to the whole screen (its own frame before the obstacle, no tint); the camera pushes at it;
  //    the W key and the map come up
    .to(open[fi], { e: 1, duration: .45, ease: 'expo.inOut' }, T.open)
    .to(fimgs, { x: 0, y: 0, scale: K, duration: .45, ease: 'expo.inOut' }, T.open)
    .to(ftint, { opacity: 0, duration: .35 }, T.open)
    .to(pans.filter(p => p !== fp), { opacity: 0, duration: .25 }, T.open + .3);
  if (K > 1) tl.to(fimgs, { scale: 1, duration: .3, ease: 'power2.out' }, T.push - .05);   // portrait: the whole frame
  tl.to(fimgs, { scale: 1.12, duration: T.through - T.push, ease: 'power2.in' }, T.push)
    .fromTo(speed, { opacity: 0, scale: 1 }, { opacity: .85, scale: 1.3, duration: T.through - T.push, ease: 'power2.in', immediateRender: false }, T.push)
    .to(speed, { opacity: 0, duration: .1 }, T.through)
    .fromTo(hud, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .3, ease: 'power2.out' }, T.open + .1)
    .to(me, { y: -40, duration: T.hit - T.open - .1, ease: 'power1.in' }, T.open + .1)
  // 3. the raw model's own next frame: a fast diagonal cut to it going through, its label; a red ghost on the map
    .to(cut, { t: 1, duration: .16, ease: 'power3.out' }, T.through)
    .fromTo(flash, { opacity: .45 }, { opacity: 0, duration: .3, ease: 'power2.out', immediateRender: false }, T.through)
    .set(fimgs, { scale: 1 }, T.through)
    .to(raw, { opacity: 1, y: 0, duration: .22, ease: 'power2.out' }, T.through)
    .to(ghost, { opacity: .9, duration: .15 }, T.through)
    .fromTo(ghostDot, { opacity: .95, y: 0 }, { y: -94, duration: .6, ease: 'none', immediateRender: false }, T.through)
    .to(ghostDot, { opacity: 0, duration: .15 }, T.through + .5)
  // 4. NoPe: a colour split on the through frame for 120 ms, then a hard cut to NoPeWorld's stopped frame with a jolt;
  //    letterbox bars snap in, the label turns to NoPeWorld's, the dot stops at the block; the clean stop frame holds
  //    before the stamp lands off the obstacle
    .set(split, { opacity: 1 }, T.split)
    .fromTo(sR, { x: 14 }, { x: 0, duration: T.hit - T.split, ease: 'none', immediateRender: false }, T.split)
    .fromTo(sGB, { x: -14 }, { x: 0, duration: T.hit - T.split, ease: 'none', immediateRender: false }, T.split)
    .set(split, { opacity: 0 }, T.hit)
    .add('hit', T.hit)
    .to(cut, { s: 1, duration: .08, ease: 'none' }, 'hit')
    .to(cam, { keyframes: [{ x: -12, y: 3, duration: .05 }, { x: 9, y: -2, duration: .06 }, { x: -5, y: 1, duration: .07 }, { x: 0, y: 0, duration: .12 }], ease: 'none' }, 'hit')
    .fromTo(wave, { scale: .15, opacity: 1 }, { scale: 2.6, opacity: 0, duration: .5, ease: 'power2.out', immediateRender: false }, 'hit')
    .to(bars, { scaleY: 1, duration: .14, ease: 'power4.out' }, 'hit')
    .to(glow, { opacity: .5, duration: .3 }, 'hit')
    .to(raw, { opacity: 0, duration: .06 }, 'hit')
    .to(ours, { opacity: 1, y: 0, duration: .22, ease: 'power2.out' }, 'hit+=.08')
    .to(ring, { opacity: 1, duration: .1 }, 'hit')
    .fromTo(ring, { attr: { r: 3 } }, { attr: { r: 11 }, opacity: 0, duration: .5, ease: 'power2.out', immediateRender: false }, 'hit+=.05')
    .to(stamp, { opacity: 1, scale: 1, rotation: -8, duration: .26, ease: 'power4.out' }, T.stamp)
  // 5. the landing (0.45 s): the view shrinks into the comparison, then a diagonal wipe hands over to the stage (no
  //    double exposure); the title and the key tag come in once the overlay is gone
    .add('land', T.land)
    .to(cam, { x: () => geo().x, y: () => geo().y, scale: () => geo().k, clipPath: () => geo().clip, duration: .45, ease: 'power3.inOut' }, 'land')
    .to([ours, hud, skip, glow, stamp], { opacity: 0, duration: .2 }, 'land')
    .to(bars, { scaleY: 0, duration: .25, ease: 'power2.in' }, 'land')
    .to(ov, { backgroundColor: 'rgba(11, 19, 34, 0)', duration: .3, ease: 'power2.inOut' }, 'land+=.1')
    .set(ov, { pointerEvents: 'none' }, 'land+=.2')
    .to(cut, { out: 1, duration: .28, ease: 'power2.in' }, 'land+=.45')
    .set(ov, { display: 'none' }, 'land+=.75');
  const after = T.land + .78;
  keyDrop(tl, after);
  openWipe(tl, after);

  ov.addEventListener('click', skipIt);
  ['keydown', 'wheel', 'touchmove'].forEach(t => addEventListener(t, skipIt, { passive: true }));
  window.gtaIntroDraw = draw;               // a seek with suppressed events skips onUpdate: scripts/shoot_gta.py draws itself
  // the loading screen holds until the fonts are in (SplitText measures the title's letters; at most 1.2 s), then it plays
  ready(pans.map(p => $('img', p)).filter(Boolean)).then(() => {
    if (ended) return;
    titleIn(tl, after + .05);
    window.gtaIntroTl = tl; window.gtaHero = heroApi;          // for scripts/shoot_gta.py (steps it frame by frame)
    if (!window.gtaHold) tl.play();
  });
}

// the look's own motion (palms, radar), once; theme.js calls it when a reader picks the GTA look on /
let looked = false;
export function gtaLook() { if (looked) return; looked = true; sway(); radar(); }

export function gtaIntro(heroIn) {
  const gsap = window.gsap;
  gtaLook();
  if (d.classList.contains('intro-gta') && gsap && !reduce) {
    intro().catch((e) => {                  // never leave the page covered
      console.error('gta intro', e);
      $('#gta-intro')?.remove(); d.classList.remove('intro-gta', 'gta-live');
      try { sessionStorage.setItem('nope-intro-gta', '1'); } catch (er) { /* storage blocked */ }
      heroIn();
    });
    return;
  }
  try { sessionStorage.setItem('nope-intro-gta', '1'); } catch (e) { /* storage blocked */ }
  d.classList.remove('intro-gta');
  // the entrance splits the title into letters: once the fonts are in (at most 1.2 s; the hero waits hidden till then)
  fontsIn(1200).then(() => {
    heroIn();
    if (gsap) { gsap.set(['.gta-keytag .kt-swing', '.gta-keytag .kt-stamp'], { opacity: 0 }); keyDrop(gsap.timeline(), .35); }
  });
}
