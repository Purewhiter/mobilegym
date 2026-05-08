import React, { useState } from 'react';
import { useWechatStore } from '../../state';
import { IcClose, IcNavForward, IcCamera } from '../../res/icons';
import { useAppNavigate } from '../../navigation';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '@/os/locale';

export const WechatRegisterPage: React.FC = () => {
  const { go } = useAppNavigate();
  const { bindBack } = useWechatGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const auth = useWechatStore(s => s.auth);
  const requestVerificationCode = useWechatStore(s => s.requestVerificationCode);
  const registerAccount = useWechatStore(s => s.registerAccount);

  const [step, setStep] = useState<'method' | 'form'>('method');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [realName, setRealName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [confirmPhoneOpen, setConfirmPhoneOpen] = useState(false);
  const [codeCooldownSec, setCodeCooldownSec] = useState(0);

  const text = isEnglish
    ? {
        chooseMethod: 'Choose Sign-up Method',
        signUpNewPhone: 'Sign up with a new phone number',
        verifyNewPhone: 'Requires SMS verification for the new number',
        assistSignUp: 'Use the current WeChat phone number to assist sign-up',
        assistPhoneHint: 'Requires SMS verification for Hao Rui\'s phone number',
        help: 'Help',
        phoneSignUp: 'Sign up with phone number',
        nickname: 'Nickname',
        enterNickname: 'Enter nickname',
        countryRegion: 'Country/Region',
        mainlandChina: 'China Mainland (+86)',
        phoneNumber: 'Phone Number',
        enterPhoneNumber: 'Enter phone number',
        phoneForLoginOnly: 'This phone number is only used for login verification',
        verificationCode: 'Verification Code',
        enterVerificationCode: 'Enter verification code',
        resendCode: (seconds: number) => `Resend (${seconds}s)`,
        getCode: 'Get Code',
        password: 'Password',
        setPassword: 'Set password',
        realName: 'Full Name',
        enterRealName: 'Enter your real name',
        idNumber: 'ID Number',
        enterIdNumber: 'Enter ID number',
        agreementPrefix: 'I have read and agree to',
        agreement: 'Software License and Service Agreement',
        agreementHint: 'The information collected on this page is only used to register an account',
        agreeContinue: 'Agree & Continue',
        confirmPhone: 'Confirm phone number',
        sendCodePrompt: 'We will send a verification SMS to:',
        cancel: 'Cancel',
        confirm: 'OK',
      }
    : {
        chooseMethod: '选择注册方式',
        signUpNewPhone: '通过新手机号注册',
        verifyNewPhone: '需要短信验证新的手机号',
        assistSignUp: '通过当前微信的手机号辅助注册',
        assistPhoneHint: '需要短信验证"郝锐"的手机号',
        help: '帮助',
        phoneSignUp: '用手机号注册',
        nickname: '昵称',
        enterNickname: '请填写昵称',
        countryRegion: '国家/地区',
        mainlandChina: '中国大陆（+86）',
        phoneNumber: '手机号',
        enterPhoneNumber: '请填写手机号码',
        phoneForLoginOnly: '上述手机号仅用于登录验证',
        verificationCode: '验证码',
        enterVerificationCode: '请填写验证码',
        resendCode: (seconds: number) => `再次发送（${seconds}秒后）`,
        getCode: '获取验证码',
        password: '密码',
        setPassword: '请设置密码',
        realName: '姓名',
        enterRealName: '请输入真实姓名',
        idNumber: '身份证',
        enterIdNumber: '请输入身份证号',
        agreementPrefix: '我已阅读并同意',
        agreement: '《软件许可及服务协议》',
        agreementHint: '本页面收集的信息仅用于注册账号',
        agreeContinue: '同意并继续',
        confirmPhone: '确认手机号码',
        sendCodePrompt: '我们将发送验证码短信到下面的号码：',
        cancel: '取消',
        confirm: '确定',
      };

  const submit = () => {
    setError('');
    const res = registerAccount({
      phone: phone.trim(),
      password: password.trim(),
      code: verificationCode.trim(),
      realName: realName.trim(),
      idNumber: idNumber.trim(),
      expiresInSec: 1800,
    });

    if (!res.ok) {
      setError(res.reason || 'register_failed');
      return;
    }
    go('auth.register.success');
  };

  const phoneTrimmed = phone.trim();
  const handleGetCode = () => setConfirmPhoneOpen(true);
  const confirmSendCode = () => {
    setConfirmPhoneOpen(false);
    const len = Number(auth?.verificationCodeLength || 6) || 6;
    const exp = Number(auth?.verificationCodeExpirySec || 60) || 60;
    requestVerificationCode(phoneTrimmed, len, exp);
    setCodeCooldownSec(60);
  };

  React.useEffect(() => {
    if (codeCooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCodeCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeCooldownSec]);

  if (step === 'method') {
    return (
      <div className="h-full bg-white flex flex-col pt-10">
        <div className="h-12 flex items-center px-4">
          <button {...bindBack()} className="p-2 -ml-2">
            <IcNavForward size={22} className="text-black rotate-180" />
          </button>
          <div className="flex-1 text-center text-[18px] font-medium text-black pr-8">{text.chooseMethod}</div>
        </div>

        <div className="px-4 pt-2">
          <div className="border-t border-gray-100" />
        </div>

        <div className="flex-1 px-4">
          <button
            className="w-full flex items-center justify-between py-5 border-b border-gray-100 active:bg-gray-50"
            onClick={() => setStep('form')}
          >
            <div className="flex flex-col items-start">
              <div className="text-[16px] text-black">{text.signUpNewPhone}</div>
              <div className="text-[12px] text-gray-400 mt-1">{text.verifyNewPhone}</div>
            </div>
            <IcNavForward size={18} className="text-gray-300" />
          </button>

          <button className="w-full flex items-center justify-between py-5 border-b border-gray-100 active:bg-gray-50">
            <div className="flex flex-col items-start">
              <div className="text-[16px] text-black">{text.assistSignUp}</div>
              <div className="text-[12px] text-gray-400 mt-1">{text.assistPhoneHint}</div>
            </div>
            <IcNavForward size={18} className="text-gray-300" />
          </button>
        </div>

        <div className="pb-10 text-center">
          <button className="text-[14px] text-[#576b95]">{text.help}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white flex flex-col pt-10">
      <div className="h-12 flex items-center px-4">
        <button onClick={() => setStep('method')} className="p-2 -ml-2">
          <IcClose size={24} className="text-black" />
        </button>
        <div className="flex-1 text-center text-[18px] font-medium text-black pr-8">{text.phoneSignUp}</div>
      </div>

      <div className="flex-1 px-8 pt-4">
        <div className="flex justify-center mt-2 mb-8">
          <div className="w-14 h-14 bg-gray-200 flex items-center justify-center">
            <IcCamera size={26} className="text-white" />
          </div>
        </div>

        <div>
          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.nickname}</div>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={text.enterNickname}
              className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
            />
          </div>

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.countryRegion}</div>
            <div className="flex-1 text-[16px] text-gray-500">{text.mainlandChina}</div>
          </div>

          <div className="border-b border-gray-200 py-3">
            <div className="flex items-center">
              <div className="w-24 text-[16px] text-black">{text.phoneNumber}</div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={text.enterPhoneNumber}
                className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
                inputMode="numeric"
              />
            </div>
            <div className="mt-2 text-[12px] text-gray-400">{text.phoneForLoginOnly}</div>
          </div>

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.verificationCode}</div>
            <input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder={text.enterVerificationCode}
              className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
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

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.password}</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={text.setPassword}
              className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
              type="password"
            />
          </div>

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.realName}</div>
            <input
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder={text.enterRealName}
              className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
            />
          </div>

          <div className="flex items-center border-b border-gray-200 py-3">
            <div className="w-24 text-[16px] text-black">{text.idNumber}</div>
            <input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={text.enterIdNumber}
              className="flex-1 text-[16px] text-black outline-none placeholder-gray-300 bg-transparent"
            />
          </div>
        </div>

        {error ? <div className="mt-4 text-[13px] text-red-500">{error}</div> : null}

        <div className="mt-10">
          <div className="flex items-start gap-2">
            <button
              className={`w-5 h-5 rounded-full border flex-shrink-0 mt-0.5 ${agreed ? 'bg-[#07C160] border-[#07C160]' : 'bg-white border-gray-300'}`}
              onClick={() => setAgreed(!agreed)}
            >
              {agreed ? <div className="w-full h-full flex items-center justify-center text-white text-[12px] leading-none">✓</div> : null}
            </button>
            <div className="text-[12px] text-gray-400 leading-5">
              {text.agreementPrefix} <span className="text-[#576b95]">{text.agreement}</span>
              <div>{text.agreementHint}</div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <button
              className={`w-[200px] h-12 rounded-md text-[16px] font-medium ${
                (nickname && phoneTrimmed && password && verificationCode.trim() && realName.trim() && idNumber.trim() && agreed)
                  ? 'bg-[#07C160] text-white active:bg-[#06ad56]'
                  : 'bg-[#E0E0E0] text-[#B2B2B2]'
              }`}
              onClick={submit}
              disabled={!(nickname && phoneTrimmed && password && verificationCode.trim() && realName.trim() && idNumber.trim() && agreed)}
            >
              {text.agreeContinue}
            </button>
          </div>
        </div>
      </div>

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

export default WechatRegisterPage;
