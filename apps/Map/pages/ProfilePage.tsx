import React from 'react';
import {
  IcClose,
  IcUser,
  IcUsers,
  IcCloud,
  IcSettings,
  IcHelp,
} from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';

export const ProfilePage: React.FC = () => {
  const { go, bindBack } = useMapGestures();
  const s = useMapStrings();

  return (
    <div className="flex flex-col h-full bg-app-bg overflow-y-auto no-scrollbar font-sans">
      <div className="relative p-4 pt-12">
        <button
          {...bindBack()}
          className="absolute right-4 top-12 p-1 rounded-full text-gray-600 hover:bg-gray-200"
        >
          <IcClose size={24} />
        </button>
        <div className="w-full flex flex-col items-center pt-8 pb-6">
          <div className="text-[28px] font-bold text-gray-900 mb-6">Google</div>
          <button className="bg-[#0b57d0] text-white px-10 py-3 rounded-full font-bold text-sm shadow-sm active:bg-blue-800">
            {s.action_login}
          </button>
        </div>
      </div>

      <div className="px-6 mb-4 text-xs text-gray-600">{s.profile_more_actions}</div>

      <div className="mx-4 bg-app-surface rounded-3xl shadow-sm overflow-hidden flex flex-col mb-4">
        <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 border-b border-gray-100">
          <IcUser size={24} className="text-gray-600" />
          <span className="text-[15px] text-gray-900">{s.profile_title}</span>
        </button>
        <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50 border-b border-gray-100">
          <IcUsers size={24} className="text-gray-600" />
          <span className="text-[15px] text-gray-900">{s.profile_location_sharing}</span>
        </button>
        <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50">
          <IcCloud size={24} className="text-gray-600" />
          <span className="text-[15px] text-gray-900">{s.profile_offline_maps}</span>
        </button>
      </div>

      <div className="mx-4 bg-app-surface rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <button
          className="w-full flex items-center gap-4 p-4 active:bg-gray-50 border-b border-gray-100"
          onClick={() => go('settings.open')}
        >
          <IcSettings size={24} className="text-gray-600" />
          <span className="text-[15px] text-gray-900">{s.profile_settings}</span>
        </button>
        <button className="w-full flex items-center gap-4 p-4 active:bg-gray-50">
          <IcHelp size={24} className="text-gray-600" />
          <span className="text-[15px] text-gray-900">{s.profile_help_feedback}</span>
        </button>
      </div>

      <div className="mt-auto mb-8 text-center text-xs text-app-text-muted flex justify-center gap-2">
        <span>{s.profile_privacy_policy}</span>
        <span className="text-gray-400">•</span>
        <span>{s.profile_terms_of_service}</span>
      </div>
    </div>
  );
};

export default ProfilePage;
