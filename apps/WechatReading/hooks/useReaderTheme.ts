import { useMemo } from 'react';
import { useWechatReadingStore } from '../state';
import { resolveReaderTheme } from '../utils/readerTheme';

export function useReaderTheme() {
  const readerPrefs = useWechatReadingStore(s => s.readerPrefs);
  return useMemo(
    () => resolveReaderTheme(readerPrefs.themeColor, readerPrefs.themeBg),
    [readerPrefs.themeColor, readerPrefs.themeBg],
  );
}
