// The choreography (GSAP + ScrollTrigger + SplitText + ScrambleText). One idea throughout: things arrive, touch a yellow
// wall, and stop there. Nothing here changes what the page shows; it only animates toward the resting CSS state, so with
// reduced motion (or without GSAP) the page is complete as it stands. Wide screens get the pinned set pieces; phones get
// the same pieces played once, unpinned.
import { $, $$, reduceMotion } from './util.js';
import { heroApi } from './hero.js';

const G = () => window.gsap;
const HEADER = 60;

// resolves once `sel` exists (sections build their DOM asynchronously)
function ready(sel, root = document) {
  return new Promise((res) => {
    if ($(sel, root)) { res($(sel, root)); return; }
    const mo = new MutationObserver(() => { const e = $(sel, root); if (e) { mo.disconnect(); res(e); } });
    mo.observe(root === document ? document.body : root, { childList: true, subtree: true });
  });
}

// ---------- intro: the logo assembles (the wall rises, the camera glides into it and stops), then flies to the header
function intro(done) {
  const gsap = G(), d = document.documentElement;
  if (!d.classList.contains('intro-on')) { done(); return; }
  try { sessionStorage.setItem('nope-intro', '1'); } catch (e) { /* storage blocked */ }
  const ov = $('#intro'), mark = $('.intro-mark', ov), wall = $('.iw', mark), cam = $('.ic', mark), word = $('.intro-word', ov), brand = $('.brand-mark');
  ov.style.animation = 'none';   // the CSS safety timeout is for a page whose scripts failed
  gsap.set(wall, { scaleY: 0, transformOrigin: '50% 100%' });
  gsap.set(cam, { x: -26, opacity: 0 });
  gsap.set(word, { opacity: 0, y: 8 });
  const tl = gsap.timeline({ onComplete: () => { d.classList.remove('intro-on'); ov.remove(); } });
  tl.to(wall, { scaleY: 1, duration: .42, ease: 'expo.out' }, .05)
    .to(word, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' }, .1)
    .to(cam, { opacity: 1, duration: .12 }, .12)
    .to(cam, { x: 0, duration: .62, ease: 'power3.out' }, .12)                 // decelerates and stops touching the wall
    .to(cam, { scaleX: .9, transformOrigin: '100% 50%', duration: .06, ease: 'power1.out' }, .6)
    .to(cam, { scaleX: 1, duration: .2, ease: 'power2.out' }, .66)
    .fromTo(wall, { filter: 'drop-shadow(0 0 0px rgba(242,194,0,.9))' }, { filter: 'drop-shadow(0 0 3px rgba(242,194,0,0))', duration: .5 }, .6)
    .add(() => {
      const a = mark.getBoundingClientRect(), b = brand.getBoundingClientRect();
      gsap.to(mark, { x: b.left + b.width / 2 - (a.left + a.width / 2), y: b.top + b.height / 2 - (a.top + a.height / 2), scale: b.width / a.width, duration: .7, ease: 'expo.inOut' });
      gsap.to(word, { opacity: 0, duration: .25 });
      gsap.to(ov, { backgroundColor: 'rgba(255,255,255,0)', duration: .55, delay: .12, ease: 'power2.inOut' });
      done();
    }, .82)
    .to({}, { duration: .72 });
}

// ---------- hero: the title stops on its wall, the wipe slides in and stops in the middle
function heroIn() {
  const gsap = G(), title = $('#title');
  if (!title || !window.SplitText) { document.documentElement.classList.add('hero-go'); title?.classList.add('go'); return; }
  const np = new window.SplitText($('.np', title), { type: 'chars', charsClass: 'ch' });
  const pen = new window.SplitText($('.pen', title), { type: 'chars', charsClass: 'ch' });
  const t2 = new window.SplitText($('.t2', title), { type: 'words', wordsClass: 'ch' });
  title.classList.add('go');
  const tl = gsap.timeline();
  document.documentElement.classList.add('hero-go');   // the from() tweens below hide each part in this same frame
  tl.from(np.chars, { x: '-1.4em', opacity: 0, duration: 1, ease: 'expo.out', stagger: { each: .05, from: 'end' } }, 0)
    .fromTo(np.chars[np.chars.length - 1], { scaleX: 1 }, { scaleX: .72, transformOrigin: '100% 60%', duration: .08, ease: 'power1.out', yoyo: true, repeat: 1 }, .32)
    .from(pen.chars, { yPercent: 70, opacity: 0, duration: .8, ease: 'expo.out', stagger: .022 }, .18)
    .from(t2.words, { yPercent: 60, opacity: 0, duration: .9, ease: 'expo.out', stagger: .08 }, .32)
    .from('.hero-side > *', { y: 18, opacity: 0, duration: .8, ease: 'expo.out', stagger: .07 }, .5)
    .from('.h-media', { y: 60, opacity: 0, duration: 1.1, ease: 'expo.out' }, .55);
  heroApi.ready.then(({ setCut }) => {
    const o = { c: 98 };
    setCut(98);
    gsap.to(o, { c: 50, duration: 1.7, delay: Math.max(0, .9 - tl.time()), ease: 'expo.out', onUpdate: () => setCut(o.c) });
  });
}

// ---------- section headlines: the wall rises, the words glide in from the right and stop against it
function headings(wide) {
  const gsap = G();
  for (const h of $$('.head h2')) {
    const split = new window.SplitText(h, { type: 'words', wordsClass: 'w' });
    const lede = h.parentElement.querySelector('.lede'), eb = h.parentElement.querySelector('.eyebrow');
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(h, { '--bar': 0 }, { '--bar': 1, duration: .5, ease: 'expo.out' }, 0)
      .from(split.words, { x: (i) => (wide ? 140 : 60) + i * (wide ? 26 : 12), opacity: 0, duration: 1.05, ease: 'expo.out', stagger: .06 }, .12)
      .fromTo(h, { '--wd': '100%' }, { '--wd': '93%', duration: .07, ease: 'power1.out', yoyo: true, repeat: 1 }, .42);
    if (eb) tl.from(eb, { opacity: 0, x: -10, duration: .6, ease: 'expo.out' }, 0);
    if (lede) tl.from(lede, { opacity: 0, y: 18, duration: .9, ease: 'expo.out' }, .45);
    window.ScrollTrigger.create({ trigger: h, start: 'top 88%', once: true, onEnter: () => tl.play() });
  }
}

// ---------- blocks rise into place as they come on screen (batched, once)
function rises() {
  const gsap = G();
  const sel = ['.controls:not(.stage-controls)', '.split > *', '.knows > *', '.findings .finding', '.mfig', '.mpoints > li', '.mmodes', 'details.math', '.tasks .task',
    '.filters', '#bench-stats', '.chartbox', '#cmp-grid', '.cmp-below > *', '.play-wrap > *', '.bib', '.abstract', '.foot-grid'].join(',');
  const els = $$(sel).filter(e => !e.closest('.st-pin, .t3-pin'));
  gsap.set(els, { opacity: 0, y: 36 });
  window.ScrollTrigger.batch(els, { start: 'top 92%', once: true,
    onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: .95, ease: 'expo.out', stagger: .07, overwrite: true, clearProps: 'transform' }) });
}

// ---------- 74% -> 16%: pinned and scrubbed on wide screens, played once on phones
async function statement(wide, ctx) {
  const gsap = G();
  await ready('#num-bars .b');
  ctx.add(() => statementBuild(wide));      // built after its data arrives, but still owned by the matchMedia context
  window.ScrollTrigger.sort(); window.ScrollTrigger.refresh();
}
function statementBuild(wide) {
  const gsap = G();
  const pin = $('.st-pin'), big = $('#num-headline .big'), from = $('.from', big), to = $('.to', big), wall = $('.arrow', big);
  const bars = $$('#num-bars .b');
  const minis = $$('.st-minis .mini');
  const A = Number(from.dataset.count), B = Number(to.dataset.count);
  const nA = { v: 0 }, nB = { v: A };
  const tl = gsap.timeline(wide
    ? { scrollTrigger: { trigger: pin, start: `top top+=${HEADER + 24}`, end: '+=130%', pin: true, scrub: .6, anticipatePin: 1 } }
    : { scrollTrigger: { trigger: pin, start: 'top 70%', toggleActions: 'play none none none' } });
  gsap.set(to, { opacity: 0, x: 90 }); gsap.set(wall, { scaleY: 0 });
  tl.to(nA, { v: A, duration: 1, ease: 'power2.out', onUpdate: () => { from.textContent = Math.round(nA.v) + '%'; } }, 0);
  bars.forEach((b, i) => {
    const o = $('i.o', b), r = $('i.r', b), vo = $('.vo', b), vr = $('.vr', b);
    const raw = Number(b.dataset.raw), ours = Number(b.dataset.ours);
    const val = { v: 0 };
    gsap.set(o, { height: '0%', backgroundColor: '#d33a2c' }); gsap.set([r, vr], { opacity: 0 }); gsap.set(vo, { bottom: '0%', color: '#d33a2c' }); vo.textContent = '0';
    tl.to(o, { height: raw + '%', duration: 1, ease: 'power2.out' }, i * .05)
      .to(vo, { bottom: raw + '%', duration: 1, ease: 'power2.out' }, i * .05)
      .to(val, { v: raw, duration: 1, ease: 'power2.out', onUpdate: () => { vo.textContent = Math.round(val.v); } }, i * .05);
    const t0 = 1.9 + i * .08;
    tl.to([r, vr], { opacity: 1, duration: .3 }, t0)
      .to(o, { height: Math.max(1.2, ours) + '%', backgroundColor: '#1e9e5a', duration: 1.2, ease: 'power3.inOut' }, t0)
      .to(vo, { bottom: Math.max(1.2, ours) + '%', color: '#1e9e5a', duration: 1.2, ease: 'power3.inOut' }, t0)
      .to(val, { v: ours, duration: 1.2, ease: 'power3.inOut', onUpdate: () => { vo.textContent = Math.round(val.v); } }, t0);
  });
  tl.to(wall, { scaleY: 1, duration: .5, ease: 'expo.out', onComplete: () => { wall.classList.remove('hit'); void wall.offsetWidth; wall.classList.add('hit'); } }, 1.4)
    .to(to, { opacity: 1, x: 0, duration: 1.1, ease: 'expo.out' }, 1.8)
    .to(nB, { v: B, duration: 1.3, ease: 'power3.inOut', onUpdate: () => { to.textContent = Math.round(nB.v) + '%'; } }, 1.9)
    .from(minis, { opacity: 0, y: 40, duration: .9, ease: 'expo.out', stagger: .12 }, 3.3);
  if (wide) tl.to({}, { duration: .6 });   // a short hold at the end of the pin
}

// ---------- dark sections: a slab that widens to full bleed as it arrives, and narrows again as it leaves
function theaters() {
  const gsap = G();
  for (const s of $$('.theater.dark')) {
    gsap.timeline({ scrollTrigger: { trigger: s, start: 'top bottom', end: 'top 20%', scrub: true } })
      .fromTo(s, { '--ts': .95, '--tr': '44px' }, { '--ts': 1, '--tr': '0px', ease: 'none' });
    gsap.timeline({ scrollTrigger: { trigger: s, start: 'bottom 80%', end: 'bottom top', scrub: true } })
      .fromTo(s, { '--ts': 1, '--tr': '0px' }, { '--ts': .95, '--tr': '44px', ease: 'none', immediateRender: false });
  }
}

// ---------- hero on scroll (wide): the stage grows to its full width, the title drifts up
function heroScroll() {
  const gsap = G();
  gsap.fromTo('.h-media', { scale: .9 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.h-media', start: 'top 92%', end: 'top 18%', scrub: true } });
  gsap.fromTo('.hero-top', { y: 0, opacity: 1 }, { y: -70, opacity: .25, ease: 'none', scrollTrigger: { trigger: '.hero-top', start: 'top top+=60', end: 'bottom top', scrub: true } });
}

// ---------- mode switches: a wall sweeps the grid, every tile flashes as it passes, verdict chips scramble into place
function sweeps() {
  const gsap = G();
  const host = $('#problem .sweep-host'), bar = host && $('.sweep', host);
  if (bar) $$('#prob-mode button').forEach(b => b.addEventListener('click', () => {
    const tiles = $$('#prob-grid .tile'), W = host.clientWidth;
    gsap.killTweensOf(bar);
    gsap.timeline().set(bar, { opacity: 1, left: 0 }).to(bar, { left: W, duration: 1, ease: 'power2.inOut' }).to(bar, { opacity: 0, duration: .25 });
    tiles.forEach(t => { const x = t.offsetLeft + t.offsetWidth / 2; gsap.fromTo(t, { filter: 'brightness(1.9) saturate(.3)' }, { filter: 'brightness(1) saturate(1)', duration: .7, delay: .1 + .9 * x / W, ease: 'power2.out', clearProps: 'filter' }); });
  }));
  if (!window.ScrambleTextPlugin) return;
  const scramble = (c) => { const txt = c.textContent; if (!txt || c.dataset.scr) return; c.dataset.scr = '1'; gsap.to(c, { duration: .7, scrambleText: { text: txt, chars: 'ABCDEFGHIKLMNOPRSTUVWXYZ', speed: .8, revealDelay: .15 } }); };
  for (const sel of ['#prob-grid', '#cmp-grid', '#knows-tile', '#prob-unreal']) {
    const root = $(sel); if (!root) continue;
    new MutationObserver((ms) => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) (n.matches('.chip') ? [n] : $$('.chip', n)).forEach(scramble); }))).observe(root, { childList: true, subtree: true });
  }
}

// ---------- Task 3 (wide): the strip of pairs moves sideways while the section is pinned. Two rows when both fit under
// the heading at this window height, else one; the column width comes from the measured space, so no card is cut off.
function strip() {
  const gsap = G(), pin = $('#t3-pin'), track = $('#t3grid');
  if (!pin || !track) return () => {};
  const SLOPE = 9 / 32;                         // a card grows 9/32 px in height per px of width (two 16:9 tiles side by side)
  const fit = () => {
    track.style.gridTemplateRows = ''; track.style.gridAutoColumns = '';
    const card = track.querySelector('.t3:not([hidden])'); if (!card) return;
    const fixed = card.offsetHeight - SLOPE * card.offsetWidth;
    const avail = innerHeight - HEADER - (track.getBoundingClientRect().top - pin.getBoundingClientRect().top) - 18;
    let rows = 2, w = (avail - 14 - 2 * fixed) / (2 * SLOPE);
    if (w < 400) { rows = 1; w = (avail - fixed) / SLOPE; }
    track.style.gridTemplateRows = `repeat(${rows}, auto)`;
    track.style.gridAutoColumns = Math.round(Math.max(300, Math.min(620, w))) + 'px';
  };
  fit();
  window.ScrollTrigger.addEventListener('refreshInit', fit);
  const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
  gsap.to(track, { x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: pin, start: `top top+=${HEADER}`, end: () => '+=' + Math.round(dist() * .62), pin: true, scrub: .5, invalidateOnRefresh: true, anticipatePin: 1 } });
  return () => { window.ScrollTrigger.removeEventListener('refreshInit', fit); track.style.gridTemplateRows = ''; track.style.gridAutoColumns = ''; };
}

// ---------- limits (wide): each card is sticky; the one underneath sinks back as the next slides over it
async function stack(ctx) {
  await ready('#limits-grid .limit');
  ctx.add(stackBuild);
  window.ScrollTrigger.sort(); window.ScrollTrigger.refresh();
}
function stackBuild() {
  const gsap = G(), cards = $$('#limits-grid .limit');
  cards.forEach((c, i) => { c.style.setProperty('--i', i); c.style.zIndex = i + 1; });
  cards.slice(0, -1).forEach((c, i) => {
    // the card stays opaque (a faded card would show the one under it); only its contents dim as it sinks back
    gsap.to(c.children, { opacity: .35, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top 70%', end: `top top+=${HEADER + 40 + (i + 1) * 14}`, scrub: true } });
    window.ScrollTrigger.create({ trigger: cards[i + 1], start: `top top+=${HEADER + 60 + (i + 1) * 14}`, onToggle: (st) => c._group?.setVisible(!st.isActive) });
    gsap.to(c, { scale: .93, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top bottom-=80', end: `top top+=${HEADER + 40 + (i + 1) * 14}`, scrub: true } });
  });
}

// ---------- footer: the last words glide right and stop on the end wall
function footer(wide) {
  const gsap = G();
  gsap.from('.foot-big span', { x: wide ? -260 : -80, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .14, scrollTrigger: { trigger: '.foot-big', start: 'top 88%' } });
}

// ---------- the route marquee: one row drifting slowly at a steady speed (about 36 px/s, not tied to the scroll); it
// stops under the pointer so a poster can be clicked
async function marquee() {
  const gsap = G();
  await ready('#marquee .mq-row button');
  const rows = $$('#marquee .mq-row');
  const tw = rows.map(r => {
    const dir = Number(r.dataset.dir) || 1, duration = Math.max(90, r.scrollWidth / 2 / 36);
    return dir > 0 ? gsap.fromTo(r, { xPercent: 0 }, { xPercent: -50, duration, ease: 'none', repeat: -1 })
      : gsap.fromTo(r, { xPercent: -50 }, { xPercent: 0, duration, ease: 'none', repeat: -1 });
  });
  window.ScrollTrigger.create({ trigger: '#marquee', start: 'top bottom', end: 'bottom top', onToggle: (s) => tw.forEach(t => s.isActive ? t.resume() : t.pause()) });
  $('#marquee').addEventListener('pointerenter', () => tw.forEach(t => gsap.to(t, { timeScale: 0, duration: .3, overwrite: true })));
  $('#marquee').addEventListener('pointerleave', () => tw.forEach(t => gsap.to(t, { timeScale: 1, duration: .5, overwrite: true })));
}

export function initMotion(lenis) {
  const gsap = G();
  const d = document.documentElement;
  if (!gsap || !window.ScrollTrigger) { d.classList.remove('intro-on'); d.classList.add('hero-go'); $('#title')?.classList.add('go'); return; }
  const plugins = [window.ScrollTrigger, window.SplitText, window.Flip, window.DrawSVGPlugin, window.ScrambleTextPlugin].filter(Boolean);
  gsap.registerPlugin(...plugins);
  if (reduceMotion) { d.classList.remove('intro-on'); d.classList.add('hero-go'); $('#title')?.classList.add('go'); return; }
  intro(heroIn);
  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 961px)', narrow: '(max-width: 960px)' }, (ctx) => {
    const { wide } = ctx.conditions;
    headings(wide); rises(); statement(wide, ctx); theaters(); footer(wide);
    let undo = null;
    if (wide) { heroScroll(); undo = strip(); }        // the limits sit side by side now (no stacking)
    return () => { if (undo) undo(); };
  });
  addEventListener('nope:layout', () => { window.ScrollTrigger.sort(); window.ScrollTrigger.refresh(); });
  sweeps(); marquee(lenis);
  // pins change the page height: measure again when late content arrives
  let t = 0; const refresh = () => { clearTimeout(t); t = setTimeout(() => { window.ScrollTrigger.sort(); window.ScrollTrigger.refresh(); }, 120); };
  addEventListener('load', refresh); if (document.fonts) document.fonts.ready.then(refresh);
}
