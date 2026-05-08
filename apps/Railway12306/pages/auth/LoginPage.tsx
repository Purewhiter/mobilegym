import React, { useState } from 'react';
import { useAppNavigate } from '../../navigation';
import { useRailwayStore } from '../../state';
import { useRailwayGestures } from '../../hooks/useRailwayGestures';
import { IcNavBack } from '../../res/icons';

export const RailwayLoginPage: React.FC = () => {
  const { go } = useAppNavigate();
  const { bindBack } = useRailwayGestures();
  const { login } = useRailwayStore();
  const [tab, setTab] = useState<'account' | 'fingerprint'>('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showNotice, setShowNotice] = useState(true);
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!username) return;
    setError('');
    const res = login(username, password || undefined);
    if (!res.ok) {
      setError(res.reason === 'wrong_password' ? '密码错误' : res.reason === 'no_account' ? '账号不存在' : '登录失败');
      return;
    }
    go('auth.login.success');
  };

  const canSubmit = tab === 'account' ? Boolean(username.trim() && password) : Boolean(username.trim());

  return (
    <div data-status-bar-foreground="light" className="h-full w-full relative bg-white overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#f4f7fb] via-white to-white" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,rgba(0,120,255,0.18),transparent_40%),radial-gradient(circle_at_70%_30%,rgba(0,120,255,0.10),transparent_45%)]" />
      </div>

      <div className="relative h-full flex flex-col">
        <div className="pt-10 min-h-[48px] flex items-center px-4">
          <button {...bindBack()} className="p-2 -ml-2">
            <IcNavBack size={22} className="text-gray-800" />
          </button>
        </div>

        <div className="flex-1 px-8 pt-2 flex flex-col items-center">
          <div className="mt-2 mb-6 flex flex-col items-center">
            <div className="w-16 h-16 rounded-[18px] bg-white shadow-[0_6px_18px_rgba(0,0,0,0.08)] flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-[#0b5bd3] flex items-center justify-center text-white text-[10px] font-bold">
                中国铁路
              </div>
            </div>
            <div className="mt-5 text-[22px] font-medium text-gray-900">欢迎登录</div>
          </div>

          <div className="flex items-center text-[13px] mb-5">
            <button
              className={`${tab === 'account' ? 'text-[#1b77ff]' : 'text-gray-400'}`}
              onClick={() => setTab('account')}
            >
              账号登录
            </button>
            <div className="mx-4 text-gray-300">|</div>
            <button
              className={`${tab === 'fingerprint' ? 'text-[#1b77ff]' : 'text-gray-400'}`}
              onClick={() => setTab('fingerprint')}
            >
              指纹登录
            </button>
          </div>

          <div className="w-full space-y-3">
            <div className="h-11 bg-white/90 border border-gray-200 rounded-md px-3 flex items-center">
              <div className="w-12 text-[13px] text-gray-600">用户</div>
              <div className="w-px h-4 bg-gray-200 mr-3" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名/邮箱/手机号码"
                className="flex-1 bg-transparent outline-none text-[14px] text-gray-900 placeholder-gray-300"
              />
            </div>

            <div className="h-11 bg-white/90 border border-gray-200 rounded-md px-3 flex items-center">
              <div className="w-12 text-[13px] text-gray-600">密码</div>
              <div className="w-px h-4 bg-gray-200 mr-3" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="登录密码"
                type="password"
                className="flex-1 bg-transparent outline-none text-[14px] text-gray-900 placeholder-gray-300"
              />
            </div>

            <div className="flex justify-end">
              <button className="text-[12px] text-gray-400" onClick={() => go('auth.forgotPassword.open')}>忘记密码？</button>
            </div>
          </div>

          <div className="w-full mt-6 space-y-3">
            <button
              onClick={handleLogin}
              disabled={!canSubmit}
              className={`w-full h-11 rounded-md text-[15px] font-medium ${canSubmit ? 'bg-[#1b77ff] text-white active:bg-[#196be6]' : 'bg-[#cfe2ff] text-white'}`}
            >
              登录
            </button>
            <button
              onClick={() => go('auth.register.open')}
              className="w-full h-11 rounded-md text-[15px] font-medium bg-white border border-gray-200 text-gray-600 active:bg-gray-50"
            >
              注册
            </button>
          </div>

          {error ? (
            <div className="w-full mt-3 text-[12px] text-red-500">{error}</div>
          ) : null}

          <div className="mt-6 text-[12px] text-[#1b77ff] flex gap-4">
            <button>《服务条款》</button>
            <button>《隐私权政策》</button>
          </div>
        </div>

        {showNotice ? (
          <div className="absolute left-0 right-0 bottom-0 px-3 pb-3">
            <div className="bg-[#fff7c2] border border-[#f2e287] text-[#6b5b00] rounded-md px-3 py-2 flex items-start gap-2">
              <div className="text-[12px] leading-5 flex-1">
                铁路12306每日05:00至次日01:00（周二为05:00至24:00）提供购票、改签、变更到站业务办理，全天均可办理退票等其他服务。
              </div>
              <button
                className="text-[14px] leading-4 text-[#6b5b00] px-1"
                onClick={() => setShowNotice(false)}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RailwayLoginPage;
