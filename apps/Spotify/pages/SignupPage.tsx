import React from 'react';
import { IcMail, IcNavBack, SpotifyLogoIcon } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.21.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    <path d="M1 1h22v22H1z" fill="none" />
  </svg>
);

export const SignupPage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 animate-in fade-in duration-300 relative">
      <div className="flex items-center w-full pt-6 mb-4">
        <button
          {...bindBack()}
          className="p-1 -ml-2"
        >
          <IcNavBack className="text-white" size={32} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 -mt-16">
        <div className="mb-4">
          <SpotifyLogoIcon size={56} fill="white" />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold">{s.signup_start_listening}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        <button
          className="w-full bg-app-primary text-black font-bold py-3 px-8 rounded-full text-[15px] active:scale-95 transition-transform flex items-center justify-center relative"
          {...bindTap('auth.signup.email.open')}
        >
          <span className="absolute left-4">
            <IcMail className="text-black" size={24} />
          </span>
          <span className="flex-1 text-center">{s.signup_continue_email}</span>
        </button>

        <button
          className="w-full bg-transparent border border-[#7F7F7F] text-white font-bold py-3 px-8 rounded-full text-[15px] active:scale-95 transition-transform flex items-center justify-center relative"
          onClick={() => console.log('Google signup')}
        >
          <span className="absolute left-4">
            <GoogleIcon />
          </span>
          <span className="flex-1 text-center">{s.signup_continue_google}</span>
        </button>

        <div className="mt-4 text-center">
          <div className="text-white text-base font-bold">{s.signup_have_account}</div>
          <div className="text-white text-base font-bold mt-1">{s.signup_login}</div>
        </div>
      </div>
    </div>
  );
};
