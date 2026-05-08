import React, { useEffect, useState } from 'react';
import { IcEye, IcEyeOff, IcNavBack } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const CreatePasswordPage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(password.length >= 10);
  }, [password]);

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 animate-in fade-in duration-300 relative">
      <div className="flex items-center justify-center relative w-full pt-6 mb-8">
        <button
          {...bindBack()}
          className="absolute left-0 p-1 -ml-2"
        >
          <IcNavBack className="text-white" size={32} />
        </button>
        <h1 className="text-base font-bold text-white">{s.create_account_title}</h1>
      </div>

      <div className="flex flex-col gap-2 mt-4">
        <h2 className="text-3xl font-bold mb-2">{s.create_password_title}</h2>

        <div className="relative w-full">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 bg-[#2A2A2A] text-white font-bold px-4 pr-12 rounded border-0 outline-none focus:bg-[#333333] transition-colors caret-[#1ED760]"
            autoFocus
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-0 h-full px-4 text-app-text-muted flex items-center justify-center"
          >
            {showPassword ? <IcEyeOff size={24} /> : <IcEye size={24} />}
          </button>
        </div>

        <div className="text-[11px] text-white font-medium mt-1">
          {s.create_password_hint}
        </div>

        <div className="flex items-center justify-center mt-8">
          <button
            disabled={!isValid}
            className={`px-8 py-3 rounded-full text-base font-bold transition-colors ${isValid
              ? 'bg-white text-black scale-100'
              : 'bg-[#535353] text-app-text-muted cursor-not-allowed'
            }`}
            {...(isValid ? bindTap('auth.signup.date.open') : {})}
          >
            {s.create_account_next}
          </button>
        </div>
      </div>
    </div>
  );
};
