// A small dot plot in the style of the main results chart: one row per generator, one marker per series on a 0-100 axis,
// a faint line from the raw model to the best NoPeWorld mode, values written by the markers. Markers glide when the
// metric changes. Used for Task 1 and the open paths.
import { svg, showTip, hideTip } from './util.js';

const EASE = 'transform .8s cubic-bezier(0.16, 1, 0.3, 1)';

function marker(shape, color, r = 6.5) {
  if (shape === 'ring') return svg('circle', { r: r - 1, fill: '#fff', stroke: color, 'stroke-width': 3 });
  return svg('circle', { r, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
}

export class DotPlot {
  // groups: [{ id, name }]; series: [{ key, name, color, shape, label: 'above'|'below'|null, ours }]
  constructor(svgEl, groups, series, { rowH = 44, label = 150 } = {}) {
    Object.assign(this, { S: svgEl, groups, series, rowH, labelW: label });
    this.get = () => null; this.fmt = (v) => String(v); this.low = true; this.unit = '%';
    this.build();
    if ('ResizeObserver' in window) new ResizeObserver(() => { const w = this.S.clientWidth; if (w > 0 && Math.abs(w - this.cw) > 24) { this.build(); this.update(); } }).observe(this.S);
  }
  build() {
    const cw = this.cw = this.S.clientWidth || 600;
    const narrow = this.narrow = cw < 460;
    const W = this.W = Math.max(320, Math.min(1000, cw)), top = this.top = 26;
    const head = narrow ? 18 : 0, rowH = this.rowH0 = this.rowH + head;
    this.x0 = narrow ? 14 : Math.min(this.labelW, W * 0.32); this.x1 = W - 22; this.head = head;
    this.H = top + rowH * this.groups.length + 18;
    const S = this.S; S.setAttribute('viewBox', `0 0 ${W} ${this.H}`); S.innerHTML = ''; this.nodes = {}; this.links = {};
    this.axis = svg('g'); S.append(this.axis);
    this.groups.forEach((g, i) => {
      const y = top + i * rowH;
      if (i % 2 === 0) S.append(svg('rect', { x: 0, y: y + 2, width: W, height: rowH - 4, rx: 10, fill: '#f8f9fb' }));
      S.append(svg('text', { x: narrow ? 14 : 10, y: narrow ? y + 14 : y + rowH / 2 + 5, 'font-size': 13.5, 'font-weight': 600, fill: '#111318' }, g.name));
    });
    for (const g of this.groups) {
      const ln = svg('line', { stroke: '#1e9e5a', 'stroke-width': 3, opacity: .25, 'stroke-linecap': 'round' }); ln.style.transition = 'all .8s cubic-bezier(0.16,1,0.3,1)';
      S.append(ln); this.links[g.id] = ln;
    }
    for (const g of this.groups) for (const s of this.series) {
      const grp = svg('g'); grp.style.transition = EASE;
      const lab = svg('text', { y: s.label === 'below' ? 21 : -11, 'font-size': 11.5, 'font-weight': 650, fill: s.color, 'text-anchor': 'middle' });
      grp.append(marker(s.shape, s.color), lab);
      grp.addEventListener('pointermove', (e) => { const v = this.get(g.id, s.key); if (v != null) showTip(`<b>${g.name}</b><br>${s.name}: ${this.fmt(v)}`, e.clientX, e.clientY); });
      grp.addEventListener('pointerleave', hideTip);
      S.append(grp); this.nodes[`${g.id}|${s.key}`] = { grp, lab, s };
    }
  }
  X(v) { return this.x0 + (this.x1 - this.x0) * Math.max(0, Math.min(100, v)) / 100; }
  set(get, fmt, low) { this.get = get; this.fmt = fmt; this.low = low; this.update(); }
  update() {
    const { axis, top, rowH0, groups, H } = this;
    axis.innerHTML = '';
    for (let v = 0; v <= 100; v += 25) axis.append(svg('line', { x1: this.X(v), x2: this.X(v), y1: top - 4, y2: top + rowH0 * groups.length, stroke: '#eef1f6' }),
      svg('text', { x: this.X(v), y: top - 10, 'font-size': 11, fill: '#7c8394', 'text-anchor': v === 0 ? 'start' : v === 100 ? 'end' : 'middle' }, `${v}`));
    axis.append(svg('text', { x: this.low ? this.X(0) : this.X(100), y: H - 3, 'font-size': 11.5, fill: '#7c8394', 'text-anchor': this.low ? 'start' : 'end' }, this.low ? '← better' : 'better →'));
    groups.forEach((g, i) => {
      const y = top + i * rowH0 + this.head + (rowH0 - this.head) / 2;
      let best = null, raw = null;
      for (const s of this.series) {
        const n = this.nodes[`${g.id}|${s.key}`]; const v = this.get(g.id, s.key);
        n.grp.style.visibility = v == null ? 'hidden' : '';
        if (v == null) continue;
        n.grp.style.transform = `translate(${this.X(v)}px, ${y}px)`;
        n.lab.textContent = s.label ? this.fmt(v) : '';
        if (s.ours && (best == null || (this.low ? v < best : v > best))) best = v;
        if (s.key === 'raw') raw = v;
      }
      const ln = this.links[g.id];
      if (raw != null && best != null) { ln.setAttribute('x1', this.X(raw)); ln.setAttribute('x2', this.X(best)); ln.setAttribute('y1', y); ln.setAttribute('y2', y); ln.style.visibility = ''; }
      else ln.style.visibility = 'hidden';
    });
  }
}
