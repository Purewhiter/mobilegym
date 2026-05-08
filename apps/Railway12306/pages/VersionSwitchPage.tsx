import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';

type VersionType = 'standard' | 'elderly' | 'english';

export const VersionSwitchPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const s = useRailwayStrings();
  const [selected, setSelected] = useState<VersionType>('standard');
  const versions = [
    { id: 'standard' as const, name: s.version_standard_name, desc: s.version_standard_desc },
    { id: 'elderly' as const, name: s.version_senior_name, desc: s.version_senior_desc },
    { id: 'english' as const, name: s.version_english_name, desc: s.version_english_desc },
  ];

  return (
    <div className="min-h-full bg-[#E8F2FF]">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.version_switch_title}</span>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`rounded-xl p-5 flex items-start gap-4 ${selected === v.id ? 'bg-[#D6EBFF] border-2 border-app-primary' : 'bg-app-surface border-2 border-transparent'}`}
            onClick={() => setSelected(v.id)}
          >
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mt-1 flex-shrink-0 ${selected === v.id ? 'bg-app-primary border-app-primary' : 'border-app-primary'}`}>
              {selected === v.id && <span className="text-white text-sm">✓</span>}
            </div>
            <div className="flex-1">
              <h3 className={`text-2xl font-bold ${selected === v.id ? 'text-app-primary' : 'text-gray-700'}`}>
                {v.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{v.desc}</p>
            </div>
            <div className="w-36 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-gray-400">{s.action_preview}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
