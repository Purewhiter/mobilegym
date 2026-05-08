import React, { useState } from 'react';
import { IcNavBack, IcMessage } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
export const NotificationSettingsPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const s = useRailwayStrings();
  const [selected, setSelected] = useState<'alipay' | 'wechat'>('alipay');

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.notification_settings_title}</span>
        <IcMessage size={22} className="absolute right-4 text-white" />
      </div>

      <div className="bg-[#F0F0F0] px-4 py-3">
        <span className="text-sm text-gray-700 font-medium">{s.notification_settings_subtitle}</span>
      </div>

      {/* 支付宝 */}
      <div
        className="bg-app-surface px-4 py-4 border-b border-gray-100 active:bg-gray-50"
        onClick={() => setSelected('alipay')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1677FF] rounded-lg flex items-center justify-center text-white font-bold text-lg">
              {s.notification_alipay_initial}
            </div>
            <span className="text-base font-medium">{s.notification_alipay_name}</span>
            <span className="text-xs text-app-primary border border-app-primary rounded px-1.5 py-0.5">{s.notification_current_channel}</span>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected === 'alipay' ? 'bg-app-primary border-app-primary' : 'border-gray-300'}`}>
            {selected === 'alipay' && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
        <div className="ml-13 mt-2 text-sm text-gray-400">
          <p>{s.notification_alipay_nickname}</p>
          <p>{s.notification_alipay_linked_at}</p>
        </div>
      </div>

      {/* 微信 */}
      <div
        className="bg-app-surface px-4 py-4 active:bg-gray-50"
        onClick={() => setSelected('wechat')}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#07C160] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs">{s.notification_wechat_initial}</span>
            </div>
            <span className="text-base font-medium">{s.notification_wechat_name}</span>
            <span className="text-xs text-[#07C160] border border-[#07C160] rounded px-1.5 py-0.5">{s.notification_linked}</span>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected === 'wechat' ? 'bg-app-primary border-app-primary' : 'border-gray-300'}`}>
            {selected === 'wechat' && <span className="text-white text-xs">✓</span>}
          </div>
        </div>
        <p className="ml-13 mt-2 text-sm text-gray-400">{s.notification_wechat_desc}</p>
      </div>

      {/* 温馨提示 */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-sm text-gray-400">{s.common_notice}</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">{s.notification_notes_body}</p>
      </div>
    </div>
  );
};
