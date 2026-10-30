/**
 * RouteScrollContainer — a scroll container that wraps routed pages
 * (`<Outlet />` / `<Routes>`) in an App layout.
 *
 * A plain `overflow-y-auto` div around the outlet survives navigation, so the
 * next page inherits the previous page's `scrollTop` (clamped to its own
 * height). How far it gets clamped depends on frame timing: a store update
 * that shrinks the old page commits right away, while react-router commits the
 * route change later inside `startTransition`, and the browser may or may not
 * lay out in between. The same actions then land at different scroll
 * positions from run to run.
 *
 * This container makes the position a function of navigation alone, like an
 * Android destination's view state:
 *
 *  - a new page (push / replace to another pathname) starts at the top;
 *  - going back (POP) returns to where that history entry was left;
 *  - paths listed in `rememberPaths` (main tabs that share the container)
 *    reopen where they were left on any visit;
 *  - search-only changes (URL-driven dialogs) keep the position.
 *
 * Positions are kept in memory only (refresh = restart).
 */

import React, { forwardRef, useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigationType } from 'react-router-dom';

export interface RouteScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `data-scroll-container` name (matches the route's `scrollContainers` declaration). */
  name?: string;
  /** Pathnames whose position is remembered across visits (e.g. main tabs rendered in this container). */
  rememberPaths?: readonly string[];
}

interface Positions {
  /** Last position of each history entry (`location.key`). */
  byKey: Map<string, number>;
  /** Last position of each `rememberPaths` pathname. */
  byPath: Map<string, number>;
}

/**
 * Positions per router, not per container instance: apps mount the container
 * only on subpages, and an entry must still be restorable after a detour
 * through a main tab unmounted it.
 */
const positionsByRouter = new WeakMap<object, Map<string, Positions>>();

function routerPositions(navigator: object, name: string): Positions {
  let byName = positionsByRouter.get(navigator);
  if (!byName) positionsByRouter.set(navigator, (byName = new Map()));
  let positions = byName.get(name);
  if (!positions) byName.set(name, (positions = { byKey: new Map(), byPath: new Map() }));
  return positions;
}

export const RouteScrollContainer = forwardRef<HTMLDivElement, RouteScrollContainerProps>(
  function RouteScrollContainer({ name = 'main', rememberPaths, children, onScroll, ...rest }, forwardedRef) {
    const location = useLocation();
    const navigationType = useNavigationType();
    const { navigator } = useContext(UNSAFE_NavigationContext);
    const positions = routerPositions(navigator, name);
    const elRef = useRef<HTMLDivElement | null>(null);
    const current = useRef<{ key: string; pathname: string } | null>(null);
    const stopRestore = useRef<(() => void) | null>(null);
    const remembered = useRef(rememberPaths);
    remembered.current = rememberPaths;

    const setRef = useCallback(
      (el: HTMLDivElement | null) => {
        elRef.current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    /** Record `top` as where the current entry was left. */
    const record = useCallback(
      (top: number) => {
        const entry = current.current;
        if (!entry) return;
        positions.byKey.set(entry.key, top);
        if (remembered.current?.includes(entry.pathname)) positions.byPath.set(entry.pathname, top);
      },
      [positions],
    );

    /**
     * Scroll to `target`. If the page is still too short (data or images not
     * there yet), keep re-applying as its content grows, until reached, until
     * the user scrolls, or until the next navigation.
     */
    const apply = useCallback(
      (el: HTMLDivElement, target: number) => {
        stopRestore.current?.();
        stopRestore.current = null;
        el.scrollTop = target;
        if (target <= 0 || el.scrollTop >= target || typeof ResizeObserver === 'undefined') return;

        const inputs = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
        const resize = new ResizeObserver(() => {
          el.scrollTop = target;
          if (el.scrollTop >= target) stop();
        });
        const observeChildren = () => {
          for (const child of Array.from(el.children)) resize.observe(child);
        };
        const mutations = new MutationObserver(observeChildren);
        const stop = () => {
          resize.disconnect();
          mutations.disconnect();
          for (const type of inputs) el.removeEventListener(type, onInput);
          if (stopRestore.current === stop) stopRestore.current = null;
        };
        // The user took over: where the page is now is the new baseline.
        const onInput = () => {
          stop();
          record(el.scrollTop);
        };
        observeChildren();
        mutations.observe(el, { childList: true });
        for (const type of inputs) el.addEventListener(type, onInput, { passive: true });
        stopRestore.current = stop;
      },
      [record],
    );

    // Runs before paint on every committed route change, so the outcome never
    // depends on what the browser laid out between the old and new page.
    useLayoutEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const key = location.key;
      const pathname = location.pathname;
      const prev = current.current;
      current.current = { key, pathname };

      if (navigationType === 'POP' && positions.byKey.has(key)) {
        apply(el, positions.byKey.get(key)!);
        return;
      }
      if (prev && prev.pathname === pathname) {
        // Search-only change (a dialog opened or closed): same page, same position.
        positions.byKey.set(key, positions.byKey.get(prev.key) ?? el.scrollTop);
        return;
      }
      const target = remembered.current?.includes(pathname) ? positions.byPath.get(pathname) ?? 0 : 0;
      positions.byKey.set(key, target);
      apply(el, target);
    }, [location.key, location.pathname, navigationType, positions, apply]);

    useEffect(() => () => stopRestore.current?.(), []);

    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        const entry = current.current;
        if (entry && !stopRestore.current) {
          const recorded = positions.byKey.get(entry.key) ?? 0;
          const max = el.scrollHeight - el.clientHeight;
          // The page got shorter and the browser clamped the position: that is
          // not where the user left it, so keep the recorded value.
          const clamped = el.scrollTop < recorded && el.scrollTop >= max;
          if (!clamped) record(el.scrollTop);
        }
        onScroll?.(event);
      },
      [onScroll, positions, record],
    );

    return (
      <div
        ref={setRef}
        data-scroll-container={name}
        data-scroll-direction="vertical"
        onScroll={handleScroll}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
