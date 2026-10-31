/**
 * Navigation inside an app's MemoryRouter: push / replace to a route from the
 * app's route table, or go back. Shared by every app instead of a per-app copy.
 */

import { useContext, useMemo } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { memoryHistoryPopTo } from '../utils/memoryHistoryPopTo';
import { buildHref, type AppRoute, type NavTarget, type RouteParams, type SearchSpec, type SearchValues } from './routes';

export interface NavOptions<S extends SearchSpec = SearchSpec> extends NavTarget {
  search?: SearchValues<S>;
  /** Pop back to this path first (Android's popUpTo), then push or replace. */
  popTo?: string;
  popToInclusive?: boolean;
}

type ParamsArg<P extends string> = keyof RouteParams<P> extends never
  ? [params?: Record<string, never>]
  : [params: RouteParams<P>];

export interface Nav {
  push<P extends string, S extends SearchSpec>(route: AppRoute<P, S>, ...args: [...ParamsArg<P>, options?: NavOptions<S>]): void;
  replace<P extends string, S extends SearchSpec>(route: AppRoute<P, S>, ...args: [...ParamsArg<P>, options?: NavOptions<S>]): void;
  back(steps?: number): void;
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
      if (replace && !options?.popTo && href === location.pathname + location.search) return;
      if (options?.popTo) memoryHistoryPopTo(navigator, options.popTo, { inclusive: options.popToInclusive });
      navigate(href, replace ? { replace: true } : undefined);
    };
    return {
      push: (route, ...args) => jump(false, route as AppRoute, args),
      replace: (route, ...args) => jump(true, route as AppRoute, args),
      back: (steps = 1) => navigate(-steps),
    } as Nav;
  }, [navigate, navigator, location.pathname, location.search]);
}
