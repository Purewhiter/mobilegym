import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Values saved per history entry (location.key), like an Android activity's saved
// instance state: leaving the page unmounts it, coming back to the same entry
// restores them, a new entry (a new search) starts fresh. Runtime only.
const saved = new Map<string, Record<string, unknown>>();

/**
 * useState whose value survives the page being unmounted and revisited through back.
 * Entries of a sheet over the page (?sheet=...) share the page's entry: edits made
 * in the sheet stay after closing it.
 */
export function useEntryState<T>(name: string, initial: T | (() => T)) {
  const { key, search } = useLocation();
  const overSheet = new URLSearchParams(search).has('sheet');
  const pageKey = useRef(key);
  if (!overSheet) pageKey.current = key;
  const entryKey = pageKey.current;

  const [value, setValue] = useState<T>(() => {
    const entry = saved.get(entryKey);
    if (entry && name in entry) return entry[name] as T;
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  // Moving to another page entry while mounted: one seen before gets its values back,
  // a new one carries the current values on.
  const lastKey = useRef(entryKey);
  useEffect(() => {
    if (lastKey.current === entryKey) return;
    lastKey.current = entryKey;
    const entry = saved.get(entryKey);
    if (entry && name in entry) setValue(entry[name] as T);
  }, [entryKey, name]);
  useEffect(() => {
    saved.set(entryKey, { ...saved.get(entryKey), [name]: value });
  }, [entryKey, name, value]);
  return [value, setValue] as const;
}
