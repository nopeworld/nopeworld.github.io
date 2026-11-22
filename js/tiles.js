// A video tile: video + obstacle overlay canvas + label + verdict chip, attached to a SyncGroup.
import { el, ICON, lowData } from './util.js';
import { Overlay, loadTrack } from './overlay.js';

export function makeTile(group, { label, dot, cls = '' } = {}) {
  const video = el('video', { muted: true, playsinline: true, preload: 'none', 'aria-hidden': 'true' });
  const canvas = el('canvas', { class: 'ov' });
  const lbl = el('div', { class: 'lbl' }, dot ? el('span', { class: `dot ${dot}` }) : null, label || '');
  const verdict = el('div', { class: 'verdict' });
  const play = el('button', { class: 'play need', 'aria-label': 'Play', html: ICON.bigplay, onclick: () => { group.play(true); } });
  const root = el('div', { class: `tile ${cls}` }, video, canvas, lbl, verdict, play);
  const overlay = new Overlay(canvas, video);
  group.add(video, (f) => overlay.draw(f));
  video.addEventListener('playing', () => root.classList.add('live'), { once: true });   // the clip fades in from its poster
  const t = {
    root, video, overlay, lbl, verdict,
    setLabel(text, d) { lbl.innerHTML = ''; if (d) lbl.append(el('span', { class: `dot ${d}` })); lbl.append(text); },
    setVerdict(node) { verdict.innerHTML = ''; if (node) { verdict.append(node); node.classList.add('pop'); } },
    async setClip(id, res, posterUrl, hasTrack) {
      root.classList.toggle('missing', !id);
      overlay.set(null);
      if (!id) { group.setSources([[video, '', posterUrl]]); return; }
      group.setSources([[video, `media/${res}/${id}.mp4`, posterUrl]]);
      if (hasTrack) { const tr = await loadTrack(id); if (video.dataset.src.endsWith(`/${id}.mp4`)) { overlay.set(tr); overlay.draw(group.frameOf(video.currentTime)); } }
    },
    missing(text) { root.dataset.missing = text; root.classList.add('missing'); group.setSources([[video, '', '']]); overlay.set(null); },
  };
  lowData.listen(() => play.classList.toggle('need', true));
  group.on(() => { if (group.playing) play.classList.remove('need'); });
  return t;
}
