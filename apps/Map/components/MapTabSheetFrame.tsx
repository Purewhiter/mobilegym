import React, { useRef } from 'react';
import { useMapTabBottomSheet } from '../hooks/useMapTabBottomSheet';
import { useMapStore } from '../state';

/**
 * 「我」「贡献」叠在共享地图层之上；三档为露头 / 半屏 / 顶满（中间档为 50%，与本地生活脉搏的约 20% 不同）。
 * 与探索页一致：有地点详情 / 地点结果 Sheet / 路线面板时收起本 Sheet，避免与 PlaceDetailSheet 等双叠。
 */
export const MapTabSheetFrame: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { sheetHeight, isDragging, pointerHandlers } = useMapTabBottomSheet(containerRef);
  const poi = useMapStore((s) => s.currentView.poi);
  const route = useMapStore((s) => s.currentView.route);
  const placeResultsSheetOpen = useMapStore((s) => s.currentView.placeResultsSheetOpen);
  const routeSheetOpen = useMapStore((s) => s.currentView.routeSheetOpen);
  const hideTabSheet = poi !== null || route !== null || placeResultsSheetOpen || routeSheetOpen;

  if (hideTabSheet) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <div
        className="pointer-events-auto absolute bottom-0 left-0 right-0 z-20 flex flex-col rounded-t-3xl bg-app-surface shadow-up"
        style={{
          height: `${sheetHeight}px`,
          transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
          willChange: isDragging ? 'height' : 'auto',
        }}
      >
        <div className="flex w-full shrink-0 touch-none justify-center pt-3 pb-1" {...pointerHandlers}>
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
};
