// Obstacle tracks (site/data/tracks/<clip>.json; polygons per frame in 0..1000 of the full video frame) drawn on a canvas
// over a video shown with object-fit: cover.
import { json } from './util.js';

export async function loadTrack(id) { try { return await json(`data/tracks/${id}.json`); } catch (e) { return null; } }

export class Overlay {
  constructor(canvas, video) { this.c = canvas; this.v = video; this.track = null; this.on = true; this.ctx = canvas.getContext('2d'); this.last = -1; }
  set(track) { this.track = track; this.last = -1; this.clear(); }
  setOn(on) { this.on = on; this.last = -1; if (!on) this.clear(); }
  clear() { const { c } = this; this.fit(); this.ctx.clearRect(0, 0, c.width, c.height); }
  fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);   // layout size: a scaled ancestor must not resize the canvas
    const w = Math.max(1, Math.round(this.c.offsetWidth * dpr)), h = Math.max(1, Math.round(this.c.offsetHeight * dpr));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; this.last = -1; }
    return [w, h, dpr];
  }
  draw(frame) {
    if (!this.on || !this.track) return;
    if (this.v.readyState < 2 && !this.v.poster) { this.clear(); this.last = -1; return; }   // no mask over a tile that shows nothing yet
    const [w, h, dpr] = this.fit();
    if (frame === this.last) return;
    this.last = frame;
    const ctx = this.ctx; ctx.clearRect(0, 0, w, h);
    if (this.track.e != null && frame >= this.track.e) return;     // drawn until first lost (scripts/track_end.py)
    const f = this.track.f[Math.min(frame, this.track.f.length - 1)] || [];
    if (!f.length) return;
    const vw = this.v.videoWidth || 16, vh = this.v.videoHeight || 9;
    const s = Math.max(w / vw, h / vh), dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
    ctx.beginPath();
    for (const p of f) {
      for (let i = 0; i < p.length; i += 2) { const x = ox + p[i] / 1000 * dw, y = oy + p[i + 1] / 1000 * dh; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(242, 194, 0, 0.30)'; ctx.fill('evenodd');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20, 22, 28, 0.45)'; ctx.lineWidth = 4 * dpr; ctx.stroke();
    ctx.strokeStyle = '#f2c200'; ctx.lineWidth = 2 * dpr; ctx.stroke();
  }
}
