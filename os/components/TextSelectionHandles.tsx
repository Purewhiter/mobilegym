/**
 * TextSelectionHandles
 *
 * Android-like selection handles for DOM selections (non-input).
 * - Shows two draggable handles when there is an active DOM selection.
 * - Dragging a handle adjusts the selection boundary using caretPositionFromPoint/caretRangeFromPoint.
 *
 * Notes:
 * - This intentionally does NOT try to handle <input>/<textarea> selection handles
 *   (browsers handle those natively; in desktop they usually don't show).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TextSelectionService } from '../TextSelectionService';
import { SIMULATOR_CONFIG } from '../data';
const { zIndexKeyboard } = SIMULATOR_CONFIG.framework;

type Pt = { x: number; y: number };
type HandleSide = 'start' | 'end';

type Mode = 'dom' | 'input';

function getCaretPositionFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc: any = document;
  try {
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(x, y);
      if (pos && pos.offsetNode) return { node: pos.offsetNode, offset: pos.offset };
    }
  } catch {
    // ignore
  }
  try {
    if (typeof doc.caretRangeFromPoint === 'function') {
      const r: Range | null = doc.caretRangeFromPoint(x, y);
      if (r) return { node: r.startContainer, offset: r.startOffset };
    }
  } catch {
    // ignore
  }
  return null;
}

function isDomSelectionUsable(sel: Selection | null): sel is Selection {
  return !!sel && sel.rangeCount > 0 && !sel.isCollapsed;
}

function isTextInput(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement);
}

function getInputSelection(el: HTMLInputElement | HTMLTextAreaElement): { start: number; end: number } | null {
  const start = typeof el.selectionStart === 'number' ? el.selectionStart : null;
  const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : null;
  if (start === null || end === null) return null;
  if (start === end) return null;
  return { start, end };
}

function makeCollapsedRange(node: Node, offset: number): Range | null {
  try {
    const r = document.createRange();
    r.setStart(node, Math.max(0, offset));
    r.collapse(true);
    return r;
  } catch {
    return null;
  }
}

function rectFromRangeBoundary(range: Range, side: HandleSide): DOMRect | null {
  try {
    const container = side === 'start' ? range.startContainer : range.endContainer;
    const offset = side === 'start' ? range.startOffset : range.endOffset;

    // Best effort for text node: pick a nearby character box.
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container as Text;
      const len = text.data.length;
      if (len === 0) return null;

      const idx = side === 'start'
        ? Math.min(len - 1, Math.max(0, offset))
        : Math.min(len - 1, Math.max(0, offset - 1));

      const r = document.createRange();
      r.setStart(text, idx);
      r.setEnd(text, Math.min(len, idx + 1));
      const rects = r.getClientRects();
      if (rects && rects.length > 0) return rects[0] as DOMRect;
      const br = r.getBoundingClientRect();
      if (br && br.width + br.height > 0) return br;
    }

    // Fallback: try a collapsed rect near the boundary.
    const collapsed = makeCollapsedRange(container, offset);
    if (collapsed) {
      const rects = collapsed.getClientRects();
      if (rects && rects.length > 0) return rects[0] as DOMRect;
      const br = collapsed.getBoundingClientRect();
      if (br && br.width + br.height > 0) return br;
    }

    // Last resort: bounding rect of the whole selection
    const br = range.getBoundingClientRect();
    if (br && br.width + br.height > 0) return br;
  } catch {
    // ignore
  }
  return null;
}

function clampToViewport(p: Pt): Pt {
  const pad = 6;
  return {
    x: Math.max(pad, Math.min(window.innerWidth - pad, p.x)),
    y: Math.max(pad, Math.min(window.innerHeight - pad, p.y)),
  };
}

function selectionTextForClipboard(): string {
  const sel = window.getSelection();
  if (!sel) return '';
  return (sel.toString() || '').trim();
}

function isOptInContainer(el: Element | null): boolean {
  if (!el) return false;
  return !!el.closest?.('[data-os-clipboard="true"]');
}

function isOptInDomSelection(sel: Selection): boolean {
  if (!sel.rangeCount) return false;
  try {
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const commonEl = common instanceof Element ? common : common.parentElement;
    return isOptInContainer(commonEl);
  } catch {
    return false;
  }
}

function anchorForDomSelection(): { x: number; y: number; target: HTMLElement | null; text: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  // Default OFF: only show system handles/menu for non-editable text inside opt-in container.
  if (!isOptInDomSelection(sel)) return null;
  const text = (sel.toString() || '').trim();
  if (!text) return null;
  try {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top - 12;
    const common = range.commonAncestorContainer;
    const commonEl = (common instanceof Element ? common : common.parentElement) as HTMLElement | null;
    return { x, y, target: commonEl, text };
  } catch {
    return null;
  }
}

function anchorForInputSelection(el: HTMLInputElement | HTMLTextAreaElement): { x: number; y: number; target: HTMLElement; text: string } | null {
  const sel = getInputSelection(el);
  if (!sel) return null;
  const text = String(el.value ?? '').slice(sel.start, sel.end).trim();
  if (!text) return null;
  const pt = caretPointForInput(el, sel.end);
  if (!pt) return null;
  return { x: pt.x, y: pt.y - 18, target: el, text };
}

function maybeShowMenuFromSelection(): void {
  if (!TextSelectionService.canAutoShowMenu()) return;
  // Prefer input/textarea selection when focused.
  const active = document.activeElement;
  if (isTextInput(active)) {
    const a = anchorForInputSelection(active);
    if (a) {
      TextSelectionService.showSelectionMenu(a.x, a.y, a.text, a.target);
      return;
    }
  }

  const a = anchorForDomSelection();
  if (a) {
    TextSelectionService.showSelectionMenu(a.x, a.y, a.text, a.target ?? undefined);
  }
}

let __mirrorEl: HTMLDivElement | null = null;

function ensureMirrorEl(): HTMLDivElement {
  if (__mirrorEl) return __mirrorEl;
  const d = document.createElement('div');
  d.setAttribute('data-no-clipboard', 'true');
  d.style.position = 'fixed';
  d.style.top = '0';
  d.style.left = '-9999px';
  d.style.visibility = 'hidden';
  d.style.whiteSpace = 'pre-wrap';
  d.style.wordWrap = 'break-word';
  d.style.overflow = 'hidden';
  d.style.pointerEvents = 'none';
  document.body.appendChild(d);
  __mirrorEl = d;
  return d;
}

function copyInputStyles(src: HTMLInputElement | HTMLTextAreaElement, mirror: HTMLDivElement) {
  const style = window.getComputedStyle(src);
  // Key properties for caret positioning
  const props = [
    'boxSizing',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'letterSpacing',
    'lineHeight',
    'textTransform',
    'textIndent',
    'textRendering',
    'direction',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'tabSize',
    'MozTabSize',
  ] as const;
  for (const p of props) {
    try {
      (mirror.style as any)[p] = (style as any)[p];
    } catch {
      // ignore
    }
  }
  mirror.style.whiteSpace = src instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.wordWrap = src instanceof HTMLTextAreaElement ? 'break-word' : 'normal';
  mirror.style.width = `${src.clientWidth}px`;
}

function getLineHeightPx(el: HTMLInputElement | HTMLTextAreaElement): number {
  const lh = parseFloat(window.getComputedStyle(el).lineHeight || '');
  if (Number.isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(window.getComputedStyle(el).fontSize || '');
  return Number.isFinite(fs) && fs > 0 ? fs * 1.2 : 18;
}

function caretPointForInput(el: HTMLInputElement | HTMLTextAreaElement, index: number): Pt | null {
  const value = String(el.value ?? '');
  const i = Math.max(0, Math.min(value.length, Math.floor(index)));
  const mirror = ensureMirrorEl();
  copyInputStyles(el, mirror);

  // Build mirror content
  mirror.textContent = value.slice(0, i);
  const marker = document.createElement('span');
  // zero-width marker still gets a rect; use a visible fallback if needed
  marker.textContent = '\u200b';
  mirror.appendChild(marker);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();

  // Clean up marker (keep mirror node for reuse)
  marker.remove();

  const xInside = markerRect.left - mirrorRect.left;
  const yInside = markerRect.top - mirrorRect.top;

  const rect = el.getBoundingClientRect();
  const x = rect.left + xInside - (el.scrollLeft || 0);
  const yTop = rect.top + yInside - (el.scrollTop || 0);
  const y = yTop + getLineHeightPx(el);
  return clampToViewport({ x, y });
}

function indexAtPointForInput(el: HTMLInputElement | HTMLTextAreaElement, x: number, y: number): number {
  const value = String(el.value ?? '');
  const n = value.length;
  if (n === 0) return 0;

  const targetX = x;
  const targetY = y;
  const lineH = getLineHeightPx(el);

  // 1) Find the first index whose caretY >= targetY (monotonic-ish)
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const pt = caretPointForInput(el, mid);
    if (!pt) return mid;
    if (pt.y < targetY) lo = mid + 1;
    else hi = mid;
  }

  // 2) Search a small window around lo for best (x,y) match on nearby lines
  let best = lo;
  let bestScore = Number.POSITIVE_INFINITY;
  const start = Math.max(0, lo - 120);
  const end = Math.min(n, lo + 120);
  for (let i = start; i <= end; i += 1) {
    const pt = caretPointForInput(el, i);
    if (!pt) continue;
    const dy = Math.abs(pt.y - targetY);
    if (dy > lineH * 1.6) continue;
    const dx = pt.x - targetX;
    const score = dy * dy + dx * dx;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return Math.max(0, Math.min(n, best));
}

export const TextSelectionHandles: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [startPt, setStartPt] = useState<Pt | null>(null);
  const [endPt, setEndPt] = useState<Pt | null>(null);
  const [mode, setMode] = useState<Mode>('dom');
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const draggingRef = useRef<HandleSide | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleStyle = useMemo(() => {
    const size = 16;
    const stemH = 14;
    const stemW = 2;
    return { size, stemH, stemW };
  }, []);

  const updateFromSelection = () => {
    // Prefer input/textarea selection if present (e.g., Notes editor).
    const active = document.activeElement;
    if (isTextInput(active)) {
      const sel = getInputSelection(active);
      if (sel) {
        const s = caretPointForInput(active, sel.start);
        const e = caretPointForInput(active, sel.end);
        if (s && e) {
          activeInputRef.current = active;
          setMode('input');
          setVisible(true);
          setStartPt(s);
          setEndPt(e);
          // Keep clipboard menu selectedText in sync with current selection (when menu is visible).
          TextSelectionService.updateSelectedText(String(active.value ?? '').slice(sel.start, sel.end));
          return;
        }
      }
    }
    activeInputRef.current = null;

    const sel = window.getSelection();
    if (!isDomSelectionUsable(sel)) {
      setVisible(false);
      setStartPt(null);
      setEndPt(null);
      setMode('dom');
      TextSelectionService.updateSelectedText('');
      return;
    }
    // Default OFF for non-editable areas: only show handles for opted-in containers.
    if (!isOptInDomSelection(sel)) {
      setVisible(false);
      setStartPt(null);
      setEndPt(null);
      setMode('dom');
      return;
    }

    const range = sel.getRangeAt(0);
    const startRect = rectFromRangeBoundary(range, 'start');
    const endRect = rectFromRangeBoundary(range, 'end');
    if (!startRect || !endRect) {
      setVisible(false);
      return;
    }

    // Place handles at the bottom of boundary rects.
    const s = clampToViewport({ x: startRect.left, y: startRect.bottom });
    const e = clampToViewport({ x: endRect.right, y: endRect.bottom });
    setVisible(true);
    setStartPt(s);
    setEndPt(e);
    setMode('dom');

    // Keep clipboard menu selectedText in sync with current selection.
    TextSelectionService.updateSelectedText(selectionTextForClipboard());
  };

  useEffect(() => {
    // Update on menu visibility changes and on selection changes.
    // We don't strictly depend on menu visibility so that selection handles can appear
    // when the user selects text inside a textarea by dragging.
    const unsub = TextSelectionService.subscribe(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateFromSelection);
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      unsub();
    };

  }, []);

  useEffect(() => {
    // Always listen to selection changes; we'll decide visibility inside updateFromSelection.
    const onSelChange = () => {
      if (draggingRef.current) return; // dragging handles will drive updates
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateFromSelection);
    };
    document.addEventListener('selectionchange', onSelChange);
    return () => document.removeEventListener('selectionchange', onSelChange);

  }, []);

  useEffect(() => {
    // Show the menu after the user finishes selecting text.
    // This matches Android-like behavior: selection action bar appears on release.
    const onUp = () => {
      if (draggingRef.current) return;
      requestAnimationFrame(() => {
        maybeShowMenuFromSelection();
      });
    };

    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseup', onUp, { passive: true });
    document.addEventListener('touchend', onUp, { passive: true });
    return () => {
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };
  }, []);

  const applyDrag = (side: HandleSide, x: number, y: number) => {
    if (mode === 'input' && activeInputRef.current) {
      const el = activeInputRef.current;
      const cur = getInputSelection(el);
      if (!cur) return;

      const idx = indexAtPointForInput(el, x, y);
      let start = cur.start;
      let end = cur.end;
      if (side === 'start') start = idx;
      else end = idx;

      // Keep normalized order; if crossed, swap.
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
        draggingRef.current = side === 'start' ? 'end' : 'start';
      }

      try {
        el.focus();
        el.setSelectionRange(start, end);
        TextSelectionService.updateSelectedText(String(el.value ?? '').slice(start, end));
      } catch {
        // ignore
      }
      return;
    }

    const sel = window.getSelection();
    if (!isDomSelectionUsable(sel)) return;
    const base = sel.getRangeAt(0);

    const pos = getCaretPositionFromPoint(x, y);
    if (!pos) return;

    const next = base.cloneRange();
    try {
      if (side === 'start') next.setStart(pos.node, pos.offset);
      else next.setEnd(pos.node, pos.offset);
    } catch {
      return;
    }

    // If boundaries cross, swap (Android-like handle swap).
    try {
      const test = next.cloneRange();
      test.collapse(true);
      // compare start/end by constructing collapsed ranges
      const s = makeCollapsedRange(next.startContainer, next.startOffset);
      const e = makeCollapsedRange(next.endContainer, next.endOffset);
      if (s && e) {
        const cmp = s.compareBoundaryPoints(Range.START_TO_START, e);
        if (cmp > 0) {
          const swapped = base.cloneRange();
          // swap to keep start <= end
          swapped.setStart(pos.node, pos.offset);
          swapped.setEnd(base.startContainer, base.startOffset);
          sel.removeAllRanges();
          sel.addRange(swapped);
          return;
        }
      }
    } catch {
      // ignore
    }

    sel.removeAllRanges();
    sel.addRange(next);
  };

  const attachDragListeners = (side: HandleSide, pointerId: number) => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      applyDrag(side, e.clientX, e.clientY);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateFromSelection);
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      draggingRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateFromSelection();
        maybeShowMenuFromSelection();
      });
      e.preventDefault();
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onUp, { passive: false });
  };

  if (!visible || !startPt || !endPt) return null;

  // Ensure handles are above most system overlays (and above the menu if they overlap).
  const z = zIndexKeyboard + 110;
  const common = {
    position: 'fixed' as const,
    zIndex: z,
    touchAction: 'none' as const,
  };

  const Handle = ({ side, pt }: { side: HandleSide; pt: Pt }) => (
    <div
      data-no-clipboard="true"
      data-keep-keyboard
      style={{
        ...common,
        left: pt.x,
        top: pt.y,
        transform: 'translate(-50%, 0)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Stem - vertical line connecting selection to circle */}
      <div
        style={{
          width: handleStyle.stemW,
          height: handleStyle.stemH,
          background: '#3b82f6',
        }}
      />
      {/* Draggable circle */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          draggingRef.current = side;
          try {
            (e.currentTarget as any).setPointerCapture?.(e.pointerId);
          } catch {
            // ignore
          }
          attachDragListeners(side, e.pointerId);
        }}
        style={{
          width: handleStyle.size,
          height: handleStyle.size,
          borderRadius: 999,
          background: '#3b82f6',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }}
      />
    </div>
  );

  return (
    <>
      <Handle side="start" pt={startPt} />
      <Handle side="end" pt={endPt} />
    </>
  );
};

export default TextSelectionHandles;

