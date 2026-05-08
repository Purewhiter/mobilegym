import { useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { NAVIGATION_DECLARATION } from './navigation.declaration';
import { memoryHistoryPopTo } from '../../os/utils/memoryHistoryPopTo';

type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = (
    id: TransitionId,
    params: Record<string, string | number> = {},
    options?: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean; state?: unknown },
  ) => {
    const t = NAVIGATION_DECLARATION.transitions.find(x => x.id === id);
    if (!t) throw new Error(`Transition not found: ${id}`);

    // Simple path param replacement
    let targetPath: string = t.to;
    if (t.params) {
      for (const [key, _type] of Object.entries(t.params)) {
        const val = params[key];
        if (val === undefined) throw new Error(`Missing param ${key} for transition ${id}`);
        targetPath = targetPath.replace(`:${key}`, String(val));
      }
    }

    // Search params
    const newSearchParams = new URLSearchParams();
    // Static search
    if (t.search) {
      for (const [k, v] of Object.entries(t.search)) {
        if (v !== null && typeof v === 'string') newSearchParams.set(k, v);
      }
    }
    // Dynamic search params
    if (t.searchParams) {
      for (const k of Object.keys(t.searchParams)) {
        if (params[k] !== undefined) {
          newSearchParams.set(k, String(params[k]));
        }
      }
    }

    const searchStr = newSearchParams.toString();
    const targetUrl = searchStr ? `${targetPath}?${searchStr}` : targetPath;

    if (options?.popTo) {
      memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
    }
    const mode = options?.mode ?? t.mode;
    const navOpts: { replace?: boolean; state?: unknown } = mode === 'replace' ? { replace: true } : {};
    if (options?.state !== undefined) navOpts.state = options.state;
    navigate(targetUrl, Object.keys(navOpts).length ? navOpts : undefined);
  };

  const back = (steps = 1) => {
    navigate(-steps);
  };

  return { go, back };
}
