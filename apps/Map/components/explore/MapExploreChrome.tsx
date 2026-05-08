import React from 'react';
import { IcLayers, IcShare, IcNavigation } from '../../res/icons';
import { useMapStrings } from '../../hooks/useMapStrings';

export const MapLayerFloatingButton: React.FC<{
  activeCategory: string | null;
  destination: { lat: number; lng: number; name: string } | undefined;
  onOpenLayers: () => void;
}> = ({ activeCategory, destination, onOpenLayers }) => {
  const s = useMapStrings();

  return (
    <button
    type="button"
    className={`absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-gray-100 bg-app-surface shadow-md text-gray-700 active:bg-gray-50 ${
      activeCategory
        ? 'top-[calc(env(safe-area-inset-top,0px)+7rem)]'
        : destination
          ? 'top-[calc(env(safe-area-inset-top,0px)+10rem)]'
          : 'top-[calc(env(safe-area-inset-top,0px)+11.5rem)]'
    }`}
    onClick={onOpenLayers}
    aria-label={s.map_layers}
  >
    <IcLayers size={22} strokeWidth={2} />
  </button>
  );
};

export const MapFloatingActionColumn: React.FC<{
  activeCategory: string | null;
  onRecenter: () => void;
  onOpenRouteSetup: () => void;
}> = ({ activeCategory, onRecenter, onOpenRouteSetup }) => (
  <div className="absolute right-4 bottom-24 flex flex-col gap-3 z-10 pointer-events-auto">
    {activeCategory && (
      <button
        type="button"
        className="w-14 h-14 bg-app-surface rounded-2xl shadow-md flex items-center justify-center text-gray-700 border border-gray-50 active:bg-gray-50"
      >
        <IcShare size={22} fill="none" strokeWidth={2} />
      </button>
    )}

    {!activeCategory && (
      <>
        <button
          type="button"
          className="w-14 h-14 bg-app-surface rounded-2xl shadow-md flex items-center justify-center text-gray-700 border border-gray-50 active:bg-gray-50"
          onClick={onRecenter}
        >
          <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
        </button>
        <button
          type="button"
          className="w-14 h-14 bg-teal-700 rounded-2xl shadow-md flex items-center justify-center text-white border border-teal-700 active:opacity-90"
          onClick={onOpenRouteSetup}
        >
          <IcNavigation size={22} fill="currentColor" className="rotate-45" />
        </button>
      </>
    )}
  </div>
);
