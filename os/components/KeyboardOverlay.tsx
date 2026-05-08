import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SIMULATOR_CONFIG } from '../data';
const { zIndexKeyboard, keyboardHeight } = SIMULATOR_CONFIG.framework;
import { KeyboardService, type KeyboardMode } from '../keyboard/KeyboardService';
import { getZhCandidates } from '../keyboard/pinyinIme';
import { realNow } from '../TimeService';

type EditableEl = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const NON_TEXT_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'range', 'color', 'file',
  'button', 'submit', 'reset', 'image', 'hidden',
]);

function isEditableElement(el: any): el is EditableEl {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement)
    return !el.disabled && !el.readOnly && !NON_TEXT_INPUT_TYPES.has(el.type) && el.inputMode !== 'none';
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  return el.isContentEditable === true;
}

function getActiveEditable(): EditableEl | null {
  const el = document.activeElement as any;
  return isEditableElement(el) ? el : null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  let proto: any = Object.getPrototypeOf(el);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, value);
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
  (el as any).value = value;
}

function dispatchInput(el: HTMLElement) {
  try {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {
    // ignore
  }
}

function insertText(text: string) {
  const el = getActiveEditable();
  if (!el) return;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = String(el.value ?? '');
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    const next = value.slice(0, start) + text + value.slice(end);
    setNativeValue(el, next);
    try {
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    } catch {
      // ignore
    }
    dispatchInput(el);
    return;
  }

  try {
    document.execCommand('insertText', false, text);
  } catch {
    el.textContent = (el.textContent || '') + text;
    dispatchInput(el);
  }
}

function deleteBackward() {
  const el = getActiveEditable();
  if (!el) return;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = String(el.value ?? '');
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    if (start !== end) {
      const next = value.slice(0, start) + value.slice(end);
      setNativeValue(el, next);
      try {
        el.setSelectionRange(start, start);
      } catch {
        // ignore
      }
      dispatchInput(el);
      return;
    }
    if (start <= 0) return;
    const next = value.slice(0, start - 1) + value.slice(start);
    setNativeValue(el, next);
    try {
      el.setSelectionRange(start - 1, start - 1);
    } catch {
      // ignore
    }
    dispatchInput(el);
    return;
  }

  try {
    document.execCommand('delete', false);
  } catch {
    const t = el.textContent || '';
    el.textContent = t.slice(0, -1);
    dispatchInput(el);
  }
}

/**
 * 向上查找最近的可滚动容器
 */
function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    // 也检查 data-scroll-container 属性
    if (current.dataset.scrollContainer) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * 执行智能滚动：模拟 Android ScrollView.requestChildRectangleOnScreen()。
 * 最小滚动量，刚好让焦点输入框在可见区域底部露出。
 * 优先使用 adjustResize wrapper 的 bounds（准确反映可见区域），
 * 回退到 window.innerHeight - keyboardHeight。
 */
function doSmartScroll(target: HTMLElement, keyboardHeight: number) {
  const rect = target.getBoundingClientRect();

  const wrapper = target.closest('[data-adjust-resize]') as HTMLElement | null;
  const visibleBottom = wrapper
    ? wrapper.getBoundingClientRect().bottom
    : window.innerHeight - keyboardHeight;

  if (rect.bottom > visibleBottom) {
    const scrollContainer = findScrollContainer(target);
    if (scrollContainer) {
      const scrollAmount = rect.bottom - visibleBottom + 10;
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  }
}

/**
 * 检查元素是否应该跳过自动滚动
 * - data-keep-keyboard: 元素使用布局模式处理键盘，不需要滚动
 * - data-keyboard-scroll="none": 显式禁用自动滚动
 */
function shouldSkipAutoScroll(element: HTMLElement): boolean {
  return !!(
    element.closest?.('[data-keep-keyboard]') ||
    element.closest?.('[data-keyboard-scroll="none"]')
  );
}

/**
 * 延迟两帧执行滚动，确保 adjustResize wrapper 已完成布局
 */
function deferredSmartScroll(target: HTMLElement, keyboardHeight: number) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => doSmartScroll(target, keyboardHeight)),
  );
}

/**
 * 智能滚动输入框到可见区域
 * - 如果输入框会被键盘遮挡，滚动到刚好在键盘上方
 * - 如果空间足够，不滚动
 * - 如果元素使用布局模式（data-keep-keyboard），不滚动
 * - 等待键盘高度更新 + adjustResize 布局完成后再判断
 */
function safeScrollIntoView(target: HTMLElement) {
  try {
    if (shouldSkipAutoScroll(target)) {
      return;
    }
    
    const currentHeight = KeyboardService.getHeight();
    if (currentHeight > 0) {
      deferredSmartScroll(target, currentHeight);
      return;
    }
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkAndScroll = () => {
      attempts++;
      const height = KeyboardService.getHeight();
      if (height > 0) {
        deferredSmartScroll(target, height);
      } else if (attempts < maxAttempts) {
        requestAnimationFrame(checkAndScroll);
      }
    };
    
    requestAnimationFrame(checkAndScroll);
  } catch {
    // ignore
  }
}

// Key layout with secondary characters
const KEY_ROW_1 = [
  { main: 'Q', sub: '1' },
  { main: 'W', sub: '2' },
  { main: 'E', sub: '3' },
  { main: 'R', sub: '4' },
  { main: 'T', sub: '5' },
  { main: 'Y', sub: '6' },
  { main: 'U', sub: '7' },
  { main: 'I', sub: '8' },
  { main: 'O', sub: '9' },
  { main: 'P', sub: '0' },
];

const KEY_ROW_2 = [
  { main: 'A', sub: '~' },
  { main: 'S', sub: '!' },
  { main: 'D', sub: '@' },
  { main: 'F', sub: '#' },
  { main: 'G', sub: '%' },
  { main: 'H', sub: '"' },
  { main: 'J', sub: '"' },
  { main: 'K', sub: '*' },
  { main: 'L', sub: '?' },
];

const KEY_ROW_3 = [
  { main: 'Z', sub: '(' },
  { main: 'X', sub: ')' },
  { main: 'C', sub: '-' },
  { main: 'V', sub: ':' },
  { main: 'B', sub: ';' },
  { main: 'N', sub: '/' },
  { main: 'M', sub: "'" },
];

// Number/Symbol rows
const NUM_ROW_1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NUM_ROW_2 = ['-', '/', ':', ';', '(', ')', '￥', '@', '"'];
const NUM_ROW_3 = ['。', '，', '、', '？', '！', '.', ',', '?', '!'];

const SYM_ROW_1 = ['[', ']', '{', '}', '#', '%', '^', '*', '+', '='];
const SYM_ROW_2 = ['_', '—', '\\', '|', '~', '《', '》', '€', '&'];
const SYM_ROW_3 = ['…', '·', '「', '」', '『', '』', '【', '】', "'"];

type KeyboardPage = 'alpha' | 'num' | 'sym';

// Shared mutable container: tracks timestamp until which synthetic mouse events
// should be ignored (Chrome DevTools touch emulation ghost-click prevention).
const _ignoreMouseUntil = { current: 0 };

const Key = React.memo(function Key({ children, onTap, flex, dark, className = '' }: {
  children: React.ReactNode;
  onTap: () => void;
  flex?: number;
  dark?: boolean;
  className?: string;
}) {
  const tapped = useRef(false);
  return (
    <div
      className={`
        flex items-center justify-center rounded-[5px] select-none active:opacity-70
        ${dark ? 'bg-[#a8abb3]' : 'bg-white'}
        ${className}
      `}
      style={{ flex: flex || 1, height: 48 }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && realNow() < _ignoreMouseUntil.current) return;
        e.preventDefault();
        if (tapped.current) return;
        tapped.current = true;
        onTap();
        setTimeout(() => { tapped.current = false; }, 80);
      }}
      onMouseDown={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onMouseUp={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
});

const LetterKey = React.memo(function LetterKey({ main, sub, lowercase, onTap }: {
  main: string;
  sub?: string;
  lowercase?: boolean;
  onTap: () => void;
}) {
  const tapped = useRef(false);
  const display = lowercase ? main.toLowerCase() : main;
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center rounded-[5px] bg-white select-none active:opacity-70 relative"
      style={{ height: 48 }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && realNow() < _ignoreMouseUntil.current) return;
        e.preventDefault();
        if (tapped.current) return;
        tapped.current = true;
        onTap();
        setTimeout(() => { tapped.current = false; }, 80);
      }}
      onMouseDown={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onMouseUp={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        if (realNow() < _ignoreMouseUntil.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {sub && (
        <span className="absolute top-[2px] left-[6px] text-[10px] text-gray-400">{sub}</span>
      )}
      <span className="text-[20px] text-black">{display}</span>
    </div>
  );
});

const CandidateItem = React.memo(function CandidateItem({ text, onSelect }: {
  text: string;
  onSelect: (text: string) => void;
}) {
  const startX = useRef(0);
  const moved = useRef(false);
  return (
    <div
      className="px-3 h-full flex items-center text-[17px] whitespace-nowrap cursor-pointer active:bg-gray-100"
      onPointerDown={(e) => {
        startX.current = e.clientX;
        moved.current = false;
      }}
      onPointerMove={(e) => {
        if (Math.abs(e.clientX - startX.current) > 5) moved.current = true;
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        if (!moved.current) onSelect(text);
      }}
    >
      {text}
    </div>
  );
});

const ToolbarIcon = React.memo(function ToolbarIcon({ children, onTap, className = '' }: {
  children: React.ReactNode;
  onTap?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 h-12 flex items-center justify-center text-gray-500 active:bg-gray-200 ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onTap?.();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </div>
  );
});

export const KeyboardOverlay: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(KeyboardService.getState().visible);
  const [mode, setMode] = useState<KeyboardMode>(KeyboardService.getState().mode);
  const [page, setPage] = useState<KeyboardPage>('alpha');

  const [pinyinRaw, setPinyinRaw] = useState('');

  const { candidates, pinyinDisplay } = useMemo(() => {
    if (mode !== 'zh' || !pinyinRaw) {
      return { candidates: [] as string[], pinyinDisplay: '' };
    }
    const result = getZhCandidates(pinyinRaw, 20);
    return { candidates: result.candidates, pinyinDisplay: result.display };
  }, [pinyinRaw, mode]);

  useEffect(() => {
    return KeyboardService.subscribe(s => {
      setVisible(s.visible);
      setMode(s.mode);
    });
  }, []);

  // show()/hide() already set height atomically — no separate setHeight needed

  useEffect(() => {
    if (!visible) {
      setPinyinRaw('');
      setPage('alpha');
    }
  }, [visible]);

  useEffect(() => {
    if (mode === 'en') {
      setPinyinRaw('');
    }
  }, [mode]);

  // 记录当前聚焦的输入元素
  const focusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as any;
      if (!isEditableElement(t)) return;
      focusedElementRef.current = t;
      KeyboardService.show();
      safeScrollIntoView(t);
    };
    
    const onFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement as any;
        if (!isEditableElement(active)) {
          // 检查原始焦点元素是否在 data-keep-keyboard 容器内
          const target = e.target as HTMLElement;
          if (target?.closest?.('[data-keep-keyboard]')) {
            // 在 keep-keyboard 容器内，不自动关闭键盘
            return;
          }
          focusedElementRef.current = null;
          KeyboardService.hide();
        }
      }, 100);
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, []);

  // 系统级：监听 DOM 变化，如果聚焦的输入元素被移除（如路由切换），自动关闭键盘
  useEffect(() => {
    if (!visible) return;

    const focused = focusedElementRef.current;
    if (!focused) return;

    const observeRoot = focused.closest('[data-adjust-resize]') ?? document.body;

    const observer = new MutationObserver(() => {
      if (focused && !document.body.contains(focused)) {
        focusedElementRef.current = null;
        KeyboardService.hide();
      }
    });

    observer.observe(observeRoot, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [visible]);

  // If an input is already focused, tapping it again may not fire focusin.
  // Use click-capture to show keyboard WITHOUT interfering with pointer/touch sequences.
  // This avoids (1) blur + immediate hide and (2) click-through onto keyboard keys.
  useEffect(() => {
    const onDocClickCapture = (e: MouseEvent) => {
      const t = e.target as any;
      if (!isEditableElement(t)) return;
      
      // 如果键盘已显示，仍然执行滚动检查（用户可能滚动了页面）
      if (KeyboardService.isVisible()) {
        safeScrollIntoView(t);
        return;
      }
      
      // Arm a short ignore window for synthetic mouse pointer events (touch emulation).
      try {
        const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
        const hasTouch = (navigator as any).maxTouchPoints > 0;
        const touchLike = coarse || hasTouch || 'ontouchstart' in window;
        if (touchLike) {
          _ignoreMouseUntil.current = realNow() + 200;
        }
      } catch {
        // ignore
      }
      KeyboardService.show();
      safeScrollIntoView(t);
    };
    document.addEventListener('click', onDocClickCapture, true);
    return () => document.removeEventListener('click', onDocClickCapture, true);
  }, []);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      if (!KeyboardService.isVisible()) return;
      const t = e.target as HTMLElement;
      if (rootRef.current && t && rootRef.current.contains(t)) return;
      if (isEditableElement(t)) return;
      // Allow apps to mark UI (e.g., chat input bar) as "keyboard accessory" that should not dismiss the keyboard.
      if ((t as HTMLElement).closest?.('[data-keep-keyboard]')) return;
      if ((t as HTMLElement).closest?.('[data-gesture-bar]')) return;
      KeyboardService.hide();
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, []);

  const commitCandidate = useCallback((text: string) => {
    insertText(text);
    setPinyinRaw('');
  }, []);

  const handleSegKey = useCallback(() => {
    if (mode !== 'zh') return;
    setPinyinRaw(prev => {
      if (!prev) return prev;
      if (prev.endsWith("'")) return prev.slice(0, -1);
      return `${prev}'`;
    });
  }, [mode]);

  const handleLetter = useCallback((ch: string) => {
    if (mode === 'zh') {
      setPinyinRaw(prev => (prev + ch.toLowerCase()).slice(0, 32));
      return;
    }
    insertText(ch.toLowerCase());
  }, [mode]);

  const handleSymbol = useCallback((sym: string) => {
    insertText(sym);
  }, []);

  const handleSpace = useCallback(() => {
    if (mode === 'zh' && pinyinRaw) {
      const best = candidates[0];
      if (best) {
        commitCandidate(best);
      } else {
        insertText(' ');
        setPinyinRaw('');
      }
      return;
    }
    insertText(' ');
  }, [mode, pinyinRaw, candidates, commitCandidate]);

  const handleBackspace = useCallback(() => {
    if (mode === 'zh' && pinyinRaw) {
      setPinyinRaw(prev => prev.slice(0, -1));
      return;
    }
    deleteBackward();
  }, [mode, pinyinRaw]);

  const handleEnter = useCallback(() => {
    const el = getActiveEditable();
    if (mode === 'zh' && pinyinRaw) {
      insertText(pinyinRaw);
      setPinyinRaw('');
      return;
    }
    if (el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable)) {
      insertText('\n');
      return;
    }
    // For regular input elements, dispatch Enter key events to trigger form submission/search
    if (el) {
      const eventInit: KeyboardEventInit = {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      };
      const keydownEvent = new KeyboardEvent('keydown', eventInit);
      const keypressEvent = new KeyboardEvent('keypress', eventInit);
      const keyupEvent = new KeyboardEvent('keyup', eventInit);
      
      el.dispatchEvent(keydownEvent);
      el.dispatchEvent(keypressEvent);
      el.dispatchEvent(keyupEvent);
    }
    KeyboardService.hide();
  }, [mode, pinyinRaw]);

  const zIndex = zIndexKeyboard;

  if (!visible) return null;

  // Show candidate bar whenever there's pinyin input (even if no candidates yet)
  const showCandidates = mode === 'zh' && pinyinRaw;
  const isEnglish = mode === 'en';

  return (
    <div
      ref={rootRef}
      data-keyboard="true"
      className="fixed left-0 right-0 select-none"
      style={{ zIndex, bottom: 0, height: keyboardHeight, overflow: 'hidden', background: '#d1d4db' }}
    >
      {/* Top toolbar / Candidate bar */}
      <div className="h-12 bg-[#d1d4db] flex items-center">
        {showCandidates ? (
          <>
            {/* Pinyin display */}
            <div className="px-3 text-[15px] text-blue-500 shrink-0">
              {pinyinDisplay || pinyinRaw}
            </div>
            {/* Candidates */}
            <div 
              className="flex-1 h-full overflow-x-auto flex items-center no-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onPointerDown={(e) => e.preventDefault()}
            >
              {candidates.map((c, idx) => (
                <CandidateItem key={`${idx}-${c}`} text={c} onSelect={commitCandidate} />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Toolbar icons when no candidates - spread evenly */}
            <ToolbarIcon>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M3 10h18M9 4v18" />
              </svg>
            </ToolbarIcon>
            <ToolbarIcon>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h2M10 10h4M16 10h2M5 14h3M9 14h6M16 14h3" />
              </svg>
            </ToolbarIcon>
            <ToolbarIcon>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18M3 9h6M3 15h6" />
              </svg>
            </ToolbarIcon>
            <ToolbarIcon>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3M8 22h8" />
              </svg>
            </ToolbarIcon>
            <ToolbarIcon>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
              </svg>
            </ToolbarIcon>
            <ToolbarIcon onTap={() => KeyboardService.hide()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </ToolbarIcon>
          </>
        )}
      </div>

      {/* Keyboard body */}
      <div className="flex flex-col gap-[6px] p-[3px]" onPointerDown={(e) => e.preventDefault()}>
        {page === 'alpha' ? (
          <>
            {/* Row 1 */}
            <div className="flex gap-[5px]">
              {KEY_ROW_1.map(k => (
                <LetterKey key={k.main} main={k.main} sub={k.sub} lowercase={isEnglish} onTap={() => handleLetter(k.main)} />
              ))}
            </div>
            {/* Row 2 */}
            <div className="flex gap-[5px] px-[14px]">
              {KEY_ROW_2.map(k => (
                <LetterKey key={k.main} main={k.main} sub={k.sub} lowercase={isEnglish} onTap={() => handleLetter(k.main)} />
              ))}
            </div>
            {/* Row 3 */}
            <div className="flex gap-[5px]">
              <Key flex={1.2} dark onTap={handleSegKey}>
                {isEnglish ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4L4 12h5v7h6v-7h5L12 4z" />
                  </svg>
                ) : (
                  <span className="text-[14px] text-black">分词</span>
                )}
              </Key>
              {KEY_ROW_3.map(k => (
                <LetterKey key={k.main} main={k.main} sub={k.sub} lowercase={isEnglish} onTap={() => handleLetter(k.main)} />
              ))}
              <Key flex={1.2} dark onTap={handleBackspace}>
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 1h13a1 1 0 011 1v12a1 1 0 01-1 1H7l-6-7 6-7z" />
                  <path d="M10 5l5 5M15 5l-5 5" strokeLinecap="round" />
                </svg>
              </Key>
            </div>
            {/* Row 4 */}
            <div className="flex gap-[5px]">
              <Key flex={1} dark onTap={() => setPage('sym')}>
                <span className="text-[15px] text-black">符</span>
              </Key>
              <Key flex={1.2} dark onTap={() => setPage('num')}>
                <span className="text-[15px] text-black">123</span>
              </Key>
              <Key flex={0.9} onTap={() => handleSymbol(isEnglish ? ',' : '，')}>
                <div className="relative w-full h-full flex items-center justify-center">
                  <span className="text-[20px] text-black">{isEnglish ? ',' : '，'}</span>
                  {isEnglish && <span className="absolute top-[2px] right-[6px] text-[10px] text-blue-500">📋</span>}
                </div>
              </Key>
              <Key flex={3} onTap={handleSpace}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3" />
                </svg>
              </Key>
              <Key flex={0.9} onTap={() => handleSymbol(isEnglish ? '.' : '。')}>
                <span className="text-[20px] text-black">{isEnglish ? '.' : '。'}</span>
              </Key>
              <Key flex={1.2} dark onTap={() => { KeyboardService.toggleMode(); setPinyinRaw(''); }}>
                <span className="text-[13px] leading-tight text-center">
                  <span className={isEnglish ? 'text-gray-400' : 'text-black font-medium'}>中</span>
                  <br/>
                  <span className={isEnglish ? 'text-black font-medium' : 'text-gray-400'}>英</span>
                </span>
              </Key>
              <Key flex={1.2} dark onTap={handleEnter}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 17l-5-5 5-5M4 12h16v-5" />
                </svg>
              </Key>
            </div>
          </>
        ) : page === 'num' ? (
          <>
            {/* Number Row 1 */}
            <div className="flex gap-[5px]">
              {NUM_ROW_1.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[20px] text-black">{k}</span>
                </Key>
              ))}
            </div>
            {/* Number Row 2 */}
            <div className="flex gap-[5px] px-[14px]">
              {NUM_ROW_2.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[20px] text-black">{k}</span>
                </Key>
              ))}
            </div>
            {/* Number Row 3 */}
            <div className="flex gap-[5px]">
              <Key flex={1.2} dark onTap={() => setPage('sym')}>
                <span className="text-[14px] text-black">#+=</span>
              </Key>
              {NUM_ROW_3.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[18px] text-black">{k}</span>
                </Key>
              ))}
              <Key flex={1.2} dark onTap={handleBackspace}>
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 1h13a1 1 0 011 1v12a1 1 0 01-1 1H7l-6-7 6-7z" />
                  <path d="M10 5l5 5M15 5l-5 5" strokeLinecap="round" />
                </svg>
              </Key>
            </div>
            {/* Number Row 4 */}
            <div className="flex gap-[5px]">
              <Key flex={1.5} dark onTap={() => setPage('alpha')}>
                <span className="text-[15px] text-black">ABC</span>
              </Key>
              <Key flex={1} onTap={() => handleSymbol('，')}>
                <span className="text-[20px] text-black">，</span>
              </Key>
              <Key flex={3} onTap={handleSpace}>
                <span className="text-[16px] text-gray-400">空格</span>
              </Key>
              <Key flex={1} onTap={() => handleSymbol('。')}>
                <span className="text-[20px] text-black">。</span>
              </Key>
              <Key flex={1.5} dark onTap={handleEnter}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 17l-5-5 5-5M4 12h16v-5" />
                </svg>
              </Key>
            </div>
          </>
        ) : (
          <>
            {/* Symbol Row 1 */}
            <div className="flex gap-[5px]">
              {SYM_ROW_1.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[18px] text-black">{k}</span>
                </Key>
              ))}
            </div>
            {/* Symbol Row 2 */}
            <div className="flex gap-[5px] px-[14px]">
              {SYM_ROW_2.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[18px] text-black">{k}</span>
                </Key>
              ))}
            </div>
            {/* Symbol Row 3 */}
            <div className="flex gap-[5px]">
              <Key flex={1.2} dark onTap={() => setPage('num')}>
                <span className="text-[14px] text-black">123</span>
              </Key>
              {SYM_ROW_3.map(k => (
                <Key key={k} onTap={() => handleSymbol(k)}>
                  <span className="text-[18px] text-black">{k}</span>
                </Key>
              ))}
              <Key flex={1.2} dark onTap={handleBackspace}>
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 1h13a1 1 0 011 1v12a1 1 0 01-1 1H7l-6-7 6-7z" />
                  <path d="M10 5l5 5M15 5l-5 5" strokeLinecap="round" />
                </svg>
              </Key>
            </div>
            {/* Symbol Row 4 */}
            <div className="flex gap-[5px]">
              <Key flex={1.5} dark onTap={() => setPage('alpha')}>
                <span className="text-[15px] text-black">ABC</span>
              </Key>
              <Key flex={1} onTap={() => handleSymbol('，')}>
                <span className="text-[20px] text-black">，</span>
              </Key>
              <Key flex={3} onTap={handleSpace}>
                <span className="text-[16px] text-gray-400">空格</span>
              </Key>
              <Key flex={1} onTap={() => handleSymbol('。')}>
                <span className="text-[20px] text-black">。</span>
              </Key>
              <Key flex={1.5} dark onTap={handleEnter}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 17l-5-5 5-5M4 12h16v-5" />
                </svg>
              </Key>
            </div>
          </>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="h-12 flex items-center justify-between px-4">
        {/* Left: Hide keyboard button */}
        <div 
          className="w-10 h-10 flex items-center justify-center text-gray-500 active:bg-gray-300 rounded-lg"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            KeyboardService.hide();
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Right: Keyboard icon (placeholder) */}
        <div className="w-10 h-10 flex items-center justify-center text-gray-500">
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="22" height="16" rx="2" />
            <rect x="4" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="8" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="12" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="16" y="4" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="4" y="8" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="8" y="8" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="12" y="8" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="16" y="8" width="2" height="2" rx="0.5" fill="currentColor" stroke="none" />
            <rect x="6" y="12" width="10" height="2" rx="0.5" fill="currentColor" stroke="none" />
          </svg>
        </div>
      </div>
    </div>
  );
};
