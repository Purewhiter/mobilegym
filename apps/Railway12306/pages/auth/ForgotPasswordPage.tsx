import React, { useState, useEffect } from 'react';
import { useAppNavigate } from '../../navigation';
import { useRailwayStore } from '../../state';
import { useRailwayGestures } from '../../hooks/useRailwayGestures';
import { IcNavBack, IcExpand } from '../../res/icons';

export const ForgotPasswordPage: React.FC = () => {
  const { go } = useAppNavigate();
  const { bindBack } = useRailwayGestures();
  const { requestResetCode, resetPasswordWithCode } = useRailwayStore();
  const [tab, setTab] = useState<'face' | 'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [idType, setIdType] = useState('中国居民身份证');
  const [idNo, setIdNo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [codeCooldownSec, setCodeCooldownSec] = useState(0);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (codeCooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCodeCooldownSec(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [codeCooldownSec]);

  const handleSubmit = () => {
    setError('');
    if (!phone.trim()) {
      setError('请输入手机号码');
      return;
    }
    if (!idNo.trim()) {
      setError('请输入证件号码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      setError('密码长度至少6位');
      return;
    }
    if (!verificationCode.trim()) {
      setError('请输入验证码');
      return;
    }
    const res = resetPasswordWithCode(phone.trim(), idNo.trim(), verificationCode.trim(), newPassword);
    if (res.ok) {
      setError('');
      alert('密码重置成功');
      go('auth.forgotPassword.done');
    } else {
      const msgMap: Record<string, string> = {
        'no_account': '账号不存在',
        'id_mismatch': '证件号码不匹配',
        'no_code': '请先获取验证码',
        'code_used': '验证码已使用',
        'code_expired': '验证码已过期',
        'code_wrong': '验证码错误',
        'invalid_password': '密码格式不正确',
      };
      setError(msgMap[res.reason || ''] || '重置失败');
    }
  };

  const handleGetCode = () => {
    if (!phone.trim()) {
      setError('请先输入手机号码');
      return;
    }
    setError('');
    requestResetCode(phone.trim());
    setCodeSent(true);
    setCodeCooldownSec(60);
  };

  return (
    <div className="h-full w-full bg-[#f2f2f2] flex flex-col font-sans">
      {/* Header */}
      <div className="bg-app-primary pt-10 pb-3 min-h-[48px] flex items-center px-2 text-white relative">
        <button {...bindBack()} className="p-2">
          <IcNavBack size={24} className="text-white" />
        </button>
        <div className="flex-1 text-center text-lg font-medium pr-10">找回密码</div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white text-[15px] border-b border-gray-200">
        <button
          className={`flex-1 py-3 text-center ${tab === 'face' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          onClick={() => setTab('face')}
        >
          人脸识别
        </button>
        <button
          className={`flex-1 py-3 text-center ${tab === 'phone' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          onClick={() => setTab('phone')}
        >
          手机号码
        </button>
        <button
          className={`flex-1 py-3 text-center ${tab === 'email' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          onClick={() => setTab('email')}
        >
          电子邮件
        </button>
      </div>

      {tab === 'phone' && (
        <div className="mt-2 bg-white px-4">
          {/* Phone */}
          <div className="flex items-center h-12 border-b border-gray-100">
            <span className="w-24 text-[15px] text-gray-600">手机号码</span>
            <span className="text-[15px] text-gray-800 mr-2 flex items-center gap-0.5">
              +86 <IcExpand size={14} className="text-gray-400 shrink-0" />
            </span>
            <input
              type="text"
              placeholder="输入使用的手机号码"
              className="flex-1 text-[15px] outline-none placeholder-gray-400"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* ID Type */}
          <div className="flex items-center h-12 border-b border-gray-100 justify-between">
            <span className="w-24 text-[15px] text-gray-600">证件类型</span>
            <span className="text-[15px] text-gray-800 flex-1">{idType}</span>
            <span className="text-gray-400 text-lg">&gt;</span>
          </div>

          {/* ID Number */}
          <div className="flex items-center h-12 border-b border-gray-100">
            <span className="w-24 text-[15px] text-gray-600">证件号码</span>
            <input
              type="text"
              placeholder="请准确完整填写"
              className="flex-1 text-[15px] outline-none placeholder-gray-400"
              value={idNo}
              onChange={(e) => setIdNo(e.target.value)}
            />
          </div>

          {/* New Password */}
          <div className="flex items-center h-12 border-b border-gray-100">
            <span className="w-24 text-[15px] text-gray-600">新 密 码</span>
            <input
              type="password"
              placeholder={'字母、数字或"_"组合，6-30位'}
              className="flex-1 text-[15px] outline-none placeholder-gray-400"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          {/* Confirm Password */}
          <div className="flex items-center h-12 border-b border-gray-100">
            <span className="w-24 text-[15px] text-gray-600">密码确认</span>
            <input
              type="password"
              placeholder="请再次输入密码"
              className="flex-1 text-[15px] outline-none placeholder-gray-400"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Verification Code */}
          <div className="flex items-center h-12">
            <input
              type="text"
              placeholder="输入获取的短信验证码"
              className="flex-1 text-[15px] outline-none placeholder-gray-400"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <button
              className={`text-[13px] px-4 py-1.5 rounded ${
                phone.trim() && codeCooldownSec === 0
                  ? 'bg-app-primary text-white active:opacity-90'
                  : 'bg-gray-200 text-gray-400'
              }`}
              onClick={handleGetCode}
              disabled={!phone.trim() || codeCooldownSec > 0}
            >
              {codeCooldownSec > 0 ? `${codeCooldownSec}秒后重新获取` : '获取验证码'}
            </button>
          </div>
          {codeSent && !error && (
            <div className="text-[12px] text-green-600 py-1">验证码已发送到您的手机</div>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 mt-3">
          <div className="text-[13px] text-red-500">{error}</div>
        </div>
      )}

      <div className="px-4 mt-8">
        <button
          className="w-full bg-app-primary text-white text-[16px] py-2.5 rounded active:opacity-90"
          onClick={handleSubmit}
        >
          提交
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
