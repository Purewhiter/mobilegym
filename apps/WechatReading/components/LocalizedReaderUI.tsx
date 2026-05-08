import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '../../../os/locale';
import { dimens } from '../res/dimens';
import {
  IcBookCheck,
  IcBookPlus,
  IcCheck,
  IcClock,
  IcDisc,
  IcExpand,
  IcList,
  IcMessageSquare,
  IcReaderProgressMark,
  IcMoreVertical,
  IcNavBack,
  IcNavForward,
  IcShare,
  IcSun,
  IcUser,
  WechatReadingBookshelfIcon,
  WechatReadingDownloadIcon,
  WechatReadingFolderIcon,
} from '../res/icons';
import { getWechatReadingBookById, useWechatReadingStore } from '../state';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import { formatWechatReadingCount, formatWechatReadingWords } from '../utils/localization';
import type { BookChapter } from '../data/types';
import type { TransitionId } from '../navigation.declaration';
import { useAppNavigate } from '../navigation';
import { useReaderTheme } from '../hooks/useReaderTheme';
import { resolveReaderTheme } from '../utils/readerTheme';
import type { ReaderPageBlock } from '../utils/readerPagination';
import {
  FONT_SIZE_STOPS,
  LINE_HEIGHT_VALUES,
  MARGIN_PX_VALUES,
  normalizeLineHeightIndex,
  normalizeMarginIndex,
} from '../constants';

function getSteppedIndex(clientX: number, rect: DOMRect, stopCount: number): number {
  const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return Math.round(pct * (stopCount - 1));
}

function getPercentFromClientX(clientX: number, rect: DOMRect): number {
  return Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
}

function isPrimaryPointer(e: React.PointerEvent<HTMLDivElement>): boolean {
  return e.pointerType !== 'mouse' || e.button === 0;
}

function bindPointerSlider(
  pointerIdRef: React.MutableRefObject<number | null>,
  onUpdate: (clientX: number, rect: DOMRect) => void,
): React.HTMLAttributes<HTMLDivElement> {
  const updateFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    onUpdate(e.clientX, e.currentTarget.getBoundingClientRect());
  };

  const releasePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore browsers that reject release after cancellation.
    }
  };

  return {
    onPointerDown: e => {
      if (!isPrimaryPointer(e)) return;
      pointerIdRef.current = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore browsers that do not support pointer capture here.
      }
      updateFromEvent(e);
    },
    onPointerMove: e => {
      if (pointerIdRef.current !== e.pointerId) return;
      updateFromEvent(e);
    },
    onPointerUp: releasePointer,
    onPointerCancel: releasePointer,
    onLostPointerCapture: e => {
      if (pointerIdRef.current === e.pointerId) {
        pointerIdRef.current = null;
      }
    },
  };
}

function getSteppedLeft(index: number, maxIndex: number, thumbSize = 48, inset = 0): string {
  const clamped = Math.max(0, Math.min(maxIndex, index));
  const pct = (clamped / maxIndex) * 100;
  return `calc(${inset}px + ${pct}% - ${(pct * (thumbSize + inset * 2)) / 100}px)`;
}

function getSteppedFillWidth(index: number, maxIndex: number, thumbSize = 48, inset = 0): string {
  const clamped = Math.max(0, Math.min(maxIndex, index));
  const pct = (clamped / maxIndex) * 100;
  return `calc(${inset + thumbSize}px + ${pct}% - ${(pct * (thumbSize + inset * 2)) / 100}px)`;
}

function getNearestFontSizeIndex(value: number): number {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < FONT_SIZE_STOPS.length; i++) {
    const diff = Math.abs(FONT_SIZE_STOPS[i] - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export const LocalizedReaderMenu: React.FC<{
  visible: boolean;
  onBack: () => void;
  isInShelf: boolean;
  toggleShelfBinding: React.ButtonHTMLAttributes<HTMLButtonElement>;
  bindTap: any;
  bookId: string;
  activeTool: string | null;
  hasToc?: boolean;
}> = ({ visible, onBack, isInShelf, toggleShelfBinding, bindTap, bookId, activeTool, hasToc }) => {
  const { go } = useAppNavigate();
  const rt = useReaderTheme();
  const readerPrefs = useWechatReadingStore(s => s.readerPrefs);
  const updateReaderPrefs = useWechatReadingStore(s => s.updateReaderPrefs);
  const updateProgress = useWechatReadingStore(s => s.updateProgress);
  const bookProgress = useWechatReadingStore(s => s.bookProgress);
  const s = useWechatReadingStrings();
  const locale = useLocale();
  const book = getWechatReadingBookById(bookId);
  const currentProgress = bookProgress[bookId];
  const [localProgress, setLocalProgress] = useState(0);
  const [localBrightness, setLocalBrightness] = useState(60);
  const [showPageTurnPanel, setShowPageTurnPanel] = useState(false);
  const settings = useWechatReadingStore(s => s.settings);
  const updateSettings = useWechatReadingStore(s => s.updateSettings);

  // Reset page turn panel when tool changes
  useEffect(() => {
    if (activeTool !== 'typography') setShowPageTurnPanel(false);
  }, [activeTool]);
  const progressPointerIdRef = useRef<number | null>(null);
  const brightnessPointerIdRef = useRef<number | null>(null);
  const fontSizePointerIdRef = useRef<number | null>(null);
  const marginPointerIdRef = useRef<number | null>(null);
  const lineHeightPointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (book && currentProgress) {
      const pct = Math.min(100, Math.round((currentProgress.charOffset / book.totalWords) * 100));
      setLocalProgress(pct);
    }
  }, [book, currentProgress]);

  const handleProgressChange = (pct: number) => {
    setLocalProgress(pct);
    if (book) {
      const offset = Math.floor((pct / 100) * book.totalWords);
      updateProgress(bookId, offset);
    }
  };

  const handleBrightnessChange = (clientX: number, rect: DOMRect) => {
    setLocalBrightness(getPercentFromClientX(clientX, rect));
  };

  const fontSize = readerPrefs.fontSize;
  const themeColor = readerPrefs.themeColor;
  const themeBg = readerPrefs.themeBg;
  const marginIndex = normalizeMarginIndex(readerPrefs.margin);
  const lineHeightIndex = normalizeLineHeightIndex(readerPrefs.lineHeight);
  const panelHeight = 'h-[18rem]';
  const notesUnit = locale === 'en' ? 'items' : '条';
  const listenLabel = locale === 'en' ? 'Listen' : '听';

  const bindReaderToolToggle = (openId: TransitionId, tool: string) =>
    bindTap(openId, {
      params: { bookId },
      onTrigger: () => {
        if (activeTool === tool) {
          go('reader.tool.close', { bookId });
        } else {
          go(openId, { bookId });
        }
      },
    });

  const progressSliderBinding = bindPointerSlider(progressPointerIdRef, (clientX, rect) => {
    handleProgressChange(getPercentFromClientX(clientX, rect));
  });

  const brightnessSliderBinding = bindPointerSlider(brightnessPointerIdRef, (clientX, rect) => {
    handleBrightnessChange(clientX, rect);
  });

  const fontSizeSliderBinding = bindPointerSlider(fontSizePointerIdRef, (clientX, rect) => {
    const index = getSteppedIndex(clientX, rect, FONT_SIZE_STOPS.length);
    updateReaderPrefs({ fontSize: FONT_SIZE_STOPS[index] });
  });

  const marginSliderBinding = bindPointerSlider(marginPointerIdRef, (clientX, rect) => {
    const index = getSteppedIndex(clientX, rect, 7);
    updateReaderPrefs({ margin: normalizeMarginIndex(index) });
  });

  const lineHeightSliderBinding = bindPointerSlider(lineHeightPointerIdRef, (clientX, rect) => {
    const index = getSteppedIndex(clientX, rect, 7);
    updateReaderPrefs({ lineHeight: normalizeLineHeightIndex(index) });
  });

  return (
    <>
      {(visible || activeTool) && (
        <div className="fixed inset-0 z-50 pointer-events-none font-sans" style={{ color: rt.textSecondary }}>
          {!activeTool && (
            <div
              className="pointer-events-auto backdrop-blur-sm px-4 pt-10 pb-2 flex items-center justify-between shadow-sm animate-slide-down"
              style={{ backgroundColor: rt.chromeBg }}
            >
              <button onClick={onBack} className="p-1 -ml-2 active:opacity-60" style={{ color: rt.textSecondary }}>
                <IcNavBack size={dimens.reader_menu_back_icon_size} strokeWidth={1.5} />
              </button>
              <div className="flex items-center gap-4">
                <button className="active:opacity-60" style={{ color: rt.textSecondary }}>
                  <IcClock size={dimens.icSizeTab} strokeWidth={1.5} />
                </button>
                <button
                  className="active:opacity-60 flex items-center gap-1"
                  style={{ color: rt.textSecondary }}
                  {...toggleShelfBinding}
                >
                  {isInShelf ? (
                    <>
                      <IcBookCheck size={dimens.icSizeNav} strokeWidth={1.5} />
                      <span className="text-(--app-bookshelf-footer-text-size) font-medium">{s.reader_added}</span>
                    </>
                  ) : (
                    <>
                      <IcBookPlus size={dimens.icSizeNav} strokeWidth={1.5} />
                      <span className="text-(--app-bookshelf-footer-text-size) font-medium">{s.reader_add_to_shelf}</span>
                    </>
                  )}
                </button>
                <button className="flex items-center gap-0.5 active:opacity-60" style={{ color: rt.textSecondary }}>
                  <IcUser size={dimens.icSizeNav} strokeWidth={1.5} />
                  <span className="text-(--app-tab-bar-label-size) font-medium -ml-0.5 translate-y-[1px]">
                    {formatWechatReadingCount(49000, locale)}
                  </span>
                </button>
                <button className="active:opacity-60" style={{ color: rt.textSecondary }}>
                  <IcShare size={dimens.icSizeNav} strokeWidth={1.5} />
                </button>
                <button className="active:opacity-60" style={{ color: rt.textSecondary }}>
                  <IcMoreVertical size={dimens.icSizeNav} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {(visible || !!activeTool) && (
            <div className="absolute bottom-0 left-0 right-0 flex flex-col pointer-events-none">
              <div className="pointer-events-auto flex justify-end pr-4 pb-2 animate-fade-in">
                <div className="flex flex-row items-center gap-3">
                  <button
                    type="button"
                    className="h-10 w-10 shrink-0 rounded-full bg-slate-700/90 backdrop-blur text-white flex items-center justify-center shadow-lg active:scale-95"
                    style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
                  >
                    <span className="font-serif italic font-bold text-lg">Ai</span>
                  </button>
                  <button
                    type="button"
                    className="h-10 w-10 shrink-0 rounded-full bg-slate-700/90 backdrop-blur text-white flex items-center justify-center shadow-lg active:scale-95"
                    style={{ transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
                  >
                    <span className="text-sm font-medium">{listenLabel}</span>
                  </button>
                </div>
              </div>
              {activeTool && (activeTool === 'progress' || activeTool === 'theme' || activeTool === 'typography') && (
                <div className="pointer-events-auto w-full animate-slide-up font-sans">
                  {activeTool === 'progress' && (
            <div
              className={`rounded-t-2xl p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between ${panelHeight}`}
              style={{ backgroundColor: rt.surface, color: rt.textPrimary }}
            >
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-between h-14">
                  <div className="text-2xl font-bold font-sans" style={{ color: rt.textPrimary }}>
                    {localProgress}
                    <span className="text-xs font-normal ml-0.5" style={{ color: rt.textMuted }}>%</span>
                  </div>
                  <div className="text-(--app-tab-bar-label-size)" style={{ color: rt.textMuted }}>{s.reader_approx_finish}</div>
                </div>
                <div className="flex flex-col items-center justify-between h-14 border-l border-r" style={{ borderColor: rt.border }}>
                  <div className="text-2xl font-bold font-sans" style={{ color: rt.textPrimary }}>
                    1
                    <span className="text-xs font-normal ml-0.5" style={{ color: rt.textMuted }}>{s.common_minutes_unit}</span>
                  </div>
                  <div className="text-(--app-tab-bar-label-size)" style={{ color: rt.textMuted }}>{s.reader_reading_duration}</div>
                </div>
                <div className="flex flex-col items-center justify-between h-14">
                  <div className="text-2xl font-bold font-sans" style={{ color: rt.textPrimary }}>
                    0
                    <span className="text-xs font-normal ml-0.5" style={{ color: rt.textMuted }}>{notesUnit}</span>
                  </div>
                  <div className="text-(--app-tab-bar-label-size)" style={{ color: rt.textMuted }}>{s.reader_notes}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div
                  className="relative h-12 rounded-full px-4 touch-none select-none"
                  style={{ backgroundColor: rt.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}
                  data-task-progress={localProgress}
                  {...progressSliderBinding}
                >
                  <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: getSteppedFillWidth(localProgress, 100),
                      backgroundColor: rt.sliderFill,
                      opacity: rt.isDark ? 0.36 : 0.22,
                    }}
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-base leading-none" style={{ color: rt.textSecondary }}>
                    {'<'}
                  </span>
                  <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-base leading-none" style={{ color: rt.textSecondary }}>
                    {'>'}
                  </span>
                  <div
                    className="pointer-events-none absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-md"
                    style={{
                      transition: 'all var(--app-duration-short) var(--app-easing-decelerate)',
                      left: getSteppedLeft(localProgress, 100),
                      backgroundColor: rt.surface,
                    }}
                  />
                </div>
                <div className="text-center text-(--app-tab-bar-label-size)" style={{ color: rt.textMuted }}>{s.reader_last_read_here}</div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-full border text-(--app-settings-item-value-size) font-medium shadow-sm"
                  style={{ borderColor: rt.border, backgroundColor: rt.surface, color: rt.textPrimary }}
                >
                  {s.reader_reading_detail}
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-full border text-(--app-settings-item-value-size) font-medium shadow-sm"
                  style={{ borderColor: rt.border, backgroundColor: rt.surface, color: rt.textPrimary }}
                >
                  {s.reader_auto_page_turn}
                </button>
              </div>
            </div>
          )}

          {activeTool === 'theme' && (
            <div
              className={`rounded-t-2xl p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between ${panelHeight}`}
              style={{ backgroundColor: rt.surface, color: rt.textPrimary }}
              data-task-theme={themeColor}
              data-task-theme-bg={themeBg}
            >
              <div
                className="relative h-12 rounded-full px-4 touch-none select-none"
                style={{ backgroundColor: rt.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}
                data-task-brightness={localBrightness}
                {...brightnessSliderBinding}
              >
                <div
                  className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
                  style={{
                    width: getSteppedFillWidth(localBrightness, 100),
                    backgroundColor: rt.sliderFill,
                    opacity: rt.isDark ? 0.36 : 0.22,
                  }}
                />
                <IcSun
                  size={dimens.icSizeAction}
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2"
                  style={{ color: rt.textSecondary }}
                />
                <IcSun
                  size={dimens.icSizeTab}
                  className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2"
                  style={{ color: rt.textSecondary }}
                />
                <div
                  className="pointer-events-none absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full shadow-md"
                  style={{
                    transition: 'all var(--app-duration-short) var(--app-easing-decelerate)',
                    left: getSteppedLeft(localBrightness, 100),
                    backgroundColor: rt.surface,
                  }}
                />
              </div>
              <div>
                <div className="mb-3 px-1 text-xs" style={{ color: rt.textMuted }}>{s.reader_theme_color}</div>
                <div className="flex justify-between gap-3 px-1">
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeColor: 'white' })}
                    className={`aspect-[1.6] flex-1 rounded-lg border-2 ${themeColor === 'white' ? 'border-blue-500' : 'border-transparent'} bg-white`}
                  />
                  <button onClick={() => updateReaderPrefs({ themeColor: 'yellow' })} className={`aspect-[1.6] flex-1 rounded-lg border-2 ${themeColor === 'yellow' ? 'border-blue-500' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-f6f2)`} />
                  <button onClick={() => updateReaderPrefs({ themeColor: 'green' })} className={`aspect-[1.6] flex-1 rounded-lg border-2 ${themeColor === 'green' ? 'border-blue-500' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-e8f5)`} />
                  <button onClick={() => updateReaderPrefs({ themeColor: 'dark' })} className={`aspect-[1.6] flex-1 rounded-lg border-2 ${themeColor === 'dark' ? 'border-blue-500' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-1a1a) flex items-center justify-center`}>
                    <div className="h-3 w-3 rounded-full border border-(--app-c-tw-border-gray-500)" />
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-3 px-1 text-xs" style={{ color: rt.textMuted }}>{s.reader_theme_background}</div>
                <div className="flex justify-between gap-3 px-1 pb-2">
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeBg: 'matchTheme' })}
                    className={`relative aspect-[1.6] flex-1 rounded-3xl border-2 ${themeBg === 'matchTheme' ? 'border-blue-500' : 'border-transparent'}`}
                    style={{ backgroundColor: resolveReaderTheme(themeColor, 'matchTheme').pageBg }}
                  >
                    <div className="absolute inset-0 rounded-3xl opacity-10 bg-[url('https://www.transparenttextures.com/patterns/paper.png')]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeBg: 'bg1' })}
                    className={`aspect-[1.6] flex-1 rounded-3xl border ${themeBg === 'bg1' ? 'border-blue-500 border-2' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-faf9)`}
                  />
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeBg: 'bg2' })}
                    className={`aspect-[1.6] flex-1 rounded-3xl border ${themeBg === 'bg2' ? 'border-blue-500 border-2' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-f5f5)`}
                  />
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeBg: 'bg3' })}
                    className={`aspect-[1.6] flex-1 rounded-3xl border ${themeBg === 'bg3' ? 'border-blue-500 border-2' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-efef)`}
                  />
                  <button
                    type="button"
                    onClick={() => updateReaderPrefs({ themeBg: 'bg4' })}
                    className={`aspect-[1.6] flex-1 rounded-3xl border ${themeBg === 'bg4' ? 'border-blue-500 border-2' : 'border-(--app-c-tw-border-gray-100)'} bg-(--app-c-reader-page-bg-e0e0)`}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTool === 'typography' && (
            <div
              className={`rounded-t-2xl p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] flex flex-col justify-between ${panelHeight}`}
              style={{ backgroundColor: rt.surfaceMuted, color: rt.textPrimary }}
            >
            {showPageTurnPanel ? (
              <>
                {/* ── Page Turn Style Sub-panel ── */}
                <div className="relative flex items-center justify-between mb-3">
                  <button type="button" className="p-1 z-10" onClick={() => setShowPageTurnPanel(false)}>
                    <IcExpand size={dimens.icSizeAction} style={{ color: rt.textSecondary }} />
                  </button>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold pointer-events-none" style={{ color: rt.textPrimary }}>{s.page_turn_title}</span>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-full text-xs z-10"
                    style={{ backgroundColor: rt.surface, color: rt.textSecondary }}
                  >
                    {s.reader_auto_page_turn}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {([
                    { key: '仿真翻页', label: s.page_turn_simulation },
                    { key: '左右滑动', label: s.page_turn_swipe },
                    { key: '上下滚动', label: s.page_turn_scroll },
                    { key: '覆盖翻页', label: s.page_turn_cover },
                  ] as const).map(opt => {
                    const isSelected = settings.pageTurnStyle === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className="w-full text-left px-5 py-3.5 rounded-xl text-sm"
                        style={{
                          backgroundColor: rt.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          color: isSelected ? '#3b82f6' : rt.textPrimary,
                          border: isSelected ? '1.5px solid #93c5fd' : '1.5px solid transparent',
                        }}
                        onClick={() => { updateSettings({ pageTurnStyle: opt.key }); setShowPageTurnPanel(false); go('reader.tool.close', { bookId }); }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* ── Typography controls (original) ── */}
              <div
                className="relative h-12 rounded-full px-4 touch-none select-none"
                style={{ backgroundColor: rt.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}
                data-task-fontsize={fontSize}
                {...fontSizeSliderBinding}
              >
                <div
                  className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
                  style={{
                    width: getSteppedFillWidth(getNearestFontSizeIndex(fontSize), FONT_SIZE_STOPS.length - 1),
                    backgroundColor: rt.sliderFill,
                    opacity: rt.isDark ? 0.36 : 0.22,
                  }}
                />
                <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm" style={{ color: rt.textSecondary }}>A</span>
                <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-xl" style={{ color: rt.textSecondary }}>A</span>
                <div
                  className="pointer-events-none absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-semibold shadow-md"
                  style={{
                    transition: 'all var(--app-duration-short) var(--app-easing-decelerate)',
                    left: getSteppedLeft(getNearestFontSizeIndex(fontSize), FONT_SIZE_STOPS.length - 1),
                    backgroundColor: rt.surface,
                    color: rt.textSecondary,
                  }}
                >
                  {fontSize}
                </div>
              </div>

              <div className="flex gap-4">
                <div
                  className="relative h-12 flex-1 rounded-full px-4 touch-none select-none"
                  style={{ backgroundColor: rt.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}
                  data-task-margin={marginIndex}
                  {...marginSliderBinding}
                >
                  <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: getSteppedFillWidth(marginIndex, 6),
                      backgroundColor: rt.sliderFill,
                      opacity: rt.isDark ? 0.36 : 0.22,
                    }}
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-xs" style={{ color: rt.textSecondary }}>
                    {s.reader_typography_margin_small}
                  </span>
                  <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-xs" style={{ color: rt.textSecondary }}>
                    {s.reader_typography_margin_large}
                  </span>
                  <div
                    className="pointer-events-none absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-xs shadow-md"
                    style={{
                      transition: 'all var(--app-duration-short) var(--app-easing-decelerate)',
                      left: getSteppedLeft(marginIndex, 6),
                      backgroundColor: rt.surface,
                      color: rt.textSecondary,
                    }}
                  >
                    {s.reader_typography_margin_label}
                  </div>
                </div>
                <div
                  className="relative h-12 flex-1 rounded-full px-4 touch-none select-none"
                  style={{ backgroundColor: rt.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }}
                  data-task-lineheight={lineHeightIndex}
                  {...lineHeightSliderBinding}
                >
                  <div
                    className="pointer-events-none absolute left-0 top-0 bottom-0 rounded-full"
                    style={{
                      width: getSteppedFillWidth(lineHeightIndex, 6),
                      backgroundColor: rt.sliderFill,
                      opacity: rt.isDark ? 0.36 : 0.22,
                    }}
                  />
                  <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-xs" style={{ color: rt.textSecondary }}>
                    {s.reader_typography_line_tight}
                  </span>
                  <span className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 text-xs" style={{ color: rt.textSecondary }}>
                    {s.reader_typography_line_loose}
                  </span>
                  <div
                    className="pointer-events-none absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-xs shadow-md"
                    style={{
                      transition: 'all var(--app-duration-short) var(--app-easing-decelerate)',
                      left: getSteppedLeft(lineHeightIndex, 6),
                      backgroundColor: rt.surface,
                      color: rt.textSecondary,
                    }}
                  >
                    {s.reader_typography_line_label}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium shadow-sm"
                  style={{ backgroundColor: rt.surface, color: rt.textSecondary }}
                >
                  {s.reader_typography_font} <IcNavForward size={dimens.icSizeReaderChevron} style={{ color: rt.textMuted }} />
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium shadow-sm"
                  style={{ backgroundColor: rt.surface, color: rt.textSecondary }}
                >
                  {s.reader_typography_indent} <IcNavForward size={dimens.icSizeReaderChevron} style={{ color: rt.textMuted }} />
                </button>
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium shadow-sm"
                  style={{ backgroundColor: rt.surface, color: rt.textSecondary }}
                  onClick={() => setShowPageTurnPanel(true)}
                >
                  {{ '仿真翻页': s.page_turn_simulation, '左右滑动': s.page_turn_swipe, '上下滚动': s.page_turn_scroll, '覆盖翻页': s.page_turn_cover }[settings.pageTurnStyle] ?? s.reader_typography_page_turn} <IcNavForward size={dimens.icSizeReaderChevron} style={{ color: rt.textMuted }} />
                </button>
              </div>
              </>
            )}
            </div>
          )}
                </div>
              )}

              <div
                className="pointer-events-auto backdrop-blur-sm px-6 pt-3 pb-8 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.05)] animate-slide-up"
                style={{ backgroundColor: rt.chromeBg, color: rt.textSecondary }}
              >
                <div
                  className={`flex flex-col items-center gap-1 active:opacity-60 w-10 ${activeTool === 'toc' ? 'text-(--app-c-tw-text-blue-500)' : ''}`}
                  style={activeTool !== 'toc' ? { color: rt.textSecondary } : undefined}
                  {...(hasToc ? bindReaderToolToggle('reader.toc.open', 'toc') : {})}
                >
                  <IcList size={dimens.icSizeTab} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col items-center gap-1 active:opacity-60 w-10" style={{ color: rt.textSecondary }}>
                  <IcMessageSquare size={dimens.icSizeToolbar} strokeWidth={1.5} />
                </div>
                <div
                  className={`flex flex-col items-center gap-1 active:opacity-60 w-10 ${activeTool === 'progress' ? 'text-(--app-c-tw-text-blue-500)' : ''}`}
                  style={activeTool !== 'progress' ? { color: rt.textSecondary } : undefined}
                  {...bindReaderToolToggle('reader.progress.open', 'progress')}
                >
                  <IcReaderProgressMark size={dimens.icSizeTab} strokeWidth={1.5} />
                </div>
                <div
                  className={`flex flex-col items-center gap-1 active:opacity-60 w-10 ${activeTool === 'theme' ? 'text-(--app-c-tw-text-blue-500)' : ''}`}
                  style={activeTool !== 'theme' ? { color: rt.textSecondary } : undefined}
                  {...bindReaderToolToggle('reader.theme.open', 'theme')}
                >
                  <IcSun size={dimens.icSizeTab} strokeWidth={1.5} />
                </div>
                <div
                  className={`flex flex-col items-center gap-1 active:opacity-60 w-10 ${activeTool === 'typography' ? 'text-(--app-c-tw-text-blue-500)' : ''}`}
                  style={activeTool !== 'typography' ? { color: rt.textSecondary } : undefined}
                  {...bindReaderToolToggle('reader.typography.open', 'typography')}
                >
                  <span className="select-none text-[22px] font-semibold leading-none font-serif">A</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export const LocalizedDoorLeafView: React.FC<{ book: any }> = ({ book }) => {
  const s = useWechatReadingStrings();
  const locale = useLocale();
  const rt = useReaderTheme();

  return (
    <div
      className="relative flex h-full w-full animate-fade-in flex-col items-center overflow-hidden p-8 pt-20 font-sans"
      style={{ backgroundColor: rt.pageBg }}
    >
      <div className="relative mb-8 rounded-sm shadow-[0_10px_20px_rgba(0,0,0,0.15)]">
        {book.cover ? (
          <img src={book.cover} alt={book.title} className="h-56 w-40 rounded-sm object-cover" />
        ) : (
          <div className={`flex h-56 w-40 items-center justify-center rounded-sm p-4 text-center ${book.coverColor || 'bg-(--app-c-tw-bg-gray-200)'}`}>
            <div className="writing-vertical-rl h-[80%] border border-(--app-c-tw-border-gray-800)/20 p-2 text-lg font-bold tracking-widest text-(--app-c-tw-text-gray-800)/80">
              {book.title}
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-full rounded-sm bg-gradient-to-r from-black/5 via-transparent to-black/10" />
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ color: rt.textPrimary }}>{book.title}</h1>
      <p className="mb-12 text-base font-medium text-app-primary">{book.author}</p>

      <div
        className="w-full rounded-2xl border p-4 backdrop-blur-sm"
        style={{ backgroundColor: rt.surface, borderColor: rt.border }}
      >
        <div className="mb-2 text-sm" style={{ color: rt.textMuted }}>
          {s.reading_recommendation_value} {book.recommendedValue}%
        </div>

        <div className="mb-4 flex items-center gap-4">
          {book.masterpiece && (
            <div className="flex items-center gap-1">
              <span className="font-sans text-3xl font-bold text-(--app-c-reader-page-text-d1a0)">{s.book_detail_masterpiece}</span>
              <div className="ml-1 h-3 w-3 rotate-45 border-b-2 border-l-2 border-(--app-c-reader-page-border-d1a0) text-(--app-c-reader-page-text-d1a0)" />
            </div>
          )}
          <span className="mt-2 text-xs text-(--app-c-tw-text-gray-400)">
            {formatWechatReadingCount(book.totalReviews, locale)}
            {s.book_detail_person_review}
            {' >'}
          </span>
        </div>

        <div className="mb-4 space-y-2">
          <div className="flex items-center text-xs">
            <span className="w-20 font-medium text-(--app-c-tw-text-gray-800)">{s.book_detail_recommend} ({formatWechatReadingCount(book.reviewBreakdown?.recommended, locale)})</span>
            <div className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-(--app-c-tw-bg-gray-100)">
              <div className="h-full w-[92%] rounded-full bg-(--app-c-tw-bg-gray-400)" />
            </div>
          </div>
          <div className="flex items-center text-xs">
            <span className="w-20 text-(--app-c-tw-text-gray-400)">{s.book_detail_average} ({formatWechatReadingCount(book.reviewBreakdown?.average, locale)})</span>
            <div className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-(--app-c-tw-bg-gray-100)">
              <div className="h-full w-[6%] rounded-full bg-(--app-c-tw-bg-gray-300)" />
            </div>
          </div>
          <div className="flex items-center text-xs">
            <span className="w-20 text-(--app-c-tw-text-gray-400)">{s.book_detail_not_recommend} ({book.reviewBreakdown?.notRecommended ?? 0})</span>
            <div className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-(--app-c-tw-bg-gray-100)">
              <div className="h-full w-[1%] rounded-full bg-(--app-c-tw-bg-gray-200)" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="rounded-full bg-(--app-c-tw-bg-gray-100) px-3 py-1 text-xs font-medium text-(--app-c-tw-text-gray-600)">
            {s.book_detail_recommend} ({formatWechatReadingCount(book.reviewBreakdown?.recommended, locale)})
          </div>
          <div className="rounded-full bg-(--app-c-tw-bg-gray-100) px-3 py-1 text-xs text-(--app-c-tw-text-gray-400)">
            {s.book_detail_average} ({formatWechatReadingCount(book.reviewBreakdown?.average, locale)})
          </div>
          <div className="rounded-full bg-(--app-c-tw-bg-gray-100) px-3 py-1 text-xs text-(--app-c-tw-text-gray-400)">
            {s.book_detail_not_recommend} ({book.reviewBreakdown?.notRecommended ?? 0})
          </div>
        </div>
      </div>

      <div className="mt-8 flex w-full items-center justify-between px-2">
        <div className="text-center">
          <div className="mb-1 text-xs text-(--app-c-tw-text-gray-400)">{s.book_detail_stat_reading}</div>
          <div className="font-sans text-xl font-bold text-(--app-c-tw-text-gray-800)">{formatWechatReadingCount(book.totalReads, locale)}</div>
        </div>
        <div className="h-8 w-(--app-comp-header-width-1) bg-(--app-c-tw-bg-gray-200)" />
        <div className="flex flex-col items-center text-center">
          <div className="mb-1 text-(--app-c-reader-page-text-d1a0)"><IcDisc size={dimens.icSizeChevron} /></div>
          <div className="text-sm font-bold text-(--app-c-reader-page-text-d1a0)">{book.isMembership ? s.reader_membership_paid : s.reader_free}</div>
        </div>
        <div className="h-8 w-(--app-comp-header-width-1) bg-(--app-c-tw-bg-gray-200)" />
        <div className="text-center">
          <div className="mb-1 flex items-center gap-1 text-xs text-(--app-c-tw-text-gray-400)">
            {s.book_detail_word_count}
            <span className="flex h-3 w-3 items-center justify-center rounded-full border border-(--app-c-tw-border-gray-400) text-(--app-item-text-size-8)">?</span>
          </div>
          <div className="font-sans text-xl font-bold text-(--app-c-tw-text-gray-800)">{formatWechatReadingWords(book.totalWords, locale)}</div>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 text-center text-sm text-(--app-c-tw-text-gray-400) animate-pulse">
        {s.reader_swipe_to_start}
      </div>
    </div>
  );
};

export const LocalizedContentView: React.FC<{
  blocks: ReaderPageBlock[];
  chapterTitle: string;
  isChapterStart: boolean;
  pageInfo: string;
}> = ({ blocks, chapterTitle, isChapterStart, pageInfo }) => {
  const rt = useReaderTheme();
  const readerPrefs = useWechatReadingStore(s => s.readerPrefs);
  const fs = readerPrefs.fontSize;
  const lhMul = LINE_HEIGHT_VALUES[normalizeLineHeightIndex(readerPrefs.lineHeight)];
  const mPx = MARGIN_PX_VALUES[normalizeMarginIndex(readerPrefs.margin)];

  return (
    <div
      className="flex h-full w-full flex-col pt-10 pb-6 font-sans"
      style={{ color: rt.textPrimary, paddingLeft: mPx, paddingRight: mPx }}
    >
      {!isChapterStart && (
        <div className="mb-4 truncate text-xs font-light" style={{ color: rt.textMuted }}>{chapterTitle}</div>
      )}
      <div className="flex-1 overflow-hidden">
        {isChapterStart && (
          <h2 className="mb-6 font-bold" style={{ color: rt.textPrimary, fontSize: Math.round(fs * 1.25) }}>{chapterTitle}</h2>
        )}
        {blocks.map((block) => (
          <p
            key={block.key}
            className="mb-4 text-justify tracking-wide"
            style={{ color: rt.textPrimary, fontSize: fs, lineHeight: lhMul, textIndent: block.indent ? '2em' : 0 }}
          >
            {block.text}
          </p>
        ))}
      </div>
      <div className="mt-2 text-right font-mono text-[10px]" style={{ color: rt.textMuted }}>
        {pageInfo}
      </div>
    </div>
  );
};

export const LocalizedReaderShelfModal: React.FC<{
  bindBack: any;
  bindTap: any;
  bookId: string;
  onRemove: () => void;
}> = ({ bindBack, bindTap, bookId, onRemove }) => {
  const s = useWechatReadingStrings();
  const rt = useReaderTheme();
  const rowBg = rt.surface;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }} {...bindBack()} />
      <div
        className="fixed bottom-0 left-0 right-0 z-[70] overflow-hidden rounded-t-2xl pb-safe font-sans animate-slide-up"
        style={{ backgroundColor: rt.surfaceMuted, color: rt.textPrimary }}
      >
        <div className="flex flex-col">
          <button type="button" className="mb-[1px] flex items-center gap-3 px-6 py-4 active:opacity-80" style={{ backgroundColor: rowBg }}>
            <div className="flex w-6 justify-center"><IcUser size={dimens.icSizeNav} style={{ color: rt.textSecondary }} /></div>
            <span className="text-(--app-settings-item-text-size) font-medium" style={{ color: rt.textPrimary }}>{s.reader_shelf_modal_private}</span>
          </button>
          <button type="button" className="mb-[1px] flex items-center gap-3 px-6 py-4 active:opacity-80" style={{ backgroundColor: rowBg }}>
            <div className="flex w-6 justify-center" style={{ color: rt.textSecondary }}>
              <WechatReadingDownloadIcon />
            </div>
            <span className="text-(--app-settings-item-text-size) font-medium" style={{ color: rt.textPrimary }}>{s.reader_shelf_modal_download}</span>
          </button>
          <button type="button" className="mb-[1px] flex items-center gap-3 px-6 py-4 active:opacity-80" style={{ backgroundColor: rowBg }}>
            <div className="flex w-6 justify-center" style={{ color: rt.textSecondary }}>
              <WechatReadingFolderIcon />
            </div>
            <span className="text-(--app-settings-item-text-size) font-medium" style={{ color: rt.textPrimary }}>{s.reader_shelf_modal_move}</span>
          </button>
          <button
            type="button"
            {...bindTap(
              { kind: 'action', id: 'reader.item.shelf.remove.submit' },
              { params: { bookId }, onTrigger: onRemove },
            )}
            className="mb-2 flex items-center gap-3 px-6 py-4 active:opacity-80"
            style={{ backgroundColor: rowBg }}
          >
            <div className="flex w-6 justify-center"><WechatReadingBookshelfIcon className="text-red-500" /></div>
            <span className="text-(--app-settings-item-text-size) font-medium text-red-500">{s.reader_shelf_modal_remove}</span>
          </button>

          <button
            type="button"
            {...bindBack()}
            className="w-full py-4 text-center text-(--app-settings-item-text-size) font-bold active:opacity-80"
            style={{ backgroundColor: rowBg, color: rt.textPrimary }}
          >
            {s.reader_shelf_modal_cancel}
          </button>
        </div>
      </div>
    </>
  );
};

export const LocalizedTocPanel: React.FC<{
  chapters: BookChapter[];
  currentChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onClose: () => void;
}> = ({ chapters, currentChapterIndex, onSelectChapter, onClose }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rt = useReaderTheme();

  React.useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeItem = container.querySelector('[data-active="true"]');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center' });
    }
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/40"
        style={{ transition: 'opacity var(--app-duration-short) var(--app-easing-standard)' }}
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 left-0 z-[56] w-[75%] max-w-[300px] shadow-xl animate-slide-in-left flex flex-col"
        style={{ backgroundColor: rt.surface, color: rt.textPrimary }}
      >
        <div className="flex items-center justify-between px-4 pt-11 pb-3 border-b" style={{ borderColor: rt.border }}>
          <span className="text-base font-bold" style={{ color: rt.textPrimary }}>目录</span>
          <span className="text-xs" style={{ color: rt.textMuted }}>共{chapters.length}章</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          {chapters.map((ch) => {
            const isActive = ch.index === currentChapterIndex;
            return (
              <button
                key={ch.index}
                data-active={isActive}
                type="button"
                className={`block w-full text-left px-4 py-3 text-sm border-b active:opacity-90 ${
                  isActive ? 'text-app-primary font-semibold' : ''
                }`}
                style={{
                  borderColor: rt.border,
                  backgroundColor: isActive ? (rt.isDark ? 'rgba(59,130,246,0.15)' : 'rgba(239,246,255,0.95)') : undefined,
                  color: isActive ? undefined : rt.textPrimary,
                }}
                onClick={() => onSelectChapter(ch.index)}
              >
                <span className="line-clamp-2">{ch.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
