// Task 3: the paper's 16 open-domain pairs (raw / + NoPeWorld, collision mode), each pair on one clock, SAM 2 tracks.
import { $, $$, el, GEN_NAME, getBench, getClips, onVisible } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';

const WORD = { through: 'passes through', stops: 'stops', avoids: 'avoids it', 'stops early': 'stops early' };

export async function initOpen() {
  const B = await getBench(), C = await getClips();
  const gridEl = $('#t3grid');
  const cards = [];
  for (const t of B.task3) {
    const g = new SyncGroup({ fps: 16 });
    const a = makeTile(g, { label: 'Raw model', dot: 'raw' }), b = makeTile(g, { label: '+ NoPeWorld', dot: 'ours' });
    const idA = `t3_${t.case}__${t.generator}__raw`, idB = `t3_${t.case}__${t.generator}__collision`;
    a.setClip(idA, 'hi', `media/posters/${idA}.webp`, C[idA]?.track);
    b.setClip(idB, 'hi', `media/posters/${idB}.webp`, C[idB]?.track);
    const btn = el('button', { class: 'iconbtn', 'aria-label': 'Play' });
    const card = el('div', { class: 't3' },
      el('div', { class: 'top' }, el('b', {}, GEN_NAME[t.generator]),
        el('span', { class: 'vl' }, el('span', { class: 'chip plain' }, t.block === 'static' ? 'static obstacle' : 'moving obstacle'), el('span', { class: 'chip plain' }, t.person === 'fp' ? 'first person' : 'third person'))),
      el('div', { class: 'pair' }, a.root, b.root),
      el('div', { class: 'top' }, el('span', { class: 'vl' }, btn,
        el('span', {}, 'VLM judges:'), el('span', { class: 'chip viol' }, `raw ${WORD[t.raw_word[0]] || t.raw_word[0]} · ${t.raw_word[1]}`),
        el('span', { class: 'chip ok' }, `ours ${WORD[t.ours_word[0]] || t.ours_word[0]} · ${t.ours_word[1]}`))));
    card.title = `${t.case}: the number after each verdict is how many VLM judges gave it`;
    wirePlayer(g, { button: btn });
    gridEl.append(card);
    cards.push({ t, card, g, tiles: [a, b] });
    onVisible(card, (v) => { g.setVisible(v); if (v && !g.started) { g.started = true; g.play(); } }, 0.35);
  }
  let block = 'all', person = 'all';
  const filt = () => { cards.forEach(c => { c.card.hidden = !((block === 'all' || c.t.block === block) && (person === 'all' || c.t.person === person)); }); dispatchEvent(new Event('nope:layout')); };
  $$('#t3-block button').forEach(b => b.addEventListener('click', () => { $$('#t3-block button').forEach(x => x.setAttribute('aria-pressed', x === b)); block = b.dataset.b; filt(); }));
  $$('#t3-person button').forEach(b => b.addEventListener('click', () => { $$('#t3-person button').forEach(x => x.setAttribute('aria-pressed', x === b)); person = b.dataset.p; filt(); }));
  dispatchEvent(new Event('nope:layout'));
  $('#t3-ov').addEventListener('change', (e) => cards.forEach(c => c.tiles.forEach(t => { t.overlay.setOn(e.target.checked); t.overlay.draw(c.g.frameOf(t.video.currentTime)); })));
}
