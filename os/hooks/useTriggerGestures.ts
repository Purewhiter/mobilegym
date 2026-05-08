import { useMemo, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import { realNow } from '../TimeService';

type TriggerParams = Record<string, string | number>;
type ActionParams = Record<string, string | number | boolean>;

export type ActionSpec = { kind: 'action'; id: string };
type TriggerOrAction<Id extends string> = Id | ActionSpec;

interface UseTriggerGesturesOptions<Id extends string> {
  execute?: (id: Id, params?: TriggerParams) => void;
}

interface BaseGestureOptions<T extends HTMLElement, Params extends Record<string, any>> {
  params?: Params;
  preventDefault?: boolean;
  stopPropagation?: boolean;
  beforeTrigger?: (event: React.SyntheticEvent<T>) => void;
  /**
   * Trigger 模式：作为覆盖回调（提供则不走 execute）
   * Action 模式：必须提供，用于执行原地动作（不走 execute）
   */
  onTrigger?: () => void;
}

type TriggerGestureOptions<T extends HTMLElement> = BaseGestureOptions<T, TriggerParams>;
type ActionGestureOptions<T extends HTMLElement> = BaseGestureOptions<T, ActionParams> & { onTrigger: () => void };

interface LongPressOptions<T extends HTMLElement, Params extends Record<string, any>>
  extends BaseGestureOptions<T, Params> {
  duration?: number;
  onLongPressStart?: (event: React.PointerEvent<T>) => void;
  onLongPressEnd?: (event: React.PointerEvent<T>, triggered: boolean) => void;
}

interface DoubleTapOptions<T extends HTMLElement, Params extends Record<string, any>>
  extends BaseGestureOptions<T, Params> {
  threshold?: number;
  onSingleTap?: () => void;
}

type TriggerGestureProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  'data-trigger': string;
  'data-trigger-type': string;
  'data-trigger-params'?: string;
};

type ActionGestureProps<T extends HTMLElement> = React.HTMLAttributes<T> & {
  'data-action': string;
  'data-action-type': string;
  'data-action-params'?: string;
};

type GestureProps<T extends HTMLElement> = TriggerGestureProps<T> | ActionGestureProps<T>;

const DEFAULT_LONG_PRESS_DURATION = 400;
const DEFAULT_DOUBLE_TAP_THRESHOLD = 200;

// Module-level state storage with reference counting for cleanup
interface DoubleTapState {
  lastTapTime: number;
  singleTapTimer: number | null;
  currentPointerType: string | null;
  skipClick: boolean;
  refCount: number; // Track how many components use this state
}

const doubleTapStates = new Map<string, DoubleTapState>();

const acquireDoubleTapState = (key: string): DoubleTapState => {
  if (!doubleTapStates.has(key)) {
    doubleTapStates.set(key, {
      lastTapTime: 0,
      singleTapTimer: null,
      currentPointerType: null,
      skipClick: false,
      refCount: 0,
    });
  }
  const state = doubleTapStates.get(key)!;
  state.refCount++;
  return state;
};

const releaseDoubleTapState = (key: string): void => {
  const state = doubleTapStates.get(key);
  if (!state) return;
  
  state.refCount--;
  if (state.refCount <= 0) {
    // Clear any pending timer before removal
    if (state.singleTapTimer) {
      window.clearTimeout(state.singleTapTimer);
    }
    doubleTapStates.delete(key);
  }
};

// Long press state interface for ref-based storage
interface LongPressState {
  timer: number | null;
  triggered: boolean;
}

export function useTriggerGestures<Id extends string = string>(
  options?: UseTriggerGesturesOptions<Id>,
) {
  const execute = options?.execute;
  
  // Track active double tap state keys for cleanup
  const activeDoubleTapKeysRef = useRef<Set<string>>(new Set());
  
  // Track active long press timers for cleanup
  const longPressStatesRef = useRef<Map<string, LongPressState>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Release all double tap states
      activeDoubleTapKeysRef.current.forEach(key => {
        releaseDoubleTapState(key);
      });
      activeDoubleTapKeysRef.current.clear();
      
      // Clear all long press timers
      longPressStatesRef.current.forEach(state => {
        if (state.timer) {
          window.clearTimeout(state.timer);
        }
      });
      longPressStatesRef.current.clear();
    };
  }, []);

  const buildCommonAttributes = useMemo(
    () =>
      <T extends HTMLElement>(
        spec: TriggerOrAction<Id>,
        triggerType: string,
        params?: TriggerParams | ActionParams,
      ): (
        | Pick<TriggerGestureProps<T>, 'data-trigger' | 'data-trigger-type'>
        | Pick<ActionGestureProps<T>, 'data-action' | 'data-action-type'>
      ) & { 'data-trigger-params'?: string; 'data-action-params'?: string } => {
        const isAction = typeof spec === 'object' && spec?.kind === 'action';
        const id = isAction ? spec.id : spec;

        const result: any = isAction
          ? {
              'data-action': id,
              'data-action-type': triggerType,
            }
          : {
              'data-trigger': id,
              'data-trigger-type': triggerType,
            };
        if (params && Object.keys(params).length > 0) {
          if (isAction) {
            result['data-action-params'] = JSON.stringify(params);
          } else {
            result['data-trigger-params'] = JSON.stringify(params);
          }
        }
        return result;
      },
    [],
  );

  const triggerAction = useCallback((
    spec: TriggerOrAction<Id>,
    params: TriggerParams | ActionParams | undefined,
    action: (() => void) | undefined,
  ) => {
    const isAction = typeof spec === 'object' && spec?.kind === 'action';
    if (isAction) {
      action?.();
      return;
    }
    const id = spec as Id;
    if ((id as string) === 'system.back') {
      window.__OS__?.handleBack();
      return;
    }
    if (action) {
      action();
      return;
    }
    if (execute) {
      execute(id, params as TriggerParams | undefined);
    }
  }, [execute]);

  function bindTap<T extends HTMLElement>(
    id: Id,
    options?: TriggerGestureOptions<T>,
  ): TriggerGestureProps<T>;
  function bindTap<T extends HTMLElement>(
    spec: ActionSpec,
    options: ActionGestureOptions<T>,
  ): ActionGestureProps<T>;
  function bindTap<T extends HTMLElement>(
    spec: TriggerOrAction<Id>,
    options?: TriggerGestureOptions<T> | ActionGestureOptions<T>,
  ): GestureProps<T> {
    return {
      ...buildCommonAttributes<T>(spec, 'tap', options?.params),
      onClick: event => {
        if (options?.preventDefault) event.preventDefault();
        if (options?.stopPropagation) event.stopPropagation();
        options?.beforeTrigger?.(event);
        triggerAction(spec, options?.params, options?.onTrigger);
      },
    };
  }

  function bindLongPress<T extends HTMLElement>(
    id: Id,
    options?: LongPressOptions<T, TriggerParams>,
  ): TriggerGestureProps<T>;
  function bindLongPress<T extends HTMLElement>(
    spec: ActionSpec,
    options: LongPressOptions<T, ActionParams> & { onTrigger: () => void },
  ): ActionGestureProps<T>;
  function bindLongPress<T extends HTMLElement>(
    spec: TriggerOrAction<Id>,
    options?: LongPressOptions<T, TriggerParams> | LongPressOptions<T, ActionParams>,
  ): GestureProps<T> {
    // Generate stable key for this long press binding
    const isAction = typeof spec === 'object' && spec?.kind === 'action';
    const id = isAction ? spec.id : (spec as string);
    const stateKey = `longpress:${isAction ? 'action' : 'trigger'}:${id}`;
    
    // Initialize state if not exists
    if (!longPressStatesRef.current.has(stateKey)) {
      longPressStatesRef.current.set(stateKey, { timer: null, triggered: false });
    }
    const state = longPressStatesRef.current.get(stateKey)!;

    const clearTimer = (event: React.PointerEvent<T>, shouldTrigger?: boolean) => {
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = null;
      }
      options?.onLongPressEnd?.(event, Boolean(shouldTrigger));
    };

    const startTimer = (event: React.PointerEvent<T>) => {
      state.triggered = false;
      options?.onLongPressStart?.(event);
      state.timer = window.setTimeout(() => {
        state.triggered = true;
        triggerAction(spec, options?.params, options?.onTrigger);
      }, options?.duration ?? DEFAULT_LONG_PRESS_DURATION);
    };

    const handlePointerUp = (event: React.PointerEvent<T>) => {
      if (options?.preventDefault) event.preventDefault();
      if (options?.stopPropagation) event.stopPropagation();

      if (state.timer) {
        if (!state.triggered) {
          clearTimer(event, false);
        } else {
          clearTimer(event, true);
        }
      }
    };

    const cancelTimer = (event: React.PointerEvent<T>) => {
      if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = null;
        options?.onLongPressEnd?.(event, false);
      }
    };

    return {
      ...buildCommonAttributes<T>(spec, 'longPress', options?.params),
      onPointerDown: event => {
        if (options?.preventDefault) event.preventDefault();
        if (options?.stopPropagation) event.stopPropagation();
        options?.beforeTrigger?.(event);
        startTimer(event);
      },
      onPointerUp: handlePointerUp,
      onPointerLeave: cancelTimer,
      onPointerCancel: cancelTimer,
      onClickCapture: (event: React.MouseEvent<T>) => {
        if (state.triggered) {
          state.triggered = false;
          event.stopPropagation();
        }
      },
    };
  }

  function bindDoubleTap<T extends HTMLElement>(
    id: Id,
    options?: DoubleTapOptions<T, TriggerParams>,
  ): TriggerGestureProps<T>;
  function bindDoubleTap<T extends HTMLElement>(
    spec: ActionSpec,
    options: DoubleTapOptions<T, ActionParams> & { onTrigger: () => void },
  ): ActionGestureProps<T>;
  function bindDoubleTap<T extends HTMLElement>(
    spec: TriggerOrAction<Id>,
    options?: DoubleTapOptions<T, TriggerParams> | DoubleTapOptions<T, ActionParams>,
  ): GestureProps<T> {
    const isAction = typeof spec === 'object' && spec?.kind === 'action';
    const id = isAction ? spec.id : (spec as Id);
    const stateKey = `doubletap:${isAction ? 'action' : 'trigger'}:${id}`;

    // Acquire state with reference counting (only once per key)
    if (!activeDoubleTapKeysRef.current.has(stateKey)) {
      activeDoubleTapKeysRef.current.add(stateKey);
      acquireDoubleTapState(stateKey);
    }
    const state = doubleTapStates.get(stateKey)!;

    const threshold = options?.threshold ?? DEFAULT_DOUBLE_TAP_THRESHOLD;

    const handleEventCommon = (event: React.SyntheticEvent<T>) => {
      if (options?.preventDefault) event.preventDefault();
      if (options?.stopPropagation) event.stopPropagation();
      options?.beforeTrigger?.(event);
    };

    const clearSingleTapTimer = () => {
      if (state.singleTapTimer) {
        window.clearTimeout(state.singleTapTimer);
        state.singleTapTimer = null;
      }
    };

    const scheduleSingleTap = () => {
      clearSingleTapTimer();
      state.singleTapTimer = window.setTimeout(() => {
        state.singleTapTimer = null;
        state.lastTapTime = 0;
        options?.onSingleTap?.();
      }, threshold);
    };

    const triggerDoubleTap = () => {
      clearSingleTapTimer();
      state.lastTapTime = 0;
      triggerAction(spec, options?.params, options?.onTrigger);
    };

    const handleTouchTap = () => {
      const now = realNow();
      if (now - state.lastTapTime <= threshold) {
        triggerDoubleTap();
        return;
      }
      state.lastTapTime = now;
      scheduleSingleTap();
    };

    return {
      ...buildCommonAttributes<T>(spec, 'doubleTap', options?.params),
      onPointerDown: event => {
        state.currentPointerType = event.pointerType;
      },
      onPointerUp: event => {
        const pointerType = state.currentPointerType;
        state.currentPointerType = null;

        if (pointerType === 'mouse' || pointerType === 'unknown' || pointerType === null) {
          return;
        }

        state.skipClick = true;
        handleEventCommon(event);
        handleTouchTap();
      },
      onPointerLeave: () => {
        state.currentPointerType = null;
      },
      onPointerCancel: () => {
        state.currentPointerType = null;
      },
      onClick: event => {
        if (state.skipClick) {
          state.skipClick = false;
          return;
        }

        handleEventCommon(event);

        const nativeEvent: any = event.nativeEvent;
        const detail = typeof nativeEvent?.detail === 'number' ? nativeEvent.detail : 1;

        if (detail >= 2) {
          triggerDoubleTap();
          return;
        }

        scheduleSingleTap();
      },
    };
  }

  return {
    bindTap,
    bindLongPress,
    bindDoubleTap,
  };
}
