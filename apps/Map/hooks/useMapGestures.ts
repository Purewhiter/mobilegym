import { useCallback } from 'react';
import { useTriggerGestures } from '../../../os/hooks/useTriggerGestures';
import { useNavigate } from 'react-router-dom';
import type { TransitionId } from '../navigation.declaration';
import { useAppNavigate } from '../navigation';

type SystemTriggerId = 'system.back';
type GestureId = TransitionId | SystemTriggerId;

export function useMapGestures() {
  const navigate = useNavigate();
  const { go, back } = useAppNavigate();
  const { bindTap, bindLongPress, bindDoubleTap } = useTriggerGestures<GestureId>({
    execute: (id, params) => {
      if (id === 'system.back') return;
      go(id, params);
    },
  });

  const bindBack = <T extends HTMLElement>(
    options?: { steps?: number; [key: string]: any }
  ) => {
    const steps = options?.steps ?? 1;
    const binding = bindTap<T>('system.back', { params: { steps } });
    return { ...binding, 'data-trigger-type': 'back' as const };
  };

  const replaceState = useCallback((state: Record<string, unknown>) => {
    navigate('.', { replace: true, state });
  }, [navigate]);

  return {
    bindTap,
    bindLongPress,
    bindDoubleTap,
    bindBack,
    go,
    back,
    replaceState,
  };
}
