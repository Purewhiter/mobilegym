import { useCallback, useEffect, useRef } from 'react';

/**
 * Run an async submit one at a time, then the follow-up (usually `back()`)
 * only if the page is still mounted.
 *
 * Device-backed store actions resolve after a server round trip. Without this,
 * a second tap while the first is in flight submits twice and navigates twice,
 * and a follow-up can fire after the user already left the page.
 */
export function useSubmitOnce() {
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return useCallback(async (work: () => Promise<unknown>, then?: () => void) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await work();
    } finally {
      busy.current = false;
    }
    if (mounted.current) then?.();
  }, []);
}
