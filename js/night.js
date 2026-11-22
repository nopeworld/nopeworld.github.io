// Night View effects, started by theme.js when Night View is on and stopped when it is off. Two canvases:
//  - the sky, behind the page: stars at three depths that drift with the scroll (and streak when it is fast), a crescent
//    moon that crosses the sky as the page is read, a shooting star now and then;
//  - the dust, above the page: a wand for a pointer with a trail of gold dust and a burst on a click; a spell when a
//    comparison is switched (a wand flick, a beam of dust onto the videos, a burst, a sheen across them); dust written
//    under each heading as it arrives; sparks shed by the hero's wipe as it moves, with a wand riding it when it opens.
// Cards get a sheen of light as they arrive. Reduced motion: a still sky, nothing else. Everything runs on one clock;
// with window.hpStill set the loop does not run and window.hpFx.advance(ms) steps it (for exact screenshots).
import { $, $$, reduceMotion } from './util.js';

const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const SPELLS = [                // a comparison switch, and what it changes
  ['#hero-seeds button', '#hero-stage'], ['#prob-mode button', '#prob-grid'], ['#knows-mode button', '#knows-tile'], ['#knows-route button', '#knows-tile'],
  ['#method-modes button', '#method-fig'], ['#rview button', '#results .chartbox'], ['#cmp-mode button', '#cmp-grid'], ['#cmp-gen button', '#cmp-grid'],
  ['#casebar button', '#cmp-grid'], ['#v-gen button', '#viewer'], ['#filters button', '#viewer'], ['#open .seg button', '#t3-block'],
];
const SPEED = [.035, .085, .17];  // parallax per star depth

let S = null;                    // state while on
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = (u) => 1 - Math.pow(1 - u, 3);

function canvas(cls, z) {
  const c = document.createElement('canvas'); c.className = cls; c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: z });
  document.body.prepend(c); return c;
}

function sprite() {              // a soft dot in the page's yellow (--wall, #f2c200), drawn additively
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,248,206,1)'); r.addColorStop(.22, 'rgba(242,194,0,.95)'); r.addColorStop(.55, 'rgba(242,194,0,.3)'); r.addColorStop(1, 'rgba(242,194,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 32, 32); return c;
}

function resize() {
  const W = innerWidth, H = innerHeight, dpr = Math.min(1.5, devicePixelRatio || 1);
  Object.assign(S, { W, H, dpr });
  for (const c of [S.sky, S.dustC]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  // the night's colour, the hero's: brick-brown dark, a gaslight glow above, an ember haze, a deep red one
  const bg = S.bg = document.createElement('canvas'); bg.width = S.sky.width; bg.height = S.sky.height;
  const g = bg.getContext('2d'); g.scale(dpr, dpr);
  const lin = g.createLinearGradient(0, 0, 0, H); lin.addColorStop(0, '#22160e'); lin.addColorStop(.55, '#170f0a'); lin.addColorStop(1, '#0e0906');
  g.fillStyle = lin; g.fillRect(0, 0, W, H);
  for (const [x, y, r, c] of [[.5, -.05, .6, 'rgba(255,170,80,.12)'], [.15, .55, .55, 'rgba(150,50,30,.13)'], [.85, .8, .6, 'rgba(240,160,60,.08)']]) {
    const rg = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * Math.max(W, H)); rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  const n = Math.max(120, Math.min(420, Math.round(W * H / 5200)));
  S.stars = Array.from({ length: n }, () => { const l = Math.random() < .55 ? 0 : Math.random() < .7 ? 1 : 2;
    return { x: rnd(0, W), y: rnd(0, H), l, r: [rnd(.4, .8), rnd(.7, 1.15), rnd(1, 1.7)][l], a: rnd(.35, .95), tw: rnd(.6, 2.6), ph: rnd(0, 6.3), gold: Math.random() < .45 }; });
  S.moon = document.createElement('canvas'); S.phase = -1; S.moonTo = null;
}

// the moon: a crescent that waxes as the page is read (redrawn when its phase moves on)
function moonImage(p) {
  const k = Math.round(p * 30); if (k === S.phase) return S.moon; S.phase = k;
  const R = 20, dpr = S.dpr, m = S.moon; m.width = m.height = Math.round((R * 2 + 4) * dpr);
  const mg = m.getContext('2d'); mg.scale(dpr, dpr);
  const md = mg.createRadialGradient(R - 4, R - 2, 2, R + 2, R + 2, R); md.addColorStop(0, '#fff8d8'); md.addColorStop(1, '#f2d35a');
  mg.fillStyle = md; mg.beginPath(); mg.arc(R + 2, R + 2, R, 0, 7); mg.fill();
  mg.globalCompositeOperation = 'destination-out'; mg.beginPath(); mg.arc(R + 2 + 9 + 26 * k / 30, R + 2 - 6 * (1 - k / 30), R - 1, 0, 7); mg.fill();
  return m;
}
// the moon keeps to clear sky: a spot in the side margins whose surroundings hold no text or media (checked as the
// page moves under it). Where there is none (narrow screens, wide blocks) it fades out; it reappears at a new spot
// instead of crossing the text.
const FREE = 'html, body, main, section, footer, .wrap, .st-pin, .theater';
const RING = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-.7, -.7], [.7, .7], [.7, -.7], [-.7, .7]];
function clearAt(x, y, r) {
  for (const [dx, dy] of RING) { const e = document.elementFromPoint(x + dx * r, y + dy * r); if (e && !e.matches(FREE)) return false; }
  return true;
}
function placeMoon() {
  const { W, H } = S, y = S.moonY = Math.round(Math.max(120, H * .15)), r = 31;      // the disc (22) and a little air
  if (W < 760) return null;
  if (S.moonTo != null && clearAt(S.moonTo, y, r)) return S.moonTo;
  for (let x = W - 44; x > W * .66; x -= 26) if (clearAt(x, y, r)) return x;
  for (let x = 44; x < W * .34; x += 26) if (clearAt(x, y, r)) return x;
  return null;
}
function moonStep(dt) {
  if (S.clock - (S.placedAt ?? -1e9) > (Math.abs(S.vel) > .01 ? 0 : 250)) { S.moonTo = placeMoon(); S.placedAt = S.clock; }
  const to = S.moonTo, a = S.moonA || 0;
  if (to == null || (S.moonX != null && Math.abs(to - S.moonX) > 60 && a > .02)) S.moonA = Math.max(0, a - dt / 120);   // out (and over there)
  else { if (S.moonX == null || a <= .02) S.moonX = to; S.moonX += (to - S.moonX) * .2; S.moonA = Math.min(1, a + dt / 420); }
}

// ---------- the sky
function drawSky(dt = 16) {
  const { sc, W, H, dpr, clock } = S, y = scrollY, still = reduceMotion;
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.drawImage(S.bg, 0, 0); sc.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the moon, in clear sky only
  moonStep(still ? 1000 : dt);
  if (S.moonA > .01 && S.moonX != null) {
    const p = Math.min(1, y / Math.max(1, document.documentElement.scrollHeight - H)), mx = S.moonX, my = S.moonY;
    sc.globalAlpha = S.moonA;
    const glow = sc.createRadialGradient(mx, my, 4, mx, my, 44); glow.addColorStop(0, 'rgba(242,194,0,.22)'); glow.addColorStop(1, 'rgba(242,194,0,0)');
    sc.fillStyle = glow; sc.fillRect(mx - 44, my - 44, 88, 88);
    sc.drawImage(moonImage(p), mx - 22, my - 22, 44, 44); sc.globalAlpha = 1;
  }
  // stars: drift with the scroll at their depth, streak when it is fast
  for (const s of S.stars) {
    const sp = SPEED[s.l], sy = ((s.y - y * sp) % H + H) % H;
    const tw = still ? 1 : .62 + .38 * Math.sin(clock / 1000 * s.tw + s.ph);
    const a = s.a * tw, streak = still ? 0 : Math.max(-70, Math.min(70, S.vel * sp * 55));
    sc.fillStyle = s.gold ? `rgba(242,194,0,${a})` : `rgba(255,238,168,${a})`;
    if (Math.abs(streak) > 1.5) {
      sc.strokeStyle = sc.fillStyle; sc.lineWidth = s.r * 1.4; sc.lineCap = 'round';
      sc.beginPath(); sc.moveTo(s.x, sy); sc.lineTo(s.x, sy + streak); sc.stroke();
    } else { sc.beginPath(); sc.arc(s.x, sy, s.r, 0, 7); sc.fill(); }
    if (s.l === 2 && tw > .88) {     // the brightest catch a cross of light
      sc.strokeStyle = `rgba(255,236,150,${(tw - .88) * 4 * s.a})`; sc.lineWidth = .7;
      sc.beginPath(); sc.moveTo(s.x - 5, sy); sc.lineTo(s.x + 5, sy); sc.moveTo(s.x, sy - 5); sc.lineTo(s.x, sy + 5); sc.stroke();
    }
  }
  // a shooting star
  const sh = S.shoot;
  if (sh) {
    const u = (clock - sh.t0) / sh.dur;
    if (u >= 1) S.shoot = null;
    else {
      const hx = sh.x + sh.vx * (clock - sh.t0), hy = sh.y + sh.vy * (clock - sh.t0), tx = hx - sh.vx * 140, ty = hy - sh.vy * 140;
      const al = Math.sin(Math.PI * u), gr = sc.createLinearGradient(hx, hy, tx, ty);
      gr.addColorStop(0, `rgba(255,246,200,${al})`); gr.addColorStop(1, 'rgba(242,194,0,0)');
      sc.strokeStyle = gr; sc.lineWidth = 1.6; sc.lineCap = 'round'; sc.beginPath(); sc.moveTo(hx, hy); sc.lineTo(tx, ty); sc.stroke();
      sc.globalCompositeOperation = 'lighter'; sc.globalAlpha = al; sc.drawImage(S.dot, hx - 6, hy - 6, 12, 12); sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
    }
  }
}
function shootingStar() {
  S.shoot = { t0: S.clock, dur: 900, x: S.W * rnd(.35, .95), y: S.H * rnd(.04, .35), vx: -rnd(.7, 1.1), vy: rnd(.25, .45) };
}

// ---------- dust
function dust(x, y, o = {}) {
  S.parts.push({ x, y, vx: o.vx ?? rnd(-.03, .03), vy: o.vy ?? rnd(-.05, .02), g: o.g ?? .00012, t: 0, dur: o.dur ?? rnd(500, 950), s: o.s ?? rnd(2.5, 5.5), star: o.star ?? Math.random() < .12 });
}
function burst(x, y, n = 18, spread = .22) {
  for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(.04, spread); dust(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - .03, dur: rnd(500, 1100), s: rnd(2.5, 6), star: Math.random() < .3 }); }
}
function drawDust(dt) {
  const { fc } = S;
  fc.globalCompositeOperation = 'lighter';
  S.parts = S.parts.filter(p => (p.t += dt) < p.dur);
  for (const p of S.parts) {
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    const u = p.t / p.dur, a = u < .15 ? u / .15 : 1 - (u - .15) / .85, s = p.s * (1 - .5 * u);
    fc.globalAlpha = a; fc.drawImage(S.dot, p.x - s, p.y - s, 2 * s, 2 * s);
    if (p.star) { fc.strokeStyle = `rgba(255,240,170,${a * .9})`; fc.lineWidth = .8; fc.beginPath(); fc.moveTo(p.x - s * 1.6, p.y); fc.lineTo(p.x + s * 1.6, p.y); fc.moveTo(p.x, p.y - s * 1.6); fc.lineTo(p.x, p.y + s * 1.6); fc.stroke(); }
  }
  fc.globalAlpha = 1; fc.globalCompositeOperation = 'source-over';
}

// a plain wand (drawn, generic): handle end (x, y), pointing at angle ang; the tip glows
function wand(x, y, ang, alpha, glow = 1, L = 78, k = 1) {
  const { fc } = S, c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c;
  const P = (t, w) => [x + c * t * L + nx * w * k, y + s * t * L + ny * w * k];
  fc.save(); fc.globalAlpha = alpha;
  const shaft = [P(0, 3.2), P(.3, 2.8), P(1, 1.1), P(1, -1.1), P(.3, -2.8), P(0, -3.2)];
  fc.fillStyle = 'rgba(10,6,3,.55)'; fc.beginPath(); [P(0, 4.6), P(.3, 4.1), P(1, 2.2), P(1, -2.2), P(.3, -4.1), P(0, -4.6)].forEach(([px, py], i) => i ? fc.lineTo(px, py) : fc.moveTo(px, py)); fc.closePath(); fc.fill();
  const gr = fc.createLinearGradient(x, y, x + c * L, y + s * L); gr.addColorStop(0, '#2b170b'); gr.addColorStop(.3, '#4a2b16'); gr.addColorStop(1, '#7a4e2c');
  fc.fillStyle = gr; fc.beginPath(); shaft.forEach(([px, py], i) => i ? fc.lineTo(px, py) : fc.moveTo(px, py)); fc.closePath(); fc.fill();
  fc.strokeStyle = 'rgba(255,220,170,.25)'; fc.lineWidth = .8; fc.beginPath(); fc.moveTo(...P(.32, -1.6)); fc.lineTo(...P(.97, -.5)); fc.stroke();
  fc.strokeStyle = '#e0b04a'; fc.lineWidth = 2 * k; for (const t of [.27, .31]) { fc.beginPath(); fc.moveTo(...P(t, 3.1)); fc.lineTo(...P(t, -3.1)); fc.stroke(); }
  const [tx, ty] = P(1, 0), g = 14 * glow * k;
  fc.globalCompositeOperation = 'lighter'; fc.drawImage(S.dot, tx - g, ty - g, 2 * g, 2 * g);
  fc.restore();
  return [tx, ty];
}

// a spell: a wand flicks beside the switch, a beam of dust arcs onto what it changes, a burst, a sheen across it
function spell(btn, target) {
  if (!btn || !target) return;
  const b = btn.getBoundingClientRect();
  S.fx.push({ t0: S.clock, dur: 1500, kind: 'spell', bx: b.left + b.width / 2, by: b.top, target, fired: false });
}
function drawSpell(f, t) {
  const r = f.target.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const hx = f.bx + 70, hy = f.by - 64;                          // the hand holds the wand above and right of the switch
  const aim = Math.atan2(cy - hy, cx - hx);
  const flick = t < 260 ? -.9 + .95 * ease(t / 260) : .05;       // raised, then flicked toward the target
  const fade = t < 900 ? 1 : Math.max(0, 1 - (t - 900) / 350);
  const [tx, ty] = wand(hx, hy, aim + flick - .25, Math.min(1, t / 120) * fade, t > 200 && t < 650 ? 1.8 : 1.1, 118, 1.5);
  // the beam: dust along an arc from the tip to the target
  if (t > 200 && t < 760) {
    const u = Math.min(1, (t - 200) / 420), mx = (tx + cx) / 2, my = Math.min(ty, cy) - 90, fade = t < 620 ? 1 : 1 - (t - 620) / 140;
    const Q = (v) => [(1 - v) * (1 - v) * tx + 2 * (1 - v) * v * mx + v * v * cx, (1 - v) * (1 - v) * ty + 2 * (1 - v) * v * my + v * v * cy];
    // the beam itself: a wide faint arc and a thin bright one, up to its leading point
    const fc = S.fc; fc.save(); fc.globalCompositeOperation = 'lighter'; fc.lineCap = 'round';
    const arc = () => { fc.beginPath(); for (let k = 0; k <= 28; k++) { const [px, py] = Q(Math.max(0, u - .6) + (u - Math.max(0, u - .6)) * k / 28); k ? fc.lineTo(px, py) : fc.moveTo(px, py); } };
    fc.strokeStyle = `rgba(40,18,0,${.35 * fade})`; fc.lineWidth = 7; arc(); fc.stroke();             // a dark edge under it
    for (const [w, col] of [[16, `rgba(242,194,0,${.18 * fade})`], [7, `rgba(247,212,64,${.55 * fade})`]]) { fc.strokeStyle = col; fc.lineWidth = w; arc(); fc.stroke(); }
    fc.globalCompositeOperation = 'source-over'; fc.strokeStyle = `rgba(255,253,240,${.95 * fade})`; fc.lineWidth = 2.6; arc(); fc.stroke();
    const [lx, ly] = Q(u); fc.globalCompositeOperation = 'lighter'; fc.drawImage(S.dot, lx - 16, ly - 16, 32, 32);
    fc.restore();
    if (t < 620) for (let i = 0; i < 12; i++) {
      const [px, py] = Q(Math.max(0, u - rnd(0, .3)));
      dust(px + rnd(-5, 5), py + rnd(-5, 5), { dur: rnd(380, 760), s: rnd(3, 6.5), vy: rnd(-.03, .03), star: Math.random() < .2 });
    }
  }
  if (!f.fired && t >= 620) { f.fired = true; burst(cx, cy, 64, .34); for (let i = 0; i < 40; i++) dust(rnd(r.left, r.right), rnd(r.top, r.bottom), { dur: rnd(500, 1100), s: rnd(2.5, 5.5), star: Math.random() < .25 }); }
  if (t > 620 && t < 1100) {                                      // a ring of light where it lands
    const u = (t - 620) / 480, fc = S.fc; fc.save(); fc.globalCompositeOperation = 'lighter';
    const R = 20 + ease(u) * Math.max(r.width, r.height) * .45;
    fc.strokeStyle = `rgba(242,194,0,${.5 * (1 - u)})`; fc.lineWidth = 9 * (1 - u) + 2; fc.beginPath(); fc.arc(cx, cy, R, 0, 7); fc.stroke();
    fc.globalCompositeOperation = 'source-over'; fc.strokeStyle = `rgba(255,248,210,${.85 * (1 - u)})`; fc.lineWidth = 2; fc.beginPath(); fc.arc(cx, cy, R, 0, 7); fc.stroke(); fc.restore();
  }
  // the sheen
  if (t > 580 && t < 1400) {
    const u = (t - 580) / 820, bw = r.width * .35, x = r.left - bw + (r.width + bw) * ease(u), fc = S.fc;
    fc.save(); fc.beginPath(); fc.rect(r.left, r.top, r.width, r.height); fc.clip(); fc.globalCompositeOperation = 'lighter';
    const g = fc.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, 'rgba(242,194,0,0)'); g.addColorStop(.5, `rgba(247,212,64,${.34 * (1 - u)})`); g.addColorStop(1, 'rgba(242,194,0,0)');
    fc.fillStyle = g; fc.fillRect(x, r.top, bw, r.height); fc.restore();
  }
}

// dust written under a heading as it arrives, a small burst at its wall
function write(h) { S.fx.push({ t0: S.clock, dur: 900, kind: 'write', el: h }); }
function drawWrite(f, t) {
  const r = f.el.getBoundingClientRect(), u = Math.min(1, t / 750), x = r.left + r.width * ease(u), y = r.bottom + 6;
  if (t < 760) for (let i = 0; i < 3; i++) dust(x + rnd(-6, 2), y + rnd(-3, 3), { vx: rnd(-.02, .01), vy: rnd(-.04, 0), dur: rnd(450, 850), s: rnd(2, 4) });
  if (t < 60 && !f.b) { f.b = 1; burst(r.left, r.top + r.height / 2, 14, .16); }
}

// the hero's wipe sheds sparks as it moves; when it moves on its own (opening), a wand rides its knob
function wipeSparks() {
  const stage = $('#hero-stage'); if (!stage) return;
  let dragging = false;
  stage.addEventListener('pointerdown', () => { dragging = true; }); addEventListener('pointerup', () => { dragging = false; });
  const mo = new MutationObserver(() => {
    if (!S || reduceMotion) return;
    const r = stage.getBoundingClientRect(), cut = parseFloat(stage.style.getPropertyValue('--cut')) / 100; if (!isFinite(cut) || r.bottom < 0 || r.top > S.H) return;
    const x = r.left + r.width * cut;
    if (S.lastCut != null && Math.abs(cut - S.lastCut) < .002) return;
    S.lastCut = cut;
    for (let i = 0; i < 3; i++) dust(x + rnd(-3, 3), rnd(Math.max(r.top, 0), Math.min(r.bottom, S.H)), { vx: rnd(-.04, .04), dur: rnd(400, 800), s: rnd(2, 4.5) });
    if (!dragging) S.ride = { stage, until: S.clock + 260 };
  });
  mo.observe(stage, { attributes: true, attributeFilter: ['style'] });
  S.off.push(() => mo.disconnect());
}
function drawRide() {
  const rd = S.ride; if (!rd) return;
  const left = rd.until - S.clock, a = left > 0 ? 1 : Math.max(0, 1 + left / 300);
  if (a <= 0) { S.ride = null; return; }
  const r = rd.stage.getBoundingClientRect(), cut = parseFloat(rd.stage.style.getPropertyValue('--cut')) / 100, kx = r.left + r.width * cut, ky = r.top + r.height / 2;
  const ang = Math.PI * .78, L = 78;                              // held from above right, the tip on the knob
  wand(kx - Math.cos(ang) * (L + 26), ky - Math.sin(ang) * (L + 26), ang, a, 1.4, L);
}

// cards: a sheen of light as each arrives
function sheen(el) {
  if (getComputedStyle(el).position === 'static') return;
  const s = document.createElement('span'); s.className = 'hp-shine'; s.setAttribute('aria-hidden', 'true'); s.append(document.createElement('i'));
  el.append(s); s.addEventListener('animationend', () => s.remove(), { once: true });
}

// ---------- the clock
function frame(dt) {
  if (!S) return;
  S.clock += dt;
  const y = scrollY; S.vel += ((y - S.lastY) / Math.max(dt, 1) - S.vel) * .2; S.lastY = y;
  if (!S.shoot && (S.clock > S.nextShoot || (Math.abs(S.vel) > 3.2 && S.clock - S.shotAt > 1500))) { shootingStar(); S.shotAt = S.clock; S.nextShoot = S.clock + rnd(6000, 15000); }
  if (S.fade < 1) { S.fade = Math.min(1, S.fade + dt / 700); S.sky.style.opacity = S.dustC.style.opacity = S.fade; }
  drawSky(dt);
  S.fc.setTransform(1, 0, 0, 1, 0, 0); S.fc.clearRect(0, 0, S.dustC.width, S.dustC.height); S.fc.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  S.fx = S.fx.filter(f => S.clock - f.t0 < f.dur);
  for (const f of S.fx) (f.kind === 'spell' ? drawSpell : drawWrite)(f, S.clock - f.t0);
  drawRide();
  drawDust(dt);
}
function loop(now) {
  if (!S) return;
  const dt = Math.min(50, now - (S.now || now)); S.now = now;
  if (!document.hidden) frame(dt);
  S.raf = requestAnimationFrame(loop);
}

export function start({ from = null } = {}) {
  if (S) return;
  S = { clock: 0, parts: [], fx: [], off: [], vel: 0, lastY: scrollY, shoot: null, shotAt: -1e9, nextShoot: 3500, dot: sprite(), fade: reduceMotion ? 1 : 0, moonA: 0 };
  S.sky = canvas('hp-sky', -1); S.dustC = canvas('hp-dust', 70);
  S.sc = S.sky.getContext('2d'); S.fc = S.dustC.getContext('2d');
  S.sky.style.opacity = S.dustC.style.opacity = S.fade;
  resize();
  const onResize = () => resize(); addEventListener('resize', onResize); S.off.push(() => removeEventListener('resize', onResize));
  if (reduceMotion) {                       // a still sky, redrawn as the page scrolls (the moon moves with the reading)
    let q = 0; const redraw = () => { cancelAnimationFrame(q); q = requestAnimationFrame(() => drawSky()); };
    addEventListener('scroll', redraw, { passive: true }); S.off.push(() => removeEventListener('scroll', redraw)); drawSky(); return;
  }
  // the wand pointer and its dust
  let lx = -99, ly = -99;
  const move = (e) => { if (e.pointerType === 'touch') return; const dx = e.clientX - lx, dy = e.clientY - ly; if (dx * dx + dy * dy < 49) return; lx = e.clientX; ly = e.clientY;
    for (let i = 0; i < 2; i++) dust(lx + rnd(-3, 3), ly + rnd(-3, 3), { vx: -dx * .004 + rnd(-.025, .025), vy: -dy * .004 + rnd(-.035, .01), s: rnd(2.5, 6) }); };
  const down = (e) => burst(e.clientX, e.clientY, e.pointerType === 'touch' ? 22 : 16);
  if (fine) { addEventListener('pointermove', move, { passive: true }); S.off.push(() => removeEventListener('pointermove', move)); }
  addEventListener('pointerdown', down, { passive: true }); S.off.push(() => removeEventListener('pointerdown', down));
  // spells on the comparison switches (delegated: sections build their buttons later)
  const cast = (e) => { for (const [b, t] of SPELLS) { const btn = e.target.closest && e.target.closest(b); if (btn) { spell(btn, $(t)); return; } } };
  document.addEventListener('click', cast, true); S.off.push(() => document.removeEventListener('click', cast, true));
  // headings and cards as they arrive
  const seen = new WeakSet();
  const io = new IntersectionObserver((es) => es.forEach(e => { if (!e.isIntersecting || seen.has(e.target)) return; seen.add(e.target);
    if (e.target.matches('h2, h3')) write(e.target); else sheen(e.target); }), { threshold: .45 });
  const watch = () => { if (S) $$('.head h2, .pg-side h3, .task, .limit, .mini, .finding, .fanbox, .chartbox, .mode-card, .bib').forEach(el => io.observe(el)); };
  watch(); addEventListener('load', watch, { once: true }); const late = setTimeout(watch, 3000);   // sections build some cards later
  S.off.push(() => { io.disconnect(); clearTimeout(late); });
  wipeSparks();
  if (from) burst(from.x, from.y, 46, .32);          // switched on: dust bursts from the switch
  frame(16);
  if (!window.hpStill) S.raf = requestAnimationFrame(loop);
}

export function stop() {
  if (!S) return;
  cancelAnimationFrame(S.raf); S.off.forEach(f => f());
  S.sky.remove(); S.dustC.remove(); $$('.hp-shine').forEach(e => e.remove());
  S = null;
}

// exact stepping for screenshots (window.hpStill = true before load): advance the clock, cast a spell, draw a trail
window.hpFx = {
  advance(ms, step = 16) { for (let t = 0; t < ms; t += step) frame(step); },
  spell(btnSel, targetSel) { if (S) spell($(btnSel), $(targetSel)); },
  write(sel) { if (S && $(sel)) write($(sel)); },
  trail(points) { if (!S) return; for (const [x, y] of points) { for (let i = 0; i < 2; i++) dust(x + rnd(-3, 3), y + rnd(-3, 3), { vx: rnd(-.025, .025), vy: rnd(-.035, .01), s: rnd(2.5, 6) }); frame(16); } },
  dust(x, y) { if (S) for (let i = 0; i < 2; i++) dust(x + rnd(-3, 3), y + rnd(-3, 3), { vx: rnd(-.025, .025), vy: rnd(-.035, .01), s: rnd(2.5, 6) }); },
  moon() { return S ? { x: S.moonX, y: S.moonY, a: S.moonA, to: S.moonTo } : null; },
  wandAt(x, y) { if (S) wand(x + 64, y + 64, Math.PI * 1.25, 1, 1.3, 90, 1.25); },
  shoot() { if (S) shootingStar(); },
  scrollVel(v) { if (S) { S.vel = v; S.lastY = scrollY; } },
  cost(n = 30) { if (!S) return null; const t = performance.now(); for (let i = 0; i < n; i++) frame(16); return (performance.now() - t) / n; },
};
