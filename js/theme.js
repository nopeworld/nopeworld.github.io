// The three looks (user 11-23): Day = the paper's page, Night = dark tones with gold light (Harry Potter-inspired),
// GTA = sunset streets (css/gta.css). On / the page opens in the reader's pick (localStorage 'nope-theme'), else Night if the
// operating system is dark, else Day, and follows the system while nothing is picked. On /?gta (the /gta/ stub lands there) it
// opens in the GTA look; a pick there lasts for the tab session ('nope-theme-gta' in sessionStorage). The <head> script sets
// <html data-theme> the same way before the first paint, so there is no flash.
// This wires the header's three-way switch: the new look spreads from the pressed button in a circle (a View Transition; a
// growing disc where the browser has none; an instant swap with reduced motion), the night's effects (night.js, fetched only
// for Night) start with a burst of dust and the stars fading in. It also hangs a hat on a few headings and tells the maps and
// the hero to repaint ('nope:theme', detail = the look).
const d = document.documentElement;
export const LOOKS = ['day', 'night', 'gta'];
export const entry = d.dataset.entry === 'gta' ? 'gta' : 'hp';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const osDark = matchMedia('(prefers-color-scheme: dark)');
const store = () => { try { return entry === 'gta' ? sessionStorage : localStorage; } catch (e) { return null; } };
const KEY = entry === 'gta' ? 'nope-theme-gta' : 'nope-theme';
const stored = () => { try { const v = store()?.getItem(KEY); return LOOKS.includes(v) ? v : null; } catch (e) { return null; } };
const saved = () => stored() || (entry === 'gta' ? 'gta' : (osDark.matches ? 'night' : 'day'));
// the system changes its setting (e.g. at sunset): on / follow it, unless the reader has picked a look
osDark.addEventListener?.('change', () => { if (entry === 'hp' && !stored()) setTheme(saved(), false); });

// each look's page colour (the disc fallback, the browser's theme-color); the GTA look may set --look-bg on its root
const BG = { day: '#fbf8f1', night: '#170f0a', gta: '#fff1e6' };
const bgOf = (t) => (t === 'gta' && getComputedStyle(d).getPropertyValue('--look-bg-gta').trim()) || BG[t];

let night = null, nightP = null;
const loadNight = () => nightP || (nightP = import('./night.js').then(m => (night = m)));
function effects(t, from) {
  if (t === 'gta') import('./gta_intro.js').then(m => m.gtaLook()).catch(() => {});   // the GTA look's palms and radar
  if (t !== 'night') { if (night) night.stop(); return; }
  if (night) night.start({ from }); else loadNight().then(m => { if (d.dataset.theme === 'night') m.start({ from }); }).catch(() => {});
}

// the switch's sliding pill sits under the pressed button
function mark(t) {
  const sw = document.getElementById('looksw'); if (!sw) return;
  let on = null;
  sw.querySelectorAll('button[data-look]').forEach(b => { const y = b.dataset.look === t; b.setAttribute('aria-checked', String(y)); b.tabIndex = y ? 0 : -1; if (y) on = b; });
  const ind = sw.querySelector('.looksw-ind');
  if (ind && on) { ind.style.width = on.offsetWidth + 'px'; ind.style.transform = `translateX(${on.offsetLeft}px)`; }
}

export function setTheme(t, save = true, from = null) {
  t = LOOKS.includes(t) ? t : 'day';
  d.dataset.theme = t;
  mark(t);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = bgOf(t);
  if (save) { try { store()?.setItem(KEY, t); } catch (e) { /* storage blocked: the choice lasts for this page */ } }
  effects(t, from);
  dispatchEvent(new CustomEvent('nope:theme', { detail: t }));
}

// the switch: the new look spreads from the pressed button (about 0.95 s)
const DUR = 950, EASE = 'cubic-bezier(.65, 0, .25, 1)';
export function flip(t, from) {
  if (t === d.dataset.theme) return;
  if (reduce || !from) { setTheme(t, true, from); return; }
  const { x, y } = from, R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 8;
  const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`];
  // a ring of the page's yellow rides the edge of the circle (same size, same easing)
  const ring = () => { const r = Object.assign(document.createElement('div'), { className: 'theme-ring' });
    Object.assign(r.style, { left: x - R + 'px', top: y - R + 'px', width: 2 * R + 'px', height: 2 * R + 'px' }); document.body.append(r);
    window.hpThemeRing = r.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(.85)', opacity: 1, offset: .8 }, { transform: 'scale(1)', opacity: 0 }], { duration: DUR, easing: EASE, fill: 'forwards' });
    window.hpThemeRing.finished.finally(() => r.remove()); };
  if (document.startViewTransition) {
    d.classList.add('theme-vt');
    const vt = document.startViewTransition(() => (t === 'night' ? loadNight().catch(() => {}) : Promise.resolve()).then(() => { setTheme(t, true, from); ring(); }));
    vt.ready.then(() => { window.hpThemeAnim = d.animate({ clipPath: clip }, { duration: DUR, easing: EASE, pseudoElement: '::view-transition-new(root)' }); }).catch(() => {});
    vt.finished.finally(() => { d.classList.remove('theme-vt'); window.hpThemeAnim = null; });
    return;
  }
  // without View Transitions: a disc of the new page colour grows from the button, the look changes under it, it fades
  const disc = Object.assign(document.createElement('div'), { className: 'theme-disc' });
  disc.style.background = bgOf(t);
  document.body.append(disc); ring();
  const grow = disc.animate({ clipPath: clip }, { duration: DUR * .7, easing: EASE, fill: 'forwards' });
  grow.finished.then(() => { setTheme(t, true, from); return disc.animate({ opacity: [1, 0] }, { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished; })
    .catch(() => setTheme(t, true, from)).finally(() => disc.remove());
}

// a hat hung at the end of a few headings (a line drawing by day, gold by night); it drops on once the heading is in
const HATS = ['#problem .head h2', '#method .head h2', '#results .head h2'];
function hats() {
  // on when the heading's words have come in (motion.js starts them as the heading passes 88% of the screen), so a
  // hat never waits there alone; at once with reduced motion
  const io = 'IntersectionObserver' in window && !reduce
    ? new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.querySelector('.hp-hat')?.classList.add('on'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -14% 0px' })
    : null;
  for (const sel of HATS) {
    const h = document.querySelector(sel); if (!h || h.querySelector('.hp-hat')) continue;
    const hat = Object.assign(document.createElement('span'), { className: 'hp-hat', ariaHidden: 'true' });
    h.append(hat);
    if (io) io.observe(h); else hat.classList.add('on');
  }
}

function init() {
  setTheme(saved(), false);
  const sw = document.getElementById('looksw');
  if (sw) {
    const btns = [...sw.querySelectorAll('button[data-look]')];
    btns.forEach(b => b.addEventListener('click', () => { const r = b.getBoundingClientRect(); flip(b.dataset.look, { x: r.left + r.width / 2, y: r.top + r.height / 2 }); }));
    // arrow keys move between the three (a radio group)
    sw.addEventListener('keydown', (e) => {
      const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
      e.preventDefault(); const i = (LOOKS.indexOf(d.dataset.theme) + k + 3) % 3, b = btns[i]; b.focus(); b.click();
    });
    // fetch the night's effects while the pointer is on its way to the switch, so the reveal shows them at once
    sw.querySelector('[data-look="night"]')?.addEventListener('pointerenter', () => { loadNight().catch(() => {}); }, { once: true });
    // the pill's size depends on the font: place it again once the fonts are in and on resize
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => mark(d.dataset.theme));
    addEventListener('resize', () => mark(d.dataset.theme));
  }
  window.nopeTheme = { set: (t) => setTheme(t, false), flip, get: () => d.dataset.theme };      // for the test and screenshot scripts
  // after the page's own scripts have split the headings into words: deferred and module scripts (main.js among them)
  // all run before DOMContentLoaded, so the hats go on then
  if (document.readyState === 'complete') hats(); else document.addEventListener('DOMContentLoaded', hats, { once: true });
}
init();
