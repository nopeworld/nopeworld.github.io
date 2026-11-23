// Sound (user 11-23; the contract is docs/PLAN_SOUND.md). Both entries get music synced to their opening animation; on the
// page, Night gets magical sounds and GTA punchy ones: a light background bed and sound effects. Day stays quiet.
//  - The gate: browsers block sound on load, so each intro waits on its first frame with one big button (with sound) and a
//    smaller one (muted). Once per tab session, like the intro. Enter or Space = with sound; the wheel, a touch move or
//    Escape skips the intro silently. The intro's own skip listeners are armed only after the start.
//  - Sync: the score starts at t0 = ctx.currentTime + 0.06 and the intro's timeline is driven from the audio clock on every
//    tick (tl.time(currentTime - t0 - outputLatency)), so picture and sound cannot drift apart. Muted: tl.play() as before.
//  - The bed starts on the score's cue (t0 + bedAt, from its loopStart) in Night and GTA, and loops seamlessly; without an
//    intro it fades in. Look changes crossfade the beds; Day fades them out.
//  - The header's speaker button (Night and GTA only) turns it all on and off; localStorage 'nope-sound' = on/off keeps the
//    last choice (the gate's or the button's). Pages without the gate stay silent until the button is used.
//  - Effects come from one delegated click listener (capture phase) that names a sprite; at most one sprite per 60 ms.
// Files: media/audio/cues.json and the .m4a files it names, decoded with decodeAudioData (an offline context decodes them
// before any gesture; the real AudioContext is made inside the click). Everything fails open: without Web Audio, cues.json
// or a decodable file the intro starts silently and the page works as before. window.nopeNoGate = true (test scripts)
// skips the gate: the intros start by themselves, silent. window.nopeSound is for scripts/check_sound.py.
const d = document.documentElement;
const DIR = 'media/audio/';
const KEY = 'nope-sound';
const LIVE = { night: 1, gta: 1 };                     // the looks with a bed and effects
const AC = window.AudioContext || window.webkitAudioContext;
const now = () => performance.now();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const look = () => d.dataset.theme;
const num = (v, def) => (typeof v === 'number' && isFinite(v) ? v : def);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const log = [];
const note = (ev, x) => { log.push(Object.assign({ ev, ms: Math.round(now()), ct: ctx ? +ctx.currentTime.toFixed(4) : null }, x || {})); if (log.length > 300) log.shift(); };

// ---------- files: cues.json, then each buffer fetched and decoded once
let cues = null, cuesP = null, dec = null;
const loadCues = () => cuesP || (cuesP = fetch(DIR + 'cues.json').then(r => (r.ok ? r.json() : null))
  .then(j => { cues = j && typeof j === 'object' ? j : null; note('cues', { ok: !!cues }); paint(); return cues; })
  .catch(() => { cues = null; note('cues', { ok: false }); paint(); return null; }));
// before a gesture there is no AudioContext: an offline one decodes (its buffers play in any context)
const decoder = () => {
  if (ctx) return ctx;
  if (dec === null) { const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; try { dec = O ? new O(2, 1, 44100) : false; } catch (e) { dec = false; } }
  return dec || null;
};
const decode = (ab) => new Promise((res, rej) => {
  const c = decoder(); if (!c) { rej(new Error('no decoder')); return; }
  try { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
});
const got = {}, getting = {};
function buffer(name) {
  return getting[name] || (getting[name] = loadCues().then((c) => {
    const e = c && c[name];
    if (!e || typeof e.file !== 'string') return null;
    return fetch(DIR + e.file).then(r => (r.ok ? r.arrayBuffer() : null)).then(ab => (ab ? decode(ab) : null));
  }).then((b) => { if (b) { got[name] = b; note('decoded', { name, dur: +b.duration.toFixed(3) }); } else note('missing', { name }); return b || null; })
    .catch((err) => { note('missing', { name, err: String(err).slice(0, 80) }); return null; }));
}

// ---------- the context: made (or resumed) inside a click or key press
let ctx = null, master = null, meter = null;
const bus = {};
function context() {
  if (!AC) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS 17+: play past the mute switch */ }
  if (!ctx) {
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return null; } }
    try {
      master = ctx.createGain(); master.connect(ctx.destination);
      for (const k of ['score', 'bed', 'sfx']) { bus[k] = ctx.createGain(); bus[k].connect(master); }
      try { meter = ctx.createAnalyser(); meter.fftSize = 2048; master.connect(meter); } catch (e) { meter = null; }
      const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);   // unlocks iOS
    } catch (e) { try { ctx.close(); } catch (e2) { /* gone */ } ctx = null; return null; }
    note('context', { state: ctx.state, rate: ctx.sampleRate });
  }
  if (ctx.state !== 'running') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* closed */ } }
  return ctx;
}
function ramp(p, to, dur) {
  const t = ctx.currentTime;
  try { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + Math.max(.005, dur)); } catch (e) { p.value = to; }
}
function play(buf, out, gain, when, offset, dur) {
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf; g.gain.value = gain; src.connect(g); g.connect(out);
  if (dur != null) src.start(when, offset, dur); else src.start(when, offset || 0);
  return { src, g };
}
function fadeStop(n, fade) {
  if (!n || !ctx) return;
  ramp(n.g.gain, 0, fade);
  try { n.src.stop(ctx.currentTime + fade + .03); } catch (e) { /* never started */ }
}

// ---------- the state: wanted on or off (the header's button), the intro's score, the bed
let want = false, available = null;
let score = null, lastT0 = null;                       // { src, g, t0, name }
let bed = null, bedTok = 0;                            // { src, g, look, at }
const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const store = (v) => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* storage blocked */ } };

function scoreStop(fade) {
  if (!score) return;
  note('score-stop', { fade }); fadeStop(score, fade); score = null;
}
function bedStop(fade) {
  bedTok++;
  if (!bed) return;
  note('bed-stop', { look: bed.look, fade }); fadeStop(bed, fade); bed = null;
}
// the look's bed: on the score's cue (`at`, on the context's clock) from its first downbeat, else faded in from there
function bedStart(lk, at = null) {
  if (bed && bed.look === lk && at == null) return;
  bedStop(1.2);
  if (!LIVE[lk] || !want || !ctx) return;
  const tok = bedTok, name = 'bed_' + lk;
  buffer(name).then((b) => {
    if (!b || tok !== bedTok || !want || look() !== lk || !ctx) return;
    const c = cues[name], t = ctx.currentTime, gain = num(c.gain, .3);
    const ls = clamp(num(c.loopStart, 0), 0, b.duration), le = clamp(num(c.loopEnd, b.duration), 0, b.duration);
    const fade = !(at != null && at > t + .03), when = fade ? t + .03 : at;
    const n = play(b, bus.bed, fade ? 0 : gain, when, ls);
    n.src.loop = true;
    if (le > ls + .05) { n.src.loopStart = ls; n.src.loopEnd = le; }
    if (fade) { n.g.gain.setValueAtTime(0, when); n.g.gain.linearRampToValueAtTime(gain, when + 1.5); }
    bed = Object.assign(n, { look: lk, at: when });
    note('bed', { look: lk, at: +when.toFixed(4), cue: !fade, loopStart: ls, loopEnd: le });
  });
}

// ---------- effects: one sprite per 60 ms
let lastFx = 0, lastName = '';
function sfx(name, wait = false) {
  if (!want || !ctx || !LIVE[look()]) return;
  const t = now(); if (t - lastFx < 60) return;
  const key = 'sfx_' + look(), b = got[key];
  const go = (buf) => {
    if (!want || !ctx || ctx.state === 'closed') return;          // a context still resuming plays it as it starts
    const c = cues && cues[key], sp = c && c.sprites && c.sprites[name];
    if (!Array.isArray(sp) || sp.length < 2 || !(sp[1] > 0)) return;
    lastFx = now(); lastName = name;
    play(buf, bus.sfx, num(c.gain, 1), ctx.currentTime, clamp(sp[0], 0, buf.duration), Math.min(sp[1], buf.duration - sp[0]));
    note('sfx', { name, look: look() });
  };
  if (b) go(b);
  else { const asked = t; buffer(key).then(buf => { if (buf && wait && now() - asked < 1500) go(buf); }); }
}
const RULES = [
  ['.nope-gate, #hp-intro, #gta-intro, #looksw, #soundsw', null],    // the look's sound comes with the look; 'on' with the button
  ['.nav a, .mnav a, .brand', 'nav'],
  ['#hero-seeds button, #hero-scene button', 'switch'],
  ['#v-close, #tp-close', 'close'],
  ['.info', (e) => (e.getAttribute('aria-expanded') === 'true' ? 'close' : 'open')],
  ['summary', (e) => (e.parentElement && e.parentElement.open ? 'close' : 'open')],
  ['[aria-haspopup="dialog"], .rcard, .mq-row button', 'open'],
  ['.stage video, .stage canvas', (e) => (e.closest('.stage').querySelector('.handle') ? 'slide' : null)],
  ['button, [role="button"], [role="tab"], [role="radio"], a[href], label, input[type="checkbox"], input[type="radio"], select', 'tap'],
];
function sprite(target) {
  if (!target || !target.closest) return null;
  for (const [sel, name] of RULES) {
    const e = target.closest(sel);
    if (e) return typeof name === 'function' ? name(e) : name;
  }
  return null;
}

// ---------- the intro's clock: the timeline follows the audio clock on every tick (never backwards)
let drv = null, drvTl = null, drvAt = null;            // drvAt: the last tick's reading (for scripts/check_sound.py)
function stopDrive() { if (drv) { try { window.gsap.ticker.remove(drv); } catch (e) { /* no gsap */ } } drv = null; }
function handOff(why) {                                // the wall clock takes over (the score fades)
  const tl = drvTl; stopDrive(); scoreStop(.25); note('handoff', { why });
  if (tl && tl.progress() < 1) tl.play();
}
function drive(tl, t0, ended) {
  let last = 0, lastCt = -1, still = 0;
  const tick = () => {
    if (drv !== tick) return;
    if (ended() || tl.progress() >= 1) { stopDrive(); return; }
    // a stalled clock stalls the score too, so the picture waits with it; a clock dead for 2 s hands over to the wall clock
    const ct = ctx.currentTime, vis = document.visibilityState !== 'hidden';
    if (ct !== lastCt) { lastCt = ct; still = 0; } else if (vis) { if (!still) still = now(); else if (now() - still > 2000) { handOff('the audio clock stopped'); return; } }
    const lat = ctx.outputLatency || 0, t = Math.max(last, ct - t0 - lat, 0);
    last = t; drvAt = { t, ct, lat, ms: now() };
    if (t >= tl.duration()) { stopDrive(); tl.play(); return; }      // the last few ms on the wall clock: onComplete as usual
    tl.time(t);
  };
  drv = tick; drvTl = tl;
  window.gsap.ticker.add(tick, false, true);           // first on every tick, so whatever reads the timeline sees this frame
}
// the clock is running: resume() can take a moment, and an output device that is still opening renders one block and
// then holds the clock for up to a second (seen on Linux/PulseAudio). So: 30 ms of audio rendered after the first reading.
// A context that never gets there means silence.
const runs = (c, until) => new Promise((res) => {
  const c0 = c.currentTime;
  const f = () => { if (c.state === 'running' && c.currentTime >= c0 + .03) res(true); else if (now() > until) res(false); else setTimeout(f, 10); };
  f();
});

async function withSound(o, c) {
  const name = o.kind === 'gta' ? 'intro_gta' : 'intro_hp', click = now();
  const [buf, ok] = await Promise.all([Promise.race([buffer(name), sleep(2500).then(() => null)]), o.ready]);
  if (ok === false || o.ended()) { if (want) bedStart(look()); return; }
  const running = buf ? await runs(c, Math.max(click + 2500, now() + 300)) : false;
  if (o.ended()) { if (want) bedStart(look()); return; }
  if (!buf || !running || !cues || !cues[name]) {
    note('silent-start', { why: !buf ? 'no score' : 'no clock' });
    o.tl.play(); if (want) bedStart(look());
    return;
  }
  const cue = cues[name], t0 = c.currentTime + .06;
  score = Object.assign(play(buf, bus.score, num(cue.gain, 1), t0, 0), { t0, name });
  const me = score; score.src.onended = () => { if (score === me) score = null; };
  lastT0 = t0;
  note('score', { name, t0: +t0.toFixed(4), wait: Math.round(now() - click), latency: c.outputLatency || 0 });
  if (LIVE[look()]) bedStart(look(), t0 + num(cue.bedAt, buf.duration));
  drive(o.tl, t0, o.ended);
}

// ---------- the gate
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z" fill="currentColor"/>'
  + '<path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.3 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const LABELS = { hp: ['Enter with sound', 'Enter muted'], gta: ['Press start', 'Start muted'] };
let gated = false;
export function gateIntro(o) {
  if (gated || !AC || !window.gsap) return false;
  try {
    initSound();
    const [goText, muteText] = LABELS[o.kind] || LABELS.hp;
    const g = document.createElement('div');
    g.className = `nope-gate is-${o.kind === 'gta' ? 'gta' : 'hp'}`; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Enter the page');
    g.innerHTML = `<button type="button" class="ng-go" aria-label="${goText}, with sound">${SPEAKER}<span>${goText}</span></button>`
      + `<button type="button" class="ng-mute">${muteText}</button>`;
    const go = g.querySelector('.ng-go'), mute = g.querySelector('.ng-mute');
    o.ov.append(g); o.ov.classList.add('is-gated'); d.classList.add('nope-gated'); gated = true;
    buffer(o.kind === 'gta' ? 'intro_gta' : 'intro_hp');           // decoded while the reader looks at the gate
    try { go.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    let started = false, touch = null;
    const off = [];
    const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); off.push(() => t.removeEventListener(ev, fn, opt)); };
    const close = () => { off.forEach(f => f()); g.remove(); o.ov.classList.remove('is-gated'); d.classList.remove('nope-gated'); };
    const start = (sound) => {
      if (started) return; started = true;
      const c = sound ? context() : null;              // inside the gesture
      close();
      want = !!(sound && c); store(!!sound); paint();
      note('gate', { sound: !!sound, ctx: c ? c.state : null });
      if (want) { master.gain.value = 1; buffer('sfx_night'); buffer('sfx_gta'); }
      setTimeout(o.arm, 0);                            // after this click or key has finished: it must not also skip
      if (want) withSound(o, c).catch((e) => { note('error', { e: String(e).slice(0, 120) }); if (!o.ended() && o.tl.paused()) o.tl.play(); });
      else Promise.resolve(o.ready).then((ok) => { if (ok !== false && !o.ended() && !window.hpHold && !window.gtaHold) o.tl.play(); });
    };
    const skip = () => { if (started) return; started = true; close(); note('gate', { skip: true }); o.skip(); };
    on(go, 'click', (e) => { e.stopPropagation(); start(true); });
    on(mute, 'click', (e) => { e.stopPropagation(); start(false); });
    on(window, 'keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); skip(); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        if (e.repeat) { e.preventDefault(); return; }
        e.preventDefault(); start(document.activeElement !== mute);        // a focused "muted" button keeps its own meaning
      }
    }, true);
    on(window, 'wheel', skip, { passive: true });
    on(window, 'touchstart', (e) => { const p = e.touches && e.touches[0]; touch = p && !(e.target.closest && e.target.closest('.nope-gate button')) ? [p.clientX, p.clientY] : null; }, { passive: true });
    on(window, 'touchmove', (e) => { const p = e.touches && e.touches[0]; if (touch && p && Math.hypot(p.clientX - touch[0], p.clientY - touch[1]) > 10) skip(); }, { passive: true });
    return true;
  } catch (e) {
    note('error', { e: String(e).slice(0, 120) });
    document.querySelectorAll('.nope-gate').forEach(n => n.remove()); o.ov.classList.remove('is-gated'); d.classList.remove('nope-gated');
    return false;
  }
}

// ---------- the header's button
let btn = null;
function paint() {
  if (!btn) return;
  btn.hidden = !(LIVE[look()] && available !== false && cues);
  btn.setAttribute('aria-pressed', String(want));
  btn.setAttribute('aria-label', want ? 'Sound on' : 'Sound off');
}
function turnOn() {
  const c = context(); if (!c) return;
  want = true; store(true); paint();
  ramp(master.gain, 1, .15);
  buffer('sfx_night'); buffer('sfx_gta');
  note('on');
  sfx('on', true);
  bedStart(look());
}
function turnOff() {
  want = false; store(false); paint(); note('off');
  if (!ctx) return;
  if (drv) handOff('sound off');
  ramp(master.gain, 0, .25);
  bedStop(.25);
  const was = ctx;
  setTimeout(() => { if (want || ctx !== was) return; scoreStop(0); try { was.suspend().catch(() => {}); } catch (e) { /* closed */ } }, 320);
}

let inited = false;
export function initSound() {
  if (inited) return; inited = true;
  try {
    btn = document.getElementById('soundsw');
    if (!AC) { if (btn) btn.hidden = true; return; }
    if (btn) btn.addEventListener('click', () => { if (want) turnOff(); else turnOn(); });
    loadCues().then((c) => { available = !!c; paint(); });            // about 1 KB: the button shows once the files exist
    paint();
    let last = look();
    addEventListener('nope:theme', (e) => {
      paint();
      const lk = e.detail || look(); if (lk === last) return; last = lk;
      if (!want || !ctx) return;
      note('look', { look: lk });
      if (score) { if (drv) handOff('look changed'); else scoreStop(.6); }
      if (LIVE[lk]) { bedStart(lk); sfx('look', true); } else bedStop(1);
    });
    // a skip during the intro: the score fades over 0.25 s, then the bed comes in (Night, GTA)
    addEventListener('nope:intro-skip', () => {
      if (!score) return;
      stopDrive(); scoreStop(.25); bedStop(0); note('skip');
      setTimeout(() => { if (want) bedStart(look()); }, 250);
    });
    addEventListener('click', (e) => { if (!want || !ctx || e.button > 0) return; const s = sprite(e.target); if (s) sfx(s); }, true);
    // a dialog closed by Escape or its backdrop (its close button has already sounded)
    document.addEventListener('close', (e) => { if (want && e.target && e.target.tagName === 'DIALOG' && !(lastName === 'close' && now() - lastFx < 500)) sfx('close'); }, true);
    let sliding = false;
    addEventListener('pointerdown', (e) => { sliding = !!(e.target.closest && e.target.closest('.handle, [role="slider"]')); }, true);
    const release = () => { if (sliding) { sliding = false; sfx('slide'); } };
    addEventListener('pointerup', release, true); addEventListener('pointercancel', release, true);
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      try {
        if (document.visibilityState === 'hidden') { ctx.suspend().catch(() => {}); note('hidden'); } else if (want) { ctx.resume().catch(() => {}); note('visible'); }
      } catch (e) { /* closed */ }
    });
  } catch (e) { note('error', { e: String(e).slice(0, 120) }); }
}

// a module script of its own (index.html), so the page's other modules never wait on it or fail with it; the intros
// import it too (the same instance)
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSound, { once: true }); else initSound();

// for scripts/check_sound.py
window.nopeSound = {
  state: () => ({ want, ctx: ctx ? ctx.state : null, t0: lastT0, score: !!score, bed: bed ? { look: bed.look, at: bed.at } : null, driving: !!drv,
    available, stored: stored(), master: master ? master.gain.value : null, latency: ctx ? ctx.outputLatency || 0 : null }),
  context: () => ctx,
  tick: () => drvAt,
  cues: () => cues,
  buffer: (name) => got[name] || null,
  level: () => { if (!meter) return 0; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let s = 0; for (const x of a) s += x * x; return Math.sqrt(s / a.length); },
  log,
};
