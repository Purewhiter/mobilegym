import React, { useEffect, useRef, useState } from 'react';
import { Copy, ClipboardPaste, CheckSquare, Scissors } from 'lucide-react';
import { ClipboardService } from '../ClipboardService';
import { SIMULATOR_CONFIG } from '../data';
const { statusBarHeight, zIndexKeyboard } = SIMULATOR_CONFIG.framework;
import { TextSelectionService, type TextSelectionState } from '../TextSelectionService';

function isEditableElement(element: HTMLElement | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    return !element.disabled && !element.readOnly
      && ['text', 'search', 'email', 'password', 'tel', 'url', 'number'].includes(type);
  }
  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }
  return element.isContentEditable === true;
}

interface MenuPosition {
  x: number;
  y: number;
  arrowSide: 'top' | 'bottom';
}

export const TextSelectionMenu: React.FC = () => {
  const [state, setState] = useState<TextSelectionState>(TextSelectionService.getState());
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => TextSelectionService.subscribe(setState), []);

  useEffect(() => {
    if (!state.selectionMenuVisible) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        TextSelectionService.hideSelectionMenu();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [state.selectionMenuVisible]);

  if (!state.selectionMenuVisible || !state.selectionMenuPosition) return null;

  const { x, y } = state.selectionMenuPosition;
  const hasSelectedText = state.selectedText.length > 0;
  const canPaste = ClipboardService.hasText();
  const isEditable = isEditableElement(state.targetElement);

  const menuWidth = 220;
  const menuHeight = 48;
  const padding = 12;
  const arrowHeight = 8;
  const showAbove = y > menuHeight + arrowHeight + padding + statusBarHeight;

  const finalPosition: MenuPosition = {
    x: Math.max(padding + menuWidth / 2, Math.min(x, window.innerWidth - menuWidth / 2 - padding)),
    y: showAbove ? y - menuHeight - arrowHeight - 10 : y + arrowHeight + 20,
    arrowSide: showAbove ? 'bottom' : 'top',
  };

  const handleCopy = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    TextSelectionService.suppressAutoMenu();
    TextSelectionService.performCopy();
  };

  const handleCut = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    TextSelectionService.suppressAutoMenu();

    if (state.selectedText) {
      ClipboardService.copyText(state.selectedText);
    }

    if (state.targetElement && isEditable) {
      const el = state.targetElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        if (start !== end) {
          const value = el.value;
          const newValue = value.slice(0, start) + value.slice(end);
          let proto: any = Object.getPrototypeOf(el);
          while (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (desc?.set) {
              desc.set.call(el, newValue);
              break;
            }
            proto = Object.getPrototypeOf(proto);
          }
          el.setSelectionRange(start, start);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    TextSelectionService.hideSelectionMenu();
  };

  const handlePaste = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    TextSelectionService.suppressAutoMenu();
    TextSelectionService.performPaste();
  };

  const handleSelectAll = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    TextSelectionService.suppressAutoMenu();
    TextSelectionService.performSelectAll();
  };

  const showCut = hasSelectedText && isEditable;
  const showCopy = hasSelectedText;
  const showPaste = canPaste && isEditable;
  const showSelectAll = isEditable;
  const hasAnyAction = showCut || showCopy || showPaste || showSelectAll;

  if (!hasAnyAction) return null;

  return (
    <div
      ref={menuRef}
      data-no-clipboard="true"
      data-keep-keyboard
      className="fixed select-none whitespace-nowrap"
      style={{
        left: finalPosition.x,
        top: finalPosition.y,
        transform: 'translateX(-50%)',
        zIndex: zIndexKeyboard + 100,
      }}
    >
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-0 h-0 ${
          finalPosition.arrowSide === 'bottom'
            ? 'bottom-[-6px] border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-gray-800'
            : 'top-[-6px] border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-gray-800'
        }`}
      />

      <div
        className="flex items-center bg-gray-800 rounded-lg shadow-2xl overflow-hidden whitespace-nowrap"
        style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)' }}
      >
        {showCut && (
          <>
            <button
              onMouseDown={handleCut}
              onTouchStart={handleCut}
              className="flex items-center gap-1.5 px-3 py-2.5 text-white text-sm active:bg-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Scissors size={16} />
              <span className="whitespace-nowrap">剪切</span>
            </button>
            <div className="w-px h-6 bg-gray-600" />
          </>
        )}

        {showCopy && (
          <>
            <button
              onMouseDown={handleCopy}
              onTouchStart={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2.5 text-white text-sm active:bg-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Copy size={16} />
              <span className="whitespace-nowrap">复制</span>
            </button>
            {(showPaste || showSelectAll) && <div className="w-px h-6 bg-gray-600" />}
          </>
        )}

        {showPaste && (
          <>
            <button
              onMouseDown={handlePaste}
              onTouchStart={handlePaste}
              className="flex items-center gap-1.5 px-3 py-2.5 text-white text-sm active:bg-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <ClipboardPaste size={16} />
              <span className="whitespace-nowrap">粘贴</span>
            </button>
            {showSelectAll && <div className="w-px h-6 bg-gray-600" />}
          </>
        )}

        {showSelectAll && (
          <button
            onMouseDown={handleSelectAll}
            onTouchStart={handleSelectAll}
            className="flex items-center gap-1.5 px-3 py-2.5 text-white text-sm active:bg-gray-700 transition-colors whitespace-nowrap flex-shrink-0"
          >
            <CheckSquare size={16} />
            <span className="whitespace-nowrap">全选</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default TextSelectionMenu;
