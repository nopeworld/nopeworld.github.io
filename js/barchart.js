// Grouped horizontal bars: one group per generator, one bar per method, the value at the bar's end. Bars grow from zero the
// first time the chart is on screen and glide to new values when the metric changes (CSS transforms, no library).
import { svg, showTip, hideTip, onVisible } from './util.js';

const EASE = 'transform .9s cubic-bezier(0.16, 1, 0.3, 1)';

export class BarChart {
  // groups: [{ id, name }], series: [{ key, name, color, soft }] (soft: drawn lighter)
  constructor(svgEl, groups, series, { bar = 11, gap = 4, pad = 16, label = 172, valueW = 56, max = 100 } = {}) {
    Object.assign(this, { S: svgEl, groups, series, bar, gap, pad, labelW: label, valueW, max });
    this.get = () => null; this.fmt = (v) => String(v); this.tip = null; this.shown = false; this.nodes = {};
    this.build();
    if ('ResizeObserver' in window) new ResizeObserver(() => { const w = this.S.clientWidth; if (w > 0 && Math.abs(w - this.cw) > 24) { this.build(); this.update(); } }).observe(this.S);
    onVisible(this.S, (v) => { if (v && !this.shown) { this.shown = true; this.update(); } }, 0.25);
  }
  build() {
    const cw = this.cw = this.S.clientWidth || 900;               // drawn at its own pixel width, so text keeps its size
    const narrow = this.narrow = cw < 520;
    const W = this.W = narrow ? Math.max(320, cw) : Math.min(1100, cw), top = this.top = narrow ? 8 : 6;
    const head = narrow ? 22 : 0, rowH = this.rowH = head + this.series.length * (this.bar + this.gap) - this.gap + this.pad;
    this.x0 = narrow ? 8 : Math.min(this.labelW, W * 0.3); this.x1 = W - this.valueW;
    this.H = top + rowH * this.groups.length;
    this.S.setAttribute('viewBox', `0 0 ${W} ${this.H}`); this.S.innerHTML = ''; this.nodes = {};
    const grid = svg('g'); this.S.append(grid);
    for (let v = 0; v <= 1.0001; v += 0.25) grid.append(svg('line', { x1: this.X(v * this.max), x2: this.X(v * this.max), y1: top, y2: this.H - this.pad / 2, stroke: '#eef1f6' }));
    this.groups.forEach((g, i) => {
      const y = top + i * rowH;
      this.S.append(svg('text', { x: narrow ? 8 : 0, y: narrow ? y + 14 : y + (rowH - this.pad) / 2 + 5, 'font-size': narrow ? 13.5 : 14.5, 'font-weight': 650, fill: '#111318' }, g.name));
      this.series.forEach((s, j) => {
        const by = y + head + j * (this.bar + this.gap);
        const track = svg('rect', { x: this.x0, y: by, width: this.x1 - this.x0, height: this.bar, rx: this.bar / 2, fill: '#f3f5f8' });
        const b = svg('rect', { x: this.x0, y: by, width: this.x1 - this.x0, height: this.bar, rx: this.bar / 2, fill: s.color, opacity: s.soft ? 0.38 : 1 });
        b.style.transformBox = 'fill-box'; b.style.transformOrigin = '0 50%'; b.style.transform = 'scaleX(0)'; b.style.transition = EASE;
        const t = svg('text', { x: 0, y: by + this.bar - 1.5, 'font-size': 12, 'font-weight': s.soft ? 500 : 700, fill: s.soft ? '#7c8394' : s.color });
        t.style.transition = EASE; t.style.transform = `translateX(${this.x0 + 6}px)`;
        const hit = svg('rect', { x: this.x0, y: by - 1, width: this.x1 - this.x0 + this.valueW, height: this.bar + 2, fill: 'transparent' });
        hit.addEventListener('pointermove', (e) => { if (this.tip) showTip(this.tip(g, s), e.clientX, e.clientY); });
        hit.addEventListener('pointerleave', hideTip);
        this.S.append(track, b, t, hit);
        this.nodes[`${g.id}|${s.key}`] = { b, t, track };
      });
    });
  }
  X(v) { return this.x0 + (this.x1 - this.x0) * Math.max(0, Math.min(this.max, v)) / this.max; }
  // get(groupId, seriesKey) -> number | null; fmt(value) -> label
  set(get, fmt, tip) { this.get = get; this.fmt = fmt; this.tip = tip || null; this.update(); }
  update() {
    for (const g of this.groups) for (const s of this.series) {
      const n = this.nodes[`${g.id}|${s.key}`]; if (!n) continue;
      const v = this.get(g.id, s.key);
      const on = v != null, f = on && this.shown ? Math.max(0.004, Math.min(1, v / this.max)) : 0;
      n.b.style.transform = `scaleX(${f})`; n.b.style.visibility = on ? '' : 'hidden'; n.track.style.visibility = on ? '' : 'hidden';
      n.t.textContent = on ? this.fmt(v) : '';
      n.t.style.transform = `translateX(${(on && this.shown ? this.X(v) : this.x0) + 6}px)`;
    }
  }
}

export function legend(box, series) {
  box.innerHTML = '';
  for (const s of series) {
    const sw = document.createElement('i');
    sw.style.cssText = `display:inline-block;width:18px;height:9px;border-radius:5px;margin-right:6px;vertical-align:1px;background:${s.color};opacity:${s.soft ? .38 : 1}`;
    const sp = document.createElement('span'); sp.append(sw, s.name); box.append(sp);
  }
}
