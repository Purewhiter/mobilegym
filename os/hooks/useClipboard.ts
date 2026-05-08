import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardService, ClipboardItem } from '../ClipboardService';
import { TextSelectionService, type TextSelectionState } from '../TextSelectionService';

export interface UseClipboardReturn {
  clipboard: ClipboardItem | null;
  hasText: boolean;
  getText: () => string | null;
  copyText: (text: string) => void;
  copyImage: (uri: string) => void;
  clear: () => void;
  showMenu: (x: number, y: number, selectedText: string, targetElement?: HTMLElement) => void;
  hideMenu: () => void;
  isMenuVisible: boolean;
}

export function useClipboard(): UseClipboardReturn {
  const [clipboardState, setClipboardState] = useState(ClipboardService.getState());
  const [selectionState, setSelectionState] = useState<TextSelectionState>(TextSelectionService.getState());

  useEffect(() => ClipboardService.subscribe(setClipboardState), []);
  useEffect(() => TextSelectionService.subscribe(setSelectionState), []);

  const copyText = useCallback((text: string) => ClipboardService.copyText(text), []);
  const copyImage = useCallback((uri: string) => ClipboardService.copyImage(uri), []);
  const getText = useCallback(() => ClipboardService.getText(), []);
  const clear = useCallback(() => ClipboardService.clear(), []);
  const showMenu = useCallback((x: number, y: number, selectedText: string, targetElement?: HTMLElement) => {
    TextSelectionService.showSelectionMenu(x, y, selectedText, targetElement);
  }, []);
  const hideMenu = useCallback(() => TextSelectionService.hideSelectionMenu(), []);

  return {
    clipboard: clipboardState.current,
    hasText: clipboardState.current?.type === 'text' && clipboardState.current.content.length > 0,
    getText,
    copyText,
    copyImage,
    clear,
    showMenu,
    hideMenu,
    isMenuVisible: selectionState.selectionMenuVisible,
  };
}

export function useClipboardPaste(
  onPaste: (text: string) => void,
  targetRef?: React.RefObject<HTMLElement>
): void {
  useEffect(() => {
    const handlePaste = (e: CustomEvent<{ text: string; targetElement: HTMLElement }>) => {
      const { text, targetElement } = e.detail;
      if (targetRef?.current) {
        if (targetRef.current === targetElement || targetRef.current.contains(targetElement)) {
          onPaste(text);
        }
      } else {
        onPaste(text);
      }
    };

    window.addEventListener('os-clipboard-paste', handlePaste as EventListener);
    return () => {
      window.removeEventListener('os-clipboard-paste', handlePaste as EventListener);
    };
  }, [onPaste, targetRef]);
}

export function useClipboardSelectAll(
  onSelectAll: () => void,
  targetRef?: React.RefObject<HTMLElement>
): void {
  useEffect(() => {
    const handleSelectAll = (e: CustomEvent<{ targetElement: HTMLElement }>) => {
      const { targetElement } = e.detail;
      if (targetRef?.current) {
        if (targetRef.current === targetElement || targetRef.current.contains(targetElement)) {
          onSelectAll();
        }
      } else {
        onSelectAll();
      }
    };

    window.addEventListener('os-clipboard-select-all', handleSelectAll as EventListener);
    return () => {
      window.removeEventListener('os-clipboard-select-all', handleSelectAll as EventListener);
    };
  }, [onSelectAll, targetRef]);
}

export function useCopyableText(text: string, options?: { disabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (options?.disabled) return;
    posRef.current = { x: clientX, y: clientY };

    timerRef.current = setTimeout(() => {
      TextSelectionService.showSelectionMenu(clientX, clientY, text, containerRef.current || undefined);
    }, 500);
  }, [text, options?.disabled]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!posRef.current) return;
    const distance = Math.sqrt(
      Math.pow(clientX - posRef.current.x, 2) + Math.pow(clientY - posRef.current.y, 2)
    );
    if (distance > 10 && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    posRef.current = null;
  }, []);

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => handleStart(e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: handleEnd,
    onMouseDown: (e: React.MouseEvent) => handleStart(e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => handleMove(e.clientX, e.clientY),
    onMouseUp: handleEnd,
    onMouseLeave: handleEnd,
  };

  return {
    handlers,
    containerRef,
  };
}
