/* Page configuration: the ONLY file to edit when links or authors change.
   Every link left empty ("") is shown as a dashed "soon" button and goes nowhere.
   The hero's author line is also written in index.html, so the page reads the same without JavaScript; keep both in step. */
window.NOPE_CONFIG = {
  links: {
    arxiv: "",      // the arXiv ID is not assigned yet (submission 8403577); then "https://arxiv.org/abs/XXXX.XXXXX"
    pdf: "",        // e.g. "https://arxiv.org/pdf/XXXX.XXXXX"
    code: "https://github.com/yuhangdai427/NoPeWorld",
    weights: "https://huggingface.co/PeterDAI/NoPeWorld",
    bench: "https://huggingface.co/datasets/PeterDAI/NoPeBench"
  },
  // as on the paper's first page; corresponding: shown with a mail link
  authors: [
    { name: "Yuhang Dai" },
    { name: "Yinwei Wu" },
    { name: "Ziyue Lin" },
    { name: "Han Ji" },
    { name: "Xingyi Yang", corresponding: "xingyi.yang@polyu.edu.hk" }
  ],
  affiliations: "Learning & Generation Lab, The Hong Kong Polytechnic University",
  // the promotional video after the abstract. On play the page tries YouTube; where YouTube cannot be reached (a thumbnail
  // does not load within 2.5 s, e.g. mainland China) it plays Bilibili if set, else our own file. Nothing loads before play.
  video_youtube: "dS64U7_3GQs",       // https://youtu.be/dS64U7_3GQs
  video_bilibili: "BV1Tqy5znEfA",     // https://www.bilibili.com/video/BV1Tqy5znEfA
  video: "media/promo/nopeworld_promo_1080p.mp4",   // our own copy (43.5 MB): the fallback, and the "file" link
  video_poster: "media/promo/nopeworld_promo_poster.webp",
  bibtex: {
    key: "nopeworld2026",
    title: "Non-penetrating World Models",
    author: "Dai, Yuhang and Wu, Yinwei and Lin, Ziyue and Ji, Han and Yang, Xingyi",
    year: "2026",
    note: "arXiv preprint" // add the ID once assigned, e.g. "arXiv preprint arXiv:XXXX.XXXXX"
  }
};
