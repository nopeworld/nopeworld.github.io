// The opening: Platform 9¾. Once per tab session (the <head> script sets html.intro-on), never with reduced motion.
// One GSAP timeline (window.hpIntro, so it can be stepped frame by frame):
//   0.0 s  the camera runs at a brick wall under a Platform 9¾ sign, pushing a trolley
//   0.5 s  like a raw world model, an arch of light opens in the bricks
//   1.4 s  NoPe: the arch shuts, the camera stops on the bricks with a jolt, a brass stamp lands
//   2.3 s  the view shrinks into the comparison (the clip at 5 s: NoPeWorld at the bricks, the raw model going through),
//          the stamp flies onto the ticket, the title glides to its gold wall, the wipe opens to the middle
// Where the stage is not wholly on screen (phones) the view dissolves instead. A click, a key or a scroll skips it.
// Without the intro the page's own entrance runs (motion.js heroIn) and the ticket slides in.
import { $, el, onVisible } from './util.js';
import { heroApi } from './hero.js';
import { noOrphans } from './ui.js';

const d = document.documentElement;
const CLIP0 = 5.0;

// the slogan fitted (no one-word last line) once the fonts are in, so the stage's place is final before the intro measures it
const ready = () => (document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 500))]) : Promise.resolve()).then(() => { noOrphans('.tagline'); });

// gold sparks rising along the wipe's wall; the hero's steam and sparks pause off screen
function extras() {
  heroApi.ready.then(() => {
    const h = $('#hero-stage .handle'); if (!h || h.querySelector('.hp-spark')) return;
    [[10, 2.6, -.3, 7], [26, 2.2, -1.4, -8], [42, 2.9, -.8, 9], [58, 2.4, -2, -6], [74, 2.7, -1.1, 8], [90, 2.1, -1.7, -7]]
      .forEach(([y, du, dl, dx]) => h.append(el('i', { class: 'hp-spark', style: `--y:${y}%;--d:${du}s;--dl:${dl}s;--dx:${dx}px` })));
  });
  const top = $('#top'); onVisible(top, (v) => top.classList.toggle('hp-paused', !v), 0);
}

// the wipe glides from the left edge to the middle; the stage's own --cut is tweened, hero.js's setter keeps the handle in step
function openWipe(tl, at) {
  const stage = $('#hero-stage');
  tl.fromTo(stage, { '--cut': '2%' }, { '--cut': '50%', duration: 1.7, ease: 'expo.out', immediateRender: false,
    onUpdate: () => heroApi.setCut && heroApi.setCut(parseFloat(stage.style.getPropertyValue('--cut'))) }, at);
}

// the title glides to its gold wall and stops (motion.js heroIn's grammar, on this timeline)
function titleIn(tl, at) {
  const SplitText = window.SplitText, title = $('#title');
  if (!SplitText) { title.classList.add('go'); return; }
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

function intro() {
  const gsap = window.gsap;
  try { sessionStorage.setItem('nope-intro', '1'); } catch (e) { /* storage blocked */ }
  const ov = $('#hp-intro'), cam = $('.hp-cam', ov), wall = $('.hp-wall', ov), arch = $('.hp-arch', ov), burst = $('.hp-burst', ov), flash = $('.hp-flash', ov);
  const trolley = $('.hp-trolley', ov), raw = $('.hp-chip.raw', ov), ours = $('.hp-chip.ours', ov), hud = $('.hp-hud', ov), stamp = $('#hp-stamp'), skip = $('.hp-skip', ov);
  const stage = $('#hero-stage'), ticket = $('.hp-ticket'), tkStamp = $('.tk-stamp');
  ov.style.animation = 'none';                 // the CSS safety timeout is for a page whose scripts failed
  scrollTo(0, 0);
  heroApi.ready.then(({ setCut }) => { if (!ended) setCut(2); });   // the stage starts as all wall (the NoPeWorld side)
  d.classList.add('hero-go');
  const S = 1.28;                              // how close the camera gets
  gsap.set(wall, { scale: .56 });
  gsap.set(arch, { scale: .25, opacity: 0, transformOrigin: '50% 100%' });
  gsap.set([raw, ours], { y: -8, opacity: 0 });
  gsap.set(stamp, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: -16, scale: 2.3, opacity: 0 });
  gsap.set(trolley, { xPercent: -50, x: 0, y: 0 });
  gsap.set(cam, { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px round 0px)' });
  gsap.set([ticket, tkStamp], { opacity: 0 });

  // where the view lands: the stage's rectangle (uniform scale, clipped to its 16:9 and rounded corners); a dissolve if
  // the stage is not wholly on screen
  let G = null, L = null;
  const geo = () => G || (G = (() => {
    const r = stage.getBoundingClientRect(), W = ov.clientWidth, H = ov.clientHeight;
    const R = parseFloat(getComputedStyle(stage).borderTopLeftRadius) || 24;
    if (r.top < 0 || r.top > H * .62) return { x: W * .04, y: H * .04, k: .92, fade: true, clip: `inset(0px 0px 0px 0px round ${R.toFixed(2)}px)` };
    const k = Math.max(r.width / W, r.height / H);
    const x = r.left + r.width / 2 - k * W / 2, y = r.top + r.height / 2 - k * H / 2;
    const t = (r.top - y) / k, l = (r.left - x) / k, b = H - (r.bottom - y) / k, rr = W - (r.right - x) / k;
    return { x, y, k, fade: false, clip: `inset(${t.toFixed(2)}px ${rr.toFixed(2)}px ${b.toFixed(2)}px ${l.toFixed(2)}px round ${(R / k).toFixed(2)}px)` };
  })());
  // where the stamp lands: the ticket's own stamp (same size, same angle)
  const land = () => L || (L = (() => {
    const b = tkStamp.getBoundingClientRect(), cx = ov.clientWidth * .5, cy = ov.clientHeight * .53;
    const k = tkStamp.firstElementChild.offsetWidth / stamp.firstElementChild.offsetWidth;
    return { x: b.left + b.width / 2 - cx, y: b.top + b.height / 2 - cy, k, r: gsap.getProperty(tkStamp, 'rotation') + gsap.getProperty(ticket, 'rotation') };
  })());

  let ended = false;
  const done = () => {
    if (ended) return; ended = true;
    ['keydown', 'wheel', 'touchmove'].forEach(t => removeEventListener(t, skipIt));
    d.classList.remove('intro-on'); ov.remove();
  };
  const tl = gsap.timeline({ paused: true, onComplete: done });
  const skipIt = () => { if (!ended) { tl.progress(1); done(); } };

  // 1. the run at the wall, accelerating; the trolley bobs with the stride
  tl.to(wall, { scale: S, duration: 1.4, ease: 'power2.in' }, 0)
    .to(trolley, { y: -5, duration: .175, ease: 'sine.inOut', yoyo: true, repeat: 7 }, 0)
    .fromTo(hud, { opacity: 0 }, { opacity: 1, duration: .3 }, .05)
  // 2. a raw world model would go through: an arch of light opens in the bricks
    .to(raw, { opacity: 1, y: 0, duration: .3, ease: 'power2.out' }, .55)
    .to(arch, { opacity: 1, duration: .2, ease: 'power1.out' }, .5)
    .to(arch, { scale: 1, duration: .9, ease: 'power1.in' }, .5)
  // 3. NoPe: the arch shuts, the camera stops on the bricks with a jolt, the stamp lands
    .add('hit', 1.4)
    .to(arch, { scaleX: .15, opacity: 0, duration: .14, ease: 'power3.out' }, 'hit')
    .fromTo(flash, { opacity: .7 }, { opacity: 0, duration: .5, ease: 'power2.out', immediateRender: false }, 'hit')
    .fromTo(burst, { scale: .3, opacity: .7 }, { scale: 1.6, opacity: 0, duration: .9, ease: 'power2.out', immediateRender: false }, 'hit')
    .to(wall, { scale: S * .985, duration: .09, ease: 'power2.out' }, 'hit')
    .to(wall, { scale: S, duration: .35, ease: 'power2.out' }, 'hit+=.09')
    .to(cam, { keyframes: [{ x: -10, duration: .05 }, { x: 8, duration: .07 }, { x: -4, duration: .07 }, { x: 0, duration: .12 }], ease: 'none' }, 'hit')
    .to(trolley, { y: 7, duration: .07, ease: 'power2.out' }, 'hit')
    .to(trolley, { y: 0, duration: .45, ease: 'power3.out' }, 'hit+=.07')
    .to(stamp, { opacity: 1, scale: 1, rotation: -8, duration: .34, ease: 'power4.out' }, 'hit')
    .to(raw, { opacity: .5, '--strike': 1, duration: .25 }, 'hit')                 // the raw model's way, struck out
    .to(ours, { opacity: 1, y: 0, duration: .32, ease: 'power2.out' }, 'hit+=.12')
  // 4. the wall becomes the comparison
    .add('morph', 2.3)
    .call(() => heroApi.group && heroApi.group.seek(CLIP0), null, 'morph')
    .to(cam, { opacity: () => (geo().fade ? 0 : 1), duration: .6, ease: 'power2.in' }, 'morph+=.1')
    .to(cam, { x: () => geo().x, y: () => geo().y, scale: () => geo().k, clipPath: () => geo().clip, duration: .85, ease: 'expo.inOut' }, 'morph')
    .to([raw, ours, hud, skip], { opacity: 0, duration: .3 }, 'morph')
    .to(ov, { backgroundColor: 'rgba(13, 9, 7, 0)', duration: .5, ease: 'power2.inOut' }, 'morph+=.15')
    .set(ov, { pointerEvents: 'none' }, 'morph+=.3')
    .to(ticket, { opacity: 1, duration: .45, ease: 'power2.out' }, 'morph+=.1')
    .to(stamp, { x: () => land().x, y: () => land().y, scale: () => land().k, rotation: () => land().r, duration: .85, ease: 'expo.inOut' }, 'morph')
    .set(tkStamp, { opacity: 1 }, 'morph+=.85')
    .set(stamp, { opacity: 0 }, 'morph+=.85')
    .to(cam, { opacity: 0, duration: .4, ease: 'power1.inOut' }, 'morph+=.8')
    .set(ov, { display: 'none' }, 'morph+=1.25');
  titleIn(tl, 2.5);
  openWipe(tl, 'morph+=1.0');

  ov.addEventListener('click', skipIt);
  ['keydown', 'wheel', 'touchmove'].forEach(t => addEventListener(t, skipIt, { passive: true }));
  window.hpIntro = tl; window.hpHero = heroApi;                    // for scripts/shoot_intro.py (steps it frame by frame)
  window.hpClipAt = (t) => (t < 2.3 ? CLIP0 : (CLIP0 + t - 2.3) % ((heroApi.group && heroApi.group.duration) || 8.06));
  ready().then(() => { if (!window.hpHold) tl.play(); });
}

export function opening(heroIn) {
  extras();
  if (d.classList.contains('intro-on') && $('#hp-intro')) { intro(); return; }
  heroIn();
  const gsap = window.gsap;
  gsap.timeline().from('.hp-ticket', { opacity: 0, x: 50, rotation: 7, duration: 1, ease: 'expo.out' }, .35)
    .from('.tk-stamp', { opacity: 0, scale: 2.2, duration: .35, ease: 'power4.out' }, 1.1);
}
