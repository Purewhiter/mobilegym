// Snapshot capture for the demo agent.
//
// This intentionally does not use browser tab screenshots or the Screen
// Capture API. The simulator is same-origin, so we render the phone's own
// React root inside the iframe with snapdom and send that 360x800 image to the
// model.

const SCREEN_W = 360;
const SCREEN_H = 800;
const SNAPDOM_URL = new URL('../vendor/snapdom-2.12.8.mjs', import.meta.url).href;

const rendererPromises = new WeakMap();

export function isSupported() {
  return true;
}

export function isActive() {
  return true;
}

export async function grab({ win }) {
  if (!win || !win.document) {
    throw new Error('Simulator window is not available for snapshot capture.');
  }

  const snapdom = await ensureSnapdom(win);
  const target = win.document.getElementById('root') || win.document.body;
  if (!target) throw new Error('Simulator root element was not found.');

  const captureOptions = {
    width: SCREEN_W,
    height: SCREEN_H,
    scale: 1,
    backgroundColor: '#ffffff',
    quality: 0.82,
  };

  const result = typeof snapdom.toJpg === 'function'
    ? await snapdom.toJpg(target, captureOptions)
    : await snapdom.toPng(target, { ...captureOptions, backgroundColor: 'transparent' });

  const dataUrl = typeof result === 'string' ? result : result?.src;
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    throw new Error('snapdom did not return an image data URL.');
  }
  return dataUrl;
}

async function ensureSnapdom(win) {
  if (win.__mgAgentSnapdom?.toPng) return win.__mgAgentSnapdom;
  if (rendererPromises.has(win)) return rendererPromises.get(win);

  const promise = win.eval(`import(${JSON.stringify(SNAPDOM_URL)})`).then((mod) => {
    const snapdom = mod.snapdom || mod.default || mod;
    if (!snapdom || typeof snapdom.toPng !== 'function') {
      throw new Error('snapdom loaded but did not expose toPng().');
    }
    win.__mgAgentSnapdom = snapdom;
    return snapdom;
  });

  rendererPromises.set(win, promise);
  return promise;
}

export function stop() {
  // Kept for the console power-off hook. Snapshot capture has no persistent
  // browser stream to tear down.
}
