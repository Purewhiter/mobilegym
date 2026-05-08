import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStore } from '../state';
import { SmsGateway } from '../../../os/SmsGateway';
import { useLocale } from '../../../os/locale';

export const ChangePasswordPage: React.FC = () => {
  const { bindBack, back } = useRailwayGestures();
  const changePassword = useRailwayStore(s => s.changePassword);
  const isEnglish = useLocale() === 'en';
  const [searchParams, setSearchParams] = useSearchParams();
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const generatedCode = React.useRef('');

  const dialogKey = searchParams.get('dialog') as 'no_sms' | 'empty_code' | 'wrong_code' | null;
  const openDialog = (key: 'no_sms' | 'empty_code' | 'wrong_code') =>
    setSearchParams(p => { p.set('dialog', key); return p; });

  const DIALOG_MESSAGES: Record<string, string> = {
    no_sms: isEnglish ? 'Please get the SMS verification code first.' : '请先获取短信验证码',
    empty_code: isEnglish ? 'Please enter the verification code.' : '请输入验证码',
    wrong_code: isEnglish ? 'Sorry, the SMS verification code you entered is incorrect. (M0019)' : '很抱歉，您输入的短信验证码有误。\n(M0019)',
  };

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  const sendSmsCode = () => {
    if (cooldownSec > 0) return;
    const digits = '0123456789';
    const code = Array.from({ length: 6 }).map(() => digits[Math.floor(Math.random() * 10)]).join('');
    generatedCode.current = code;
    setSmsSent(true);
    SmsGateway.receiveMessage({
      from: isEnglish ? 'Railway 12306' : '铁路12306',
      body: isEnglish
        ? `[Railway 12306] Verification code: ${code}. Valid for 5 minutes.`
        : `【铁路12306】验证码：${code}，5分钟内有效`,
    });
    setCooldownSec(60);
  };

  const handleSubmit = () => {
    setError('');
    if (!oldPwd || !newPwd || !confirmPwd) {
      setError(isEnglish ? 'Please fill in all fields.' : '请填写所有字段');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError(isEnglish ? 'The new passwords do not match.' : '两次输入的新密码不一致');
      return;
    }
    if (newPwd.length < 6 || newPwd.length > 30) {
      setError(isEnglish ? 'Password length must be 6 to 30 characters.' : '密码长度应为6-30位');
      return;
    }
    if (!smsSent) {
      openDialog('no_sms');
      return;
    }
    if (!smsCode.trim()) {
      openDialog('empty_code');
      return;
    }
    if (smsCode.trim() !== generatedCode.current) {
      openDialog('wrong_code');
      return;
    }
    const result = changePassword(oldPwd, newPwd);
    if (!result.ok) {
      setError(result.reason === 'wrong_password'
        ? (isEnglish ? 'The current password is incorrect.' : '原密码错误')
        : (isEnglish ? 'Failed to change password.' : '修改失败'));
      return;
    }
    setSuccess(true);
    setTimeout(() => back(), 1500);
  };

  return (
    <div className="min-h-full bg-app-surface">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'Change password' : '修改密码'}</span>
      </div>

      <div className="h-1 bg-gray-100" />

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
          {isEnglish ? 'Password updated successfully.' : '密码修改成功！'}
        </div>
      )}

      <div className="px-4">
        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="w-[92px] text-base text-gray-900 whitespace-normal leading-tight">{isEnglish ? 'Current' : '原密码'}</span>
          <input
            type="password"
            placeholder={isEnglish ? 'Enter current password' : '请输入原密码'}
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            className="flex-1 text-base text-gray-500 outline-none ml-4"
          />
        </div>

        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="w-[92px] text-base text-gray-900 whitespace-normal leading-tight">{isEnglish ? 'New' : '新密码'}</span>
          <input
            type="password"
            placeholder={isEnglish ? '6-30 chars: letters, numbers, or "_"' : '字母、数字或"_"组合，6-30位'}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="flex-1 text-base text-gray-500 outline-none ml-4"
          />
        </div>

        <div className="flex items-center py-4 border-b border-gray-100">
          <span className="w-[92px] text-base text-gray-900 whitespace-normal leading-tight">{isEnglish ? 'Confirm' : '密码确认'}</span>
          <input
            type="password"
            placeholder={isEnglish ? 'Re-enter the new password' : '请再次输入密码'}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            className="flex-1 text-base text-gray-500 outline-none ml-4"
          />
        </div>

        <div className="flex items-center py-4 border-b border-gray-100">
          <input
            type="text"
            placeholder={isEnglish ? 'Enter the SMS code' : '输入获取的短信验证码'}
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            className="flex-1 text-base text-gray-500 outline-none"
          />
          <button
            onClick={sendSmsCode}
            disabled={cooldownSec > 0}
            className={`ml-4 px-4 py-2.5 rounded-lg text-white text-sm whitespace-normal leading-tight ${cooldownSec > 0 ? 'bg-gray-400' : 'bg-app-primary'}`}
          >
            {cooldownSec > 0 ? (isEnglish ? `Retry in ${cooldownSec}s` : `${cooldownSec}秒后重试`) : (isEnglish ? 'Get code' : '获取验证码')}
          </button>
        </div>
      </div>

      <div className="px-4 mt-4">
        <button
          onClick={handleSubmit}
          className="w-full py-3 bg-[#6BB5FD] rounded-lg text-white text-lg font-medium"
        >
          {isEnglish ? 'Confirm' : '确定'}
        </button>
      </div>

      {dialogKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl w-[300px] overflow-hidden">
            <div className="text-center text-[16px] text-[#333] font-bold pt-5 pb-2">
              {isEnglish ? 'Notice' : '温馨提示'}
            </div>
            <div className="text-center text-[14px] text-[#666] px-6 pb-5 leading-[22px] whitespace-pre-line">
              {DIALOG_MESSAGES[dialogKey]}
            </div>
            <button
              className="w-full py-3.5 text-[15px] text-white font-medium bg-[#4FA4F7] active:bg-[#3B8DE5] border-t border-[#F0F2F5] rounded-b-xl"
              onClick={() => back()}
            >
              {isEnglish ? 'OK' : '确定'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
