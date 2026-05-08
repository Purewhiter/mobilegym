(function () {
  const button = document.querySelector('[data-bibtex-copy]');
  if (!button) return;

  const targetSelector = button.getAttribute('data-bibtex-copy');
  const target = targetSelector ? document.querySelector(targetSelector) : button.previousElementSibling;
  if (!target) return;

  const defaultLabel = button.textContent;
  let resetTimer = null;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(target.innerText);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Copy failed';
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { button.textContent = defaultLabel; }, 1500);
  });
})();
