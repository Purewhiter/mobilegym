import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const WechatDeviceManagementPage: React.FC = () => {
  const location = useLocation();
  const { bindBack } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const auth = useWechatStore(s => s.auth);

  const phone = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('phone') || auth?.session?.phone || '';
  }, [auth?.session?.phone, location.search]);

  const devices = (auth?.trustedDevicesByPhone?.[phone] || []) as any[];
  const text = isEnglish
    ? {
        back: 'Back',
        title: 'Device Management',
        empty: 'No trusted devices yet',
      }
    : {
        back: '返回',
        title: '设备管理',
        empty: '暂无已信任设备',
      };

  return (
    <div className="min-h-full bg-app-bg p-4">
      <div className="flex items-center gap-3 mb-6">
        <button className="px-3 py-2 bg-app-surface border border-(--app-c-tw-border-gray-100) rounded-md active:bg-(--app-c-tw-bg-gray-50)" {...bindBack<HTMLButtonElement>()}>
          {text.back}
        </button>
        <div className="text-(--app-title-text-size-18) font-bold text-app-text">{text.title}</div>
      </div>

      <div className="bg-app-surface rounded-xl border border-(--app-c-tw-border-gray-100) overflow-hidden">
        {devices.length === 0 ? (
          <div className="px-4 py-6 text-[13px] text-(--app-c-tw-text-gray-500)">{text.empty}</div>
        ) : (
          devices.map((d, idx) => (
            <div key={`${d.deviceId}-${idx}`} className={`px-4 py-4 ${idx < devices.length - 1 ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
              <div className="text-(--app-title-text-size-17) text-app-text font-medium">{String(d.deviceName || d.deviceId || '')}</div>
              <div className="text-[13px] text-(--app-c-tw-text-gray-500)">{String(d.deviceId || '')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WechatDeviceManagementPage;
