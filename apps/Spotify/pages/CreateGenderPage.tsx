import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const CreateGenderPage: React.FC = () => {
  const { bindBack, bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const [selectedGender, setSelectedGender] = useState<string | null>(null);

  const genders = [
    s.create_gender_female,
    s.create_gender_male,
    s.create_gender_nonbinary,
    s.create_gender_other,
    s.create_gender_prefer_not,
  ];

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

      <div className="flex flex-col gap-4 mt-4">
        <h2 className="text-3xl font-bold mb-4">{s.create_gender_title}</h2>

        <div className="flex flex-wrap gap-3">
          {genders.map((gender) => (
            <button
              key={gender}
              onClick={() => setSelectedGender(gender)}
              className={`px-4 py-2 rounded-full border text-sm font-bold flex items-center gap-2 transition-colors ${selectedGender === gender
                ? 'bg-app-primary border-app-primary text-black'
                : 'bg-transparent border-[#7F7F7F] text-white hover:border-white'
              }`}
            >
              {gender}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center mt-12 mb-8">
          <button
            className={`px-8 py-3 rounded-full text-base font-bold transition-transform active:scale-95 ${selectedGender ? 'bg-white text-black' : 'bg-[#535353] text-app-text-muted'
              }`}
            {...(selectedGender
              ? bindTap('auth.signup.name.open', {
                  onTrigger: () => {
                    console.log('Gender selected:', selectedGender);
                  },
                })
              : {})}
          >
            {s.create_account_next}
          </button>
        </div>
      </div>
    </div>
  );
};
