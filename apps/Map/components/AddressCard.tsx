import React, { useState } from 'react';
import { IcLocation, IcNavArrow, IcInfo } from '../res/icons';
import { stripEmbeddedPlusCodeFromAddress } from '../utils/placeUtils';

export const AddressCard: React.FC<{ address: string; plusCode: string | null }> = ({ address, plusCode }) => {
  const [expanded, setExpanded] = useState(false);
  const displayAddress = stripEmbeddedPlusCodeFromAddress(address, plusCode);
  const hasExpandablePlus = Boolean(plusCode?.trim());

  return (
    <div className="bg-gray-50 rounded-2xl px-4 py-3.5">
      {hasExpandablePlus ? (
        <button
          type="button"
          className="flex items-start gap-3.5 w-full text-left active:opacity-90"
          onClick={() => setExpanded(!expanded)}
        >
          <IcLocation className="text-gray-500 mt-0.5 shrink-0" size={20} />
          <div className="text-sm text-gray-800 leading-relaxed flex-1">{displayAddress}</div>
          <IcNavArrow
            className={`text-gray-400 shrink-0 mt-0.5 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`}
            size={18}
          />
        </button>
      ) : (
        <div className="flex items-start gap-3.5">
          <IcLocation className="text-gray-500 mt-0.5 shrink-0" size={20} />
          <div className="text-sm text-gray-800 leading-relaxed flex-1">{displayAddress}</div>
        </div>
      )}
      {expanded && hasExpandablePlus && (
        <div className="mt-3 ml-[34px] flex items-center gap-2 text-sm text-gray-600">
          <span>{plusCode}</span>
          <IcInfo size={14} className="text-gray-400 shrink-0" />
        </div>
      )}
    </div>
  );
};
