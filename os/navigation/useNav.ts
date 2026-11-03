/**
 * Navigation inside an app's MemoryRouter: push / replace to a route from the
 * app's route table, or go back. Shared by every app instead of a per-app copy.
 */

import { useContext, useMemo } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { memoryHistoryPopToFirstMatch } from '../utils/memoryHistoryPopTo';
import { buildHref, type AppRoute, type NavTarget, type RouteParams, type SearchSpec, type SearchValues } from './routes';

export interface NavOptions<S extends SearchSpec = SearchSpec> extends NavTarget {
  search?: SearchValues<S>;
  /** Pop back to this path (or the first of these found in history) first, like Android's popUpTo. */
  popTo?: string | readonly string[];
  popToInclusive?: boolean;
  /** `location.state` of the new entry. */
  state?: unknown;
}

type ParamsArg<P extends string> = keyof RouteParams<P> extends never
  ? [params?: Record<string, never>]
  : [params: RouteParams<P>];

export interface Nav {
  push<P extends string, S extends SearchSpec>(route: AppRoute<P, S>, ...args: [...ParamsArg<P>, options?: NavOptions<S>]): void;
  replace<P extends string, S extends SearchSpec>(route: AppRoute<P, S>, ...args: [...ParamsArg<P>, options?: NavOptions<S>]): void;
  back(steps?: number): void;
  /** Navigate to a path string that arrived at runtime (an intent's route, a deep link). */
  toPath(path: string, options?: { replace?: boolean; state?: unknown }): void;
  /** Replace the current entry's `location.state`, keeping its URL. */
  replaceState(state: unknown): void;
}

export function useNav(): Nav {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  return useMemo(() => {
    const jump = (replace: boolean, route: AppRoute, args: unknown[]) => {
      const [params, options] = args as [Record<string, string | number> | undefined, NavOptions | undefined];
      const href = buildHref(route, params, options, new URLSearchParams(location.search));
      // Replacing the page with itself (tapping the current tab) changes nothing.
      if (replace && !options?.popTo && options?.state === undefined && href === location.pathname + location.search) return;
      if (options?.popTo) {
        const targets = typeof options.popTo === 'string' ? [options.popTo] : options.popTo;
        memoryHistoryPopToFirstMatch(navigator, targets, { inclusive: options.popToInclusive });
      }
      const navOptions: { replace?: boolean; state?: unknown } = {};
      if (replace) navOptions.replace = true;
      if (options?.state !== undefined) navOptions.state = options.state;
      navigate(href, Object.keys(navOptions).length > 0 ? navOptions : undefined);
    };
    return {
      push: (route, ...args) => jump(false, route as AppRoute, args),
      replace: (route, ...args) => jump(true, route as AppRoute, args),
      // Guard against a handler passing its click event as the step count.
      back: (steps?: number) => navigate(-(typeof steps === 'number' ? steps : 1)),
      toPath: (path, options) => navigate(path, options),
      replaceState: (state) => navigate(location.pathname + location.search, { replace: true, state }),
    } as Nav;
  }, [navigate, navigator, location.pathname, location.search]);
}
