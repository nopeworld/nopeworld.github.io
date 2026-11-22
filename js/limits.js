// Honest limits: each claim with its number and source, and a real clip where one shows it.
import { $, el, getBench, getClips, chip, json, onVisible } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { infoBox } from './ui.js';

export async function initLimits() {
  const B = await getBench(), C = await getClips(), R = await json('data/results.json');
  const row = (g, m) => R.rows.find(r => r.generator === g && r.method === m);
  const res = (route, g, m) => B.routes.find(r => r.id === route).res[g][m];
  // three limits, each one of the generator itself: the head picks the motion, the generator still has to render it
  const L = [
    { h: 'WorldPlay2 coasts after a STOP.',
      p: `A limit of the model itself: driven by binary keys, it keeps walking after a STOP and renders a SLOW at full speed. NoPeWorld removes its violations (${row('worldplay2', 'raw').viol_p}% → ${row('worldplay2', 'collision').viol_p}%), but the stops cut its native slide (${row('worldplay2', 'raw').slide_p} → ${row('worldplay2', 'collision').slide_p}), so its SIS stays below the raw model's (${row('worldplay2', 'raw').sis_p} vs ${row('worldplay2', 'collision').sis_p}).`,
      info: 'In this clip the head sends STOP in all five chunks, yet the camera keeps moving, about 3 m sideways, and the evaluator finds the obstacle erased from view. Coasting was measured by forcing each candidate on open control routes: it goes back in about 20% of STOP-after-STOP chunks. Numbers: the main table.',
      clips: [['WildWest__n000__unreal', 'Unreal', 'unreal'], ['WildWest__n000__worldplay2__prediction', 'NoPeWorld: STOP ×5', 'ours']] },
    { h: 'HY-WorldPlay draws more than it is told.',
      p: 'A limit of the model itself: it renders SLOW at 1.5–1.8× and steep slides at 1.4–3× their commanded length. NoPeWorld picks the right motion; the model draws more of it.',
      info: 'It obeys STOP within one chunk but carries about 0.18 m. Measured by forcing each candidate on open control routes (camera paths from DA3).',
      big: '1.4–3×', bigSub: 'steep slides drawn, × commanded length', clips: [] },
    { h: 'Hy-Nomas overshoots the commanded motion.',
      p: `A limit of the model itself: its camera control does not keep the commanded speed, so a slide runs far past the engine's, here ${res('CourtYard__n017', 'hynomas', 'prediction')[3]} m where Unreal slides 1.65 m. Even with NoPeWorld it violates on ${row('hynomas', 'collision').viol_p}% of routes (${row('hynomas', 'raw').viol_p}% raw).`,
      info: 'Collision mode in the main table; the clip is prediction mode on the teaser route, and the slide lengths are the evaluator\'s record.',
      clips: [['CourtYard__n017__unreal', 'Unreal: 1.65 m', 'unreal'], ['CourtYard__n017__hynomas__prediction', 'NoPeWorld (Pred)', 'ours']] },
  ];
  const box = $('#limits-grid');
  L.forEach((l, i) => {
    const txt = el('div', { class: 'txt' }, el('span', { class: 'num' }, String(i + 1).padStart(2, '0') + ' / ' + String(L.length).padStart(2, '0')), el('h3', {}, l.h), el('p', {}, l.p, ' ', infoBox(l.info, 'Source and details')));
    const side = el('div', { class: 'side' });
    const card = el('div', { class: 'limit' }, txt, side);
    if (l.clips.length) {
      const g = new SyncGroup({ fps: 16 });
      const wrap = el('div', { class: l.clips.length > 1 ? 'duo' : '' });
      for (const [id, lab, dot] of l.clips) {
        const t = makeTile(g, { label: lab, dot });
        const caseId = id.split('__').slice(0, 2).join('__');
        const res2 = C[id]?.hi ? 'hi' : C[id]?.lo ? 'lo' : null;
        if (res2) t.setClip(id, res2, `media/posters/${caseId}${res2 === 'lo' ? '_s' : ''}.webp`, C[id].track); else t.missing('clip not encoded yet');
        const parts = id.split('__');
        if (parts.length === 4) { const q = res(caseId, parts[2], parts[3]); if (q) t.setVerdict(chip(q[0], B.categories, q[0] === 'slid' ? ` ${q[3]} m` : '')); }
        wrap.append(t.root);
      }
      const btn = el('button', { class: 'iconbtn', 'aria-label': 'Play' });
      wirePlayer(g, { button: btn });
      side.append(wrap, el('div', { class: 'controls', style: { margin: 0 } }, btn));
      card._group = g;     // the stacking animation pauses a card once the next one covers it
      onVisible(card, (v) => { g.setVisible(v); if (v && !g.started) { g.started = true; g.play(); } }, 0.4);
    } else side.append(el('div', { class: 'big' }, l.big, el('small', {}, l.bigSub)));
    box.append(card);
  });
}
