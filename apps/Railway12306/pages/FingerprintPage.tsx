import React, { useState } from 'react';
import { IcNavBack, IcFingerprint } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';

export const FingerprintPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const s = useRailwayStrings();
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="min-h-full bg-app-surface">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.func_fingerprint}</span>
      </div>

      <div className="flex flex-col items-center pt-20">
        <IcFingerprint size={80} className="text-app-primary" strokeWidth={1.5} />
        <p className="mt-8 text-xl text-gray-700 font-medium">
          {enabled ? s.fingerprint_enabled_status : s.fingerprint_disabled_status}
        </p>
      </div>

      <div className="px-6 mt-12">
        <button
          className="w-full py-3 border border-app-primary rounded-lg text-app-primary text-base font-medium bg-app-surface"
          onClick={() => setEnabled(!enabled)}
        >
          {enabled ? s.fingerprint_turn_off : s.fingerprint_turn_on}
        </button>
      </div>
    </div>
  );
};
