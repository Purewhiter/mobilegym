import React, { useRef, useState, useEffect, useCallback } from 'react';
import { VarContext } from './engine/variables';
import { WmrCanvasRenderer } from './engine/renderer';
import { timeDigitSrcs, loadImage } from './engine/imageCache';
import { injectProviderData, handleWmrHostBroadcast } from './engine/contentProviders';
import { handleWmrIntent } from './engine/intentResolver';
import type { WmrDocument, WmrNode } from './engine/types';
import * as TimeService from '../TimeService';
import BroadcastBus from '../BroadcastBus';
import QuickSettingsService from '../QuickSettingsService';
import { useLocale } from '../locale';
import {
  loadWmrBundle,
  type WmrBundleAnalysis,
  type WmrInlineBundleSource,
} from './WmrBundleCache';
import { beginWmrPerf } from './WmrPerf';

interface WmrRendererProps {
  /** URL to the widget's manifest.xml directory, e.g. "/themes/<id>/clock_2x4/" */
  xmlBaseUrl?: string;
  /** Inline app-owned bundle source, used when the widget resources live inside an app instead of public/themes */
  bundleSource?: WmrInlineBundleSource;
  /** 保留给上层数据结构，运行时出错时不再回退到预览图 */
  previewUrl: string;
  /** Grid ratio from the launcher placement, e.g. 4 / 2 or 2 / 2 */
  preferredAspectRatio?: number;
  spanX?: number;
  spanY?: number;
  className?: string;
  persistNamespace?: string;
  active?: boolean;
  shouldLoad?: boolean;
  initialVariables?: Record<string, string | number>;
  /**
   * 外部数据变化信号：token 变化时，立即重跑 injectProviderData 把最新的
   * provider 数据（如 weather store）拉进 VarContext，并强制一次重渲染。
   * 不会完整 re-init bundle/textures，避免画面 flash。
   * 默认情况下 provider 数据每 60s（无 time updater 时）才被动刷新一次，
   * 外部对底层 store 的修改（state-builder / bench setState）需要这个 prop
   * 才能即时反映到 WMR canvas。token 内容无所谓，引用变化即触发刷新。
   */
  dataRefreshToken?: unknown;
  onClick?: () => void;
  onLongPress?: (el: HTMLElement) => void;
}

function getPassiveDataUpdateDelayMs(updaters: string[]): number {
  const now = TimeService.getDate();
  const ms = now.getMilliseconds();
  const sec = now.getSeconds();
  const minute = now.getMinutes();

  if (updaters.includes('DateTime.Second')) {
    return Math.max(50, 1000 - ms);
  }
  if (updaters.includes('DateTime.Minute')) {
    return Math.max(50, (59 - sec) * 1000 + (1000 - ms));
  }
  if (updaters.includes('DateTime.Hour')) {
    return Math.max(50, ((59 - minute) * 60 + (59 - sec)) * 1000 + (1000 - ms));
  }

  // No explicit time updater: keep a very low-frequency heartbeat for provider data
  // instead of polling every frame.
  return 60_000;
}

export const WmrRenderer: React.FC<WmrRendererProps> = ({
  xmlBaseUrl,
  bundleSource,
  previewUrl,
  preferredAspectRatio,
  spanX,
  spanY,
  className,
  persistNamespace,
  active = true,
  shouldLoad = true,
  initialVariables,
  dataRefreshToken,
  onClick,
  onLongPress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const locale = useLocale();

  const docRef = useRef<WmrDocument | null>(null);
  const varsRef = useRef<VarContext | null>(null);
  const rendererRef = useRef<WmrCanvasRenderer | null>(null);
  const bundleAnalysisRef = useRef<WmrBundleAnalysis | null>(null);
  const hasMarqueeRef = useRef(false);

  // Long-press state
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const sourceKey = bundleSource?.cacheKey ?? xmlBaseUrl ?? 'unknown';

  const clearTimer = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const reportError = useCallback((stage: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `[${stage}] ${detail}`;
    console.error('[WMR] Widget error', { sourceKey, stage, error });
    setReady(false);
    setErrorMessage(message);
  }, [sourceKey]);

  const shouldInit = shouldLoad || ready || !!docRef.current;

  // ---- Load and parse WMR XML ----
  useEffect(() => {
    if (!shouldInit) return;
    if (!xmlBaseUrl && !bundleSource) {
      setReady(false);
      setErrorMessage('[load] 缺少 WMR 来源');
      return;
    }

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    setReady(false);
    setErrorMessage(null);
    docRef.current = null;
    varsRef.current = null;
    rendererRef.current = null;
    bundleAnalysisRef.current = null;

    (async () => {
      const stopInit = beginWmrPerf('widget.init', sourceKey);
      try {
        const bundle = await loadWmrBundle(bundleSource ?? xmlBaseUrl!, locale);
        if (cancelled) return;
        const { xml, doc, resourceStrings, analysis, assetUrlResolver } = bundle;
        docRef.current = doc;
        bundleAnalysisRef.current = analysis;
        hasMarqueeRef.current = analysis.hasMarquee;

        // Init variables
        const vars = new VarContext(persistNamespace ?? sourceKey);
        vars.setDefaultFrameRate(analysis.inferredFrameRate);
        vars.refreshBuiltins();
        vars.setProviderData(resourceStrings);
        vars.registerFramerateControllers(doc.framerateControllers);
        vars.registerIntentHandler(handleWmrIntent);
        const { width: designW, height: designH } = resolveWmrViewport(doc, preferredAspectRatio, spanX, spanY);
        vars.setScreenSize(designW, designH);
        vars.initFromNodes(doc.root.children);
        if (initialVariables) {
          for (const [name, value] of Object.entries(initialVariables)) {
            vars.set(name, value);
          }
        }
        vars.registerMethodHandler('__objRoot', 'selfInit', () => vars.executeTriggerList(doc.root.externalTriggers, 'init'));
        vars.registerMethodHandler('__objRoot', 'selfResume', () => vars.executeTriggerList(doc.root.externalTriggers, 'resume'));
        vars.registerMethodHandler('__objRoot', 'selfPause', () => vars.executeTriggerList(doc.root.externalTriggers, 'pause'));
        injectProviderData(vars, {
          binders: analysis.binders,
          dependencies: analysis.providerDependencies,
        });
        vars.reevaluateVars(doc.root.children);
        varsRef.current = vars;
        registerBroadcastBinders(doc.root.children, vars, cleanups);
        cleanups.push(registerHostBroadcastHandlers(vars, doc.root.children, analysis));

        // Preload Time srcExp images (resolved after vars are ready)
        const { evalExprStr: evalE } = await import('./engine/expression');
        const timeSrcs: string[] = [];
        const dynamicImageSrcs = new Set<string>();
        const indexedVariantSrc = (src: string, frameIndex: number): string => {
          const dot = src.lastIndexOf('.');
          const stem = dot >= 0 ? src.slice(0, dot) : src;
          const ext = dot >= 0 ? src.slice(dot) : '';
          return `${stem}_${frameIndex}${ext}`;
        };
        (function walkTime(nodes: typeof doc.root.children) {
          for (const n of nodes) {
            if (n.tag === 'Time' && n.srcExp) {
              const resolved = String(evalE(n.srcExp, vars));
              for (const s of timeDigitSrcs(resolved)) timeSrcs.push(s);
            }
            if (n.tag === 'Image') {
              const resolved = n.srcExp
                ? String(evalE(n.srcExp, vars))
                : n.src && (n.src.startsWith('@') || n.src.startsWith('#'))
                  ? String(evalE(n.src, vars))
                  : n.src;
              if (resolved) {
                dynamicImageSrcs.add(resolved);
                if (n.srcid) {
                  const frameIndex = Math.max(0, Math.floor(Number(evalE(n.srcid, vars)) || 0));
                  dynamicImageSrcs.add(indexedVariantSrc(resolved, frameIndex));
                }
              }
            }
            if ('children' in n && Array.isArray((n as any).children)) walkTime((n as any).children);
            if ('normalChildren' in n && Array.isArray((n as any).normalChildren)) walkTime((n as any).normalChildren);
            if ('pressedChildren' in n && Array.isArray((n as any).pressedChildren)) walkTime((n as any).pressedChildren);
          }
        })(doc.root.children);
        await Promise.all([
          ...timeSrcs.map(s => loadImage(assetUrlResolver(s))),
          ...[...dynamicImageSrcs].map(s => loadImage(assetUrlResolver(s))),
        ]);
        if (cancelled) return;

        const renderer = new WmrCanvasRenderer(vars, {
          basePath: xmlBaseUrl ?? '',
          assetUrlResolver,
          onIntent: handleWmrIntent,
          enableHitRegions: analysis.hasInteractiveNodes,
          enableMeasurePass: analysis.needsMeasurePass,
        }, designW, designH, doc.root.tag !== 'Widget');
        rendererRef.current = renderer;

        vars.executeTriggerList(doc.root.externalTriggers, 'init');

        setReady(true);
      } catch (err) {
        if (!cancelled) reportError('load', err);
      } finally {
        stopInit();
      }
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
    // preferredAspectRatio / spanX / spanY 只用于 init 时的 viewport 初值；
    // 它们变化时由下一个 useEffect（viewport 更新）走轻量路径，不应触发整体 init 重建。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleSource, initialVariables, locale, persistNamespace, reportError, shouldInit, sourceKey, xmlBaseUrl]);

  useEffect(() => {
    const doc = docRef.current;
    const vars = varsRef.current;
    const renderer = rendererRef.current;
    if (!doc || !vars || !renderer) return;

    const { width: designW, height: designH } = resolveWmrViewport(doc, preferredAspectRatio, spanX, spanY);
    vars.setScreenSize(designW, designH);
    renderer.setViewport(designW, designH, doc.root.tag !== 'Widget');

    if (!active || !ready || errorMessage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderer.render(canvas, doc.root.children);
  }, [active, errorMessage, preferredAspectRatio, ready, spanX, spanY]);

  useEffect(() => {
    if (!ready || errorMessage) return;
    const canvas = canvasRef.current;
    const doc = docRef.current;
    const vars = varsRef.current;
    const renderer = rendererRef.current;
    const analysis = bundleAnalysisRef.current;
    if (!canvas || !doc || !vars || !renderer) return;

    try {
      vars.executeTriggerList(doc.root.externalTriggers, active ? 'resume' : 'pause');
      if (active) {
        const stopRefresh = beginWmrPerf('widget.lifecycleRefresh', sourceKey);
        vars.refreshBuiltins();
        injectProviderData(vars, {
          binders: analysis?.binders,
          dependencies: analysis?.providerDependencies,
        });
        vars.reevaluateVars(doc.root.children);
        stopRefresh();
        const stopRender = beginWmrPerf('widget.lifecycleRender', sourceKey);
        renderer.render(canvas, doc.root.children);
        stopRender();
      }
    } catch (err) {
      reportError('lifecycle', err);
    }
  }, [active, ready, errorMessage, reportError, sourceKey]);

  // ---- External data refresh ----
  // dataRefreshToken 变化时立刻重跑 injectProviderData，让外部 store 修改
  // （state-builder / bench setState）即时反映到 canvas。不重建 bundle。
  useEffect(() => {
    if (!ready || errorMessage || !active) return;
    const canvas = canvasRef.current;
    const doc = docRef.current;
    const vars = varsRef.current;
    const renderer = rendererRef.current;
    const analysis = bundleAnalysisRef.current;
    if (!canvas || !doc || !vars || !renderer || !analysis) return;

    try {
      vars.refreshBuiltins();
      injectProviderData(vars, {
        binders: analysis.binders,
        dependencies: analysis.providerDependencies,
      });
      vars.reevaluateVars(doc.root.children, { includeAnimations: true, includeBinders: true });
      renderer.render(canvas, doc.root.children);
    } catch (err) {
      reportError('dataRefresh', err);
    }
    // 仅依赖 token；ready/active 守护已在前面，避免 mount 重复触发由 active 路径处理
  }, [dataRefreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Render loop ----
  useEffect(() => {
    if (!ready || errorMessage || !active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const doc = docRef.current;
    const vars = varsRef.current;
    const renderer = rendererRef.current;
    const analysis = bundleAnalysisRef.current;
    if (!doc || !vars || !renderer || !analysis) return;

    let rafId: number | null = null;
    let timerId: number | null = null;
    let lastRender = 0;
    let lastDataRefresh = 0;
    const scheduleNext = (delayMs: number) => {
      if (delayMs <= 34) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      timerId = window.setTimeout(frame, delayMs);
    };
    const frame = () => {
      try {
        const now = TimeService.realNow();
        const currentFrameRate = vars.getRecommendedFrameRate(analysis.inferredFrameRate);
        const hasMarquee = hasMarqueeRef.current;
        const dataRefreshInterval = getPassiveDataUpdateDelayMs(doc.useVariableUpdater);
        const renderInterval = currentFrameRate > 0
          ? Math.max(16, Math.round(1000 / currentFrameRate))
          : hasMarquee ? 50 : dataRefreshInterval;

        const shouldRefreshData = now - lastDataRefresh >= dataRefreshInterval;
        if (shouldRefreshData) {
          lastDataRefresh = now;
          const stopRefresh = beginWmrPerf('widget.dataRefresh', sourceKey);
          vars.refreshBuiltins();
          injectProviderData(vars, {
            binders: analysis.binders,
            dependencies: analysis.providerDependencies,
          });
          vars.reevaluateVars(doc.root.children, { includeAnimations: currentFrameRate <= 0, includeBinders: true });
          stopRefresh();
        }

        if (now - lastRender >= renderInterval) {
          lastRender = now;
          if (currentFrameRate > 0) {
            const stopAnim = beginWmrPerf('widget.animationRefresh', sourceKey);
            vars.reevaluateVars(doc.root.children, { includeAnimations: true, includeBinders: false });
            stopAnim();
          }
          const stopRender = beginWmrPerf('widget.render', sourceKey);
          renderer.render(canvas, doc.root.children);
          stopRender();
        }
        const nowAfterWork = TimeService.realNow();
        const renderDelay = Math.max(16, renderInterval - (nowAfterWork - lastRender));
        const dataDelay = Math.max(16, dataRefreshInterval - (nowAfterWork - lastDataRefresh));
        scheduleNext(Math.min(renderDelay, dataDelay));
      } catch (err) {
        reportError('render', err);
      }
    };
    scheduleNext(0);
    return () => {
      try { vars.executeTriggerList(doc.root.externalTriggers, 'pause'); } catch { /* ignore */ }
      if (rafId != null) cancelAnimationFrame(rafId);
      if (timerId != null) window.clearTimeout(timerId);
    };
  }, [active, ready, errorMessage, reportError, sourceKey]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    suppressClickRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    if (canvasRef.current && rendererRef.current) {
      rendererRef.current.handlePointerEvent(canvasRef.current, 'down', e.clientX, e.clientY);
    }
    if (onLongPress) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        suppressClickRef.current = true;
        if (containerRef.current) onLongPress(containerRef.current);
      }, 420);
    }
  }, [onLongPress, clearTimer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const sp = startPosRef.current;
    if (canvasRef.current && rendererRef.current) {
      rendererRef.current.handlePointerEvent(canvasRef.current, 'move', e.clientX, e.clientY);
    }
    if (!sp) return;
    if (Math.abs(e.clientX - sp.x) > 8 || Math.abs(e.clientY - sp.y) > 8) clearTimer();
  }, [clearTimer]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (canvasRef.current && rendererRef.current) {
      if (suppressClickRef.current) {
        rendererRef.current.handlePointerEvent(canvasRef.current, 'cancel', e.clientX, e.clientY);
      } else {
        const consumed = rendererRef.current.handlePointerEvent(canvasRef.current, 'up', e.clientX, e.clientY);
        if (consumed) suppressClickRef.current = true;
      }
    }
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (canvasRef.current && rendererRef.current) {
      rendererRef.current.handlePointerEvent(canvasRef.current, 'cancel', e.clientX, e.clientY);
    }
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      return;
    }
    onClick?.();
  }, [onClick]);

  if (errorMessage) {
    return (
      <div
        ref={containerRef}
        className={className}
        role="status"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ position: 'relative' }}
      >
        <div className="w-full h-full rounded-[16px] border border-red-500/40 bg-red-950/80 text-red-100 p-3 flex flex-col justify-center">
          <div className="text-sm font-semibold tracking-wide">WMR 渲染失败</div>
          <div className="mt-2 text-[11px] leading-5 break-all font-mono opacity-90">
            {errorMessage}
          </div>
          {(xmlBaseUrl || bundleSource) ? (
            <div className="mt-2 text-[10px] leading-4 break-all font-mono opacity-70">
              {bundleSource ? `${bundleSource.cacheKey}:inline-manifest` : `${xmlBaseUrl}manifest.xml`}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      role="button"
      tabIndex={0}
      data-desktop-interactive="true"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ position: 'relative', touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-[16px]"
        style={{ display: ready ? 'block' : 'none' }}
      />
      {!ready && (
        shouldInit ? (
          <div className="w-full h-full rounded-[16px] border border-white/10 bg-black/30 text-white/70 flex items-center justify-center text-sm">
            Loading...
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            className="w-full h-full rounded-[16px] object-cover select-none pointer-events-none"
          />
        ) : (
          <div className="w-full h-full rounded-[16px] border border-white/10 bg-black/20" />
        )
      )}
    </div>
  );
};

const DEFAULT_WIDGET_VIEWPORTS: Record<string, { width: number; height: number }> = {
  '2x2': { width: 440, height: 440 },
  '4x2': { width: 916, height: 440 },
};

function resolveWmrViewport(
  doc: WmrDocument,
  preferredAspectRatio?: number,
  spanX?: number,
  spanY?: number,
): { width: number; height: number } {
  const parsedWidth = doc.designWidth;
  const fallbackAspectRatio = preferredAspectRatio && preferredAspectRatio > 0
    ? preferredAspectRatio
    : 2;
  const parsedHeight = doc.designHeight ?? Math.round(parsedWidth / fallbackAspectRatio);

  if (doc.root.tag !== 'Widget') {
    return { width: parsedWidth, height: parsedHeight };
  }

  const hasExplicitWidth = !!doc.root.attrs.width;
  const hasExplicitHeight = !!doc.root.attrs.height;
  if (hasExplicitWidth || hasExplicitHeight) {
    return { width: parsedWidth, height: parsedHeight };
  }

  const bySpan = spanX && spanY ? DEFAULT_WIDGET_VIEWPORTS[`${spanX}x${spanY}`] : undefined;
  if (bySpan) return bySpan;

  if (fallbackAspectRatio > 1.5) return DEFAULT_WIDGET_VIEWPORTS['4x2'];
  if (fallbackAspectRatio > 0.9) return DEFAULT_WIDGET_VIEWPORTS['2x2'];
  return { width: parsedWidth, height: parsedHeight };
}

function registerBroadcastBinders(
  nodes: WmrNode[],
  vars: VarContext,
  cleanups: Array<() => void>,
): void {
  for (const node of nodes) {
    if (node.tag === 'BroadcastBinder' && node.action) {
      seedBroadcastBinder(node, vars);
      const unregister = BroadcastBus.registerReceiver(node.action, (intent) => {
        const extras = intent.extras ?? {};
        for (const variable of node.variables) {
          const key = variable.extra || variable.name;
          const value = extras[key];
          if (value === undefined) continue;
          if (variable.type.endsWith('[]') && Array.isArray(value)) vars.setArray(variable.name, value as Array<string | number>);
          else vars.set(variable.name, value as string | number);
        }
        if (node.triggers?.length) {
          vars.executeTriggerList(node.triggers, 'up');
        }
      });
      cleanups.push(unregister);
    }
    if ('children' in node && Array.isArray((node as any).children)) {
      registerBroadcastBinders((node as any).children, vars, cleanups);
    }
    if ('normalChildren' in node && Array.isArray((node as any).normalChildren)) {
      registerBroadcastBinders((node as any).normalChildren, vars, cleanups);
    }
    if ('pressedChildren' in node && Array.isArray((node as any).pressedChildren)) {
      registerBroadcastBinders((node as any).pressedChildren, vars, cleanups);
    }
  }
}

function registerHostBroadcastHandlers(
  vars: VarContext,
  nodes: WmrNode[],
  analysis: WmrBundleAnalysis,
): () => void {
  const actions = [
    'com.miui.intent.action.CLEAN_MEMORY',
    'com.miui.intent.action.CHANGE_POWER_SAVE_MODE',
    'com.miui.intent.action.VIBRATE',
    'miui.intent.action.MAML_WIDGET_ADDED',
  ];
  const unregisters = actions.map((action) => BroadcastBus.registerReceiver(action, (intent) => {
    const handled = handleWmrHostBroadcast(action, intent.extras ?? {}, {
      cleanableMemory: vars.getNum('cleanableMemory'),
      memoryCleanable: vars.getNum('memoryCleanable'),
      memoryCleanableAniVal: vars.getNum('memoryCleanableAniVal'),
    });
    if (!handled) return;
    injectProviderData(vars, {
      binders: analysis.binders,
      dependencies: analysis.providerDependencies,
    });
    vars.reevaluateVars(nodes);
  }));
  return () => {
    for (const unregister of unregisters) unregister();
  };
}

function seedBroadcastBinder(
  node: Extract<WmrNode, { tag: 'BroadcastBinder' }>,
  vars: VarContext,
): void {
  const extras = getSyntheticBroadcastExtras(node.action ?? '', vars);
  for (const variable of node.variables) {
    const key = variable.extra || variable.name;
    const value = extras[key];
    if (value === undefined) continue;
    if (variable.type.endsWith('[]') && Array.isArray(value)) {
      vars.setArray(variable.name, value as Array<string | number>);
    } else if (typeof value === 'string' || typeof value === 'number') {
      vars.set(variable.name, value);
    }
  }
}

function getSyntheticBroadcastExtras(action: string, vars: VarContext): Record<string, string | number | Array<string | number>> {
  if (action === 'send_to_clock') {
    return {
      extra_timeformat12: vars.getNum('time_format') === 0 ? 1 : 0,
      extra_timecolor_mode: 0,
      extra_sub_v: 0,
      extra_time_font: 0,
      extra_date_font: 0,
      extra_sub_color: 0,
      extra_time_tint: vars.getNum('applied_light_wallpaper') ? '#B3000000' : '#ffffffff',
      extra_signature: '',
      extra_signature0: '',
      extra_sfcd: 0,
      extra_battery_level: vars.getNum('battery_level'),
      extra_date_diy: '',
      send_ClockMusicVis: vars.getStr('music_control.title') || vars.getStr('music_control.package') ? 1 : 0,
      send_AlarmDesk: vars.getNum('hasAlarmClock') > 0 ? 1 : 0,
    };
  }

  if (action === 'android.intent.action.BATTERY_CHANGED') {
    return {
      level: vars.getNum('battery_level'),
      scale: 100,
      status: vars.getNum('battery_state') ? 2 : 0,
      plugged: vars.getNum('battery_state') ? 1 : 0,
    };
  }

  if (action === 'miui.intent.action.POWER_SAVE_MODE_CHANGED') {
    const enabled = QuickSettingsService.getState().batterySaverEnabled ? 1 : 0;
    return {
      POWER_SAVE_MODE_OPEN: enabled,
      POWER_SAVE_MODE_OPEN_MAML: enabled,
    };
  }

  if (action === 'send_to_desk') {
    return {
      extra_desk_layout: 0,
      extra_desk_icon_size: 0,
      extra_desk_style: 0,
    };
  }

  return {};
}
