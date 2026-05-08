import React, { useCallback } from 'react';
import { useAppNavigate } from '../navigation';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import type { TransitionId } from '../navigation.declaration';

type SystemTriggerId = 'system.back';
type GestureId = TransitionId | SystemTriggerId;

export function useXGestures(isActive: boolean = true) {
  const { go, back } = useAppNavigate();
  const { bindTap, bindLongPress, bindDoubleTap } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (!isActive) return;
      if (id === 'system.back') return;
      
      // Handle action objects (not navigation transitions)
      if (typeof id === 'object' && id !== null && (id as any).kind === 'action') {
        return;
      }

      go(id, params);
    },
  });

  type TriggerTapOptions<T extends HTMLElement> = {
    params?: Record<string, string | number>;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    beforeTrigger?: (event: React.SyntheticEvent<T>) => void;
    onTrigger?: () => void;
  };

  const bindBack = <T extends HTMLElement>(
    options?: (TriggerTapOptions<T> & { steps?: number }) | undefined,
  ) => {
    if (!options) {
      const binding = bindTap<T>('system.back', { params: { steps: 1 } });
      return { ...binding, 'data-trigger-type': 'back' as const };
    }
    const { steps, params, ...rest } = options;
    const binding = bindTap<T>('system.back', {
      ...rest,
      params: { ...(params ?? {}), steps: steps ?? 1 },
    });
    return { ...binding, 'data-trigger-type': 'back' as const };
  };

  return {
    bindTap: useCallback((id: any, options?: any) => (isActive ? bindTap(id, options) : {}), [bindTap, isActive]),
    bindLongPress: useCallback((id: any, options?: any) => (isActive ? bindLongPress(id, options) : {}), [bindLongPress, isActive]),
    bindDoubleTap: useCallback((id: any, options?: any) => (isActive ? bindDoubleTap(id, options) : {}), [bindDoubleTap, isActive]),
    bindBack,
    go,
    back,
  };
}

