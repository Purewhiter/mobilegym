(function () {
  const demo = document.getElementById('demo');
  if (!demo || !demo.classList.contains('hero-demo')) return;

  // The boot button (#demo-boot-btn) is replaced by the iframe on power-on
  // and re-rendered on power-off (state-builder.js owns innerHTML), so bind
  // via delegation rather than a static listener.
  demo.addEventListener('click', (event) => {
    if (event.target.closest('#demo-boot-btn')) {
      requestAnimationFrame(() => demo.classList.add('is-booted'));
    }
  });

  const offBtn = document.getElementById('demo-poweroff-btn');
  if (offBtn) {
    offBtn.addEventListener('click', () => {
      demo.classList.remove('is-booted');
    });
  }

  // Gesture Guide → live hardware-key triggers. Each icon button in the
  // left legend (.gesture-guide-icon[data-gesture-action]) calls the
  // matching __OS__ method inside the same-origin iframe. Pre-boot the
  // panel is opacity:0 + pointer-events:none (see .gesture-guide CSS),
  // so these handlers only fire once the simulator is mounted.
  const GESTURE_ACTIONS = {
    back: (os) => os.handleBack?.(),
    home: (os) => os.goHome?.(),
    recents: (os) => os.showRecents?.(),
  };
  demo.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-gesture-action]');
    if (!btn) return;
    const action = GESTURE_ACTIONS[btn.dataset.gestureAction];
    if (!action) return;
    const iframe = document.querySelector('#demo-frame iframe');
    const os = iframe?.contentWindow?.__OS__;
    if (!os) return;
    try { action(os); } catch (err) { console.warn('[gesture-key]', err); }
  });

  // Fade out the "Scroll to read paper" hint once the user has scrolled past it.
  // Hint is position:fixed (so it stays in the viewport even when the phone is
  // taller than the screen), so we hide it on scroll instead of letting it
  // overlap paper content below.
  let scrolled = false;
  const onScroll = () => {
    const past = window.scrollY > 60;
    if (past !== scrolled) {
      scrolled = past;
      document.body.classList.toggle('hero-scrolled', past);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
