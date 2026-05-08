import React, { useMemo, useState } from 'react';
import { useWechatStore } from '../../state';
import { CaptchaModal } from '../../components/CaptchaModal';
import { IcClose } from '../../res/icons';
import { useAppNavigate } from '../../navigation';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const WechatLoginPage: React.FC = () => {
  const { go } = useAppNavigate();
  const { bindBack } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const auth = useWechatStore(s => s.auth);
  const userPhone = useWechatStore(s => s.user.phone);
  const loginWithPassword = useWechatStore(s => s.loginWithPassword);
  const loginWithCode = useWechatStore(s => s.loginWithCode);
  const requestVerificationCode = useWechatStore(s => s.requestVerificationCode);

  const [phone, setPhone] = useState<string>(() => auth?.session?.phone || userPhone || '');
  const [password, setPassword] = useState<string>('');
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [error, setError] = useState<string>('');
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [confirmPhoneOpen, setConfirmPhoneOpen] = useState(false);
  const [codeCooldownSec, setCodeCooldownSec] = useState(0);

  const text = isEnglish
    ? {
        wrongPassword: 'Incorrect account or password. Please try again.',
        codeWrong: 'Incorrect verification code',
        codeExpired: 'Verification code expired',
        codeSuperseded: 'Verification code expired. Please use the latest code.',
        codeUsed: 'Verification code already used',
        codeNoActive: 'Please request a verification code first',
        noAccount: 'Account does not exist',
        locked: 'Account is locked. Please try again later',
        loginFailed: 'Login failed',
        title: 'Phone Number Login',
        countryRegion: 'Country/Region',
        mainlandChina: 'China Mainland (+86)',
        phoneNumber: 'Phone Number',
        enterPhoneNumber: 'Enter phone number',
        phoneForLoginOnly: 'This phone number is only used for login verification',
        otherLogin: 'Log in with WeChat ID / QQ / Email',
        password: 'Password',
        enterWechatPassword: 'Enter your WeChat password',
        verificationCode: 'Verification Code',
        enterVerificationCode: 'Enter verification code',
        resendCode: (seconds: number) => `Resend (${seconds}s)`,
        getCode: 'Get Code',
        smsLogin: 'Log in with SMS code',
        passwordLogin: 'Log in with password',
        login: 'Log In',
        agreeContinue: 'Agree & Continue',
        forgotPassword: 'Forgot Password',
        exportChatHistory: 'Export Chat History',
        more: 'More',
        confirmPhone: 'Confirm phone number',
        sendCodePrompt: 'We will send a verification SMS to:',
        cancel: 'Cancel',
        confirm: 'OK',
      }
    : {
        wrongPassword: '帐号或密码错误，请重新填写。',
        codeWrong: '验证码错误',
        codeExpired: '验证码已过期',
        codeSuperseded: '验证码已失效，请使用最新验证码',
        codeUsed: '验证码已使用',
        codeNoActive: '请先获取验证码',
        noAccount: '帐号不存在',
        locked: '帐号已锁定，请稍后再试',
        loginFailed: '登录失败',
        title: '手机号登录',
        countryRegion: '国家/地区',
        mainlandChina: '中国大陆（+86）',
        phoneNumber: '手机号',
        enterPhoneNumber: '请填写手机号码',
        phoneForLoginOnly: '上述手机号仅用于登录验证',
        otherLogin: '用微信号/QQ号/邮箱登录',
        password: '密码',
        enterWechatPassword: '请填写微信密码',
        verificationCode: '验证码',
        enterVerificationCode: '请填写验证码',
        resendCode: (seconds: number) => `再次发送（${seconds}秒后）`,
        getCode: '获取验证码',
        smsLogin: '用短信验证码登录',
        passwordLogin: '用密码登录',
        login: '登录',
        agreeContinue: '同意并继续',
        forgotPassword: '找回密码',
        exportChatHistory: '导出聊天记录',
        more: '更多',
        confirmPhone: '确认手机号码',
        sendCodePrompt: '我们将发送验证码短信到下面的号码：',
        cancel: '取消',
        confirm: '确定',
      };

  const getErrorMsg = (reason?: string): string => {
    const map: Record<string, string> = {
      'wrong_password': text.wrongPassword,
      'code_wrong': text.codeWrong,
      'code_expired': text.codeExpired,
      'code_superseded': text.codeSuperseded,
      'code_used': text.codeUsed,
      'code_no_active': text.codeNoActive,
      'no_account': text.noAccount,
      'locked': text.locked,
    };
    return map[reason || ''] || text.loginFailed;
  };

  const needCaptcha = useMemo(() => {
    const acc = (auth?.accounts || []).find(a => a.phone === phone);
    return Boolean(acc?.requireCaptcha);
  }, [auth?.accounts, phone]);

  const goTrust = (p: string) => go('auth.trustDevice.open', { phone: p });
  const goHome = () => go('auth.login.success');

  const handleLogin = () => {
    const p = phone.trim();
    if (!p) return;
    if (needCaptcha && !captchaPassed) {
      const res = mode === 'password'
        ? loginWithPassword({ phone: p, password })
        : loginWithCode({ phone: p, code: verificationCode });
      if (res.needsTrust) {
        setError('');
        goTrust(p);
        return;
      }
      if (res.reason === 'captcha_required') {
        setShowCaptchaModal(true);
        return;
      }
    }
    if (mode === 'password') {
      const res = loginWithPassword({ phone: p, password, captchaPassed: captchaPassed || undefined });
      if (res.ok) {
        setError('');
        goHome();
        return;
      }
      if (res.needsTrust) {
        setError('');
        goTrust(p);
        return;
      }
      setError(getErrorMsg(res.reason));
      return;
    }
    const res = loginWithCode({ phone: p, code: verificationCode, captchaPassed: captchaPassed || undefined });
    if (res.ok) {
      setError('');
      goHome();
      return;
    }
    if (res.needsTrust) {
      setError('');
      goTrust(p);
      return;
    }
    setError(getErrorMsg(res.reason));
  };

  const onCaptchaSuccess = () => {
    setShowCaptchaModal(false);
    setCaptchaPassed(true);
    setTimeout(() => {
      const p = phone.trim();
      const res = mode === 'password'
        ? loginWithPassword({ phone: p, password, captchaPassed: true })
        : loginWithCode({ phone: p, code: verificationCode, captchaPassed: true });
      if (res.ok) {
        goHome();
      } else if (res.needsTrust) {
        goTrust(p);
      } else {
        setError(getErrorMsg(res.reason));
      }
    }, 500);
  };

  const handleGetCode = () => {
    setConfirmPhoneOpen(true);
  };

  const confirmSendCode = () => {
    setConfirmPhoneOpen(false);
    const p = phone.trim();
    const len = Number(auth?.verificationCodeLength || 6) || 6;
    const exp = Number(auth?.verificationCodeExpirySec || 60) || 60;
    requestVerificationCode(p, len, exp);
    setCodeCooldownSec(60);
  };

  const phoneTrimmed = phone.trim();
  const showPasswordFields = Boolean(phoneTrimmed);
  const canLogin = mode === 'password' ? Boolean(phoneTrimmed && password) : Boolean(phoneTrimmed && verificationCode);

  React.useEffect(() => {
    if (codeCooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCodeCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeCooldownSec]);

  return (
    <div className="h-full bg-[#f2f2f2] flex flex-col pt-10">
      <div className="h-12 flex items-center px-4">
        <button {...bindBack()} className="p-2 -ml-2 shrink-0">
          <IcClose size={24} className="text-black" />
        </button>
      </div>

      <div className="flex-1 px-8 pt-8 flex flex-col">
        <div className="text-[18px] text-gray-800 text-center mb-10">{text.title}</div>

        <div>
          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[15px] text-gray-700">{text.countryRegion}</div>
            <div className="flex-1 text-[15px] text-gray-700">{text.mainlandChina}</div>
          </div>

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[15px] text-gray-700">{text.phoneNumber}</div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={text.enterPhoneNumber}
              className="flex-1 text-[15px] text-gray-800 outline-none placeholder-gray-300 bg-transparent"
              inputMode="numeric"
            />
          </div>

          {!showPasswordFields ? (
            <>
              <div className="mt-3 text-[12px] text-gray-400">{text.phoneForLoginOnly}</div>
              <div className="mt-4">
                <button className="text-[14px] text-[#576b95]">{text.otherLogin}</button>
              </div>
            </>
          ) : (
            <>
              {mode === 'password' ? (
                <div className="flex items-center border-b border-gray-200 py-3">
                  <div className="w-24 text-[15px] text-gray-700">{text.password}</div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={text.enterWechatPassword}
                    className="flex-1 text-[15px] text-gray-800 outline-none placeholder-gray-300 bg-transparent"
                    type="password"
                  />
                </div>
              ) : (
                <div className="flex items-center border-b border-gray-200 py-3">
                  <div className="w-24 text-[15px] text-gray-700">{text.verificationCode}</div>
                  <input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder={text.enterVerificationCode}
                    className="flex-1 text-[15px] text-gray-800 outline-none placeholder-gray-300 bg-transparent"
                    inputMode="numeric"
                  />
                  <button
                    onClick={handleGetCode}
                    disabled={!phoneTrimmed || codeCooldownSec > 0}
                    className={`ml-3 px-3 py-1.5 rounded text-[12px] ${
                      (phoneTrimmed && codeCooldownSec === 0) ? 'bg-gray-200 text-gray-600 active:bg-gray-300' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {codeCooldownSec > 0 ? text.resendCode(codeCooldownSec) : text.getCode}
                  </button>
                </div>
              )}

              <div className="mt-3">
                <button
                  className="text-[14px] text-[#576b95]"
                  onClick={() => setMode(mode === 'password' ? 'code' : 'password')}
                >
                  {mode === 'password' ? text.smsLogin : text.passwordLogin}
                </button>
              </div>
            </>
          )}
        </div>

        {error && <div className="mt-4 text-[13px] text-red-500">{error}</div>}

        <div className="mt-16">
          <button
            className={`w-full h-12 rounded-[8px] font-medium text-[16px] ${
              showPasswordFields
                ? canLogin
                  ? 'bg-[#07C160] text-white active:bg-[#06ad56]'
                  : 'bg-[#e0e0e0] text-[#b2b2b2]'
                : 'bg-[#e0e0e0] text-[#b2b2b2]'
            }`}
            onClick={showPasswordFields ? handleLogin : undefined}
            disabled={showPasswordFields ? !canLogin : true}
          >
            {showPasswordFields ? text.login : text.agreeContinue}
          </button>
        </div>

        <div className="mt-auto pb-8">
          <div className="flex items-center justify-center gap-6 text-[13px] text-[#576b95]">
            <button onClick={() => go('auth.forgotPassword.open')}>{text.forgotPassword}</button>
            <div className="w-px h-3 bg-gray-300" />
            <button>{text.exportChatHistory}</button>
            <div className="w-px h-3 bg-gray-300" />
            <button onClick={() => go('auth.devices.open', { phone: phoneTrimmed })}>{text.more}</button>
          </div>
        </div>
      </div>

      <CaptchaModal
        open={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        onSuccess={onCaptchaSuccess}
      />

      {confirmPhoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-[300px] rounded-lg overflow-hidden">
            <div className="p-6 text-center">
              <div className="text-lg font-medium text-black mb-2">{text.confirmPhone}</div>
              <div className="text-base text-gray-600 mb-1">{text.sendCodePrompt}</div>
              <div className="text-xl font-medium text-black">{phoneTrimmed}</div>
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
      )}
    </div>
  );
};

export default WechatLoginPage;
