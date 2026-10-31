/**
 * FileManager gesture bindings; jump targets come from `../routes`.
 * Every jump stops the click from reaching parent rows, and the back button
 * pops this app's history directly (as FileManager always did) rather than
 * going through the system back chain.
 */
import type React from 'react';
import { useNavGestures } from '../../../os/navigation';

export function useFileManagerGestures() {
  const gestures = useNavGestures();
  const { nav } = gestures;

  const bindNav: typeof gestures.bindNav = (route, ...[options]) =>
    (gestures.bindNav as (r: typeof route, o: unknown) => ReturnType<typeof gestures.bindNav>)(route, { ...(options ?? {}), stopPropagation: true });

  const bindBack = () => ({
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      nav.back();
    },
    'data-trigger': 'system.back' as const,
    'data-trigger-type': 'tap' as const,
  });

  return { nav, bindNav, bindBack, back: nav.back };
}
