import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';

const reasons = ['使用不便', '安全或隐私顾虑', '其他原因'];

export const CancelAccountPage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">注销原因</span>
      </div>

      {/* 温馨提示 */}
      <div className="bg-app-surface px-4 py-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          <span className="text-orange-500">⚠ 温馨提示：</span>
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-1 indent-8">
          1、注销时您的账号内不能有未出行的订单及待兑现的候补订单。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-1 indent-8">
          2、若您已注册并激活了常旅客积分会员，注销12306账户后，常旅客积分会员将会保留，您乘车后将仍然累计积分，可再次注册12306绑定查看会员信息；如会员状态未激活，您的常旅客会员信息将会被同时注销。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-1 indent-8">
          3、一旦注销成功，您的12306账号将无法找回，数据和信息无法恢复，请慎重！
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-1 indent-8">
          4、为了保证您的信息安全，需核实是否本人操作，线上注销账户需识别面部进行人证核验。您也可以选择携带注册时填写身份证件原件，到就近的火车站窗口办理注销。
        </p>
      </div>

      <div className="h-2 bg-[#F0F0F0]" />

      {/* 注销原因选择 */}
      <div className="bg-app-surface px-4 py-4">
        <p className="text-base font-bold text-gray-900 mb-4">请选择您注销账户的原因:</p>
        <div className="space-y-4">
          {reasons.map((reason) => (
            <div
              key={reason}
              className="flex items-center gap-3"
              onClick={() => setSelectedReason(reason)}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedReason === reason ? 'bg-app-primary border-app-primary' : 'border-gray-300'}`}>
                {selectedReason === reason && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-sm text-gray-600">{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 意见反馈 */}
      <div className="bg-[#F0F5FF] mx-4 mt-4 rounded-lg p-4">
        <textarea
          placeholder="您的意见和反馈对我们非常重要，有利于我们改善服务。如果您有任何意见或建议，请您在此填写。（140字以内）"
          maxLength={140}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full h-28 bg-transparent text-sm text-gray-500 outline-none resize-none"
        />
      </div>

      {/* 确认注销 */}
      <div className="px-4 mt-6 pb-8">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          确认注销
        </button>
      </div>
    </div>
  );
};
