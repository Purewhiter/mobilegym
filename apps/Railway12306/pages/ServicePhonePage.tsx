import React from 'react';
import { IcNavBack } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { localizeRailwayPhoneRegion } from '../utils/localizeRailwayItem';

export const ServicePhonePage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack } = useRailwayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Customer service numbers' : '客服电话查询'}</span>
      </div>

      {/* 蓝色 banner */}
      <div className="bg-gradient-to-b from-app-primary to-[#6BB3F7] px-4 pt-2 pb-6">
        <h2 className="text-white text-2xl font-bold">{isEnglish ? 'Customer service numbers' : '客服电话查询'}</h2>
        <p className="text-white/60 text-sm mt-1 italic">{isEnglish ? 'Customer service phone lookup' : 'Customer service phone query'}</p>
      </div>

      {/* 表格 */}
      <div className="mx-3 -mt-2 bg-app-surface rounded-xl overflow-hidden shadow-sm mb-6">
        {/* 表头 */}
        <div className="flex items-center bg-gray-50 px-4 py-2.5 border-b border-gray-100">
          <span className="flex-1 text-xs font-medium text-gray-500">{isEnglish ? 'Service area' : '服务地区'}</span>
          <span className="w-20 text-center text-xs font-medium text-gray-500">{isEnglish ? 'Area code' : '长途区号'}</span>
          <span className="w-16 text-center text-xs font-medium text-gray-500">{isEnglish ? 'Phone' : '客服电话'}</span>
        </div>

        {config.servicePhones.map((item, i) => (
          <div key={i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0">
            <span className="flex-1 text-sm text-gray-700">{localizeRailwayPhoneRegion(item.region, isEnglish)}</span>
            <span className="w-20 text-center text-sm text-gray-700">{item.areaCode}</span>
            <span className="w-16 text-center text-sm text-app-primary font-medium">{item.phone}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
