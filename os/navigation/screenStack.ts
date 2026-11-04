/**
 * Screen-instance stack of one Activity, like a FragmentManager back stack.
 *
 * A screen instance is a run of history entries that show the same page: a
 * URL-driven dialog or sheet (`?dialog=...`) pushes an entry but stays on the
 * page, so it belongs to the instance below it. Opening another page starts a
 * new instance; going back past an instance's first entry destroys it; going
 * back into an instance shows it again as it was left.
 *
 * Main tabs are persistent, like bottom-navigation destinations that keep their
 * own state: leaving one (a tab switch replaces it) parks it instead of
 * destroying it, and the next visit to that tab takes the parked instance back.
 * A tab pushed again while its instance is still lower on the stack (a deep
 * link to Home over a note) gets a new instance, as any A -> B -> A push does;
 * returning to the old one is a pop (`popTo`), not a push.
 *
 * Pure: the host component (`ActivityRouteHost`) feeds it the live location and
 * the MemoryRouter index after every navigation.
 */

export interface ResidentScreen<L> {
  id: string;
  /** What makes two entries the same page (the pathname by default). */
  identity: string;
  /** History index of the instance's first entry. */
  startIndex: number;
  /** The last location the instance showed. */
  location: L;
}

export interface ScreenState<L> {
  /** The back stack, bottom first; the last one is shown. */
  stack: ResidentScreen<L>[];
  /** Main tabs not on the stack, kept for their next visit. */
  parked: ResidentScreen<L>[];
}

export const EMPTY_SCREEN_STATE: ScreenState<never> = { stack: [], parked: [] };

/**
 * The state after the router moved to `index` showing `location`.
 *
 * - push / replace / pop all land on one index; instances that start above it
 *   were popped or overwritten and leave the stack;
 * - an instance that starts at that very index and shows another page was replaced;
 * - leaving instances are destroyed, or parked if they are persistent (a main tab);
 * - if the top instance is the same page, it now shows the new location
 *   (a dialog opened or closed, back into it); otherwise the page starts here,
 *   from its parked instance if it has one.
 */
export function advanceScreenStack<L>(
  state: ScreenState<L>,
  live: { identity: string; location: L },
  index: number,
  nextId: () => string,
  isPersistent: (identity: string) => boolean = () => false,
): ScreenState<L> {
  const leaving: ResidentScreen<L>[] = [];
  const stack = state.stack.filter((screen) => {
    if (screen.startIndex <= index) return true;
    leaving.push(screen);
    return false;
  });
  const top = stack[stack.length - 1];
  if (top && top.startIndex === index && top.identity !== live.identity) leaving.push(stack.pop()!);

  let parked = state.parked;
  const toPark = leaving.filter((screen) => isPersistent(screen.identity));
  if (toPark.length > 0) {
    const ids = new Set(toPark.map((screen) => screen.identity));
    parked = [...parked.filter((screen) => !ids.has(screen.identity)), ...toPark];
  }

  const current = stack[stack.length - 1];
  if (current && current.identity === live.identity) {
    stack[stack.length - 1] = { ...current, location: live.location };
    return { stack, parked };
  }
  const resumed = parked.find((screen) => screen.identity === live.identity);
  if (resumed) {
    parked = parked.filter((screen) => screen !== resumed);
    stack.push({ ...resumed, startIndex: index, location: live.location });
  } else {
    stack.push({ id: nextId(), identity: live.identity, startIndex: index, location: live.location });
  }
  return { stack, parked };
}
