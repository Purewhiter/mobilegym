import React from 'react';
import { IcClose, SpotifyLogoIcon } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const LoginLandingPage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 animate-in fade-in duration-300 relative">
      <div className="flex items-center justify-center relative w-full mb-4">
        <h1 className="text-base font-bold text-white">{s.login_add_account}</h1>
        <button
          {...bindBack()}
          className="absolute right-0 p-1"
        >
          <IcClose className="text-white" size={24} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 -mt-24">
        <div className="mb-4">
          <SpotifyLogoIcon size={64} fill="white" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold leading-tight">{s.login_hero_line1}</h1>
          <h1 className="text-3xl font-bold leading-tight">{s.login_hero_line2}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <button
          className="w-full bg-app-primary text-black font-bold py-3.5 rounded-full text-base active:scale-95 transition-transform"
          {...bindTap('auth.signup.open')}
        >
          {s.login_signup_free}
        </button>

        <button
          className="w-full bg-transparent border border-gray-500 text-white font-bold py-3.5 rounded-full text-base active:scale-95 transition-transform"
          onClick={() => console.log('Login clicked')}
        >
          {s.login_sign_in}
        </button>
      </div>

      <div className="text-[11px] text-[#A7A7A7] text-center px-4 leading-normal pb-4">
        {s.login_device_warning}
      </div>
    </div>
  );
};
