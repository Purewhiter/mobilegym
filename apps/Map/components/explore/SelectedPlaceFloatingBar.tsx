import React from 'react';
import { IcClose } from '../../res/icons';
import { useMapStrings } from '../../hooks/useMapStrings';

export const SelectedPlaceFloatingBar: React.FC<{
  selectedPlace: google.maps.places.PlaceResult;
  onClear: () => void;
}> = ({ selectedPlace, onClear }) => {
  const s = useMapStrings();

  return (
  <div className="absolute top-12 left-4 right-4 z-20 animate-fade-in">
    <div className="shadow-md rounded-full bg-app-surface flex items-center p-3 border border-gray-100">
      <div className="flex-1 text-gray-900 text-lg truncate px-2 font-medium">
        {selectedPlace.name}{' '}
        {selectedPlace.formatted_address ? `- ${selectedPlace.formatted_address}` : ''}
      </div>
      <button type="button" className="p-1 text-app-text-muted rounded-full hover:bg-gray-100" onClick={onClear}>
        <IcClose size={24} />
      </button>
    </div>
    <div className="flex justify-center mt-2">
      <button
        type="button"
        className="bg-app-surface px-4 py-1.5 rounded-full shadow-sm text-sm font-medium text-gray-700 border border-gray-100 flex items-center gap-1"
      >
        {s.search_view_similar}
      </button>
    </div>
  </div>
  );
};
