import React from 'react';
import { IcNavBack, IcCheck } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';

export const IdVerifyPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const s = useRailwayStrings();

  return (
    <div className="min-h-full bg-[#F5F7FA]">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.func_id_verify}</span>
      </div>

      {/* 蓝色波浪背景 */}
      <div className="bg-gradient-to-b from-[#5AABFD] to-[#D0E8FF] h-32 relative">
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 375 40" className="w-full">
            <path d="M0 40 Q93.75 0 187.5 20 T375 40 Z" fill="#F5F7FA" />
          </svg>
        </div>
      </div>

      {/* 成功图标 */}
      <div className="flex flex-col items-center -mt-12">
        <div className="w-24 h-24 rounded-full border-4 border-[#4CAF50] bg-app-surface flex items-center justify-center shadow-lg">
          <IcCheck size={48} className="text-[#4CAF50]" />
        </div>
        <p className="mt-10 text-lg text-gray-700">{s.id_verify_success_message}</p>
      </div>

      {/* 返回按钮 */}
      <div className="px-6 mt-12">
        <button
          className="w-full py-3 bg-[#5AABFD] rounded-lg text-white text-lg font-medium"
          {...bindBack<HTMLButtonElement>()}
        >
          {s.action_back}
        </button>
      </div>

      {/* 底部链接 */}
      <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-sm">
        <span className="text-app-primary">{s.agreement_verification_service}</span>
        <span className="text-gray-400">{s.common_and}</span>
        <span className="text-app-primary">{s.policy_privacy}</span>
      </div>
    </div>
  );
};
