export interface ITunesResult {
  artworkUrl100: string;
  trackName: string;
  wrapperType?: string;
  kind?: string;
  [key: string]: unknown;
}

export interface ITunesResponse {
  resultCount: number;
  results: ITunesResult[];
}

/**
 * Type-safe JSONP callback registration via Object.defineProperty,
 * avoiding `(window as any)` while still setting a global callback
 * that JSONP script tags can invoke.
 */
export function setJsonpCallback<T = unknown>(name: string, fn: (data: T) => void): void {
  Object.defineProperty(window, name, { value: fn, configurable: true, writable: true });
}

export function removeJsonpCallback(name: string): void {
  const noop = () => {
    Reflect.deleteProperty(window, name);
  };
  Object.defineProperty(window, name, { value: noop, configurable: true, writable: true });
  window.setTimeout(() => {
    if (Reflect.get(window, name) === noop) {
      Reflect.deleteProperty(window, name);
    }
  }, 30000);
}
