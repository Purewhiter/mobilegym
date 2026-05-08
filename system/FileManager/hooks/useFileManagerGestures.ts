/**
 * FileManager Gesture Hooks
 * 
 * Provides gesture bindings for navigation transitions
 */
import { useCallback } from 'react';
import { useAppNavigate } from '../navigation';
import { TransitionId } from '../navigation.declaration';

type GestureProps = {
  onClick: (e: React.MouseEvent) => void;
  'data-trigger': string;
  'data-trigger-type': 'tap' | 'longPress' | 'doubleTap';
  'data-trigger-params'?: string;
};

type BackGestureProps = {
  onClick: (e: React.MouseEvent) => void;
  'data-trigger': 'system.back';
  'data-trigger-type': 'tap';
};

export function useFileManagerGestures() {
  const { go, back } = useAppNavigate();

  const bindTap = useCallback(
    (
      transitionId: TransitionId,
      options?: {
        params?: Record<string, string | number>;
        mode?: 'push' | 'replace';
        beforeTrigger?: () => void;
      },
    ): GestureProps => {
      return {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          options?.beforeTrigger?.();
          go(transitionId, options?.params || {}, { mode: options?.mode });
        },
        'data-trigger': transitionId,
        'data-trigger-type': 'tap',
        ...(options?.params && {
          'data-trigger-params': JSON.stringify(options.params),
        }),
      };
    },
    [go],
  );

  const bindBack = useCallback((): BackGestureProps => {
    return {
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        back();
      },
      'data-trigger': 'system.back',
      'data-trigger-type': 'tap',
    };
  }, [back]);

  return { bindTap, bindBack, go, back };
}
