import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRailwayStore } from '../../state';
import { useRailwayGestures } from '../../hooks/useRailwayGestures';
import { IcNavBack } from '../../res/icons';
import SmsGateway from '@/os/SmsGateway';

export interface RegisterFormState {
  username: string;
  password: string;
  name: string;
  idNo: string;
  phone: string;
  email: string;
}

const RegisterVerifyPage: React.FC = () => {
  const { back, bindBack } = useRailwayGestures();
  const registerAccount = useRailwayStore(s => s.registerAccount);
  const location = useLocation();
  const formData = (location.state as RegisterFormState | undefined) ?? {
    username: '', password: '', name: '', idNo: '', phone: '', email: '',
  };

  const verifyCode = useMemo(
    () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join(''),
    [],
  );

  const [inputCode, setInputCode] = useState('');
  const [dialogMsg, setDialogMsg] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const codeRef = useRef(verifyCode);
  codeRef.current = verifyCode;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.to === '12306' && String(detail?.content).trim() === '999') {
        setSmsSent(true);
        setTimeout(() => {
          SmsGateway.receiveMessage({
            from: '12306',
            body: `【铁路12306】您的注册验证码为${codeRef.current}，请在10分钟内完成验证。`,
          });
        }, 1500);
      }
    };
    window.addEventListener('sms-outgoing', handler);
    return () => window.removeEventListener('sms-outgoing', handler);
  }, []);

  const handleSendSms = useCallback(() => {
    // 真机做法：发 ACTION_VIEW + scheme=sms intent，让系统找匹配的短信 App 处理。
    // 加 { newTask: true }（≈ FLAG_ACTIVITY_NEW_TASK）让 SMS 进入自己的独立 task，
    // 这样多任务里 SMS 是独立窗口，用户在 /new 单步 back 后 SMS task 关闭并返回 12306。
    // 不加 newTask 会走 same-task push，SMS Activity 嵌进 12306 task — 与真机行为不符。
    window.__OS__?.startActivity(
      {
        action: 'ACTION_VIEW',
        scheme: 'sms',
        data: { address: '12306', body: '999' },
      },
      { newTask: true },
    );
  }, []);

  const handleComplete = () => {
    if (!smsSent) {
      setDialogMsg('请先发送注册短信!');
      return;
    }
    if (inputCode !== verifyCode) {
      setDialogMsg('验证码错误，请重新输入!');
      return;
    }
    const res = registerAccount({
      username: formData.username,
      password: formData.password,
      name: formData.name,
      idNo: formData.idNo,
      phone: formData.phone,
      email: formData.email,
    });
    if (!res.ok) {
      setDialogMsg(res.reason === 'exists' ? '该用户名或手机号已被注册!' : '注册失败');
      return;
    }
    back();
    setTimeout(() => back(), 50);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {/* Header */}
      <div className="bg-app-primary pt-10 pb-3 min-h-[48px] flex items-center px-4 text-white">
        <button {...bindBack()} className="p-2 -ml-2">
          <IcNavBack size={24} className="text-white" />
        </button>
        <div className="flex-1 text-center text-[18px] font-medium pr-8">信息验证</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-5">
        {/* Instructions */}
        <div className="mb-4">
          <div className="flex items-start gap-1 mb-3">
            <span className="text-red-500 text-[14px] mt-0.5">*</span>
            <span className="text-[14px] text-[#333] font-medium">请按以下程序进行手机双向核验：</span>
          </div>
          <div className="text-[13px] text-[#555] leading-relaxed">
            <p className="mb-2">
              第一步：请您用手机<span className="text-app-primary font-medium">(+86){formData.phone}</span> 发送短信999至12306，以便确认您的手机可以联络。
            </p>
            <p>
              第二步：12306接到您的短信后将给您的手机回复六位数字短信，请您在十分钟内将六位数字短信填写在下方空白框中，并点击完成注册按钮。现在请先您发送999短信，并等候我们的回复。
            </p>
          </div>
        </div>

        {/* Send SMS link */}
        <div className="flex justify-end mb-6">
          <button className="text-app-primary text-[14px]" onClick={handleSendSms}>
            发送注册短信
          </button>
        </div>

        {/* Verification code input */}
        <div className="border-t border-gray-200 py-4 flex items-center bg-gray-100 rounded px-3">
          <label className="text-[14px] text-[#333] w-[72px] shrink-0">验证码：</label>
          <input
            className="flex-1 outline-none text-[16px] text-[#333] placeholder-gray-400 tracking-widest"
            placeholder="请输入验证码"
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            maxLength={6}
          />
        </div>

        {/* Complete button */}
        <div className="mt-6">
          <button
            className="w-full h-11 rounded bg-app-primary text-white font-medium text-[16px] active:opacity-80"
            onClick={handleComplete}
          >
            完成注册
          </button>
        </div>
      </div>

      {/* Error dialog */}
      {dialogMsg && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-xl w-full max-w-[280px] overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[16px] font-bold text-[#2B3038]">温馨提示</p>
              <p className="mt-3 text-[14px] text-[#333] leading-relaxed">{dialogMsg}</p>
            </div>
            <button
              className="w-full py-3 text-[16px] text-white font-medium bg-[#4B9AFF] rounded-b-xl"
              onClick={() => setDialogMsg(null)}
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisterVerifyPage;
