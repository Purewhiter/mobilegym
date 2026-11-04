import { useCallback, useEffect, useState } from 'react';

/**
 * A toast that hides itself after `ms`.
 *
 * The timer belongs to the shown toast, not to the call that showed it: a page
 * hidden on the back stack (ActivityRouteHost) cleans up its effects, and when
 * it is shown again a still-visible toast gets its timer back instead of staying up.
 */
export function useTimedToast(ms = 1600) {
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), ms);
    return () => window.clearTimeout(timer);
  }, [toast, ms]);

  const showToast = useCallback((message: string) => setToast({ visible: true, message }), []);
  return { toast, showToast };
}
