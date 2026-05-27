let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerMapServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (registrationPromise) return registrationPromise;

  registrationPromise = navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}map-sw.js`, { scope: import.meta.env.BASE_URL })
    .then((registration) => {
      console.log('[Map] Service Worker 已注册');
      return registration;
    })
    .catch((err) => {
      console.warn('[Map] Service Worker 注册失败', err);
      return null;
    });

  return registrationPromise;
}

// ready 通常在 SW install 完成后毫秒级 resolve（已 active 的话立即）。
// 拉到 60s 是纯防御性：install 已经在 map-sw.js 里包了 catch 保证永远成功，
// 理论上不会触发这个 timeout。但万一遇到 pathological 情况，60s 比"永远卡住"好，
// 同时也足够慢到不会在 bench 首次冷启动时被假阳性触发把 SDK 放出去走网络。
const READY_TIMEOUT_MS = 60_000;
const CONTROLLER_TIMEOUT_MS = 5_000;

/**
 * 注册 SW 并等待它接管当前页面。
 * 首次访问时，SW 从 install → activate → clients.claim() 是异步的，期间发出的
 * 请求不会被拦截。Maps SDK loader 必须在 SW 接管后才发请求，否则 placeholder key
 * 会被 Google 直接拒绝（返回 HTML 错误页，JS 解析失败）。
 *
 * 解决 race + 防止永久挂住：
 *   1. 注册 SW；返回 null（不支持/被禁/文件 404）就直接放弃，不要 await ready，
 *      否则在非安全上下文等场景下 ready 会一直 pending，把 SDK 加载挡死。
 *   2. 给 ready 加 5s 超时，即使注册成功也避免在异常环境下 hang。
 *   3. 等 controllerchange 同样 5s 超时。
 */
export async function ensureMapServiceWorkerControlling(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await registerMapServiceWorker();
  if (!registration) {
    console.warn('[Map] Service Worker 不可用，跳过 SW 等待');
    return;
  }
  const ready = await Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
  if (!ready) {
    console.warn(`[Map] navigator.serviceWorker.ready 超过 ${READY_TIMEOUT_MS}ms 未返回，继续加载 SDK（可能未被 SW 拦截）`);
    return;
  }
  if (navigator.serviceWorker.controller) return;
  await new Promise<void>((resolve) => {
    const onChange = () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.removeEventListener('controllerchange', onChange);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve();
    }, CONTROLLER_TIMEOUT_MS);
  });
}
