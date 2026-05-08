import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const WechatTrustDevicePage: React.FC = () => {
  const location = useLocation();
  const { bindBack, back } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const auth = useWechatStore(s => s.auth);
  const trustCurrentDevice = useWechatStore(s => s.trustCurrentDevice);

  const phone = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('phone') || auth?.pendingTrustDevice?.phone || '';
  }, [auth?.pendingTrustDevice?.phone, location.search]);

  const afterTrustPath = useMemo(() => {
    const from = (location.state as any)?.from as { pathname?: string; search?: string } | undefined;
    const pathname = String(from?.pathname || '');
    const search = String(from?.search || '');
    const target = `${pathname}${search}`;
    return target && target.startsWith('/') ? target : '/me';
  }, [location.state]);

  const text = isEnglish
    ? {
        back: 'Back',
        title: 'Device Verification',
        newDevice: 'New device login detected',
        account: 'Account',
        warning: 'If this was not you, change your password immediately.',
        trust: 'Trust This Device',
        cancel: 'Cancel',
      }
    : {
        back: '返回',
        title: '设备识别',
        newDevice: '检测到新设备登录',
        account: '账号',
        warning: '如非本人操作，请立即修改密码。',
        trust: '信任此设备',
        cancel: '取消',
      };

  return (
    <div className="min-h-full bg-app-bg p-4">
      <div className="flex items-center gap-3 mb-6">
        <button className="px-3 py-2 bg-app-surface border border-(--app-c-tw-border-gray-100) rounded-md active:bg-(--app-c-tw-bg-gray-50)" {...bindBack<HTMLButtonElement>()}>
          {text.back}
        </button>
        <div className="text-(--app-title-text-size-18) font-bold text-app-text">{text.title}</div>
      </div>

      <div className="bg-app-surface rounded-xl border border-(--app-c-tw-border-gray-100) p-4">
        <div className="text-(--app-title-text-size-17) text-app-text font-medium mb-2">{text.newDevice}</div>
        <div className="text-[13px] text-(--app-c-tw-text-gray-500) mb-4">{text.account}: {phone}</div>
        <div className="text-[13px] text-(--app-c-tw-text-gray-500)">{text.warning}</div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          className="h-12 rounded-xl bg-app-primary text-white font-medium active:opacity-90"
          onClick={() => {
            if (!phone) return;
            trustCurrentDevice(phone);
            back();
          }}
        >
          {text.trust}
        </button>
        <button
          className="h-12 rounded-xl bg-app-surface border border-(--app-c-tw-border-gray-100) text-app-text font-medium active:bg-(--app-c-tw-bg-gray-50)"
          {...bindBack<HTMLButtonElement>()}
        >
          {text.cancel}
        </button>
      </div>
    </div>
  );
};

export default WechatTrustDevicePage;
