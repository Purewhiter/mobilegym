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
 *  - popped instances are destroyed; everything is in memory (refresh = restart).
 *
 * Drop-in for `<Routes>`: same `<Route>` children.
 */

import React, { Activity, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, UNSAFE_NavigationContext, useLocation, type Location } from 'react-router-dom';
import { advanceScreenStack, type ResidentScreen } from '../navigation/screenStack';

export interface ActivityRouteHostProps {
  children: React.ReactNode;
  /** What makes two history entries the same page; the pathname by default. */
  identity?: (location: Location) => string;
}

const byPathname = (location: Location) => location.pathname;

export const ActivityRouteHost: React.FC<ActivityRouteHostProps> = ({ children, identity = byPathname }) => {
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);

  // Render is pure: it derives the stack from the last committed one, and the
  // layout effect commits it. A render React throws away or repeats changes
  // nothing. An instance's id is the key of the entry it started on, so the
  // same inputs always give the same layers.
  const committed = useRef<ResidentScreen<Location>[]>([]);
  // History index of each entry seen, so a render of an older location (one
  // still showing while a navigation is pending) is not paired with the
  // router's newer index.
  const indexByKey = useRef(new Map<string, number>());
  const index = indexByKey.current.get(location.key) ?? (navigator as { index?: number }).index ?? 0;
  const screens = advanceScreenStack(
    committed.current,
    { identity: identity(location), location },
    index,
    () => location.key,
  );

  useLayoutEffect(() => {
    committed.current = screens;
    const seen = indexByKey.current;
    seen.set(location.key, index);
    // Entries above the current one are gone (MemoryRouter never goes forward).
    for (const [key, i] of seen) if (i > index) seen.delete(key);
  });

  return (
    <>
      {screens.map((screen, i) => (
        <ResidentScreenLayer key={screen.id} active={i === screens.length - 1} location={screen.location}>
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

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const record = (event: Event) => {
      const target = event.target;
      if (!activeRef.current || !(target instanceof Element)) return;
      // Scrollers of sheets that closed since are dropped, not kept alive.
      for (const el of offsets.current.keys()) if (!el.isConnected) offsets.current.delete(el);
      offsets.current.set(target, { top: target.scrollTop, left: target.scrollLeft });
    };
    el.addEventListener('scroll', record, true);
    return () => el.removeEventListener('scroll', record, true);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;
    for (const [el, { top, left }] of offsets.current) {
      if (!el.isConnected) {
        offsets.current.delete(el);
        continue;
      }
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }, [active]);

  return (
    <div ref={layer} className="h-full w-full" style={active ? undefined : { display: 'none' }} data-resident-screen={active ? 'active' : 'hidden'}>
      <Activity mode={active ? 'visible' : 'hidden'}>
        <Routes location={location}>{children}</Routes>
      </Activity>
    </div>
  );
};
