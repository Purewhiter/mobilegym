/**
 * Calculator2 导航 hook — 最小实现（单页无 transitions）
 */

import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useNavigate } from 'react-router-dom';
import type { AppNavigateHook, NavigateOptions } from './navigation.types';
import { memoryHistoryPopTo } from '../../os/utils/memoryHistoryPopTo';

export function useAppNavigate(): AppNavigateHook {
  const navigate = useNavigate();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = useCallback((path: string, options?: NavigateOptions) => {
    const mode = options?.mode ?? 'push';
    if (options?.popTo) {
      memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
    }
    navigate(path, { replace: mode === 'replace' });
  }, [navigate, navigator]);

  const back = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return { go, back };
}
