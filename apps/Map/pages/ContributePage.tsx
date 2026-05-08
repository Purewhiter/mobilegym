import React from 'react';
import { useMapStore, selectUser } from '../state';
import { IcAddCircle, IcEdit, IcImage, IcNavForward, IcMessageSquare } from '../res/icons';
import { MapTabSheetFrame } from '../components/MapTabSheetFrame';
import { useMapStrings } from '../hooks/useMapStrings';

export const ContributePage: React.FC = () => {
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
          <h1 className="text-2xl font-normal text-app-text">{s.tab_contribute}</h1>
        </div>

        {/* User Level Card */}
        <div className="mt-2 px-4">
          <div className="mb-2 flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-200">
              <img
                src={`https://ui-avatars.com/api/?name=${user.name}&background=random`}
                alt="Avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-lg font-medium text-app-text">{user.name}</h2>
              <div className="flex items-center text-sm text-app-text-muted">
                <span className="mr-1 font-medium text-[#E37400]">{user.level} {s.contribute_level_suffix}</span>
              </div>
            </div>
            <button type="button" className="ml-auto text-sm font-medium text-blue-600">
              {s.contribute_view_profile}
            </button>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-app-text-muted">
              <span>{s.contribute_points_to_next}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full w-[20%] bg-[#E37400]" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 px-4">
          <div className="flex justify-between text-center">
            {[
              { label: s.contribute_add_place, icon: IcAddCircle },
              { label: s.contribute_update_place, icon: IcEdit },
              { label: s.contribute_add_review, icon: IcMessageSquare },
              { label: s.contribute_add_photo, icon: IcImage },
            ].map((action, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-blue-600">
                  <action.icon size={20} strokeWidth={1.5} />
                </div>
                <span className="text-xs font-medium text-gray-600">{action.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contribution Challenge */}
        <div className="mt-8 px-4">
          <div className="relative overflow-hidden rounded-xl border border-app-border p-4 shadow-sm">
            <h3 className="mb-1 text-lg font-medium text-app-text">{s.contribute_badge_title}</h3>
            <p className="mb-4 text-sm text-app-text-muted">{s.contribute_badge_desc}</p>

            <div className="absolute right-4 top-4 text-gray-200">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">🔒</div>
            </div>

            <div className="space-y-3">
              {[
                { label: s.contribute_post_photos, progress: '0/2' },
                { label: s.contribute_write_reviews, progress: '0/2' },
                { label: s.contribute_answer_questions, progress: '0/2' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                  <span className="text-sm text-gray-700">{item.label}</span>
                  <div className="flex items-center text-sm text-app-text-muted">
                    {item.progress} <IcNavForward size={16} className="ml-1 text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 px-1 text-xs text-gray-400">
            {s.contribute_info_note}
          </p>
        </div>
      </div>
    </MapTabSheetFrame>
  );
};
