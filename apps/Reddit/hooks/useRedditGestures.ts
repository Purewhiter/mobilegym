import type React from 'react';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import { useAppNavigate } from '../navigation';
import type { TransitionId } from '../navigation.declaration';

type SystemTriggerId = 'system.back';
type GestureId = TransitionId | SystemTriggerId;

export function useRedditGestures() {
  const { go, back } = useAppNavigate();

  const { bindTap, bindLongPress, bindDoubleTap } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (id === 'system.back') return;
      try {
        go(id, params);
      } catch (e) {
        // Active tab self-click / disallowed-from should be a no-op at runtime.
        console.warn('[Reddit] go blocked:', e);
      }
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
    bindTap,
    bindLongPress,
    bindDoubleTap,
    bindBack,
    go,
    back,
  };
}
