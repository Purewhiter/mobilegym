/**
 * Screen-instance stack of one Activity, like a FragmentManager back stack.
 *
 * A screen instance is a run of history entries that show the same page: a
 * URL-driven dialog or sheet (`?dialog=...`) pushes an entry but stays on the
 * page, so it belongs to the instance below it. Opening another page starts a
 * new instance; going back past an instance's first entry destroys it; going
 * back into an instance shows it again as it was left.
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

/**
 * The stack after the router moved to `index` showing `location`.
 *
 * - push / replace / pop all land on one index; instances that start above it
 *   were popped or overwritten and are dropped;
 * - an instance that starts at that very index and shows another page was replaced;
 * - if the top instance is the same page, it now shows the new location
 *   (a dialog opened or closed, back into it); otherwise a new instance starts here.
 */
export function advanceScreenStack<L>(
  stack: readonly ResidentScreen<L>[],
  live: { identity: string; location: L },
  index: number,
  nextId: () => string,
): ResidentScreen<L>[] {
  const next = stack.filter((screen) => screen.startIndex <= index);
  const top = next[next.length - 1];
  if (top && top.startIndex === index && top.identity !== live.identity) next.pop();
  const current = next[next.length - 1];
  if (current && current.identity === live.identity) {
    next[next.length - 1] = { ...current, location: live.location };
    return next;
  }
  next.push({ id: nextId(), identity: live.identity, startIndex: index, location: live.location });
  return next;
}
