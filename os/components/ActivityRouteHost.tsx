/**
 * ActivityRouteHost — App-internal pages kept like a Fragment back stack.
 *
 * A plain `<Routes>` unmounts the page you leave, so back recreates it: its
 * scroll position, form input, loaded pages and other UI state are gone. This
 * host keeps every page instance on the Activity's back stack mounted
 * (`screenStack.ts` decides which ones) and shows only the top one:
 *
 *  - pages below the top sit in a hidden React `<Activity>`: their state and
 *    DOM stay, their effects are cleaned up (timers, subscriptions stop) and
 *    run again when they come back, like onStop / onStart;
 *  - each instance renders its own location snapshot, so a hidden page does not
 *    see the URL of the page above it;
 *  - scroll offsets (both axes, every scroller in the page) are put back when an
 *    instance is shown again, since a hidden subtree loses them;
 *  - main tabs (`persistent`) keep one instance each: switching tabs parks the
 *    one you leave and brings back the one you open, like bottom navigation;
 *  - popped instances are destroyed; everything is in memory (refresh = restart).
 *
 * Drop-in for `<Routes>`: same `<Route>` children.
 */

import React, { Activity, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, UNSAFE_NavigationContext, useLocation, type Location } from 'react-router-dom';
import { advanceScreenStack, EMPTY_SCREEN_STATE, type ScreenState } from '../navigation/screenStack';
import { realNow } from '../TimeService';

/** How long a saved offset keeps being put back while the page lays out again. */
const RESTORE_WINDOW_MS = 1000;

export interface ActivityRouteHostProps {
  children: React.ReactNode;
  /** What makes two history entries the same page; the pathname by default. */
  identity?: (location: Location) => string;
  /** Pathnames of the main tabs: one instance each, kept while you are on other tabs. */
  persistent?: readonly string[];
}

const byPathname = (location: Location) => location.pathname;

export const ActivityRouteHost: React.FC<ActivityRouteHostProps> = ({ children, identity = byPathname, persistent }) => {
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  // Render is pure: it derives the stack from the last committed one, and the
  // layout effect commits it. A render React throws away or repeats changes
  // nothing. An instance's id is the key of the entry it started on, so the
  // same inputs always give the same layers.
  const committed = useRef<ScreenState<Location>>(EMPTY_SCREEN_STATE);
  // History index of each entry seen, so a render of an older location (one
  // still showing while a navigation is pending) is not paired with the
  // router's newer index.
  const indexByKey = useRef(new Map<string, number>());
  const index = indexByKey.current.get(location.key) ?? (navigator as { index?: number }).index ?? 0;
  const state = advanceScreenStack(
    committed.current,
    { identity: identity(location), location },
    index,
    () => location.key,
    (id) => !!persistent?.includes(id),
  );

  useLayoutEffect(() => {
    committed.current = state;
    const seen = indexByKey.current;
    seen.set(location.key, index);
    // Entries above the current one are gone (MemoryRouter never goes forward).
    for (const [key, i] of seen) if (i > index) seen.delete(key);
  });

  const top = state.stack[state.stack.length - 1];
  // A fixed order (by id): an instance moving between the stack and the parked
  // tabs keeps its place, so its DOM is never detached and re-inserted.
  const layers = [...state.stack, ...state.parked].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return (
    <>
      {layers.map((screen) => (
        <ResidentScreenLayer key={screen.id} active={screen === top} location={screen.location}>
          {children}
        </ResidentScreenLayer>
      ))}
    </>
  );
};

const ResidentScreenLayer: React.FC<{ active: boolean; location: Location; children: React.ReactNode }> = ({
  active,
  location,
  children,
}) => {
  const layer = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  // Last offsets of every element that scrolled while the page was shown.
  const offsets = useRef(new Map<Element, { top: number; left: number }>());
  // Offsets not reached yet: a page shown again can lay out shorter at first
  // (cards measuring their images), which clamps the offset. Like a RecyclerView
  // waiting for its data, it is put back again until the content is tall enough.
  const pending = useRef(new Set<Element>());

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const record = (event: Event) => {
      const target = event.target;
      if (!activeRef.current || !(target instanceof Element)) return;
      // A clamped restore is not where the user left the page.
      if (pending.current.has(target)) return;
      // Scrollers of sheets that closed since are dropped, not kept alive.
      for (const el of offsets.current.keys()) if (!el.isConnected) offsets.current.delete(el);
      offsets.current.set(target, { top: target.scrollTop, left: target.scrollLeft });
    };
    el.addEventListener('scroll', record, true);
    return () => el.removeEventListener('scroll', record, true);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    const waiting = pending.current;
    const restore = (targets: Iterable<Element>) => {
      for (const el of [...targets]) {
        const saved = offsets.current.get(el);
        if (!saved || !el.isConnected) {
          offsets.current.delete(el);
          waiting.delete(el);
          continue;
        }
        el.scrollTop = saved.top;
        el.scrollLeft = saved.left;
        if (Math.abs(el.scrollTop - saved.top) > 1 || Math.abs(el.scrollLeft - saved.left) > 1) waiting.add(el);
        else waiting.delete(el);
      }
    };
    restore(offsets.current.keys());
    if (waiting.size === 0) return;

    const root = layer.current;
    const deadline = realNow() + RESTORE_WINDOW_MS;
    let frame = 0;
    // The user touching the page takes over from the restore.
    const takeOver = () => waiting.clear();
    const inputs = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    inputs.forEach((type) => root?.addEventListener(type, takeOver, { capture: true, passive: true }));
    const tick = () => {
      restore(waiting);
      if (waiting.size > 0 && realNow() < deadline) frame = requestAnimationFrame(tick);
      else waiting.clear();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      waiting.clear();
      inputs.forEach((type) => root?.removeEventListener(type, takeOver, { capture: true }));
    };
  }, [active]);

  return (
    <div ref={layer} className="h-full w-full" style={active ? undefined : { display: 'none' }} data-resident-screen={active ? 'active' : 'hidden'}>
      <Activity mode={active ? 'visible' : 'hidden'}>
        <Routes location={location}>{children}</Routes>
      </Activity>
    </div>
  );
};
