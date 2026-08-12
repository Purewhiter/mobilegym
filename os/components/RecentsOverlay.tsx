import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useOS } from '../OSContext';
import { SIMULATOR_CONFIG } from '../data';
import { getAppManifest, getLocalizedAppName } from '../data/appRegistry';
import * as TimeService from '../TimeService';
import { useOsT } from '../i18n';
import { AppIcon } from './AppIcon';
import { getTaskTopActivity, getTasksMRU } from '../taskUtils';

const {
  recentsCardWidth, recentsCardGap, recentsTopPadding,
  recentsScrollContainerHeight, recentsCardHeight, recentsCardBorderRadius,
  recentsOpacityDivisor, recentsBackgroundOpacity, recentsSwipeThreshold,
  zIndexRecentsBlur, zIndexRecentsChrome,
} = SIMULATOR_CONFIG.framework;

/**
 * Recents (multitasking) overlay: RecentsBlur backdrop + RecentsChrome card
 * strip with swipe-to-dismiss. Rendered by SystemShell, each inside its own
 * SystemErrorBoundary.
 *
 * DOM contract (this module is the writer for all three):
 * - `#activity-container-${activityId}` — rendered by os/SystemShell.tsx;
 *   syncSwipeToActivityContainer writes transform/opacity/transition inline
 *   styles onto it while a card is dragged (read side of the id contract:
 *   here, os/components/chromeForeground.ts and os/components/GestureBar.tsx).
 * - `--recents-scroll` (documentElement CSS var) — written on horizontal card
 *   scroll; read by computeActivityContainerStyle (os/SystemShell.tsx, moving
 *   to os/components/ActivityHost.tsx) to shift recents card previews.
 * - `data-recents-card="${taskId}"` — declared on each card; queried back by
 *   syncSwipeToActivityContainer to keep card and activity preview in sync.
 */
function syncSwipeToActivityContainer(
  topActivityId: string,
  taskId: string,
  offset: number,
  mode: 'drag' | 'resetAnimated' | 'resetImmediate' = 'drag',
): void {
  const activityContainerEl = document.getElementById(`activity-container-${topActivityId}`) as HTMLElement | null;
  const escapedTaskId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(taskId) : taskId;
  const chromeCardEl = document.querySelector(
    `[data-recents-card="${escapedTaskId}"]`
  ) as HTMLElement | null;

  const targets = [activityContainerEl, chromeCardEl].filter(Boolean) as HTMLElement[];
  if (targets.length === 0) return;

  if (mode === 'resetImmediate') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = '';
    });
    return;
  }

  if (mode === 'resetAnimated') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = 'transform 0.2s, opacity 0.2s';
    });
    return;
  }

  {
    const opacity = String(Math.max(0, 1 - offset / recentsOpacityDivisor));
    targets.forEach((el) => {
      el.style.transform = `translateY(${-offset}px)`;
      el.style.opacity = opacity;
      el.style.transition = 'none';
    });
  }
}

export const RecentsBlur: React.FC = () => {
  const { state, goHome } = useOS();
  if (!state.isRecentsVisible) return null;
  return (
    <div
      className="absolute inset-0 backdrop-blur-sm"
      style={{
        zIndex: zIndexRecentsBlur,
        backgroundColor: `rgba(0, 0, 0, ${recentsBackgroundOpacity})`,
      }}
      onClick={goHome}
    />
  );
};

export const RecentsChrome: React.FC = () => {
  const { state, launchTaskById, closeTask, goHome } = useOS();
  const t = useOsT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ pid: number; y: number; taskId: string } | null>(null);
  const swipeOffset = useRef(0);
  const lastDismissTs = useRef(0);

  const tasksMRU = useMemo(() => getTasksMRU(state.tasks), [state.tasks]);
  const topActivityByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasksMRU) {
      const top = getTaskTopActivity(task);
      if (top) map.set(task.taskId, top.activityId);
    }
    return map;
  }, [tasksMRU]);

  const handleScroll = useCallback(() => {
    document.documentElement.style.setProperty(
      '--recents-scroll',
      `${scrollRef.current?.scrollLeft ?? 0}px`
    );
  }, []);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    document.documentElement.style.setProperty('--recents-scroll', '0px');
    handleScroll();
    return () => {
      document.documentElement.style.removeProperty('--recents-scroll');
    };
  }, [state.isRecentsVisible, handleScroll]);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    // 确保进入/退出多任务时，不残留上滑 transform/opacity
    tasksMRU.forEach((task) => {
      const topActivityId = topActivityByTaskId.get(task.taskId);
      if (topActivityId) {
        syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
      }
    });

    return () => {
      tasksMRU.forEach((task) => {
        const topActivityId = topActivityByTaskId.get(task.taskId);
        if (topActivityId) {
          syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
        }
      });
    };
  }, [state.isRecentsVisible, tasksMRU, topActivityByTaskId]);

  if (!state.isRecentsVisible) return null;

  const handleClearAll = () => {
    const taskIds = tasksMRU.map(task => task.taskId);
    taskIds.forEach(taskId => closeTask(taskId));
    goHome();
  };

  const handleScrollContainerClick = (e: React.MouseEvent) => {
    if (TimeService.realNow() - lastDismissTs.current < 400) return;
    if (e.target === e.currentTarget) {
      goHome();
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartRef.current = { pid: e.pointerId, y: e.clientY, taskId };
    swipeOffset.current = 0;
    const topActivityId = topActivityByTaskId.get(taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, taskId, 0, 'resetImmediate');
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const diff = s.y - e.clientY;
    if (diff <= 0) return; // 只允许向上滑动
    swipeOffset.current = diff;
    const topActivityId = topActivityByTaskId.get(s.taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, diff, 'drag');
  };

  const handleCardPointerEnd = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;

    const offset = swipeOffset.current;
    const topActivityId = topActivityByTaskId.get(s.taskId);

    if (offset > recentsSwipeThreshold) {
      lastDismissTs.current = TimeService.realNow();
      closeTask(s.taskId);
      if (tasksMRU.length === 1) {
        goHome();
      }
    } else {
      if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, 0, 'resetAnimated');
    }

    swipeStartRef.current = null;
    swipeOffset.current = 0;
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center pointer-events-none"
      style={{
        zIndex: zIndexRecentsChrome,
        paddingTop: `${recentsTopPadding}px`,
      }}
    >
      <div
        ref={scrollRef}
        className="flex overflow-x-auto w-full px-12 no-scrollbar items-center pointer-events-auto"
        style={{
          gap: `${recentsCardGap}px`,
          height: `${recentsScrollContainerHeight}px`,
        }}
        onScroll={handleScroll}
        onClick={handleScrollContainerClick}
      >
        {tasksMRU.map((task) => {
          const manifest = getAppManifest(task.rootAppId);
          return (
            <div
              key={task.taskId}
              data-recents-card={task.taskId}
              className="flex-shrink-0 relative group cursor-pointer touch-none"
              style={{
                width: `${recentsCardWidth}px`,
                height: `${recentsCardHeight}px`,
              }}
              onPointerDown={(e) => handleCardPointerDown(e, task.taskId)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerEnd}
              onPointerCancel={handleCardPointerEnd}
              onClick={() => launchTaskById(task.taskId)}
            >
              <div className="absolute -top-7 left-3 flex items-center gap-2 pointer-events-none z-10">
                {manifest ? (
                  <AppIcon manifest={manifest} size={28} radius={8} showShadow />
                ) : null}
                <span className="text-white text-[13px] font-medium drop-shadow-lg">
                  {getLocalizedAppName(task.rootAppId)}
                </span>
              </div>
              <div
                className="overflow-hidden shadow-2xl relative border border-white/10"
                style={{
                  width: `${recentsCardWidth}px`,
                  height: `${recentsCardHeight}px`,
                  borderRadius: `${recentsCardBorderRadius}px`,
                }}
              />
            </div>
          );
        })}
      </div>

      {state.tasks.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClearAll();
          }}
          className="mt-12 bg-white/10 px-8 py-3 rounded-full text-white font-medium border border-white/10 active:scale-95 transition-transform pointer-events-auto"
        >
          {t('清除全部')}
        </button>
      )}
    </div>
  );
};
