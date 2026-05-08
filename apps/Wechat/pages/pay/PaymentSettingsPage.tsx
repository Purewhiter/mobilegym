import React from 'react';
import { IcNavForward } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const PaymentSettingsPage: React.FC = () => {
  const { bindTap } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const text = isEnglish
    ? {
        changePassword: 'Change Payment Password',
        forgotPassword: 'Forgot Payment Password',
        fingerprint: 'Phone Fingerprint',
        off: 'Off',
        autoRenew: 'Auto Renew',
        appleServices: 'Apple Service Charges',
        passwordFree: 'Password-free Payments',
        wearables: 'Watch & Band Payments',
        phoneTransfer: 'Phone Number Transfer Settings',
        walletPage: 'Wallet Page Management',
        closeWechatPay: 'Disable WeChat Pay',
        provider: 'Provided by Tenpay',
      }
    : {
        changePassword: '修改支付密码',
        forgotPassword: '忘记支付密码',
        fingerprint: '手机指纹识别',
        off: '已关闭',
        autoRenew: '自动续费',
        appleServices: 'Apple服务扣费',
        passwordFree: '免密支付',
        wearables: '手表及手环支付',
        phoneTransfer: '手机号转账设置',
        walletPage: '钱包页管理',
        closeWechatPay: '注销微信支付',
        provider: '本服务由财付通提供',
      };

  const MenuItem = ({ label, value, isLast = false, onClick, ...rest }: { label: string; value?: string; isLast?: boolean; onClick?: React.MouseEventHandler<HTMLDivElement>; [key: string]: any }) => (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 h-14 bg-white active:bg-gray-50 ${!isLast ? 'border-b border-gray-100' : ''} ${onClick ? 'cursor-pointer' : ''}`}
      {...rest}
    >
        <span className="text-[17px] text-black">{label}</span>
        <div className="flex items-center gap-2">
            {value && <span className="text-[15px] text-gray-400">{value}</span>}
            <IcNavForward size={16} className="text-gray-300" />
        </div>
    </div>
  );

  return (
    <div className="bg-app-bg min-h-full flex flex-col">
      <div className="mt-2 bg-white">
          <MenuItem label={text.changePassword} />
          <MenuItem label={text.forgotPassword} isLast />
      </div>

      <div className="mt-2 bg-white">
          <MenuItem label={text.fingerprint} value={text.off} isLast />
      </div>

      <div className="mt-2 bg-white">
          <MenuItem
            label={text.autoRenew}
            {...bindTap<HTMLDivElement>('paymentSettings.subscriptions.open')}
          />
          <MenuItem label={text.appleServices} />
          <MenuItem label={text.passwordFree} />
          <MenuItem label={text.wearables} isLast />
      </div>

      <div className="mt-2 bg-white">
          <MenuItem label={text.phoneTransfer} value={text.off} isLast />
      </div>

      <div className="mt-2 bg-white">
          <MenuItem label={text.walletPage} isLast />
      </div>

      <div className="mt-6 mx-4">
          <button className="w-full py-3 bg-white text-black text-[17px] rounded-lg active:bg-gray-50">
              {text.closeWechatPay}
          </button>
      </div>
      
      <div className="mt-auto pb-8 text-center text-xs text-gray-400">
          {text.provider}
      </div>
    </div>
  );
};
