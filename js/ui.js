// Small interface pieces that need no animation library: info popovers, the hero's cursor tag, magnetic buttons,
// tilting cards. Each one is a progressive enhancement: without it the page reads the same.
import { $, $$, clamp, el, reduceMotion } from './util.js';

const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

// an info button with its popover text (for sections that build their DOM in JS)
export function infoBox(html, label = 'Details') {
  return el('span', { class: 'infobox' }, el('button', { class: 'info', 'aria-expanded': 'false', 'aria-label': label }, 'i'), el('span', { class: 'info-pop', role: 'note', html }));
}

// ---------- info popovers: the provenance lines live here, one click away (the text stays in the DOM). Delegated, so
// boxes that sections add later work too.
export function infoPopovers() {
  let open = null, y0 = 0;
  const place = (box, pop) => {
    const r = $('.info', box).getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const x = clamp(r.right - w + 10, 12, innerWidth - w - 12);
    let y = r.bottom + 8;
    if (y + h > innerHeight - 12) y = Math.max(12, r.top - h - 8);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  };
  const close = () => {
    if (!open) return;
    const pop = open._pop; pop.classList.remove('on'); open.append(pop);      // back in place (it prints there)
    open.classList.remove('open'); $('.info', open).setAttribute('aria-expanded', 'false'); open = null;
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.info');
    if (btn) {
      const box = btn.closest('.infobox');
      e.stopPropagation(); e.preventDefault();
      if (open === box) { close(); return; }
      close();
      const pop = $('.info-pop', box); box._pop = pop; document.body.append(pop);
      open = box; box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); pop.classList.add('on'); place(box, pop); y0 = scrollY;
      return;
    }
    if (open && !open.contains(e.target) && !open._pop.contains(e.target)) close();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('resize', close);
  addEventListener('scroll', () => { if (open && Math.abs(scrollY - y0) > 40) close(); }, { passive: true });
  return { close };
}

// ---------- "drag the wall": a tag that follows the pointer over the hero until the reader has dragged once
export function cursorTag() {
  const stage = $('#hero-stage'), tag = stage && $('.cursor-tag', stage);
  if (!tag || !fine) return;
  let done = false;
  stage.addEventListener('pointermove', (e) => {
    if (done) return;
    const r = stage.getBoundingClientRect();
    tag.style.left = (e.clientX - r.left) + 'px'; tag.style.top = (e.clientY - r.top) + 'px';
    tag.classList.add('on');
  });
  stage.addEventListener('pointerleave', () => tag.classList.remove('on'));
  stage.addEventListener('pointerdown', (e) => { if (e.target.closest('.handle') || e.target.tagName === 'VIDEO' || e.target.tagName === 'CANVAS') { done = true; tag.classList.remove('on'); } });
}

// ---------- buttons lean toward the pointer a little (never further than 5 px)
export function magnetic(sel = '.links .btn, .iconbtn, .bib .copy') {
  if (!fine || reduceMotion) return;
  for (const b of $$(sel)) {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
      b.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  }
}

// ---------- cards tilt toward the pointer, with a soft yellow light under it
export function tilt(sel = '.task') {
  if (!fine || reduceMotion) return;
  for (const c of $$(sel)) {
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.transform = `rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 9}deg) translateZ(0)`;
      c.style.setProperty('--mx', x * 100 + '%'); c.style.setProperty('--my', y * 100 + '%');
    });
    c.addEventListener('pointerleave', () => { c.style.transform = ''; });
  }
}

// ---------- headlines never end on a line with one word: shrink the headline (down to 85%) until that word joins the line
// above; if it cannot, balance the lines instead. Measured on the words as laid out (SplitText's word boxes when split).
function lineWords(h) {
  const tops = [];
  const ws = h.querySelectorAll('.w');
  if (ws.length) for (const w of ws) tops.push(Math.round(w.getBoundingClientRect().top));
  else {
    const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let n;
    while ((n = walk.nextNode())) { const re = /\S+/g; let m; while ((m = re.exec(n.textContent))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + 1); const b = r.getBoundingClientRect(); if (b.width) tops.push(Math.round(b.top)); } }
  }
  const lines = []; for (const t of tops) { const l = lines.find(x => Math.abs(x.t - t) < 6); if (l) l.n++; else lines.push({ t, n: 1 }); }
  return lines.sort((a, b) => a.t - b.t);
}
export function noOrphans(sel = '.head h2, .pg-side h3, .finding .k, .task h3, .limit h3, .tagline') {
  let changed = false;
  for (const h of $$(sel)) {
    const before = h.style.fontSize;
    h.style.fontSize = ''; h.style.textWrap = '';
    let L = lineWords(h);
    if (L.length < 2 || L[L.length - 1].n > 1) { if (before) changed = true; continue; }
    const base = parseFloat(getComputedStyle(h).fontSize), n0 = L.length;
    let ok = false;
    for (let f = 0.98; f >= 0.849; f -= 0.01) { h.style.fontSize = (base * f).toFixed(2) + 'px'; L = lineWords(h); if (L.length < n0 && (L.length < 2 || L[L.length - 1].n > 1)) { ok = true; break; } }
    if (!ok) { h.style.fontSize = ''; h.style.textWrap = 'balance'; }
    changed = true;
  }
  return changed;
}
