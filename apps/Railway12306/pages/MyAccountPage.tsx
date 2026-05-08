import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { maskPhone, maskEmail } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
export const MyAccountPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack, bindTap } = useRailwayGestures();
  const { account } = config;
  const isEnglish = useLocale() === 'en';

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'My account' : '我的账户'}</span>
      </div>

      <div className="bg-app-surface mt-2">
        {/* 个人信息 */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('account.editProfile' as any)}
        >
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 font-medium">{isEnglish ? 'Personal info' : '个人信息'}</span>
            <p className="text-xs text-gray-400 mt-0.5">{account.personalInfo.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 border border-green-600 rounded-full px-2 py-0.5">
              {localizeRailwayText(account.personalInfo.status, isEnglish)}
            </span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        </div>

        {/* 学生资质查询 */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('account.studentVerify' as any)}
        >
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 font-medium">{isEnglish ? 'Student qualification' : '学生资质查询'}</span>
            <p className="text-xs text-gray-400 mt-0.5">{isEnglish ? 'Student-exclusive ticket discounts' : account.studentQualification.desc}</p>
          </div>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>

      <div className="bg-app-surface mt-2">
        {/* 手机号 */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('account.changePhone' as any)}
        >
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 font-medium">{isEnglish ? 'Phone number' : '手机号'}</span>
            <p className="text-xs text-gray-400 mt-0.5">(+86) {maskPhone(account.phone.number)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 border border-green-600 rounded-full px-2 py-0.5">
              {localizeRailwayText(account.phone.status, isEnglish)}
            </span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        </div>

        {/* 邮箱 */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 font-medium">{isEnglish ? 'Email' : '邮箱'}</span>
            <p className="text-xs text-gray-400 mt-0.5">{maskEmail(account.email.address)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500 border border-red-500 rounded-full px-2 py-0.5">
              {localizeRailwayText(account.email.status, isEnglish)}
            </span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        </div>

        {/* 修改密码 */}
        <div
          className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('settings.changePassword' as any)}
        >
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 font-medium">{isEnglish ? 'Change password' : '修改密码'}</span>
            <p className="text-xs text-gray-400 mt-0.5">{isEnglish ? 'Add extra protection to your account' : '为您的账户增加安全保障'}</p>
          </div>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>

      {/* 退出登录 */}
      <div className="px-4 mt-auto pt-8 pb-8">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          {isEnglish ? 'Sign out' : '退出登录'}
        </button>
      </div>
    </div>
  );
};
