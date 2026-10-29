import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useActivityContext } from '@/os/ActivityContext';
import { useBrowserStore } from '../state';

/** Only absolute web URLs are accepted from the declared external entry. */
export function browserExternalUrl(search: string, intentUrl?: unknown): string | null {
  const params = new URLSearchParams(search);
  const value = params.has('url') ? params.get('url') : intentUrl;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

export function useBrowserExternalEntry() {
  const location = useLocation();
  const { activityId, taskId } = useActivityContext();
  const consumedIntent = useRef(false);
  useEffect(() => {
    if (location.pathname !== '/view') return;
    const intentUrl = !consumedIntent.current
      ? window.__OS__?.getState().tasks.find(task => task.taskId === taskId)?.stack.find(activity => activity.activityId === activityId)?.intent?.data?.url
      : undefined;
    consumedIntent.current = true;
    const url = browserExternalUrl(location.search, intentUrl);
    if (!url) return;
    const state = useBrowserStore.getState();
    if (state.tabs.find(tab => tab.id === state.activeTabId)?.url !== url) state.navigateTab(state.activeTabId, url);
    // Tab selection and home/internal navigation keep their existing behavior.
    // Only a new /view location or Back to a URL entry consumes an external URL.
  }, [activityId, taskId, location.key, location.pathname, location.search]);
}
