// Small helpers shared by every section.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

export function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

const cache = new Map();
export function json(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }));
  return cache.get(url);
}

// low-data mode: posters only until the reader presses play (Save-Data and reduced motion switch it on by default)
const saveData = navigator.connection && navigator.connection.saveData;
let low = (() => { try { const v = localStorage.getItem('nope-lowdata'); if (v != null) return v === '1'; } catch (e) { /* storage blocked */ } return !!saveData; })();
const lowListeners = new Set();
export const lowData = { get on() { return low; }, set(v) { low = !!v; try { localStorage.setItem('nope-lowdata', low ? '1' : '0'); } catch (e) { /* ignore */ }
  document.documentElement.classList.toggle('lowdata-on', low); lowListeners.forEach(f => f(low)); }, listen(f) { lowListeners.add(f); } };
document.documentElement.classList.toggle('lowdata-on', low);

export const GEN = ['lingbot', 'hy', 'echo', 'evoke', 'worldplay2', 'hynomas'];
export const GEN_NAME = { lingbot: 'LingBot-World 2.0', hy: 'HY-WorldPlay', echo: 'Echo-WM', evoke: 'Evoke-Turbo', worldplay2: 'WorldPlay2', hynomas: 'Hy-Nomas', unreal: 'Unreal Engine' };
export const GEN_SHORT = { lingbot: 'LingBot 2.0', hy: 'HY-WorldPlay', echo: 'Echo-WM', evoke: 'Evoke-Turbo', worldplay2: 'WorldPlay2', hynomas: 'Hy-Nomas' };
export const METH_NAME = { raw: 'Raw model', text: 'Text prompt', depth: 'External depth', collision: 'NoPeWorld (Coll)', prediction: 'NoPeWorld (Pred)', unreal: 'Unreal Engine (ground truth)' };
export const METH_COLOR = { raw: '#d33a2c', text: '#8b5cf6', depth: '#3b6bff', collision: '#1e9e5a', prediction: '#1e9e5a', unreal: '#22262e' };

export function media(res, id) { return `media/${res}/${id}.mp4`; }
export function poster(caseId, small) { return `media/posters/${caseId}${small ? '_s' : ''}.webp`; }

let bench = null;
export async function getBench() { if (!bench) bench = await json('data/bench.json'); return bench; }
export async function getClips() { return json('data/clips.json'); }

export function chip(cat, cats, extra) {
  const c = cats[cat] || { label: cat, group: 'idle' };
  return el('span', { class: `chip ${c.group}`, title: `Task 2 evaluator (VGGT-Ω, rule v3.1): ${cat}` }, c.label + (extra || ''));
}

export function fmtTime(t) { return `${t.toFixed(2)} s`; }

// run fn once when the element comes near the viewport
export function whenNear(elm, fn, margin = '400px') {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin });
  io.observe(elm);
}

// visible-state callback (for pausing videos off screen)
export function onVisible(elm, fn, threshold = 0.15) {
  if (!('IntersectionObserver' in window)) { fn(true); return; }
  const io = new IntersectionObserver((es) => es.forEach(e => fn(e.isIntersecting)), { threshold });
  io.observe(elm);
  return io;
}

export const ICON = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>',
  bigplay: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,.45)"/><path d="M19 15v18l15-9z" fill="#fff"/></svg>',
};

const tip = () => document.getElementById('tip');
export function showTip(html, x, y) { const t = tip(); if (!t) return; t.innerHTML = html; t.classList.add('on');
  const r = t.getBoundingClientRect(); t.style.left = clamp(x + 14, 8, innerWidth - r.width - 8) + 'px'; t.style.top = clamp(y + 14, 8, innerHeight - r.height - 8) + 'px'; }
export function hideTip() { const t = tip(); if (t) t.classList.remove('on'); }
