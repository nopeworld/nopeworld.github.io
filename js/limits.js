// Honest limits: each claim with its number and source, and a real clip where one shows it.
import { $, el, getBench, getClips, chip, json, onVisible } from './util.js';
import { SyncGroup, wirePlayer } from './sync.js';
import { makeTile } from './tiles.js';
import { infoBox } from './ui.js';

export async function initLimits() {
  const B = await getBench(), C = await getClips(), R = await json('data/results.json');
  const row = (g, m) => R.rows.find(r => r.generator === g && r.method === m);
  const res = (route, g, m) => B.routes.find(r => r.id === route).res[g][m];
  // generators on which the halt-only guard has fewer Task 2 violations than collision mode (the paper: four of them)
  const SHORT = { lingbot: 'LingBot', hy: 'HY', echo: 'Echo', evoke: 'Evoke', worldplay2: 'WorldPlay2', hynomas: 'Hy-Nomas' };
  const fewer = R.generators.map(g => g.id).filter(g => row(g, 'depth') && row(g, 'depth').viol_p < row(g, 'collision').viol_p);
  const and = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const L = [
    { h: 'It often stops where Unreal would slide.',
      p: 'On 37 LingBot-World 2.0 routes the head plays safe: the best slide scores a median 0.78, just under τ = 0.85.',
      info: 'Collision mode; 33 routes in prediction mode (median 0.84). The head\'s safety estimate for the best slide at its first change of the input, on the Task 2 routes (VGGT-Ω verdicts).', clips: [['CourtYard__n017__unreal', 'Unreal slides', 'unreal'], ['CourtYard__n017__lingbot__collision', 'LingBot + NoPeWorld stops', 'ours']] },
    { h: 'WorldPlay2 coasts after a STOP.',
      p: `Driven by keys, it keeps moving after a STOP. Violations fall ${row('worldplay2', 'raw').viol_p}% → ${row('worldplay2', 'collision').viol_p}%, but it slides less (${row('worldplay2', 'raw').slide_p} → ${row('worldplay2', 'collision').slide_p}) and its SIS stays below the raw model's (${row('worldplay2', 'raw').sis_p} vs ${row('worldplay2', 'collision').sis_p}).`,
      info: 'In this clip the head sends STOP in all five chunks, yet the camera keeps moving about 2 m sideways and the evaluator finds the obstacle erased from view. Coasting was measured by forcing each candidate on open control routes: it goes back in about 20% of STOP-after-STOP chunks, and a SLOW comes out at full speed because its keys are binary. Numbers: the main table.',
      clips: [['WildWest__n000__unreal', 'Unreal (ground truth)', 'unreal'], ['WildWest__n000__worldplay2__prediction', 'WorldPlay2 + NoPeWorld: STOP ×5', 'ours']] },
    { h: 'HY-WorldPlay overshoots what it is told.',
      p: 'It renders SLOW at 1.5–1.8× and steep slides at 1.4–3× their commanded length. The right motion is picked; more of it is drawn.',
      info: 'It obeys STOP within one chunk but carries about 0.18 m. Measured by forcing each candidate on open control routes (camera paths from DA3).',
      big: '1.4–3×', bigSub: 'steep slides drawn, × commanded length', clips: [] },
    { h: `Hy-Nomas still violates on ${row('hynomas', 'collision').viol_p}% of routes.`,
      p: `${row('hynomas', 'raw').viol_p}% → ${row('hynomas', 'collision').viol_p}% with NoPeWorld; external depth reaches ${row('hynomas', 'depth').viol_p}%. Here it slides ${res('CourtYard__n017', 'hynomas', 'prediction')[3]} m where Unreal slides 1.65 m.`,
      info: 'Collision mode in the main table; the clip is prediction mode on the teaser route, and the slide lengths are the evaluator\'s record.',
      clips: [['CourtYard__n017__unreal', 'Unreal slides 1.65 m', 'unreal'], ['CourtYard__n017__hynomas__prediction', 'Hy-Nomas + NoPeWorld (Pred)', 'ours']] },
    { h: 'A halt-only guard can have fewer violations.',
      p: `External depth violates less on ${and(fewer.map(g => SHORT[g]))} (${fewer.map(g => `${row(g, 'depth').viol_p}% vs ${row(g, 'collision').viol_p}%`).join(', ')}), but only by halting: its Slide is ${and(fewer.map(g => String(row(g, 'depth').slide_p)))}.`,
      info: 'External depth decodes every chunk and halts when DA3 sees the input unsafe. Main table (Task 2).',
      big: `${row('lingbot', 'depth').viol_p}% vs ${row('lingbot', 'collision').viol_p}%`, bigSub: 'LingBot violations: external depth vs. NoPeWorld', clips: [] },
    { h: 'Task 3 has no geometry, only judges.',
      p: 'Open-domain images have no 3D ground truth. Four VLMs judge each video; we report the two closest to people.',
      info: 'The reported rate is the mean of the two judges that agree best with three human annotators on 269 videos (Claude Opus 5.5, GPT-6 Astra), under one fixed prompt. Also: the 12 drone and car routes of Task 2 are faster than any training state. Paper, Sec. "Evaluators and metrics"; supplementary.',
      big: '4 VLMs', bigSub: 'judge every Task 3 video', clips: [] },
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
