import React from 'react';
import { IcBell, IcClose, IcMoreVert, IcAdd, IcFlag, IcStar } from '../res/icons';
import { useMapStore, selectUser } from '../state';
import { MapTabSheetFrame } from '../components/MapTabSheetFrame';
import { useMapStrings } from '../hooks/useMapStrings';

export const MePage: React.FC = () => {
  const user = useMapStore(selectUser);
  const s = useMapStrings();

  return (
    <MapTabSheetFrame>
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar pb-4"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-app-surface px-4 py-1">
          <h1 className="text-2xl font-normal text-app-text">{s.tab_me}</h1>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-black">
            <IcBell size={18} />
          </div>
        </div>

        {/* Address Card (Mock) */}
        <div className="mt-2 px-4">
          <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="relative z-10">
              <div className="mb-2 flex items-start justify-between">
                <h2 className="text-lg font-medium text-app-text">{s.me_address_title}</h2>
                <button type="button" className="text-gray-400">
                  <IcClose size={20} />
                </button>
              </div>
              <p className="mb-4 pr-12 text-sm text-gray-600">{s.me_address_desc}</p>
              <button
                type="button"
                className="rounded-full bg-[#008778] px-5 py-1.5 text-sm font-medium text-white"
              >
                {s.me_start}
              </button>
            </div>
            <div className="absolute bottom-0 right-0 h-24 w-24 rounded-tl-full bg-gray-200 opacity-20" />
          </div>
        </div>

        {/* Recent Interactions */}
        <div className="mt-8 px-4">
          <h2 className="mb-1 text-lg font-medium text-app-text">{s.me_recent_interactions}</h2>
          <p className="mb-4 text-sm text-app-text-muted">{s.me_recent_desc}</p>

          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
            {[s.me_chip_area, s.me_chip_category, s.me_chip_saved, s.me_chip_history].map((label) => (
              <button
                key={label}
                type="button"
                className="whitespace-nowrap rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700"
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="mb-6 w-full rounded-full bg-gray-50 py-2 text-center text-sm font-medium text-blue-600"
          >
            {s.me_view_all}
          </button>
        </div>

        {/* Lists */}
        <div className="px-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-app-text">{s.me_your_lists}</h2>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600"
            >
              <IcAdd size={16} /> {s.me_new_list}
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-500">
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current pt-0.5">
                  <div className="h-2 w-2 rotate-45 transform bg-current" />
                  ♥
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-medium text-app-text">{s.me_favorites}</h3>
                    <p className="text-xs text-app-text-muted">{s.me_list_private} · {user.lists.favorites.count} {s.me_list_places_count}</p>
                  </div>
                  <IcMoreVert size={20} className="text-gray-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                <IcFlag size={20} fill="currentColor" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-medium text-app-text">{s.me_want_to_go}</h3>
                    <p className="text-xs text-app-text-muted">{s.me_list_private} · {user.lists.wantToGo.count} {s.me_list_places_count}</p>
                  </div>
                  <IcMoreVert size={20} className="text-gray-400" />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-600">
                <IcStar size={20} fill="currentColor" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-medium text-app-text">{s.me_starred}</h3>
                    <p className="text-xs text-app-text-muted">{s.me_list_private} · {user.lists.starred.count} {s.me_list_places_count}</p>
                  </div>
                  <IcMoreVert size={20} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MapTabSheetFrame>
  );
};
