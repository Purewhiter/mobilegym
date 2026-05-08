import React from 'react';
import { IcNavBack } from '../../res/icons';
import type { RouteStep } from '../../hooks/useRouting';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapStrings } from '../../hooks/useMapStrings';

export const NavigationOverlay: React.FC<{
  currentStepIndex: number;
  routeSteps: RouteStep[];
  routeInfo: { duration: string; distance: string } | null;
  onExit: () => void;
}> = ({ currentStepIndex, routeSteps, routeInfo, onExit }) => {
  const s = useMapStrings();

  useMapBackHandler(
    () => {
      onExit();
      return true;
    },
    { priority: 800 },
  );

  return (
    <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between animate-fade-in">
      <div className="bg-emerald-600 text-white p-4 pt-12 shadow-md pointer-events-auto flex items-start gap-4">
        <div className="mt-1">
          <IcNavBack size={48} className="text-white rotate-90" />
        </div>
        <div className="flex-1">
          <div className="text-4xl font-bold mb-1">
            {routeSteps[currentStepIndex]?.distanceText || ''}
          </div>
          <div className="text-xl font-medium leading-tight">
            {routeSteps[currentStepIndex]?.instructions || s.route_continue_straight}
          </div>
        </div>
      </div>

      <div className="bg-app-surface p-4 pb-8 shadow-up flex items-center justify-between pointer-events-auto border-t border-gray-100">
        <div className="flex flex-col">
          <div className="text-3xl font-bold text-emerald-600 mb-1">{routeInfo?.duration || ''}</div>
          <div className="text-lg text-app-text-muted font-medium flex items-center gap-2">
            {routeInfo?.distance ? <span>{routeInfo.distance}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="bg-gray-100 text-app-text px-8 py-3 rounded-full font-bold text-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
          onClick={onExit}
        >
          {s.route_exit}
        </button>
      </div>
    </div>
  );
};
