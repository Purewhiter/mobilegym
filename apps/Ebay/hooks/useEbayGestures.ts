/**
 * eBay gesture bindings; jump targets come from `../routes`. As eBay always
 * did: every jump pushes and stops the click from reaching parents, actions
 * only log, and back pops this app's history directly.
 */
import type React from 'react';
import { useNavGestures } from '../../../os/navigation';

export function useEbayGestures() {
  const gestures = useNavGestures();
  const { nav } = gestures;

  const bindNav: typeof gestures.bindNav = (route, ...[options]) =>
    (gestures.bindNav as (r: typeof route, o: unknown) => ReturnType<typeof gestures.bindNav>)(route, { ...(options ?? {}), stopPropagation: true });

  const bindAction = (actionId: string, params?: Record<string, unknown>) => ({
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      console.log(`Action ${actionId} triggered`, params);
    },
    'data-action': actionId,
    'data-action-params': params ? JSON.stringify(params) : undefined,
  });

  const bindBack = () => ({
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      nav.back();
    },
    'data-trigger': 'system.back',
  });

  return { nav, bindNav, bindAction, bindBack, back: nav.back };
}
