import React from 'react';
import { IcClose } from '../../res/icons';
import { useMapStrings } from '../../hooks/useMapStrings';

export const ExploreCategoryHeader: React.FC<{
  title: string;
  onClose: () => void;
  onSearchThisArea: () => void;
}> = ({ title, onClose, onSearchThisArea }) => {
  const s = useMapStrings();

  return (
    <div className="relative pt-12 px-4 pb-2 bg-gradient-to-b from-white/90 via-white/50 to-transparent pointer-events-auto animate-fade-in">
    <div className="shadow-md rounded-full bg-app-surface flex items-center p-3 border border-gray-100">
      <div className="flex-1 text-gray-900 text-xl font-normal px-2">{title}</div>
      <button type="button" className="p-1 text-app-text-muted rounded-full hover:bg-gray-100" onClick={onClose}>
        <IcClose size={24} />
      </button>
    </div>
    <div className="absolute top-28 left-1/2 transform -translate-x-1/2 pointer-events-auto">
      <button
        type="button"
        className="bg-app-surface px-4 py-2 rounded-full shadow-md text-sm font-medium text-gray-700 flex items-center gap-1 active:bg-gray-50 border border-gray-100"
        onClick={onSearchThisArea}
      >
        {s.search_in_area}
      </button>
    </div>
  </div>
  );
};
