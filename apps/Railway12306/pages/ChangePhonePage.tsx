import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';

export const ChangePhonePage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const isEnglish = useLocale() === 'en';
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Change phone number' : '修改手机号'}</span>
      </div>

      {/* 第一步 */}
      <div className="bg-app-surface mx-4 mt-4 rounded-xl p-4">
        <h3 className="text-base font-bold text-gray-800 mb-3">{isEnglish ? 'Step 1: Enter the phone number to link' : '第一步：输入需要绑定的手机号码'}</h3>

        <div className="flex items-center border-b border-app-border py-3">
          <span className="text-sm text-gray-500 w-[92px] whitespace-normal leading-tight">{isEnglish ? 'Country' : '国家/地区'}</span>
          <span className="min-w-0 text-sm text-gray-800 break-words">{isEnglish ? 'China (+86)' : '中国(+86)'}</span>
        </div>

        <div className="bg-orange-50 text-sm text-orange-600 px-3 py-2 rounded mt-3 leading-relaxed">
          {isEnglish ? (
            <>Complete two-way phone verification by sending <span className="text-red-500 font-bold">999</span> to 12306 from the phone number entered below so you can receive the SMS verification code.</>
          ) : (
            <>请按程序进行手机双向核验，使用您下面输入的手机号发送<span className="text-red-500 font-bold">999</span>至12306以便接收短信验证码。</>
          )}
        </div>

        <div className="flex items-center border-b border-app-border py-3 mt-3">
          <span className="text-sm text-gray-500 w-[92px] whitespace-normal leading-tight">{isEnglish ? 'Phone' : '手机号码'}</span>
          <input
            type="tel"
            placeholder={isEnglish ? 'Enter phone number' : '请输入手机号码'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1 min-w-0 text-sm outline-none"
          />
        </div>

        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium mt-4 leading-tight">
          {isEnglish ? 'Send SMS' : '去发短信'}
        </button>
        <p className="text-center text-sm text-gray-500 mt-2">{isEnglish ? 'The code is valid for 10 minutes' : '验证码10分钟内有效'}</p>
      </div>

      {/* 第二步 */}
      <div className="bg-app-surface mx-4 mt-4 rounded-xl p-4">
        <h3 className="text-base font-bold text-gray-800 mb-2">{isEnglish ? 'Step 2: Enter the verification code' : '第二步：填写验证码'}</h3>
        <p className="text-sm text-gray-500 mb-4">{isEnglish ? 'Enter the 6-digit verification code you received below' : '请您将收到的6位数字验证码填写到下方'}</p>

        <div className="flex items-center justify-center gap-3 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 border-b-2 border-gray-300 flex items-center justify-center text-lg font-medium"
            >
              {code[i] || ''}
            </div>
          ))}
        </div>
        <input
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="opacity-0 absolute"
        />

        <button className="w-full py-3 bg-gray-200 rounded-lg text-gray-400 text-base font-medium leading-tight">
          {isEnglish ? 'Submit change' : '提交修改'}
        </button>
      </div>

      {/* 温馨提示 */}
      <div className="px-4 mt-4 pb-6">
        <p className="text-sm font-bold text-gray-700 mb-1">{isEnglish ? 'Notes:' : '温馨提示：'}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{isEnglish ? '1. Each user can request an SMS verification code for phone verification up to three times per day.' : '1.一个用户一天可以获取三次手机核验的短信验证码。'}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{isEnglish ? '2. Users who complete phone verification can sign in to the 12306 website and app with their phone number.' : '2.手机核验通过的用户可以使用手机号码登录12306网站和手机客户端。'}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{isEnglish ? '3. Only users who have passed phone verification can modify email addresses, passwords, and similar account settings on the 12306 website and app.' : '3.手机核验通过的用户方能在12306网站和手机客户端办理邮箱修改、密码修改等业务。'}</p>
      </div>
    </div>
  );
};
