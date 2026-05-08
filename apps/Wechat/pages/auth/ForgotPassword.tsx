import React, { useEffect, useState } from 'react';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const WechatForgotPasswordPage: React.FC = () => {
  const { bindBack, back } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const auth = useWechatStore(s => s.auth);
  const requestVerificationCode = useWechatStore(s => s.requestVerificationCode);
  const resetPassword = useWechatStore(s => s.resetPassword);

  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmPhoneOpen, setConfirmPhoneOpen] = useState(false);
  const [codeCooldownSec, setCodeCooldownSec] = useState(0);

  const text = isEnglish
    ? {
        back: 'Back',
        title: 'Reset Password',
        phone: 'Phone Number',
        verificationCode: 'Verification Code',
        newPassword: 'New Password',
        resendCode: (seconds: number) => `Resend (${seconds}s)`,
        getCode: 'Get Code',
        submit: 'Set New Password',
        confirmPhone: 'Confirm phone number',
        sendCodePrompt: 'We will send a verification SMS to:',
        cancel: 'Cancel',
        confirm: 'OK',
        errors: {
          missingPhone: 'Please enter your phone number',
          codeWrong: 'Incorrect verification code',
          codeExpired: 'Verification code expired',
          codeSuperseded: 'Verification code expired. Please use the latest code.',
          codeUsed: 'Verification code already used',
          codeNoActive: 'Please request a verification code first',
          noAccount: 'Account does not exist',
          resetFailed: 'Failed to reset password',
        },
      }
    : {
        back: '返回',
        title: '找回密码',
        phone: '手机号',
        verificationCode: '验证码',
        newPassword: '新密码',
        resendCode: (seconds: number) => `再次发送（${seconds}秒后）`,
        getCode: '获取验证码',
        submit: '设置新密码',
        confirmPhone: '确认手机号码',
        sendCodePrompt: '我们将发送验证码短信到下面的号码：',
        cancel: '取消',
        confirm: '确定',
        errors: {
          missingPhone: '请填写手机号码',
          codeWrong: '验证码错误',
          codeExpired: '验证码已过期',
          codeSuperseded: '验证码已失效，请使用最新验证码',
          codeUsed: '验证码已使用',
          codeNoActive: '请先获取验证码',
          noAccount: '帐号不存在',
          resetFailed: '重置密码失败',
        },
      };

  const getErrorMsg = (reason?: string) => {
    const map: Record<string, string> = {
      missing_phone: text.errors.missingPhone,
      code_wrong: text.errors.codeWrong,
      code_expired: text.errors.codeExpired,
      code_superseded: text.errors.codeSuperseded,
      code_used: text.errors.codeUsed,
      code_no_active: text.errors.codeNoActive,
      no_account: text.errors.noAccount,
    };
    return map[reason || ''] || text.errors.resetFailed;
  };

  const requestCode = () => {
    setError('');
    if (!phone.trim()) {
      setError('missing_phone');
      return;
    }
    setConfirmPhoneOpen(true);
  };

  const confirmSendCode = () => {
    setConfirmPhoneOpen(false);
    const len = Number(auth?.verificationCodeLength || 6) || 6;
    const exp = Number(auth?.verificationCodeExpirySec || 60) || 60;
    requestVerificationCode(phone.trim(), len, exp);
    setCodeCooldownSec(60);
  };

  useEffect(() => {
    if (codeCooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCodeCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeCooldownSec]);

  const submit = () => {
    setError('');
    const res = resetPassword({
      phone: phone.trim(),
      code: verificationCode.trim(),
      newPassword: newPassword.trim(),
      expiresInSec: 1800,
    });
    if (!res.ok) {
      setError(res.reason || 'reset_failed');
      return;
    }
    back();
  };

  return (
    <div className="min-h-full bg-app-bg p-4">
      <div className="flex items-center gap-3 mb-6">
        <button className="px-3 py-2 bg-app-surface border border-(--app-c-tw-border-gray-100) rounded-md active:bg-(--app-c-tw-bg-gray-50)" {...bindBack<HTMLButtonElement>()}>
          {text.back}
        </button>
        <div className="text-(--app-title-text-size-18) font-bold text-app-text">{text.title}</div>
      </div>

      <div className="bg-app-surface rounded-xl border border-(--app-c-tw-border-gray-100) overflow-hidden">
        <div className="px-4 py-4 border-b border-(--app-c-tw-border-gray-100)">
          <div className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-500) mb-2">{text.phone}</div>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-transparent text-(--app-title-text-size-17) text-app-text outline-none" inputMode="numeric" />
        </div>
        <div className="px-4 py-4 border-b border-(--app-c-tw-border-gray-100)">
          <div className="flex items-center justify-between mb-2">
            <div className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-500)">{text.verificationCode}</div>
            <button
              className={`text-[14px] ${(!phone.trim() || codeCooldownSec > 0) ? 'text-(--app-c-tw-text-gray-400)' : 'text-app-primary active:opacity-80'}`}
              onClick={requestCode}
              disabled={!phone.trim() || codeCooldownSec > 0}
            >
              {codeCooldownSec > 0 ? text.resendCode(codeCooldownSec) : text.getCode}
            </button>
          </div>
          <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="w-full bg-transparent text-(--app-title-text-size-17) text-app-text outline-none" inputMode="numeric" />
        </div>
        <div className="px-4 py-4">
          <div className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-500) mb-2">{text.newPassword}</div>
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-transparent text-(--app-title-text-size-17) text-app-text outline-none" type="password" />
        </div>
      </div>

      {error ? (
        <div className="mt-3 text-[13px] text-red-500">{getErrorMsg(error)}</div>
      ) : null}

      <button className="mt-6 w-full h-12 rounded-xl bg-app-primary text-white font-medium active:opacity-90" onClick={submit}>
        {text.submit}
      </button>

      {confirmPhoneOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-[300px] rounded-lg overflow-hidden">
            <div className="p-6 text-center">
              <div className="text-lg font-medium text-black mb-2">{text.confirmPhone}</div>
              <div className="text-base text-gray-600 mb-1">{text.sendCodePrompt}</div>
              <div className="text-xl font-medium text-black">{phone.trim()}</div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                className="flex-1 h-12 text-base text-black active:bg-gray-50"
                onClick={() => setConfirmPhoneOpen(false)}
              >
                {text.cancel}
              </button>
              <div className="w-[1px] bg-gray-100"></div>
              <button
                className="flex-1 h-12 text-base text-[#576b95] font-medium active:bg-gray-50"
                onClick={confirmSendCode}
              >
                {text.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WechatForgotPasswordPage;
