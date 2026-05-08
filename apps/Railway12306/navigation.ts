import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useNavigate, useLocation } from 'react-router-dom';
import { NAVIGATION_DECLARATION, TransitionId } from './navigation.declaration';
import type { TransitionDeclaration } from './navigation.types';
import { memoryHistoryPopTo } from '../../os/utils/memoryHistoryPopTo';

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = useCallback(
    (
      id: TransitionId,
      params: Record<string, string | number> = {},
      options?: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean; state?: unknown },
    ) => {
      const t = NAVIGATION_DECLARATION.transitions.find(
        tr => tr.id === id,
      ) as TransitionDeclaration | undefined;
      if (!t) throw new Error(`Transition not found: ${id}`);

      const targetPathname = t.to.replace(/:(\\w+)/g, (_, key) => {
        const value = params[key];
        if (value === undefined) throw new Error(`Missing param "${key}" for path "${t.to}"`);
        return String(value);
      });

      const newParams = new URLSearchParams();
      for (const [key, value] of Object.entries(t.search)) {
        if (value !== null) newParams.set(key, value);
      }
      for (const key of Object.keys(t.searchParams || {})) {
        const value = params[key];
        if (value !== undefined) newParams.set(key, String(value));
      }

      const searchStr = newParams.toString();
      const targetUrl = searchStr ? `${targetPathname}?${searchStr}` : targetPathname;
      if (options?.popTo) {
        memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
      }
      const mode = options?.mode ?? t.mode;
      const navOptions: { replace?: boolean; state?: unknown } = {};
      if (mode === 'replace') navOptions.replace = true;
      if (options?.state !== undefined) navOptions.state = options.state;
      navigate(targetUrl, Object.keys(navOptions).length > 0 ? navOptions : undefined);
    },
    [navigate, location.pathname, location.search, navigator],
  );

  const back = useCallback(
    (steps: number = 1) => {
      navigate(-steps);
    },
    [navigate],
  );

  return { go, back };
}
