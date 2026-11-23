// Boot: header, section nav, progress rail, smooth scroll, motion, links from config.js, BibTeX, equations, lazy sections.
import { $, $$, el, json, lowData, reduceMotion } from './util.js';
import { initMotion } from './motion.js';
import { infoPopovers, cursorTag, magnetic, tilt, noOrphans } from './ui.js';

const CFG = window.NOPE_CONFIG || { links: {}, bibtex: {} };

// ---------- links (placeholders until config.js has URLs)
const LINKS = [
  ['arxiv', 'Paper', '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 2.5h7l3.5 3.5v11.5H5z"/><path d="M12 2.5V6h3.5M7.5 10h5M7.5 13h5"/></svg>'],
  ['code', 'Code', '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6l-4 4 4 4M13 6l4 4-4 4"/></svg>'],
  ['weights', 'Weights', '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M10 2.5l6.5 3.7v7.6L10 17.5l-6.5-3.7V6.2z"/><path d="M3.5 6.2L10 10l6.5-3.8M10 10v7.5"/></svg>'],
  ['bench', 'NoPeBench', '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 8h14M8 8v9"/></svg>'],
];
function links() {
  const box = $('#links');
  for (const [k, name, icon] of LINKS) {
    const url = CFG.links && CFG.links[k];
    box.append(url ? el('a', { class: 'btn' + (k === 'arxiv' ? ' primary' : ''), href: url, rel: 'noopener', html: icon + name })
      : el('span', { class: 'btn', 'aria-disabled': 'true', title: 'Link will be added on release', html: `${icon}${name} <span class="soon">soon</span>` }));
  }
  box.append(el('a', { class: 'btn', href: '#cite', html: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 6H3.5v5H6l-1.5 3M15 6h-2.5v5H15l-1.5 3"/></svg>BibTeX' }));
  if (CFG.authors && CFG.authors.length) {
    const a = $('[data-cfg=authors]'); a.innerHTML = '';
    CFG.authors.forEach((x, i) => {
      const nm = el('span', { class: 'nm' }, x.url ? el('a', { href: x.url }, x.name) : x.name); a.append(nm);
      if (x.corresponding) nm.append(el('a', { class: 'corr', href: 'mailto:' + x.corresponding, title: 'Corresponding author', 'aria-label': 'Corresponding author: e-mail', html: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="M3 5.5l7 5.5 7-5.5"/></svg>' }));
      if (i < CFG.authors.length - 1) a.append(', ');
    });
  }
  const af = $('[data-cfg=affil]'); if (af && CFG.affiliations) af.textContent = CFG.affiliations;
}

function promo() {
  const box = $('#promo'); if (!box) return;
  const yt = CFG.video_youtube, bv = CFG.video_bilibili, file = CFG.video;
  if (!yt && !bv && !file) return;
  box.innerHTML = '';
  const frame = (src) => el('iframe', { src, title: 'NoPeWorld video', allow: 'autoplay; fullscreen; picture-in-picture; encrypted-media', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin' });
  const own = () => el('video', { src: file, controls: '', playsinline: '', autoplay: '', poster: CFG.video_poster || null });
  const ytOk = () => new Promise((ok) => {            // can this browser reach YouTube? (a thumbnail, 2.5 s)
    if (!yt) return ok(false);
    const img = new Image(); const t = setTimeout(() => ok(false), 2500);
    img.onload = () => { clearTimeout(t); ok(img.naturalWidth > 0); }; img.onerror = () => { clearTimeout(t); ok(false); };
    img.src = `https://i.ytimg.com/vi/${yt}/default.jpg?t=${Date.now()}`;
  });
  const cover = el('button', { class: 'promo-cover', 'aria-label': 'Play the video', style: CFG.video_poster ? { backgroundImage: `url(${CFG.video_poster})` } : null },
    el('span', { class: 'promo-play', 'aria-hidden': 'true' }), el('span', { class: 'promo-wait' }, 'Loading the player…'));
  cover.addEventListener('click', async () => {
    cover.classList.add('wait');
    const useYt = await ytOk();
    box.innerHTML = '';
    if (useYt) box.append(frame(`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1&modestbranding=1`));
    else if (bv) box.append(frame(`https://player.bilibili.com/player.html?bvid=${bv}&autoplay=1&high_quality=1&danmaku=0`));
    else if (file) box.append(own());
  });
  box.append(cover);
  // the other places to watch it
  const links = [];
  if (yt) links.push(el('a', { href: `https://youtu.be/${yt}`, target: '_blank', rel: 'noopener' }, 'YouTube'));
  if (bv) links.push(el('a', { href: `https://www.bilibili.com/video/${bv}`, target: '_blank', rel: 'noopener' }, 'Bilibili'));
  if (file) links.push(el('a', { href: file, download: '' }, 'MP4 file (43.5 MB)'));
  if (links.length) { const p = el('p', { class: 'note promo-alt' }, 'Also on '); links.forEach((a, k) => { if (k) p.append(' · '); p.append(a); }); box.after(p); }
}

function bibtex() {
  const b = CFG.bibtex || {};
  const lines = [`@article{${b.key || 'nopeworld'},`, `  title   = {${b.title || 'Non-penetrating World Models'}},`, `  author  = {${b.author || ''}},`];
  if (b.note) lines.push(`  journal = {${b.note}},`);
  lines.push(`  year    = {${b.year || '2026'}}`, '}');
  $('#bibtext').textContent = lines.join('\n');
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(lines.join('\n')); $('#copy').textContent = 'Copied'; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($('#bibtext')); getSelection().removeAllRanges(); getSelection().addRange(r); $('#copy').textContent = 'Selected'; }
    setTimeout(() => { $('#copy').textContent = 'Copy'; }, 1600);
  });
}

// ---------- header: scrolled state, progress rail (the camera dot runs to the end wall and stops there), active section
function header() {
  const hdr = $('#header'), rail = $('.rail', hdr), cam = $('.cam', rail), track = $('.track', rail);
  const nav = $$('.nav a, .mnav a');
  $$('.mnav a').forEach(a => a.addEventListener('click', () => { const d = a.closest('details'); if (d) d.open = false; }));
  const secs = nav.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const navEl = $('.nav'), ind = $('.nav-ind'), dark = $$('.theater.dark');
  let lastAct = null;
  const update = () => {
    const y = scrollY, H = document.documentElement.scrollHeight - innerHeight;
    const p = H > 0 ? Math.min(1, y / H) : 0;
    hdr.classList.toggle('scrolled', y > 8);
    const W = rail.clientWidth, wall = 10, R = 11;
    const x = p * (W - wall - R - 1);            // stops one pixel short of the wall: touch, never pass
    cam.style.setProperty('--x', x + 'px');
    track.style.setProperty('--p', (p * 100) + '%');
    cam.classList.toggle('touch', p > 0.995);
    let cur = null;
    for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.35) cur = s;
    nav.forEach(a => a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id));
    // the yellow bar under the active link slides to it; the header turns dark over the dark sections
    const act = cur && $(`.nav a[href="#${cur.id}"]`);
    if (ind && act !== lastAct) {
      lastAct = act;
      if (act) { const r = act.getBoundingClientRect(), n = navEl.getBoundingClientRect(); ind.style.width = (r.width - 22) + 'px'; ind.style.transform = `translateX(${r.left - n.left + 11}px)`; }
      ind.classList.toggle('on', !!act);
    }
    hdr.classList.toggle('on-dark', dark.some(d => { const r = d.getBoundingClientRect(); return r.top < 30 && r.bottom > 30; }));
  };
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', update); update();
  const act = $('.nav a.active'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function reveals() {
  const items = $$('.reveal, .reveal-x, .head, #costs, #open-bars');
  if (reduceMotion || !('IntersectionObserver' in window)) { items.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(e => io.observe(e));
}

let lenis = null;
function smooth() {
  if (reduceMotion || !window.Lenis) return;
  lenis = new window.Lenis({ duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3.2), smoothWheel: true, autoRaf: false });
  // one clock for smooth scroll and every scroll-driven animation: Lenis runs on GSAP's ticker (no jitter on pins)
  if (window.gsap) { window.gsap.ticker.add((t) => lenis.raf(t * 1000)); window.gsap.ticker.lagSmoothing(0); }
  else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  if (window.ScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href'); if (id.length < 2) return; const t = $(id); if (!t) return;
    e.preventDefault(); history.replaceState(null, '', id);
    // the sections below the hero may not be built yet: build them now, measure once, then go
    if (restDone) lenis.scrollTo(t, { offset: -70 });
    else buildRest(true).then(() => { refreshAll(); lenis.scrollTo(t, { offset: -70 }); });
  }));
  // dialogs and inputs must not fight the smooth scroll
  $$('dialog').forEach(d => { d.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true }); d.setAttribute('data-lenis-prevent', ''); });
}
export const getLenis = () => lenis;

async function equations() {
  try { const M = await json('data/math.json'); $$('[data-math]').forEach(e => { if (M[e.dataset.math]) e.innerHTML = M[e.dataset.math]; }); } catch (e) { /* plain-text fallback stays */ }
}

function lowDataSwitch() {
  const sw = $('#lowdata'); if (sw) { sw.checked = lowData.on; sw.addEventListener('change', () => lowData.set(sw.checked)); }
}

// ---------- sections, each started when it comes near
const SECTIONS = [
  ['#top', () => import('./hero.js').then(m => m.initHero())],
  ['#problem', () => import('./problem.js').then(m => m.initProblem())],
  ['#problem .pg', () => import('./playground.js').then(m => m.initPlayground())],
  ['#knows', () => import('./knows.js').then(m => m.initKnows())],
  ['#method', () => import('./method.js').then(m => { m.initMethodTour(); return m.initMethod(); })],
  ['#bench', () => import('./bench.js').then(m => m.initBench())],
  ['#results', () => import('./results.js').then(m => m.initResults())],
  ['#compare', () => import('./compare.js').then(m => m.initCompare())],
  ['#open', () => import('./open.js').then(m => m.initOpen())],
  ['#num-headline', () => import('./results.js').then(m => m.initHeadline())],
];

// pins are created out of page order (sections load asynchronously): sort them by position before every refresh
const refreshAll = () => { if (window.ScrollTrigger) { window.ScrollTrigger.sort(); window.ScrollTrigger.refresh(); } };

// The sections below the hero (11-23, the user: entering stutters). Building all of them at boot took the intro's frames:
// NoPeBench's table and dot plot, the Task 3 strip, overlays, and every ScrollTrigger measuring the page, seconds of
// main-thread work while the intro ran. Now the hero is built at boot; the rest once the intro has finished (about 1 s
// after load on a page without one), one section per idle slot, and all at once the moment the reader scrolls, presses a
// key, follows a link or arrives on one. Media stay lazy as before: a clip is fetched only when its group comes on screen.
let restP = null, restDone = false, hurry = false, wake = null, restOk = null;
const restReady = new Promise(r => { restOk = r; });       // settles when every section is built; starts nothing
const idle = () => new Promise(r => {
  if (hurry) return r();
  wake = r;
  if (window.requestIdleCallback) requestIdleCallback(() => r(), { timeout: 400 }); else setTimeout(r, 50);
});
function buildRest(now) {
  if (now && !hurry) { hurry = true; if (wake) wake(); }
  if (!restP) restP = (async () => {
    // the headline number sits right under the hero: first
    const order = [SECTIONS[SECTIONS.length - 1], ...SECTIONS.slice(1, -1)];
    for (const [sel, fn] of order) {
      if (!$(sel)) continue;
      await idle();
      await fn().catch(err => console.error(sel, err));
    }
    restDone = true; restOk();
  })();
  return restP;
}
const introRunning = () => { const c = document.documentElement.classList; return c.contains('intro-on') || c.contains('intro-gta'); };
function startRest() {
  const hurryUp = () => buildRest(true);
  ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, hurryUp, { once: true, passive: true }));
  if (location.hash.length > 1) { buildRest(true); return; }
  const go = (ms) => setTimeout(() => buildRest(false), ms);
  if (!introRunning()) { go(1000); return; }
  const mo = new MutationObserver(() => { if (!introRunning()) { mo.disconnect(); go(250); } });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  go(12000);                                    // an intro that never ends must not leave the page unbuilt
}

function boot() {
  links(); promo(); bibtex(); header(); reveals(); lowDataSwitch(); equations(); infoPopovers(); cursorTag();
  // deferred classic scripts (GSAP, Lenis) have run before this module: smooth scroll and the choreography start now
  smooth(); initMotion(lenis);
  const hero = SECTIONS[0][1]().catch(err => console.error('#top', err));
  startRest();
  const built = Promise.all([hero, restReady]);
  // the pinned method animation measures the page: once, when every section has its final height (and the fonts are in)
  Promise.allSettled([built, document.fonts ? document.fonts.ready : null]).then(() => requestAnimationFrame(() => {
    refreshAll(); magnetic(); tilt();
    // headlines without a one-word last line, once the fonts and every section are in, and again after a resize
    if (noOrphans()) dispatchEvent(new Event('nope:layout'));
  }));
  let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (noOrphans()) dispatchEvent(new Event('nope:layout')); }, 250); });
}
boot();
