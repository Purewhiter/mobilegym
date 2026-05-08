import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocale } from '../../../os/locale';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { localizeEbaySortLabel } from '../utils/localize';

export type SortOptionType = 'bestMatch' | 'priceLow' | 'priceHigh' | 'endingSoon' | 'newlyListed' | 'distance';

export const SORT_OPTION_IDS: SortOptionType[] = ['bestMatch', 'priceLow', 'priceHigh', 'endingSoon', 'newlyListed', 'distance'];

/** 向下滑动超过此距离则关闭 */
const DISMISS_THRESHOLD_PX = 80;

interface SortModalProps {
  isOpen: boolean;
  sortOption: SortOptionType;
  onSelect: (option: SortOptionType) => void;
  onClose: () => void;
}

const SortModal: React.FC<SortModalProps> = ({ isOpen, sortOption, onSelect, onClose }) => {
  const locale = useLocale();
  const s = useEbayStrings();
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sortOptions = SORT_OPTION_IDS.map((id) => ({ id, label: localizeEbaySortLabel(id, locale) }));
  /** 从顶部手势区按下后才开始跟手位移，避免首帧 move 早于 isDragging 更新 */
  const dragFromHandleRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      setIsDragging(false);
      dragFromHandleRef.current = false;
    }
  }, [isOpen]);

  const endDrag = useCallback(
    (shouldDismiss: boolean) => {
      dragFromHandleRef.current = false;
      setIsDragging(false);
      if (shouldDismiss) {
        onClose();
      }
      setDragY(0);
    },
    [onClose],
  );

  const onSheetPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const header = sheetRef.current?.querySelector('[data-sort-sheet-drag-region]');
    if (!header || !header.contains(target)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFromHandleRef.current = true;
    pointerStartY.current = e.clientY;
    setIsDragging(true);
    setDragY(0);
  }, []);

  const onSheetPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragFromHandleRef.current) return;
    const delta = e.clientY - pointerStartY.current;
    setDragY(Math.max(0, delta));
  }, []);

  const onSheetPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFromHandleRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* 可能已被释放 */
      }
      const delta = Math.max(0, e.clientY - pointerStartY.current);
      endDrag(delta >= DISMISS_THRESHOLD_PX);
    },
    [endDrag],
  );

  const onSheetPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      if (!dragFromHandleRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      endDrag(false);
    },
    [endDrag],
  );

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[200] bg-black/50 flex flex-col justify-end animate-in fade-in duration-200" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sort-sheet-title"
        className="bg-app-surface rounded-t-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 max-h-[80vh] flex flex-col touch-pan-y"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerUp}
        onPointerCancel={onSheetPointerCancel}
      >
        <div
          data-sort-sheet-drag-region
          className="flex flex-col items-center flex-shrink-0 border-b border-gray-100 pt-2 pb-3 select-none touch-none"
        >
          <div
            className="w-10 h-1 rounded-full bg-gray-300 mb-3"
            aria-hidden
          />
          <h3 id="sort-sheet-title" className="text-lg font-bold text-black px-4 w-full text-center">
            {s.sort_title}
          </h3>
        </div>
        <div className="py-2 overflow-y-auto">
          {sortOptions.map(option => (
            <div
              key={option.id}
              className="flex items-center px-4 py-4 active:bg-gray-50 cursor-pointer"
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                  sortOption === option.id ? 'border-blue-600' : 'border-black'
                }`}
              >
                {sortOption === option.id && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
              </div>
              <span className={`text-base ${sortOption === option.id ? 'font-bold' : 'font-normal'} text-black`}>
                {option.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SortModal;
