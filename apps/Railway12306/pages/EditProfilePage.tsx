import React from 'react';
import { IcNavBack, IcNavForward, IcInfo } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { maskIdNo } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
export const EditProfilePage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack, bindTap } = useRailwayGestures();
  const { account, passengers } = config;
  const isEnglish = useLocale() === 'en';

  const idNo = maskIdNo(passengers[0]?.idNo ?? '');

  return (
    <div className="min-h-full bg-app-bg">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Edit personal info' : '修改个人信息'}</span>
      </div>

      {/* 基本信息区域 */}
      <div className="bg-app-surface mt-2">
        {/* 姓名 */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <span className="text-base text-gray-900 w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'Name' : '姓　　名'}</span>
          <span className="text-base text-gray-500 flex-1 min-w-0 break-words">{account.personalInfo.name}</span>
        </div>
        {/* 证件类型 */}
        <div className="flex items-center px-4 py-4 border-b border-gray-100">
          <span className="text-base text-gray-900 w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'ID type' : '证件类型'}</span>
          <span className="text-base text-gray-500 flex-1 min-w-0 break-words">{localizeRailwayText('中国居民身份证', isEnglish)}</span>
        </div>
        {/* 证件号码 */}
        <div className="flex items-center px-4 py-4">
          <span className="text-base text-gray-900 w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'ID number' : '证件号码'}</span>
          <div className="flex items-center gap-1.5 flex-1">
            <div className="w-3 h-3 bg-gray-400 rounded-sm" />
            <span className="text-base text-gray-500">{idNo}</span>
          </div>
        </div>
      </div>

      {/* 优惠类型区域 */}
      <div className="bg-app-surface mt-2">
        <div
          className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('account.studentVerify' as any)}
        >
          <div className="flex items-center">
            <span className="text-base text-gray-900 w-[112px] shrink-0 whitespace-normal leading-tight">{isEnglish ? 'Discount type' : '优惠(待)类型'}</span>
            <span className="text-base text-gray-500 min-w-0 break-words">{localizeRailwayText('学生', isEnglish)}</span>
          </div>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>

      {/* 学生票提示 */}
      <div className="mx-4 mt-3 bg-[#FFF7ED] border border-[#FDDCB5] rounded-lg px-4 py-3">
        <div className="flex items-start gap-2">
          <IcInfo size={16} className="text-[#E6A23C] mt-0.5 shrink-0" />
          <span className="text-sm text-[#E6A23C]">{isEnglish ? 'Who can buy student tickets?' : '哪些学生可以购买学生票？'}</span>
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="px-4 mt-8">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium active:bg-app-primary-dark">
          {isEnglish ? 'Submit' : '提交'}
        </button>
      </div>
    </div>
  );
};
