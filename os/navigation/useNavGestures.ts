/**
 * Gesture bindings for app pages: `bindNav` jumps to a route on tap, `bindBack`
 * is the system back, `bindTap` / `bindLongPress` / `bindDoubleTap` handle
 * in-place actions. Bound elements get `data-trigger="nav.<route name>"` (plus
 * params) for tooling that clicks tagged elements; the id comes from the route,
 * so there is nothing to hand-write or keep in a declaration.
 */

import type React from 'react';
import { useTriggerGestures } from '../hooks/useTriggerGestures';
import type { AppRoute, RouteParams, SearchSpec } from './routes';
import { useNav, type NavOptions } from './useNav';

interface GestureOptions<T extends HTMLElement> {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  /** Runs before the jump (e.g. to save the item the page opens). */
  beforeTrigger?: (event: React.SyntheticEvent<T>) => void;
}

type BindNavOptions<S extends SearchSpec, T extends HTMLElement> = NavOptions<S> & GestureOptions<T> & {
  /** Replace the current entry (tab switches) instead of pushing one. */
  replace?: boolean;
};

type BindNavArgs<P extends string, S extends SearchSpec, T extends HTMLElement> = keyof RouteParams<P> extends never
  ? [options?: BindNavOptions<S, T> & { params?: Record<string, never> }]
  : [options: BindNavOptions<S, T> & { params: RouteParams<P> }];

export function useNavGestures() {
  const nav = useNav();
  const { bindTap, bindLongPress, bindDoubleTap } = useTriggerGestures<string>();

  const bindNav = <P extends string, S extends SearchSpec, T extends HTMLElement = HTMLElement>(
    route: AppRoute<P, S>,
    ...[options]: BindNavArgs<P, S, T>
  ) => {
    const { params, search, keep, popTo, popToInclusive, state, replace, preventDefault, stopPropagation, beforeTrigger } =
      (options ?? {}) as BindNavOptions<S, T> & { params?: Record<string, string | number> };
    const tagParams: Record<string, string | number> = { ...(params ?? {}) };
    for (const [key, value] of Object.entries(search ?? {})) {
      if (typeof value === 'string' || typeof value === 'number') tagParams[key] = value;
    }
    const navOptions: NavOptions<S> = { search, keep, popTo, popToInclusive, state };
    const go = replace ? nav.replace : nav.push;
    return bindTap<T>(`nav.${route.name}`, {
      params: tagParams,
      preventDefault,
      stopPropagation,
      beforeTrigger,
      onTrigger: () => (go as (r: AppRoute, p: unknown, o: unknown) => void)(route, params ?? {}, navOptions),
    });
  };

  // onTrigger is accepted for old call sites but, as before, system back ignores it.
  const bindBack = <T extends HTMLElement>(options?: GestureOptions<T> & { steps?: number; onTrigger?: () => void }) => {
    const { steps, ...rest } = options ?? {};
    const binding = bindTap<T>('system.back', { ...rest, params: { steps: steps ?? 1 } });
    return { ...binding, 'data-trigger-type': 'back' as const };
  };

  return { nav, bindNav, bindBack, bindTap, bindLongPress, bindDoubleTap };
}
