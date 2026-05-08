/**
 * Global Long Press Detection Hook
 * 
 * System-level hook that detects long press on text elements and input fields,
 * and automatically shows the clipboard selection menu.
 */

import { useEffect, useRef } from 'react';
import { ClipboardService } from '../ClipboardService';
import { TextSelectionService } from '../TextSelectionService';

const LONG_PRESS_DURATION = 500; // ms
const MOVE_THRESHOLD = 10; // px

/**
 * Check if element is an editable input
 */
function isEditableInput(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    return !element.disabled && !element.readOnly && 
           ['text', 'search', 'email', 'password', 'tel', 'url', 'number'].includes(type);
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  return element.isContentEditable === true;
}

function hasNonEmptyText(element: HTMLElement): boolean {
  const text = element.innerText || element.textContent || '';
  return text.trim().length > 0;
}

/**
 * Find the nearest editable target (input/textarea/contenteditable root).
 */
function findEditableTarget(start: HTMLElement): HTMLElement | null {
  // Use closest() so long-pressing on inner spans/icons still finds the input wrapper.
  const candidate = start.closest('input,textarea,[contenteditable],[contenteditable="true"],[contenteditable="plaintext-only"]');
  if (!(candidate instanceof HTMLElement)) return null;
  return isEditableInput(candidate) ? candidate : null;
}

function findTextTarget(start: HTMLElement): HTMLElement | null {
  // For non-editable text selection, use a reasonably small container.
  // Prefer the nearest element that actually carries text.
  let cur: HTMLElement | null = start;
  for (let i = 0; i < 6 && cur; i++) {
    if (!isEditableInput(cur) && hasNonEmptyText(cur)) return cur;
    cur = cur.parentElement;
  }
  return !isEditableInput(start) && hasNonEmptyText(start) ? start : null;
}

function getOptInClipboardContainer(start: HTMLElement): HTMLElement | null {
  const el = start.closest('[data-os-clipboard="true"]');
  return el instanceof HTMLElement ? el : null;
}

function caretPosFromPoint(x: number, y: number): { node: Node; offset: number } | null {
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

function selectWordAtPoint(x: number, y: number, scopeEl: HTMLElement): string {
  const pos = caretPosFromPoint(x, y);
  if (!pos) return '';
  const { node, offset } = pos;

  // Only support selecting within the scope element
  const el = node instanceof Element ? node : node.parentElement;
  if (!el || !scopeEl.contains(el)) return '';

  const sel = window.getSelection();
  if (!sel) return '';

  // Best-effort word selection within a text node.
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const s = textNode.data || '';
    if (!s.trim()) return '';
    let i = Math.max(0, Math.min(s.length, offset));

    // If caret is on whitespace, walk to nearest non-whitespace to the left.
    while (i > 0 && /\s/.test(s[i - 1] || '')) i--;
    while (i < s.length && /\s/.test(s[i] || '')) i++;
    if (i >= s.length) return '';

    let l = i;
    let r = i;
    while (l > 0 && !/\s/.test(s[l - 1])) l--;
    while (r < s.length && !/\s/.test(s[r])) r++;

    try {
      const range = document.createRange();
      range.setStart(textNode, l);
      range.setEnd(textNode, r);
      sel.removeAllRanges();
      sel.addRange(range);
      return (sel.toString() || '').trim();
    } catch {
      return '';
    }
  }

  // Fallback: select the scope element's contents (less ideal, but avoids "no selection")
  try {
    const range = document.createRange();
    range.selectNodeContents(scopeEl);
    sel.removeAllRanges();
    sel.addRange(range);
    const t = (sel.toString() || '').trim();
    // Don't select huge text blocks by accident
    return t.length <= 200 ? t : t.slice(0, 200);
  } catch {
    return '';
  }
}

/**
 * Get selected text for copy/cut.
 * IMPORTANT: If there is no selection, return '' (Android-like; long press shows paste/select-all, not copy whole value).
 */
function getSelectedText(editableTarget: HTMLElement): string {
  if (editableTarget instanceof HTMLInputElement || editableTarget instanceof HTMLTextAreaElement) {
    const start = editableTarget.selectionStart ?? 0;
    const end = editableTarget.selectionEnd ?? 0;
    if (start !== end) return editableTarget.value.substring(start, end);
    return '';
  }

  // contenteditable: only use actual selection when it is inside the editable target.
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const text = sel.toString().trim();
  if (!text) return '';
  try {
    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer;
    const commonEl = common instanceof Element ? common : common.parentElement;
    if (commonEl && editableTarget.contains(commonEl)) return text;
  } catch {
    // ignore
  }
  return '';
}

function isSeparator(ch: string): boolean {
  // Rough separators for both EN and common CN punctuation.
  return /\s/.test(ch) || /[.,!?;:(){}[\]"'`~@#$%^&*\-+=|\\/<>\u3002\uFF0C\uFF1F\uFF01\uFF1B\uFF1A\u3001\u201C\u201D\u2018\u2019]/.test(ch);
}

function getLineBounds(s: string, caret: number): { start: number; end: number } {
  const n = s.length;
  const c = Math.max(0, Math.min(n, Math.floor(caret)));
  const prevNL = s.lastIndexOf('\n', Math.max(0, c - 1));
  const start = prevNL === -1 ? 0 : prevNL + 1;
  const nextNL = s.indexOf('\n', c);
  const end = nextNL === -1 ? n : nextNL;
  return { start, end };
}

function expandWordBoundariesInLine(value: string, caret: number): { start: number; end: number } {
  const s = String(value ?? '');
  const n = s.length;
  if (n === 0) return { start: 0, end: 0 };

  const line = getLineBounds(s, caret);
  const lineText = s.slice(line.start, line.end);
  // If the current line is blank (or only spaces), do NOT jump to other lines.
  if (!lineText.trim()) return { start: caret, end: caret };

  let i = Math.max(line.start, Math.min(line.end, Math.floor(caret)));

  // If caret is on blank/separator (space, punctuation), do NOT select any word —
  // user likely wants to paste or place cursor; selecting the previous word is confusing.
  if (i >= line.start && i < line.end && isSeparator(s[i])) {
    return { start: caret, end: caret };
  }
  if (i === line.end && i > line.start) {
    // End of line: treat as "blank", no selection
    return { start: caret, end: caret };
  }

  if (i < line.start || i >= line.end || isSeparator(s[i])) return { start: caret, end: caret };

  let l = i;
  let r = i + 1;
  while (l > line.start && !isSeparator(s[l - 1])) l--;
  while (r < line.end && !isSeparator(s[r])) r++;
  return { start: l, end: r };
}

function selectWordInInput(el: HTMLInputElement | HTMLTextAreaElement): string {
  try {
    const value = String(el.value ?? '');
    const caret = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const { start, end } = expandWordBoundariesInLine(value, caret);
    if (start !== end) {
      el.setSelectionRange(start, end);
      return value.slice(start, end).trim();
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * Check if element should be excluded from long press handling
 */
function shouldExclude(element: HTMLElement): boolean {
  // Exclude elements with data-no-clipboard attribute
  if (element.closest('[data-no-clipboard]')) {
    return true;
  }
  
  // Exclude keyboard
  if (element.closest('[data-keyboard]')) {
    return true;
  }
  
  // Exclude buttons and interactive elements (unless they're inputs)
  const tagName = element.tagName.toLowerCase();
  if (['button', 'a', 'select', 'option'].includes(tagName)) {
    return true;
  }
  
  // Exclude elements with click handlers that might conflict (buttons, icons, etc.)
  if (element.closest('button, [role="button"]')) {
    return true;
  }
  
  return false;
}

/**
 * Hook to enable global long press detection for clipboard menu
 */
export function useGlobalLongPress(): void {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isActiveRef.current = false;
    };

    const handleStart = (clientX: number, clientY: number, target: HTMLElement) => {
      clearTimer();
      
      console.log('[LongPress] Start on:', target.tagName, target.className);
      
      // Skip if menu is already visible
      if (TextSelectionService.isMenuVisible()) {
        console.log('[LongPress] Skipped: menu already visible');
        return;
      }

      const editableTarget = findEditableTarget(target);
      const optInContainer = editableTarget ? null : getOptInClipboardContainer(target);
      const textTarget = editableTarget ? null : (optInContainer ? findTextTarget(target) : null);
      
      // Skip excluded elements
      if (shouldExclude(target)) {
        console.log('[LongPress] Skipped: excluded element');
        return;
      }

      if (!editableTarget && !textTarget) {
        console.log('[LongPress] Skipped: no editable/text target');
        return;
      }
      
      console.log('[LongPress] Timer started, waiting 500ms...');
      startPosRef.current = { x: clientX, y: clientY };
      // For non-editable text, default is OFF; only allow when explicitly opted-in via data-os-clipboard="true".
      targetRef.current = editableTarget || optInContainer || textTarget;
      isActiveRef.current = true;

      timerRef.current = setTimeout(() => {
        console.log('[LongPress] Timer fired! isActive:', isActiveRef.current);
        if (!isActiveRef.current || !targetRef.current) return;

        const isEditable = isEditableInput(targetRef.current);
        const isOptInText = !isEditable && !!optInContainer;
        let selectedText = '';

        if (isEditable) {
          // IMPORTANT: For inputs/textarea, long press should create a selection (Android-like),
          // so handles appear immediately on release.
          const t = targetRef.current;
          try {
            t.focus();
          } catch {
            // ignore
          }

          selectedText = getSelectedText(t);
          if (!selectedText) {
            if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
              selectedText = selectWordInInput(t);
            } else {
              // contenteditable: try to select a word at the press point
              selectedText = selectWordAtPoint(clientX, clientY, t);
            }
          }
        } else {
          if (isOptInText) {
            const scope = optInContainer ?? targetRef.current;
            selectedText = selectWordAtPoint(clientX, clientY, scope);
          } else {
            selectedText = '';
          }
        }
        const hasClipboardContent = ClipboardService.hasText();
        
        console.log('[LongPress] selectedText:', selectedText?.slice(0, 20), 'hasClipboard:', hasClipboardContent);
        
        // Editable: always show (Select All is always valid; Paste depends on clipboard content).
        // Non-editable text: only show if we successfully created a selection.
        if (isEditable || selectedText) {
          console.log('[LongPress] Showing menu at', clientX, clientY);
          TextSelectionService.showSelectionMenu(
            clientX,
            clientY,
            selectedText,
            // For opted-in text selection, anchor target should be the opt-in container.
            (isOptInText ? optInContainer ?? targetRef.current : targetRef.current)
          );
        } else {
          console.log('[LongPress] No text and no clipboard content');
        }
        
        clearTimer();
      }, LONG_PRESS_DURATION);
    };

    const handleMove = (clientX: number, clientY: number) => {
      if (!isActiveRef.current || !startPosRef.current) return;
      
      const distance = Math.sqrt(
        Math.pow(clientX - startPosRef.current.x, 2) +
        Math.pow(clientY - startPosRef.current.y, 2)
      );
      
      if (distance > MOVE_THRESHOLD) {
        clearTimer();
      }
    };

    const handleEnd = () => {
      if (isActiveRef.current) {
        console.log('[LongPress] End - timer cancelled');
      }
      clearTimer();
      startPosRef.current = null;
      targetRef.current = null;
    };

    // Touch events
    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      handleStart(touch.clientX, touch.clientY, target);
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = () => {
      handleEnd();
    };

    // Mouse events (for desktop/testing)
    const onMouseDown = (e: MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      handleStart(e.clientX, e.clientY, target);
    };

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    // Add event listeners
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
    
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      clearTimer();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
}
