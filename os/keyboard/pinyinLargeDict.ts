export type PinyinDictJson = Record<string, string[]>;

let cache: PinyinDictJson | null = null;
let inflight: Promise<PinyinDictJson | null> | null = null;
let loadAttempted = false;
let loadFailed = false;

/**
 * Load prebuilt dictionary from `/ime/pinyin_dict.json`.
 * - Returns null if not available (so IME can fall back to the built-in dict).
 * - Only attempts to load once; subsequent calls return cached result.
 */
export function loadPinyinDict(): Promise<PinyinDictJson | null> {
  if (cache) return Promise.resolve(cache);
  if (loadFailed) return Promise.resolve(null);
  if (inflight) return inflight;

  loadAttempted = true;

  inflight = (async () => {
    try {
      // Use a small timeout to avoid blocking if server is slow
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch('/ime/pinyin_dict.json', {
        cache: 'force-cache' as RequestCache,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        loadFailed = true;
        return null;
      }
      
      const json = (await res.json()) as PinyinDictJson;
      if (!json || typeof json !== 'object') {
        loadFailed = true;
        return null;
      }
      
      cache = json;
      return cache;
    } catch (e) {
      // Network error, timeout, or parsing error
      loadFailed = true;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Get the dictionary synchronously if already loaded.
 * Returns null if not yet loaded or failed to load.
 */
export function getPinyinDictSync(): PinyinDictJson | null {
  return cache;
}

/**
 * Check if the dictionary is currently loading.
 */
export function isDictLoading(): boolean {
  return inflight !== null;
}

/**
 * Check if the dictionary has been loaded successfully.
 */
export function isDictLoaded(): boolean {
  return cache !== null;
}

/**
 * Preload the dictionary (call early in app lifecycle).
 */
export function preloadPinyinDict(): void {
  if (!loadAttempted) {
    loadPinyinDict();
  }
}
