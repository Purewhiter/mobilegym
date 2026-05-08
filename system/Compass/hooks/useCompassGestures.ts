import type React from 'react';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import type { TransitionId } from '../navigation.declaration';
import { useAppNavigate } from '../navigation';

type SystemTriggerId = 'system.back';
type GestureId = TransitionId | SystemTriggerId;

export function useCompassGestures() {
  const { go, back } = useAppNavigate();
  const { bindTap, bindLongPress, bindDoubleTap } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (id === 'system.back') return;
      go(id, params);
    },
  });

  const bindBack = <T extends HTMLElement>(options?: {
    steps?: number;
    stopPropagation?: boolean;
    preventDefault?: boolean;
    [key: string]: any;
  }) => {
    const steps = options?.steps ?? 1;
    const binding = bindTap<T>('system.back', { params: { steps }, ...options });
    return { ...binding, 'data-trigger-type': 'back' as const };
  };

  return {
    bindTap,
    bindLongPress,
    bindDoubleTap,
    bindBack,
    go,
    back,
  };
}

