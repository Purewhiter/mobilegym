import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_DECLARATION, TransitionId } from './navigation.declaration';
import type { TransitionDeclaration, FromConstraint } from './navigation.types';
import { memoryHistoryPopTo } from '../../os/utils/memoryHistoryPopTo';

export function useAppNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  const go = useCallback(
    (
      id: TransitionId, 
      params: Record<string, string | number> = {}, 
      options: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean } = {}
    ) => {
      const searchParams = new URLSearchParams(location.search);

      const t = NAVIGATION_DECLARATION.transitions.find(
        transition => transition.id === id,
      ) as TransitionDeclaration | undefined;
      if (!t) {
        throw new Error(`Transition not found: ${id}`);
      }

      if (!matchFrom(t.from, location.pathname, searchParams)) {
        throw new Error(
          `Transition "${id}" not allowed from "${location.pathname}${location.search}"`,
        );
      }

      const targetPathname = replaceParams(t.to, params);

      const newParams = buildSearchParams({
        currentSearchParams: searchParams,
        preserveParams: t.preserveParams || [],
        staticSearch: t.search,
        dynamicSearchParams: t.searchParams,
        runtimeParams: params,
      });

      const searchStr = newParams.toString();
      const targetUrl = searchStr ? `${targetPathname}?${searchStr}` : targetPathname;

      const finalMode = options.mode || t.mode;
      if (options.popTo) {
        memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
      }
      navigate(targetUrl, finalMode === 'replace' ? { replace: true } : undefined);
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

function matchFrom(
  from: TransitionDeclaration['from'],
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (from === '*') return true;
  const constraints = Array.isArray(from) ? from : [from];

  return constraints.some(constraint => {
    if (constraint === '*') return true;
    if (typeof constraint === 'string') {
      return matchRoute(constraint, pathname);
    }

    if (!matchRoute(constraint.path, pathname)) {
      return false;
    }

    if (constraint.search) {
      for (const [key, expected] of Object.entries(constraint.search)) {
        const actual = searchParams.get(key);

        if (expected === '*') {
          if (!actual) return false;
        } else if (expected === null) {
          if (actual !== null) return false;
        } else if (actual !== expected) {
          return false;
        }
      }
    }

    return true;
  });
}

function buildSearchParams(options: {
  currentSearchParams: URLSearchParams;
  preserveParams: string[];
  staticSearch: Record<string, string | null>;
  dynamicSearchParams: Record<string, 'string' | 'number'>;
  runtimeParams: Record<string, string | number>;
}): URLSearchParams {
  const { currentSearchParams, preserveParams, staticSearch, dynamicSearchParams, runtimeParams } =
    options;

  const newParams = new URLSearchParams();

  for (const key of preserveParams) {
    const value = currentSearchParams.get(key);
    if (value !== null) {
      newParams.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(staticSearch)) {
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  }

  for (const key of Object.keys(dynamicSearchParams)) {
    const value = runtimeParams[key];
    if (value !== undefined) {
      newParams.set(key, String(value));
    }
  }

  return newParams;
}

function replaceParams(path: string, params: Record<string, string | number>): string {
  return path.replace(/:(\w+)/g, (_, key) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing param "${key}" for path "${path}"`);
    }
    return String(value);
  });
}

function matchRoute(template: string, path: string): boolean {
  if (template === '*') return true;
  const regex = new RegExp('^' + template.replace(/:\w+/g, '[^/]+') + '$');
  return regex.test(path);
}
