(function () {
  const TRACES = {
    base: {
      total: 60,
      frames: [
        { step:  8, src: 'figures/reddit_case/base_s08.jpg', action: 'opens the post composer' },
        { step: 11, src: 'figures/reddit_case/base_s11.jpg', action: 'types title 评测帖子' },
        { step: 14, src: 'figures/reddit_case/base_s14.jpg', action: 'first try — taps greyed-out 发帖 button' },
        { step: 20, src: 'figures/reddit_case/base_s20.jpg', action: 'taps the same greyed button again' },
        { step: 30, src: 'figures/reddit_case/base_s30.jpg', action: 'still tapping it (mid-loop)' },
        { step: 40, src: 'figures/reddit_case/base_s40.jpg', action: 'still tapping it' },
        { step: 50, src: 'figures/reddit_case/base_s50.jpg', action: 'still tapping it' },
        { step: 60, src: 'figures/reddit_case/base_s60.jpg', action: 'budget exhausted · flair * never noticed' },
      ],
    },
    trained: {
      total: 22,
      frames: [
        { step: 10, src: 'figures/reddit_case/trained_s10.jpg', action: 'opens the post composer' },
        { step: 11, src: 'figures/reddit_case/trained_s11.jpg', action: 'types title 评测帖子' },
        { step: 12, src: 'figures/reddit_case/trained_s12.jpg', action: 'taps body field — cursor ready to type' },
        { step: 13, src: 'figures/reddit_case/trained_s13.jpg', action: 'types body 评测帖子内容' },
        { step: 14, src: 'figures/reddit_case/trained_s14.jpg', action: 'first try — taps greyed-out 发帖 button' },
        { step: 15, src: 'figures/reddit_case/trained_s15.jpg', action: 'notices the * — taps the flair pill' },
        { step: 16, src: 'figures/reddit_case/trained_s16.jpg', action: 'opens the flair selector' },
        { step: 17, src: 'figures/reddit_case/trained_s17.jpg', action: 'picks 科技数码 flair · returns to publish' },
        { step: 18, src: 'figures/reddit_case/trained_s18.jpg', action: 'flair filled · 发帖 button now active · taps publish' },
      ],
    },
  };

  // Preload all frames so scrubbing is instant
  Object.values(TRACES).forEach(t => t.frames.forEach(f => { const img = new Image(); img.src = f.src; }));

  document.querySelectorAll('.trace-side').forEach(side => {
    const key = side.dataset.trace;
    const cfg = TRACES[key];
    const img = side.querySelector('.trace-frame');
    const slider = side.querySelector('.trace-slider');
    const action = side.querySelector('.trace-action');
    const ticks = side.querySelector('.trace-ticks');

    // Evenly-spaced ticks (one per frame), labelled with the actual step number
    ticks.innerHTML = cfg.frames.map(f => `<span class="trace-tick">${f.step}</span>`).join('');

    // Announce action-text changes to assistive tech as the user scrubs.
    action.setAttribute('aria-live', 'polite');

    const render = () => {
      const i = parseInt(slider.value, 10);
      const f = cfg.frames[i];
      img.src = f.src;
      action.innerHTML = `<span class="step-label">step ${f.step} / ${cfg.total}</span>${f.action}`;
      slider.setAttribute('aria-valuetext', `step ${f.step} of ${cfg.total}: ${f.action}`);
    };
    slider.addEventListener('input', render);
    render();
  });
})();
