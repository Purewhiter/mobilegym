import React, { useState } from 'react';
import { IcCheck, IcNavBack } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../state';

const Checkbox = ({
  label,
  checked,
  onChange,
  isLink,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  isLink?: boolean;
}) => (
  <div className="flex items-center justify-between py-3" onClick={onChange}>
    <div className="flex-1 pr-4">
      {isLink ? (
        <div className="text-xs font-bold text-app-primary">{label}</div>
      ) : (
        <div className="text-xs font-bold text-white leading-tight">{label}</div>
      )}
    </div>
    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-app-primary border-app-primary' : 'border-[#7F7F7F]'}`}>
      {checked && <IcCheck size={16} className="text-black" strokeWidth={3} />}
    </div>
  </div>
);

export const CreateNamePage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const addAccount = useSpotifyStore((state) => state.addAccount);
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [shareData, setShareData] = useState(false);

  const isValid = name.length > 0 && termsAccepted;

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      data-keep-keyboard
      className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 animate-in fade-in duration-300 relative overflow-y-auto scrollbar-hide"
    >
      <div className="flex items-center justify-center relative w-full pt-6 mb-4 flex-shrink-0">
        <button
          {...bindBack()}
          className="absolute left-0 p-1 -ml-2"
        >
          <IcNavBack className="text-white" size={32} />
        </button>
        <h1 className="text-base font-bold text-white">{s.create_account_title}</h1>
      </div>

      <div className="flex flex-col gap-2 mt-2 pb-8 flex-1">
        <h2 className="text-3xl font-bold mb-2">{s.create_name_title}</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-12 bg-[#2A2A2A] text-white font-bold px-4 rounded border-0 outline-none focus:bg-[#333333] transition-colors caret-[#1ED760]"
          autoFocus
        />
        <div className="text-[11px] text-white font-medium mt-1">
          {s.create_name_profile_hint}
        </div>

        <div className="w-full h-[1px] bg-[#2A2A2A] my-4" />

        <div className="flex flex-col gap-1 flex-1">
          <div className="bg-[#7F7F7F] self-start px-2 py-1 rounded text-[10px] font-bold text-black mb-2">
            {s.create_name_required}
          </div>

          <div className="text-[11px] text-white mb-1">
            {s.create_name_personalized}
          </div>

          <Checkbox
            label={s.create_name_terms_agree}
            checked={termsAccepted}
            onChange={() => setTermsAccepted(!termsAccepted)}
          />

          <div className="text-[11px] text-app-primary font-bold mt-1 mb-4">
            {s.create_name_terms}
          </div>

          <div className="text-[11px] text-white leading-tight mb-2">
            {s.create_name_privacy_notice}
          </div>

          <div className="text-[11px] text-app-primary font-bold mb-4 mt-2">
            {s.create_name_privacy_policy}
          </div>

          <Checkbox
            label={s.create_name_no_marketing}
            checked={marketingOptOut}
            onChange={() => setMarketingOptOut(!marketingOptOut)}
          />

          <Checkbox
            label={s.create_name_share_data}
            checked={shareData}
            onChange={() => setShareData(!shareData)}
          />

          <div className="flex items-center justify-center mt-auto pt-8 mb-4">
            <button
              className={`px-8 py-3 rounded-full text-base font-bold transition-transform active:scale-95 ${isValid ? 'bg-white text-black' : 'bg-[#535353] text-app-text-muted'
                }`}
              {...(isValid
                ? bindTap('auth.signup.artists.open', {
                    onTrigger: () => {
                      console.log('Create Account', { name, termsAccepted, marketingOptOut, shareData });
                      addAccount(name);
                    },
                  })
                : {})}
            >
              {s.create_name_create_account}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
