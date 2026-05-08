import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';

const CITY_NAME_MAP: Record<string, string> = {
  上海: 'Shanghai',
  成都: 'Chengdu',
  南京: 'Nanjing',
};

export const StudentVerifyPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindBack } = useRailwayGestures();
  const { studentVerify } = config;
  const isEnglish = useLocale() === 'en';
  const [activeTab, setActiveTab] = useState(0);
  const faqTabs = isEnglish
    ? ['FAQ', 'Student fare guide', 'Verification guide']
    : ['常见问题', '学生票购票须知', '资质核验说明'];

  const yearLabel = isEnglish
    ? `${studentVerify.year.replace(/学年$/, '')} Academic Year`
    : `${studentVerify.year}`;
  const routeFrom = isEnglish ? CITY_NAME_MAP[studentVerify.from] || studentVerify.from : studentVerify.from;
  const routeTo = isEnglish ? CITY_NAME_MAP[studentVerify.to] || studentVerify.to : studentVerify.to;

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white" />
        <span className="absolute right-4 max-w-[42%] text-right text-white text-sm leading-tight">{isEnglish ? 'Appeal log' : '申诉记录'}</span>
      </div>

      {/* 顶部Banner */}
      <div className="bg-gradient-to-b from-app-primary to-[#7CC0FF] px-6 py-6 text-center">
        <div className="bg-app-surface/20 text-white text-xs px-3 py-1 rounded-full inline-flex items-center gap-1 mb-3">
          🚄 {isEnglish ? 'Student fares make travel easier' : '购票出行更轻松'}
        </div>
        <h2 className="text-2xl font-bold text-white">{isEnglish ? 'Student fare qualification' : '学生优惠资质信息'}</h2>
      </div>

      {/* 学年信息卡片 */}
      <div className="bg-app-surface mx-4 -mt-2 rounded-xl p-4 shadow-sm">
        <div className="text-app-primary text-base font-medium mb-1">
          {yearLabel}
        </div>
        <div className="h-0.5 w-8 bg-app-primary rounded mb-3" />
        <div className="flex items-center gap-6 min-w-0">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-gray-500">{isEnglish ? 'Remaining' : '剩余'}</span>
              <span className="text-4xl font-bold text-gray-800">{studentVerify.remaining}</span>
              <span className="text-xs text-gray-500">{isEnglish ? 'trips' : '次'}</span>
            </div>
            <button className="mt-2 text-xs text-app-primary border border-app-primary rounded-full px-3 py-1 leading-tight">
              {isEnglish ? 'Travel history' : '乘车记录'} &gt;
            </button>
          </div>
          <div className="text-lg font-medium text-gray-800">{routeFrom} – {routeTo}</div>
        </div>
        <div className="mt-3 bg-orange-50 text-orange-500 text-xs px-3 py-2 rounded">
          {isEnglish
            ? '*An academic year runs from October 1 to September 30 of the following year. Up to 4 discounted student tickets can be purchased each academic year.'
            : '*每年的10月1日至下一年的9月30日为一个学年，每学年可购买4次学生优惠票。'}
        </div>
      </div>

      {/* 学生优惠使用说明 */}
      <div className="bg-app-surface mx-4 mt-3 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <span className="text-red-500 text-lg">🎫</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{isEnglish ? 'Student fare guide' : '学生优惠使用说明'}</p>
            <p className="text-xs text-gray-400">
              {isEnglish ? 'View qualification rules and related details' : '查看优惠资质核验说明及相关内容'}
            </p>
          </div>
        </div>
        <button className="text-xs text-app-primary border border-app-primary rounded-full px-3 py-1">
          {isEnglish ? 'View now' : '立即查看'} &gt;
        </button>
      </div>

      {/* 区间变更 */}
      <div className="bg-app-surface mx-4 mt-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-app-primary text-lg">📍</span>
          <span className="text-sm text-gray-800">{isEnglish ? 'Student fare travel route change request' : '学生优惠乘车区间变更申请'}</span>
        </div>
        <button className="max-w-[40%] text-xs text-app-primary border border-app-primary rounded-full px-3 py-1 leading-tight">
          {isEnglish ? 'Apply now' : '去办理'} &gt;
        </button>
      </div>

      {/* FAQ Tabs */}
      <div className="mx-4 mt-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          {faqTabs.map((tab, i) => (
            <button
              key={tab}
              className={`max-w-[33%] whitespace-normal text-sm pb-1 leading-tight ${i === activeTab ? 'text-app-primary font-medium border-b-2 border-app-primary' : 'text-gray-500'}`}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <div className="bg-app-surface rounded-xl p-4">
            <div className="border-l-4 border-app-primary pl-3 mb-3">
              <p className="text-sm font-medium text-app-primary">
                {isEnglish ? '1. How can a new student buy a student ticket online?' : '1. 新生如何通过线上购买学生票？'}
              </p>
            </div>
            <div className="text-xs text-gray-600 leading-relaxed ml-4 space-y-2">
              <p>
                {isEnglish
                  ? 'Step 1: Register a Railway 12306 account using the student’s own identity information and choose Student as the discount type.'
                  : '第一步：需要使用新生本人身份信息注册铁路12306账户，优惠类型选为学生。'}
              </p>
              <p>
                {isEnglish
                  ? 'Step 2: Open Railway 12306 App > My > Student Fare Qualification, fill in the required discount details such as name, ID number, school, home location, and expected graduation year, then submit for review before purchasing student tickets.'
                  : '第二步：打开铁路12306App-我的-学生优惠资质核验专区填写相关优惠信息(姓名、证件号码、学校和家庭所在地、预计毕业年份)-提交审核后，购买学生优惠票即可。'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
