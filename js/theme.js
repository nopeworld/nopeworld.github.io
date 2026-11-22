// Day and Night View. Until the reader picks one with the switch, the page follows the operating system (dark → Night,
// light → Day, and it changes along if the system does); a pick is kept in localStorage ('nope-theme') and then wins.
// The <head> script sets <html data-theme> the same way before the first paint, so there is no flash.
// This wires the header switch: the new theme spreads from the switch in a circle (a View Transition; a growing disc
// where the browser has none; an instant swap with reduced motion), the night's effects (night.js, fetched only for
// Night View) start with a burst of dust at the switch and the stars fading in. It also hangs a hat on a few headings
// and tells the maps to repaint ('nope:theme').
const KEY = 'nope-theme';
const d = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const osDark = matchMedia('(prefers-color-scheme: dark)');
const stored = () => { try { const v = localStorage.getItem(KEY); return v === 'night' || v === 'day' ? v : null; } catch (e) { return null; } };
const saved = () => stored() || (osDark.matches ? 'night' : 'day');
// the system changes its setting (e.g. at sunset): follow it, unless the reader has picked a theme
osDark.addEventListener?.('change', () => { if (!stored()) setTheme(saved(), false); });

let night = null, nightP = null;
const loadNight = () => nightP || (nightP = import('./night.js').then(m => (night = m)));
function effects(t, from) {
  if (t !== 'night') { if (night) night.stop(); return; }
  if (night) night.start({ from }); else loadNight().then(m => { if (d.dataset.theme === 'night') m.start({ from }); }).catch(() => {});
}

export function setTheme(t, save = true, from = null) {
  t = t === 'night' ? 'night' : 'day';
  d.dataset.theme = t;
  const sw = document.getElementById('night'); if (sw) sw.checked = t === 'night';
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = t === 'night' ? '#170f0a' : '#fbf8f1';
  if (save) { try { localStorage.setItem(KEY, t); } catch (e) { /* storage blocked: the choice lasts for this page */ } }
  effects(t, from);
  dispatchEvent(new CustomEvent('nope:theme', { detail: t }));
}

// the switch: the new theme spreads from it (about 0.95 s)
const DUR = 950, EASE = 'cubic-bezier(.65, 0, .25, 1)';
export function flip(t, from) {
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
  // without View Transitions: a disc of the new page colour grows from the switch, the theme changes under it, it fades
  const disc = Object.assign(document.createElement('div'), { className: 'theme-disc' });
  disc.style.background = t === 'night' ? '#170f0a' : '#fbf8f1';
  document.body.append(disc); ring();
  const grow = disc.animate({ clipPath: clip }, { duration: DUR * .7, easing: EASE, fill: 'forwards' });
  grow.finished.then(() => { setTheme(t, true, from); return disc.animate({ opacity: [1, 0] }, { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished; })
    .catch(() => setTheme(t, true, from)).finally(() => disc.remove());
}

// a hat hung at the end of a few headings (a line drawing by day, gold by night); it drops on once the heading is in
const HATS = ['#problem .head h2', '#method .head h2', '#results .head h2', '#limits .head h2'];
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
  const sw = document.getElementById('night');
  if (sw) {
    sw.addEventListener('change', () => { const r = sw.getBoundingClientRect(); flip(sw.checked ? 'night' : 'day', { x: r.left + r.width / 2, y: r.top + r.height / 2 }); });
    // fetch the night's effects while the pointer is on its way to the switch, so the reveal shows them at once
    sw.closest('label').addEventListener('pointerenter', () => { loadNight().catch(() => {}); }, { once: true });
  }
  // after the page's own scripts have split the headings into words: deferred and module scripts (main.js among them)
  // all run before DOMContentLoaded, so the hats go on then
  if (document.readyState === 'complete') hats(); else document.addEventListener('DOMContentLoaded', hats, { once: true });
}
init();
