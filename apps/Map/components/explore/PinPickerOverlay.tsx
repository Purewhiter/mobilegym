import React from 'react';
import { IcClose } from '../../res/icons';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapGestures } from '../../hooks/useMapGestures';
import { useMapStrings } from '../../hooks/useMapStrings';

type SelectionMode = 'origin' | 'destination';

/** 地图中心红色图钉 + 准心（pointer-events: none，由父级置于地图容器内） */
export const PinPickerMapCenterIcon: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
    <div className="flex -translate-y-3 flex-col items-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        className="drop-shadow-md"
        style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.3))' }}
        aria-hidden
      >
        <path
          fill="#DC2626"
          stroke="#991B1B"
          strokeWidth="0.5"
          d="M 12 2 C 9.2 2 7 4.2 7 7 C 7 12 11.5 19 12 23 C 12.5 19 17 12 17 7 C 17 4.2 14.8 2 12 2 Z"
        />
        <circle cx="12" cy="7" r="2.5" fill="#7f1d1d" />
      </svg>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        className="-mt-0.5 text-gray-900"
        aria-hidden
      >
        <path
          d="M1 1 L13 13 M13 1 L1 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="square"
        />
      </svg>
    </div>
  </div>
);

export const PinPickerHeader: React.FC<{
  selectionMode: SelectionMode;
  onClose: () => void;
}> = ({ selectionMode, onClose }) => {
  const s = useMapStrings();
  useMapBackHandler(
    () => {
      onClose();
      return true;
    },
    { priority: 750 },
  );

  const { bindTap } = useMapGestures();

  return (
    <header className="shrink-0 px-4 pb-2 pt-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-gray-900">
            {selectionMode === 'origin' ? s.select_origin : s.select_destination}
          </h1>
          <p className="mt-2 text-[15px] leading-snug text-gray-500">{s.pin_picker_hint}</p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200/80 text-gray-800 active:bg-gray-300/90"
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'pinPicker.close' },
            { onTrigger: onClose },
          )}
        >
          <IcClose size={22} strokeWidth={2.25} />
        </button>
      </div>
    </header>
  );
};

export const PinPickerFooter: React.FC<{
  onConfirm: () => void;
}> = ({ onConfirm }) => {
  const { bindTap } = useMapGestures();
  const s = useMapStrings();

  return (
    <footer className="shrink-0 px-4 pb-safe pt-3">
      <button
        type="button"
        className="w-full rounded-full bg-[#0d5c5c] py-3.5 text-[17px] font-medium text-white shadow-sm active:bg-[#0a4a47]"
        {...bindTap<HTMLButtonElement>(
          { kind: 'action', id: 'pinPicker.confirm' },
          { onTrigger: onConfirm },
        )}
      >
        {s.pin_picker_set}
      </button>
    </footer>
  );
};
