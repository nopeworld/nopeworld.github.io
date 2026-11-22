// One clock for several videos. The clock is the group's own (not a leader video's): while playing it advances with
// real time, holds while any clip is still buffering, and loops at the shortest clip's end; every clip is snapped to it
// (seek when off by more than 0.12 s, small rate nudges below that). Overlays redraw on every presented frame
// (requestVideoFrameCallback where available, else on the clock's tick).
import { lowData, clamp } from './util.js';

export class SyncGroup {
  constructor({ fps = 16, loop = true, rate = 1 } = {}) {
    this.items = []; this.fps = fps; this.loop = loop; this.rate = rate;
    this.playing = false; this.listeners = new Set(); this.raf = 0; this.userStarted = false; this.visible = false; this.want = true; this.loaded = false;
    this.t = 0; this.last = 0;
  }
  add(video, draw) {
    video.muted = true; video.playsInline = true; video.loop = false; video.disablePictureInPicture = true;
    const it = { video, draw };
    this.items.push(it);
    video.addEventListener('loadeddata', () => { this.snap(video, true); this.redraw(); });
    video.addEventListener('seeked', () => { if (!this.playing) this.redraw(); });
    if ('requestVideoFrameCallback' in video && draw) {
      const cb = (now, meta) => { if (!video.isConnected) return; draw(this.frameOf(meta.mediaTime), meta.mediaTime); video.requestVideoFrameCallback(cb); };
      video.requestVideoFrameCallback(cb);
    }
    return it;
  }
  setSources(list) {   // [[video, src, poster], ...]
    for (const [v, src, poster] of list) {
      v.dataset.poster = poster || '';
      if (this.seen && poster) v.poster = poster;     // posters too wait until the group has been on screen
      v.dataset.src = src || '';
      if (!src) { if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); } continue; }
      if (this.loaded) this.loadOne(v);          // only a group that has been on screen (or started by the reader) fetches video
    }
  }
  loadOne(v) { if (v.dataset.src && v.getAttribute('src') !== v.dataset.src) { v.preload = 'auto'; v.src = v.dataset.src; } }
  load() { this.loaded = true; this.items.forEach(it => this.loadOne(it.video)); }
  live() { return this.items.filter(it => it.video.getAttribute('src')); }
  get duration() { const ds = this.live().map(it => it.video.duration).filter(d => isFinite(d) && d > 0); return ds.length ? Math.min(...ds) : 0; }
  get time() { return this.t; }
  frameOf(t) { return Math.max(0, Math.round(t * this.fps - 1e-3)); }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  emit() { this.listeners.forEach(f => f(this.t, this)); }
  redraw() { for (const it of this.items) if (it.draw && (!('requestVideoFrameCallback' in it.video) || !this.playing)) it.draw(this.frameOf(it.video.currentTime), it.video.currentTime); this.emit(); }
  snap(v, force) {
    if (v.readyState < 1) return;
    const d = v.currentTime - this.t;
    if (force || Math.abs(d) > 0.12) { try { v.currentTime = Math.min(this.t, (v.duration || 1e9) - 0.01); } catch (e) { /* not seekable yet */ } }
    else if (this.playing) v.playbackRate = this.rate * (1 - clamp(d * 3, -0.2, 0.2));
  }
  async play(user) {
    if (user) { this.userStarted = true; this.showPosters(); }
    this.want = true;
    if (lowData.on && !this.userStarted) return;
    if (!this.visible && !user) return;
    this.load();
    if (this.playing) return;
    this.playing = true; this.last = performance.now();
    this.live().forEach(it => { it.video.playbackRate = this.rate; this.snap(it.video, true); it.video.play().catch(() => {}); });
    cancelAnimationFrame(this.raf);
    const tick = (now) => {
      if (!this.playing) return;
      const L = this.live();
      const ready = L.length && L.every(it => it.video.readyState >= 3 || it.video.ended);
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      if (ready) {
        this.t += dt * this.rate;
        const D = this.duration;
        if (this.loop && D && this.t >= D - 0.5 / this.fps) { this.t = 0; L.forEach(it => this.snap(it.video, true)); }
        for (const it of L) { const v = it.video; this.snap(v); if (v.paused && !v.ended) v.play().catch(() => {}); }
      } else {
        // a clip is still buffering: hold the others still on the clock's frame (paused, one seek), instead of letting them
        // run ahead and snapping them back every 0.12 s, which made the tiles jump back and forth while loading
        for (const it of L) {
          const v = it.video;
          if (v.readyState >= 1 && !v.paused && !v.ended) { v.pause(); if (Math.abs(v.currentTime - this.t) > 0.04) this.snap(v, true); }
        }
      }
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  pause(user) {
    if (user) this.want = false;
    this.playing = false; cancelAnimationFrame(this.raf);
    this.items.forEach(it => { it.video.pause(); it.video.playbackRate = this.rate; this.snap(it.video, true); });
    this.redraw();
  }
  toggle() { if (this.playing) this.pause(true); else this.play(true); return this.playing; }
  showPosters() { if (this.seen) return; this.seen = true; this.items.forEach(it => { if (it.video.dataset.poster) it.video.poster = it.video.dataset.poster; }); }
  setVisible(v) {
    this.visible = v;
    if (v) this.showPosters();
    if (v && !lowData.on) this.load();
    if (!v && this.playing) { this.pause(); this.want = true; } else if (v && this.want && !this.playing) this.play();
  }
  setRate(r) { this.rate = r; this.items.forEach(it => { it.video.playbackRate = r; }); }
  seek(t) {
    const d = this.duration || 5.0625;
    this.t = clamp(t, 0, Math.max(0, d - 0.5 / this.fps));
    this.items.forEach(it => this.snap(it.video, true));
    this.emit();
  }
  step(df) { this.pause(true); this.seek((this.frameOf(this.t) + df) / this.fps + 0.25 / this.fps); }
  clear() { this.pause(); this.items = []; }
}

// wire a play button, scrubber and time readout to a group
export function wirePlayer(group, { button, scrub, time, labelFrames }) {
  const set = () => { if (!button) return; button.innerHTML = group.playing ? '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>' : '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>';
    button.setAttribute('aria-label', group.playing ? 'Pause' : 'Play'); };
  if (button) button.addEventListener('click', () => { group.toggle(); setTimeout(set, 30); });
  let dragging = false;
  if (scrub) {
    scrub.addEventListener('input', () => { dragging = true; group.pause(true); set(); group.seek(scrub.value / 1000 * (group.duration || 5.0625)); });
    scrub.addEventListener('change', () => { dragging = false; });
  }
  let was = null;
  group.on((t) => {
    const d = group.duration || 5.0625;
    if (scrub && !dragging) scrub.value = Math.round(t / d * 1000);
    if (time) time.textContent = labelFrames ? `${t.toFixed(2)} s · f${group.frameOf(t)}` : `${t.toFixed(2)} s`;
    if (was !== group.playing) { was = group.playing; set(); }
  });
  set();
  return set;
}
