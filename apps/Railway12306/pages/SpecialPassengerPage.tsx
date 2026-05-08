import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';

export const SpecialPassengerPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [activeTab, setActiveTab] = useState(0);
  const tabs = isEnglish ? ['Service details', 'How to apply', 'Who can apply'] : ['服务说明', '受理渠道', '受理对象'];
  const serviceDescription = isEnglish
    ? [
        '1. Registered users of the China Railway customer service website (www.12306.cn) can request online assistance for themselves and listed passengers. Unregistered users should register first.',
        '2. Priority passengers are travelers who need additional assistance because of age, behaviour, physical condition, or mobility limitations that require assistive devices.',
        '3. After approval, railway staff may provide convenient station access, priority security check and ticket verification, boarding guidance, wheelchair or stretcher support in stations, onboard follow-up assistance, and support for passengers traveling with guide dogs.',
        '4. Online requests should be submitted at least 6 hours before departure with accurate ticket details, service needs, and supporting materials. If there are fewer than 6 hours remaining, passengers should apply at the departure station at least 60 minutes before train departure.',
        '5. Railway staff will verify the authenticity of supporting materials and related information.',
      ]
    : [
        '1、中国铁路客户服务中心网站（www.12306.cn）注册用户可为本人及乘车人办理网上特殊重点旅客预约服务，非注册用户可先行注册后办理网上特殊重点旅客预约。',
        '2、特殊重点旅客是指因年龄、行为、身体状况等原因，在旅行中依靠辅助器具才能行动等需特殊照顾的重点旅客。',
        '3、特殊重点旅客申请成功后，由铁路客运站车安排服务人员提供便利进出站、优先安检、优先验证、优先检票、引导帮扶、协助乘降，以及提供站内免费轮椅、担架（车）以及列车内随访关照等服务，为残疾人携带导盲犬提供便利。',
        '4、特殊重点旅客预约须在乘车前6小时线上提交申请，并准确填写有效车票信息（包括实际乘车站、目的地车站和列车车次等信息）、服务需求、相关有效证明材料；不足6小时的应到乘车站现场提出申请，办理时限应不晚于乘车站列车开车前60分钟。',
        '5、铁路部门将对旅客提交的证明材料和相关信息真实性进行核验。',
      ];

  return (
    <div className="min-h-full bg-app-bg flex flex-col">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Priority passenger booking' : '重点旅客预约'}</span>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-app-primary to-[#6BB5FD] px-6 py-6">
        <h2 className="text-xl font-bold text-white">{isEnglish ? 'Priority passenger booking' : '重点旅客预约'}</h2>
        <h3 className="text-lg font-bold text-white">{isEnglish ? 'Service details' : '服务说明'}</h3>
      </div>

      {/* Tabs */}
      <div className="bg-app-surface flex items-center gap-6 px-4 border-b border-gray-100">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`py-3 text-sm ${i === activeTab ? 'text-app-primary font-medium border-b-2 border-app-primary' : 'text-gray-500'}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {activeTab === 0 && (
          <div className="bg-app-surface rounded-xl p-4 text-sm text-gray-700 leading-relaxed space-y-4">
            {serviceDescription.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}
        {activeTab === 1 && (
          <div className="bg-app-surface rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
            <p>{isEnglish ? 'Requests can be submitted through the Railway 12306 website, the app, or station service windows.' : '通过铁路12306网站、APP及车站窗口均可办理重点旅客预约服务。'}</p>
          </div>
        )}
        {activeTab === 2 && (
          <div className="bg-app-surface rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
            <p>{isEnglish ? 'Passengers who need special assistance because of age, behaviour, health, or physical condition.' : '因年龄、行为、身体状况等原因需要特殊照顾的旅客。'}</p>
          </div>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="px-4 py-4 bg-app-surface">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          {isEnglish ? 'Book now' : '立即预约'}
        </button>
      </div>
    </div>
  );
};
